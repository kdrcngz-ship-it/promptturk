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

        // 1. ADIM: GOOGLE'A SOR - "ELİNDE HANGİ MODELLER VAR?"
        // Ezbere isim yazmıyoruz, listeden çekiyoruz.
        const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`);
        const listData = await listResponse.json();

        if (!listResponse.ok) {
            throw new Error("Model listesi alınamadı: " + (listData.error?.message || "Bilinmeyen hata"));
        }

        // 2. ADIM: ÇALIŞAN MODELİ SEÇ
        // Listeden "generateContent" özelliğine sahip modelleri bul.
        // Öncelik: Flash > Pro > Diğerleri
        let validModel = null;
        
        const preferredOrder = ['flash', 'pro', 'gemini-1.5', 'gemini-1.0'];
        
        // Tüm modelleri tara
        const availableModels = listData.models.filter(m => 
            m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")
        );

        // Tercih sırasına göre en iyisini seç
        for (const pref of preferredOrder) {
            validModel = availableModels.find(m => m.name.toLowerCase().includes(pref));
            if (validModel) break;
        }

        // Eğer tercih edilen yoksa, listedeki ilk çalışanı al
        if (!validModel && availableModels.length > 0) {
            validModel = availableModels[0];
        }

        if (!validModel) {
            throw new Error("Hesabına tanımlı, metin üretebilen hiçbir model bulunamadı.");
        }

        console.log("Seçilen Model:", validModel.name); // Loglarda görebilirsin

        // 3. ADIM: SEÇİLEN MODELLE PROMPT ÜRET
        const langText = language === 'en' ? 'English' : 'Türkçe';
        const fileInfo = fileContent ? `\n\n[EK DOSYA]:\n${fileContent}` : '';

        const systemPrompt = `
            GÖREV: Profesyonel Prompt Yazarı.
            KATEGORİ: ${categoryName}
            İSTEK: "${userRequest}"
            HEDEF AI: ${targetAI}
            DİL: ${langText}
            ${fileInfo}
            KURAL: Sadece prompt metnini ver. Sohbet etme.
        `;

        // Bulduğumuz "validModel.name" (örn: models/gemini-1.5-flash-001) direkt kullanılır.
        // Başındaki 'models/' kısmını API bazen istemez, bazen ister. URL yapısına göre ayarlıyoruz.
        // v1beta url'si: .../models/gemini-pro:generateContent şeklindedir.
        // validModel.name zaten "models/..." diye gelir.
        
        // Model adını temizle (models/ kısmını at, çünkü URL'e kendimiz ekleyebiliriz veya olduğu gibi kullanırız)
        // Google API URL yapısı: models/{model_id}:generateContent
        const modelId = validModel.name.replace('models/', '');

        let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
        });

        // Kota hatası (429) gelirse 4 saniye bekle tekrar dene
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
            throw new Error(data.error?.message || "Üretim Hatası");
        }

        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!resultText) throw new Error("Model boş cevap döndürdü.");

        return res.status(200).json({ 
            prompt: resultText, 
            provider: 'gemini (' + modelId + ')' 
        });

    } catch (error) {
        return res.status(200).json({ 
            prompt: "⚠️ HATA: " + error.message,
            error: error.message 
        });
    }
}
