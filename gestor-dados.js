// Base compartilhada das telas do gestor: utilitários, preparação dos CSV de dashboard_links.js,
// escopo do gestor logado (RN 1) e decisões de homologação (Funcionalidade 4) salvas no localStorage.

const GESTOR = { id: 'GST-001', nome: 'Marina Souza' };
const LS = {
  views: 'cesaredu.gestor.views',
  config: 'cesaredu.gestor.config',
  auditoria: 'cesaredu.gestor.auditoria',
  homologacoes: 'cesaredu.gestor.homologacoes',
  professores: 'cesaredu.gestor.professores',
  alunos: 'cesaredu.gestor.alunos',
};
const STATUS_LABEL = {
  nao_iniciado: ['Não iniciado', ''],
  andamento: ['Em andamento', 'orange'],
  concluido: ['Concluído', 'green'],
  cancelado: ['Cancelado', 'red'],
};

let db = null;

// ---------- utilitários ----------
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[_-]+/g, ' ').trim();
const DIA = 864e5;
const dias = (a, b) => Math.max(0, Math.floor((b - a) / DIA));
const lerLS = (k, padrao) => { try { return JSON.parse(localStorage.getItem(k)) ?? padrao; } catch { return padrao; } };
const gravarLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const fmt = (n, casas = 1) => n == null || isNaN(n) ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const fmtInt = n => Math.round(n).toLocaleString('pt-BR');
const fmtPct = (n, casas = 0) => n == null || isNaN(n) ? '—' : `${fmt(n, casas)}%`;
const fmtData = d => d ? d.toLocaleDateString('pt-BR') : '—';
const iniciais = nome => {
  const p = String(nome || '?').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
};
const relativo = d => {
  if (!d) return '—';
  const n = dias(d, db.ref);
  return n === 0 ? 'hoje' : n === 1 ? 'há 1 dia' : `há ${n} dias`;
};
const media = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

function num(s) {
  if (s == null) return null;
  s = String(s).trim().replace('%', '');
  if (s === '' || /^(nan|null|none|na|n\/a|-)$/i.test(s)) return null;
  if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseData(s) {
  if (!s) return null;
  s = String(s).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(+m[3], m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function statusMatricula(bruto, pct) {
  const s = norm(bruto);
  if (/conclu|finaliz|aprovad/.test(s)) return 'concluido';
  if (/cancel|evad|evas|abandon|inativ|trancad|desist/.test(s)) return 'cancelado';
  if (/nao inic|nao comec|pendente/.test(s)) return 'nao_iniciado';
  if (/andamento|progresso|cursando|iniciad|ativ/.test(s)) return 'andamento';
  if (pct >= 100) return 'concluido';
  return pct > 0 ? 'andamento' : 'nao_iniciado';
}

function statusSolicitacao(bruto) {
  const s = norm(bruto);
  if (/indefer|rejeit|negad|recus|reprov/.test(s)) return 'rejeitado';
  if (/aprov|homolog|deferid|aceit/.test(s)) return 'aprovado';
  return 'pendente';
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('on'), 3200);
}

// ---------- preparação dos dados ----------
function prepararDados(brutos) {
  const cursos = new Map(brutos.cursos.map(c => [c.id_curso, {
    id: c.id_curso,
    nome: c.nome_curso || c.id_curso,
    trilha: c.trilha_associada || 'Sem trilha',
    secretaria: c.secretaria_proprietaria || '—',
    carga: num(c.carga_horaria_estimada_hs) || 0,
    professor: c.id_professor_responsavel,
    status: c.status_curso,
  }]));
  const servidores = new Map(brutos.servidores.map(s => [s.id_servidor, {
    id: s.id_servidor,
    nome: s.nome_completo || s.id_servidor,
    email: s.email_institucional,
    cargo: s.cargo,
    cpf: s.cpf_mascarado,
    status: s.status_conta,
    cadastro: parseData(s.data_cadastro),
    secretaria: s.secretaria_origem || '—',
  }]));

  // último acesso por servidor+curso a partir da telemetria
  const acessos = new Map();
  for (const t of brutos.telemetria) {
    const d = parseData(t.timestamp_inicio_sessao);
    if (!d) continue;
    const k = `${t.id_servidor}|${t.id_curso}`;
    if (!acessos.has(k) || acessos.get(k) < d) acessos.set(k, d);
  }

  // escalas: percentual pode vir 0–1 ou 0–100; nota pode vir 0–10 ou 0–100
  const pcts = brutos.matriculas.map(m => num(m.percentual_conclusao)).filter(n => n != null);
  const notas = brutos.matriculas.map(m => num(m.nota_final_quiz)).filter(n => n != null);
  const fatorPct = pcts.length && Math.max(...pcts) <= 1 ? 100 : 1;
  const fatorNota = notas.length && Math.max(...notas) > 10 ? 0.1 : 1;

  const matriculas = brutos.matriculas.map(m => {
    const pct = Math.min(100, (num(m.percentual_conclusao) ?? 0) * fatorPct);
    const nota = num(m.nota_final_quiz);
    const dataMat = parseData(m.data_matricula);
    const dataConc = parseData(m.data_conclusao);
    const status = statusMatricula(m.status_progresso, pct);
    const ultimo = [acessos.get(`${m.id_servidor}|${m.id_curso}`), dataConc, dataMat]
      .filter(Boolean).reduce((a, b) => (a > b ? a : b), null);
    return {
      id: m.id_matricula,
      servidor: m.id_servidor,
      curso: m.id_curso,
      dataMat,
      dataConc: status === 'concluido' ? dataConc : null,
      status,
      pct: status === 'concluido' ? 100 : pct,
      nota: nota == null ? null : nota * fatorNota,
      tentativas: num(m.numero_tentativas_quiz),
      ultimo,
    };
  }).filter(m => m.status !== 'cancelado'); // não há matrícula cancelada na plataforma: esses registros são ignorados

  const solicitacoes = brutos.solicitacoes.map(s => ({
    id: s.id_solicitacao,
    servidor: s.id_servidor,
    secretariaServidor: s.secretaria_servidor,
    curso: s.id_curso_solicitado,
    secretariaCurso: s.secretaria_proprietaria_curso,
    data: parseData(s.data_solicitacao),
    status: statusSolicitacao(s.status_homologacao),
    parecer: s.parecer_gestor,
  }));

  const pesquisas = brutos.pesquisas.map(p => ({
    servidor: p.id_servidor,
    curso: p.id_curso,
    csat: media([p.csat_didatica_1a5, p.csat_material_1a5, p.csat_plataforma_1a5].map(num).filter(n => n != null)),
    nps: num(p.nps_recomendacao_0a10),
    data: parseData(p.timestamp_resposta),
  }));

  // data de referência ("hoje" do dataset): última data registrada, limitada ao dia atual
  let ref = null;
  const considerar = d => { if (d && (!ref || d > ref)) ref = d; };
  matriculas.forEach(m => { considerar(m.dataMat); considerar(m.dataConc); });
  acessos.forEach(considerar);
  solicitacoes.forEach(s => considerar(s.data));
  const hoje = new Date();
  if (!ref || ref > hoje) ref = hoje;

  // RN 1: escopo do gestor = trilhas com cursos da secretaria do gestor (?secretaria=... simula outro gestor)
  const contagem = {};
  cursos.forEach(c => { contagem[c.secretaria] = (contagem[c.secretaria] || 0) + 1; });
  const secretarias = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a]);
  const pedida = new URLSearchParams(location.search).get('secretaria');
  const secretaria = secretarias.find(s => pedida && norm(s) === norm(pedida))
    || secretarias.find(s => /administra|sead/.test(norm(s)))
    || secretarias[0] || '—';
  const trilhas = [...new Set([...cursos.values()].filter(c => c.secretaria === secretaria).map(c => c.trilha))].sort();
  const cursosEscopo = new Set([...cursos.values()].filter(c => trilhas.includes(c.trilha)).map(c => c.id));

  db = { cursos, servidores, acessos, matriculas, solicitacoes, pesquisas, ref, secretaria, trilhas, cursosEscopo };
  aplicarHomologacoesSalvas();
  aplicarAlunosCadastrados();
}

// F3 RN 3: alunos cadastrados no protótipo entram na base de servidores com matrícula ativa na trilha.
function aplicarAlunosCadastrados() {
  for (const a of lerLS(LS.alunos, [])) {
    db.servidores.set(a.id, { id: a.id, nome: a.nome, email: a.email, cargo: a.cargo, cpf: a.cpf, secretaria: a.secretaria, status: 'Primeiro acesso pendente', cadastro: new Date(a.data), novo: true });
    for (const c of db.cursos.values()) {
      if (c.trilha !== a.trilha || db.matriculas.some(m => m.servidor === a.id && m.curso === c.id)) continue;
      db.matriculas.push({ id: `MAT-${a.id}-${c.id}`, servidor: a.id, curso: c.id, dataMat: db.ref, dataConc: null, status: 'nao_iniciado', pct: 0, nota: null, tentativas: null, ultimo: db.ref });
    }
  }
}

// F2 RN 2 / F3 RN 2: "tabela de usuários" = servidores do CSV + professores e alunos criados no protótipo.
function usuariosCadastrados() {
  return [
    ...[...db.servidores.values()].map(s => ({ id: s.id, cpf: s.cpf, email: s.email, nome: s.nome })),
    ...lerLS(LS.professores, []).map(p => ({ id: p.id, cpf: p.cpf, email: p.email, nome: p.nome })),
  ];
}

// O CSV traz CPF mascarado (ex.: ***.123.456-**): os asteriscos valem como coringa na comparação.
function cpfConfere(armazenado, digitado) {
  const a = String(armazenado || '').replace(/[^\d*]/g, '');
  const d = String(digitado || '').replace(/\D/g, '');
  if (a.length !== 11 || d.length !== 11) return false;
  return [...a].every((c, i) => c === '*' || c === d[i]);
}

function cpfValido(cpf) {
  const d = String(cpf).replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const n of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += +d[i] * (n + 1 - i);
    if ((soma * 10) % 11 % 10 !== +d[n]) return false;
  }
  return true;
}

function senhaProvisoria() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const v = crypto.getRandomValues(new Uint32Array(8));
  return 'Cesar@' + [...v].map(n => chars[n % chars.length]).join('');
}

// Decisões tomadas no protótipo ficam no localStorage e são reaplicadas sobre o CSV.
function aplicarHomologacoesSalvas() {
  const decisoes = lerLS(LS.homologacoes, {});
  for (const s of db.solicitacoes) {
    const d = decisoes[s.id];
    if (!d) continue;
    s.status = d.status;
    s.parecer = d.parecer || s.parecer;
    s.dataDecisao = new Date(d.data);
    if (d.status === 'aprovado') criarMatriculaHomologada(s);
  }
}

// F4 RN 3 + RN 4: aprovação gera matrícula ativa, sem duplicar matrícula já existente.
function criarMatriculaHomologada(s) {
  const existe = db.matriculas.some(m => m.servidor === s.servidor && m.curso === s.curso && m.status !== 'cancelado');
  if (existe) return false;
  db.matriculas.push({
    id: `MAT-HOM-${s.id}`, servidor: s.servidor, curso: s.curso, dataMat: db.ref, dataConc: null,
    status: 'nao_iniciado', pct: 0, nota: null, tentativas: null, ultimo: db.ref,
  });
  return true;
}


// F4 RN 2 / RN 3: grava a decisão (definitiva) e, se aprovada, cria a matrícula.
function registrarDecisao(id, status, parecer) {
  const s = db.solicitacoes.find(x => x.id === id);
  if (!s || s.status !== 'pendente') return null;
  const data = new Date();
  const decisoes = lerLS(LS.homologacoes, {});
  decisoes[id] = { status, parecer, data: data.toISOString(), id_gestor: GESTOR.id };
  gravarLS(LS.homologacoes, decisoes);
  s.status = status;
  s.parecer = parecer;
  s.dataDecisao = data;
  const criada = status === 'aprovado' ? criarMatriculaHomologada(s) : false;
  return { s, criada, nome: db.servidores.get(s.servidor)?.nome || s.servidor };
}

// F4 RN 4: matrícula ativa ou outra solicitação pendente para o mesmo servidor e curso.
function conflitosSolicitacao(s) {
  return {
    matricula: db.matriculas.find(m => m.servidor === s.servidor && m.curso === s.curso && m.status !== 'cancelado'),
    duplicada: db.solicitacoes.some(o => o !== s && o.status === 'pendente' && o.servidor === s.servidor && o.curso === s.curso),
  };
}

function pendentesDoEscopo() {
  return db.solicitacoes.filter(s => s.status === 'pendente' && db.cursosEscopo.has(s.curso)).length;
}

function linhaWho(nome, sub, avatarCls, direita) {
  return `<div class="row" style="padding:8px 0">
    <div class="who"><span class="avatar ${avatarCls}">${esc(iniciais(nome))}</span>
      <div><b class="strong">${esc(nome)}</b><small>${esc(sub)}</small></div></div>
    <span class="grow"></span>${direita}</div>`;
}

function renderPaginacao(el, pagina, paginas) {
  const nums = [];
  for (let p = 1; p <= paginas; p++) {
    if (p === 1 || p === paginas || Math.abs(p - pagina) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  el.innerHTML =
    `<button type="button" data-pag="${pagina - 1}" ${pagina === 1 ? 'disabled' : ''}>Anterior</button>` +
    nums.map(p => p === '…' ? '<span class="muted">…</span>' : `<button type="button" data-pag="${p}" class="${p === pagina ? 'on' : ''}">${p}</button>`).join('') +
    `<button type="button" data-pag="${pagina + 1}" ${pagina === paginas ? 'disabled' : ''}>Próxima</button>`;
}

// Carrega os CSV e prepara `db`. Mostra o erro em #status-carga e retorna os testes de cada fonte.
async function carregarBase() {
  const { dados, testes } = await carregarCsvs();
  const aviso = $('status-carga');
  const falhas = testes.filter(t => !t.ok);
  const descr = t => `${t.arquivo}: ${t.erro || (t.faltando.length ? 'colunas ausentes: ' + t.faltando.join(', ') : 'sem registros')}`;
  if (!dados.cursos.length) {
    aviso.className = 'notice red';
    aviso.innerHTML = `<b>Não foi possível carregar os datasets.</b><p>${falhas.map(t => esc(descr(t))).join('<br>')}</p>`;
    return null;
  }
  prepararDados(dados);
  if (falhas.length) {
    aviso.className = 'notice';
    aviso.innerHTML = `<b>Alguns datasets não carregaram corretamente.</b><p>${falhas.map(t => esc(descr(t))).join('<br>')}</p>`;
  } else {
    aviso.hidden = true;
  }
  $('side-pendentes').textContent = pendentesDoEscopo();
  $('gestor-secretaria').textContent = `Gestora · ${db.secretaria}`;
  console.info(`[gestor] ${testes.reduce((n, t) => n + t.registros.length, 0)} registros carregados`);
  return testes;
}
