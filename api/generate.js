export default async function handler(req, res) {
    // 1. Ayarlar
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    try {
        const { category, categoryName, userRequest, targetAI } = req.body;
        
        if (!GEMINI_KEY) throw new Error("API Anahtarı Vercel'de yok!");

        // 2. ÖNCE EN GÜNCEL VE SAĞLAM MODELİ DENİYORUZ: gemini-2.5-flash
        const modelName = 'gemini-2.5-flash'; 
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ 
                        text: `Sen profesyonel bir prompt uzmanısın. Kullanıcı ${targetAI} için ${categoryName} kategorisinde prompt istiyor.
                        İstek: ${userRequest}
                        Sadece promptu yaz.` 
                    }]
                }]
            })
        });

        const data = await response.json();

        // Eğer hata verirse (404 Not Found vb.), hatayı fırlat ki aşağıda listeyi çekelim
        if (!response.ok) {
            throw new Error(data.error?.message || "Model Hatası");
        }

        const resultText = data.candidates[0].content.parts[0].text;
        return res.status(200).json({ prompt: resultText, result: resultText, provider: modelName });

    } catch (error) {
        // 3. EĞER MODEL BULUNAMAZSA: SENİN ANAHTARININ GÖRDÜĞÜ MODELLERİ ÇEKİP SANA SÖYLÜYORUM
        console.error("Hata oldu, model listesi çekiliyor...", error);
        
        try {
            const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`);
            const listData = await listResponse.json();
            
            // Kullanılabilir modelleri bul ve listele
            const availableModels = listData.models
                ? listData.models.map(m => m.name.replace('models/', '')).join(', ')
                : "Liste çekilemedi";

            return res.status(200).json({ 
                prompt: `⚠️ HATA: '${error.message}'.\n\n🛠️ ÇÖZÜM: Senin anahtarın şu modelleri görüyor (Bunu bana at): \n👉 [ ${availableModels} ]`,
                result: `⚠️ SİSTEM MESAJI: Model uyuşmazlığı var. Listeyi bana atarsan çözerim.`,
                provider: 'error-diagnostic'
            });

        } catch (listError) {
            return res.status(200).json({ 
                prompt: "⚠️ KRİTİK HATA: " + error.message, 
                result: "⚠️ KRİTİK HATA",
                provider: 'error' 
            });
        }
    }
}
