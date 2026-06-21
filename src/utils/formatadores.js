// src/utils/formatadores.js

export function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarDataBR(dataISO) {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function formatarHora(timestamptz) {
  if (!timestamptz) return '';

  // O Postgres às vezes retorna o offset como "+00" em vez de "+00:00",
  // o que o Date() do JS não interpreta corretamente. Normaliza antes de parsear.
  const normalizado = timestamptz.replace(/([+-]\d{2})$/, '$1:00');
  const data = new Date(normalizado);

  if (isNaN(data.getTime())) return '';

  return data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo'
  });
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
