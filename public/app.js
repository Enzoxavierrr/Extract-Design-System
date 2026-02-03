// ========================================
// Design Token Extractor - Frontend App
// ========================================

class DesignTokenExtractor {
    constructor() {
        this.data = null;
        this.init();
    }

    init() {
        // DOM Elements
        this.form = document.getElementById('extractForm');
        this.urlInput = document.getElementById('urlInput');
        this.extractBtn = document.getElementById('extractBtn');
        this.fastMode = document.getElementById('fastMode');
        this.progressContainer = document.getElementById('progressContainer');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.resultsSection = document.getElementById('resultsSection');
        this.errorMessage = document.getElementById('errorMessage');
        this.errorText = document.getElementById('errorText');
        this.retryBtn = document.getElementById('retryBtn');

        // Stats elements
        this.colorCount = document.getElementById('colorCount');
        this.fontCount = document.getElementById('fontCount');
        this.spacingCount = document.getElementById('spacingCount');
        this.animationCount = document.getElementById('animationCount');

        // Output elements
        this.jsonOutput = document.getElementById('jsonOutput');
        this.cssOutput = document.getElementById('cssOutput');
        this.tailwindOutput = document.getElementById('tailwindOutput');
        this.colorGrid = document.getElementById('colorGrid');

        // Bind events
        this.bindEvents();
    }

    bindEvents() {
        // Form submit
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.extract();
        });

        // Retry button
        this.retryBtn.addEventListener('click', () => {
            this.hideError();
            this.urlInput.focus();
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Copy buttons
        document.querySelectorAll('.btn-copy').forEach(btn => {
            btn.addEventListener('click', () => this.copyCode(btn.dataset.copy));
        });

        // Download buttons
        document.querySelectorAll('.btn-download').forEach(btn => {
            btn.addEventListener('click', () => this.download(btn.dataset.format));
        });

        // URL input validation styling
        this.urlInput.addEventListener('input', () => {
            if (this.urlInput.value && !this.isValidUrl(this.urlInput.value)) {
                this.urlInput.style.color = '#ef4444';
            } else {
                this.urlInput.style.color = '';
            }
        });
    }

    isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    async extract() {
        const url = this.urlInput.value.trim();

        if (!this.isValidUrl(url)) {
            this.showError('Por favor, insira uma URL válida (ex: https://example.com)');
            return;
        }

        // Start loading state
        this.startLoading();

        try {
            const response = await fetch('/api/extract', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: url,
                    fast: this.fastMode.checked,
                    maxElements: 1000
                })
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Erro desconhecido');
            }

            this.data = result.data;
            this.showResults();

        } catch (error) {
            console.error('Extraction error:', error);
            this.showError(error.message || 'Falha ao extrair tokens. Tente novamente.');
        } finally {
            this.stopLoading();
        }
    }

    startLoading() {
        this.extractBtn.classList.add('loading');
        this.extractBtn.disabled = true;
        this.progressContainer.classList.add('active');
        this.resultsSection.classList.remove('active');
        this.hideError();

        // Animate progress
        this.animateProgress();
    }

    stopLoading() {
        this.extractBtn.classList.remove('loading');
        this.extractBtn.disabled = false;
        this.progressContainer.classList.remove('active');
        this.progressFill.style.width = '0%';
    }

    animateProgress() {
        const messages = [
            'Conectando ao site...',
            'Carregando página...',
            'Analisando elementos...',
            'Extraindo cores...',
            'Extraindo tipografia...',
            'Extraindo espaçamentos...',
            'Capturando animações...',
            'Processando tokens...',
            'Quase lá...'
        ];

        let progress = 0;
        let messageIndex = 0;

        const interval = setInterval(() => {
            if (!this.progressContainer.classList.contains('active')) {
                clearInterval(interval);
                return;
            }

            progress += Math.random() * 15;
            if (progress > 90) progress = 90;

            this.progressFill.style.width = `${progress}%`;

            if (progress > (messageIndex + 1) * 10 && messageIndex < messages.length - 1) {
                messageIndex++;
                this.progressText.textContent = messages[messageIndex];
            }
        }, 500);
    }

    showResults() {
        const json = this.data.json;

        // Update stats
        const colorCount = (json.tokens.color.solid?.length || 0) +
            (json.tokens.color.gradients?.length || 0);
        const fontCount = json.tokens.typography.sampled?.length || 0;
        const spacingCount = json.tokens.spacing.sampled?.length || 0;
        const animationCount = (json.tokens.motion.transitions?.length || 0) +
            (json.tokens.motion.animations?.length || 0);

        this.animateNumber(this.colorCount, colorCount);
        this.animateNumber(this.fontCount, fontCount);
        this.animateNumber(this.spacingCount, spacingCount);
        this.animateNumber(this.animationCount, animationCount);

        // Render color swatches
        this.renderColorSwatches(json.tokens.color);

        // Update code outputs
        this.jsonOutput.textContent = JSON.stringify(json, null, 2);
        this.cssOutput.textContent = this.data.css;
        this.tailwindOutput.textContent = this.data.tailwind;

        // Show results section
        this.resultsSection.classList.add('active');

        // Scroll to results
        setTimeout(() => {
            this.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
    }

    animateNumber(element, target) {
        const duration = 1000;
        const start = 0;
        const startTime = performance.now();

        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start + (target - start) * easeOut);

            element.textContent = current;

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };

        requestAnimationFrame(update);
    }

    renderColorSwatches(colorData) {
        this.colorGrid.innerHTML = '';

        // Semantic colors first
        if (colorData.semantic) {
            Object.entries(colorData.semantic).forEach(([name, value]) => {
                this.addColorSwatch(value, name);
            });
        }

        // Then solid colors
        if (colorData.solid) {
            colorData.solid.slice(0, 20).forEach(color => {
                if (!this.isTransparent(color.value)) {
                    this.addColorSwatch(color.value);
                }
            });
        }
    }

    addColorSwatch(color, label = null) {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = color;
        swatch.setAttribute('data-tooltip', label ? `${label}: ${color}` : color);
        swatch.addEventListener('click', () => this.copyToClipboard(color));
        this.colorGrid.appendChild(swatch);
    }

    isTransparent(color) {
        return color.includes('rgba') && color.includes(', 0)') ||
            color === 'transparent' ||
            color === 'rgba(0, 0, 0, 0)';
    }

    switchTab(tabId) {
        // Update buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        // Update panels
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `tab-${tabId}`);
        });
    }

    async copyCode(format) {
        let content = '';
        switch (format) {
            case 'json':
                content = JSON.stringify(this.data.json, null, 2);
                break;
            case 'css':
                content = this.data.css;
                break;
            case 'tailwind':
                content = this.data.tailwind;
                break;
        }

        const btn = document.querySelector(`[data-copy="${format}"]`);
        await this.copyToClipboard(content, btn);
    }

    async copyToClipboard(text, button = null) {
        try {
            await navigator.clipboard.writeText(text);

            if (button) {
                const originalText = button.querySelector('span').textContent;
                button.classList.add('copied');
                button.querySelector('span').textContent = 'Copied!';

                setTimeout(() => {
                    button.classList.remove('copied');
                    button.querySelector('span').textContent = originalText;
                }, 2000);
            }
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }

    download(format) {
        let content = '';
        let filename = '';
        let mimeType = '';

        const hostname = new URL(this.data.json.meta.url).hostname.replace(/\./g, '-');

        switch (format) {
            case 'json':
                content = JSON.stringify(this.data.json, null, 2);
                filename = `${hostname}-tokens.json`;
                mimeType = 'application/json';
                break;
            case 'css':
                content = this.data.css;
                filename = `${hostname}-tokens.css`;
                mimeType = 'text/css';
                break;
            case 'tailwind':
                content = this.data.tailwind;
                filename = `${hostname}-tailwind.config.js`;
                mimeType = 'text/javascript';
                break;
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    showError(message) {
        this.errorText.textContent = message;
        this.errorMessage.classList.add('active');
        this.resultsSection.classList.remove('active');
    }

    hideError() {
        this.errorMessage.classList.remove('active');
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    new DesignTokenExtractor();
});
