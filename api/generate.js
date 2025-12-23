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

        // 1. ADIM: OTO-PİLOT (Çalışan Modeli Bul)
        const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`);
        const listData = await listResponse.json();
        
        // Eğer liste alınamazsa yedek model kullan
        let modelId = 'gemini-1.5-flash';
        
        if (listResponse.ok && listData.models) {
            const availableModels = listData.models.filter(m => m.supportedGenerationMethods?.includes("generateContent"));
            // Sırayla en iyi modelleri ara
            const validModel = availableModels.find(m => m.name.includes('gemini-1.5-pro')) || 
                             availableModels.find(m => m.name.includes('gemini-pro')) || 
                             availableModels.find(m => m.name.includes('flash')) ||
                             availableModels[0];
            if (validModel) {
                modelId = validModel.name.replace('models/', '');
            }
        }

        // 2. ADIM: "SADECE PROMPT" AYARI (Sert Talimatlar)
        const langText = language === 'en' ? 'English' : 'Türkçe';
        const fileInfo = fileContent ? `\n[REFERANS İÇERİK]:\n${fileContent}` : '';

        const systemPrompt = `
            GÖREV: Sen bir "Prompt Oluşturma Motorusun".
            AMACIN: Kullanıcının isteğini ${targetAI} yapay zekasına yapıştırılmaya hazır bir komuta çevirmek.

            KULLANICI İSTEĞİ: "${userRequest}"
            KATEGORİ: ${categoryName}
            HEDEF DİL: ${langText}
            ${fileInfo}

            ❌ YASAKLAR:
            - "Şöyle bir prompt kullanabilirsiniz" deme.
            - "Bu prompt şunları içerir" deme.
            - Başlık veya açıklama yazma.
            - Tırnak içine alma.

            ✅ YAPMAN GEREKEN:
            - Sadece ve sadece yapay zekaya verilecek rolü ve görevi yaz.
            - Çıktı, kullanıcının CTRL+C yapıp alacağı ham metin olmalı.
        `;

        // 3. ADIM: İSTEĞİ GÖNDER
        let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
        });

        // Kota Engeli Aşma (429 Hatası)
        if (response.status === 429) {
            await new Promise(resolve => setTimeout(resolve, 4000));
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
            });
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || "Google API Hatası");
        }

        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        // Başarılı Sonuç
        return res.status(200).json({ 
            prompt: resultText, 
            provider: 'gemini' 
        });

    } catch (error) {
        // İŞTE DÜZELTME BURADA: Artık "true" değil, hatanın kendisini gönderiyoruz.
        return res.status(200).json({ 
            prompt: "⚠️ HATA: " + error.message, 
            error: error.message // "true" yerine mesajın kendisi
        });
    }
}
