export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    
    try {
        const { category, categoryName, userRequest, targetAI, language, fileContent } = req.body;
        
        if (!GEMINI_KEY) throw new Error("API Anahtarı eksik!");
        
        const lang = language || 'tr';
        const langText = lang === 'en' ? 'Write the prompt in English.' : 'Promptu Türkçe yaz.';
        
        const fileContext = fileContent ? `\n\nKullanıcının eklediği dosya/içerik bilgisi: ${fileContent}` : '';
        
        const engineeringPrompt = `
GÖREVİN: Sen dünya çapında ünlü, 10+ yıl deneyimli bir PROMPT MÜHENDİSİSİN.

KULLANICI NE İSTİYOR: "${userRequest}"
HEDEF AI: ${targetAI}
KATEGORİ: ${categoryName}
${fileContext}

PROMPT OLUŞTURMA KURALLARI (KESİNLİKLE UY):

1. ASLA kullanıcının isteğini direkt yerine getirme! 
   - Örnek: "Şiir yaz" derse şiir yazma, şiir yazdıracak PROMPT'u yaz.
   - Örnek: "E-posta yaz" derse e-posta yazma, e-posta yazdıracak PROMPT'u yaz.

2. Çıktın SADECE ve SADECE prompt metni olmalı.
   - Sohbet etme
   - "Merhaba" deme
   - "İşte promptun" deme
   - "Tabii" deme
   - Açıklama yapma
   - Direkt prompt ile başla

3. PROMPT YAPISI (Bu formatta yaz):
   
   🎭 ROL: Sen [detaylı uzman rolü]...
   
   🎯 GÖREV: [Spesifik, ölçülebilir görev tanımı]
   
   📋 BAĞLAM: [Durum, hedef kitle, amaç]
   
   📝 TALİMATLAR:
   1. [Birinci adım]
   2. [İkinci adım]
   3. [Üçüncü adım]
   ...
   
   ⚠️ KISITLAMALAR:
   - [Yapılmaması gereken 1]
   - [Yapılmaması gereken 2]
   
   📤 ÇIKTI FORMATI: [Beklenen format, uzunluk, stil]

4. ${langText}

5. ${targetAI.toUpperCase()} İÇİN OPTİMİZE ET:
${targetAI === 'claude' ? '   - Yapılandırılmış, detaylı talimatlar\n   - Belirsizliklerde soru sormasını söyle' : ''}
${targetAI === 'chatgpt' ? '   - Doğal, akıcı dil\n   - Markdown formatı öner' : ''}
${targetAI === 'gemini' ? '   - Çok yönlü analiz\n   - Farklı perspektifler' : ''}

6. Prompt PROFESYONEL, DETAYLI ve ETKİLİ olmalı.

ŞİMDİ SADECE PROMPT METNİNİ YAZ:`;

        // 1. ÖNCE GEMİNİ DENE
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: engineeringPrompt }]
                    }],
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 4096
                    }
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
                const resultText = data.candidates[0].content.parts[0].text;
                return res.status(200).json({ 
                    prompt: resultText, 
                    provider: 'gemini' 
                });
            }
        } catch (e) {
            console.log('Gemini failed:', e.message);
        }

        // 2. GEMİNİ BAŞARISIZ - DEEPSEEK DENE
        if (DEEPSEEK_KEY) {
            try {
                const response = await fetch('https://api.deepseek.com/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${DEEPSEEK_KEY}`
                    },
                    body: JSON.stringify({
                        model: 'deepseek-chat',
                        messages: [
                            { role: 'system', content: 'Sen profesyonel bir prompt mühendisisin. Sadece prompt metni döndür, başka hiçbir şey yazma.' },
                            { role: 'user', content: engineeringPrompt }
                        ],
                        temperature: 0.8,
                        max_tokens: 4096
                    })
                });
                
                const data = await response.json();
                
                if (response.ok && data.choices?.[0]?.message?.content) {
                    return res.status(200).json({ 
                        prompt: data.choices[0].message.content, 
                        provider: 'deepseek' 
                    });
                }
            } catch (e) {
                console.log('DeepSeek failed:', e.message);
            }
        }

        // 3. DEEPSEEK BAŞARISIZ - OPENAI DENE
        if (OPENAI_KEY) {
            try {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENAI_KEY}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-3.5-turbo',
                        messages: [
                            { role: 'system', content: 'Sen profesyonel bir prompt mühendisisin. Sadece prompt metni döndür, başka hiçbir şey yazma.' },
                            { role: 'user', content: engineeringPrompt }
                        ],
                        temperature: 0.8,
                        max_tokens: 4096
                    })
                });
                
                const data = await response.json();
                
                if (response.ok && data.choices?.[0]?.message?.content) {
                    return res.status(200).json({ 
                        prompt: data.choices[0].message.content, 
                        provider: 'openai' 
                    });
                }
            } catch (e) {
                console.log('OpenAI failed:', e.message);
            }
        }

        // HİÇBİRİ ÇALIŞMADI
        throw new Error("Tüm AI servisleri şu an meşgul");
        
    } catch (error) {
        return res.status(200).json({ 
            prompt: "⚠️ Hata: " + error.message,
            provider: 'error'
        });
    }
}
