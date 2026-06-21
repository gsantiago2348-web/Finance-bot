// src/services/extractorService.js
//
// Ponto único de entrada para extração de dados de gastos.
// Decide, baseado no .env, qual "motor" usar — sem que o resto
// do sistema precise saber qual é.
//
// Para trocar de regex para IA no futuro, mude APENAS:
//   MODO_EXTRACAO=ia
// no arquivo .env. Nenhuma outra linha de código muda.

import { extractorRegex } from './extractors/regexExtractor.js';
import { extractorClaude } from './extractors/claudeExtractor.js';

export async function extrairGasto(mensagem) {
  const modo = process.env.MODO_EXTRACAO || 'regex';

  if (modo === 'ia') {
    return await extractorClaude(mensagem);
  }

  return extractorRegex(mensagem);
}
