export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { category, categoryName, userRequest, targetAI, language, fileContent } = req.body;

    if (!category || !userRequest || !targetAI) {
        return res.status(400).json({ error: 'Eksik parametreler' });
    }

    const lang = language || 'tr';
    const langInstruction = lang === 'en' 
        ? 'Write the prompt in English.'
        : 'Promptu Türkçe yaz.';

    const fileContext = fileContent 
        ? `\n\nKullanıcının yüklediği dosya içeriği/açıklaması:\n${fileContent}\n`
        : '';

    const systemPrompt = `Sen dünya çapında tanınmış, 10+ yıl deneyimli bir prompt mühendisisin. Fortune 500 şirketlerine danışmanlık yapıyorsun. Kullanıcının isteğine göre ${targetAI} için MÜKEMMEL, PROFESYONEL ve SON DERECE ETKİLİ promptlar oluşturuyorsun.

## GÖREV
Kullanıcının "${categoryName}" kategorisindeki isteği için ${targetAI}'a özel optimize edilmiş bir prompt oluştur.

## PROMPT OLUŞTURMA KURALLARI

### 1. YAPI (Bu sırayla oluştur)
- **🎭 ROL TANIMI**: AI'ın üstleneceği uzman persona (detaylı, inandırıcı)
- **🎯 GÖREV**: Net, spesifik, ölçülebilir hedef
- **📋 BAĞLAM**: Kullanıcının durumu, hedef kitle, amaç
- **📝 ADIM ADIM TALİMATLAR**: Numaralandırılmış, açık direktifler
- **⚠️ KISITLAMALAR**: Yapılmaması gerekenler, dikkat edilecekler
- **📤 ÇIKTI FORMATI**: Beklenen format, uzunluk, stil
- **💡 ÖRNEK** (gerekirse): Beklenen çıktının mini örneği

### 2. KALİTE STANDARTLARI
- Belirsiz ifadeler YASAK ("iyi", "güzel", "uygun" gibi)
- Her talimat SPESİFİK ve ÖLÇÜLÜR olmalı
- Hedef kitleye UYGUN ton ve dil
- ${targetAI}'ın güçlü yönlerini KULLAN
- Gereksiz uzunluk YASAK, öz ve etkili ol

### 3. ${targetAI.toUpperCase()} OPTİMİZASYONU
${targetAI === 'claude' ? `- Yapılandırılmış, detaylı talimatlar ver
- XML tag'leri kullanabilirsin
- Düşünce zinciri (chain of thought) iste
- Belirsizliklerde soru sormasını söyle` : ''}
${targetAI === 'chatgpt' ? `- Doğal, akıcı dil kullan
- Markdown formatlamayı öner
- Yaratıcı ve esnek yaklaşım
- Örneklerle zenginleştir` : ''}
${targetAI === 'gemini' ? `- Çok yönlü analiz iste
- Görsel düşünmeyi dahil et
- Karşılaştırmalı yaklaşım öner
- Farklı perspektifler sun` : ''}

### 4. DİL
${langInstruction}

## ÖNEMLİ
- SADECE promptu döndür
- Açıklama, giriş, sonuç YAZMA
- "İşte prompt" gibi ifadeler KULLANMA
- Direkt prompt ile başla
${fileContext}

Şimdi bu kullanıcı isteği için MÜKEMMEL bir prompt oluştur:`;

    // Try Gemini first
    try {
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `${systemPrompt}\n\nKullanıcı İsteği: ${userRequest}`
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 4096
                    }
                })
            }
        );

        if (geminiResponse.ok) {
            const data = await geminiResponse.json();
            const prompt = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (prompt) {
                return res.status(200).json({ prompt, provider: 'gemini' });
            }
        }
    } catch (e) {
        console.log('Gemini failed:', e.message);
    }

    // Try DeepSeek second
    try {
        const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userRequest }
                ],
                temperature: 0.8,
                max_tokens: 4096
            })
        });

        if (deepseekResponse.ok) {
            const data = await deepseekResponse.json();
            const prompt = data.choices?.[0]?.message?.content;
            if (prompt) {
                return res.status(200).json({ prompt, provider: 'deepseek' });
            }
        }
    } catch (e) {
        console.log('DeepSeek failed:', e.message);
    }

    // Fallback to OpenAI
    try {
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userRequest }
                ],
                temperature: 0.8,
                max_tokens: 4096
            })
        });

        if (openaiResponse.ok) {
            const data = await openaiResponse.json();
            const prompt = data.choices?.[0]?.message?.content;
            if (prompt) {
                return res.status(200).json({ prompt, provider: 'openai' });
            }
        }
    } catch (e) {
        console.log('OpenAI failed:', e.message);
    }

    return res.status(500).json({ error: 'Tüm AI servisleri şu an meşgul. Lütfen biraz sonra tekrar deneyin.' });
}
