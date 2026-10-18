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
│   ├── validate.js       Validação e limpeza dos dados, leitura de backup (funções puras)
│   ├── dates.js          Datas e prazos (funções puras)
│   ├── state.js          Estado compartilhado (dados e tela)
│   ├── selectors.js      Filtro por matéria e contagens
│   ├── seed.js           Itens de exemplo da primeira abertura
│   ├── storage.js        Salvar no navegador e na conta
│   ├── render.js         Desenho da tela
│   ├── toast.js          Aviso com "Desfazer"
│   ├── theme.js          Tema claro e escuro
│   ├── backup.js         Baixar e restaurar backup (monta a própria seção na página)
│   ├── actions.js        Eventos e ações do usuário
│   └── main.js           Ponto de entrada
├── tests/                Testes automáticos (rodam com `npm test`, sem instalar nada)
├── package.json          Só define `npm test` e o tipo de módulo
└── assets/
    └── img/              logo-icone.png (cabeçalho) e logo-horizontal.png (barra de navegação)
```

## Como as partes se ligam

- `index.html` carrega os quatro CSS na ordem `tokens`, `base`, `layout`, `components`, e um único script: `js/main.js`.
- Todo CSS usa as variáveis de `tokens.css`. Para mudar uma cor, edite só esse arquivo.
- Os módulos JavaScript importam uns aos outros com caminhos relativos e sempre na mesma direção, sem ciclos:

  `config, utils` → `validate, dates` → `state` → `selectors, seed, storage` → `render, toast` → `backup` → `actions` → `main`

- O que o JavaScript procura no HTML são os `id` (por exemplo `form`, `lista`, `filtros`, `status`, `toast`, `tema`). Se renomear um `id` no `index.html`, troque também nos módulos.
- As imagens são referenciadas só em `index.html`, a partir de `assets/img/`.

## Salvamento

Cada alteração é gravada no navegador (`localStorage`). Quando o site roda numa página com a capacidade de banco de dados e de usuário, uma cópia também vai para a conta de quem está logado, e a versão mais recente vence.

Fora de uma página com conta (por exemplo, no GitHub Pages), os dados existem só neste navegador. Se os dados do navegador forem apagados, eles se perdem. Por isso a página tem a seção **Backup dos seus dados**: **Baixar backup** gera um arquivo `.json` e **Restaurar de um arquivo** lê esse arquivo de volta (com confirmação e "Desfazer"). Se o navegador não conseguir salvar, a linha de status avisa. Dados ilegíveis nunca são apagados: uma cópia fica guardada e pode ser baixada na mesma seção.

Todo dado que entra (do navegador, da conta ou de um arquivo importado) passa por `validate.js`, que descarta o que não serve e corrige o que dá para corrigir.

## Versão dos dados

Tudo que é salvo (no navegador, na conta e nos backups) leva um número de versão, `DATA_VERSION`, em `js/validate.js`. Dados antigos, sem número, valem como versão 0 e são convertidos ao carregar. Antes da conversão, uma cópia do original fica guardada, então nada se perde se algo der errado.

Para mudar o formato dos itens (por exemplo, adicionar um campo):

1. Em `validate.js`, some 1 a `DATA_VERSION`.
2. Em `MIGRATIONS`, acrescente a conversão da versão anterior. Exemplo, de 1 para 2: `1: (d) => ({ ...d, items: d.items.map((i) => ({ ...i, novoCampo: '' })) })`.
3. Atualize `sanitizeItem` para aceitar o campo novo e escreva um teste em `tests/migrate.test.js`.

Se o navegador ou a conta tiver dados de uma versão **mais nova** que a do site (por exemplo, uma página antiga guardada em cache), o site não carrega nem sobrescreve esses dados: avisa na linha de status e trava o salvamento até a página ser atualizada.

## Testes

Rode `npm test` na pasta do projeto (precisa só do Node 20 ou mais novo). Os testes ficam em `tests/` e cobrem a validação de dados, as migrações de versão, a leitura de backup e o salvamento no navegador.

## Regras para manter a organização

- HTML só estrutura, CSS só aparência, JavaScript só comportamento. Nada de `style` ou `onclick` dentro do HTML (o único `style` que sobrou é o espaçamento do formulário, que pode migrar para `components.css`).
- Cor, tamanho de letra e espaçamento novos entram primeiro como variável em `tokens.css`.
- Um módulo novo só importa módulos que estão à esquerda dele na cadeia acima.
