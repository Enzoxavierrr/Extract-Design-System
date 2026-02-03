# Agent Design System

Agente automatizado para extração de tokens de design system de sites web. Este agente utiliza Playwright para navegar até uma URL, analisar estilos CSS computados e extrair tokens de design organizados em categorias: cores, tipografia, espaçamentos, border-radius e animações.

## 📋 Índice

- [Instalação](#instalação)
- [Uso Básico](#uso-básico)
- [Opções Disponíveis](#opções-disponíveis)
- [Formatos de Output](#formatos-de-output)
- [Estrutura do Output](#estrutura-do-output)
- [Exemplos](#exemplos)
- [Como Funciona](#como-funciona)

## 🚀 Instalação

### Pré-requisitos

- Node.js (versão 14 ou superior)
- npm ou yarn

### Passos

1. Clone ou baixe este repositório
2. Instale as dependências:

```bash
npm install
```

O script `postinstall` irá instalar automaticamente os navegadores do Playwright.

## 💻 Uso Básico

### Comando Principal

```bash
npm run extract -- --url <URL>
```

Ou usando o binário diretamente:

```bash
npx extract-tokens --url <URL>
```

### Exemplo Simples

```bash
npm run extract -- --url https://www.example.com
```

Isso irá gerar um arquivo JSON com o nome baseado no hostname (ex: `example.com-extract.json`) no diretório atual.

## ⚙️ Opções Disponíveis

### `--url` ou `-u` (obrigatório)

URL do site a ser analisado. Deve ser uma URL completa com protocolo (http:// ou https://).

```bash
npm run extract -- --url https://www.example.com
```

### `--out` ou `-o` (opcional)

Caminho do arquivo de saída ou diretório. Se for um diretório, o arquivo será nomeado automaticamente.

**Valores padrão:**
- Se não especificado: `<hostname>-extract.<ext>` no diretório atual
- Se for um diretório: arquivos nomeados automaticamente dentro do diretório

**Exemplos:**

```bash
# Arquivo específico
npm run extract -- --url https://example.com --out ./tokens/design-tokens.json

# Diretório (arquivo será nomeado automaticamente)
npm run extract -- --url https://example.com --out ./tokens/
```

### `--format` ou `-f` (opcional)

Formato de saída dos tokens. **Valor padrão:** `json`

| Formato | Descrição |
|---------|-----------|
| `json` | Extração completa em JSON (padrão) |
| `css` | CSS Custom Properties (variáveis :root) |
| `tailwind` | Arquivo de configuração Tailwind CSS |
| `all` | Gera todos os formatos acima |

**Exemplos:**

```bash
# Gerar apenas CSS
npm run extract -- --url https://example.com --format css

# Gerar configuração Tailwind
npm run extract -- --url https://example.com --format tailwind

# Gerar todos os formatos
npm run extract -- --url https://example.com --format all
```

### `--max-elements` (opcional)

Número máximo de elementos DOM a serem analisados para estilos computados.

**Valor padrão:** `2000`

```bash
npm run extract -- --url https://example.com --max-elements 5000
```

**Nota:** Em modo `--fast`, este valor é automaticamente limitado a 700.

### `--no-interactions` (opcional)

Desabilita as interações automáticas (hover, click, scroll) que são usadas para capturar tokens de animação e transição.

```bash
npm run extract -- --url https://example.com --no-interactions
```

### `--fast` (opcional)

Modo rápido que otimiza a extração:

- Limita elementos amostrados a 700
- Bloqueia recursos pesados (imagens, mídia, fontes)
- Desabilita interações por padrão
- Usa `domcontentloaded` em vez de `load`
- Reduz timeouts e delays

```bash
npm run extract -- --url https://example.com --fast
```

### `--help` ou `-h`

Exibe a ajuda com todas as opções disponíveis.

```bash
npm run extract -- --help
```

## 📁 Formatos de Output

### JSON (padrão)

Extração completa com todos os tokens organizados por categoria. Ideal para processamento programático.

```bash
npm run extract -- --url https://example.com --format json
# Output: example.com-extract.json
```

### CSS Custom Properties

Gera um arquivo CSS com variáveis `:root` prontas para uso:

```bash
npm run extract -- --url https://example.com --format css
# Output: example.com-tokens.css
```

**Exemplo de output:**
```css
:root {
  /* Semantic Colors */
  --color-primary: rgb(24, 80, 225);
  --color-secondary: rgb(0, 0, 0);
  --color-background: rgb(250, 252, 252);
  --color-text: rgb(0, 0, 0);
  
  /* Font Size Scale */
  --font-size-sm: 14px;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 24px;
  
  /* Spacing Scale */
  --spacing-0: 4px;
  --spacing-1: 8px;
  --spacing-2: 16px;
  --spacing-3: 24px;
  
  /* Border Radius Scale */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 16px;
}
```

### Tailwind CSS Config

Gera um arquivo de configuração Tailwind CSS com os tokens extraídos:

```bash
npm run extract -- --url https://example.com --format tailwind
# Output: example.com-tailwind.config.js
```

**Exemplo de output:**
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: "rgb(24, 80, 225)",
        secondary: "rgb(0, 0, 0)",
        background: "rgb(250, 252, 252)"
      },
      fontSize: {
        sm: "14px",
        base: "16px",
        lg: "18px"
      },
      spacing: {
        0: "4px",
        1: "8px",
        2: "16px"
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "16px"
      }
    }
  }
};
```

## 📊 Estrutura do Output (JSON)

```json
{
  "meta": {
    "url": "https://www.example.com",
    "extractedAt": "2025-12-25T15:00:28.500Z",
    "maxElements": 2000,
    "interactionsEnabled": true,
    "description": "Design tokens extraídos de https://www.example.com"
  },
  "tokens": {
    "color": {
      "rootVariables": {
        "--color-primary": "#0066cc"
      },
      "semantic": {
        "primary": "rgb(0, 102, 204)",
        "secondary": "rgb(51, 51, 51)",
        "accent": "rgb(255, 107, 107)",
        "background": "rgb(255, 255, 255)",
        "text": "rgb(0, 0, 0)",
        "border": "rgb(200, 200, 200)",
        "success": "rgb(40, 167, 69)",
        "error": "rgb(220, 53, 69)",
        "warning": "rgb(255, 193, 7)",
        "info": "rgb(23, 162, 184)"
      },
      "solid": [
        { "value": "rgb(0, 102, 204)", "count": 150 }
      ],
      "gradients": [
        { "value": "linear-gradient(...)", "count": 5 }
      ],
      "shadows": [
        { "value": "rgba(0, 0, 0, 0.1) 0px 4px 12px", "count": 20 }
      ]
    },
    "typography": {
      "scale": {
        "xs": "12px",
        "sm": "14px",
        "base": "16px",
        "md": "18px",
        "lg": "24px",
        "xl": "32px"
      },
      "sampled": [
        {
          "value": {
            "fontFamily": "Arial, sans-serif",
            "fontSize": "16px",
            "fontWeight": "400",
            "fontStyle": "normal",
            "lineHeight": "1.5",
            "letterSpacing": "0",
            "textTransform": "none"
          },
          "count": 45
        }
      ]
    },
    "spacing": {
      "scale": {
        "0": "4px",
        "1": "8px",
        "2": "16px",
        "3": "24px",
        "4": "32px"
      },
      "sampled": [
        { "value": "16px", "count": 120 }
      ]
    },
    "borderRadius": {
      "scale": {
        "sm": "4px",
        "md": "8px",
        "lg": "16px",
        "full": "9999px"
      },
      "sampled": [
        { "value": "8px", "count": 45 }
      ]
    },
    "motion": {
      "transitions": [
        {
          "value": {
            "transitionProperty": "all",
            "transitionDuration": "0.3s",
            "transitionTimingFunction": "ease",
            "transitionDelay": "0s"
          },
          "count": 30
        }
      ],
      "animations": [
        {
          "value": {
            "animationName": "fadeIn",
            "animationDuration": "0.5s",
            "animationTimingFunction": "ease-in-out"
          },
          "count": 10
        }
      ],
      "keyframes": [
        {
          "name": "fadeIn",
          "frames": [
            { "keyText": "0%", "style": "opacity: 0;" },
            { "keyText": "100%", "style": "opacity: 1;" }
          ]
        }
      ]
    }
  },
  "debug": {
    "rootVariablesOther": { "--spacing-unit": "8px" },
    "motionEventsSample": []
  }
}
```

### Descrição dos Campos

#### `meta`
- `url`: URL analisada
- `extractedAt`: Data e hora da extração (ISO 8601)
- `maxElements`: Número máximo de elementos analisados
- `interactionsEnabled`: Se as interações estavam habilitadas

#### `tokens.color`
- `rootVariables`: Variáveis CSS customizadas relacionadas a cores em `:root`
- `semantic`: Cores inferidas automaticamente com nomes semânticos
  - `primary`, `secondary`: Cores principais baseadas em frequência
  - `accent`: Cor vibrante de destaque (alta saturação)
  - `background`, `text`: Inferidas por luminância (WCAG)
  - `border`: Cor neutra para bordas
  - `success`, `error`, `warning`, `info`: Cores de status por matiz HSL
- `solid`: Cores sólidas mais frequentes
- `gradients`: Gradientes encontrados
- `shadows`: Box-shadows e text-shadows

#### `tokens.typography`
- `scale`: Escala de font-sizes organizada (xs, sm, base, md, lg, xl, etc.)
- `sampled`: Combinações de propriedades tipográficas mais frequentes

#### `tokens.spacing`
- `scale`: Escala de espaçamentos organizada numericamente
- `sampled`: Valores de margin/padding/gap mais frequentes

#### `tokens.borderRadius`
- `scale`: Escala de border-radius (sm, md, lg, full)
- `sampled`: Valores mais frequentes

#### `tokens.motion`
- `transitions`: Transições CSS mais frequentes
- `animations`: Animações CSS mais frequentes
- `keyframes`: Definições de `@keyframes`

## 📝 Exemplos

### Exemplo 1: Extração Básica

```bash
npm run extract -- --url https://www.example.com
```

### Exemplo 2: Todos os Formatos

```bash
npm run extract -- --url https://www.example.com --format all
```

Gera:
- `example.com-extract.json`
- `example.com-tokens.css`
- `example.com-tailwind.config.js`

### Exemplo 3: Apenas CSS para Projeto Existente

```bash
npm run extract -- --url https://www.example.com --format css --out ./src/styles/tokens.css
```

### Exemplo 4: Extração Rápida com Tailwind

```bash
npm run extract -- --url https://www.example.com --fast --format tailwind
```

### Exemplo 5: Extração Completa

```bash
npm run extract -- \
  --url https://www.example.com \
  --out ./tokens/ \
  --format all \
  --max-elements 3000
```

## 🔍 Como Funciona

1. **Navegação**: O agente usa Playwright para abrir a URL em um navegador headless Chromium.

2. **Carregamento**: Aguarda o carregamento completo da página (ou `domcontentloaded` no modo fast).

3. **Extração de Variáveis CSS**: Coleta todas as variáveis CSS customizadas (`--*`) definidas em `:root`.

4. **Amostragem de Elementos**: Seleciona até `maxElements` elementos visíveis do DOM e extrai:
   - **Cores**: `color`, `backgroundColor`, `borderColor`, `fill`, `stroke`, `boxShadow`, `textShadow`
   - **Tipografia**: `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`
   - **Espaçamento**: `margin*`, `padding*`, `gap`, `rowGap`, `columnGap`
   - **Border-Radius**: `borderTopLeftRadius`, etc.
   - **Movimento**: `transition*` e `animation*`

5. **Interações (opcional)**: Interage com elementos clicáveis e faz scroll para capturar estados dinâmicos.

6. **Análise de Keyframes**: Extrai definições de `@keyframes` dos stylesheets.

7. **Inferência Semântica**: Usa análise de cor (HSL, luminância WCAG) para inferir nomes semânticos automaticamente.

8. **Criação de Escalas**: Agrupa valores em escalas coerentes (xs, sm, md, lg, xl).

9. **Geração de Output**: Salva os tokens no formato escolhido (JSON, CSS, Tailwind ou todos).

## 🛠️ Dependências

- **playwright**: Navegação e automação do navegador
- **postcss**: Processamento CSS
- **postcss-safe-parser**: Parser seguro de CSS

## ⚠️ Limitações

- Sites com autenticação ou proteção contra bots podem não funcionar corretamente
- Sites com JavaScript pesado podem demorar mais para carregar
- O modo `--fast` pode perder alguns tokens se a página não carregar completamente
- Interações são limitadas a 25 elementos para evitar timeouts

## 📄 Licença

ISC
