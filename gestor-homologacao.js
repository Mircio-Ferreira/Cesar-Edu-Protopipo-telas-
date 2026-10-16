// Homologação de solicitações interdisciplinares (Funcionalidade 4 de especificacao-historias-usuario-gestor.md).
// Uma única lógica para as três abas; a aba vem de <body data-aba="pendentes|aprovadas|indeferidas">.
// Lê solicitacoes_interdisciplinares.csv via gestor-dados.js e grava as decisões no localStorage.

const ABA = document.body.dataset.aba;
const POR_PAGINA = 10;
const STATUS_ABA = { pendentes: 'pendente', aprovadas: 'aprovado', indeferidas: 'rejeitado' };
const estado = { pagina: 1, busca: '', curso: '', secretaria: '', solicitacaoAtual: null };

const solicitacoesDoEscopo = status => db.solicitacoes.filter(s => s.status === status && db.cursosEscopo.has(s.curso));
const servidorDe = s => db.servidores.get(s.servidor) || { nome: s.servidor, secretaria: s.secretariaServidor || '—' };
const secretariaDe = s => s.secretariaServidor || servidorDe(s).secretaria;
const cursoDe = s => db.cursos.get(s.curso) || { nome: s.curso, trilha: '—', secretaria: s.secretariaCurso || '—', carga: 0 };

function montarFiltros() {
  const cursos = [...db.cursosEscopo].map(id => db.cursos.get(id)).sort((a, b) => a.nome.localeCompare(b.nome));
  preencher($('f-curso'), cursos.map(c => [c.id, c.nome]), 'Todos os cursos');
  const secs = [...new Set(db.solicitacoes.filter(s => db.cursosEscopo.has(s.curso)).map(secretariaDe))].sort();
  preencher($('f-secretaria'), secs.map(s => [s, s]), 'Todas as secretarias');
}

function preencher(el, opcoes, rotulo) {
  el.innerHTML = `<option value="">${esc(rotulo)}</option>` + opcoes.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
}

function filtradas() {
  const termo = norm(estado.busca);
  const lista = solicitacoesDoEscopo(STATUS_ABA[ABA]).filter(s =>
    (!estado.curso || s.curso === estado.curso) &&
    (!estado.secretaria || secretariaDe(s) === estado.secretaria) &&
    (!termo || norm(`${servidorDe(s).nome} ${s.servidor} ${s.id} ${cursoDe(s).nome}`).includes(termo)));
  // fila pendente em ordem de chegada; decididas da mais recente para a mais antiga
  const data = s => +(ABA === 'pendentes' ? s.data : s.dataDecisao || s.data) || 0;
  return lista.sort((a, b) => ABA === 'pendentes' ? data(a) - data(b) : data(b) - data(a));
}

function render() {
  const cont = { pendentes: solicitacoesDoEscopo('pendente').length, aprovadas: solicitacoesDoEscopo('aprovado').length, indeferidas: solicitacoesDoEscopo('rejeitado').length };
  for (const k in cont) $(`cnt-${k}`).textContent = fmtInt(cont[k]);
  $('side-pendentes').textContent = cont.pendentes;
  $('badge-total').textContent = `${fmtInt(cont[ABA])} ${ABA}`;

  const lista = filtradas();
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  estado.pagina = Math.min(estado.pagina, paginas);
  const ini = (estado.pagina - 1) * POR_PAGINA;
  const pagina = lista.slice(ini, ini + POR_PAGINA);
  const vazio = {
    pendentes: 'Nenhuma solicitação pendente para os filtros atuais.',
    aprovadas: 'Nenhuma solicitação aprovada para os filtros atuais.',
    indeferidas: 'Nenhuma solicitação indeferida para os filtros atuais.',
  }[ABA];

  if (ABA === 'aprovadas') {
    $('lista').innerHTML = pagina.map(linhaAprovada).join('') || `<tr><td colspan="5" class="muted">${vazio}</td></tr>`;
  } else {
    const card = ABA === 'pendentes' ? cardPendente : cardIndeferida;
    $('lista').innerHTML = pagina.map(card).join('') || `<div class="card"><p class="muted">${vazio}</p></div>`;
  }
  $('pag-info').textContent = lista.length
    ? `Mostrando ${ini + 1}–${ini + pagina.length} de ${fmtInt(lista.length)} solicitações`
    : 'Nenhuma solicitação';
  renderPaginacao($('paginacao'), estado.pagina, paginas);
}

function cabecalhoCard(s, direita) {
  const serv = servidorDe(s);
  return `<div class="row between">
    <div class="who"><span class="avatar">${esc(iniciais(serv.nome))}</span>
      <div><b class="strong">${esc(serv.nome)}</b><small>${esc([secretariaDe(s), serv.cargo].filter(Boolean).join(' · '))}</small></div></div>
    <div class="row">${direita}</div>
  </div>`;
}

function detalheCurso(s) {
  const c = cursoDe(s);
  return `Trilha ${c.trilha} · ${c.secretaria}${c.carga ? ` · ${fmtInt(c.carga)} h` : ''}`;
}

function cardPendente(s) {
  const { matricula, duplicada } = conflitosSolicitacao(s);
  const alertas = [];
  if (matricula) {
    const [rotulo] = STATUS_LABEL[matricula.status];
    alertas.push(`O servidor já possui matrícula ativa neste curso (${rotulo}, ${Math.round(matricula.pct)}%). A aprovação não criará uma nova matrícula.`);
  }
  if (duplicada) alertas.push('Existe outra solicitação pendente do mesmo servidor para este curso.');
  return `<div class="card" style="gap:12px">
    ${cabecalhoCard(s, `<span class="badge orange">${esc(cursoDe(s).nome)}</span><span class="small muted">${relativo(s.data)}</span>`)}
    <div class="notice blue" style="background:var(--creme);color:var(--navy)">
      <b class="small">Curso solicitado</b>
      <p style="font-size:13px;line-height:18px">${esc(detalheCurso(s))} · Solicitado em ${fmtData(s.data)} · ${esc(s.id)}</p>
    </div>
    ${alertas.map(a => `<div class="notice"><p style="font-size:13px;line-height:18px">${esc(a)}</p></div>`).join('')}
    <div class="row end">
      <button type="button" class="btn danger sm" data-indeferir="${esc(s.id)}">Indeferir</button>
      <button type="button" class="btn accent sm" data-aprovar="${esc(s.id)}">Aprovar</button>
    </div>
  </div>`;
}

function linhaAprovada(s) {
  const serv = servidorDe(s);
  const c = cursoDe(s);
  const m = db.matriculas.find(x => x.servidor === s.servidor && x.curso === s.curso && x.status !== 'cancelado')
    || db.matriculas.find(x => x.servidor === s.servidor && x.curso === s.curso);
  const situacao = !m ? '<span class="badge yellow">Sem matrícula registrada</span>'
    : m.status === 'cancelado' ? '<span class="badge red">Matrícula cancelada</span>'
    : `<span class="badge green">Matriculado</span> <span class="small muted">${STATUS_LABEL[m.status][0]} · ${Math.round(m.pct)}%</span>`;
  return `<tr>
    <td><div class="who"><span class="avatar">${esc(iniciais(serv.nome))}</span>
      <div><b class="strong">${esc(serv.nome)}</b><small>${esc(secretariaDe(s))}</small></div></div></td>
    <td><b class="strong">${esc(c.nome)}</b><br><span class="small muted">Trilha ${esc(c.trilha)}</span></td>
    <td class="muted">${fmtData(s.data)}</td>
    <td class="muted">${s.dataDecisao ? fmtData(s.dataDecisao) : '—'}</td>
    <td>${situacao}</td>
  </tr>`;
}

function cardIndeferida(s) {
  const parecer = s.parecer?.trim();
  return `<div class="card" style="gap:12px">
    ${cabecalhoCard(s, `<span class="badge orange">${esc(cursoDe(s).nome)}</span><span class="badge red">Indeferida</span>`)}
    <div class="row" style="gap:24px">
      <span class="small muted">Solicitado em ${fmtData(s.data)}</span>
      <span class="small muted">Decidido em ${s.dataDecisao ? fmtData(s.dataDecisao) : '—'}</span>
      <span class="small muted">${esc(detalheCurso(s))}</span>
    </div>
    <div class="notice red" style="background:var(--vermelho-claro)">
      <b class="small">Justificativa do gestor</b>
      <p style="font-size:13px;line-height:18px">${parecer ? esc(parecer) : 'Parecer não registrado no dataset.'}</p>
    </div>
  </div>`;
}

function ligarEventos() {
  let timer;
  $('f-busca').addEventListener('input', e => {
    clearTimeout(timer);
    timer = setTimeout(() => { estado.busca = e.target.value; estado.pagina = 1; render(); }, 200);
  });
  $('f-curso').addEventListener('change', e => { estado.curso = e.target.value; estado.pagina = 1; render(); });
  $('f-secretaria').addEventListener('change', e => { estado.secretaria = e.target.value; estado.pagina = 1; render(); });
  $('paginacao').addEventListener('click', e => {
    const b = e.target.closest('button[data-pag]');
    if (!b || b.disabled) return;
    estado.pagina = +b.dataset.pag;
    render();
    window.scrollTo({ top: 0 });
  });
  if (ABA !== 'pendentes') return;

  $('lista').addEventListener('click', e => {
    const ap = e.target.closest('[data-aprovar]');
    const ind = e.target.closest('[data-indeferir]');
    const id = ap?.dataset.aprovar || ind?.dataset.indeferir;
    if (!id) return;
    const s = db.solicitacoes.find(x => x.id === id);
    const c = cursoDe(s);
    estado.solicitacaoAtual = id;
    if (ap) {
      const { matricula } = conflitosSolicitacao(s);
      $('aprovar-sub').textContent = matricula
        ? `${servidorDe(s).nome} já possui matrícula ativa em ${c.nome}. A solicitação será aprovada sem criar outra matrícula.`
        : `${servidorDe(s).nome} será matriculado automaticamente em ${c.nome} (Trilha ${c.trilha}) e terá acesso imediato aos cursos.`;
      location.hash = 'aprovar';
    } else {
      $('indeferir-sub').textContent = `${servidorDe(s).nome} · ${c.nome}`;
      $('indeferir-parecer').value = '';
      $('indeferir-parecer').dispatchEvent(new Event('input'));
      location.hash = 'indeferir';
    }
  });

  $('aprovar-ok').addEventListener('click', () => {
    const r = registrarDecisao(estado.solicitacaoAtual, 'aprovado', '');
    if (r) toast(r.criada ? `${r.nome} aprovado e matriculado automaticamente.` : `${r.nome} aprovado · já possuía matrícula ativa neste curso.`);
    location.hash = '';
    render();
  });

  // F4 RN 2: parecer obrigatório com no mínimo 10 caracteres
  $('indeferir-parecer').addEventListener('input', e => {
    const n = e.target.value.trim().length;
    $('indeferir-help').textContent = `Escreva pelo menos 10 caracteres. Atual: ${n}.`;
    $('indeferir-field').classList.toggle('error', n > 0 && n < 10);
    $('indeferir-ok').disabled = n < 10;
  });
  $('form-indeferir').addEventListener('submit', e => {
    e.preventDefault();
    const parecer = $('indeferir-parecer').value.trim();
    if (parecer.length < 10) return;
    const r = registrarDecisao(estado.solicitacaoAtual, 'rejeitado', parecer);
    if (r) toast(`Solicitação de ${r.nome} indeferida.`);
    location.hash = '';
    render();
  });
}

async function iniciar() {
  ligarEventos();
  if (!(await carregarBase())) return;
  montarFiltros();
  render();
}

iniciar();
