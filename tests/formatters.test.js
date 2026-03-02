const { generateCssCustomProperties, generateTailwindConfig } = require('../src/utils/formatters');

// Fixture: resultado mínimo de extração simulando extractTokensFromUrl
function createMockResult(overrides = {}) {
    return {
        meta: {
            url: 'https://example.com',
            extractedAt: '2026-03-02T00:00:00.000Z',
            ...overrides.meta
        },
        tokens: {
            color: {
                rootVariables: {},
                semantic: { primary: '#8B5CF6', text: '#000000' },
                solid: [
                    { value: '#8B5CF6', count: 42 },
                    { value: '#FFFFFF', count: 30 }
                ],
                gradients: [],
                shadows: [
                    { value: '0 4px 6px rgba(0,0,0,0.1)', count: 10 }
                ],
                ...overrides.color
            },
            typography: {
                scale: { base: '16px', lg: '24px' },
                sampled: [],
                ...overrides.typography
            },
            spacing: {
                scale: { '0': '4px', '1': '8px', '2': '16px' },
                sampled: [],
                ...overrides.spacing
            },
            borderRadius: {
                scale: { sm: '4px', md: '8px' },
                sampled: [],
                ...overrides.borderRadius
            },
            motion: {
                transitions: [
                    { value: { transitionProperty: 'all', transitionDuration: '0.3s', transitionTimingFunction: 'ease' }, count: 5 }
                ],
                animations: [],
                keyframes: [],
                ...overrides.motion
            }
        }
    };
}

// ==============================================
// generateCssCustomProperties
// ==============================================
describe('generateCssCustomProperties', () => {

    test('retorna string não vazia', () => {
        const result = generateCssCustomProperties(createMockResult());
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    test('inclui header com URL e data', () => {
        const css = generateCssCustomProperties(createMockResult());
        expect(css).toContain('https://example.com');
        expect(css).toContain('2026-03-02');
    });

    test('abre e fecha :root', () => {
        const css = generateCssCustomProperties(createMockResult());
        expect(css).toContain(':root {');
        expect(css).toContain('}');
    });

    test('gera variáveis de cores semânticas', () => {
        const css = generateCssCustomProperties(createMockResult());
        expect(css).toContain('--color-primary: #8B5CF6;');
        expect(css).toContain('--color-text: #000000;');
    });

    test('gera variáveis de cores sólidas (top N)', () => {
        const css = generateCssCustomProperties(createMockResult());
        expect(css).toContain('--color-1: #8B5CF6;');
        expect(css).toContain('--color-2: #FFFFFF;');
    });

    test('gera escala de font-size', () => {
        const css = generateCssCustomProperties(createMockResult());
        expect(css).toContain('--font-size-base: 16px;');
        expect(css).toContain('--font-size-lg: 24px;');
    });

    test('gera escala de spacing', () => {
        const css = generateCssCustomProperties(createMockResult());
        expect(css).toContain('--spacing-0: 4px;');
        expect(css).toContain('--spacing-2: 16px;');
    });

    test('gera escala de border-radius', () => {
        const css = generateCssCustomProperties(createMockResult());
        expect(css).toContain('--radius-sm: 4px;');
        expect(css).toContain('--radius-md: 8px;');
    });

    test('gera shadows', () => {
        const css = generateCssCustomProperties(createMockResult());
        expect(css).toContain('--shadow-1: 0 4px 6px rgba(0,0,0,0.1);');
    });

    test('gera transitions', () => {
        const css = generateCssCustomProperties(createMockResult());
        expect(css).toContain('--transition-1: all 0.3s ease;');
    });

    test('omite seções vazias', () => {
        const css = generateCssCustomProperties(createMockResult({
            color: { semantic: {}, solid: [], shadows: [], rootVariables: {}, gradients: [] },
            typography: { scale: {}, sampled: [] },
            spacing: { scale: {}, sampled: [] },
            borderRadius: { scale: {}, sampled: [] },
            motion: { transitions: [], animations: [], keyframes: [] }
        }));
        expect(css).not.toContain('Semantic Colors');
        expect(css).not.toContain('Top Colors');
        expect(css).not.toContain('Font Size Scale');
    });
});

// ==============================================
// generateTailwindConfig
// ==============================================
describe('generateTailwindConfig', () => {

    test('retorna string não vazia', () => {
        const result = generateTailwindConfig(createMockResult());
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    test('inclui header de tipo e URL', () => {
        const tw = generateTailwindConfig(createMockResult());
        expect(tw).toContain("@type {import('tailwindcss').Config}");
        expect(tw).toContain('https://example.com');
    });

    test('exporta module.exports', () => {
        const tw = generateTailwindConfig(createMockResult());
        expect(tw).toContain('module.exports =');
    });

    test('gera cores semânticas no extend.colors', () => {
        const tw = generateTailwindConfig(createMockResult());
        expect(tw).toContain('"primary"');
        expect(tw).toContain('#8B5CF6');
    });

    test('gera fontSize no extend', () => {
        const tw = generateTailwindConfig(createMockResult());
        expect(tw).toContain('"fontSize"');
        expect(tw).toContain('"base": "16px"');
    });

    test('gera spacing no extend', () => {
        const tw = generateTailwindConfig(createMockResult());
        expect(tw).toContain('"spacing"');
        expect(tw).toContain('"2": "16px"');
    });

    test('gera borderRadius no extend', () => {
        const tw = generateTailwindConfig(createMockResult());
        expect(tw).toContain('"borderRadius"');
        expect(tw).toContain('"sm": "4px"');
    });

    test('gera boxShadow no extend', () => {
        const tw = generateTailwindConfig(createMockResult());
        expect(tw).toContain('"boxShadow"');
        expect(tw).toContain('"custom-1"');
    });

    test('omite extend.colors quando semantic vazio', () => {
        const tw = generateTailwindConfig(createMockResult({
            color: { semantic: {}, solid: [], shadows: [], rootVariables: {}, gradients: [] }
        }));
        expect(tw).not.toContain('"colors"');
    });
});
