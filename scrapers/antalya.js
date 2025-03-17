const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeAntalya() {
    try {
        const url = 'https://www.antalya.bel.tr/halden-gunluk-fiyatlar';
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        
        const prices = [];
        
        // Tablo verilerini seç ve işle
        // Not: Gerçek seçiciler web sitesinin yapısına göre değiştirilmelidir
        $('table tbody tr').each((index, element) => {
            if (index === 0) return; // Başlık satırını atla
            
            const columns = $(element).find('td');
            
            if (columns.length >= 3) {
                const tür = $(columns[0]).text().trim();
                const fiyat = $(columns[1]).text().trim();
                
                prices.push({
                    bölge: 'Antalya',
                    tür,
                    fiyat
                });
            }
        });
        
        return prices;
    } catch (error) {
        console.error('Antalya veri çekme hatası:', error);
        return [];
    }
}

module.exports = scrapeAntalya;