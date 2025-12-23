export default async function handler(req, res) {
    // 1. Ayarlar (CORS ve İzinler)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    try {
        // Frontend'den gelen verileri al
        const { category, categoryName, userRequest, targetAI, language, fileContent } = req.body;

        if (!GEMINI_KEY) throw new Error("API Anahtarı (GEMINI_API_KEY) Vercel'de eksik!");

        // Prompt Hazırlığı
        const langText = language === 'en' ? 'English' : 'Türkçe';
        const fileInst = fileContent ? `\n\n[EK DOSYA İÇERİĞİ]:\n${fileContent}\n(Bu içeriği kullan)` : '';
        
        const systemPrompt = `GÖREV: Profesyonel Prompt Yazarı.
        HEDEF AI: ${targetAI || 'Genel'}
        KATEGORİ: ${categoryName || 'Genel'}
        ÇIKTI DİLİ: ${langText}
        KULLANICI İSTEĞİ: "${userRequest}"
        ${fileInst}
        
        KURALLAR:
        1. Asla kullanıcıyla sohbet etme.
        2. Doğrudan kopyalanabilir, profesyonel bir prompt metni yaz.
        3. ${targetAI} için en iyi teknikleri kullan.`;

        // 2. DENENECEK MODELLER LİSTESİ (Sırayla dener)
        // Biri hata verirse diğerine geçer.
        const modelsToTry = [
            'gemini-1.5-flash',       // En hızlı, en yeni
            'gemini-1.5-pro',         // En zeki
            'gemini-1.5-flash-8b',    // Alternatif hızlı
            'gemini-2.0-flash'              // Eski ama sağlam (Legacy)
        ];

        let lastError = null;
        let successData = null;
        let usedModel = '';

        // 3. DÖNGÜ: Modelleri tek tek dener
        for (const model of modelsToTry) {
            try {
                console.log(`Deneniyor: ${model}`);
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: systemPrompt }] }]
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error?.message || "Model hatası");
                }

                // Başarılı olursa döngüyü kır
                successData = data;
                usedModel = model;
                break; 

            } catch (err) {
                console.error(`${model} başarısız:`, err.message);
                lastError = err.message;
                // Bir sonraki modele geç...
            }
        }

        // 4. SONUÇ KONTROLÜ
        if (successData) {
            const resultText = successData.candidates[0].content.parts[0].text;
            return res.status(200).json({ 
                prompt: resultText,     // Frontend bunu bekliyor
                provider: 'gemini',
                model: usedModel 
            });
        } else {
            // Hiçbiri çalışmadıysa hatayı bas
            throw new Error(`Tüm modeller denendi, başarısız oldu. Son hata: ${lastError}`);
        }

    } catch (error) {
        // Hata mesajını frontend'e düzgün gönder ki ekranda gör
        return res.status(200).json({ 
            prompt: "⚠️ SİSTEM HATASI: " + error.message,
            provider: 'error'
        });
    }
}
