# Planner Acadêmico

Site para anotar atividades, provas, trabalhos e lembretes com prazo. Sem build e sem dependências: abre direto no navegador.

## Estrutura

```
planner-academico/
├── index.html            Estrutura da página (HTML). Só liga os outros arquivos.
├── manifest.webmanifest  Nome, cores e ícones do app instalável
├── sw.js                 Service worker: deixa o site abrir sem internet
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
│   ├── storage.js        Salvar no navegador e na conta (sincronização)
│   ├── remote.js         Linha da conta no Supabase, mensagens de erro de login (funções puras)
│   ├── render.js         Desenho da tela
│   ├── toast.js          Aviso com "Desfazer"
│   ├── theme.js          Tema claro e escuro
│   ├── ics.js            Monta o arquivo de agenda .ics (funções puras)
│   ├── reminders.js      Decide quais avisos de prazo mostrar (funções puras)
│   ├── backup.js         Baixar e restaurar backup (monta a própria seção na página)
│   ├── agenda.js         Exportar prazos para a agenda e ativar avisos (monta a própria seção na página)
│   ├── pwa.js            Registra o service worker
│   ├── account.js        Tela de login e conta (monta a própria seção na página)
│   ├── actions.js        Eventos e ações do usuário
│   └── main.js           Ponto de entrada
├── tests/                Testes automáticos (rodam com `npm test`, sem instalar nada)
├── .github/workflows/    Roda os testes no GitHub a cada envio (testes.yml)
├── vendor/               Biblioteca do Supabase (supabase-js, licença MIT) guardada aqui, sem CDN
├── supabase/schema.sql   Tabela e regras de segurança da conta (colar no painel do Supabase)
├── package.json          Só define `npm test` e o tipo de módulo
└── assets/
    └── img/              logo-icone.png (cabeçalho), logo-horizontal.png (barra de navegação) e os ícones do app (icon-*.png, apple-touch-icon.png)
```

## Como as partes se ligam

- `index.html` carrega os quatro CSS na ordem `tokens`, `base`, `layout`, `components`, e um único script: `js/main.js`.
- Todo CSS usa as variáveis de `tokens.css`. Para mudar uma cor, edite só esse arquivo.
- Os módulos JavaScript importam uns aos outros com caminhos relativos e sempre na mesma direção, sem ciclos:

  `config, utils, pwa` → `validate, dates` → `state` → `selectors, seed, storage, ics, reminders` → `render, toast` → `backup, agenda` → `actions` → `main`

- O que o JavaScript procura no HTML são os `id` (por exemplo `form`, `lista`, `filtros`, `status`, `toast`, `tema`). Se renomear um `id` no `index.html`, troque também nos módulos.
- As imagens são referenciadas só em `index.html`, a partir de `assets/img/`.

## Salvamento

Cada alteração é gravada no navegador (`localStorage`). Com uma conta ligada (veja **Conta e sincronização**, abaixo), uma cópia também vai para a conta, e a versão mais recente vence.

Sem conta, os dados existem só neste navegador. Se os dados do navegador forem apagados, eles se perdem. Por isso a página tem a seção **Backup dos seus dados**: **Baixar backup** gera um arquivo `.json` e **Restaurar de um arquivo** lê esse arquivo de volta (com confirmação e "Desfazer"). Se o navegador não conseguir salvar, a linha de status avisa. Dados ilegíveis nunca são apagados: uma cópia fica guardada e pode ser baixada na mesma seção.

Todo dado que entra (do navegador, da conta ou de um arquivo importado) passa por `validate.js`, que descarta o que não serve e corrige o que dá para corrigir.

## Conta e sincronização

A seção **Conta e sincronização** (logo abaixo da lista) deixa entrar com e-mail e senha para ver os mesmos itens em vários aparelhos. Sem conta, tudo continua funcionando e salvo no navegador. A conta fica no [Supabase](https://supabase.com) (plano gratuito); a biblioteca (`vendor/supabase-js-*.umd.js`, licença MIT) fica guardada no repositório, então o site não depende de CDN e continua abrindo offline.

**Como funciona.** Cada conta tem **um documento** na tabela `planner_docs` (os mesmos dados do `localStorage`: `version`, `items`, `updatedAt`). Ao entrar, e sempre que a aba volta a ficar visível, `storage.js` compara a conta com o aparelho e **vale o mais recente**. Cada alteração é enviada depois de 0,6 s. Sair da conta mantém os itens no aparelho e para de enviar.

**Segurança.** `js/config.js` tem a URL do projeto e a chave **publishable**, que é pública por desenho e pode ficar no código. Quem protege os dados são as regras do banco (RLS) em `supabase/schema.sql`: cada conta só lê e altera a própria linha. A chave **secreta** (`sb_secret_...`) ou a antiga `service_role` ignoram essas regras e **nunca** podem entrar no repositório; um teste (`tests/estrutura.test.js`) falha se aparecerem.

**Limite importante.** A sincronização compara o documento inteiro, não item por item. Se você editar em dois aparelhos ao mesmo tempo, sem a aba voltar a ficar visível entre as edições, o mais recente sobrescreve o outro. Para não perder nada, o lado que foi substituído (se tinha itens de verdade) é guardado e aparece na seção **Backup** como **Baixar cópia de antes da sincronização**, em formato que **Restaurar de um arquivo** entende.

**Configurar do zero (uma vez):**

1. Crie um projeto gratuito em supabase.com. Em **Authentication → Providers → Email**, desligue **Confirm email** (o e-mail embutido do plano gratuito só envia para a equipe do projeto e tem limite baixo).
2. No **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e execute. Pode rodar de novo sem apagar dados.
3. Em **Connect**, copie a **Project URL** e a **publishable key** para `SUPABASE_URL` e `SUPABASE_KEY` em `js/config.js`.
4. Abra o site, **Criar conta**. Depois de criar a sua, em **Authentication** desligue **Allow new users to sign up** para fechar novos cadastros.

Projetos gratuitos com pouca atividade por 7 dias são pausados (os dados ficam guardados; retome em **Resume project** no painel).

## Versão dos dados

Tudo que é salvo (no navegador, na conta e nos backups) leva um número de versão, `DATA_VERSION`, em `js/validate.js`. Dados antigos, sem número, valem como versão 0 e são convertidos ao carregar. Antes da conversão, uma cópia do original fica guardada, então nada se perde se algo der errado.

Para mudar o formato dos itens (por exemplo, adicionar um campo):

1. Em `validate.js`, some 1 a `DATA_VERSION`.
2. Em `MIGRATIONS`, acrescente a conversão da versão anterior. Exemplo, de 1 para 2: `1: (d) => ({ ...d, items: d.items.map((i) => ({ ...i, novoCampo: '' })) })`.
3. Atualize `sanitizeItem` para aceitar o campo novo e escreva um teste em `tests/migrate.test.js`.

Se o navegador ou a conta tiver dados de uma versão **mais nova** que a do site (por exemplo, uma página antiga guardada em cache), o site não carrega nem sobrescreve esses dados: avisa na linha de status e trava o salvamento até a página ser atualizada.

## Agenda e lembretes

A seção **Agenda e lembretes** tem o botão **Exportar prazos para a agenda (.ics)**. O arquivo funciona no Google Agenda, no Calendário da Apple e no Outlook: abra-o (ou importe pela agenda) e cada prazo pendente vira um evento com lembretes. Prazo sem horário vira evento de dia inteiro, com lembrete na véspera e no dia, às 9h. Prazo com horário vira evento de 1 hora, com lembrete 1 dia e 1 hora antes. Itens de exemplo, concluídos ou sem data não são exportados.

Cada evento usa o id do item como identificador, então exportar de novo costuma atualizar os mesmos eventos em vez de duplicar. Itens concluídos ou apagados depois de exportados continuam na agenda até serem removidos por lá. Esses lembretes são da própria agenda, então tocam mesmo com o site fechado.

**Avisos neste aparelho.** O botão **Ativar avisos neste aparelho** pede permissão ao navegador e passa a mostrar notificações: uma quando faltar 1 hora (ou menos) para um prazo com horário, e um **resumo do dia** (o que vence hoje e quantos itens estão atrasados), uma vez por dia, a partir das 8h. Cada aviso aparece uma só vez; a lista do que já foi avisado fica guardada no navegador por 7 dias. Tocar na notificação volta para o Planner.

Limite importante: os avisos só aparecem **enquanto o Planner está aberto** (numa aba ou como app instalado), porque um site estático não tem como acordar o aparelho sozinho. No celular, o sistema pode pausar o app em segundo plano. Para lembretes que tocam com tudo fechado, use a exportação para a agenda. Se o navegador bloquear as notificações, a seção avisa e explica que é preciso liberar nas configurações dele.

## Instalar como app e abrir sem internet

O site é um PWA. No Android (Chrome) e no computador (Chrome ou Edge), abra o menu do navegador e escolha **Instalar app** ou **Adicionar à tela inicial**. No iPhone (Safari), use **Compartilhar → Adicionar à Tela de Início**. Instalado, ele abre em tela cheia, com o ícone do Planner.

O service worker (`sw.js`) guarda uma cópia dos arquivos do site. Com internet, o site sempre busca a versão mais nova. Sem internet, abre a cópia guardada, e os seus itens continuam disponíveis porque ficam salvos no próprio aparelho. Só funciona em `https` (como no GitHub Pages) ou em `localhost`; abrindo o `index.html` direto do disco, o site funciona normal, só não instala nem abre offline.

Ao criar, renomear ou apagar um arquivo do site (um módulo novo em `js/`, por exemplo, ou um arquivo em `vendor/`), atualize a lista `PRECACHE` em `sw.js` e some 1 a `CACHE_VERSION`. Se esquecer, o teste avisa. Os ícones foram gerados a partir de `logo-icone.png`; para um ícone mais nítido em telas grandes, troque `icon-512.png` e `icon-maskable-512.png` por versões feitas a partir de um logo de pelo menos 512 px.

## Testes

Rode `npm test` na pasta do projeto (precisa só do Node 22 ou mais novo). Os testes ficam em `tests/` e cobrem a validação de dados, as migrações de versão, a leitura de backup, o salvamento no navegador, a sincronização com a conta (com um servidor simulado) e as mensagens de login, a exportação para a agenda (`.ics`), os avisos de prazo, o PWA (lista de arquivos do service worker, manifest, ícones e o comportamento do service worker com e sem internet) e a estrutura do projeto (a chave secreta do Supabase nunca no código, o SQL protegendo a conta, imports que existem, sem ciclos, ids usados no JavaScript que existem no `index.html`, arquivos citados no HTML que existem).

O GitHub roda os mesmos testes sozinho, no Node 22 e no 24, a cada envio para a `main` e em todo pull request (arquivo `.github/workflows/testes.yml`). Se algo quebrar, aparece um X vermelho no commit ou no pull request, e o botão de juntar fica com um aviso. Para ver o motivo, abra a aba **Actions** do repositório.

## Regras para manter a organização

- HTML só estrutura, CSS só aparência, JavaScript só comportamento. Nada de `style` ou `onclick` dentro do HTML (o único `style` que sobrou é o espaçamento do formulário, que pode migrar para `components.css`).
- Cor, tamanho de letra e espaçamento novos entram primeiro como variável em `tokens.css`.
- Um módulo novo só importa módulos que estão à esquerda dele na cadeia acima.
