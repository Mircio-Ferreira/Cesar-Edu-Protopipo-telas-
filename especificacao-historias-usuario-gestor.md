# C.E.S.A.R School — Ciência da Computação
## Especificação de Requisitos Funcionais e Histórias de Usuário
### Perfil: Gestor da Trilha de Aprendizagem (CESAR EDU / Conecta Recife)

**Disciplina:** Projetos 5 / Requisitos de Software & AVD | **Ano/Semestre:** 2026.02  
**Equipe (Grupo 02):** Amanda Luz Chaves, Eric Gonçalves Albuquerque, Gabriel Aniceto de Sousa Alencar Barros, Mariana Medeiros de Barros Correia, Mircio Ferreira dos Santos Neto, Wiliam de Souza  
**Referência Metodológica:** Mircio Funcionalidades Atividade 2026.02.pdf  

---

## 1. Visão Geral e Contexto do Perfil

Este documento estabelece a Especificação de Histórias de Usuário e Requisitos Funcionais para o perfil do **Gestor da Trilha de Aprendizagem** no sistema CESAR EDU, seguindo rigorosamente a estrutura metodológica adotada na atividade oficial de Requisitos de Software (`Mircio Funcionalidades Atividade 2026.02.pdf`).

Todas as funcionalidades detalham o comportamento operacional do sistema, entidades do banco de dados relacional envolvidas, regras de negócio numeradas, mapeamento das consultas e verificações do banco de dados em linguagem descritiva, e a classificação da complexidade computacional.

---

## 2. Detalhamento Técnico das Funcionalidades do Gestor

### Funcionalidade 1 ( Complexidade: Alta )

* **Título:** Dashboard Analítico de Métricas, Indicadores e Filtros Interativos do Gestor
* **Descrição:** Permite que o gestor da trilha visualize indicadores analíticos consolidados de desempenho e engajamento da sua equipe/secretaria, aplicando filtros dinâmicos (período, curso, secretaria e status) e alterando a estrutura do banco de dados em tempo de execução através da gravação de visualizações salvas (`DashboardConfigGestor`) e registros de auditoria (`DashboardLogConsulta`).
* **Entidades envolvidas:** `Gestor`, `TrilhaDeAprendizagem`, `Curso`, `Servidor`, `MatriculaTrilha`, `MatriculaCurso`, `AvaliacaoQuiz`, `PesquisaSatisfacao`, `DashboardConfigGestor`, `DashboardLogConsulta`

#### Regras de negócio

##### RN 1
* **Título:** Restrição de Visibilidade e Restrição de Escopo da Trilha
* **Descrição:** O gestor logado visualiza exclusivamente os dados analíticos dos servidores e cursos vinculados às trilhas sob sua responsabilidade direta ou secretarias associadas ao seu perfil.
* **Consultas:** Verificar no banco de dados se o identificador do gestor logado possui vínculo ativo com a trilha de aprendizagem e filtrar as matrículas pertencentes a essa trilha.
* **Complexidade:** Baixa

##### RN 2
* **Título:** Persistência e Alteração de Filtros Customizados (Custom Views)
* **Descrição:** O sistema permite que o gestor salve, atualize e altere suas configurações de filtros, ordenações e layouts de cards do dashboard no banco de dados. Ao aplicar um novo filtro, a aplicação atualiza ou insere a preferência na tabela de configurações.
* **Consultas:** Pesquisar e atualizar os registros na tabela de configurações do dashboard do gestor, associando os parâmetros em formato JSON ao identificador do gestor.
* **Complexidade:** Média

##### RN 3
* **Título:** Auditoria Operacional de Consultas Analíticas (Dashboard Logging)
* **Descrição:** A cada renderização ou alteração de filtro no dashboard, o sistema registra um evento de auditoria no banco gravando o timestamp, ID do gestor, tipo de métrica consultada e o tempo de execução em milissegundos.
* **Consultas:** Inserir novo registro de log na tabela de auditoria de consultas do dashboard com os metadados do acesso e performance.
* **Complexidade:** Baixa

##### RN 4
* **Título:** Cálculo Dinâmico do Indicador de Progresso Coletivo e Meta do Mês
* **Descrição:** O dashboard calcula em tempo real o somatório das horas de capacitação concluídas pela equipe no mês contra a meta institucional. Servidores com status 'Concluído' em módulos contam para o acumulado total.
* **Consultas:** Somar a carga horária dos cursos concluídos cruzando os dados das matrículas de cursos com os módulos finalizados no mês corrente para a trilha do gestor.
* **Complexidade:** Média

##### RN 5
* **Título:** Mapeamento da Tabela de Acompanhamento Individualizado e Status de Servidor
* **Descrição:** Apresenta listagem nominal dos servidores com o percentual de avanço na trilha, notas acumuladas e status (Não Iniciado, Em Andamento, Concluído). Permite ordenação e paginação no banco de dados.
* **Consultas:** Pesquisar a lista de servidores vinculados à trilha agrupando o progresso por aluno, aplicando paginação e ordenação conforme a seleção do gestor.
* **Complexidade:** Média

##### RN 6
* **Título:** Processamento da Fila de Homologação de Matrículas em Tempo Real
* **Descrição:** Exibe a contagem e a lista de solicitações pendentes de alunos para ingressar na trilha. A alteração de estado no dashboard atualiza o registro de pendência no banco de dados.
* **Consultas:** Contar e listar as solicitações de acesso a trilhas com status pendente destinadas às trilhas sob gestão do usuário logado.
* **Complexidade:** Baixa

##### RN 7
* **Título:** Cálculo da Taxa Média de Conclusão de Notas na Primeira Tentativa
* **Descrição:** Calcula o percentual de alunos que obtiveram nota igual ou superior à nota de corte do quiz já na primeira submissão da prova do curso.
* **Consultas:** Contar o número de alunos distintos aprovados na primeira tentativa do quiz e dividir pelo total de alunos que realizaram o exame na trilha.
* **Complexidade:** Alta

##### RN 8
* **Título:** Cálculo da Média Geral de Notas por Curso e Índice de Reprovação
* **Descrição:** Consolida a média aritmética das notas finais por curso e calcula a taxa de reprovação acumulada (percentual de exames com nota abaixo do mínimo exigido).
* **Consultas:** Calcular a média aritmética das notas dos quizzes por curso e contar a quantidade de tentativas reprovadas sobre o total de tentativas realizadas.
* **Complexidade:** Média

##### RN 9
* **Título:** Análise de Taxa de Evasão (Abandono) e Comparativo entre Cursos da Trilha
* **Descrição:** Mapeia o percentual de servidores que iniciaram a trilha mas não registraram progresso por mais de 45 dias ou cancelaram a matrícula, permitindo comparar a retenção entre diferentes cursos da trilha.
* **Consultas:** Agrupar e calcular a razão entre matrículas ativas e matrículas canceladas ou inativas por curso para compor o gráfico comparativo.
* **Complexidade:** Alta

---

### Funcionalidade 2 ( Complexidade: Fácil )

* **Título:** Cadastro de Contas e Vinculação Fixo-Irrevogável de Professores da Trilha
* **Descrição:** Permite que o gestor cadastre novos professores no sistema vinculados à sua trilha. O cadastro gera uma conta com credencial provisória que deve ser alterada no primeiro acesso. O vínculo entre o professor e a trilha é gravado de forma fixa e permanente no banco de dados, não podendo ser alterado posteriormente.
* **Entidades envolvidas:** `Gestor`, `Professor`, `TrilhaDeAprendizagem`, `VinculoProfessorTrilha`, `Usuario`

#### Regras de negócio

##### RN 1
* **Título:** Permissão Exclusiva de Cadastro ao Gestor da Trilha
* **Descrição:** Apenas o gestor autenticado e responsável por ao menos uma trilha possui permissão para cadastrar novos usuários com o perfil de 'Professor'.
* **Consultas:** Verificar no banco de dados se o identificador do usuário autenticado possui o perfil de Gestor ativo.
* **Complexidade:** Baixa

##### RN 2
* **Título:** Validação de Unicidade de CPF e E-mail Institucional
* **Descrição:** O sistema impede a criação de contas de professores com CPF ou e-mail já cadastrados na tabela de usuários.
* **Consultas:** Pesquisar na tabela de usuários se já existe registro com o CPF ou e-mail informados. Caso encontre, bloqueia o cadastro.
* **Complexidade:** Baixa

##### RN 3
* **Título:** Atribuição Fixo-Irrevogável à Trilha do Gestor
* **Descrição:** No ato do cadastro, o sistema insere o registro de vínculo na tabela de vínculo entre professor e trilha. Esse vínculo é definitivo e imutável no banco de dados, bloqueando qualquer transferência posterior.
* **Consultas:** Inserir registro na tabela de vínculo indicando o identificador do professor e da trilha. O backend rejeita qualquer tentativa de alteração ou exclusão dessa associação.
* **Complexidade:** Média

---

### Funcionalidade 3 ( Complexidade: Fácil )

* **Título:** Cadastro de Contas e Matrícula Direta de Alunos (Servidores Públicos) da Secretaria
* **Descrição:** Permite que o gestor cadastre novos alunos (servidores públicos municipais) no sistema e os vincule diretamente à sua secretaria e trilha de aprendizagem. O cadastro gera uma conta de usuário com credencial provisória que deve ser alterada obrigatoriamente no primeiro acesso, matriculando o servidor na trilha de forma imediata.
* **Entidades envolvidas:** `Gestor`, `Servidor`, `TrilhaDeAprendizagem`, `MatriculaTrilha`, `Usuario`

#### Regras de negócio

##### RN 1
* **Título:** Permissão Exclusiva de Cadastro de Servidores ao Gestor
* **Descrição:** Apenas o gestor autenticado e responsável pela secretaria/trilha possui permissão para cadastrar novos servidores alunos no sistema.
* **Consultas:** Verificar na tabela de usuários se o gestor autenticado possui autorização ativa para gestão da secretaria correspondente.
* **Complexidade:** Baixa

##### RN 2
* **Título:** Validação de Unicidade de CPF e E-mail Institucional do Servidor
* **Descrição:** O sistema verifica se o CPF ou o e-mail institucional do servidor público já constam na base de dados de usuários.
* **Consultas:** Consultar na tabela de usuários a existência prévia de registros com o mesmo CPF ou e-mail. Se localizado, impede a duplicidade.
* **Complexidade:** Baixa

##### RN 3
* **Título:** Vinculação de Secretaria e Matrícula Automática na Trilha
* **Descrição:** Ao concluir o cadastro, o sistema associa o servidor à secretaria de origem do gestor e cria de forma automática o registro de matrícula ativa na trilha de aprendizagem.
* **Consultas:** Inserir novo registro na tabela de servidores vinculando a secretaria e criar a entrada na tabela de matrículas da trilha com status ativo.
* **Complexidade:** Média

---

### Funcionalidade 4 ( Complexidade: Fácil )

* **Título:** Gestão e Homologação de Solicitações de Acesso Interdisciplinar a Outras Trilhas
* **Descrição:** Permite ao gestor visualizar a fila de pedidos de servidores para ingressar em trilhas fora do escopo da sua secretaria nativa. O gestor pode homologar (aprovar) ou indeferir (rejeitar) o pedido. A aprovação gera a matrícula automática na trilha e o indeferimento exige justificativa registrada no banco de dados.
* **Entidades envolvidas:** `Gestor`, `Servidor`, `TrilhaDeAprendizagem`, `SolicitacaoAcessoTrilha`, `MatriculaTrilha`

#### Regras de negócio

##### RN 1
* **Título:** Listagem e Filtragem de Solicitações Pendentes da Trilha
* **Descrição:** O gestor visualiza apenas as solicitações de acesso cujo estado seja 'PENDENTE' destinadas às trilhas sob sua gestão.
* **Consultas:** Consultar as solicitações de acesso filtrando por status pendente e direcionadas às trilhas sob responsabilidade do gestor logado.
* **Complexidade:** Baixa

##### RN 2
* **Título:** Obrigatoriedade de Justificativa no Indeferimento (Status REJEITADO)
* **Descrição:** Caso o gestor opte por indeferir a solicitação, o sistema exige o preenchimento de um parecer justificativo (mínimo 10 caracteres). O status é alterado no banco para 'REJEITADO' gravando o parecer e a data.
* **Consultas:** Atualizar o registro da solicitação de acesso gravando o status rejeitado, o parecer explicativo e a data/hora da avaliação.
* **Complexidade:** Baixa

##### RN 3
* **Título:** Homologação e Criação Automática de Matrícula (Status APROVADO)
* **Descrição:** Ao aprovar a solicitação, o sistema altera o status no banco para 'APROVADO' e insere automaticamente um novo registro ativo na tabela de matrículas da trilha.
* **Consultas:** Atualizar a solicitação para aprovada e inserir uma nova entrada ativa na tabela de matrículas da trilha em uma mesma transação.
* **Complexidade:** Média

##### RN 4
* **Título:** Prevenção de Solicitações Duplicadas
* **Descrição:** O sistema bloqueia a criação de novas solicitações se já houver pedido pendente ou matrícula ativa para o mesmo servidor e trilha.
* **Consultas:** Verificar previamente se o servidor já possui solicitação pendente ou matrícula ativa para a mesma trilha antes de processar o pedido.
* **Complexidade:** Baixa
