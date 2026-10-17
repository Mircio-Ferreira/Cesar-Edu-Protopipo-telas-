// Cadastro de professor (Funcionalidade 2) e de aluno/servidor (Funcionalidade 3) de
// especificacao-historias-usuario-gestor.md. O tipo vem de <body data-tipo="professor|aluno">.
// A unicidade de CPF/e-mail é verificada contra servidores_estudantes.csv + cadastros salvos no localStorage.

const TIPO = document.body.dataset.tipo;
const POR_PAGINA = 8;
const estado = { pagina: 1, busca: '' };

const valor = campo => $(`f-${campo}`).value.trim();
const mascararCpf = d => `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;

function erro(campo, msg) {
  const f = $(`campo-${campo}`);
  const help = $(`help-${campo}`);
  f.classList.toggle('error', !!msg);
  if (!help.dataset.padrao) help.dataset.padrao = help.textContent;
  help.textContent = msg || help.dataset.padrao;
  help.hidden = !help.textContent;
  return !msg;
}

// RN 2 (F2 e F3): campos obrigatórios, CPF válido e CPF/e-mail únicos na tabela de usuários
function validar() {
  const usuarios = usuariosCadastrados();
  const nome = valor('nome');
  const cpf = valor('cpf').replace(/\D/g, '');
  const email = valor('email').toLowerCase();
  let ok = true;

  ok = erro('nome', nome.split(/\s+/).length < 2 ? 'Informe nome e sobrenome.' : '') && ok;

  const dupCpf = usuarios.find(u => cpfConfere(u.cpf, cpf));
  ok = erro('cpf', !cpfValido(cpf) ? 'CPF inválido.' : dupCpf ? `CPF já cadastrado na plataforma (${dupCpf.nome}).` : '') && ok;

  const dupEmail = usuarios.find(u => u.email && u.email.toLowerCase() === email);
  ok = erro('email', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Informe um e-mail válido.' : dupEmail ? `E-mail já cadastrado na plataforma (${dupEmail.nome}).` : '') && ok;

  if (TIPO === 'aluno') {
    const id = valor('matricula');
    ok = erro('matricula', !id ? 'Informe a matrícula funcional.' : db.servidores.has(id) ? 'Matrícula funcional já cadastrada.' : '') && ok;
    ok = erro('cargo', valor('cargo') ? '' : 'Informe o cargo.') && ok;
  }
  return ok ? { nome, cpf, email } : null;
}

// A trilha é sempre a do próprio gestor (uma por gestor): não há escolha nem edição.
function trilhaEscolhida() {
  return db.trilhas[0];
}

function montarTrilha() {
  const t = trilhaEscolhida();
  $('trilha-nome').textContent = t || '—';
  document.querySelectorAll('.trilha-atual').forEach(el => { el.textContent = t; });
  if (TIPO === 'aluno') {
    const n = [...db.cursos.values()].filter(c => c.trilha === t).length;
    $('cursos-trilha').textContent = `${n} ${n === 1 ? 'curso' : 'cursos'}`;
  }
}

// ---------- professor (F2) ----------
function cadastrarProfessor(dados) {
  const lista = lerLS(LS.professores, []);
  const prof = {
    id: `PROF-NOVO-${String(lista.length + 1).padStart(3, '0')}`,
    nome: dados.nome, cpf: mascararCpf(dados.cpf), email: dados.email,
    trilha: trilhaEscolhida(), // F2 RN 3: vínculo gravado uma única vez, sem edição posterior
    id_gestor: GESTOR.id, data: new Date().toISOString(), trocarSenha: true,
  };
  lista.push(prof);
  gravarLS(LS.professores, lista);
  return prof;
}

function linhasProfessores() {
  const novos = lerLS(LS.professores, []).filter(p => db.trilhas.includes(p.trilha)).reverse().map(p => ({
    nome: p.nome, sub: p.email, cursos: [], trilha: p.trilha, cadastro: new Date(p.data), novo: true,
  }));
  const porProf = new Map();
  for (const id of db.cursosEscopo) {
    const c = db.cursos.get(id);
    if (!c.professor) continue;
    if (!porProf.has(c.professor)) porProf.set(c.professor, []);
    porProf.get(c.professor).push(c);
  }
  const doCsv = [...porProf].sort((a, b) => b[1].length - a[1].length).map(([id, cursos]) => ({
    nome: id, sub: cursos.map(c => c.nome).join(', '), cursos, trilha: [...new Set(cursos.map(c => c.trilha))].join(', '), cadastro: null,
  }));
  return [...novos, ...doCsv];
}

function linhaProfessor(l) {
  const n = l.cursos.length;
  return `<tr>
    <td><div class="who"><span class="avatar">${esc(iniciais(l.nome))}</span>
      <div><b class="strong">${esc(l.nome)}</b><small>${esc(l.sub)}</small></div></div></td>
    <td>${l.novo ? '<span class="badge yellow">Sem cursos</span>' : `${n} ${n === 1 ? 'curso' : 'cursos'}`}</td>
    <td class="muted">${fmtData(l.cadastro)}</td>
    <td><span class="lock">Vínculo permanente</span><br><span class="small muted">${esc(l.trilha)}</span></td>
  </tr>`;
}

// ---------- aluno (F3) ----------
function cadastrarAluno(dados) {
  const lista = lerLS(LS.alunos, []);
  const aluno = {
    id: valor('matricula'), nome: dados.nome, cpf: mascararCpf(dados.cpf), email: dados.email,
    cargo: valor('cargo'), secretaria: db.secretaria, trilha: trilhaEscolhida(),
    id_gestor: GESTOR.id, data: new Date().toISOString(), trocarSenha: true,
  };
  lista.push(aluno);
  gravarLS(LS.alunos, lista);
  aplicarAlunosCadastrados();
  return aluno;
}

function linhasAlunos() {
  return [...db.servidores.values()]
    .filter(s => s.secretaria === db.secretaria)
    .sort((a, b) => (b.novo ? 1 : 0) - (a.novo ? 1 : 0) || (+b.cadastro || 0) - (+a.cadastro || 0));
}

function linhaAluno(s) {
  const cursos = db.matriculas.filter(m => m.servidor === s.id && db.cursosEscopo.has(m.curso)).length;
  return `<tr>
    <td><div class="who"><span class="avatar">${esc(iniciais(s.nome))}</span>
      <div><b class="strong">${esc(s.nome)}</b><small>${esc(s.email || s.id)}</small></div></div></td>
    <td>${esc(s.cargo || '—')}<br><span class="small muted">${esc(s.id)}</span></td>
    <td>${cursos ? `${cursos} ${cursos === 1 ? 'curso' : 'cursos'}` : '<span class="muted">—</span>'}</td>
  </tr>`;
}

// ---------- tabela ----------
function renderTabela() {
  if (!$('lista')) return; // a tela de professor não exibe a lista de cadastrados
  const termo = norm(estado.busca);
  let linhas = TIPO === 'professor' ? linhasProfessores() : linhasAlunos();
  if (termo) linhas = linhas.filter(l => norm(`${l.nome} ${l.sub || ''} ${l.email || ''} ${l.id || ''} ${l.cargo || ''}`).includes(termo));
  const paginas = Math.max(1, Math.ceil(linhas.length / POR_PAGINA));
  estado.pagina = Math.min(estado.pagina, paginas);
  const ini = (estado.pagina - 1) * POR_PAGINA;
  const pagina = linhas.slice(ini, ini + POR_PAGINA);
  $('lista').innerHTML = pagina.map(TIPO === 'professor' ? linhaProfessor : linhaAluno).join('')
    || `<tr><td colspan="${TIPO === 'professor' ? 4 : 3}" class="muted">Nenhum registro encontrado.</td></tr>`;
  $('total').textContent = fmtInt(linhas.length);
  $('pag-info').textContent = linhas.length ? `Mostrando ${ini + 1}–${ini + pagina.length} de ${fmtInt(linhas.length)}` : '';
  renderPaginacao($('paginacao'), estado.pagina, paginas);
}

function ligarEventos() {
  $('f-cpf').addEventListener('input', e => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 11);
    e.target.value = d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  });
  document.querySelectorAll('#form-cadastro input, #form-cadastro select').forEach(el =>
    el.addEventListener('input', () => { const f = el.closest('.field'); if (f?.classList.contains('error')) erro(f.id.replace('campo-', ''), ''); }));

  $('form-cadastro').addEventListener('submit', e => {
    e.preventDefault();
    if (!db || !db.trilhas.length) return;
    const dados = validar();
    if (!dados) return;
    const senha = senhaProvisoria();
    if (TIPO === 'professor') {
      const p = cadastrarProfessor(dados);
      $('ok-texto').textContent = `A conta de ${p.nome} foi criada e vinculada de forma permanente à trilha ${p.trilha}.`;
    } else {
      const a = cadastrarAluno(dados);
      const n = db.matriculas.filter(m => m.servidor === a.id).length;
      $('ok-texto').textContent = `A conta de ${a.nome} foi criada na ${a.secretaria} e matriculada na trilha ${a.trilha} (${n} ${n === 1 ? 'curso' : 'cursos'}).`;
    }
    $('ok-senha').textContent = senha;
    e.target.reset();
    estado.pagina = 1;
    renderTabela();
    location.hash = 'ok';
  });

  $('btn-copiar').addEventListener('click', () => {
    navigator.clipboard?.writeText($('ok-senha').textContent);
    toast('Senha provisória copiada.');
  });

  if ($('f-busca')) {
    let timer;
    $('f-busca').addEventListener('input', e => {
      clearTimeout(timer);
      timer = setTimeout(() => { estado.busca = e.target.value; estado.pagina = 1; renderTabela(); }, 200);
    });
    $('paginacao').addEventListener('click', e => {
      const b = e.target.closest('button[data-pag]');
      if (!b || b.disabled) return;
      estado.pagina = +b.dataset.pag;
      renderTabela();
    });
  }
}

async function iniciar() {
  ligarEventos();
  if (!(await carregarBase())) return;
  // F2 RN 1 / F3 RN 1: só o gestor responsável por ao menos uma trilha pode cadastrar
  if (!db.trilhas.length) {
    $('sem-permissao').hidden = false;
    return;
  }
  $('btn-cadastrar').disabled = false;
  if (TIPO === 'aluno') {
    $('secretaria-nome').textContent = db.secretaria;
    const cargos = [...new Set([...db.servidores.values()].map(s => s.cargo).filter(Boolean))].sort();
    $('f-cargo').innerHTML = '<option value="">Selecione</option>' + cargos.map(c => `<option>${esc(c)}</option>`).join('');
    const exemplo = [...db.servidores.keys()][0];
    if (exemplo) $('f-matricula').placeholder = `Ex.: ${exemplo}`;
  }
  montarTrilha();
  renderTabela();
}

iniciar();
