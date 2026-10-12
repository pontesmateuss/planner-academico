/* Estado compartilhado. Os módulos importam estes dois objetos e alteram suas propriedades,
   nunca os reatribuem, para que todos enxerguem sempre o mesmo dado. */

/** Dados do usuário: é isto que é salvo. */
export const state = { items: [], updatedAt: 0, examples: false };

/** Estado da tela: filtro atual, matéria escolhida, item em edição. Não é salvo. */
export const ui = { view: 'pendentes', subject: '', editingId: null, doneOpen: false };

export function hasExamples() {
  return state.items.some((i) => i.example);
}

/** Troca os dados inteiros (leitura do navegador, da conta ou exemplos iniciais). */
export function replaceData(data) {
  state.items = data.items;
  state.updatedAt = data.updatedAt || 0;
  state.examples = hasExamples();
}
