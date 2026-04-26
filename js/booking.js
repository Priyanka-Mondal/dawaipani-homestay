// ============================================================
//  EMAILJS SETUP — fill in these 4 values from emailjs.com
//  See the setup guide on the booking page for instructions.
// ============================================================
const EMAILJS_PUBLIC_KEY     = 'Cv4p96w9L7Tjq0tRs';
const EMAILJS_SERVICE_ID     = 'service_jwiypzb';
const EMAILJS_OWNER_TEMPLATE = 'template_2qgw57l';          // email sent to you
const EMAILJS_GUEST_TEMPLATE = 'template_9dm35se';          // confirmation to guest
const OWNER_EMAIL            = 'placeholder@gmail.com';
// ============================================================

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

let currentYear, currentMonth;
let checkIn = null, checkOut = null;
let bookingsData = { fullyBooked: [], partiallyBooked: [] };

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (typeof emailjs !== 'undefined') emailjs.init(EMAILJS_PUBLIC_KEY);

  const now = new Date();
  currentYear  = now.getFullYear();
  currentMonth = now.getMonth();

  try {
    const res = await fetch('data/bookings.json');
    if (res.ok) bookingsData = await res.json();
  } catch (_) { /* no-op: show all days as available */ }

  renderCalendar();

  document.getElementById('prevMonth')?.addEventListener('click', goPrev);
  document.getElementById('nextMonth')?.addEventListener('click', goNext);
  document.getElementById('bookingForm')?.addEventListener('submit', handleSubmit);
});

// ── Calendar navigation ───────────────────────────────────
function goPrev() {
  const now = new Date();
  if (currentYear > now.getFullYear() ||
      (currentYear === now.getFullYear() && currentMonth > now.getMonth())) {
    if (--currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
  }
}
function goNext() {
  if (++currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
}

// ── Render calendar ───────────────────────────────────────
function renderCalendar() {
  document.getElementById('calMonthTitle').textContent =
    `${MONTH_NAMES[currentMonth]} ${currentYear}`;

  const container = document.getElementById('calDays');
  container.innerHTML = '';

  const today     = midnight(new Date());
  const firstDay  = new Date(currentYear, currentMonth, 1).getDay();
  const daysCount = new Date(currentYear, currentMonth + 1, 0).getDate();

  // blank cells before first day
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    container.appendChild(empty);
  }

  for (let d = 1; d <= daysCount; d++) {
    const date   = new Date(currentYear, currentMonth, d);
    const cell   = document.createElement('div');
    cell.className = 'cal-day';
    cell.textContent = d;

    if (date < today) {
      cell.classList.add('past');
    } else {
      const status = getDayStatus(date);
      cell.classList.add(status);
      if (midnight(date).getTime() === today.getTime()) cell.classList.add('today');
      if (status !== 'booked') cell.addEventListener('click', () => handleDateClick(new Date(date)));
    }

    applyRangeStyle(cell, date);
    container.appendChild(cell);
  }
}

function getDayStatus(date) {
  const d = midnight(date);
  for (const r of (bookingsData.fullyBooked || [])) {
    if (d >= midnight(new Date(r.from)) && d <= midnight(new Date(r.to))) return 'booked';
  }
  for (const r of (bookingsData.partiallyBooked || [])) {
    if (d >= midnight(new Date(r.from)) && d <= midnight(new Date(r.to))) return 'partial';
  }
  return 'available';
}

function applyRangeStyle(cell, date) {
  if (!checkIn) return;
  const d  = midnight(date);
  const ci = midnight(checkIn);

  if (d.getTime() === ci.getTime()) { cell.classList.add('selected'); return; }

  if (checkOut) {
    const co = midnight(checkOut);
    if (d.getTime() === co.getTime()) { cell.classList.add('selected'); return; }
    if (d > ci && d < co) {
      cell.classList.remove('available', 'partial', 'booked');
      cell.classList.add('in-range');
    }
  }
}

// ── Date selection ────────────────────────────────────────
function handleDateClick(date) {
  if (!checkIn || (checkIn && checkOut)) {
    checkIn  = date;
    checkOut = null;
  } else {
    if (date <= checkIn) {
      checkIn = date; checkOut = null;
    } else if (rangeHasBookedDays(checkIn, date)) {
      flashError('Your selected range includes fully booked dates. Please choose different dates.');
      return;
    } else {
      checkOut = date;
    }
  }
  updateDisplay();
  renderCalendar();
}

function rangeHasBookedDays(from, to) {
  const cur = new Date(from);
  while (cur <= to) {
    if (getDayStatus(cur) === 'booked') return true;
    cur.setDate(cur.getDate() + 1);
  }
  return false;
}

function updateDisplay() {
  const el  = document.getElementById('selectedDatesDisplay');
  const ci  = document.getElementById('checkIn');
  const co  = document.getElementById('checkOut');

  if (checkIn && !checkOut) {
    el.textContent    = `Check-in: ${fmtLong(checkIn)} — now select check-out date`;
    ci.value          = fmtShort(checkIn);
    co.value          = '';
  } else if (checkIn && checkOut) {
    const nights      = Math.round((checkOut - checkIn) / 864e5);
    el.textContent    = `${fmtLong(checkIn)}  →  ${fmtLong(checkOut)}  (${nights} night${nights > 1 ? 's' : ''})`;
    ci.value          = fmtShort(checkIn);
    co.value          = fmtShort(checkOut);
  } else {
    el.textContent    = 'Select your check-in date on the calendar above.';
    ci.value = co.value = '';
  }
}

function flashError(msg) {
  const el = document.getElementById('selectedDatesDisplay');
  const prev = el.textContent;
  el.style.color = '#e07070';
  el.textContent = msg;
  setTimeout(() => { el.style.color = ''; el.textContent = prev; }, 3500);
}

// ── Form submit ───────────────────────────────────────────
async function handleSubmit(e) {
  e.preventDefault();

  if (!checkIn || !checkOut) {
    showMsg('Please select both check-in and check-out dates on the calendar.', 'error');
    return;
  }

  const btn = document.getElementById('submitBtn');
  btn.disabled    = true;
  btn.textContent = 'Sending…';

  const name    = document.getElementById('guestName').value.trim();
  const email   = document.getElementById('guestEmail').value.trim();
  const phone   = document.getElementById('guestPhone').value.trim();
  const guests  = document.getElementById('numGuests').value;
  const rooms   = document.getElementById('numRooms').value;
  const message = document.getElementById('guestMessage').value.trim() || 'None';
  const nights  = Math.round((checkOut - checkIn) / 864e5);

  const params = {
    guest_name:  name,
    guest_email: email,
    guest_phone: phone,
    check_in:    fmtLong(checkIn),
    check_out:   fmtLong(checkOut),
    nights:      nights,
    guests:      guests,
    rooms:       rooms,
    message:     message,
  };

  try {
    if (typeof emailjs === 'undefined' ||
        EMAILJS_PUBLIC_KEY === 'YOUR_PUBLIC_KEY') {
      throw new Error('EmailJS not configured');
    }

    // Email to owner
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_OWNER_TEMPLATE, {
      ...params, to_email: OWNER_EMAIL
    });

    // Confirmation to guest
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_GUEST_TEMPLATE, {
      ...params, to_email: email
    });

    showMsg(
      `Thank you, ${name}! Your booking request for ${fmtLong(checkIn)} → ${fmtLong(checkOut)} has been received. ` +
      `A confirmation has been sent to ${email}. The owner will contact you within 24 hours.`,
      'success'
    );

    e.target.reset();
    checkIn = checkOut = null;
    updateDisplay();
    renderCalendar();

  } catch (err) {
    console.error('EmailJS error:', err);
    if (err.message === 'EmailJS not configured') {
      showMsg(
        'Email service is not yet configured. Please set up EmailJS keys in js/booking.js ' +
        '(see the setup guide below), or contact us directly at priyanka02010@gmail.com.',
        'error'
      );
    } else if (window.location.protocol === 'file:') {
      showMsg(
        'You are opening the site as a local file. EmailJS requires the site to be served over HTTP. ' +
        'Please deploy to GitHub Pages, or run a local server (see instructions below).',
        'error'
      );
    } else {
      const detail = err?.text || err?.message || JSON.stringify(err);
      showMsg(
        `Booking failed: ${detail}. Please try again or email us at priyanka02010@gmail.com.`,
        'error'
      );
    }
  }

  btn.disabled    = false;
  btn.textContent = 'Send Booking Request';
}

function showMsg(text, type) {
  const el = document.getElementById('formMessage');
  el.textContent = text;
  el.className   = `form-message ${type}`;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Helpers ───────────────────────────────────────────────
function midnight(d) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}
function fmtShort(d) { return d.toISOString().split('T')[0]; }
function fmtLong(d)  { return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }); }
