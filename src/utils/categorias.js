// src/utils/categorias.js
// Fonte única da verdade sobre categorias.
// Usado tanto pelo extractor por regex quanto pelo extractor por IA,
// garantindo que os dois "motores" classifiquem do mesmo jeito.

export const CATEGORIAS = {
  Mercado: [
    'mercado', 'supermercado', 'feira', 'hortifruti', 'padaria',
    'açougue', 'sacolão', 'extra', 'carrefour', 'pão de açucar', 'assai', 'atacadao'
  ],
  Alimentação: [
    'restaurante', 'ifood', 'lanchonete', 'lanche', 'almoço', 'almoco',
    'janta', 'jantar', 'rango', 'comida', 'cafe', 'café', 'bar', 'pizza',
    'hamburguer', 'hamburger', 'delivery', 'rappi'
  ],
  Saúde: [
    'farmacia', 'farmácia', 'remedio', 'remédio', 'medico', 'médico',
    'consulta', 'exame', 'dentista', 'drogaria', 'hospital', 'plano de saude'
  ],
  Beleza: [
    'corte', 'cabelo', 'barbearia', 'salao', 'salão', 'manicure',
    'pedicure', 'barba', 'estetica', 'estética'
  ],
  Transporte: [
    'uber', '99', 'gasolina', 'combustivel', 'combustível', 'estacionamento',
    'pedagio', 'pedágio', 'onibus', 'ônibus', 'metro', 'metrô', 'taxi', 'táxi', 'busao', 'busão'
  ],
  Compras: [
    'shopping', 'loja', 'roupa', 'sapato', 'eletronico', 'eletrônico',
    'amazon', 'mercado livre', 'shopee', 'americanas', 'magalu'
  ],
  Casa: [
    'aluguel', 'condominio', 'condomínio', 'luz', 'agua', 'água',
    'internet', 'gas', 'gás', 'manutencao', 'manutenção', 'iptu'
  ],
  Lazer: [
    'cinema', 'academia', 'netflix', 'spotify', 'streaming', 'show',
    'festa', 'viagem', 'jogo', 'parque'
  ],
  Educação: [
    'curso', 'livro', 'escola', 'faculdade', 'mensalidade', 'material escolar'
  ]
};

export function listarCategorias() {
  return Object.keys(CATEGORIAS);
}

export function detectarCategoriaPorPalavra(textoLower) {
  for (const [categoria, palavras] of Object.entries(CATEGORIAS)) {
    for (const palavra of palavras) {
      if (textoLower.includes(palavra)) {
        return categoria;
      }
    }
  }
  return 'Outros';
}
