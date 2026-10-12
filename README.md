# Planner Acadêmico

Site para anotar atividades, provas, trabalhos e lembretes com prazo. Sem build e sem dependências: abre direto no navegador.

## Estrutura

```
planner-academico/
├── index.html            Estrutura da página (HTML). Só liga os outros arquivos.
├── css/                  Aparência (CSS)
│   ├── tokens.css        Cores e fontes, tema claro e escuro
│   ├── base.css          Reset, tipografia, foco
│   ├── layout.css        Barra de navegação, coluna central, cabeçalho
│   └── components.css    Cartão, formulário, botões, filtros, lista, aviso
├── js/                   Comportamento (JavaScript, módulos ES)
│   ├── config.js         Constantes e textos
│   ├── utils.js          $, el, uid
│   ├── dates.js          Datas e prazos (funções puras)
│   ├── state.js          Estado compartilhado (dados e tela)
│   ├── selectors.js      Filtro por matéria e contagens
│   ├── seed.js           Itens de exemplo da primeira abertura
│   ├── storage.js        Salvar no navegador e na conta
│   ├── render.js         Desenho da tela
│   ├── toast.js          Aviso com "Desfazer"
│   ├── theme.js          Tema claro e escuro
│   ├── actions.js        Eventos e ações do usuário
│   └── main.js           Ponto de entrada
└── assets/
    └── img/              logo-icone.png (cabeçalho) e logo-horizontal.png (barra de navegação)
```

## Como as partes se ligam

- `index.html` carrega os quatro CSS na ordem `tokens`, `base`, `layout`, `components`, e um único script: `js/main.js`.
- Todo CSS usa as variáveis de `tokens.css`. Para mudar uma cor, edite só esse arquivo.
- Os módulos JavaScript importam uns aos outros com caminhos relativos e sempre na mesma direção, sem ciclos:

  `config, utils` → `dates` → `state` → `selectors, seed, storage` → `render, toast` → `actions` → `main`

- O que o JavaScript procura no HTML são os `id` (por exemplo `form`, `lista`, `filtros`, `status`, `toast`, `tema`). Se renomear um `id` no `index.html`, troque também nos módulos.
- As imagens são referenciadas só em `index.html`, a partir de `assets/img/`.

## Salvamento

Cada alteração é gravada no navegador (`localStorage`). Quando o site roda numa página com a capacidade de banco de dados e de usuário, uma cópia também vai para a conta de quem está logado, e a versão mais recente vence.

## Regras para manter a organização

- HTML só estrutura, CSS só aparência, JavaScript só comportamento. Nada de `style` ou `onclick` dentro do HTML (o único `style` que sobrou é o espaçamento do formulário, que pode migrar para `components.css`).
- Cor, tamanho de letra e espaçamento novos entram primeiro como variável em `tokens.css`.
- Um módulo novo só importa módulos que estão à esquerda dele na cadeia acima.
