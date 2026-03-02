// ========================================
// Vortexe | Frontend App (Unified)
// ========================================

document.addEventListener('DOMContentLoaded', () => {

    // ----------------------------------------
    // 0. Preloader Counter Animation
    // ----------------------------------------
    const preloader = document.getElementById('preloader');
    if (preloader) {
        const d1 = document.getElementById('preloader-d1');
        const d2 = document.getElementById('preloader-d2');
        const d3 = document.getElementById('preloader-d3');
        const hundreds = document.getElementById('preloader-hundreds');

        // Starts showing only 2 digits (tens + units): "00"

        // Phase 1 (0.3s): Units roll 0→9→0
        setTimeout(() => {
            if (d3) d3.style.transform = 'translateY(-10em)';
        }, 300);

        // Phase 2 (1.2s): Tens roll 0→9→0
        setTimeout(() => {
            if (d2) d2.style.transform = 'translateY(-10em)';
        }, 1200);

        // Phase 3 (3.8s): Hundreds digit slides in, showing "1"
        setTimeout(() => {
            if (hundreds) hundreds.classList.add('visible');
            if (d1) d1.style.transform = 'translateY(-1em)';
        }, 3800);

        // Phase 4 (5.5s): Fade out preloader
        setTimeout(() => {
            preloader.classList.add('done');
        }, 5500);

        // Cleanup DOM
        setTimeout(() => {
            preloader.remove();
        }, 6200);
    }

    // ----------------------------------------
    // 1. Initialize Lucide Icons (once)
    // ----------------------------------------
    lucide.createIcons();

    // ----------------------------------------
    // 2. Generate Background Blinds
    // ----------------------------------------
    const blindsContainer = document.getElementById('blinds');
    if (blindsContainer) {
        for (let i = 0; i < 12; i++) {
            const blind = document.createElement('div');
            blind.className = 'blind';
            blind.style.animationDelay = `${i * 0.05}s`;
            blindsContainer.appendChild(blind);
        }
    }

    // ----------------------------------------
    // 3. Custom Cursor
    // ----------------------------------------
    const dot = document.getElementById('cursor-dot');
    const outline = document.getElementById('cursor-outline');

    if (dot && outline) {
        window.addEventListener('mousemove', (e) => {
            dot.style.left = `${e.clientX}px`;
            dot.style.top = `${e.clientY}px`;
            outline.style.left = `${e.clientX}px`;
            outline.style.top = `${e.clientY}px`;
        });

        document.querySelectorAll('a, button, input, .interactive').forEach(el => {
            el.addEventListener('mouseenter', () => {
                outline.style.transform = 'scale(1.8)';
                outline.style.background = 'rgba(139, 92, 246, 0.1)';
            });
            el.addEventListener('mouseleave', () => {
                outline.style.transform = 'scale(1)';
                outline.style.background = 'transparent';
            });
        });
    }

    // ----------------------------------------
    // 4. Scroll Reveal Animation
    // ----------------------------------------
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('active');
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // ----------------------------------------
    // 5. Smooth Scroll for Navigation Links
    // ----------------------------------------
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const href = anchor.getAttribute('href');
            if (href === '#') return;
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
    });

    // ----------------------------------------
    // 6. Hero CTA Scroll
    // ----------------------------------------
    const heroCta = document.getElementById('hero-cta');
    if (heroCta) {
        heroCta.addEventListener('click', () => {
            document.querySelector('.extraction')?.scrollIntoView({ behavior: 'smooth' });
        });
    }

    // ----------------------------------------
    // 7. Process Button Binding
    // ----------------------------------------
    const processBtn = document.getElementById('process-btn');
    if (processBtn) {
        processBtn.addEventListener('click', startExtraction);
    }

    // ----------------------------------------
    // 8. Lazy Load Spline 3D
    // ----------------------------------------
    const splinePlaceholder = document.getElementById('spline-placeholder');
    if (splinePlaceholder) {
        const splineObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    splineObserver.disconnect();

                    // Load the Spline viewer script
                    const script = document.createElement('script');
                    script.type = 'module';
                    script.src = 'https://unpkg.com/@splinetool/viewer@1.12.61/build/spline-viewer.js';
                    document.head.appendChild(script);

                    // Set the url attribute so the scene loads
                    const viewer = document.getElementById('vortex-spline');
                    if (viewer) {
                        const sceneUrl = viewer.dataset.url;
                        if (sceneUrl) viewer.setAttribute('url', sceneUrl);

                        // Hide watermark once loaded
                        const hideSplineLogo = () => {
                            if (viewer.shadowRoot) {
                                const style = document.createElement('style');
                                style.textContent = '#logo { display: none !important; }';
                                viewer.shadowRoot.appendChild(style);
                            }
                        };
                        viewer.addEventListener('load', hideSplineLogo);
                    }
                }
            });
        }, { rootMargin: '200px' });
        splineObserver.observe(splinePlaceholder);
    }

    // ----------------------------------------
    // 9. Output Tab Switching
    // ----------------------------------------
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.code-output').forEach(o => o.classList.remove('active'));
            btn.classList.add('active');
            const target = document.getElementById(btn.dataset.tab);
            if (target) target.classList.add('active');
        });
    });

});

// ========================================
// Utilities
// ========================================

/**
 * Sanitizes text to prevent XSS when inserting via innerHTML.
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Updates the extraction viz status text.
 */
function setStatus(message) {
    const el = document.querySelector('.extraction-viz-status');
    if (el) el.textContent = `SYSTEM_STATUS: ${message}`;
}

// ========================================
// Dashboard Renderers
// ========================================

/**
 * Renders a grid of color swatches.
 * @param {string} containerId - Target element id.
 * @param {Array<{value:string, label:string}>} colors - Colors to display.
 */
function renderColorGrid(containerId, colors) {
    const container = document.getElementById(containerId);
    if (!container || !colors.length) return;
    container.innerHTML = colors.map(c => `
        <div class="color-item">
            <div class="color-swatch" style="background: ${escapeHtml(c.value)};"></div>
            <div class="color-info">
                <p>${escapeHtml(c.value)}</p>
                <span>${escapeHtml(c.label)}</span>
            </div>
        </div>
    `).join('');
}

/**
 * Renders typography token list.
 */
function renderTypography(sampled, scale) {
    const container = document.getElementById('typography-tokens');
    if (!container) return;

    // Collect unique font families
    const families = [...new Set(sampled.map(s => s.value?.fontFamily).filter(Boolean))];

    // Build scale rows
    const scaleRows = scale ? Object.entries(scale).map(([name, value]) =>
        `<div class="scale-row">
            <span class="scale-name">${escapeHtml(name)}</span>
            <span class="scale-value">${escapeHtml(value)}</span>
            <span class="scale-preview" style="font-size: ${escapeHtml(value)};">Aa</span>
        </div>`
    ).join('') : '';

    // Build family list
    const familyItems = families.slice(0, 8).map(f =>
        `<div class="typo-family">
            <span class="typo-family-name" style="font-family: ${escapeHtml(f)};">${escapeHtml(f)}</span>
        </div>`
    ).join('');

    container.innerHTML =
        (familyItems ? `<div class="typo-families"><h4>Famílias</h4>${familyItems}</div>` : '') +
        (scaleRows ? `<div class="typo-scale"><h4>Escala de Tamanhos</h4>${scaleRows}</div>` : '') +
        (!familyItems && !scaleRows ? '<p class="token-empty">Nenhum token tipográfico detectado.</p>' : '');
}

/**
 * Renders a scale (spacing or border-radius).
 */
function renderScale(containerId, scale, type) {
    const container = document.getElementById(containerId);
    if (!container || !scale || !Object.keys(scale).length) {
        if (container) container.innerHTML = '<p class="token-empty">Nenhum token detectado.</p>';
        return;
    }

    container.innerHTML = Object.entries(scale).map(([name, value]) => {
        const preview = type === 'spacing'
            ? `<div class="scale-bar" style="width: ${escapeHtml(value)}; min-width: 2px;"></div>`
            : `<div class="radius-preview" style="border-radius: ${escapeHtml(value)};"></div>`;
        return `<div class="scale-row">
            <span class="scale-name">${escapeHtml(name)}</span>
            <span class="scale-value">${escapeHtml(value)}</span>
            ${preview}
        </div>`;
    }).join('');
}

/**
 * Renders code output blocks.
 */
function renderCodeOutputs(css, tailwind) {
    const cssEl = document.querySelector('#css-output code');
    const twEl = document.querySelector('#tailwind-output code');
    if (cssEl) cssEl.textContent = css || '/* Nenhum token extraído */';
    if (twEl) twEl.textContent = tailwind || '// Nenhum token extraído';
}

/**
 * Populates the entire dashboard with extraction data.
 */
function populateDashboard(data) {
    const { json, css, tailwind } = data;
    const tokens = json?.tokens;
    if (!tokens) return;

    // --- Semantic Colors ---
    const semantic = tokens.color?.semantic || {};
    const semanticLabels = {
        primary: 'Primary', secondary: 'Secondary', accent: 'Accent',
        background: 'Background', text: 'Text', border: 'Border',
        success: 'Success', error: 'Error', warning: 'Warning', info: 'Info'
    };
    const semanticColors = Object.entries(semantic)
        .filter(([, v]) => v)
        .map(([key, value]) => ({ value, label: semanticLabels[key] || key }));
    renderColorGrid('semantic-colors', semanticColors);

    // --- Solid Colors (top 18) ---
    const solidColors = (tokens.color?.solid || [])
        .slice(0, 18)
        .map((c, i) => ({ value: c.value, label: `×${c.count}` }));
    renderColorGrid('solid-colors', solidColors);

    // --- Typography ---
    renderTypography(tokens.typography?.sampled || [], tokens.typography?.scale);

    // --- Spacing ---
    renderScale('spacing-tokens', tokens.spacing?.scale, 'spacing');

    // --- Border Radius ---
    renderScale('radius-tokens', tokens.borderRadius?.scale, 'radius');

    // --- Code Outputs ---
    renderCodeOutputs(css, tailwind);
}

// ========================================
// Extraction & Analysis
// ========================================

async function startExtraction() {
    const urlInput = document.getElementById('url-input');
    const btn = document.getElementById('process-btn');
    const btnText = btn?.querySelector('.btn-text');
    const icon = document.getElementById('loader-icon');
    const tokensSection = document.getElementById('tokens-section');
    const resultArea = document.getElementById('ai-result');

    // Validate input
    if (!urlInput || !urlInput.value.trim()) {
        if (urlInput) {
            urlInput.style.borderColor = 'var(--accent-violet)';
            setTimeout(() => { urlInput.style.borderColor = ''; }, 2000);
        }
        return;
    }

    const url = urlInput.value.trim();

    // Loading state
    if (icon) icon.classList.add('animate-spin');
    if (btnText) btnText.innerText = 'Extraindo tokens...';
    if (btn) btn.disabled = true;
    if (resultArea) resultArea.classList.remove('ai-active');
    if (tokensSection) tokensSection.style.display = 'none';
    setStatus('EXTRACTING');

    try {
        // ——— Step 1: Extract real tokens via Playwright ———
        const extractRes = await fetch('/api/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, fast: true })
        });
        const extractData = await extractRes.json();

        if (!extractData.success) throw new Error(extractData.error);

        // Populate dashboard with real tokens
        populateDashboard(extractData.data);
        setStatus('TOKENS_READY');

        // Show tokens dashboard
        if (tokensSection) {
            tokensSection.style.display = 'block';
            tokensSection.scrollIntoView({ behavior: 'smooth' });
        }

        // ——— Step 2: AI analysis (non-blocking) ———
        if (btnText) btnText.innerText = 'Analisando com IA...';
        setStatus('ANALYZING');

        try {
            const geminiRes = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const geminiData = await geminiRes.json();

            if (geminiData.success && resultArea) {
                resultArea.innerHTML =
                    '<strong>Análise IA Finalizada:</strong><br><br>' +
                    escapeHtml(geminiData.data).replace(/\n/g, '<br>');
                resultArea.classList.add('ai-active');
            }
        } catch (aiErr) {
            // AI failure is non-critical — tokens are already shown
            console.warn('Gemini analysis failed:', aiErr.message);
        }

        setStatus('COMPLETE');

        // Re-initialize icons in newly visible sections
        lucide.createIcons();

    } catch (err) {
        setStatus('ERROR');
        if (resultArea) {
            resultArea.innerHTML =
                '<strong>Erro na extração:</strong> ' +
                escapeHtml(err.message || 'Não foi possível extrair tokens da URL informada.');
            resultArea.classList.add('ai-active');
        }
    } finally {
        if (icon) icon.classList.remove('animate-spin');
        if (btnText) btnText.innerText = 'Executar Motor de Análise';
        if (btn) btn.disabled = false;
    }
}
