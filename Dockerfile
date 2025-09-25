# Use Node 20 slim
FROM node:20-slim

# Define diretório de trabalho
WORKDIR /app

# Copia package.json e package-lock.json primeiro
# Isso permite usar cache do Docker caso as deps não mudem
COPY package*.json ./

# Instala dependências
RUN npm install --production

# Copia o restante do projeto
COPY . .

# Cria a pasta cache para credenciais
RUN mkdir -p ./cache

# Expõe a porta que o Express vai usar
EXPOSE 3000

# Comando para rodar a aplicação
CMD ["node", "index.js"]
