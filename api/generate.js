export default async function handler(req, res) {
    // 1. Standart Ayarlar (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    try {
        // 2. Senin Tasarımından Gelen Verileri Alıyoruz
        // index.html bu verileri gönderiyor, biz de burada karşılıyoruz.
        const { category, categoryName, userRequest, targetAI, language, fileContent } = req.body;

        if (!GEMINI_KEY) throw new Error("API Anahtarı bulunamadı! Vercel ayarlarını kontrol et.");

        // 3. Prompt Mühendisliği (Ayarları Yapıyoruz)
        const langText = language === 'en' ? 'English' : 'Türkçe';
        const aiInstruction = targetAI ? `Bu prompt özellikle ${targetAI} yapay zekasında kullanılmak üzere optimize edilmeli.` : '';
        const fileInstruction = fileContent ? `\nEK DOSYA İÇERİĞİ: ${fileContent}\n(Bu dosya içeriğini referans alarak promptu oluştur)` : '';

        const systemPrompt = `
            SENİN GÖREVİN: Profesyonel bir Prompt Mühendisisin.
            
            KULLANICI İSTEĞİ: "${userRequest}"
            KATEGORİ: ${categoryName}
            ÇIKTI DİLİ: ${langText}
            ${fileInstruction}

            TALİMATLAR:
            1. Kullanıcının isteğini yerine getiren bir AI Prompt'u yaz. (Kullanıcıya cevap verme, ona prompt ver).
            2. ${aiInstruction}
            3. Prompt net, detaylı ve uygulanabilir olsun.
            4. SADECE oluşturduğun prompt metnini ver. Başka açıklama, giriş/gelişme cümlesi yazma.
            5. Çıktı formatı düz metin olsun.
        `;

        // 4. Google Gemini'ye Bağlan (En garantili model zinciri)
        // Önce 1.5 Flash'ı dener, bulamazsa Pro'yu dener.
        let model = 'gemini-1.5-flash';
        let response = await callGemini(model, GEMINI_KEY, systemPrompt);

        // Eğer ilk model hata verirse, yedeğe geç (Gemini Pro)
        if (!response.ok) {
            console.log("Flash modeli hata verdi, Pro deneniyor...");
            model = 'gemini-pro';
            response = await callGemini(model, GEMINI_KEY, systemPrompt);
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || "Yapay Zeka Servisi Hata Verdi");
        }

        // 5. Sonucu Tasarıma Gönder
        const resultText = data.candidates[0].content.parts[0].text;

        return res.status(200).json({ 
            prompt: resultText, // Senin tasarımın 'prompt' verisini bekliyor
            provider: 'gemini',
            model: model
        });

    } catch (error) {
        console.error("API Hatası:", error);
        return res.status(200).json({ 
            prompt: "⚠️ HATA OLUŞTU: " + error.message,
            error: error.message 
        });
    }
}

// Gemini çağırma fonksiyonu (Kod tekrarını önlemek için)
async function callGemini(model, key, text) {
    return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: text }] }]
        })
    });
}
