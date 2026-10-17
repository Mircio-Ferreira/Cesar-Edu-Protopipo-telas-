// Dashboard do gestor: carrega os CSV de dashboard_links.js e calcula as métricas da
// Funcionalidade 1 de especificacao-historias-usuario-gestor.md (RN 1 a RN 9).
// Persistência (visualizações salvas, auditoria e homologações) simulada com localStorage.
// Utilitários e preparação dos dados ficam em gestor-dados.js.

const NOTA_CORTE = 7;
const DIAS_EVASAO = 45;
const POR_PAGINA = 10;
const FILTROS_PADRAO = { trilha: '', periodo: 'todos', curso: '', secretaria: '', status: '' };
const ORDEM_PADRAO = { col: 'avanco', dir: 'desc' };
const estado = {
  filtros: { ...FILTROS_PADRAO },
  ordem: { ...ORDEM_PADRAO },
  pagina: 1,
  busca: '',
  linhas: [],
};
// ---------- filtros ----------
function cursosDoFiltro(f = estado.filtros) {
  return [...db.cursosEscopo].filter(id => {
    const c = db.cursos.get(id);
    return (!f.trilha || c.trilha === f.trilha) && (!f.curso || id === f.curso);
  });
}

function inicioPeriodo(periodo) {
  const r = db.ref;
  if (periodo === '30') return new Date(r - 30 * DIA);
  if (periodo === '90') return new Date(r - 90 * DIA);
  if (periodo === 'ano') return new Date(r.getFullYear(), 0, 1);
  return null;
}

function matriculasFiltradas({ ignorarPeriodo = false, ignorarStatus = false } = {}) {
  const f = estado.filtros;
  const cursos = new Set(cursosDoFiltro());
  const inicio = ignorarPeriodo ? null : inicioPeriodo(f.periodo);
  return db.matriculas.filter(m => {
    if (!cursos.has(m.curso)) return false;
    if (f.secretaria && db.servidores.get(m.servidor)?.secretaria !== f.secretaria) return false;
    if (!ignorarStatus && f.status && m.status !== f.status) return false;
    if (inicio && !((m.dataMat && m.dataMat >= inicio) || (m.dataConc && m.dataConc >= inicio) || (m.ultimo && m.ultimo >= inicio))) return false;
    return true;
  });
}

function preencherSelect(el, opcoes, rotuloTodos, valor) {
  el.innerHTML = `<option value="">${esc(rotuloTodos)}</option>` +
    opcoes.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
  el.value = opcoes.some(([v]) => v === valor) ? valor : '';
}

function montarFiltros() {
  const f = estado.filtros;
  preencherSelect($('f-trilha'), db.trilhas.map(t => [t, t]), db.trilhas.length > 1 ? 'Todas as minhas trilhas' : (db.trilhas[0] || 'Sem trilhas'), f.trilha);
  f.trilha = $('f-trilha').value;
  const cursos = [...db.cursosEscopo].map(id => db.cursos.get(id))
    .filter(c => !f.trilha || c.trilha === f.trilha)
    .sort((a, b) => a.nome.localeCompare(b.nome));
  preencherSelect($('f-curso'), cursos.map(c => [c.id, c.nome]), 'Todos os cursos', f.curso);
  f.curso = $('f-curso').value;
  const secs = [...new Set(db.matriculas.filter(m => db.cursosEscopo.has(m.curso))
    .map(m => db.servidores.get(m.servidor)?.secretaria).filter(Boolean))].sort();
  preencherSelect($('f-secretaria'), secs.map(s => [s, s]), 'Todas as secretarias', f.secretaria);
  f.secretaria = $('f-secretaria').value;
  $('f-periodo').value = f.periodo;
  $('f-status').value = f.status;
}

function lerFiltrosDoForm() {
  estado.filtros = {
    trilha: $('f-trilha').value,
    periodo: $('f-periodo').value,
    curso: $('f-curso').value,
    secretaria: $('f-secretaria').value,
    status: $('f-status').value,
  };
}

// ---------- RN 2: visualizações salvas ----------
function salvarUltimaConfig() {
  const cfg = lerLS(LS.config, {});
  cfg[GESTOR.id] = { ...(cfg[GESTOR.id] || {}), ultima: { filtros: estado.filtros, ordem: estado.ordem }, atualizada: new Date().toISOString() };
  gravarLS(LS.config, cfg);
}

function configGestor() { return lerLS(LS.config, {})[GESTOR.id] || {}; }
function viewsGestor() { return lerLS(LS.views, {})[GESTOR.id] || []; }
function gravarViews(lista) { const v = lerLS(LS.views, {}); v[GESTOR.id] = lista; gravarLS(LS.views, v); }

function renderViews() {
  const atual = JSON.stringify(estado.filtros);
  const chip = (nome, filtros, idx) => {
    const on = JSON.stringify(filtros) === atual ? ' on' : '';
    const apagar = idx == null ? '' : `<span class="x" data-apagar="${idx}" title="Excluir visualização">×</span>`;
    return `<button type="button" class="chip${on}" data-view="${idx ?? ''}">${esc(nome)}${apagar}</button>`;
  };
  $('views').innerHTML = '<b class="small muted">Visualizações salvas:</b>' +
    chip('Visão geral', FILTROS_PADRAO, null) +
    viewsGestor().map((v, i) => chip(v.nome, v.filtros, i)).join('');
}

// ---------- RN 3: auditoria ----------
function registrarAuditoria(metrica, ms) {
  const log = lerLS(LS.auditoria, []);
  const registro = { timestamp: new Date().toISOString(), id_gestor: GESTOR.id, metrica, filtros: { ...estado.filtros }, tempo_ms: +ms.toFixed(1) };
  log.unshift(registro);
  gravarLS(LS.auditoria, log.slice(0, 300));
  console.debug('[DashboardLogConsulta]', registro);
  renderAuditoria();
}

function renderAuditoria() {
  const log = lerLS(LS.auditoria, []);
  $('audit-cnt').textContent = log.length;
  const descr = f => [f.trilha, f.curso && db?.cursos.get(f.curso)?.nome, f.secretaria, f.status && STATUS_LABEL[f.status]?.[0], f.periodo !== 'todos' && $('f-periodo').querySelector(`[value="${f.periodo}"]`)?.textContent]
    .filter(Boolean).join(' · ') || 'Sem filtros';
  $('tabela-auditoria').innerHTML = log.slice(0, 50).map(r => `
    <tr>
      <td class="muted">${new Date(r.timestamp).toLocaleString('pt-BR')}</td>
      <td>${esc(r.id_gestor)}</td>
      <td class="strong">${esc(r.metrica)}</td>
      <td class="small">${esc(descr(r.filtros))}</td>
      <td>${fmt(r.tempo_ms)} ms</td>
    </tr>`).join('') || '<tr><td colspan="5" class="muted">Nenhum registro.</td></tr>';
}

// ---------- renderização ----------
function render(metrica) {
  const t0 = performance.now();
  const base = matriculasFiltradas();
  renderCabecalho();
  renderKpis(base);
  renderMeta();
  renderGraficos(base);
  renderTabela(base);
  renderCursos(base);
  renderViews();
  registrarAuditoria(metrica, performance.now() - t0);
}

function renderCabecalho() {
  const f = estado.filtros;
  const escopo = f.trilha ? `Trilha ${f.trilha}` : db.trilhas.length === 1 ? `Trilha ${db.trilhas[0]}` : `${db.trilhas.length} trilhas sob gestão`;
  $('subtitulo').textContent = `${escopo} · ${db.cursosEscopo.size} cursos · dados até ${fmtData(db.ref)}`;
  $('gestor-secretaria').textContent = `Gestora · ${db.secretaria}`;
}

function setKpi(id, valor, detalhe, tom = '') {
  $(id).textContent = valor;
  const d = $(`${id}-d`);
  d.textContent = detalhe;
  d.className = `d ${tom}`;
}

// RN 7: alunos distintos aprovados na 1ª tentativa / alunos distintos que fizeram a prova
function primeiraTentativa(lista) {
  const fizeram = new Set();
  const aprovados = new Set();
  for (const m of lista) {
    if (m.nota == null || !(m.tentativas >= 1)) continue;
    fizeram.add(m.servidor);
    if (m.tentativas === 1 && m.nota >= NOTA_CORTE) aprovados.add(m.servidor);
  }
  return { fizeram: fizeram.size, aprovados: aprovados.size, taxa: fizeram.size ? aprovados.size / fizeram.size * 100 : null };
}

// RN 9: canceladas ou em andamento sem progresso há mais de 45 dias, sobre as matrículas iniciadas
function evasao(lista) {
  const iniciadas = lista.filter(m => m.status !== 'nao_iniciado');
  const evadidas = iniciadas.filter(m => m.status === 'cancelado' || (m.status === 'andamento' && dias(m.ultimo || m.dataMat, db.ref) > DIAS_EVASAO));
  return {
    iniciadas: iniciadas.length,
    evadidas: evadidas.length,
    canceladas: evadidas.filter(m => m.status === 'cancelado').length,
    taxa: iniciadas.length ? evadidas.length / iniciadas.length * 100 : null,
  };
}

function renderKpis(base) {
  const ativos = new Set(base.filter(m => m.status !== 'cancelado').map(m => m.servidor));
  const novos = new Set(base.filter(m => m.dataMat && dias(m.dataMat, db.ref) <= 30).map(m => m.servidor));
  setKpi('kpi-ativos', fmtInt(ativos.size), `+${fmtInt(novos.size)} matriculados nos últimos 30 dias`, novos.size ? '' : 'neu');

  const concl = base.filter(m => m.status === 'concluido').length;
  setKpi('kpi-conclusao', fmtPct(base.length ? concl / base.length * 100 : null),
    `${fmtInt(concl)} de ${fmtInt(base.length)} matrículas concluídas`, 'neu');

  const p = primeiraTentativa(base);
  setKpi('kpi-primeira', fmtPct(p.taxa), `${fmtInt(p.aprovados)} de ${fmtInt(p.fizeram)} servidores · corte ${fmt(NOTA_CORTE)}`,
    p.taxa == null ? 'neu' : p.taxa >= 60 ? '' : 'neg');

  const e = evasao(base);
  setKpi('kpi-evasao', fmtPct(e.taxa, 1), `${fmtInt(e.evadidas)} de ${fmtInt(e.iniciadas)} iniciadas`,
    e.taxa == null ? 'neu' : e.taxa <= 10 ? '' : 'neg');
}

// RN 4: horas (carga horária dos cursos) concluídas no mês de referência contra a meta
function horasNoMes(lista, ano, mes) {
  return lista.filter(m => m.status === 'concluido' && m.dataConc && m.dataConc.getFullYear() === ano && m.dataConc.getMonth() === mes)
    .reduce((s, m) => s + (db.cursos.get(m.curso)?.carga || 0), 0);
}

function renderMeta() {
  const lista = matriculasFiltradas({ ignorarPeriodo: true, ignorarStatus: true });
  const r = db.ref;
  const horas = horasNoMes(lista, r.getFullYear(), r.getMonth());
  const anteriores = [1, 2, 3].map(k => { const d = new Date(r.getFullYear(), r.getMonth() - k, 1); return horasNoMes(lista, d.getFullYear(), d.getMonth()); });
  const metaSugerida = Math.max(10, Math.ceil((media(anteriores) || horas || 10) * 1.1 / 10) * 10);
  const meta = configGestor().meta || metaSugerida;
  const pct = horas / meta * 100;
  const ultimoDia = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  const mesNome = r.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  $('meta-badge').textContent = `${fmtPct(pct)} da meta`;
  $('meta-badge').className = `badge ${pct >= 100 ? 'green' : 'orange'}`;
  $('meta-horas').textContent = `${fmtInt(horas)} h concluídas`;
  $('meta-label').textContent = `Meta de ${mesNome}:`;
  if (document.activeElement !== $('meta-input')) $('meta-input').value = meta;
  $('meta-bar').style.width = `${Math.min(100, pct)}%`;
  $('meta-bar').parentElement.className = `progress lg${pct >= 100 ? ' green' : ''}`;
  const faltam = Math.max(0, meta - horas);
  $('meta-rodape').textContent = (faltam ? `Faltam ${fmtInt(faltam)} h para a meta` : 'Meta atingida') +
    ` · ${ultimoDia - r.getDate()} dias restantes no mês · média dos 3 meses anteriores: ${fmtInt(media(anteriores))} h` +
    (configGestor().meta ? '' : ' (meta sugerida: média + 10%)');
}

// RN 5: acompanhamento individualizado agrupado por servidor
function montarLinhas(base) {
  const grupos = new Map();
  for (const m of base) {
    if (!grupos.has(m.servidor)) grupos.set(m.servidor, []);
    grupos.get(m.servidor).push(m);
  }
  return [...grupos].map(([id, ms]) => {
    const s = db.servidores.get(id) || { nome: id, secretaria: '—', email: '' };
    const carga = ms.reduce((a, m) => a + (db.cursos.get(m.curso)?.carga || 1), 0);
    const avanco = ms.reduce((a, m) => a + m.pct * (db.cursos.get(m.curso)?.carga || 1), 0) / carga;
    const notas = ms.map(m => m.nota).filter(n => n != null);
    const st = ms.every(m => m.status === 'concluido') ? 'concluido'
      : ms.every(m => m.status === 'cancelado') ? 'cancelado'
      : ms.every(m => m.status === 'nao_iniciado') ? 'nao_iniciado' : 'andamento';
    const ultimo = ms.map(m => m.ultimo).filter(Boolean).reduce((a, b) => (a > b ? a : b), null);
    return { id, nome: s.nome, email: s.email, secretaria: s.secretaria, status: st, avanco, nota: media(notas), ultimo, cursos: ms.length, matriculas: ms.map(m => m.id) };
  });
}

function renderTabela(base) {
  const termo = norm(estado.busca);
  let linhas = montarLinhas(base);
  if (termo) linhas = linhas.filter(l => norm(`${l.nome} ${l.id} ${l.email} ${l.matriculas.join(' ')}`).includes(termo));
  const { col, dir } = estado.ordem;
  const ordemStatus = { nao_iniciado: 0, andamento: 1, concluido: 2, cancelado: 3 };
  const chave = l => col === 'status' ? ordemStatus[l.status] : col === 'ultimo' ? (l.ultimo ? +l.ultimo : -Infinity) : col === 'nota' ? (l.nota ?? -Infinity) : l[col];
  linhas.sort((a, b) => {
    const x = chave(a), y = chave(b);
    const c = typeof x === 'string' ? x.localeCompare(y, 'pt-BR') : x - y;
    return dir === 'asc' ? c : -c;
  });
  estado.linhas = linhas;

  const paginas = Math.max(1, Math.ceil(linhas.length / POR_PAGINA));
  estado.pagina = Math.min(estado.pagina, paginas);
  const ini = (estado.pagina - 1) * POR_PAGINA;
  const pagina = linhas.slice(ini, ini + POR_PAGINA);

  $('tabela-servidores').innerHTML = pagina.map(l => {
    const [rotulo, cor] = STATUS_LABEL[l.status];
    const pct = Math.round(l.avanco);
    return `<tr>
      <td><div class="who"><span class="avatar">${esc(iniciais(l.nome))}</span>
        <div><b class="strong">${esc(l.nome)}</b><small>${esc(l.id)} · ${l.cursos} ${l.cursos === 1 ? 'curso' : 'cursos'}</small></div></div></td>
      <td>${esc(l.secretaria)}</td>
      <td><span class="badge ${cor}">${rotulo}</span></td>
      <td><div class="bar"><div class="progress ${pct >= 100 ? 'green' : ''}"><i style="width:${pct}%"></i></div><b class="small">${pct}%</b></div></td>
      <td class="strong">${fmt(l.nota)}</td>
      <td class="muted">${relativo(l.ultimo)}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" class="muted">Nenhum servidor encontrado para os filtros atuais.</td></tr>';

  document.querySelectorAll('th.sort').forEach(th => {
    th.dataset.dir = th.dataset.col === col ? dir : '';
  });
  $('pag-info').textContent = linhas.length
    ? `Mostrando ${ini + 1}–${ini + pagina.length} de ${fmtInt(linhas.length)} servidores`
    : 'Nenhum servidor';

  renderPaginacao($('paginacao'), estado.pagina, paginas);
}

// RN 8: média das notas por curso e tentativas reprovadas / tentativas realizadas
function renderCursos(base) {
  const linhas = cursosDoFiltro().map(id => {
    const ms = base.filter(m => m.curso === id && m.nota != null);
    let tentativas = 0, reprovadas = 0;
    for (const m of ms) {
      const t = Math.max(1, m.tentativas || 1);
      tentativas += t;
      reprovadas += m.nota >= NOTA_CORTE ? t - 1 : t;
    }
    return {
      nome: db.cursos.get(id).nome,
      media: media(ms.map(m => m.nota)),
      reprov: tentativas ? reprovadas / tentativas * 100 : null,
      primeira: primeiraTentativa(ms).taxa,
      n: ms.length,
    };
  }).sort((a, b) => (b.reprov ?? -1) - (a.reprov ?? -1));

  $('corte-info').textContent = `Nota de corte ${fmt(NOTA_CORTE)} · percentual de tentativas abaixo dela (ordenado pela maior reprovação).`;
  $('tabela-cursos').innerHTML = linhas.map(l => {
    const cor = l.reprov == null ? '' : l.reprov <= 10 ? 'green' : l.reprov <= 20 ? 'yellow' : 'red';
    return `<tr>
      <td><b class="strong">${esc(l.nome)}</b><br><span class="small muted">${fmtInt(l.n)} provas</span></td>
      <td class="strong">${fmt(l.media)}</td>
      <td><span class="badge ${cor}">${fmtPct(l.reprov)}</span></td>
      <td>${fmtPct(l.primeira)}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="4" class="muted">Sem cursos para os filtros atuais.</td></tr>';
}

// ---------- gráficos (Chart.js) ----------
// Paleta validada (scripts/validate_palette.js do método dataviz): 2 séries categóricas
// azul/laranja e cores de status com legenda + tabela "Ver dados" como canal secundário.
const COR = {
  serie1: '#2a78d6',
  serie2: '#eb6834',
  apagado: '#D6D0C2',
  meta: '#13222F',
  grade: '#ECE7DA',
  texto: '#5A6673',
  concluido: '#0ca30c',
  andamento: '#fab219',
  cancelado: '#d03b3b',
  nao_iniciado: '#B4AC9B',
};
const graficos = {};

// linha vertical que acompanha o ponteiro nos gráficos de linha
const crosshair = {
  id: 'crosshair',
  afterDatasetsDraw(chart) {
    const ativos = chart.tooltip?.getActiveElements();
    if (!ativos?.length) return;
    const { ctx, chartArea: { top, bottom } } = chart;
    ctx.save();
    ctx.strokeStyle = '#B4AC9B';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ativos[0].element.x, top);
    ctx.lineTo(ativos[0].element.x, bottom);
    ctx.stroke();
    ctx.restore();
  },
};

function configurarChart() {
  if (!window.Chart || configurarChart.ok) return !!window.Chart;
  Object.assign(Chart.defaults, { color: COR.texto, borderColor: COR.grade, maintainAspectRatio: false });
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.font.size = 12;
  Chart.defaults.animation.duration = 250;
  Object.assign(Chart.defaults.plugins.tooltip, {
    backgroundColor: '#fff', titleColor: COR.texto, bodyColor: COR.meta, borderColor: '#DCD6C6', borderWidth: 1,
    padding: 10, cornerRadius: 8, usePointStyle: true, boxPadding: 6,
    titleFont: { weight: '600' }, bodyFont: { weight: '600' },
  });
  Object.assign(Chart.defaults.plugins.legend.labels, { usePointStyle: true, boxWidth: 8, boxHeight: 8, padding: 14 });
  Chart.defaults.plugins.legend.align = 'start';
  configurarChart.ok = true;
  return true;
}

// Cria ou atualiza o gráfico sem recriar o canvas (sem "piscar" ao trocar filtro).
function desenhar(id, config, vazio) {
  const canvas = $(id);
  const box = canvas.parentElement;
  box.querySelector('.viz-vazio')?.remove();
  if (vazio || !configurarChart()) {
    graficos[id]?.destroy();
    delete graficos[id];
    canvas.hidden = true;
    box.insertAdjacentHTML('beforeend', `<div class="viz-vazio">${vazio || 'Chart.js não carregou · veja os dados abaixo'}</div>`);
    return;
  }
  canvas.hidden = false;
  if (graficos[id] && graficos[id].config.type === config.type) {
    graficos[id].data = config.data;
    graficos[id].options = config.options;
    graficos[id].update();
  } else {
    graficos[id]?.destroy();
    graficos[id] = new Chart(canvas, config);
  }
}

function tabelaDados(id, cabecalho, linhas) {
  $(`${id}-tabela`).innerHTML = `<table class="t"><thead><tr>${cabecalho.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${linhas.map(l => `<tr>${l.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cabecalho.length}" class="muted">Sem dados.</td></tr>`}</tbody></table>`;
}

function ultimosMeses(n = 12) {
  const r = db.ref;
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(r.getFullYear(), r.getMonth() - (n - 1 - i), 1);
    return { ano: d.getFullYear(), mes: d.getMonth(), rotulo: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('. de ', '/').replace(' de ', '/') };
  });
}

const eixoY = (extra = {}) => ({ beginAtZero: true, grid: { color: COR.grade }, border: { display: false }, ticks: { precision: 0, callback: v => fmtInt(v) }, ...extra });
const eixoX = (extra = {}) => ({ grid: { display: false }, border: { color: COR.grade }, ...extra });

function renderGraficos(base) {
  const historico = matriculasFiltradas({ ignorarPeriodo: true, ignorarStatus: true });
  const meses = ultimosMeses();
  const noMes = (d, m) => d && d.getFullYear() === m.ano && d.getMonth() === m.mes;

  // 1. tendência: novas matrículas x conclusões
  const novas = meses.map(m => historico.filter(x => noMes(x.dataMat, m)).length);
  const concl = meses.map(m => historico.filter(x => x.status === 'concluido' && noMes(x.dataConc, m)).length);
  const linha = (label, data, cor) => ({
    label, data, borderColor: cor, backgroundColor: cor, borderWidth: 2, tension: 0.3, pointStyle: 'line',
    pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: cor, pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2,
  });
  desenhar('g-evolucao', {
    type: 'line',
    data: { labels: meses.map(m => m.rotulo), datasets: [linha('Novas matrículas', novas, COR.serie1), linha('Conclusões', concl, COR.serie2)] },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { x: eixoX(), y: eixoY() },
      plugins: { legend: { labels: { pointStyle: 'line', pointStyleWidth: 18 } } },
    },
    plugins: [crosshair],
  }, historico.length ? '' : 'Sem matrículas para os filtros atuais');
  tabelaDados('g-evolucao', ['Mês', 'Novas matrículas', 'Conclusões'], meses.map((m, i) => [m.rotulo, fmtInt(novas[i]), fmtInt(concl[i])]));

  // 2. horas concluídas por mês x meta (RN 4)
  const horas = meses.map(m => horasNoMes(historico, m.ano, m.mes));
  const meta = +$('meta-input').value || null;
  desenhar('g-horas', {
    type: 'bar',
    data: {
      labels: meses.map(m => m.rotulo),
      datasets: [
        { type: 'bar', label: 'Horas concluídas', data: horas, order: 2, maxBarThickness: 24, borderRadius: 4, borderSkipped: 'start',
          backgroundColor: horas.map((_, i) => i === horas.length - 1 ? COR.serie1 : COR.apagado),
          hoverBackgroundColor: horas.map((_, i) => i === horas.length - 1 ? '#256abf' : '#C4BDAD') },
        { type: 'line', label: 'Meta mensal atual', data: meses.map(() => meta), order: 1, borderColor: COR.meta, borderWidth: 2,
          pointRadius: 0, pointHoverRadius: 0, pointStyle: 'line' },
      ],
    },
    options: {
      interaction: { mode: 'index', intersect: false },
      scales: { x: eixoX(), y: eixoY() },
      plugins: {
        legend: { onClick: () => {}, labels: { generateLabels: c => [
          { text: 'Mês atual', fillStyle: COR.serie1, strokeStyle: COR.serie1, pointStyle: 'rect', lineWidth: 0 },
          { text: 'Meses anteriores', fillStyle: COR.apagado, strokeStyle: COR.apagado, pointStyle: 'rect', lineWidth: 0 },
          { text: 'Meta mensal atual', strokeStyle: COR.meta, fillStyle: COR.meta, pointStyle: 'line', lineWidth: 2 },
        ].map(l => ({ ...l, fontColor: COR.texto })) } },
        tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmtInt(c.parsed.y)} h` } },
      },
    },
  }, horas.some(Boolean) || meta ? '' : 'Nenhuma hora concluída nos últimos 12 meses');
  tabelaDados('g-horas', ['Mês', 'Horas concluídas', 'Meta'], meses.map((m, i) => [m.rotulo, `${fmtInt(horas[i])} h`, i === meses.length - 1 && meta ? `${fmtInt(meta)} h` : '—']));

  // 3. status por curso (barras horizontais empilhadas)
  const cursos = cursosDoFiltro()
    .map(id => ({ id, nome: db.cursos.get(id).nome, ms: base.filter(m => m.curso === id) }))
    .filter(c => c.ms.length)
    .sort((a, b) => b.ms.length - a.ms.length)
    .slice(0, 8);
  const ordem = ['concluido', 'andamento', 'nao_iniciado'];
  const contagem = st => cursos.map(c => c.ms.filter(m => m.status === st).length);
  const totais = Object.fromEntries(ordem.map(st => [st, contagem(st).reduce((a, b) => a + b, 0)]));
  desenhar('g-status', {
    type: 'bar',
    data: {
      labels: cursos.map(c => c.nome),
      datasets: ordem.map(st => ({
        label: `${STATUS_LABEL[st][0]} · ${fmtInt(totais[st])}`, data: contagem(st), backgroundColor: COR[st],
        borderColor: '#fff', borderWidth: { right: 2 }, borderSkipped: false, maxBarThickness: 24,
      })),
    },
    options: {
      indexAxis: 'y',
      scales: { x: eixoY({ stacked: true }), y: eixoX({ stacked: true, ticks: { callback(v) { const t = this.getLabelForValue(v); return t.length > 22 ? t.slice(0, 21) + '…' : t; } } }) },
      plugins: { tooltip: { callbacks: {
        label: c => {
          const total = cursos[c.dataIndex].ms.length;
          return `${STATUS_LABEL[ordem[c.datasetIndex]][0]}: ${fmtInt(c.parsed.x)} (${fmtPct(c.parsed.x / total * 100)})`;
        },
      } } },
    },
  }, cursos.length ? '' : 'Sem matrículas para os filtros atuais');
  tabelaDados('g-status', ['Curso', ...ordem.map(st => STATUS_LABEL[st][0]), 'Total'],
    cursos.map(c => [c.nome, ...ordem.map(st => fmtInt(c.ms.filter(m => m.status === st).length)), fmtInt(c.ms.length)]));

  // 4. distribuição das notas (RN 8)
  const notas = base.map(m => m.nota).filter(n => n != null);
  const faixas = Array.from({ length: 10 }, (_, i) => ({ de: i, ate: i + 1, n: 0 }));
  notas.forEach(n => { faixas[Math.min(9, Math.floor(n))].n++; });
  const abaixo = f => f.ate <= NOTA_CORTE;
  desenhar('g-notas', {
    type: 'bar',
    data: {
      labels: faixas.map(f => `${f.de}–${f.ate}`),
      datasets: [{ label: 'Matrículas', data: faixas.map(f => f.n), maxBarThickness: 24, borderRadius: 4, borderSkipped: 'start',
        backgroundColor: faixas.map(f => abaixo(f) ? COR.cancelado : COR.serie1) }],
    },
    options: {
      scales: { x: eixoX({ title: { display: true, text: 'Nota final', color: COR.texto } }), y: eixoY() },
      plugins: {
        legend: { onClick: () => {}, labels: { generateLabels: () => [
          { text: `Abaixo do corte (${fmt(NOTA_CORTE)}) · ${fmtInt(faixas.filter(abaixo).reduce((a, f) => a + f.n, 0))}`, fillStyle: COR.cancelado, strokeStyle: COR.cancelado, pointStyle: 'rect', lineWidth: 0, fontColor: COR.texto },
          { text: `Aprovado · ${fmtInt(faixas.filter(f => !abaixo(f)).reduce((a, f) => a + f.n, 0))}`, fillStyle: COR.serie1, strokeStyle: COR.serie1, pointStyle: 'rect', lineWidth: 0, fontColor: COR.texto },
        ] } },
        tooltip: { callbacks: { title: c => `Nota ${c[0].label}`, label: c => `${fmtInt(c.parsed.y)} matrículas (${fmtPct(c.parsed.y / notas.length * 100)})` } },
      },
    },
  }, notas.length ? '' : 'Nenhuma nota registrada para os filtros atuais');
  $('g-notas-sub').textContent = `${fmtInt(notas.length)} notas · média ${fmt(media(notas))} · faixas abaixo da nota de corte em vermelho`;
  tabelaDados('g-notas', ['Faixa', 'Matrículas', 'Situação'], faixas.map(f => [f.de + '–' + f.ate, fmtInt(f.n), abaixo(f) ? 'Abaixo do corte' : 'Aprovado']));
}

// ---------- ações ----------
function exportar() {
  const cab = ['id_servidor', 'nome', 'secretaria', 'status', 'avanco_pct', 'nota_media', 'ultimo_acesso', 'cursos'];
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const linhas = estado.linhas.map(l => [l.id, l.nome, l.secretaria, STATUS_LABEL[l.status][0], Math.round(l.avanco),
    l.nota == null ? '' : l.nota.toFixed(1), l.ultimo ? l.ultimo.toISOString().slice(0, 10) : '', l.cursos].map(q).join(','));
  const blob = new Blob(['\uFEFF' + [cab.join(','), ...linhas].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `relatorio-dashboard-${db.ref.toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  registrarAuditoria('exportar_relatorio', 0);
  toast(`Relatório exportado com ${fmtInt(estado.linhas.length)} servidores.`);
}

function ligarEventos() {
  $('filtros').addEventListener('submit', e => {
    e.preventDefault();
    lerFiltrosDoForm();
    estado.pagina = 1;
    montarFiltros();
    salvarUltimaConfig();
    render('aplicar_filtros');
  });
  $('f-trilha').addEventListener('change', () => { lerFiltrosDoForm(); montarFiltros(); });

  $('views').addEventListener('click', e => {
    const apagar = e.target.closest('[data-apagar]');
    if (apagar) {
      const lista = viewsGestor();
      const [removida] = lista.splice(+apagar.dataset.apagar, 1);
      gravarViews(lista);
      renderViews();
      toast(`Visualização "${removida.nome}" excluída.`);
      return;
    }
    const chip = e.target.closest('[data-view]');
    if (!chip) return;
    const v = chip.dataset.view === '' ? { filtros: FILTROS_PADRAO, ordem: ORDEM_PADRAO } : viewsGestor()[+chip.dataset.view];
    estado.filtros = { ...FILTROS_PADRAO, ...v.filtros };
    estado.ordem = { ...ORDEM_PADRAO, ...v.ordem };
    estado.pagina = 1;
    montarFiltros();
    salvarUltimaConfig();
    render('aplicar_visualizacao');
  });

  $('form-salvar').addEventListener('submit', e => {
    e.preventDefault();
    const nome = $('salvar-nome').value.trim();
    if (nome.length < 3) {
      $('salvar-field').classList.add('error');
      $('salvar-help').textContent = 'Informe um nome com pelo menos 3 caracteres.';
      return;
    }
    lerFiltrosDoForm();
    const lista = viewsGestor();
    const idx = lista.findIndex(v => norm(v.nome) === norm(nome));
    const registro = { nome, filtros: { ...estado.filtros }, ordem: { ...estado.ordem }, atualizada: new Date().toISOString() };
    if (idx >= 0) lista[idx] = registro; else lista.push(registro);
    gravarViews(lista);
    $('salvar-nome').value = '';
    $('salvar-field').classList.remove('error');
    $('salvar-help').textContent = '';
    location.hash = '';
    renderViews();
    toast(idx >= 0 ? `Visualização "${nome}" atualizada.` : `Visualização "${nome}" salva.`);
  });

  document.querySelector('thead').addEventListener('click', e => {
    const th = e.target.closest('th.sort');
    if (!th) return;
    const col = th.dataset.col;
    const dir = estado.ordem.col === col
      ? (estado.ordem.dir === 'asc' ? 'desc' : 'asc')
      : (col === 'nome' || col === 'secretaria' ? 'asc' : 'desc');
    estado.ordem = { col, dir };
    estado.pagina = 1;
    salvarUltimaConfig();
    render('ordenar_tabela');
  });

  $('paginacao').addEventListener('click', e => {
    const b = e.target.closest('button[data-pag]');
    if (!b || b.disabled) return;
    estado.pagina = +b.dataset.pag;
    render('paginar_tabela');
  });

  let buscaTimer;
  $('busca').addEventListener('input', e => {
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(() => { estado.busca = e.target.value; estado.pagina = 1; render('buscar_servidor'); }, 250);
  });

  $('meta-input').addEventListener('change', e => {
    const v = Math.round(+e.target.value);
    const cfg = lerLS(LS.config, {});
    cfg[GESTOR.id] = { ...(cfg[GESTOR.id] || {}), meta: v > 0 ? v : undefined };
    gravarLS(LS.config, cfg);
    render('alterar_meta');
  });

  $('btn-exportar').addEventListener('click', exportar);

  $('audit-limpar').addEventListener('click', () => { gravarLS(LS.auditoria, []); renderAuditoria(); });
}

// ---------- inicialização ----------
async function iniciar() {
  ligarEventos();
  renderAuditoria();
  const testes = await carregarBase();
  if (!testes) {
    $('subtitulo').textContent = 'Dados indisponíveis';
    return;
  }
  const ultima = configGestor().ultima;
  if (ultima) {
    estado.filtros = { ...FILTROS_PADRAO, ...ultima.filtros };
    estado.ordem = { ...ORDEM_PADRAO, ...ultima.ordem };
  }
  montarFiltros();
  render('render_inicial');
}

iniciar();
