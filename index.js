const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');
const scrapers = require('./scrapers');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Statik dosyalar için klasör

// Ana sayfa için HTML endpoint'i
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Veri dosyası yolu
const dataFilePath = path.join(__dirname, 'data', 'prices.json');

// Verileri dosyadan oku
async function readPricesData() {
    try {
        const data = await fs.readFile(dataFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Veri okuma hatası:', error);
        return [];
    }
}

// Verileri dosyaya yaz
async function writePricesData(data) {
    try {
        // data klasörünün varlığını kontrol et, yoksa oluştur
        const dataDir = path.join(__dirname, 'data');
        try {
            await fs.access(dataDir);
        } catch {
            await fs.mkdir(dataDir, { recursive: true });
        }
        
        await fs.writeFile(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
        console.log('Veriler başarıyla kaydedildi.');
    } catch (error) {
        console.error('Veri yazma hatası:', error);
    }
}

// Tüm verileri çek ve güncelle
async function updateAllPrices() {
    try {
        console.log('Fiyat verileri güncelleniyor...');
        
        // Tüm scraperları paralel olarak çalıştır
        const [gazipasaPrices, istanbulPrices, antalyaPrices, ankaraPrices, mersinPrices] = await Promise.allSettled([
            scrapers.gazipasa(),
            scrapers.istanbul(),
            scrapers.antalya(),
            scrapers.ankara(),
            scrapers.mersin()
        ]);
        
        // Promise.allSettled sonuçlarını işle
        const allPrices = [
            ...(gazipasaPrices.status === 'fulfilled' ? gazipasaPrices.value : []),
            ...(istanbulPrices.status === 'fulfilled' ? istanbulPrices.value : []),
            ...(antalyaPrices.status === 'fulfilled' ? antalyaPrices.value : []),
            ...(ankaraPrices.status === 'fulfilled' ? ankaraPrices.value : []),
            ...(mersinPrices.status === 'fulfilled' ? mersinPrices.value : [])
        ];
        
        // Verileri dosyaya kaydet
        await writePricesData(allPrices);
        console.log('Tüm fiyat verileri güncellendi.');
        console.log(`Toplam ${allPrices.length} ürün fiyatı alındı.`);
        
        return allPrices;
    } catch (error) {
        console.error('Veri güncelleme hatası:', error);
        return [];
    }
}

// API endpoint'i - Fiyatları getir
app.get('/api/fiyatlar', async (req, res) => {
    try {
        const { bolge, tür } = req.query;
        let prices = await readPricesData();
        
        // Filtreleme işlemi
        if (bolge) {
            prices = prices.filter(item => 
                item.bölge.toLowerCase() === bolge.toLowerCase());
        }
        
        if (tür) {
            prices = prices.filter(item => 
                item.tür.toLowerCase().includes(tür.toLowerCase()));
        }
        
        res.json(prices);
    } catch (error) {
        console.error('API hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Uygulama başlangıcında verileri güncelle
(async () => {
    try {
        await updateAllPrices();
    } catch (error) {
        console.error('Başlangıç veri güncelleme hatası:', error);
    }
})();

// Her gün saat 06:00'da verileri güncelle
cron.schedule('0 6 * * *', async () => {
    try {
        await updateAllPrices();
    } catch (error) {
        console.error('Zamanlanmış veri güncelleme hatası:', error);
    }
});

// Sunucuyu başlat
app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
});