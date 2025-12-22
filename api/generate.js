export default async function handler(req, res) {
    // CORS ayarları
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { category, categoryName, userRequest, targetAI } = req.body;
    
    // HATA AYIKLAMA: Hangi anahtarların yüklü olduğunu (baş harflerini) loglar
    const gKey = process.env.GEMINI_API_KEY ? "Var (" + process.env.GEMINI_API_KEY.substring(0,5) + "...)" : "YOK";
    const oKey = process.env.OPENAI_API_KEY ? "Var" : "YOK";
    console.log(`Anahtar Durumu -> Gemini: ${gKey}, OpenAI: ${oKey}`);

    const systemPrompt = `Sen profesyonel bir prompt mühendisisin. ${targetAI} için ${categoryName} kategorisinde prompt hazırla.`;
    
    let geminiError = "Denenmedi";
    let openaiError = "Denenmedi";

    // 1. GEMINI DENEMESİ
    try {
        if (!process.env.GEMINI_API_KEY) throw new Error("Vercel'de GEMINI_API_KEY ayarlı değil!");

        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${systemPrompt}\n\nİstek: ${userRequest}` }] }]
                })
            }
        );

        const data = await geminiResponse.json();
        
        if (!geminiResponse.ok) {
            throw new Error(data.error?.message || JSON.stringify(data));
        }
        
        return res.status(200).json({ prompt: data.candidates[0].content.parts[0].text, provider: 'gemini' });

    } catch (e) {
        console.log('Gemini Hatası:', e.message);
        geminiError = e.message;
    }

    // 2. OPENAI DENEMESİ (Yedek)
    try {
        if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI anahtarı yok.");
        
        // ... OpenAI kodu buraya gelir ama şimdilik hatayı görmek için burayı kısa tutuyoruz ...
        throw new Error("OpenAI de pas geçildi.");
    } catch (e) {
        openaiError = e.message;
    }

    // KRİTİK NOKTA: Hatayı ekrana basıyoruz
    return res.status(500).json({ 
        error: `BAĞLANTI HATASI! Gemini: ${geminiError} || OpenAI: ${openaiError}` 
    });
}
