import express from "express";
import { WebSocketServer } from "ws";
import { SolarIoT } from './solarIoT.js';
import { v4 as uuidv4 } from 'uuid';
import { getDevices, getHouses, getUser, getWSCredentials, login } from "./edp-api-client/apis.js"
import path from "path";
import { readJSON } from "./utils/readJSON.js";
import { saveJSON } from "./utils/saveJSON.js";
import { isTokenValid } from "./utils/isTokenValid.js";
import { topicBuilder } from "./utils/topicBuilder.js";

const CREDENTIALS_PATH = path.resolve("./cache/credentials.json");
const USER_PATH = path.resolve("./cache/userData.json");
const HOUSES_PATH = path.resolve("./cache/houses.json");
const DEVICES_PATH = path.resolve("./cache/devices.json");
const PORT = 3000;

const IOTHost = 'axhipzdhdp7t3-ats.iot.eu-west-1.amazonaws.com'
const username = process.env.USERNAME;
const password = process.env.PASSWORD;
const loginApi = process.env.LOGIN_API;

// Armazena a última mensagem de cada deviceLocalId
const lastDeviceState = {};

// ---------------- Init Express + WS ----------------
const app = express();
const wss = new WebSocketServer({ noServer: true });

// HTTP GET endpoint
app.get("/device/:deviceLocalId", (req, res) => {
    const id = req.params.deviceLocalId;
    if (id === "ALL") {
        return res.json(lastDeviceState);
    }
    res.json(lastDeviceState[id] || null);
});

// Upgrade HTTP -> WS
const server = app.listen(PORT, () => console.log(`🚀 API rodando na porta ${PORT}`));

server.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, ws => {
        wss.emit("connection", ws, request);
    });
});

// ---------------- WebSocket ----------------
wss.on("connection", ws => {
    console.log("🔌 WebSocket conectado");

    ws.on("message", message => {
        const msg = message.toString();
        ws.deviceFilter = msg; // deviceLocalId ou "ALL"
        console.log("📝 Filtro WS:", msg);
    });
});


// ---------------- Main IoT ----------------
export async function main(username, password, loginApi) {
    // 1️⃣ Token
    let creds = await readJSON(CREDENTIALS_PATH);
    if (!creds || !isTokenValid(creds.id_token)) {
        creds = await login(username, password, loginApi);
        await saveJSON(CREDENTIALS_PATH, creds);
    }

    // 2️⃣ User data
    let userData = await readJSON(USER_PATH);
    if (!userData) {
        userData = await getUser(creds.id_token);
        await saveJSON(USER_PATH, userData);
    }

    // 3️⃣ Response token
    const responseToken = await getWSCredentials(creds.id_token, userData.User.identityId);

    // 4️⃣ Houses
    let housesData = await readJSON(HOUSES_PATH);
    if (!housesData) {
        housesData = await getHouses(creds.id_token);
        await saveJSON(HOUSES_PATH, housesData);
    }

    // 5️⃣ Devices
    let devicesData = await readJSON(DEVICES_PATH);
    let devices = [];
    if (!devicesData) {
        for (const house of housesData.houses) {
            const devicesRequest = await getDevices(creds.id_token, house.houseId);
            for (const device of devicesRequest) {
                devices.push({
                    isWifi: device.type === "wifi",
                    isRedyBox: device.type === "redybox",
                    deviceLocalId: device.deviceLocalId
                });
            }
        }
        await saveJSON(DEVICES_PATH, devices);
    } else {
        devices = devicesData;
    }

    // 6️⃣ Conexão IoT
    const iot = new SolarIoT({
        clientId: 'ios-' + uuidv4(),
        host: IOTHost,
        sessionToken: responseToken.Credentials.SessionToken,
        accessKeyId: responseToken.Credentials.AccessKeyId,
        secretKey: responseToken.Credentials.SecretKey,
    });

    iot.on('connected', async () => {
        console.log('✅ Conectado ao AWS IoT');

        for (const d of devices) {
            const topics = [];
            if (d.isRedyBox) {
                topics.push(topicBuilder.realtimeFromRedyBox(d.deviceLocalId));
                topics.push(topicBuilder.moduleFromRedyBox(d.deviceLocalId));
            } else if (d.isWifi) {
                topics.push(topicBuilder.realtimeFromWifi(d.deviceLocalId));
                topics.push(topicBuilder.moduleFromWifi(d.deviceLocalId));
            }

            for (const t of topics) {
                await new Promise((resolve, reject) => {
                    iot.device.subscribe(t, {qos: 0}, err => {
                        if (err) return reject(err);
                        resolve();
                    });
                });
            }
        }

        iot.startRealtimeRequest(devices, topicBuilder);
    });

    iot.on('data', ({topic, data}) => {
        if(data.data.length > 0) for (const entry of data.data) {
            const id = entry.localId.split(':')[0];
            lastDeviceState[id] = entry.stateVariables;

            // envia para os WS conectados
            wss.clients.forEach(ws => {
                if (ws.readyState === ws.OPEN) {
                    if (ws.deviceFilter === "ALL" || ws.deviceFilter === id) {
                        ws.send(JSON.stringify({ localId: id, stateVariables: entry.stateVariables }));
                    }
                }
            });
        }
    });

    iot.on('error', err => console.error('❌ Erro IoT:', err));
}

main(username, password, loginApi).then()