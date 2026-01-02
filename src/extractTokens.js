const { chromium } = require('playwright');

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function normalizeWhitespace(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
}

function normalizeColorString(v) {
    const s = normalizeWhitespace(v).toLowerCase();
    if (!s || s === 'transparent' || s === 'initial' || s === 'inherit' || s === 'unset') return null;
    if (s === 'currentcolor') return 'currentcolor';
    return s;
}

function isColorValue(str) {
    if (!str) return false;
    const s = str.toLowerCase().trim();
    return s.startsWith('rgb(') || 
           s.startsWith('rgba(') || 
           s.startsWith('#') || 
           s.includes('hsl(') || 
           s.includes('hsla(') ||
           s === 'currentcolor';
}

function isGradientValue(str) {
    if (!str) return false;
    return str.trim().startsWith('url(') || 
           str.trim().startsWith('linear-gradient') ||
           str.trim().startsWith('radial-gradient');
}

function isShadowValue(str) {
    if (!str) return false;
    const s = str.trim();
    
    // Verificar padrões típicos de shadow
    // Box shadow: rgba/rgb + offset-x + offset-y + blur + spread
    // Text shadow: rgba/rgb + offset-x + offset-y + blur
    const hasColor = s.includes('rgba') || s.includes('rgb');
    const hasPx = s.includes('px');
    
    if (hasColor && hasPx) {
        // Verificar se tem padrão de shadow (números seguidos de px)
        const pxCount = (s.match(/\d+px/g) || []).length;
        // Shadow precisa ter pelo menos offset-x e offset-y (2 valores px)
        return pxCount >= 2;
    }
    
    return false;
}

function categorizeColor(value) {
    if (isGradientValue(value)) return 'gradient';
    if (isShadowValue(value)) return 'shadow';
    if (isColorValue(value)) return 'color';
    return 'other';
}

function addCount(map, key, n = 1) {
    if (!key) return;
    map.set(key, (map.get(key) || 0) + n);
}

function topNFromCountMap(map, n) {
    return [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([value, count]) => ({ value, count }));
}

function inferSemanticColorNames(colors) {
    if (colors.length === 0) return {};
    
    const semantic = {};
    const sorted = [...colors].sort((a, b) => b.count - a.count);
    
    // Cor mais frequente = primary
    if (sorted[0] && isColorValue(sorted[0].value)) {
        semantic.primary = sorted[0].value;
    }
    
    // Segunda mais frequente = secondary (se for diferente da primary)
    if (sorted[1] && isColorValue(sorted[1].value) && sorted[1].value !== semantic.primary) {
        semantic.secondary = sorted[1].value;
    }
    
    // Função auxiliar para detectar cores claras (background)
    const isLightColor = (colorStr) => {
        const s = colorStr.toLowerCase();
        // RGB branco ou próximo
        const rgbMatch = s.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
            const r = parseInt(rgbMatch[1]);
            const g = parseInt(rgbMatch[2]);
            const b = parseInt(rgbMatch[3]);
            // Se a média dos valores RGB for > 200, é uma cor clara
            return (r + g + b) / 3 > 200;
        }
        // RGBA com alpha
        const rgbaMatch = s.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
        if (rgbaMatch) {
            const r = parseInt(rgbaMatch[1]);
            const g = parseInt(rgbaMatch[2]);
            const b = parseInt(rgbaMatch[3]);
            return (r + g + b) / 3 > 200;
        }
        // Hex branco ou próximo
        if (s.match(/#([0-9a-f]{3}|[0-9a-f]{6})/)) {
            return s.includes('#fff') || s.includes('#ff') || s.includes('#fe');
        }
        return false;
    };
    
    // Função auxiliar para detectar cores escuras (text)
    const isDarkColor = (colorStr) => {
        const s = colorStr.toLowerCase();
        // RGB preto ou próximo
        const rgbMatch = s.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
            const r = parseInt(rgbMatch[1]);
            const g = parseInt(rgbMatch[2]);
            const b = parseInt(rgbMatch[3]);
            // Se a média dos valores RGB for < 50, é uma cor escura
            return (r + g + b) / 3 < 50;
        }
        // RGBA com alpha
        const rgbaMatch = s.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
        if (rgbaMatch) {
            const r = parseInt(rgbaMatch[1]);
            const g = parseInt(rgbaMatch[2]);
            const b = parseInt(rgbaMatch[3]);
            return (r + g + b) / 3 < 50;
        }
        // Hex preto ou próximo
        if (s.match(/#([0-9a-f]{3}|[0-9a-f]{6})/)) {
            return s.includes('#000') || s.includes('#00') || s.includes('#01');
        }
        return false;
    };
    
    // Procurar por cores claras para background
    for (const c of sorted) {
        if (!isColorValue(c.value)) continue;
        if (!semantic.background && isLightColor(c.value)) {
            semantic.background = c.value;
            break;
        }
    }
    
    // Procurar por cores escuras para text
    for (const c of sorted) {
        if (!isColorValue(c.value)) continue;
        if (!semantic.text && isDarkColor(c.value)) {
            semantic.text = c.value;
            break;
        }
    }
    
    return semantic;
}

async function extractTokensFromUrl({ url, maxElements = 2000, enableInteractions = true, fast = false }) {
    if (!url) throw new Error('url is required');

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    try {
        if (fast) {
            await page.route('**/*', async (route) => {
                const req = route.request();
                const type = req.resourceType();
                if (type === 'image' || type === 'media' || type === 'font') {
                    await route.abort();
                    return;
                }
                await route.continue();
            });
        }

        await page.goto(url, { waitUntil: fast ? 'domcontentloaded' : 'load', timeout: fast ? 30000 : 60000 });
        await page.waitForTimeout(fast ? 50 : 150);

        await page.evaluate(async (isFast) => {
            try {
                if (document && document.fonts && document.fonts.ready) {
                    if (!isFast) await document.fonts.ready;
                }
            } catch (e) {
                // ignore
            }
        }, Boolean(fast));

        await page.waitForTimeout(fast ? 50 : 150);

        await page.evaluate(() => {
            if (window.__motionCaptureInstalled) return;
            window.__motionCaptureInstalled = true;

            window.__motionEvents = [];

            const push = (evt) => {
                try {
                    window.__motionEvents.push(evt);
                } catch (e) {
                    // ignore
                }
            };

            document.addEventListener(
                'transitionrun',
                (e) => {
                    const target = e.target;
                    if (!target || !(target instanceof Element)) return;
                    const cs = window.getComputedStyle(target);
                    push({
                        kind: 'transition',
                        propertyName: e.propertyName || null,
                        elapsedTime: typeof e.elapsedTime === 'number' ? e.elapsedTime : null,
                        timestamp: Date.now(),
                        computed: {
                            transitionProperty: cs.transitionProperty,
                            transitionDuration: cs.transitionDuration,
                            transitionTimingFunction: cs.transitionTimingFunction,
                            transitionDelay: cs.transitionDelay
                        }
                    });
                },
                { capture: true }
            );

            document.addEventListener(
                'animationstart',
                (e) => {
                    const target = e.target;
                    if (!target || !(target instanceof Element)) return;
                    const cs = window.getComputedStyle(target);
                    push({
                        kind: 'animation',
                        animationName: e.animationName || null,
                        elapsedTime: typeof e.elapsedTime === 'number' ? e.elapsedTime : null,
                        timestamp: Date.now(),
                        computed: {
                            animationName: cs.animationName,
                            animationDuration: cs.animationDuration,
                            animationTimingFunction: cs.animationTimingFunction,
                            animationDelay: cs.animationDelay,
                            animationIterationCount: cs.animationIterationCount,
                            animationDirection: cs.animationDirection,
                            animationFillMode: cs.animationFillMode,
                            animationPlayState: cs.animationPlayState
                        }
                    });
                },
                { capture: true }
            );
        });

        const extraction = await page.evaluate((opts) => {
            const maxElementsLocal = typeof opts.maxElements === 'number' ? opts.maxElements : 2000;
            const maxElementsClamped = Math.max(1, Math.min(20000, maxElementsLocal));

            const visibleElements = [];
            const all = Array.from(document.querySelectorAll('body *'));
            for (let i = 0; i < all.length && visibleElements.length < maxElementsClamped; i++) {
                const el = all[i];
                const rect = el.getBoundingClientRect();
                if (!rect || rect.width <= 0 || rect.height <= 0) continue;
                const cs = getComputedStyle(el);
                if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
                visibleElements.push(el);
            }

            const rootStyle = getComputedStyle(document.documentElement);
            const rootVars = {};
            for (let i = 0; i < rootStyle.length; i++) {
                const prop = rootStyle[i];
                if (prop && prop.startsWith('--')) {
                    const val = rootStyle.getPropertyValue(prop);
                    const v = String(val || '').trim();
                    if (v) rootVars[prop] = v;
                }
            }

            const keyframes = [];
            for (const sheet of Array.from(document.styleSheets)) {
                let rules;
                try {
                    rules = sheet.cssRules;
                } catch (e) {
                    continue;
                }
                if (!rules) continue;
                for (const rule of Array.from(rules)) {
                    if (rule && rule.type === CSSRule.KEYFRAMES_RULE) {
                        const frames = [];
                        for (const kf of Array.from(rule.cssRules || [])) {
                            frames.push({ keyText: kf.keyText, style: kf.style ? kf.style.cssText : '' });
                        }
                        keyframes.push({ name: rule.name, frames });
                    }
                }
            }

            const colorSamples = [];
            const typographySamples = [];
            const motionSamples = [];

            const pick = (obj, keys) => {
                const out = {};
                for (const k of keys) out[k] = obj[k];
                return out;
            };

            for (const el of visibleElements) {
                const cs = getComputedStyle(el);

                const colors = {
                    color: cs.color,
                    backgroundColor: cs.backgroundColor,
                    borderTopColor: cs.borderTopColor,
                    borderRightColor: cs.borderRightColor,
                    borderBottomColor: cs.borderBottomColor,
                    borderLeftColor: cs.borderLeftColor,
                    outlineColor: cs.outlineColor,
                    textDecorationColor: cs.textDecorationColor,
                    fill: cs.fill,
                    stroke: cs.stroke
                };

                const shadows = {
                    boxShadow: cs.boxShadow,
                    textShadow: cs.textShadow
                };

                colorSamples.push({ colors, shadows });

                typographySamples.push(
                    pick(cs, [
                        'fontFamily',
                        'fontSize',
                        'fontWeight',
                        'fontStyle',
                        'lineHeight',
                        'letterSpacing',
                        'textTransform'
                    ])
                );

                motionSamples.push(
                    pick(cs, [
                        'transitionProperty',
                        'transitionDuration',
                        'transitionTimingFunction',
                        'transitionDelay',
                        'animationName',
                        'animationDuration',
                        'animationTimingFunction',
                        'animationDelay',
                        'animationIterationCount',
                        'animationDirection',
                        'animationFillMode',
                        'animationPlayState'
                    ])
                );
            }

            return {
                rootVars,
                keyframes,
                samples: {
                    colors: colorSamples,
                    typography: typographySamples,
                    motion: motionSamples
                }
            };
        }, { maxElements });

        if (enableInteractions) {
            const candidates = await page.$$('a, button, [role="button"], input, select, textarea, summary');
            const limit = clamp(candidates.length, 0, 25);

            for (let i = 0; i < limit; i++) {
                const el = candidates[i];
                try {
                    await el.scrollIntoViewIfNeeded();
                    await page.waitForTimeout(fast ? 10 : 50);
                    await el.hover({ trial: true }).catch(() => null);
                    await el.hover().catch(() => null);
                    await page.waitForTimeout(fast ? 40 : 150);
                    await el.click({ trial: true }).catch(() => null);
                } catch (e) {
                    // ignore
                }
            }

            try {
                await page.mouse.wheel(0, 800);
                await page.waitForTimeout(fast ? 80 : 250);
                await page.mouse.wheel(0, -800);
                await page.waitForTimeout(fast ? 80 : 250);
            } catch (e) {
                // ignore
            }
        }

        const motionEvents = await page.evaluate(() => Array.isArray(window.__motionEvents) ? window.__motionEvents : []);

        const colorCounts = new Map();
        const gradientCounts = new Map();
        const shadowCounts = new Map();
        const typographyCounts = new Map();
        const transitionCounts = new Map();
        const animationCounts = new Map();
        
        // Map para manter formato original das cores (normalized -> original)
        const colorOriginalMap = new Map();

        const rootColorVars = {};
        const rootOtherVars = {};

        for (const [k, v] of Object.entries(extraction.rootVars || {})) {
            const n = normalizeColorString(v);
            if (n && (n.startsWith('rgb(') || n.startsWith('rgba(') || n.startsWith('#') || n.includes('hsl(') || n.includes('hsla('))) {
                rootColorVars[k] = v.trim();
            } else {
                rootOtherVars[k] = v.trim();
            }
        }

        // Separar cores, gradientes e sombras
        for (const sample of extraction.samples.colors || []) {
            const { colors, shadows } = sample;
            
            // Processar cores
            for (const v of Object.values(colors || {})) {
                const normalized = normalizeColorString(v);
                if (!normalized) continue;
                
                const category = categorizeColor(v);
                if (category === 'color') {
                    // Guardar o primeiro formato original encontrado para cada valor normalizado
                    if (!colorOriginalMap.has(normalized)) {
                        colorOriginalMap.set(normalized, v.trim());
                    }
                    addCount(colorCounts, normalized);
                } else if (category === 'gradient') {
                    addCount(gradientCounts, v.trim());
                }
            }
            
            // Processar sombras separadamente
            if (shadows && typeof shadows.boxShadow === 'string' && shadows.boxShadow !== 'none') {
                const shadowValue = shadows.boxShadow.trim();
                if (shadowValue && isShadowValue(shadowValue)) {
                    addCount(shadowCounts, shadowValue);
                }
            }
            if (shadows && typeof shadows.textShadow === 'string' && shadows.textShadow !== 'none') {
                const shadowValue = shadows.textShadow.trim();
                if (shadowValue && isShadowValue(shadowValue)) {
                    addCount(shadowCounts, shadowValue);
                }
            }
        }

        for (const t of extraction.samples.typography || []) {
            const key = [
                normalizeWhitespace(t.fontFamily),
                normalizeWhitespace(t.fontSize),
                normalizeWhitespace(t.fontWeight),
                normalizeWhitespace(t.fontStyle),
                normalizeWhitespace(t.lineHeight),
                normalizeWhitespace(t.letterSpacing),
                normalizeWhitespace(t.textTransform)
            ].join('|');
            addCount(typographyCounts, key);
        }

        for (const m of extraction.samples.motion || []) {
            const transitionKey = [
                normalizeWhitespace(m.transitionProperty),
                normalizeWhitespace(m.transitionDuration),
                normalizeWhitespace(m.transitionTimingFunction),
                normalizeWhitespace(m.transitionDelay)
            ].join('|');
            if (transitionKey !== '|||' && transitionKey !== 'none|||') addCount(transitionCounts, transitionKey);

            const animationKey = [
                normalizeWhitespace(m.animationName),
                normalizeWhitespace(m.animationDuration),
                normalizeWhitespace(m.animationTimingFunction),
                normalizeWhitespace(m.animationDelay),
                normalizeWhitespace(m.animationIterationCount),
                normalizeWhitespace(m.animationDirection),
                normalizeWhitespace(m.animationFillMode),
                normalizeWhitespace(m.animationPlayState)
            ].join('|');
            if (animationKey !== '|||||||' && !animationKey.startsWith('none|')) addCount(animationCounts, animationKey);
        }

        for (const evt of motionEvents || []) {
            if (evt.kind === 'transition' && evt.computed) {
                const k = [
                    normalizeWhitespace(evt.computed.transitionProperty),
                    normalizeWhitespace(evt.computed.transitionDuration),
                    normalizeWhitespace(evt.computed.transitionTimingFunction),
                    normalizeWhitespace(evt.computed.transitionDelay)
                ].join('|');
                if (k !== '|||' && k !== 'none|||') addCount(transitionCounts, k, 3);
            }
            if (evt.kind === 'animation' && evt.computed) {
                const k = [
                    normalizeWhitespace(evt.computed.animationName),
                    normalizeWhitespace(evt.computed.animationDuration),
                    normalizeWhitespace(evt.computed.animationTimingFunction),
                    normalizeWhitespace(evt.computed.animationDelay),
                    normalizeWhitespace(evt.computed.animationIterationCount),
                    normalizeWhitespace(evt.computed.animationDirection),
                    normalizeWhitespace(evt.computed.animationFillMode),
                    normalizeWhitespace(evt.computed.animationPlayState)
                ].join('|');
                if (k !== '|||||||' && !k.startsWith('none|')) addCount(animationCounts, k, 3);
            }
        }

        const typographyTop = topNFromCountMap(typographyCounts, 30).map(({ value, count }) => {
            const [
                fontFamily,
                fontSize,
                fontWeight,
                fontStyle,
                lineHeight,
                letterSpacing,
                textTransform
            ] = value.split('|');

            return {
                value: {
                    fontFamily,
                    fontSize,
                    fontWeight,
                    fontStyle,
                    lineHeight,
                    letterSpacing,
                    textTransform
                },
                count
            };
        });

        const transitionsTop = topNFromCountMap(transitionCounts, 30).map(({ value, count }) => {
            const [transitionProperty, transitionDuration, transitionTimingFunction, transitionDelay] = value.split('|');
            return {
                value: { transitionProperty, transitionDuration, transitionTimingFunction, transitionDelay },
                count
            };
        });

        const animationsTop = topNFromCountMap(animationCounts, 30).map(({ value, count }) => {
            const [
                animationName,
                animationDuration,
                animationTimingFunction,
                animationDelay,
                animationIterationCount,
                animationDirection,
                animationFillMode,
                animationPlayState
            ] = value.split('|');
            return {
                value: {
                    animationName,
                    animationDuration,
                    animationTimingFunction,
                    animationDelay,
                    animationIterationCount,
                    animationDirection,
                    animationFillMode,
                    animationPlayState
                },
                count
            };
        });

        // Filtrar e categorizar cores, usando formato original
        const colorsTop = topNFromCountMap(colorCounts, 60)
            .filter(({ value }) => value && 
                    value !== 'transparent' && 
                    value !== 'initial' && 
                    value !== 'inherit' && 
                    value !== 'unset' &&
                    value !== 'none' &&
                    isColorValue(value))
            .map(({ value, count }) => ({ 
                value: colorOriginalMap.get(value) || value, // Usar formato original
                count 
            }));

        const gradientsTop = topNFromCountMap(gradientCounts, 20)
            .map(({ value, count }) => ({ value, count }));

        const shadowsTop = topNFromCountMap(shadowCounts, 20)
            .map(({ value, count }) => ({ value, count }));

        // Inferir nomes semânticos
        const semanticColors = inferSemanticColorNames(colorsTop);

        return {
            meta: {
                url,
                extractedAt: new Date().toISOString(),
                maxElements,
                interactionsEnabled: Boolean(enableInteractions),
                description: `Design tokens extraídos de ${url}`
            },
            tokens: {
                color: {
                    rootVariables: rootColorVars,
                    semantic: semanticColors,
                    solid: colorsTop,
                    gradients: gradientsTop,
                    shadows: shadowsTop
                },
                typography: {
                    sampled: typographyTop
                },
                motion: {
                    transitions: transitionsTop,
                    animations: animationsTop,
                    keyframes: (extraction.keyframes || []).slice(0, 200)
                }
            },
            debug: {
                rootVariablesOther: rootOtherVars,
                motionEventsSample: (motionEvents || []).slice(0, 50)
            }
        };
    } finally {
        await page.close().catch(() => null);
        await browser.close().catch(() => null);
    }
}

module.exports = { extractTokensFromUrl };