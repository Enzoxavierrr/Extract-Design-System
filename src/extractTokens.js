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
        const typographyCounts = new Map();
        const transitionCounts = new Map();
        const animationCounts = new Map();

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

        for (const sample of extraction.samples.colors || []) {
            const { colors, shadows } = sample;
            for (const v of Object.values(colors || {})) {
                addCount(colorCounts, normalizeColorString(v));
            }
            if (shadows && typeof shadows.boxShadow === 'string') addCount(colorCounts, normalizeColorString(shadows.boxShadow));
            if (shadows && typeof shadows.textShadow === 'string') addCount(colorCounts, normalizeColorString(shadows.textShadow));
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

        const colorsTop = topNFromCountMap(colorCounts, 60)
            .filter(({ value }) => value && value !== 'transparent' && value !== 'initial' && value !== 'inherit' && value !== 'unset')
            .map(({ value, count }) => ({ value, count }));

        return {
            meta: {
                url,
                extractedAt: new Date().toISOString(),
                maxElements,
                interactionsEnabled: Boolean(enableInteractions)
            },
            tokens: {
                color: {
                    rootVariables: rootColorVars,
                    sampled: colorsTop
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
