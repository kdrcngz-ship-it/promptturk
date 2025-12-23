export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    try {
        const { category, categoryName, userRequest, targetAI, language, fileContent } = req.body;
        
        if (!GEMINI_KEY) throw new Error("API Anahtarı eksik.");

        // 1. ADIM: ÇALIŞAN MODELİ BUL (Auto-Pilot - Dokunmuyoruz, bu iyi çalışıyor)
        const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`);
        const listData = await listResponse.json();
        if (!listResponse.ok) throw new Error("Model listesi alınamadı.");

        const availableModels = listData.models.filter(m => m.supportedGenerationMethods?.includes("generateContent"));
        let validModel = availableModels.find(m => m.name.includes('gemini-1.5-pro')) || 
                         availableModels.find(m => m.name.includes('gemini-pro')) || 
                         availableModels.find(m => m.name.includes('flash')) ||
                         availableModels[0];

        if (!validModel) throw new Error("Model bulunamadı.");
        const modelId = validModel.name.replace('models/', '');


        // 2. ADIM: PROMPT MÜHENDİSLİĞİ (BURAYI DEĞİŞTİRDİK - SERT AYAR)
        const langText = language === 'en' ? 'English' : 'Türkçe';
        const fileInfo = fileContent ? `\n[REFERANS İÇERİK]:\n${fileContent}` : '';

        const systemPrompt = `
            SEN BİR "PROMPT ÜRETİCİSİSİN". 
            GÖREVİN: Kullanıcının isteğini, ${targetAI} yapay zekasına "YAPIŞTIRILMAYA HAZIR" bir komuta dönüştürmek.

            KULLANICI İSTEĞİ: "${userRequest}"
            HEDEF DİL: ${langText}
            KATEGORİ: ${categoryName}
            ${fileInfo}

            ❌ YASAKLAR (BUNLARI ASLA YAPMA):
            - "Bunu yapmak için şöyle bir prompt kullanabilirsin" deme.
            - "Prompt şu maddeleri içermelidir" diye ders anlatma.
            - Tırnak işareti içine alma.
            - Başlık atma ("İşte promptunuz:" vb. deme).

            ✅ YAPMAN GEREKEN (KESİN UYGULA):
            - Doğrudan yapay zekaya (ChatGPT/Gemini/Claude) verilecek rolü ve görevi yaz.
            - Çıktın, kullanıcının kopyalayıp direkt yapıştıracağı metin olmalı.

            ÖRNEK SENARYO:
            Kullanıcı: "Osmanlı tarihi tezi"
            Senin Çıktın: "Sen uzman bir tarih profesörüsün. Osmanlı İmparatorluğu'nun yükseliş ve çöküş dönemlerini ele alan, akademik dilde yazılmış, 5000 kelimelik, kaynakçalı detaylı bir tez taslağı hazırla. Şu başlıkları mutlaka içersin: ..."
            
            ŞİMDİ YAZ:
        `;

        // 3. ADIM: İSTEĞİ GÖNDER
        let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
        });

        // Kota Engeli Aşma (429)
        if (response.status === 429) {
            await new Promise(resolve => setTimeout(resolve, 4000));
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
            });
        }

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Hata oluştu");

        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        return res.status(200).json({ prompt: resultText, provider: 'gemini' });

    } catch (error) {
        return res.status(200).json({ prompt: "HATA: " + error.message, error: true });
    }
}
