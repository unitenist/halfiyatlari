const puppeteer = require('puppeteer');

// Filtrelenecek ürünler listesi
const FILTERED_PRODUCTS = [
    'çilek', 'muz', 'avokado', 'ÇİLEK', 'MUZ', 'AVOKADO',
];

// Tarih hesaplama yardımcı fonksiyonları
function getDefaultDates() {
    const today = new Date();
    
    // Başlangıç tarihi: 2 hafta önce
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(today.getDate() - 14);
    
    // Bitiş tarihi: Bugünün durumuna göre belirle
    let endDateValue;
    const dayOfWeek = today.getDay(); // 0: Pazar, 1: Pazartesi, ..., 6: Cumartesi
    
    if (dayOfWeek === 1) { // Pazartesi
        // Önceki hafta cuma (3 gün önce)
        endDateValue = new Date(today);
        endDateValue.setDate(today.getDate() - 3);
    } else if (dayOfWeek >= 2 && dayOfWeek <= 5) { // Salı-Cuma
        // Bir önceki iş günü
        endDateValue = new Date(today);
        endDateValue.setDate(today.getDate() - 1);
    } else { // Cumartesi veya Pazar
        // Önceki cuma
        endDateValue = new Date(today);
        endDateValue.setDate(today.getDate() - (dayOfWeek === 0 ? 2 : 1));
    }
    
    return {
        startDate: twoWeeksAgo,
        endDate: endDateValue
    };
}

// Tarih formatı yardımcı fonksiyonları
function formatDateYMD(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateDMY(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

// API tarafından gönderilen tarih parametrelerini kullanacak şekilde ana scraper fonksiyonu
async function scrapeWithDates(region, startDateStr, endDateStr) {
    // Tarih parametrelerini Date nesnelerine dönüştür
    let startDate, endDate;
    
    if (startDateStr) {
        startDate = new Date(startDateStr);
    }
    
    if (endDateStr) {
        endDate = new Date(endDateStr);
    }
    
    // Tarih parametreleri geçerli değilse varsayılan tarihleri hesapla
    if (!startDate || isNaN(startDate.getTime()) || !endDate || isNaN(endDate.getTime())) {
        const dates = getDefaultDates();
        if (!startDate || isNaN(startDate.getTime())) {
            startDate = dates.startDate;
        }
        if (!endDate || isNaN(endDate.getTime())) {
            endDate = dates.endDate;
        }
    }
    
    // Bölgeye göre uygun scraper'ı çağır
    if (region) {
        switch(region.toLowerCase()) {
            case 'gazipasa':
            case 'gazipaşa':
                return scrapeGazipasa(startDate, endDate);
            case 'istanbul':
            case 'İstanbul':
                return scrapeIstanbul(endDate);
            case 'antalya':
                return scrapeAntalya(endDate);
            case 'ankara':
                return scrapeAnkara(startDate, endDate);
            case 'mersin':
                return scrapeMersin(endDate);
        }
    }
    
    // Bölge belirtilmemişse veya geçersizse tüm bölgeler için scrape işlemi yap
    const results = [];
    
    try {
        const gazipasaResults = await scrapeGazipasa(startDate, endDate);
        results.push(...gazipasaResults);
    } catch (error) {
        console.error('Gazipaşa veri çekme hatası:', error);
    }
    
    try {
        const istanbulResults = await scrapeIstanbul(endDate);
        results.push(...istanbulResults);
    } catch (error) {
        console.error('İstanbul veri çekme hatası:', error);
    }
    
    try {
        const antalyaResults = await scrapeAntalya(endDate);
        results.push(...antalyaResults);
    } catch (error) {
        console.error('Antalya veri çekme hatası:', error);
    }
    
    try {
        const ankaraResults = await scrapeAnkara(startDate, endDate);
        results.push(...ankaraResults);
    } catch (error) {
        console.error('Ankara veri çekme hatası:', error);
    }
    
    try {
        const mersinResults = await scrapeMersin(endDate);
        results.push(...mersinResults);
    } catch (error) {
        console.error('Mersin veri çekme hatası:', error);
    }
    
    return results;
}

async function scrapeGazipasa(startDate, endDate) {
    // Gazipaşa için tarih parametrelerini kullan (eğer site destekliyorsa)
    // Şu an için tarih parametrelerini kullanmıyoruz, site yapısı değişirse güncellenebilir
    return scrapeHalFiyatlari('Gazipaşa', 'https://gazipasa.bel.tr/15032025-hal-fiyatlari', 'table tbody tr', 2, [0, 3, 2, 1]);
}

async function scrapeIstanbul(endDate) {
    let browser;
    try {
        console.log('İstanbul verileri çekiliyor...');
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.goto('https://tarim.ibb.istanbul/avrupa-yakasi-hal-mudurlugu/hal-fiyatlari.html', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Sayfanın yüklenmesi için biraz bekleyelim
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Tarih ve kategori seçimi yapılıp olduğunu kontrol et
        const hasDateInput = await page.evaluate(() => {
            return document.querySelector('input[id="dtGunlukTarih"]') !== null;
        });

        const hasCategorySelect = await page.evaluate(() => {
            return document.querySelector('select[id="cbGunlukKategori"]') !== null;
        });

        console.log(`İstanbul: Tarih giriş alanı var mı? ${hasDateInput}`);
        console.log(`İstanbul: Kategori seçim alanı var mı? ${hasCategorySelect}`);

        if (hasDateInput && hasCategorySelect) {
            // Tarih parametresini kullan veya varsayılan tarihi hesapla
            let formattedDate;
            if (endDate && !isNaN(endDate.getTime())) {
                formattedDate = formatDateYMD(endDate);
            } else {
                const { endDate: defaultEndDate } = getDefaultDates();
                formattedDate = formatDateYMD(defaultEndDate);
            }

            // Tarih seçimi yap
            await page.evaluate((date) => {
                const dateInput = document.querySelector('input[name="tarih"]');
                if (dateInput) {
                    dateInput.value = date;
                }
            }, formattedDate);

            // Kategori seçimi yap (Meyve seçelim - genellikle value="5" olur)
            await page.evaluate(() => {
                const categorySelect = document.querySelector('select[id="dtGunlukKategori"]');
                if (categorySelect) {
                    const meyveOption = Array.from(categorySelect.options).find(option =>
                        option.textContent.includes('Meyve'));

                    if (meyveOption) {
                        categorySelect.value = meyveOption.value;
                    } else {
                        categorySelect.selectedIndex = 1; // 0 genellikle "Seçiniz" olur
                    }
                }
            });

            // Göster butonuna tıkla
            const gosterButton = await page.$('input[type="submit"][value="Göster"]');
            if (gosterButton) {
                await gosterButton.click();
                await page.waitForSelector('table tbody tr', { timeout: 10000 });
                await new Promise(resolve => setTimeout(resolve, 2000)); // Tablonun yüklenmesi için ek bekleme
            }
        } else {
            console.error('İstanbul: Kategori seçim alanı bulunamadı. HTML yapısını kontrol edin.');
            return [];
        }

        // Tablodan verileri çek
        const prices = await page.evaluate((filteredProducts) => {
            const results = [];
            const rows = document.querySelectorAll('table tbody tr');

            rows.forEach(row => {
                const cols = row.querySelectorAll('td');
                if (cols.length >= 4) {
                    const firstCell = cols[0].textContent.trim();
                    if (firstCell === 'Ürün Adı' || firstCell === '') {
                        return; // Başlık satırını atla
                    }

                    const tür = cols[0].textContent.trim();
                    const birim = cols[1].textContent.trim();
                    const enDusukFiyat = cols[2].textContent.trim();
                    const enYuksekFiyat = cols[3].textContent.trim();

                    // Fiyatları birleştir
                    const fiyat = `${enDusukFiyat} - ${enYuksekFiyat}`;

                    // Ürün adını küçük harfe çevir ve filtreleme yap
                    const lowerTür = tür.toLowerCase();
                    const isFiltered = filteredProducts.some(product =>
                        lowerTür.includes(product) ||
                        (lowerTür.includes('çilek') && (birim.includes('1') || birim.includes('2'))) ||
                        (lowerTür.includes('muz') && (birim.includes('1') || birim.includes('2'))) ||
                        (lowerTür.includes('avokado') && (birim.includes('1') || birim.includes('2')))
                    );

                    if (tür && enDusukFiyat && isFiltered) {
                        results.push({
                            bölge: 'İstanbul',
                            tür,
                            fiyat,
                            sütun3: birim,
                            sütun4: ''
                        });
                    }
                }
            });

            return results;
        }, FILTERED_PRODUCTS);

        console.log(`İstanbul: ${prices.length} filtrelenmiş ürün bulundu.`);
        return prices;
    } catch (error) {
        console.error('İstanbul veri çekme hatası:', error);
        return getFilteredExampleData('İstanbul');
    } finally {
        if (browser) await browser.close();
    }
}

async function scrapeAntalya(endDate) {
    // Antalya için tarih parametrelerini kullan (eğer site destekliyorsa)
    // Şu an için tarih parametrelerini kullanmıyoruz, site yapısı değişirse güncellenebilir
    return scrapeHalFiyatlari('Antalya', 'https://www.antalya.bel.tr/halden-gunluk-fiyatlar', 'tbody.is-current-price-body tr', 5, [1, 2, 3, 4]);
}

async function scrapeAnkara(startDate, endDate) {
    let browser;
    try {
        console.log('Ankara verileri çekiliyor...');
        browser = await puppeteer.launch({ 
            headless: true, 
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        
        const page = await browser.newPage();
        await page.goto('https://www.ankara.bel.tr/hal-fiyatlari', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        
        // Sayfanın yüklenmesi için biraz bekleyelim
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Tarih seçim formunun olup olmadığını kontrol et
        const hasDateForm = await page.evaluate(() => {
            return document.evaluate('//*[@id="container"]/main/div/div/div[1]/div/form', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue !== null;
        });
        
        console.log(`Ankara: Tarih seçim formu var mı? ${hasDateForm}`);
        
        if (hasDateForm) {
            // Tarih parametrelerini kullan veya varsayılan tarihleri hesapla
            let formattedStartDate, formattedEndDate;
            
            if (startDate && !isNaN(startDate.getTime())) {
                formattedStartDate = formatDateDMY(startDate);
            } else {
                const { startDate: defaultStartDate } = getDefaultDates();
                formattedStartDate = formatDateDMY(defaultStartDate);
            }
            
            if (endDate && !isNaN(endDate.getTime())) {
                formattedEndDate = formatDateDMY(endDate);
            } else {
                const { endDate: defaultEndDate } = getDefaultDates();
                formattedEndDate = formatDateDMY(defaultEndDate);
            }
            
            // Başlangıç ve bitiş tarihlerini ayarla
            await page.evaluate((startDate, endDate) => {
                const startDateInput = document.evaluate('//*[@id="container"]/main/div/div/div[1]/div/form/div/div[2]/div/input', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                const endDateInput = document.evaluate('//*[@id="container"]/main/div/div/div[1]/div/form/div/div[3]/div/input', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                
                if (startDateInput) {
                    startDateInput.value = startDate;
                }
                
                if (endDateInput) {
                    endDateInput.value = endDate;
                }
            }, formattedStartDate, formattedEndDate);
            
            // Ara butonuna tıkla
            await page.evaluate(() => {
                const searchButton = document.evaluate('//*[@id="container"]/main/div/div/div[1]/div/form/div/div[4]/button', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (searchButton) {
                    searchButton.click();
                } else {
                    console.error('Ankara: Ara butonu bulunamadı.');
                }
            });
            
            // Tablonun yüklenmesini bekle
            await page.waitForSelector('table.table.table-striped.table-bordered tbody tr', { timeout: 10000 });
            await new Promise(resolve => setTimeout(resolve, 2000)); // Tablonun yüklenmesi için ek bekleme
        }
        
        // Tablodan verileri çek
        const prices = await page.evaluate((filteredProducts) => {
            const results = [];
            const rows = document.querySelectorAll('table.table.table-striped.table-bordered tbody tr');
            
            rows.forEach(row => {
                const cols = row.querySelectorAll('td');
                if (cols.length >= 5) {
                    const tür = cols[0].textContent.trim(); // Cinsi
                    const birim = cols[1].textContent.trim(); // Birim
                    const asgari = cols[2].textContent.trim(); // Asgari fiyat
                    const azami = cols[3].textContent.trim(); // Azami fiyat
                    const tarih = cols[4].textContent.trim(); // Tarih
                    
                    // Fiyatları birleştir
                    const fiyat = `${asgari} - ${azami}`;
                    
                    // Ürün adını kontrol et
                    const lowerTür = tür.toLowerCase();
                    const isFiltered = filteredProducts.some(product => 
                        lowerTür.includes(product.toLowerCase()) || 
                        tür.toUpperCase().includes(product.toUpperCase())
                    );
                    
                    if (tür && (asgari || azami) && isFiltered) {
                        results.push({
                            bölge: 'Ankara',
                            tür,
                            fiyat,
                            sütun3: birim,
                            sütun4: tarih
                        });
                    }
                }
            });
            
            return results;
        }, FILTERED_PRODUCTS);
        
        console.log(`Ankara: ${prices.length} filtrelenmiş ürün bulundu.`);
        return prices;
    } catch (error) {
        console.error('Ankara veri çekme hatası:', error);
        return [];
    } finally {
        if (browser) await browser.close();
    }
}

async function scrapeMersin(endDate) {
    let browser;
    try {
        console.log('Mersin verileri çekiliyor...');
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.goto('https://www.mersin.bel.tr/hal-fiyatlari', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Sayfanın yüklenmesi için biraz bekleyelim
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Tarih ve kategori seçimi yapılıp olduğunu kontrol et
        const hasDateInput = await page.evaluate(() => {
            return document.querySelector('input[name="published"]') !== null;
        });

        const hasCategorySelect = await page.evaluate(() => {
            return document.querySelector('select[name="product_category"]') !== null;
        });

        console.log(`Mersin: Tarih giriş alanı var mı? ${hasDateInput}`);
        console.log(`Mersin: Kategori seçim alanı var mı? ${hasCategorySelect}`);

        if (hasDateInput && hasCategorySelect) {
            // Tarih parametresini kullan veya varsayılan tarihi hesapla
            let formattedDate;
            if (endDate && !isNaN(endDate.getTime())) {
                formattedDate = formatDateYMD(endDate);
            } else {
                const { endDate: defaultEndDate } = getDefaultDates();
                formattedDate = formatDateYMD(defaultEndDate);
            }

            // Tarih seçimi yap
            await page.evaluate((date) => {
                const dateInput = document.querySelector('input[name="published"]');
                if (dateInput) {
                    dateInput.value = date;
                }
            }, formattedDate);

            // Kategori seçimi yap
            await page.evaluate(() => {
                const categorySelect = document.querySelector('select[name="product_category"]');
                if (categorySelect) {
                    const meyveOption = Array.from(categorySelect.options).find(option =>
                        option.textContent.includes('MEYVE'));

                    if (meyveOption) {
                        categorySelect.value = meyveOption.value;
                    } else {
                        categorySelect.selectedIndex = 1; // 0 genellikle "Seçiniz" olur
                    }
                }
            });

            // Göster butonuna tıklama
            await page.evaluate(() => {
                const gosterButton = document.evaluate('//*[@id="btnSubmit"]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                if (gosterButton) {
                    gosterButton.click();
                } else {
                    console.error('Mersin: Göster butonu bulunamadı.');
                }
            });

            // Tablonun yüklenmesini bekle
            await page.waitForSelector('table.table.confined-table tbody tr', { timeout: 10000 });
            await new Promise(resolve => setTimeout(resolve, 2000)); // Tablonun yüklenmesi için ek bekleme

            // Tablodan verileri çek
            const prices = await page.evaluate((filteredProducts) => {
                const results = [];
                const rows = document.querySelectorAll('table.table.confined-table tbody tr');

                rows.forEach(row => {
                    const cols = row.querySelectorAll('td');
                    if (cols.length >= 5) {
                        const tür = cols[1].textContent.trim();
                        const fiyat = cols[5].textContent.trim();
                        const fiyat2 = cols[6].textContent.trim();
                        const birim = cols[7].textContent.trim();

                        if (fiyat) {
                            const isFiltered = filteredProducts.some(product => tür.includes(product));
                            console.log(`Kontrol edilen ürün: ${tür}, Fiyat: ${fiyat}, Filtrelenmiş mi? ${isFiltered}`);

                            if (tür && isFiltered) {
                                results.push({
                                    bölge: 'Mersin',
                                    tür,
                                    fiyat,
                                    sütun3: fiyat2,
                                    sütun4: birim
                                });
                            }
                        }
                    }
                });

                return results;
            }, FILTERED_PRODUCTS);

            console.log(`Mersin: ${prices.length} filtrelenmiş ürün bulundu.`);
            return prices;
        } else {
            console.error('Mersin: Tarih veya kategori seçim alanı bulunamadı. HTML yapısını kontrol edin.');
            return [];
        }
    } catch (error) {
        console.error('Mersin veri çekme hatası:', error);
        return [];
    } finally {
        if (browser) await browser.close();
    }
}

async function scrapeHalFiyatlari(region, url, rowSelector, minColumnCount, columns) {
    let browser;
    try {
        console.log(`${region} verileri çekiliyor...`);
        browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Sayfanın yüklenmesi için biraz bekleyelim
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            await page.waitForSelector(rowSelector, { timeout: 10000 });
        } catch (error) {
            console.log(`${region} için ${rowSelector} seçicisi bulunamadı.`);
            return [];
        }

        const prices = await page.evaluate((rowSelector, minColumnCount, columns, region, filteredProducts) => {
            const results = [];
            const rows = document.querySelectorAll(rowSelector);

            rows.forEach(row => {
                const cols = row.querySelectorAll('td');
                if (cols.length >= minColumnCount) {
                    const tür = cols[columns[0]] ? cols[columns[0]].textContent.trim() : '';
                    const fiyat = cols[columns[1]] ? cols[columns[1]].textContent.trim() : '';
                    const sütun3 = columns[2] !== undefined && cols[columns[2]] ? cols[columns[2]].textContent.trim() : '';
                    const sütun4 = columns[3] !== undefined && cols[columns[3]] ? cols[columns[3]].textContent.trim() : '';

                    // Fiyat bilgisi kontrolü
                    if (fiyat) {
                        // Ürün adını küçük harfe çevir ve filtreleme yap
                        const lowerTür = tür.toLowerCase();
                        const isFiltered = filteredProducts.some(product =>
                            lowerTür.includes(product) ||
                            (lowerTür.includes('çilek') && (sütun3.includes('1') || sütun3.includes('2'))) ||
                            (lowerTür.includes('muz') && (sütun3.includes('1') || sütun3.includes('2'))) ||
                            (lowerTür.includes('avokado') && (sütun3.includes('1') || sütun3.includes('2')))
                        );

                        if (tür && fiyat && isFiltered) {
                            results.push({
                                bölge: region,
                                tür,
                                fiyat,
                                sütun3,
                                sütun4
                            });
                        }
                    }
                }
            });
            return results;
        }, rowSelector, minColumnCount, columns, region, FILTERED_PRODUCTS);

        console.log(`${region}: ${prices.length} filtrelenmiş ürün bulundu.`);
        return prices;
    } catch (error) {
        console.error(`${region} veri çekme hatası:`, error);
        return [];
    } finally {
        if (browser) await browser.close();
    }
}

// Filtrelenmiş örnek veri fonksiyonu
function getFilteredExampleData(region) {
    if (region === 'İstanbul') {
        return [];
    } else if (region === 'Mersin') {
        return [];
    }
    return [];
}

// Örnek veri fonksiyonu (filtrelenmemiş)
function getExampleData(region) {
    return getFilteredExampleData(region); // Sadece filtrelenmiş verileri döndür
}

// API endpoint'i için bir fonksiyon
async function handleApiRequest(req, res) {
    try {
        const { bolge, startDate, endDate, tür } = req.query;
        
        // Scraper'ı çağır ve sonuçları döndür
        let results = await scrapeWithDates(bolge || '', startDate, endDate);
        
        // Ürün filtresi varsa uygula
        if (tür) {
            const lowerTür = tür.toLowerCase();
            results = results.filter(item => 
                item.tür.toLowerCase().includes(lowerTür) || 
                item.tür.toUpperCase().includes(tür.toUpperCase())
            );
        }
        
        res.json(results);
    } catch (error) {
        console.error('API hatası:', error);
        res.status(500).json({ error: 'Veriler çekilirken bir hata oluştu' });
    }
}

module.exports = { 
    gazipasa: scrapeGazipasa, 
    istanbul: scrapeIstanbul, 
    antalya: scrapeAntalya, 
    ankara: scrapeAnkara, 
    mersin: scrapeMersin,
    scrapeWithDates,
    handleApiRequest
};