export default async function handler(req, res) {
    // 1. İzinler ve Ayarlar
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { category, categoryName, userRequest, targetAI } = req.body;
        const GEMINI_KEY = process.env.GEMINI_API_KEY;

        if (!GEMINI_KEY) {
            throw new Error("Vercel ayarlarında API Anahtarı bulunamadı.");
        }

        // 2. DÜZELTİLEN KISIM: 'gemini-1.5-flash' yerine garanti çalışan 'gemini-pro' kullanıyoruz.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ 
                        text: `Sen uzman bir prompt mühendisisin. Kullanıcının isteğine göre ${targetAI} yapay zekası için ${categoryName} kategorisinde profesyonel bir prompt hazırla.
                        
                        Kullanıcı İsteği: ${userRequest}
                        
                        Sadece oluşturduğun promptu yaz, başka açıklama yapma.` 
                    }]
                }]
            })
        });

        const data = await response.json();

        // Google hata verirse yakala
        if (!response.ok) {
            throw new Error(data.error?.message || "Google API hatası");
        }

        // 3. Sonucu siteye gönder
        const resultText = data.candidates[0].content.parts[0].text;
        
        return res.status(200).json({ 
            prompt: resultText, // Senin tasarımın bunu bekliyor
            result: resultText, 
            provider: 'gemini' 
        });

    } catch (error) {
        console.error("Hata:", error);
        return res.status(500).json({ error: "Sistem Hatası: " + error.message });
    }
}
