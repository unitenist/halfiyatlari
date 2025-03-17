const express = require("express");
const cors = require("cors");
const scrapers = require("./scrapers");

const app = express();
app.use(cors());
app.use(express.json());

// 📌 API Endpoint - Tarih Aralığı Desteğiyle Fiyatları Getir
app.get("/api/fiyatlar", async (req, res) => {
    try {
        const { bolge, tür, startDate, endDate } = req.query;

        // Tarihleri kontrol et ve uygun formatta al
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        const [gazipasa, istanbul, antalya, ankara, mersin] = await Promise.allSettled([
            scrapers.gazipasa(start, end),
            scrapers.istanbul(start, end),
            scrapers.antalya(start, end),
            scrapers.ankara(start, end),
            scrapers.mersin(start, end),
        ]);

        let prices = [
            ...(gazipasa.status === "fulfilled" ? gazipasa.value : []),
            ...(istanbul.status === "fulfilled" ? istanbul.value : []),
            ...(antalya.status === "fulfilled" ? antalya.value : []),
            ...(ankara.status === "fulfilled" ? ankara.value : []),
            ...(mersin.status === "fulfilled" ? mersin.value : []),
        ];

        // Filtreleme işlemi
        if (bolge) {
            prices = prices.filter((item) => item.bölge.toLowerCase() === bolge.toLowerCase());
        }

        if (tür) {
            prices = prices.filter((item) => item.tür.toLowerCase().includes(tür.toLowerCase()));
        }

        res.json(prices);
    } catch (error) {
        console.error("API hatası:", error);
        res.status(500).json({ error: "Veri çekme hatası" });
    }
});

// 📌 Vercel İçin Export (app.listen kaldırıldı)
module.exports = app;
