export default async function handler(req, res) {
    // 1. Ayarlar
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { category, categoryName, userRequest, targetAI } = req.body;
        const GEMINI_KEY = process.env.GEMINI_API_KEY;

        // 2. Anahtar Kontrolü (Hata varsa direkt ekrana basacak)
        if (!GEMINI_KEY) {
            throw new Error("Vercel'de 'GEMINI_API_KEY' bulunamadı! Ayarlara eklememişsin.");
        }

        // 3. Google'a Bağlan
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `Sen bir prompt uzmanısın. ${categoryName} için ${targetAI} promptu yaz. İstek: ${userRequest}` }]
                }]
            })
        });

        const data = await response.json();

        // 4. Google Hata Verdiyse Yakala
        if (!response.ok) {
            throw new Error("Google Hatası: " + (data.error?.message || "Bilinmeyen hata"));
        }

        // 5. Başarılı Sonuç
        const resultText = data.candidates[0].content.parts[0].text;
        
        // Hem senin eski koduna hem yeni tasarıma uyumlu cevap
        return res.status(200).json({ 
            prompt: resultText, 
            result: resultText,
            provider: 'gemini' 
        });

    } catch (error) {
        // HATA OLUŞURSA LOGLARA DEĞİL, DİREKT SİTEYE GÖNDER
        return res.status(200).json({ 
            prompt: "⚠️ HATA OLUŞTU (Bunu bana at): " + error.message,
            result: "⚠️ HATA OLUŞTU (Bunu bana at): " + error.message,
            provider: 'error'
        });
    }
}
