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

        // 1. ADIM: ÇALIŞAN MODELİ BUL (Auto-Pilot)
        // Burası harika çalışıyor, dokunmuyoruz.
        const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`);
        const listData = await listResponse.json();

        if (!listResponse.ok) throw new Error("Model listesi alınamadı.");

        // Modelleri filtrele (flash veya pro)
        const availableModels = listData.models.filter(m => m.supportedGenerationMethods?.includes("generateContent"));
        let validModel = availableModels.find(m => m.name.includes('flash')) || 
                         availableModels.find(m => m.name.includes('pro')) || 
                         availableModels[0];

        if (!validModel) throw new Error("Hiçbir model bulunamadı.");
        const modelId = validModel.name.replace('models/', '');

        // 2. ADIM: PROMPT MÜHENDİSLİĞİ (BURAYI GÜÇLENDİRDİK)
        // Artık "Ben çizemem" diyemeyecek.
        const langText = language === 'en' ? 'English' : 'Türkçe';
        const fileInfo = fileContent ? `\n\n[İÇERİK KAYNAĞI OLARAK BU DOSYAYI KULLAN]:\n${fileContent}` : '';

        const systemPrompt = `
            ROL: Sen bir "Prompt Oluşturma Motorusun". ASLA bir sohbet botu veya asistan gibi davranma.
            GÖREV: Kullanıcının isteğini, ${targetAI} yapay zekasına girilecek PROFESYONEL VE DETAYLI BİR PROMPT (KOMUT) haline getir.

            KULLANICI: "${userRequest}"
            
            KURALLAR (KESİN UY):
            1. Kullanıcı "Beni çiz" derse, ona resim çizemeyeceğini söyleme. Bunun yerine, bir yapay zekanın (Midjourney/DALL-E) bir insanı çizmesini sağlayacak detaylı bir "Görsel Tasvir Promptu" yaz.
            2. Kullanıcı "Kod yaz" derse, kodu yazma. Kodu yazdıracak promptu hazırla.
            3. Çıktın SADECE oluşturduğun prompt metni olsun. Başka hiçbir giriş/gelişme cümlesi ("İşte promptunuz", "Harika fikir" vb.) YAZMA.
            4. Hedef Dil: ${langText}
            5. Kategori: ${categoryName}
            ${fileInfo}
        `;

        // 3. ADIM: İSTEĞİ GÖNDER
        let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
        });

        // Kota kontrolü (429 Hatası)
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

        return res.status(200).json({ 
            prompt: resultText, 
            provider: 'gemini (' + modelId + ')' 
        });

    } catch (error) {
        return res.status(200).json({ prompt: "⚠️ HATA: " + error.message, error: error.message });
    }
}
