// import axios from "axios";

// export default async function getClientLocation(ip) {
//     try {
//         const res = await axios.get(`http://ip-api.com/json/${ip}`);
//         if (res.data.status !== "success") return null;
//
//         return {
//             city: res.data.city,
//             country: res.data.country,
//             lat: res.data.lat,
//             lon: res.data.lon,
//         };
//     } catch (err) {
//         console.error(err);
//         return null;
//     }
// }

module.exports = async function getClientLocation(req) {
    // حاليا نخليها عمان لأنك مش بدك APIات
    // لاحقاً نربط geoIP من DB أو من ملف
    return {
        city: "Amman",
        country: "Jordan",
        timezone: "Asia/Amman"
    };
};
