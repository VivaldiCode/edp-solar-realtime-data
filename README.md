# 🌞 EDP Solar IoT realtime data

⚠️ **Observações**

Este projeto não é oficial da EDP.


## Uma API Node.js que conecta dispositivos **EDP Solar IoT** via AWS IoT, permitindo:

* Receber dados em **tempo real** via **WebSocket**.
* Consultar o **último estado** de cada dispositivo via **HTTP GET**.
* Cache automático de **credenciais**, **user data**, **houses** e **devices** para evitar requests desnecessários.

---

## 🔹 Features

* Autenticação automática via API de login.
* Token JWT é armazenado e reutilizado até expirar.
* Cache local em `./cache`:

    * `credentials.json` → JWT
    * `userData.json` → dados do usuário
    * `houses.json` → casas registradas
    * `devices.json` → dispositivos de cada casa
* Suporte **HTTP** e **WebSocket** para consumir os dados.
* Conexão segura e persistente com AWS IoT.
* Atualizações em tempo real de todos os devices ou de devices específicos.

---

## 🚀 Pré-requisitos

* Docker (recomendado) ou Node.js 20+
* Conta válida no sistema Solar IoT com login válido

---

## ⚡️ Variáveis de ambiente

Defina antes de rodar:

```bash
export USERNAME="seuEmail@lindo.com"
export PASSWORD="SuaSenhaForte.com"
export LOGIN_API="https://api.login.com"
```

---

## 🐳 Rodando com Docker

```bash
docker build -t solar-iot-api .
docker run -p 3000:3000 \
  -e USERNAME=$USERNAME \
  -e PASSWORD=$PASSWORD \
  -e LOGIN_API=$LOGIN_API \
  solar-iot-api
```

> O container expõe a porta **3000** para HTTP e WebSocket.

---

## 🖥️ HTTP API

### Obter último estado de um device específico

```http
GET http://localhost:3000/device/SEU-deviceLocalId
```

**Resposta:**

```json
{
  "emeter:power_aminus": 2785
}
```

### Obter todos os devices

```http
GET http://localhost:3000/device/ALL
```

**Resposta:**

```json
{
  "SEU deviceLocalId": { "emeter:power_aminus": 2785 },
  "SEU deviceLocalId-2": { "emeter:power_aplus": 0, "emeter:power_aminus": 1636 }
}
```

---

## 🌐 WebSocket

Conectar ao WebSocket:

```js
const ws = new WebSocket("ws://localhost:3000");

ws.onopen = () => {
  console.log("Conectado ao WebSocket");

  // Filtra mensagens de um device específico
  ws.send("SEU deviceLocalId");

  // Ou receber todos os devices
  // ws.send("ALL");
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Atualização:", data);
};
```

**Exemplo de mensagem recebida:**

```json
{
  "localId": "SEU deviceLocalId",
  "stateVariables": {
    "emeter:power_aminus": 2785
  }
}
```

---

## 🗂️ Estrutura de cache (`./cache`)

```
cache/
├─ credentials.json   # JWT do login
├─ userData.json      # Dados do usuário
├─ houses.json        # Casas cadastradas
├─ devices.json       # Dispositivos por casa
```

> Todos os arquivos são criados automaticamente na primeira execução.

---

## ⚙️ Configuração do projeto

* Código em **ES Modules** (`import/export`).
* Dependências principais:

    * `express` → HTTP server
    * `ws` → WebSocket
    * `uuid` → IDs de cliente
    * `jsonwebtoken` → validação de JWT
    * `aws-iot-device-sdk` → comunicação com AWS IoT

---

## 🔧 Desenvolvimento

Rodando local sem Docker:

```bash
npm install
USERNAME="..." PASSWORD="..." LOGIN_API="..." node index.js
```

---

## ✅ Observações

* WebSocket envia apenas **updates em tempo real**.
* HTTP serve **último estado** salvo em memória.
* Cache é usado para reduzir requests à API externa e AWS IoT.
* A API mantém **conexão persistente** com AWS IoT para receber dados continuamente.
