import express from "express";
import axios from "axios";
import getClientLocation from "../utils/getClientLocation.js";
import calcNextPrayer from "../utils/calcNextPrayer.js";
import worldWave from "../utils/worldWave.js";

const router = express.Router();

/* ========================================
   1) 🇯🇴 مدينتك الحالية حسب الـ IP
======================================== */
router.get("/local", async (req, res) => {
    try {
        const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

        const loc = await getClientLocation(ip);

        if (!loc) return res.status(404).json({ message: "Location failed" });

        const prayer = await axios.get("https://api.aladhan.com/v1/timingsByCity", {
            params: {
                city: loc.city,
                country: loc.country,
                method: 3, // Muslim World League
            },
        });

        return res.json({
            city: loc.city,
            country: loc.country,
            timezone: prayer.data.data.meta.timezone,
            times: prayer.data.data.timings,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Failed" });
    }
});

/* ========================================
  2) 🕋 الصلاة القادمة
======================================== */
router.get("/next-prayer", async (req, res) => {
    try {
        const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
        const loc = await getClientLocation(ip);

        const timingsRes = await axios.get("https://api.aladhan.com/v1/timingsByCity", {
            params: {
                city: loc.city,
                country: loc.country,
                method: 3,
            },
        });

        const times = timingsRes.data.data.timings;
        const timezone = timingsRes.data.data.meta.timezone;

        const next = calcNextPrayer(times, timezone);

        return res.json(next);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Error" });
    }
});

/* ========================================
   3) 🗺️ الدول التي سيحين فيها الأذان قريباً
======================================== */
router.get("/upcoming-global", async (req, res) => {
    try {
        const limit = Number(req.query.limit || 5);

        // worldWave() → يرجع قائمة من الدول + مدينة + countdown
        const list = await worldWave(limit);

        return res.json({
            items: list,
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Error" });
    }
});

/* ========================================
   4) 🌍 موجة الأذان "غيمة الأذان"
======================================== */
router.get("/wave", async (req, res) => {
    try {
        const wave = await worldWave(15);
        return res.json({ wave });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed" });
    }
});

export default router;
