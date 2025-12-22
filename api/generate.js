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

        if (!GEMINI_KEY) {
            throw new Error("Vercel ayarlarında GEMINI_API_KEY eksik!");
        }

        // 2. EN SON MODEL: Gemini 3 Flash (17 Aralık 2025 Çıkışlı)
        // Eski 1.5 ve Pro modelleri kapandığı için sadece bu çalışır.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ 
                        text: `Sen 2025 yılının en gelişmiş prompt mühendisisin. Kullanıcı ${targetAI} kullanacak. Ona ${categoryName} kategorisinde mükemmel bir prompt yaz.
                        
                        Kullanıcı İsteği: ${userRequest}
                        
                        Sadece promptu yaz, açıklama yapma.` 
                    }]
                }]
            })
        });

        const data = await response.json();

        // Hata yakalama
        if (!response.ok) {
            throw new Error(data.error?.message || "Gemini 3 Hatası");
        }

        // 3. Sonucu siteye gönder
        const resultText = data.candidates[0].content.parts[0].text;
        
        return res.status(200).json({ 
            prompt: resultText, 
            result: resultText, 
            provider: 'gemini-3-flash' 
        });

    } catch (error) {
        return res.status(200).json({ 
            prompt: "⚠️ HATA: " + error.message,
            result: "⚠️ HATA: " + error.message,
            provider: 'error'
        });
    }
}
