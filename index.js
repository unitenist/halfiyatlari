const express = require("express");
const cors = require("cors");
const scrapers = require("./scrapers");

const app = express();
app.use(cors());
app.use(express.json());

// 📌 API Endpoint - Hal fiyatlarını getir
app.get("/api/fiyatlar", async (req, res) => {
    try {
        // Tüm scraper'ları paralel olarak çalıştır
        const [gazipasa, istanbul, antalya, ankara, mersin] = await Promise.allSettled([
            scrapers.gazipasa(),
            scrapers.istanbul(),
            scrapers.antalya(),
            scrapers.ankara(),
            scrapers.mersin(),
        ]);

        // Başarılı olanları filtrele
        const prices = [
            ...(gazipasa.status === "fulfilled" ? gazipasa.value : []),
            ...(istanbul.status === "fulfilled" ? istanbul.value : []),
            ...(antalya.status === "fulfilled" ? antalya.value : []),
            ...(ankara.status === "fulfilled" ? ankara.value : []),
            ...(mersin.status === "fulfilled" ? mersin.value : []),
        ];

        res.json(prices);
    } catch (error) {
        console.error("API hatası:", error);
        res.status(500).json({ error: "Veri çekme hatası" });
    }
});

// 📌 Vercel için özel export (app.listen kullanma!)
module.exports = app;
