/**
 * In-memory rate limiter (sliding window per IP).
 * No external dependencies — suitable for single-instance deployments.
 *
 * @param {Object} opts
 * @param {number} opts.windowMs  - Time window in milliseconds (default: 60 000)
 * @param {number} opts.maxHits   - Max requests per window (default: 5)
 * @param {string} opts.message   - Error message returned to client
 * @returns {Function} Express middleware
 */
function rateLimiter({ windowMs = 60_000, maxHits = 5, message } = {}) {
    const hits = new Map(); // ip → [timestamp, ...]

    // Cleanup stale entries every 2 minutes to avoid memory leaks
    const cleanup = setInterval(() => {
        const now = Date.now();
        for (const [ip, timestamps] of hits) {
            const valid = timestamps.filter(t => now - t < windowMs);
            if (valid.length === 0) hits.delete(ip);
            else hits.set(ip, valid);
        }
    }, 120_000);
    cleanup.unref(); // don't keep process alive just for cleanup

    return (req, res, next) => {
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        const now = Date.now();

        // Get existing timestamps and filter to current window
        const timestamps = (hits.get(ip) || []).filter(t => now - t < windowMs);

        if (timestamps.length >= maxHits) {
            const retryAfter = Math.ceil((timestamps[0] + windowMs - now) / 1000);
            res.set('Retry-After', String(retryAfter));
            return res.status(429).json({
                error: message || 'Too many requests. Please try again later.',
                retryAfterSeconds: retryAfter,
            });
        }

        timestamps.push(now);
        hits.set(ip, timestamps);

        // Expose headers for client awareness
        res.set('X-RateLimit-Limit', String(maxHits));
        res.set('X-RateLimit-Remaining', String(maxHits - timestamps.length));

        next();
    };
}

module.exports = { rateLimiter };
