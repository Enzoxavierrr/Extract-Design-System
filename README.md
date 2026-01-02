# Agent Design System

Agente automatizado para extração de tokens de design system de sites web. Este agente utiliza Playwright para navegar até uma URL, analisar estilos CSS computados e extrair tokens de design organizados em categorias: cores, tipografia e animações.

## 📋 Índice

- [Instalação](#instalação)
- [Uso Básico](#uso-básico)
- [Opções Disponíveis](#opções-disponíveis)
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
- Se não especificado: `<hostname>-extract.json` no diretório atual
- Se for um diretório: `<hostname>-extract.json` dentro do diretório especificado

**Exemplos:**

```bash
# Arquivo específico
npm run extract -- --url https://example.com --out ./tokens/design-tokens.json

# Diretório (arquivo será nomeado automaticamente)
npm run extract -- --url https://example.com --out ./tokens/
```

### `--max-elements` (opcional)

Número máximo de elementos DOM a serem analisados para estilos computados.

**Valor padrão:** `2000`

**Exemplo:**

```bash
npm run extract -- --url https://example.com --max-elements 5000
```

**Nota:** Em modo `--fast`, este valor é automaticamente limitado a 700.

### `--no-interactions` (opcional)

Desabilita as interações automáticas (hover, click, scroll) que são usadas para capturar tokens de animação e transição.

**Exemplo:**

```bash
npm run extract -- --url https://example.com --no-interactions
```

### `--fast` (opcional)

Modo rápido que otimiza a extração:

- Limita elementos amostrados a 700 (mesmo que `--max-elements` seja maior)
- Bloqueia recursos pesados (imagens, mídia, fontes)
- Desabilita interações por padrão
- Usa `domcontentloaded` em vez de `load` para carregamento mais rápido
- Reduz timeouts e delays

**Exemplo:**

```bash
npm run extract -- --url https://example.com --fast
```

### `--help` ou `-h`

Exibe a ajuda com todas as opções disponíveis.

```bash
npm run extract -- --help
```

## 📊 Estrutura do Output

O arquivo JSON gerado contém a seguinte estrutura:

```json
{
  "meta": {
    "url": "https://www.example.com",
    "extractedAt": "2025-12-25T15:00:28.500Z",
    "maxElements": 2000,
    "interactionsEnabled": true
  },
  "tokens": {
    "color": {
      "rootVariables": {
        "--color-primary": "#0066cc",
        "--color-secondary": "#333333"
      },
      "sampled": [
        {
          "value": "rgb(0, 102, 204)",
          "count": 150
        }
      ]
    },
    "typography": {
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
            "animationTimingFunction": "ease-in-out",
            "animationDelay": "0s",
            "animationIterationCount": "1",
            "animationDirection": "normal",
            "animationFillMode": "both",
            "animationPlayState": "running"
          },
          "count": 10
        }
      ],
      "keyframes": [
        {
          "name": "fadeIn",
          "frames": [
            {
              "keyText": "0%",
              "style": "opacity: 0;"
            },
            {
              "keyText": "100%",
              "style": "opacity: 1;"
            }
          ]
        }
      ]
    }
  },
  "debug": {
    "rootVariablesOther": {
      "--spacing-unit": "8px"
    },
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
- `rootVariables`: Variáveis CSS customizadas relacionadas a cores encontradas em `:root`
- `sampled`: Cores mais frequentes encontradas nos elementos, ordenadas por contagem

#### `tokens.typography`
- `sampled`: Combinações de propriedades tipográficas mais frequentes, ordenadas por contagem

#### `tokens.motion`
- `transitions`: Transições CSS mais frequentes
- `animations`: Animações CSS mais frequentes
- `keyframes`: Definições de keyframes encontradas nos estilos

#### `debug`
- `rootVariablesOther`: Variáveis CSS customizadas não relacionadas a cores
- `motionEventsSample`: Amostra de eventos de movimento capturados durante interações

## 📝 Exemplos

### Exemplo 1: Extração Básica

```bash
npm run extract -- --url https://www.example.com
```

Gera: `example.com-extract.json`

### Exemplo 2: Extração com Arquivo de Saída Customizado

```bash
npm run extract -- --url https://www.example.com --out ./design-tokens.json
```

### Exemplo 3: Extração Rápida (Modo Fast)

```bash
npm run extract -- --url https://www.example.com --fast
```

### Exemplo 4: Extração com Mais Elementos

```bash
npm run extract -- --url https://www.example.com --max-elements 5000
```

### Exemplo 5: Extração sem Interações

```bash
npm run extract -- --url https://www.example.com --no-interactions
```

### Exemplo 6: Extração Completa com Todas as Opções

```bash
npm run extract -- \
  --url https://www.example.com \
  --out ./tokens/my-tokens.json \
  --max-elements 3000
```

## 🔍 Como Funciona

1. **Navegação**: O agente usa Playwright para abrir a URL especificada em um navegador headless Chromium.

2. **Carregamento**: Aguarda o carregamento completo da página (ou `domcontentloaded` no modo fast).

3. **Extração de Variáveis CSS**: Coleta todas as variáveis CSS customizadas (`--*`) definidas em `:root`.

4. **Amostragem de Elementos**: Seleciona até `maxElements` elementos visíveis do DOM e extrai:
   - **Cores**: `color`, `backgroundColor`, `borderColor`, `outlineColor`, `textDecorationColor`, `fill`, `stroke`, `boxShadow`, `textShadow`
   - **Tipografia**: `fontFamily`, `fontSize`, `fontWeight`, `fontStyle`, `lineHeight`, `letterSpacing`, `textTransform`
   - **Movimento**: `transition*` e `animation*` properties

5. **Interações (opcional)**: Se habilitado, interage com elementos clicáveis (até 25 elementos) e faz scroll para capturar animações e transições em tempo real.

6. **Análise de Keyframes**: Extrai definições de `@keyframes` dos stylesheets CSS.

7. **Agregação**: Conta a frequência de cada token e retorna os mais comuns (top 30 para tipografia e movimento, top 60 para cores).

8. **Geração do JSON**: Salva todos os tokens extraídos em um arquivo JSON formatado.

## 🛠️ Dependências

- **playwright**: Navegação e automação do navegador
- **cheerio**: Parsing HTML (não usado diretamente, mas presente)
- **postcss**: Processamento CSS
- **postcss-safe-parser**: Parser seguro de CSS

## ⚠️ Limitações

- Sites com autenticação ou proteção contra bots podem não funcionar corretamente
- Sites com JavaScript pesado podem demorar mais para carregar
- O modo `--fast` pode perder alguns tokens se a página não carregar completamente
- Interações são limitadas a 25 elementos para evitar timeouts

## 📄 Licença

ISC

