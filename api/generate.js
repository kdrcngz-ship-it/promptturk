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

        // 2. MODEL SEÇİMİ (En güvenli ve kotası bol olan model)
        // Gemini 1.5 Flash, bedava planda en yüksek limite sahip modeldir.
        const model = 'gemini-1.5-flash';

        // 3. İSTEK GÖNDERME (Hata olursa tekrar dener)
        let response = await sendToGoogle(model, GEMINI_KEY, systemPrompt);

        // Eğer kota hatası (429) alırsak, 4 saniye bekle ve tekrar dene
        if (response.status === 429) {
            console.log("Kota doldu, 4 saniye bekleniyor...");
            await new Promise(resolve => setTimeout(resolve, 4000));
            response = await sendToGoogle(model, GEMINI_KEY, systemPrompt);
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || "Google API Hatası");
        }

        const resultText = data.candidates[0].content.parts[0].text;
        
        return res.status(200).json({ prompt: resultText, provider: 'gemini' });

    } catch (error) {
        // Kullanıcıya hatayı düzgün göster
        return res.status(200).json({ 
            prompt: "⚠️ Google Kotası Doldu veya Hata Oluştu:\n" + error.message + "\n\n👉 Lütfen 10-15 saniye bekleyip tekrar dene.", 
            error: true 
        });
    }
}

// Yardımcı Fonksiyon: Google'a İstek Atar
async function sendToGoogle(model, key, text) {
    return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: text }] }] })
    });
}
