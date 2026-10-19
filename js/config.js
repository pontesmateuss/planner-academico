/* Constantes e textos do site. Nenhuma lógica aqui. */

export const STORAGE_KEY = 'planner-academico-v1';
export const THEME_KEY = 'planner-academico-tema';
export const REMOTE_DOC = 'planner';

/* Conta na nuvem (Supabase). A chave abaixo é a PUBLISHABLE (pública): pode ficar no código.
   Quem protege os dados é a regra de segurança de supabase/schema.sql.
   NUNCA coloque aqui a chave secreta (sb_secret_...) nem a antiga service_role: um teste barra isso. */
export const SUPABASE_URL = 'https://jqwpiigzvaobikoumqdg.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_KlIpTWTRRvRCALwlZDtGXw_BmNW4qlZ';
export const SYNC_TABLE = 'planner_docs';
export const SAVE_DELAY_MS = 600;
export const TOAST_MS = 8000;

export const TYPES = {
  atividade: 'Atividade',
  prova: 'Prova',
  trabalho: 'Trabalho',
  lembrete: 'Lembrete'
};

export const GROUPS = [
  ['atras', 'Atrasadas'],
  ['hoje', 'Hoje'],
  ['amanha', 'Amanhã'],
  ['semana', 'Nos próximos 7 dias'],
  ['depois', 'Mais adiante'],
  ['sem', 'Sem prazo']
];

export const VIEWS = [
  ['pendentes', 'Pendentes'],
  ['hoje', 'Hoje'],
  ['semana', 'Próximos 7 dias'],
  ['atrasadas', 'Atrasadas'],
  ['concluidas', 'Concluídas']
];

export const EMPTY = {
  pendentes: 'Tudo em dia. Adicione uma atividade ou um lembrete no formulário acima.',
  hoje: 'Nada com prazo para hoje.',
  semana: 'Nada com prazo nos próximos 7 dias.',
  atrasadas: 'Nenhuma atividade atrasada.',
  concluidas: 'Nenhum item concluído ainda.'
};

export const STATUS_TEXT = {
  synced: 'Salvo na sua conta',
  saving: 'Salvando…',
  local: 'Salvo neste navegador',
  error: 'Sem conexão com a conta. Salvo neste navegador.'
};
