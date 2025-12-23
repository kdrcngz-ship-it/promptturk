export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    try {
        const { category, categoryName, userRequest, targetAI, language, fileContent } = req.body;
        
        if (!GEMINI_KEY) throw new Error("API Anahtarı eksik.");

        // 1. PROMPT AYARI (Sert ve Net)
        const langText = language === 'en' ? 'English' : 'Türkçe';
        const fileInfo = fileContent ? `\n[DOSYA]:\n${fileContent}` : '';

        const systemPrompt = `
            GÖREV: Sen bir Prompt Motorusun.
            AMAÇ: Kullanıcının isteğini ${targetAI} için en iyi komuta çevirmek.
            İSTEK: "${userRequest}"
            KATEGORİ: ${categoryName}
            DİL: ${langText}
            ${fileInfo}

            ❌ YASAKLAR:
            - Sohbet yok. "İşte prompt" demek yok. Açıklama yok.

            ✅ YAPILACAK:
            - Sadece ${targetAI} yapay zekasına yapıştırılacak net, detaylı prompt metnini ver.
        `;

        // 2. MODEL LİSTESİ (Senin isteğin EN BAŞTA)
        // Kod sırayla dener. İlk hedef: 2.5 Flash.
        const models = [
            'gemini-2.5-flash',       // SENİN İSTEDİĞİN (Varsa çalışır)
            'gemini-1.5-flash',       // Garantisi olan (2.5 yoksa buraya düşer)
            'gemini-1.5-flash-latest',
            'gemini-pro'
        ];

        let resultText = null;
        let activeModel = "";
        let lastError = "";

        // Döngü: Sırayla dener
        for (const model of models) {
            try {
                // Model ismini API'ye uygun hale getir (models/gemini... formatı gerekebilir)
                // Ama biz direkt ismi veriyoruz, API url'i hallediyor.
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
                });

                // Kota hatası (429) gelirse bekle tekrarla
                if (response.status === 429) {
                    await new Promise(r => setTimeout(r, 2000));
                    // Döngüdeki aynı model için tekrar denemek yerine, basitlik için pas geçip sonrakine de gidebilir
                    // Ama burada basitçe devam edelim.
                }

                const data = await response.json();

                if (response.ok && data.candidates?.length > 0) {
                    resultText = data.candidates[0].content.parts[0].text;
                    activeModel = model;
                    break; // Bulduk, çık!
                } else {
                    lastError = data.error?.message;
                }
            } catch (e) {
                lastError = e.message;
            }
        }

        if (resultText) {
            return res.status(200).json({ 
                prompt: resultText, 
                provider: 'gemini (' + activeModel + ')' 
            });
        } else {
            throw new Error(`Hiçbir model (2.5 dahil) çalışmadı. Son hata: ${lastError}`);
        }

    } catch (error) {
        return res.status(200).json({ 
            prompt: "⚠️ HATA: " + error.message, 
            error: error.message 
        });
    }
}
