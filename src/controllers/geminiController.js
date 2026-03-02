/**
 * Gemini API Proxy Controller
 * Protege a API key no servidor e faz a chamada ao Gemini.
 */

async function analyzeDesignSystem(req, res) {
    const { url } = req.body;

    // Validar API key no ambiente
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({
            success: false,
            error: 'GEMINI_API_KEY não configurada no servidor. Defina a variável de ambiente.'
        });
    }

    // Validar URL recebida
    if (!url) {
        return res.status(400).json({ success: false, error: 'URL é obrigatória.' });
    }

    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error('Protocolo inválido');
        }
    } catch {
        return res.status(400).json({
            success: false,
            error: 'URL inválida. Use uma URL completa como https://example.com'
        });
    }

    // Configuração do modelo
    const modelName = 'gemini-2.5-flash-preview-09-2025';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{ parts: [{ text: `Analise esta URL para extração de Design System: ${url}` }] }],
        systemInstruction: {
            parts: [{
                text: 'Você é um Agente de Design System especialista. Analise a URL ou contexto fornecido e gere um resumo técnico em português: 1. Paleta de Cores, 2. Tipografia, 3. Moodboard Visual. Seja conciso e use formatação limpa.'
            }]
        }
    };

    // Retry com backoff exponencial
    for (let i = 0; i < 5; i++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API Error (${response.status})`);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Erro ao processar dados.';

            return res.json({ success: true, data: text });
        } catch (error) {
            console.error(`[Gemini] Tentativa ${i + 1}/5 falhou:`, error.message);
            if (i < 4) {
                const delay = Math.pow(2, i) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    res.status(503).json({
        success: false,
        error: 'Falha após múltiplas tentativas de conexão com a API Gemini.'
    });
}

module.exports = { analyzeDesignSystem };
