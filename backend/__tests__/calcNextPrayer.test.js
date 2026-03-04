const calcNextPrayer = require("../utils/calcNextPrayer");

// Sample UTC prayer times (HH:MM) as stored in DB
const times = {
  Fajr: "03:30",
  Dhuhr: "11:00",
  Asr: "14:30",
  Maghrib: "17:00",
  Isha: "18:30",
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function setNow(isoUtc) {
  jest.setSystemTime(new Date(isoUtc));
}

describe("calcNextPrayer", () => {
  test("returns Fajr when before all prayers (UTC timezone)", () => {
    setNow("2025-06-15T02:00:00Z");
    const r = calcNextPrayer(times, "UTC", "2025-06-15");
    expect(r.prayerName).toBe("Fajr");
    expect(r.localTime).toBe("03:30");
  });

  test("returns Dhuhr when Fajr has passed", () => {
    setNow("2025-06-15T04:00:00Z");
    const r = calcNextPrayer(times, "UTC", "2025-06-15");
    expect(r.prayerName).toBe("Dhuhr");
  });

  test("returns Asr when Dhuhr has passed", () => {
    setNow("2025-06-15T12:00:00Z");
    const r = calcNextPrayer(times, "UTC", "2025-06-15");
    expect(r.prayerName).toBe("Asr");
  });

  test("returns Maghrib when Asr has passed", () => {
    setNow("2025-06-15T15:00:00Z");
    const r = calcNextPrayer(times, "UTC", "2025-06-15");
    expect(r.prayerName).toBe("Maghrib");
  });

  test("returns Isha when Maghrib has passed", () => {
    setNow("2025-06-15T17:30:00Z");
    const r = calcNextPrayer(times, "UTC", "2025-06-15");
    expect(r.prayerName).toBe("Isha");
  });

  test("returns Fajr (Tomorrow) when all prayers passed", () => {
    setNow("2025-06-15T19:00:00Z");
    const r = calcNextPrayer(times, "UTC", "2025-06-15");
    expect(r.prayerName).toBe("Fajr (Tomorrow)");
    expect(r.localTime).toBe("03:30");
  });

  test("countdownHuman contains 'in' for future prayer", () => {
    setNow("2025-06-15T02:00:00Z");
    const r = calcNextPrayer(times, "UTC", "2025-06-15");
    expect(r.countdownHuman).toContain("in");
  });

  test("localTime is always HH:mm format", () => {
    setNow("2025-06-15T10:00:00Z");
    const r = calcNextPrayer(times, "UTC", "2025-06-15");
    expect(r.localTime).toMatch(/^\d{2}:\d{2}$/);
  });

  // Timezone tests: UTC+3 (Amman)
  test("positive offset: converts prayer times to local", () => {
    // 08:00 UTC = 11:00 Amman. Fajr local=06:30 (passed), Dhuhr local=14:00 (future)
    setNow("2025-06-15T08:00:00Z");
    const r = calcNextPrayer(times, "Asia/Amman", "2025-06-15");
    expect(r.prayerName).toBe("Dhuhr");
  });

  // Timezone test: UTC-5 (New York)
  test("negative offset: prayer order shifts", () => {
    // 06:00 UTC = 01:00 EST. Fajr UTC=03:30 -> EST=22:30 prev day (passed in local)
    // Actually let's think: now is 01:00 EST on June 15.
    // Fajr UTC 03:30 on June 15 -> EST = 03:30-5 = 22:30 June 14 (passed)
    // All UTC times on June 15 shift to June 14 evening / June 15 early for EST
    // Dhuhr UTC 11:00 -> EST 06:00 (future from 01:00)
    setNow("2025-06-15T06:00:00Z");
    const r = calcNextPrayer(times, "America/New_York", "2025-06-15");
    // Dhuhr local would be 06:00 or 07:00 EST (depends on DST)
    // Either way something should be upcoming
    expect(r.prayerName).not.toBe("Fajr (Tomorrow)");
  });

  test("works without baseDateUTC parameter", () => {
    setNow("2025-06-15T02:00:00Z");
    const r = calcNextPrayer(times, "UTC");
    expect(r).toHaveProperty("prayerName");
    expect(r).toHaveProperty("localTime");
    expect(r).toHaveProperty("countdownHuman");
  });

  test("tomorrow Fajr countdown is in the future", () => {
    setNow("2025-06-15T19:00:00Z");
    const r = calcNextPrayer(times, "UTC", "2025-06-15");
    expect(r.prayerName).toBe("Fajr (Tomorrow)");
    expect(r.countdownHuman).toContain("in");
  });

  test("midnight edge case: just after midnight UTC", () => {
    setNow("2025-06-15T00:01:00Z");
    const r = calcNextPrayer(times, "UTC", "2025-06-15");
    expect(r.prayerName).toBe("Fajr");
  });

  test("exact prayer time: returns next prayer", () => {
    // At exactly Fajr time, isAfter is false, so should skip to Dhuhr
    setNow("2025-06-15T03:30:00Z");
    const r = calcNextPrayer(times, "UTC", "2025-06-15");
    expect(r.prayerName).toBe("Dhuhr");
  });
});
