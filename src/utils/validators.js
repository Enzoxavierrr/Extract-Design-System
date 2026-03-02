// Utility para validar URL
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

module.exports = { validateUrl };
