// Gerar CSS Custom Properties
function generateCssCustomProperties(result) {
    const lines = [];
    lines.push('/* Design Tokens - CSS Custom Properties */');
    lines.push(`/* Extracted from: ${result.meta.url} */`);
    lines.push(`/* Generated at: ${result.meta.extractedAt} */`);
    lines.push('');
    lines.push(':root {');

    if (result.tokens.color.semantic) {
        lines.push('  /* Semantic Colors */');
        for (const [name, value] of Object.entries(result.tokens.color.semantic)) {
            lines.push(`  --color-${name}: ${value};`);
        }
        lines.push('');
    }

    if (Object.keys(result.tokens.color.rootVariables).length > 0) {
        lines.push('  /* Original Root Variables */');
        for (const [name, value] of Object.entries(result.tokens.color.rootVariables)) {
            lines.push(`  ${name}: ${value};`);
        }
        lines.push('');
    }

    if (result.tokens.color.solid && result.tokens.color.solid.length > 0) {
        lines.push('  /* Top Colors */');
        result.tokens.color.solid.slice(0, 10).forEach((color, i) => {
            lines.push(`  --color-${i + 1}: ${color.value};`);
        });
        lines.push('');
    }

    if (result.tokens.typography.scale && Object.keys(result.tokens.typography.scale).length > 0) {
        lines.push('  /* Font Size Scale */');
        for (const [name, value] of Object.entries(result.tokens.typography.scale)) {
            lines.push(`  --font-size-${name}: ${value};`);
        }
        lines.push('');
    }

    if (result.tokens.spacing.scale && Object.keys(result.tokens.spacing.scale).length > 0) {
        lines.push('  /* Spacing Scale */');
        for (const [name, value] of Object.entries(result.tokens.spacing.scale)) {
            lines.push(`  --spacing-${name}: ${value};`);
        }
        lines.push('');
    }

    if (result.tokens.borderRadius.scale && Object.keys(result.tokens.borderRadius.scale).length > 0) {
        lines.push('  /* Border Radius Scale */');
        for (const [name, value] of Object.entries(result.tokens.borderRadius.scale)) {
            lines.push(`  --radius-${name}: ${value};`);
        }
        lines.push('');
    }

    if (result.tokens.color.shadows && result.tokens.color.shadows.length > 0) {
        lines.push('  /* Shadows */');
        result.tokens.color.shadows.slice(0, 5).forEach((shadow, i) => {
            lines.push(`  --shadow-${i + 1}: ${shadow.value};`);
        });
        lines.push('');
    }

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

    if (result.tokens.color.semantic) {
        config.theme.extend.colors = {};
        for (const [name, value] of Object.entries(result.tokens.color.semantic)) {
            config.theme.extend.colors[name] = value;
        }
    }

    if (result.tokens.typography.scale && Object.keys(result.tokens.typography.scale).length > 0) {
        config.theme.extend.fontSize = result.tokens.typography.scale;
    }

    if (result.tokens.spacing.scale && Object.keys(result.tokens.spacing.scale).length > 0) {
        config.theme.extend.spacing = result.tokens.spacing.scale;
    }

    if (result.tokens.borderRadius.scale && Object.keys(result.tokens.borderRadius.scale).length > 0) {
        config.theme.extend.borderRadius = result.tokens.borderRadius.scale;
    }

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

module.exports = { generateCssCustomProperties, generateTailwindConfig };
