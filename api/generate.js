export default async function handler(req, res) {
    // 1. Ayarlar ve İzinler (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { category, categoryName, userRequest, targetAI } = req.body;
        
        // OpenAI Anahtarını Çekiyoruz
        const OPENAI_KEY = process.env.OPENAI_API_KEY;

        if (!OPENAI_KEY) {
            throw new Error("Vercel ayarlarında OPENAI_API_KEY eksik!");
        }

        // 2. EN SON MODEL: GPT-5.2'ye Bağlanıyoruz (Aralık 2025 Sürümü)
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-5.2', // <-- İŞTE EN SON MODEL BURASI
                messages: [
                    { 
                        role: "system", 
                        content: `Sen dünyanın en iyi prompt mühendisisin. Kullanıcı ${targetAI} kullanacak. Ona ${categoryName} kategorisinde, işini tek seferde görecek mükemmel bir prompt yaz.` 
                    },
                    { 
                        role: "user", 
                        content: `Kullanıcı İsteği: ${userRequest}\n\nSadece promptu yaz, başka hiçbir şey yazma.` 
                    }
                ],
                temperature: 0.7
            })
        });

        const data = await response.json();

        // Hata yakalama
        if (data.error) {
            // Eğer hesabın henüz 5.2'ye erişemiyorsa (nadir durum), yedeğe düşürelim
            throw new Error("OpenAI Hatası: " + data.error.message);
        }

        // 3. Sonucu siteye gönder
        const resultText = data.choices[0].message.content;

        return res.status(200).json({ 
            prompt: resultText, 
            result: resultText, 
            provider: 'openai-gpt-5.2' 
        });

    } catch (error) {
        return res.status(200).json({ 
            prompt: "⚠️ HATA: " + error.message,
            result: "⚠️ HATA: " + error.message,
            provider: 'error'
        });
    }
}
