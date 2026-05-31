const express = require('express');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURAÇÕES DE SEGURANÇA ---
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_muito_forte_e_aleatoria_aqui_troque_isso';
const TOKEN_EXPIRATION = '7d'; // 7 dias

// --- MIDDLEWARES ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// ==========================
// "BANCO" DE DADOS (JSON) - Treinos, Pré-cadastros, Sessões e AGORA USUÁRIOS
// ==========================
const DATA_DIR = path.join(__dirname, 'data');
const TREINOS_FILE = path.join(DATA_DIR, 'treinos.json');
const PRECAND_FILE = path.join(DATA_DIR, 'pre-cadastros.json');
const SESSOES_TREINO_FILE = path.join(DATA_DIR, 'sessoes_treino.json');
const USUARIOS_FILE = path.join(DATA_DIR, 'usuarios.json'); // NOVO ARQUIVO JSON PARA USUÁRIOS

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
if (!fs.existsSync(SESSOES_TREINO_FILE)) {
  fs.writeFileSync(SESSOES_TREINO_FILE, '[]', 'utf-8');
}
// NOVO: Cria o arquivo de usuários se não existir e popula com usuários iniciais
if (!fs.existsSync(USUARIOS_FILE)) {
  const initialUsers = [
    { username: 'coach.gian', senha: 'coachForte2024', tipo: 'coach', nome: 'Coach (Gian)', deveTrocarSenha: false },
    { username: 'aluno.teste', senha: 'Aluno123', tipo: 'aluno', nome: 'Aluno Teste', deveTrocarSenha: true },
    { username: 'diogo.silva', senha: 'DiogoInit2024', tipo: 'aluno', nome: 'Diogo Tarlé Silva', deveTrocarSenha: true },
    { username: 'gian.lima', senha: 'GianInit2024', tipo: 'aluno', nome: 'Gian Lima', deveTrocarSenha: true }
  ];
  fs.writeFileSync(USUARIOS_FILE, JSON.stringify(initialUsers, null, 2), 'utf-8');
}

// ==========================
// FUNÇÕES PARA MANIPULAR USUÁRIOS (NOVO)
// ==========================
function lerUsuarios() {
  try {
    const conteudo = fs.readFileSync(USUARIOS_FILE, 'utf-8');
    return JSON.parse(conteudo);
  } catch (error) {
    console.error('Erro ao ler usuarios.json:', error);
    return [];
  }
}

function salvarUsuarios(dados) {
  fs.writeFileSync(
    USUARIOS_FILE,
    JSON.stringify(dados, null, 2),
    'utf-8'
  );
}

// ==========================
// MIDDLEWARE DE AUTENTICAÇÃO (PROTEGE AS ROTAS)
// ==========================
const authenticateToken = (req, res, next) => {
    const token = req.cookies.authToken;

    if (!token) {
        return res.redirect('/login.html');
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            res.clearCookie('authToken');
            return res.redirect('/login.html');
        }
        req.user = user;
        next();
    });
};

// ==========================
// ROTAS DE AUTENTICAÇÃO
// ==========================

// Rota para a página de login (GET)
app.get('/', (req, res) => {
    const token = req.cookies.authToken;
    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (!err) {
                const usuarios = lerUsuarios(); // Lê usuários do arquivo
                const loggedInUser = usuarios.find(u => u.username === user.username);
                if (loggedInUser && loggedInUser.deveTrocarSenha) {
                    return res.redirect('/trocar-senha.html');
                }
                return res.redirect('/aplicativo.html'); // Redireciona para o aplicativo principal
            }
            res.clearCookie('authToken');
            res.sendFile(path.join(__dirname, 'public', 'login.html'));
        });
    } else {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
});

// Rota de login (POST)
app.post('/api/login', (req, res) => {
    const { username, senha, rememberMe } = req.body;
    const usuarios = lerUsuarios(); // Lê usuários do arquivo
    const user = usuarios.find(u => u.username === username && u.senha === senha);

    if (user) {
        const token = jwt.sign({ username: user.username, tipo: user.tipo, nome: user.nome }, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });

        res.cookie('authToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: rememberMe ? 1000 * 60 * 60 * 24 * 7 : null
        });

        if (user.deveTrocarSenha) {
            return res.json({
                username: user.username,
                tipo: user.tipo,
                nome: user.nome,
                mustChangePassword: true,
                redirect: '/trocar-senha.html'
            });
        }
        return res.json({
            username: user.username,
            tipo: user.tipo,
            nome: user.nome,
            mustChangePassword: false,
            redirect: '/aplicativo.html' // Redireciona para o aplicativo principal
        });
    } else {
        return res.status(401).json({ erro: 'Usuário ou senha inválidos.' });
    }
});

// Rota para a página de troca de senha (GET) - Protegida
app.get('/trocar-senha.html', authenticateToken, (req, res) => {
    const usuarios = lerUsuarios(); // Lê usuários do arquivo
    const loggedInUser = usuarios.find(u => u.username === req.user.username);
    if (!loggedInUser || !loggedInUser.deveTrocarSenha) {
        return res.redirect('/aplicativo.html');
    }
    res.sendFile(path.join(__dirname, 'public', 'trocar-senha.html'));
});

// Rota para processar a troca de senha (POST) - Protegida
app.post('/api/alterar-senha', authenticateToken, (req, res) => {
    const { novaSenha } = req.body;
    const usuarios = lerUsuarios(); // Lê usuários do arquivo
    const userIndex = usuarios.findIndex(u => u.username === req.user.username);

    if (userIndex !== -1) {
        usuarios[userIndex].senha = novaSenha;
        usuarios[userIndex].deveTrocarSenha = false;
        salvarUsuarios(usuarios); // Salva usuários no arquivo

        const newToken = jwt.sign({ username: usuarios[userIndex].username, tipo: usuarios[userIndex].tipo, nome: usuarios[userIndex].nome }, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
        res.cookie('authToken', newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 1000 * 60 * 60 * 24 * 7
        });
        return res.json({ ok: true, mensagem: 'Senha alterada com sucesso.', redirect: '/aplicativo.html' });
    }
    return res.status(400).json({ erro: 'Erro ao trocar a senha.' });
});

// Rota de logout
app.get('/api/logout', (req, res) => {
    res.clearCookie('authToken');
    res.redirect('/login.html');
});

// ==========================
// ROTAS PROTEGIDAS (APÓS LOGIN)
// ==========================

// Rota para o aplicativo principal (GET) - Protegida
app.get('/aplicativo.html', authenticateToken, (req, res) => {
    const usuarios = lerUsuarios(); // Lê usuários do arquivo
    const loggedInUser = usuarios.find(u => u.username === req.user.username);
    if (loggedInUser && loggedInUser.deveTrocarSenha) {
        return res.redirect('/trocar-senha.html');
    }
    res.sendFile(path.join(__dirname, 'public', 'aplicativo.html'));
});

// Rota para a página de relatórios (GET) - Protegida
app.get('/relatorios.html', authenticateToken, (req, res) => {
    if (req.user.tipo !== 'coach') {
        return res.status(403).send('Acesso negado. Apenas coaches podem acessar esta página.');
    }
    res.sendFile(path.join(__dirname, 'public', 'relatorios.html'));
});

// NOVO: Rota para listar apenas alunos (para o seletor de aluno no frontend)
app.get('/api/alunos', authenticateToken, (req, res) => {
    const usuarios = lerUsuarios(); // Lê usuários do arquivo
    const alunos = usuarios.filter(u => u.tipo === 'aluno').map(u => ({ username: u.username, nome: u.nome }));
    res.json(alunos);
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

app.get('/api/treinos', authenticateToken, (req, res) => {
  const treinos = lerTreinos();
  res.json(treinos);
});

app.post('/api/treinos', authenticateToken, (req, res) => {
  const novoTreino = req.body;

  if (!novoTreino || !novoTreino.aluno || !novoTreino.dados) {
    return res
      .status(400)
      .json({ error: 'Formato inválido. Envie { aluno, dados }.' });
  }

  if (req.user.tipo === 'aluno' && req.user.username !== novoTreino.aluno) {
      return res.status(403).json({ erro: 'Você não tem permissão para salvar treinos para este aluno.' });
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

app.post('/api/pre-cadastro', (req, res) => {
  const { nome, contato, objetivo } = req.body;

  if (!nome || !contato) {
    return res
      .status(400)
      .json({ erro: 'Nome e contato são obrigatórios.' });
  }

  const lista = lerPreCadastros();

  const novo = {
    id: Date.now(), // Usar timestamp como ID único
    nome,
    contato,
    objetivo: objetivo || '',
    data: new Date().toISOString()
  };

  lista.push(novo);
  salvarPreCadastros(lista);

  return res.json({ ok: true, mensagem: 'Pré-cadastro recebido.' });
});

app.get('/api/pre-cadastro', authenticateToken, (req, res) => {
  if (req.user.tipo !== 'coach') {
      return res.status(403).json({ erro: 'Acesso negado. Apenas coaches podem ver pré-cadastros.' });
  }
  const lista = lerPreCadastros();
  res.json(lista);
});

// NOVO: Rota para aprovar um pré-cadastro e criar um usuário
app.post('/api/aprovar-pre-cadastro', authenticateToken, (req, res) => {
    if (req.user.tipo !== 'coach') {
        return res.status(403).json({ erro: 'Acesso negado. Apenas coaches podem aprovar pré-cadastros.' });
    }

    const { idPreCadastro, username, senhaInicial, nomeCompleto } = req.body;

    if (!idPreCadastro || !username || !senhaInicial || !nomeCompleto) {
        return res.status(400).json({ erro: 'Dados incompletos para aprovar pré-cadastro.' });
    }

    const usuarios = lerUsuarios();
    // Verifica se o username já existe
    if (usuarios.some(u => u.username === username)) {
        return res.status(409).json({ erro: 'Username já existe. Escolha outro.' });
    }

    // Cria o novo usuário
    const novoUsuario = {
        username: username,
        senha: senhaInicial,
        tipo: 'aluno', // Pré-cadastros são sempre para alunos
        nome: nomeCompleto,
        deveTrocarSenha: true // Força a troca de senha no primeiro login
    };
    usuarios.push(novoUsuario);
    salvarUsuarios(usuarios); // Salva a lista de usuários atualizada

    // Remove o pré-cadastro da lista
    let preCadastros = lerPreCadastros();
    preCadastros = preCadastros.filter(p => p.id !== idPreCadastro);
    salvarPreCadastros(preCadastros); // Salva a lista de pré-cadastros atualizada

    return res.json({ ok: true, mensagem: 'Pré-cadastro aprovado e usuário criado com sucesso!' });
});

// NOVO: Rota para excluir um pré-cadastro
app.delete('/api/pre-cadastro/:id', authenticateToken, (req, res) => {
    if (req.user.tipo !== 'coach') {
        return res.status(403).json({ erro: 'Acesso negado. Apenas coaches podem excluir pré-cadastros.' });
    }

    const idParaExcluir = parseInt(req.params.id); // Converte para número, pois o ID é um timestamp

    let preCadastros = lerPreCadastros();
    const tamanhoOriginal = preCadastros.length;
    preCadastros = preCadastros.filter(p => p.id !== idParaExcluir);

    if (preCadastros.length === tamanhoOriginal) {
        return res.status(404).json({ erro: 'Pré-cadastro não encontrado.' });
    }

    salvarPreCadastros(preCadastros);
    return res.json({ ok: true, mensagem: 'Pré-cadastro excluído com sucesso.' });
});


// ==========================
// SESSÕES DE TREINO (PARA RELATÓRIOS)
// ==========================
function lerSessoesTreino() {
  try {
    const conteudo = fs.readFileSync(SESSOES_TREINO_FILE, 'utf-8');
    return JSON.parse(conteudo);
  } catch (error) {
    console.error('Erro ao ler sessoes_treino.json:', error);
    return [];
  }
}

function salvarSessoesTreino(dados) {
  fs.writeFileSync(
    SESSOES_TREINO_FILE,
    JSON.stringify(dados, null, 2),
    'utf-8'
  );
}

app.post('/api/sessoes-treino', authenticateToken, (req, res) => {
    const novaSessao = req.body;

    if (!novaSessao || !novaSessao.alunoUsername || !novaSessao.data || !novaSessao.exerciciosRealizados) {
        return res.status(400).json({ error: 'Dados incompletos para registrar a sessão de treino.' });
    }

    if (req.user.tipo === 'aluno' && req.user.username !== novaSessao.alunoUsername) {
        return res.status(403).json({ erro: 'Você não tem permissão para registrar sessões para este aluno.' });
    }

    const sessoes = lerSessoesTreino();
    novaSessao.id = `sessao_${Date.now()}`;
    sessoes.push(novaSessao);
    salvarSessoesTreino(sessoes);

    return res.json({ message: 'Sessão de treino registrada com sucesso!', sessao: novaSessao });
});

app.get('/api/relatorio-diario/:username/:data', authenticateToken, (req, res) => {
    if (req.user.tipo !== 'coach' && req.user.username !== req.params.username) {
        return res.status(403).json({ erro: 'Acesso negado. Você só pode ver seus próprios relatórios.' });
    }

    const { username, data } = req.params;
    const sessoes = lerSessoesTreino();
    const sessao = sessoes.find(s => s.alunoUsername === username && s.data === data);

    if (!sessao) {
        return res.status(404).json({ erro: 'Nenhuma sessão de treino encontrada para esta data e aluno.' });
    }

    res.json(sessao);
});

// ==========================
// Inicia o servidor
// ==========================
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});