// src/utils/formatadores.js

export function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarDataBR(dataISO) {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function somarGastos(gastos) {
  return gastos.reduce((total, g) => total + parseFloat(g.valor), 0);
}

export function agruparPorCategoria(gastos) {
  const grupos = {};
  for (const g of gastos) {
    grupos[g.categoria] = (grupos[g.categoria] || 0) + parseFloat(g.valor);
  }
  return grupos;
}
