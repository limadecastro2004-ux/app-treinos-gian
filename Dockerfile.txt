# Usa uma imagem base oficial do Node.js, versão 20 (slim para ser mais leve)
FROM node:20-slim

# Define o diretório de trabalho dentro do contêiner.
# É aqui que seu aplicativo será copiado e executado.
WORKDIR /app

# Copia os arquivos package.json e package-lock.json para o diretório de trabalho.
# Isso é feito primeiro para que o Docker possa cachear a camada de dependências.
# O --chown=node:node garante que o usuário 'node' (que usaremos para rodar o app)
# seja o proprietário desses arquivos, melhorando a segurança.
COPY --chown=node:node package*.json ./

# Instala as dependências do projeto.
# O --production garante que apenas as dependências de produção sejam instaladas,
# tornando a imagem final menor.
RUN npm install --production

# Copia o restante do código da aplicação (incluindo server.js, pasta public, etc.)
# para o diretório de trabalho dentro do contêiner.
# Novamente, --chown=node:node para segurança.
COPY --chown=node:node . .

# Expõe a porta 3000.
# Isso informa ao Docker que o contêiner escutará na porta 3000.
# O Cloud Run usará essa informação para rotear o tráfego corretamente.
EXPOSE 3000

# Define o usuário 'node' para executar a aplicação.
# É uma boa prática de segurança não rodar o aplicativo como 'root' dentro do contêiner.
USER node

# Comando para iniciar a aplicação quando o contêiner for executado.
# Ele usa o script "start" definido no seu package.json, que é "node server.js".
CMD ["npm", "start"]