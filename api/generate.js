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

        // Prompt Hazırlığı
        const langText = language === 'en' ? 'English' : 'Türkçe';
        const fileInfo = fileContent ? `\n\n[EK DOSYA İÇERİĞİ]:\n${fileContent}` : '';

        const systemPrompt = `
            ROL: Profesyonel Prompt Yazarı.
            GÖREV: Kullanıcı isteğini ${targetAI} yapay zekasına uygun bir PROMPT'a çevir.
            
            KULLANICI NE İSTİYOR: "${userRequest}"
            KATEGORİ: ${categoryName}
            HEDEF DİL: ${langText}
            ${fileInfo}

            KURALLAR:
            1. Asla sohbet etme, cevap verme. Sadece PROMPT metnini yaz.
            2. ${targetAI} için en iyi teknikleri kullan.
            3. Çıktı sadece prompt olsun.
        `;

        // 2. MODEL SEÇİMİ (Garanti Model)
        const model = 'gemini-1.5-flash';

        // 3. İSTEK GÖNDERME
        let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
        });

        // KOTA DOLDUYSA (429) - 4 Saniye Bekle Tekrar Dene
        if (response.status === 429) {
            await new Promise(resolve => setTimeout(resolve, 4000));
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
            });
        }

        const data = await response.json();

        if (!response.ok) {
            // Hata mesajını string olarak hazırla
            const errorMsg = data.error?.message || "Bilinmeyen Google Hatası";
            throw new Error(errorMsg);
        }

        const resultText = data.candidates[0].content.parts[0].text;
        
        // BAŞARILI SONUÇ
        return res.status(200).json({ 
            prompt: resultText, // Ekrana bu basılacak
            provider: 'gemini' 
        });

    } catch (error) {
        // HATA YAKALAMA (Artık 'true' yok, mesaj var)
        const errorMessage = "⚠️ HATA OLUŞTU: " + error.message;
        
        return res.status(200).json({ 
            prompt: errorMessage, // Ön yüz 'prompt' ararsa bunu görecek
            error: errorMessage   // Ön yüz 'error' ararsa bunu görecek (Boolean değil, yazı!)
        });
    }
}
