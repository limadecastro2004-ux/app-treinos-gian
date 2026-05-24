const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================
// USUÁRIOS (login/senha)
// ==========================
//
// Em memória, bom para começar. Aqui você cadastra seus usuários.
// username no formato primeiro.sobrenome
const USUARIOS = [
  // Coach (você)
  {
    username: 'coach.gian',
    senha: 'coachForte2024',
    tipo: 'coach',
    nome: 'Coach (Gian)',
    deveTrocarSenha: false
  },

  // Aluno de teste (opcional)
  {
    username: 'aluno.teste',
    senha: 'Aluno123',
    tipo: 'aluno',
    nome: 'Aluno Teste',
    deveTrocarSenha: true
  },

  // Aluno real – Diogo Tarlé Silva
  {
    username: 'diogo.silva',
    senha: 'DiogoInit2024',
    tipo: 'aluno',
    nome: 'Diogo Tarlé Silva',
    deveTrocarSenha: true
  }

  // Quando tiver novos alunos reais, adicione mais blocos aqui
  // seguindo esse mesmo padrão.
];

// ==========================
// "BANCO" DE DADOS (JSON)
// ==========================
const DATA_DIR = path.join(__dirname, 'data');
const TREINOS_FILE = path.join(DATA_DIR, 'treinos.json');
const PRECAND_FILE = path.join(DATA_DIR, 'pre-cadastros.json');

// Garante que a pasta data/ e os arquivos existam
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}
if (!fs.existsSync(TREINOS_FILE)) {
  fs.writeFileSync(TREINOS_FILE, '[]', 'utf-8');
}
if (!fs.existsSync(PRECAND_FILE)) {
  fs.writeFileSync(PRECAND_FILE, '[]', 'utf-8');
}

// Middleware para interpretar JSON no corpo das requisições
app.use(express.json());

// (Opcional) servir arquivos estáticos da pasta public, se você for usar
app.use(express.static(path.join(__dirname, 'public')));

// Rota para a página inicial -> abre o seu aplicativo.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'aplicativo.html'));
});

// ==========================
// LOGIN / SENHA
// ==========================

// POST /api/login
// body: { username, senha }
// resposta: 200 OK -> { username, tipo, nome, mustChangePassword }
//           400/401 -> { erro: ... }
app.post('/api/login', (req, res) => {
  const { username, senha } = req.body;

  if (!username || !senha) {
    return res
      .status(400)
      .json({ erro: 'Usuário e senha são obrigatórios.' });
  }

  const usuario = USUARIOS.find(
    u => u.username === username && u.senha === senha
  );

  if (!usuario) {
    return res
      .status(401)
      .json({ erro: 'Usuário ou senha inválidos.' });
  }

  return res.json({
    username: usuario.username,
    tipo: usuario.tipo,
    nome: usuario.nome,
    mustChangePassword: !!usuario.deveTrocarSenha
  });
});

// POST /api/alterar-senha
// body: { username, senhaAtual, novaSenha }
// usado para troca obrigatória no primeiro acesso (ou depois de reset manual)
app.post('/api/alterar-senha', (req, res) => {
  const { username, senhaAtual, novaSenha } = req.body;

  if (!username || !senhaAtual || !novaSenha) {
    return res
      .status(400)
      .json({ erro: 'Dados insuficientes para alterar a senha.' });
  }

  const usuario = USUARIOS.find(
    u => u.username === username && u.senha === senhaAtual
  );

  if (!usuario) {
    return res
      .status(401)
      .json({ erro: 'Usuário ou senha atual inválidos.' });
  }

  usuario.senha = novaSenha;
  usuario.deveTrocarSenha = false;

  return res.json({
    ok: true,
    mensagem: 'Senha alterada com sucesso.'
  });
});

// ==========================
// FUNÇÕES DE TREINOS
// ==========================
function lerTreinos() {
  try {
    const conteudo = fs.readFileSync(TREINOS_FILE, 'utf-8');
    return JSON.parse(conteudo);
  } catch (error) {
    console.error('Erro ao ler treinos.json:', error);
    return [];
  }
}

function salvarTreinos(dados) {
  fs.writeFileSync(
    TREINOS_FILE,
    JSON.stringify(dados, null, 2),
    'utf-8'
  );
}

// GET /api/treinos -> retorna todos os treinos salvos
app.get('/api/treinos', (req, res) => {
  const treinos = lerTreinos();
  res.json(treinos);
});

// POST /api/treinos -> salva/atualiza treinos de um "aluno"
// body: { aluno, dados }
// aqui "aluno" deve ser o username (ex.: joao.silva)
app.post('/api/treinos', (req, res) => {
  const novoTreino = req.body;

  if (!novoTreino || !novoTreino.aluno || !novoTreino.dados) {
    return res
      .status(400)
      .json({ error: 'Formato inválido. Envie { aluno, dados }.' });
  }

  const treinos = lerTreinos();

  const indexExistente = treinos.findIndex(
    t => t.aluno === novoTreino.aluno
  );

  if (indexExistente >= 0) {
    treinos[indexExistente] = novoTreino;
  } else {
    treinos.push(novoTreino);
  }

  salvarTreinos(treinos);

  return res.json({
    message: 'Treinos salvos com sucesso!',
    treino: novoTreino
  });
});

// ==========================
// PRÉ-CADASTRO
// ==========================
function lerPreCadastros() {
  try {
    const conteudo = fs.readFileSync(PRECAND_FILE, 'utf-8');
    return JSON.parse(conteudo);
  } catch (error) {
    console.error('Erro ao ler pre-cadastros.json:', error);
    return [];
  }
}

function salvarPreCadastros(lista) {
  fs.writeFileSync(
    PRECAND_FILE,
    JSON.stringify(lista, null, 2),
    'utf-8'
  );
}

// POST /api/pre-cadastro
// body: { nome, contato, objetivo }
app.post('/api/pre-cadastro', (req, res) => {
  const { nome, contato, objetivo } = req.body;

  if (!nome || !contato) {
    return res
      .status(400)
      .json({ erro: 'Nome e contato são obrigatórios.' });
  }

  const lista = lerPreCadastros();

  const novo = {
    id: Date.now(),
    nome,
    contato,
    objetivo: objetivo || '',
    data: new Date().toISOString()
  };

  lista.push(novo);
  salvarPreCadastros(lista);

  return res.json({ ok: true, mensagem: 'Pré-cadastro recebido.' });
});

// GET /api/pre-cadastro -> lista de pedidos (para você consultar)
app.get('/api/pre-cadastro', (req, res) => {
  const lista = lerPreCadastros();
  res.json(lista);
});

// ==========================
// Inicia o servidor
// ==========================
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});