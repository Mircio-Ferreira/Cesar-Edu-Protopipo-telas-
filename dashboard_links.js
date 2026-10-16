// Fontes de dados do dashboard do gestor (datasets de teste do repositório avd-dataset).
// Cada fonte declara as colunas esperadas para que o carregamento valide o CSV recebido.
const CSV_FONTES = {
  cursos: {
    arquivo: 'cursos_trilhas.csv',
    url: 'https://raw.githubusercontent.com/eric-albuquer/avd-dataset/refs/heads/main/data/cursos_trilhas.csv',
    colunas: ['id_curso', 'nome_curso', 'trilha_associada', 'secretaria_proprietaria', 'carga_horaria_estimada_hs', 'id_professor_responsavel', 'quantidade_modulos', 'status_curso'],
  },
  solicitacoes: {
    arquivo: 'solicitacoes_interdisciplinares.csv',
    url: 'https://raw.githubusercontent.com/eric-albuquer/avd-dataset/refs/heads/main/data/solicitacoes_interdisciplinares.csv',
    colunas: ['id_solicitacao', 'id_servidor', 'secretaria_servidor', 'id_curso_solicitado', 'secretaria_proprietaria_curso', 'data_solicitacao', 'status_homologacao', 'parecer_gestor'],
  },
  servidores: {
    arquivo: 'servidores_estudantes.csv',
    url: 'https://raw.githubusercontent.com/eric-albuquer/avd-dataset/main/data/servidores_estudantes.csv',
    colunas: ['id_servidor', 'nome_completo', 'cpf_mascarado', 'email_institucional', 'secretaria_origem', 'cargo', 'data_cadastro', 'status_conta'],
  },
  matriculas: {
    arquivo: 'matriculas_progresso.csv',
    url: 'https://raw.githubusercontent.com/eric-albuquer/avd-dataset/main/data/matriculas_progresso.csv',
    colunas: ['id_matricula', 'id_servidor', 'id_curso', 'data_matricula', 'status_progresso', 'percentual_conclusao', 'nota_final_quiz', 'numero_tentativas_quiz', 'data_conclusao'],
  },
  pesquisas: {
    arquivo: 'pesquisa_csat_nps.csv',
    url: 'https://raw.githubusercontent.com/eric-albuquer/avd-dataset/main/data/pesquisa_csat_nps.csv',
    colunas: ['id_pesquisa', 'id_servidor', 'id_curso', 'csat_didatica_1a5', 'csat_material_1a5', 'csat_plataforma_1a5', 'nps_recomendacao_0a10', 'comentario_feedback', 'timestamp_resposta'],
  },
  telemetria: {
    arquivo: 'telemetria_acessos_logs.csv',
    url: 'https://raw.githubusercontent.com/eric-albuquer/avd-dataset/main/data/telemetria_acessos_logs.csv',
    colunas: ['id_log', 'id_servidor', 'id_curso', 'timestamp_inicio_sessao', 'tempo_estudado_minutos', 'tempo_aba_em_foco_minutos', 'quantidade_pausas_video', 'dispositivo'],
  },
};

// Parser CSV (RFC 4180): aceita campos entre aspas com vírgulas, aspas duplicadas e quebras de linha.
function parseCsv(texto) {
  const linhas = [];
  let linha = [];
  let campo = '';
  let aspas = false;
  texto = texto.replace(/^\uFEFF/, '');
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo); campo = '';
      if (linha.length > 1 || linha[0] !== '') linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }

  const cabecalho = (linhas.shift() || []).map(h => h.trim());
  const registros = linhas.map(valores => {
    const obj = {};
    cabecalho.forEach((h, idx) => { obj[h] = (valores[idx] ?? '').trim(); });
    return obj;
  });
  return { cabecalho, registros };
}

async function lerCsv(chave) {
  const fonte = CSV_FONTES[chave];
  const inicio = performance.now();
  const response = await fetch(fonte.url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Erro na requisição de ${fonte.arquivo}: ${response.status}`);
  const { cabecalho, registros } = parseCsv(await response.text());
  const faltando = fonte.colunas.filter(c => !cabecalho.includes(c));
  return {
    chave,
    arquivo: fonte.arquivo,
    url: fonte.url,
    registros,
    cabecalho,
    faltando,
    ms: Math.round(performance.now() - inicio),
  };
}

// Carrega todas as fontes em paralelo. Retorna { dados: {chave: registros}, testes: [...] }.
async function carregarCsvs() {
  const chaves = Object.keys(CSV_FONTES);
  const resultados = await Promise.allSettled(chaves.map(lerCsv));
  const dados = {};
  const testes = resultados.map((r, i) => {
    const chave = chaves[i];
    if (r.status === 'fulfilled') {
      dados[chave] = r.value.registros;
      return { ...r.value, ok: r.value.faltando.length === 0 && r.value.registros.length > 0 };
    }
    dados[chave] = [];
    console.error('Erro ao buscar o CSV:', r.reason);
    return { chave, arquivo: CSV_FONTES[chave].arquivo, url: CSV_FONTES[chave].url, registros: [], faltando: [], erro: String(r.reason.message || r.reason), ok: false };
  });
  return { dados, testes };
}
