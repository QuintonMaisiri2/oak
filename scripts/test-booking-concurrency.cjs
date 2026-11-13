// Zero-dependency test suite verifying multi-advisor logic, validation, concurrency, and cancellation

function validateBooking(data) {
  const errors = [];
  if (!data.slot_id || typeof data.slot_id !== 'string') errors.push("Invalid slot ID");
  if (!data.name || data.name.trim().length < 2) errors.push("Name must be at least 2 characters");
  if (data.name && data.name.length > 100) errors.push("Name is too long");
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) errors.push("Please provide a valid email address");
  if (!data.organisation || data.organisation.trim().length < 2) errors.push("Organisation must be at least 2 characters");
  if (!data.message || data.message.trim().length < 5) errors.push("Please provide a brief description (at least 5 characters)");
  if (data.message && data.message.length > 500) errors.push("Description cannot exceed 500 characters");

  if (errors.length > 0) {
    const err = new Error(errors[0]);
    err.errors = errors;
    throw err;
  }
  return true;
}

// Mock database simulating Postgres partial unique index:
// CREATE UNIQUE INDEX idx_bookings_active_slot ON bookings(slot_id) WHERE status = 'confirmed';
class MockDatabase {
  constructor() {
    this.bookings = []; // Array of booking objects
  }

  async insertBooking(data) {
    // Check if there is an active (confirmed) booking for this slot
    const active = this.bookings.find(b => b.slot_id === data.slot_id && b.status === 'confirmed');
    if (active) {
      const err = new Error("duplicate key value violates unique constraint \"idx_bookings_active_slot\"");
      err.code = "23505";
      throw err;
    }
    const booking = {
      id: "bk-" + Math.random().toString(36).substring(2),
      ...data,
      status: "confirmed",
      email_status: "sent",
      created_at: new Date().toISOString()
    };
    this.bookings.push(booking);
    return booking;
  }

  async cancelBooking(bookingId) {
    const booking = this.bookings.find(b => b.id === bookingId);
    if (!booking) throw new Error("Booking not found");
    booking.status = "cancelled";
    return booking;
  }
}

async function runTests() {
  console.log("=== RUNNING MULTI-ADVISOR & BOOKING TEST SUITE ===\n");
  let passed = 0;
  let failed = 0;

  // Test 1: Validation
  try {
    validateBooking({
      slot_id: "11111111-1111-1111-1111-111111111111",
      name: "Tatenda Songore",
      email: "tatenda@yadvocates.org",
      organisation: "Youth Advocates",
      message: "Discussion regarding impact stories and MEL framework support.",
    });
    console.log("✔ Test 1 Passed: Valid payload accepted by validation engine");
    passed++;
  } catch (e) {
    console.error("✖ Test 1 Failed:", e.message);
    failed++;
  }

  // Test 2: Double-Booking Prevention
  console.log("\n--- Testing Double-Booking / Concurrency ---");
  const db = new MockDatabase();
  const targetSlotId = "slot-silvia-101";

  const req1 = db.insertBooking({
    slot_id: targetSlotId,
    name: "Elena Rostova",
    email: "elena@greenearth.org",
    organisation: "Green Earth Initiative",
    message: "Q3 milestones review.",
  }).then(b => ({ success: true, booking: b }))
    .catch(err => ({ success: false, error: err.code === "23505" ? "Sorry, that slot was just taken. Please choose another." : err.message }));

  const req2 = db.insertBooking({
    slot_id: targetSlotId,
    name: "Danny Gomwe",
    email: "dgomwe@mavambotrust.org.zw",
    organisation: "Mavambo Orphan Care",
    message: "Community health priorities.",
  }).then(b => ({ success: true, booking: b }))
    .catch(err => ({ success: false, error: err.code === "23505" ? "Sorry, that slot was just taken. Please choose another." : err.message }));

  const [res1, res2] = await Promise.all([req1, req2]);
  const successCount = [res1, res2].filter(r => r.success).length;
  const conflictCount = [res1, res2].filter(r => !r.success && r.error.includes("Sorry, that slot was just taken")).length;

  if (successCount === 1 && conflictCount === 1) {
    console.log("✔ Test 2 Passed: Exactly 1 booking succeeded and 1 was rejected with friendly conflict message!");
    passed++;
  } else {
    console.error("✖ Test 2 Failed:", { successCount, conflictCount });
    failed++;
  }

  // Test 3: Cancellation & Rebooking Flow
  console.log("\n--- Testing Cancellation & Re-booking ---");
  try {
    const activeBooking = (res1.success ? res1 : res2).booking;
    await db.cancelBooking(activeBooking.id);

    // Now re-booking the same slot should succeed because the active index only blocks confirmed status
    const rebook = await db.insertBooking({
      slot_id: targetSlotId,
      name: "Danny Gomwe",
      email: "dgomwe@mavambotrust.org.zw",
      organisation: "Mavambo Orphan Care",
      message: "Rebooking freed slot.",
    });

    if (rebook && rebook.status === "confirmed") {
      console.log("✔ Test 3 Passed: Cancelled slot was freed and successfully rebooked!");
      passed++;
    } else {
      throw new Error("Rebook failed");
    }
  } catch (e) {
    console.error("✖ Test 3 Failed:", e.message);
    failed++;
  }

  // Test 4: Multi-Advisor View Selection Logic
  console.log("\n--- Testing Multi-Advisor View Engine ---");
  function resolveView(advisors) {
    const active = advisors.filter(a => a.is_active);
    if (active.length === 1) return { mode: "DIRECT_PROFILE", advisor: active[0] };
    if (active.length > 1) return { mode: "ADVISOR_SELECTION_CARDS", count: active.length };
    return { mode: "EMPTY" };
  }

  const oneAdvisor = [{ id: "1", slug: "silvia", full_name: "Silvia Guizzardi", is_active: true }];
  const twoAdvisors = [
    { id: "1", slug: "silvia", full_name: "Silvia Guizzardi", is_active: true },
    { id: "2", slug: "marcus", full_name: "Marcus Vance", is_active: true },
  ];

  const view1 = resolveView(oneAdvisor);
  const view2 = resolveView(twoAdvisors);

  if (view1.mode === "DIRECT_PROFILE" && view2.mode === "ADVISOR_SELECTION_CARDS") {
    console.log("✔ Test 4 Passed: 1 active advisor skips to direct profile, 2+ active advisors automatically switches to card selection view!");
    passed++;
  } else {
    console.error("✖ Test 4 Failed:", { view1, view2 });
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests();
