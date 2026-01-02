#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const { extractTokensFromUrl } = require('../src/extractTokens');

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

function resolveOutPath({ outArg, normalizedUrl }) {
    const hostname = sanitizeFilenamePart(new URL(normalizedUrl).hostname);
    const defaultName = `${hostname || 'site'}-extract.json`;

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

function parseArgs(argv) {
    const args = { url: null, out: null, maxElements: 2000, interactions: true, fast: false };

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
                '  extract-tokens --url <https://example.com> [--out <path-or-dir>] [--max-elements 2000] [--no-interactions] [--fast]',
                '',
                'Options:',
                '  --url, -u            Target URL (required)',
                '  --out, -o            Output file path OR directory (default: <hostname>-extract.json)',
                '  --max-elements       Max DOM elements sampled for computed styles (default: 2000)',
                '  --no-interactions    Disable hover/click/scroll probing for motion tokens',
                '  --fast               Faster mode: fewer sampled elements, blocks heavy resources, disables interactions by default',
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

    const outPath = resolveOutPath({ outArg: args.out, normalizedUrl });
    const tmpPath = `${outPath}.tmp`;

    if (interrupted) process.exit(130);

    const result = await extractTokensFromUrl({
        url: normalizedUrl,
        maxElements: effectiveMaxElements,
        enableInteractions: effectiveInteractions,
        fast: Boolean(args.fast)
    });

    if (interrupted) process.exit(130);

    fs.writeFileSync(tmpPath, JSON.stringify(result, null, 2), 'utf8');
    fs.renameSync(tmpPath, outPath);
    process.stdout.write(`Wrote ${outPath}\n`);

    process.removeListener('SIGINT', onSigint);
}

main().catch((err) => {
    process.stderr.write(`${err && err.stack ? err.stack : String(err)}\n`);
    process.exit(1);
});
