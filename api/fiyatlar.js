import express from 'express';
import { readPricesData } from '../../scrapers/index.js';

const app = express();

app.get('/api/fiyatlar', async (req, res) => {
    try {
        const { bolge, tür } = req.query;
        let prices = await readPricesData();
        
        if (bolge) {
            prices = prices.filter(item => item.bölge.toLowerCase() === bolge.toLowerCase());
        }
        
        if (tür) {
            prices = prices.filter(item => item.tür.toLowerCase().includes(tür.toLowerCase()));
        }
        
        res.json(prices);
    } catch (error) {
        console.error('API hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Express.js'i Vercel'e uygun şekilde export et
export default app;
