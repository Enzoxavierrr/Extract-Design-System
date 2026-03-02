const { validateUrl } = require('../src/utils/validators');

describe('validateUrl', () => {

    // --- URLs válidas ---
    test('aceita URL http completa', () => {
        expect(validateUrl('http://example.com')).toBe('http://example.com/');
    });

    test('aceita URL https completa', () => {
        expect(validateUrl('https://example.com')).toBe('https://example.com/');
    });

    test('aceita URL com path', () => {
        expect(validateUrl('https://example.com/page/test')).toBe('https://example.com/page/test');
    });

    test('aceita URL com query string', () => {
        expect(validateUrl('https://example.com?q=test&lang=pt')).toBe('https://example.com/?q=test&lang=pt');
    });

    test('aceita URL com porta', () => {
        expect(validateUrl('http://localhost:3000')).toBe('http://localhost:3000/');
    });

    test('aceita URL com fragmento', () => {
        expect(validateUrl('https://example.com/page#section')).toBe('https://example.com/page#section');
    });

    // --- URLs inválidas ---
    test('retorna null para null', () => {
        expect(validateUrl(null)).toBeNull();
    });

    test('retorna null para undefined', () => {
        expect(validateUrl(undefined)).toBeNull();
    });

    test('retorna null para string vazia', () => {
        expect(validateUrl('')).toBeNull();
    });

    test('retorna null para texto aleatório', () => {
        expect(validateUrl('not a url')).toBeNull();
    });

    test('retorna null para protocolo ftp', () => {
        expect(validateUrl('ftp://files.example.com')).toBeNull();
    });

    test('retorna null para protocolo file', () => {
        expect(validateUrl('file:///etc/passwd')).toBeNull();
    });

    test('retorna null para javascript:', () => {
        expect(validateUrl('javascript:alert(1)')).toBeNull();
    });

    test('retorna null para data:', () => {
        expect(validateUrl('data:text/html,<h1>xss</h1>')).toBeNull();
    });
});
