const { extractTokensFromUrl } = require('../core/extractTokens');
const { validateUrl } = require('../utils/validators');
const { generateCssCustomProperties, generateTailwindConfig } = require('../utils/formatters');

async function extract(req, res) {
    const { url, fast = true, maxElements = 1000 } = req.body;

    const normalizedUrl = validateUrl(url);

    if (!normalizedUrl) {
        return res.status(400).json({
            success: false,
            error: 'URL inválida. Use uma URL completa como https://example.com'
        });
    }

    try {
        console.log(`[${new Date().toISOString()}] Extracting tokens from: ${normalizedUrl}`);

        const result = await extractTokensFromUrl({
            url: normalizedUrl,
            maxElements: fast ? Math.min(maxElements, 700) : maxElements,
            enableInteractions: !fast,
            fast: Boolean(fast)
        });

        // Gerar formatos adicionais
        const css = generateCssCustomProperties(result);
        const tailwind = generateTailwindConfig(result);

        console.log(`[${new Date().toISOString()}] Extraction complete for: ${normalizedUrl}`);

        res.json({
            success: true,
            data: {
                json: result,
                css: css,
                tailwind: tailwind
            }
        });

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error extracting from ${normalizedUrl}:`, error);

        res.status(500).json({
            success: false,
            error: `Erro ao extrair tokens: ${error.message}`
        });
    }
}

module.exports = { extract };
