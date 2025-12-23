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

        // 2. KESİN PROMPT AYARI (Sohbet etme, direkt ver)
        const langText = language === 'en' ? 'English' : 'Türkçe';
        const fileInfo = fileContent ? `\n[REFERANS İÇERİK]:\n${fileContent}` : '';

        const systemPrompt = `
            GÖREV: Sen bir "Prompt Oluşturma Motorusun".
            AMACIN: Kullanıcının isteğini ${targetAI} yapay zekasına yapıştırılmaya hazır bir komuta çevirmek.

            KULLANICI İSTEĞİ: "${userRequest}"
            KATEGORİ: ${categoryName}
            HEDEF DİL: ${langText}
            ${fileInfo}

            ❌ YASAKLAR:
            - Sohbet etme.
            - "İşte promptunuz" deme.
            - Açıklama yapma.

            ✅ YAPMAN GEREKEN:
            - Sadece ve sadece yapay zekaya (ChatGPT/Gemini/Midjourney) verilecek emri yaz.
            - Çıktı ham metin olmalı.
        `;

        // 3. MODEL SEÇİMİ (MACERA YOK, GARANTİ MODEL)
        // gemini-2.5 veya pro seçmiyoruz. Bedava planın kralı bu:
        const modelId = 'gemini-1.5-flash'; 

        // 4. İSTEĞİ GÖNDER
        let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
        });

        // Kota Engeli Aşma (429 Hatası gelirse 4 saniye bekle tekrar dene)
        if (response.status === 429) {
            await new Promise(resolve => setTimeout(resolve, 4000));
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
            });
        }

        const data = await response.json();

        if (!response.ok) {
            // Hata detayını göster (true değil, mesajı bas)
            throw new Error(data.error?.message || "Google API Hatası");
        }

        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        // Başarılı Sonuç
        return res.status(200).json({ 
            prompt: resultText, 
            provider: 'gemini-1.5-flash' 
        });

    } catch (error) {
        // HATA YÖNETİMİ
        return res.status(200).json({ 
            prompt: "⚠️ HATA: " + error.message, 
            error: error.message 
        });
    }
}
