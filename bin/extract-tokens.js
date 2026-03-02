#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const { extractTokensFromUrl } = require('../src/core/extractTokens');

function validateUrl(input) {
    if (!input) return null;
    try {
        const u = new URL(input);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        return u.toString();
    } catch (e) {
        return null;
    }
}

function sanitizeFilenamePart(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/[^a-z0-9.-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 120);
}

function resolveOutPath({ outArg, normalizedUrl, extension = '.json' }) {
    const hostname = sanitizeFilenamePart(new URL(normalizedUrl).hostname);
    const defaultName = `${hostname || 'site'}-extract${extension}`;

    if (!outArg) return path.join(process.cwd(), defaultName);

    const outCandidate = path.isAbsolute(outArg) ? outArg : path.join(process.cwd(), outArg);

    try {
        if (fs.existsSync(outCandidate) && fs.statSync(outCandidate).isDirectory()) {
            return path.join(outCandidate, defaultName);
        }
    } catch (e) {
        // ignore
    }

    if (outCandidate.endsWith(path.sep)) {
        return path.join(outCandidate, defaultName);
    }

    return outCandidate;
}

// Gerar CSS Custom Properties a partir dos tokens
function generateCssCustomProperties(result) {
    const lines = [];
    lines.push('/* Design Tokens - CSS Custom Properties */');
    lines.push(`/* Extracted from: ${result.meta.url} */`);
    lines.push(`/* Generated at: ${result.meta.extractedAt} */`);
    lines.push('');
    lines.push(':root {');

    // Cores semânticas
    if (result.tokens.color.semantic) {
        lines.push('  /* Semantic Colors */');
        for (const [name, value] of Object.entries(result.tokens.color.semantic)) {
            lines.push(`  --color-${name}: ${value};`);
        }
        lines.push('');
    }

    // Cores das variáveis root originais
    if (Object.keys(result.tokens.color.rootVariables).length > 0) {
        lines.push('  /* Original Root Variables */');
        for (const [name, value] of Object.entries(result.tokens.color.rootVariables)) {
            lines.push(`  ${name}: ${value};`);
        }
        lines.push('');
    }

    // Cores sólidas mais usadas
    if (result.tokens.color.solid && result.tokens.color.solid.length > 0) {
        lines.push('  /* Top Colors */');
        result.tokens.color.solid.slice(0, 10).forEach((color, i) => {
            lines.push(`  --color-${i + 1}: ${color.value};`);
        });
        lines.push('');
    }

    // Escala de tipografia
    if (result.tokens.typography.scale && Object.keys(result.tokens.typography.scale).length > 0) {
        lines.push('  /* Font Size Scale */');
        for (const [name, value] of Object.entries(result.tokens.typography.scale)) {
            lines.push(`  --font-size-${name}: ${value};`);
        }
        lines.push('');
    }

    // Escala de espaçamento
    if (result.tokens.spacing.scale && Object.keys(result.tokens.spacing.scale).length > 0) {
        lines.push('  /* Spacing Scale */');
        for (const [name, value] of Object.entries(result.tokens.spacing.scale)) {
            lines.push(`  --spacing-${name}: ${value};`);
        }
        lines.push('');
    }

    // Escala de border-radius
    if (result.tokens.borderRadius.scale && Object.keys(result.tokens.borderRadius.scale).length > 0) {
        lines.push('  /* Border Radius Scale */');
        for (const [name, value] of Object.entries(result.tokens.borderRadius.scale)) {
            lines.push(`  --radius-${name}: ${value};`);
        }
        lines.push('');
    }

    // Shadows
    if (result.tokens.color.shadows && result.tokens.color.shadows.length > 0) {
        lines.push('  /* Shadows */');
        result.tokens.color.shadows.slice(0, 5).forEach((shadow, i) => {
            lines.push(`  --shadow-${i + 1}: ${shadow.value};`);
        });
        lines.push('');
    }

    // Transições mais usadas
    if (result.tokens.motion.transitions && result.tokens.motion.transitions.length > 0) {
        lines.push('  /* Transitions */');
        result.tokens.motion.transitions.slice(0, 5).forEach((transition, i) => {
            const t = transition.value;
            lines.push(`  --transition-${i + 1}: ${t.transitionProperty} ${t.transitionDuration} ${t.transitionTimingFunction};`);
        });
    }

    lines.push('}');

    return lines.join('\n');
}

// Gerar configuração Tailwind CSS
function generateTailwindConfig(result) {
    const config = {
        theme: {
            extend: {}
        }
    };

    // Cores
    if (result.tokens.color.semantic) {
        config.theme.extend.colors = {};
        for (const [name, value] of Object.entries(result.tokens.color.semantic)) {
            config.theme.extend.colors[name] = value;
        }
    }

    // Font sizes
    if (result.tokens.typography.scale && Object.keys(result.tokens.typography.scale).length > 0) {
        config.theme.extend.fontSize = result.tokens.typography.scale;
    }

    // Spacing
    if (result.tokens.spacing.scale && Object.keys(result.tokens.spacing.scale).length > 0) {
        config.theme.extend.spacing = result.tokens.spacing.scale;
    }

    // Border radius
    if (result.tokens.borderRadius.scale && Object.keys(result.tokens.borderRadius.scale).length > 0) {
        config.theme.extend.borderRadius = result.tokens.borderRadius.scale;
    }

    // Box shadow
    if (result.tokens.color.shadows && result.tokens.color.shadows.length > 0) {
        config.theme.extend.boxShadow = {};
        result.tokens.color.shadows.slice(0, 5).forEach((shadow, i) => {
            config.theme.extend.boxShadow[`custom-${i + 1}`] = shadow.value;
        });
    }

    const output = [
        `/** @type {import('tailwindcss').Config} */`,
        `// Design Tokens extracted from: ${result.meta.url}`,
        `// Generated at: ${result.meta.extractedAt}`,
        '',
        `module.exports = ${JSON.stringify(config, null, 2)};`
    ].join('\n');

    return output;
}

function parseArgs(argv) {
    const args = {
        url: null,
        out: null,
        maxElements: 2000,
        interactions: true,
        fast: false,
        format: 'json' // json, css, tailwind, all
    };

    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--url' || a === '-u') {
            args.url = argv[i + 1];
            i++;
            continue;
        }
        if (a === '--out' || a === '-o') {
            args.out = argv[i + 1];
            i++;
            continue;
        }
        if (a === '--max-elements') {
            args.maxElements = Number(argv[i + 1]);
            i++;
            continue;
        }
        if (a === '--format' || a === '-f') {
            const format = argv[i + 1];
            if (['json', 'css', 'tailwind', 'all'].includes(format)) {
                args.format = format;
            }
            i++;
            continue;
        }
        if (a === '--no-interactions') {
            args.interactions = false;
            continue;
        }
        if (a === '--fast') {
            args.fast = true;
            continue;
        }
        if (a === '--help' || a === '-h') {
            args.help = true;
            continue;
        }
    }

    return args;
}

async function main() {
    const args = parseArgs(process.argv);

    const normalizedUrl = validateUrl(args.url);

    let interrupted = false;
    const onSigint = () => {
        interrupted = true;
        process.stderr.write('Interrupted (SIGINT). Exiting...\n');
    };
    process.once('SIGINT', onSigint);

    if (args.help || !args.url) {
        process.stdout.write(
            [
                'Usage:',
                '  extract-tokens --url <https://example.com> [options]',
                '',
                'Options:',
                '  --url, -u            Target URL (required)',
                '  --out, -o            Output file path OR directory (default: <hostname>-extract.<ext>)',
                '  --format, -f         Output format: json, css, tailwind, all (default: json)',
                '  --max-elements       Max DOM elements sampled for computed styles (default: 2000)',
                '  --no-interactions    Disable hover/click/scroll probing for motion tokens',
                '  --fast               Faster mode: fewer sampled elements, blocks heavy resources',
                '',
                'Output Formats:',
                '  json      Full token extraction as JSON (default)',
                '  css       CSS Custom Properties (:root variables)',
                '  tailwind  Tailwind CSS configuration file',
                '  all       Generate all formats',
                ''
            ].join('\n')
        );
        process.exit(args.help ? 0 : 1);
    }

    if (!normalizedUrl) {
        process.stderr.write(
            [
                'Invalid --url value.',
                `Received: ${String(args.url)}`,
                'Expected a full URL like: https://www.example.com/',
                ''
            ].join('\n')
        );
        process.exit(1);
    }

    if (interrupted) process.exit(130);

    const effectiveInteractions = args.fast ? false : args.interactions;
    const effectiveMaxElements = args.fast ? Math.min(args.maxElements, 700) : args.maxElements;

    if (interrupted) process.exit(130);

    process.stdout.write(`Extracting tokens from ${normalizedUrl}...\n`);

    const result = await extractTokensFromUrl({
        url: normalizedUrl,
        maxElements: effectiveMaxElements,
        enableInteractions: effectiveInteractions,
        fast: Boolean(args.fast)
    });

    if (interrupted) process.exit(130);

    const hostname = sanitizeFilenamePart(new URL(normalizedUrl).hostname);
    const baseDir = args.out && fs.existsSync(args.out) && fs.statSync(args.out).isDirectory()
        ? args.out
        : process.cwd();

    const outputs = [];

    // JSON output
    if (args.format === 'json' || args.format === 'all') {
        const jsonPath = args.format === 'json' && args.out && !fs.existsSync(args.out)
            ? (path.isAbsolute(args.out) ? args.out : path.join(process.cwd(), args.out))
            : path.join(baseDir, `${hostname}-extract.json`);
        const tmpPath = `${jsonPath}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(result, null, 2), 'utf8');
        fs.renameSync(tmpPath, jsonPath);
        outputs.push(jsonPath);
    }

    // CSS output
    if (args.format === 'css' || args.format === 'all') {
        const cssPath = args.format === 'css' && args.out && !fs.existsSync(args.out)
            ? (path.isAbsolute(args.out) ? args.out : path.join(process.cwd(), args.out))
            : path.join(baseDir, `${hostname}-tokens.css`);
        const cssContent = generateCssCustomProperties(result);
        fs.writeFileSync(cssPath, cssContent, 'utf8');
        outputs.push(cssPath);
    }

    // Tailwind output
    if (args.format === 'tailwind' || args.format === 'all') {
        const twPath = args.format === 'tailwind' && args.out && !fs.existsSync(args.out)
            ? (path.isAbsolute(args.out) ? args.out : path.join(process.cwd(), args.out))
            : path.join(baseDir, `${hostname}-tailwind.config.js`);
        const twContent = generateTailwindConfig(result);
        fs.writeFileSync(twPath, twContent, 'utf8');
        outputs.push(twPath);
    }

    process.stdout.write(`\nGenerated files:\n`);
    outputs.forEach(p => process.stdout.write(`  → ${p}\n`));

    process.removeListener('SIGINT', onSigint);
}

main().catch((err) => {
    process.stderr.write(`${err && err.stack ? err.stack : String(err)}\n`);
    process.exit(1);
});
