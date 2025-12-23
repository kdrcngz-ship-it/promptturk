export default async function handler(req, res) {
    // 1. Standart Ayarlar
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    try {
        const { category, categoryName, userRequest, targetAI, language, fileContent } = req.body;
        
        if (!GEMINI_KEY) throw new Error("API Anahtarı eksik.");

        // 2. PROMPT MÜHENDİSLİĞİ (Senin istediğin 'Net ve Detaylı' ayarı)
        const langText = language === 'en' ? 'English' : 'Türkçe';
        const fileInfo = fileContent ? `\n[REFERANS DOSYA İÇERİĞİ]:\n${fileContent}\n(Bu içeriği analiz et ve prompta dahil et)` : '';

        const systemPrompt = `
            GÖREV: Sen dünyanın en iyi "Prompt Mühendisisin".
            AMACIN: Kullanıcının isteğini, ${targetAI} yapay zekasından EN İYİ sonucu alacak, DETAYLI, ZENGİN ve PROFESYONEL bir komuta (prompt) dönüştürmek.

            KULLANICI İSTEĞİ: "${userRequest}"
            KATEGORİ: ${categoryName}
            HEDEF DİL: ${langText}
            ${fileInfo}

            KURALLAR (KESİN UY):
            1. ASLA sohbet etme ("Tabii hazırlarım", "İşte promptunuz" vb. DEME).
            2. Çıktın SADECE ve SADECE kopyalanacak prompt metni olsun.
            3. Prompt "kısa ve öz" DEĞİL, "detaylı ve açıklayıcı" olsun. 
               - Görselse: Işık, atmosfer, stil, lens, çözünürlük detaylarını ekle.
               - Metinse: Ton, hedef kitle, format, yapı detaylarını ekle.
            4. Sonuç doğrudan kullanılabilir ham metin olmalı.
        `;

        // 3. MODEL SEÇİMİ (ZİNCİRLEME SİSTEM)
        // Senin istediğin "Flash" modelini dener. Olmazsa Pro'ya geçer. Yolda bırakmaz.
        const modelsToTry = [
            'gemini-1.5-flash',       // Öncelik: En hızlı ve yeni olan
            'gemini-1.5-flash-latest',// Alternatif isimlendirme
            'gemini-pro',             // Yedek: Eski ama %100 çalışan tank
        ];

        let resultText = null;
        let lastError = "";

        // Döngü: Sırayla modelleri dener
        for (const model of modelsToTry) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
                });

                // Kota hatası (429) varsa 2 saniye bekle tekrar dene
                if (response.status === 429) {
                    await new Promise(r => setTimeout(r, 2000));
                    // Aynı isteği tekrarla
                    continue; 
                }

                const data = await response.json();

                if (response.ok && data.candidates && data.candidates.length > 0) {
                    resultText = data.candidates[0].content.parts[0].text;
                    break; // Başarılı! Döngüden çık.
                } else {
                    lastError = data.error?.message || "Bilinmeyen Hata";
                    console.log(`${model} olmadı, sıradakine geçiliyor...`);
                }
            } catch (err) {
                lastError = err.message;
            }
        }

        // 4. SONUÇ
        if (resultText) {
            return res.status(200).json({ 
                prompt: resultText, 
                provider: 'gemini-intelligent' 
            });
        } else {
            // Hiçbiri çalışmadıysa
            throw new Error(`Google API Hatası: ${lastError}`);
        }

    } catch (error) {
        // Hata mesajını frontend'e gönder
        return res.status(200).json({ 
            prompt: "⚠️ HATA: " + error.message, 
            error: error.message 
        });
    }
}
