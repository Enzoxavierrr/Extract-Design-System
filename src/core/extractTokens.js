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

// Função para extrair componentes RGB de uma cor
function parseRgbComponents(colorStr) {
    const s = colorStr.toLowerCase().trim();

    // RGB
    const rgbMatch = s.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
        return {
            r: parseInt(rgbMatch[1]),
            g: parseInt(rgbMatch[2]),
            b: parseInt(rgbMatch[3]),
            a: 1
        };
    }

    // RGBA
    const rgbaMatch = s.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
    if (rgbaMatch) {
        return {
            r: parseInt(rgbaMatch[1]),
            g: parseInt(rgbaMatch[2]),
            b: parseInt(rgbaMatch[3]),
            a: parseFloat(rgbaMatch[4])
        };
    }

    // Hex 6 digits
    const hex6Match = s.match(/#([0-9a-f]{6})/);
    if (hex6Match) {
        const hex = hex6Match[1];
        return {
            r: parseInt(hex.substr(0, 2), 16),
            g: parseInt(hex.substr(2, 2), 16),
            b: parseInt(hex.substr(4, 2), 16),
            a: 1
        };
    }

    // Hex 3 digits
    const hex3Match = s.match(/#([0-9a-f]{3})/);
    if (hex3Match) {
        const hex = hex3Match[1];
        return {
            r: parseInt(hex[0] + hex[0], 16),
            g: parseInt(hex[1] + hex[1], 16),
            b: parseInt(hex[2] + hex[2], 16),
            a: 1
        };
    }

    return null;
}

// Função para converter RGB para HSL
function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
}

// Função para calcular luminância relativa (WCAG)
function getRelativeLuminance(r, g, b) {
    const sRGB = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

function inferSemanticColorNames(colors) {
    if (colors.length === 0) return {};

    const semantic = {};
    const sorted = [...colors].sort((a, b) => b.count - a.count);

    // Analisar todas as cores com seus componentes
    const analyzedColors = sorted
        .filter(c => isColorValue(c.value))
        .map(c => {
            const rgb = parseRgbComponents(c.value);
            if (!rgb) return null;
            const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
            const luminance = getRelativeLuminance(rgb.r, rgb.g, rgb.b);
            return { ...c, rgb, hsl, luminance };
        })
        .filter(Boolean);

    if (analyzedColors.length === 0) return {};

    // Primary: cor mais frequente com saturação razoável (não cinza)
    const primaryCandidate = analyzedColors.find(c => c.hsl.s > 15 || c.hsl.l < 20 || c.hsl.l > 80);
    if (primaryCandidate) {
        semantic.primary = primaryCandidate.value;
    } else if (analyzedColors[0]) {
        semantic.primary = analyzedColors[0].value;
    }

    // Secondary: segunda cor mais frequente, diferente da primary
    const secondaryCandidate = analyzedColors.find(c =>
        c.value !== semantic.primary && (c.hsl.s > 10 || c.hsl.l < 30 || c.hsl.l > 70)
    );
    if (secondaryCandidate) {
        semantic.secondary = secondaryCandidate.value;
    }

    // Accent: cor com alta saturação (vibrante)
    const accentCandidate = analyzedColors.find(c =>
        c.hsl.s > 50 && c.hsl.l > 25 && c.hsl.l < 75 &&
        c.value !== semantic.primary && c.value !== semantic.secondary
    );
    if (accentCandidate) {
        semantic.accent = accentCandidate.value;
    }

    // Background: cor muito clara (alta luminância)
    const backgroundCandidate = analyzedColors.find(c => c.luminance > 0.85);
    if (backgroundCandidate) {
        semantic.background = backgroundCandidate.value;
    }

    // Text: cor muito escura (baixa luminância)
    const textCandidate = analyzedColors.find(c => c.luminance < 0.15);
    if (textCandidate) {
        semantic.text = textCandidate.value;
    }

    // Border: cor cinza (baixa saturação, luminância média)
    const borderCandidate = analyzedColors.find(c =>
        c.hsl.s < 15 && c.hsl.l > 40 && c.hsl.l < 85 &&
        c.value !== semantic.background
    );
    if (borderCandidate) {
        semantic.border = borderCandidate.value;
    }

    // Cores de status baseadas em matiz (hue)
    // Success: verde (hue ~120)
    const successCandidate = analyzedColors.find(c =>
        c.hsl.h >= 90 && c.hsl.h <= 150 && c.hsl.s > 30
    );
    if (successCandidate) {
        semantic.success = successCandidate.value;
    }

    // Error: vermelho (hue ~0 ou ~360)
    const errorCandidate = analyzedColors.find(c =>
        (c.hsl.h >= 0 && c.hsl.h <= 20) || (c.hsl.h >= 340 && c.hsl.h <= 360) &&
        c.hsl.s > 40
    );
    if (errorCandidate) {
        semantic.error = errorCandidate.value;
    }

    // Warning: amarelo/laranja (hue ~30-60)
    const warningCandidate = analyzedColors.find(c =>
        c.hsl.h >= 25 && c.hsl.h <= 55 && c.hsl.s > 40
    );
    if (warningCandidate) {
        semantic.warning = warningCandidate.value;
    }

    // Info: azul (hue ~200-240)
    const infoCandidate = analyzedColors.find(c =>
        c.hsl.h >= 190 && c.hsl.h <= 250 && c.hsl.s > 30 &&
        c.value !== semantic.primary && c.value !== semantic.secondary
    );
    if (infoCandidate) {
        semantic.info = infoCandidate.value;
    }

    return semantic;
}

// Função para extrair valor numérico de uma string CSS (ex: "16px" -> 16)
function parseNumericValue(value) {
    if (!value) return null;
    const match = String(value).match(/^([\d.]+)(px|rem|em|%)?$/);
    if (match) {
        return {
            number: parseFloat(match[1]),
            unit: match[2] || 'px',
            original: value
        };
    }
    return null;
}

// Função para criar escala de tamanhos de fonte
function createFontSizeScale(typographySamples) {
    // Extrair todos os font-sizes únicos
    const fontSizes = new Map();

    for (const sample of typographySamples) {
        const parsed = parseNumericValue(sample.value?.fontSize);
        if (parsed && parsed.unit === 'px') {
            const key = parsed.number;
            if (!fontSizes.has(key)) {
                fontSizes.set(key, { value: sample.value.fontSize, count: sample.count });
            } else {
                fontSizes.get(key).count += sample.count;
            }
        }
    }

    // Ordenar por tamanho
    const sorted = [...fontSizes.entries()]
        .sort((a, b) => a[0] - b[0])
        .slice(0, 10); // Máximo 10 tamanhos na escala

    if (sorted.length === 0) return {};

    // Nomes de escala baseados em posição
    const scaleNames = ['xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'];

    // Se tivermos poucos tamanhos, centralizamos na escala
    const scale = {};
    const startIndex = Math.max(0, Math.floor((scaleNames.length - sorted.length) / 2));

    sorted.forEach(([size, data], index) => {
        const scaleName = scaleNames[startIndex + index] || `size-${index}`;
        scale[scaleName] = data.value;
    });

    return scale;
}

// Função para criar escala de espaçamentos
function createSpacingScale(spacingSamples) {
    // Extrair todos os valores únicos
    const spacings = new Map();

    for (const sample of spacingSamples) {
        const parsed = parseNumericValue(sample.value);
        if (parsed && parsed.unit === 'px' && parsed.number > 0) {
            const key = parsed.number;
            if (!spacings.has(key)) {
                spacings.set(key, { value: sample.value, count: sample.count });
            } else {
                spacings.get(key).count += sample.count;
            }
        }
    }

    // Ordenar por tamanho
    const sorted = [...spacings.entries()]
        .sort((a, b) => a[0] - b[0])
        .slice(0, 12); // Máximo 12 valores na escala

    if (sorted.length === 0) return {};

    // Detectar se parece uma escala baseada em 4 ou 8
    const values = sorted.map(([size]) => size);
    const isBase8 = values.every(v => v % 8 === 0 || v % 4 === 0);

    const scale = {};

    if (isBase8 && values.length >= 3) {
        // Usar nomes numéricos (0, 1, 2, 3...) para escala consistente
        sorted.forEach(([size, data], index) => {
            scale[String(index)] = data.value;
        });
    } else {
        // Usar nomes semânticos
        const scaleNames = ['0', 'px', '0.5', '1', '1.5', '2', '2.5', '3', '4', '5', '6', '8', '10', '12', '16', '20'];
        sorted.forEach(([size, data], index) => {
            scale[scaleNames[index] || String(index)] = data.value;
        });
    }

    return scale;
}

// Função para criar escala de border-radius
function createBorderRadiusScale(borderRadiusSamples) {
    const radii = new Map();

    for (const sample of borderRadiusSamples) {
        const parsed = parseNumericValue(sample.value);
        if (parsed && parsed.number > 0) {
            const key = parsed.number;
            if (!radii.has(key)) {
                radii.set(key, { value: sample.value, count: sample.count });
            } else {
                radii.get(key).count += sample.count;
            }
        }
    }

    // Ordenar por tamanho
    const sorted = [...radii.entries()]
        .sort((a, b) => a[0] - b[0])
        .slice(0, 8);

    if (sorted.length === 0) return {};

    const scaleNames = ['none', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full'];
    const scale = {};

    // Mapear valores para nomes de escala
    sorted.forEach(([size, data], index) => {
        // Valores muito grandes provavelmente são "full" (50%, 9999px, etc.)
        if (size >= 100 || String(data.value).includes('%')) {
            scale['full'] = data.value;
        } else {
            scale[scaleNames[index + 1] || `radius-${index}`] = data.value;
        }
    });

    return scale;
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
            const spacingSamples = [];
            const sizingSamples = [];

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

                // Spacing tokens
                spacingSamples.push(
                    pick(cs, [
                        'marginTop',
                        'marginRight',
                        'marginBottom',
                        'marginLeft',
                        'paddingTop',
                        'paddingRight',
                        'paddingBottom',
                        'paddingLeft',
                        'gap',
                        'rowGap',
                        'columnGap'
                    ])
                );

                // Sizing tokens
                sizingSamples.push(
                    pick(cs, [
                        'width',
                        'height',
                        'minWidth',
                        'minHeight',
                        'maxWidth',
                        'maxHeight',
                        'borderTopLeftRadius',
                        'borderTopRightRadius',
                        'borderBottomRightRadius',
                        'borderBottomLeftRadius'
                    ])
                );
            }

            return {
                rootVars,
                keyframes,
                samples: {
                    colors: colorSamples,
                    typography: typographySamples,
                    motion: motionSamples,
                    spacing: spacingSamples,
                    sizing: sizingSamples
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
        const spacingCounts = new Map();
        const borderRadiusCounts = new Map();

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

        // Processar spacing tokens
        for (const s of extraction.samples.spacing || []) {
            // Extrair valores únicos de spacing (ignorando 0px e auto)
            const spacingValues = [
                s.marginTop, s.marginRight, s.marginBottom, s.marginLeft,
                s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft,
                s.gap, s.rowGap, s.columnGap
            ];
            for (const v of spacingValues) {
                const normalized = normalizeWhitespace(v);
                if (normalized && normalized !== '0px' && normalized !== 'auto' && normalized !== 'normal') {
                    addCount(spacingCounts, normalized);
                }
            }
        }

        // Processar sizing e border-radius tokens
        for (const sz of extraction.samples.sizing || []) {
            // Border radius values
            const radiusValues = [
                sz.borderTopLeftRadius, sz.borderTopRightRadius,
                sz.borderBottomRightRadius, sz.borderBottomLeftRadius
            ];
            for (const v of radiusValues) {
                const normalized = normalizeWhitespace(v);
                if (normalized && normalized !== '0px') {
                    addCount(borderRadiusCounts, normalized);
                }
            }
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

        // Processar spacing tokens - ordenar por frequência
        const spacingTop = topNFromCountMap(spacingCounts, 30)
            .map(({ value, count }) => ({ value, count }));

        // Processar border-radius tokens - ordenar por frequência
        const borderRadiusTop = topNFromCountMap(borderRadiusCounts, 20)
            .map(({ value, count }) => ({ value, count }));

        // Criar escalas organizadas
        const fontSizeScale = createFontSizeScale(typographyTop);
        const spacingScale = createSpacingScale(spacingTop);
        const borderRadiusScale = createBorderRadiusScale(borderRadiusTop);

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
                    scale: fontSizeScale,
                    sampled: typographyTop
                },
                spacing: {
                    scale: spacingScale,
                    sampled: spacingTop
                },
                borderRadius: {
                    scale: borderRadiusScale,
                    sampled: borderRadiusTop
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