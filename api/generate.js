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

    const { category, categoryName, userRequest, targetAI } = req.body;

    if (!category || !userRequest || !targetAI) {
        return res.status(400).json({ error: 'Eksik parametreler' });
    }

    const systemPrompt = `Sen profesyonel bir prompt mühendisisin. Kullanıcının isteğine göre ${targetAI} için optimize edilmiş, etkili ve detaylı promptlar oluşturuyorsun.

Prompt oluştururken şu kurallara uy:
1. Prompt Türkçe olmalı
2. Hedef AI'ın (${targetAI}) özelliklerine uygun olmalı
3. Net, anlaşılır ve uygulanabilir olmalı
4. Rol tanımı, bağlam, talimatlar ve çıktı formatı içermeli
5. Kategori: ${categoryName}

Sadece promptu döndür, ekstra açıklama yapma.`;

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
                        temperature: 0.7,
                        maxOutputTokens: 2048
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
                temperature: 0.7,
                max_tokens: 2048
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
