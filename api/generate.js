export default async function handler(req, res) {
    // 1. Ayarlar
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    try {
        const { category, categoryName, userRequest, targetAI, language, fileContent } = req.body;
        
        if (!GEMINI_KEY) throw new Error("API Anahtarı eksik.");

        const langText = language === 'en' ? 'English' : 'Türkçe';
        const fileInfo = fileContent ? `\n\n[EK DOSYA]:\n${fileContent}` : '';

        const systemPrompt = `
            GÖREV: Profesyonel Prompt Yazarı.
            AMACIN: ${targetAI} yapay zekası için en iyi promptu yazmak.
            KATEGORİ: ${categoryName}
            İSTEK: "${userRequest}"
            DİL: ${langText}
            ${fileInfo}
            
            KURAL: Sadece prompt metnini ver. Sohbet etme.
        `;

        // LİSTE: Senin anahtarının açabileceği TÜM modeller.
        // Kod sırayla dener. Biri mutlaka çalışır.
        const models = [
            'gemini-1.5-pro-latest',  // En yenisi
            'gemini-1.5-pro',         // Stabil Pro
            'gemini-1.5-flash',       // Hızlı olan
            'gemini-pro',             // Eski ama tank gibi sağlam olan
        ];

        let resultText = null;
        let lastError = "";

        // Döngü: Sırayla kapıları zorluyoruz
        for (const model of models) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
                });

                const data = await response.json();

                if (response.ok && data.candidates && data.candidates.length > 0) {
                    resultText = data.candidates[0].content.parts[0].text;
                    break; // Başardık, döngüden çık!
                } else {
                    lastError = data.error?.message || "Bilinmeyen Hata";
                }
            } catch (err) {
                lastError = err.message;
            }
        }

        // Sonuç Kontrolü
        if (resultText) {
            return res.status(200).json({ prompt: resultText, provider: 'gemini' });
        } else {
            throw new Error("Hiçbir model çalışmadı. Google API hatası: " + lastError);
        }

    } catch (error) {
        // Hata olursa ekrana bas
        return res.status(200).json({ 
            prompt: "⚠️ SİSTEM HATASI: " + error.message,
            error: error.message 
        });
    }
}
