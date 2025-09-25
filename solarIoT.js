import { device as awsIotDevice } from 'aws-iot-device-sdk';
import EventEmitter from 'events';
import { v4 as uuidv4 } from 'uuid';

export class SolarIoT extends EventEmitter {
    /**
     * @param {Object} options
     * @param {string} options.clientId
     * @param {string} options.host
     * @param {string} options.accessKeyId
     * @param {string} options.secretKey
     * @param {string} options.sessionToken
     * @param {string} options.region
     */
    constructor({ clientId, host, accessKeyId, secretKey, sessionToken, region = 'eu-west-1', debug = false}) {
        super();
        this.clientId = clientId || `node-${Date.now()}`;
        this.host = host;
        this.errorInIot = false;
        this.connected = false;
        this.debug = debug

        const options = {
            clientId: this.clientId,
            host: this.host,
            protocol: 'wss',
            region,
            accessKeyId,
            secretKey,
            sessionToken,
            keepalive: 30,
            reconnectPeriod: 50000,
            resubscribe: false,
            debug: debug,
            username: `?SDK=JavaScript&Version=2.2.15`,
            websocketOptions: { protocol: 'mqttv3.1' },
        };

        this.device = awsIotDevice(options);
        this._bindEvents();
    }

    _bindEvents() {
        this.device.on('connect', () => {
            this.connected = true;
            this.errorInIot = false;
            if(this.debug) console.log(`[SolarIoT] ✅ Conectado ao AWS IoT (${this.clientId})`);
            this.emit('connected');
        });

        this.device.on('close', () => {
            this.connected = false;
            if(this.debug) console.warn('[SolarIoT] ⚠️ Conexão encerrada');
            this.emit('disconnected');
        });

        this.device.on('reconnect', () => {
            this.connected = false;
            this.errorInIot = false;
            if(this.debug) console.log('[SolarIoT] 🔄 Reconectando...');
            this.emit('reconnecting');
        });

        this.device.on('message', (topic, payload, packet) => {
            // payload é um Buffer
            let messageString = payload.toString(); // converte para string
            let data;

            try {
                data = JSON.parse(messageString); // tenta decodificar JSON
            } catch (err) {
                if(this.debug) console.warn('[SolarIoT] ⚠️ Payload não é JSON, usando string crua');
                data = messageString;
            }

            if(this.debug) console.log(`[SolarIoT] Mensagem recebida | Topic: ${topic}`, data, packet);
            // Emitir eventos para subscribers
            this.emit('data', { topic, data });
        });

        this.device.on('offline', () => {
            this.connected = false;
            if(this.debug) console.warn('[SolarIoT] ⚠️ Device offline');
        });

        this.device.on('error', (err) => {
            this.connected = false;
            this.errorInIot = true;
            if(this.debug) console.error('[SolarIoT] ❌ Erro de conexão:', err);
            this.emit('error', err);
        });
    }

    connect() {
        if (!this.device) throw new Error('Device não inicializado');
        if(this.debug) console.log('[SolarIoT] Tentando conectar (WebSocket inicia automaticamente)…');
    }

    isConnected() {
        return this.connected;
    }

    hasErrorInIot() {
        return this.errorInIot;
    }

    _processQueue() {
        if (this.processingQueue) return;
        this.processingQueue = true;

        while (this.queue.length && this.connected) {
            const { topic, message, callback } = this.queue.shift();
            try {
                this.device.publish(topic, message, { qos: 0 }, callback);
                if(this.debug) console.log('[SolarIoT] 📤 Mensagem da fila enviada:', topic);
            } catch (err) {
                if(this.debug) console.error('[SolarIoT] ❌ Erro publish da fila:', err);
                this.errorInIot = true;
                if (callback) callback(err);
                else this.emit('error', err);
            }
        }

        this.processingQueue = false;
    }

    _publish(topic, message, callback) {
        if (!topic || !message) return;

        if (this.connected) {
            try {
                this.device.publish(topic, message, { }, callback);
                if(this.debug) console.log("[SolarIoT] Mensagem enviada: ", topic, " - ", message);
            } catch (err) {
                if(this.debug) console.error('[SolarIoT] ❌ Falha publish direto, adicionando na fila:', err);
                this.queue.push({ topic, message, callback });
                this.errorInIot = true;
                this.emit('error', err);
            }
        } else {
            this.queue.push({ topic, message, callback });
        }
    }


    subscribe(devices, topicBuilder) {
        if (!Array.isArray(devices)) return;

        for (const d of devices) {
            let topicDevice = null;
            let topicModule = null;

            if (d.isRedyBox && d.deviceLocalId) {
                topicDevice = topicBuilder.realtimeFromRedyBox(d.deviceLocalId);
                topicModule = topicBuilder.moduleFromRedyBox(d.deviceLocalId);
            } else if (d.isWifi && d.deviceLocalId) {
                topicDevice = topicBuilder.realtimeFromWifi(d.deviceLocalId);
                topicModule = topicBuilder.moduleFromWifi(d.deviceLocalId);
            }

            if (!topicDevice || !topicModule) continue;

            // Subscrição tópico dispositivo
            this.device.subscribe(topicDevice, { qos: 0 }, (err) => {
                if (err) {
                    if(this.debug) console.error(`[SolarIoT] ❌ Falha ao assinar ${topicDevice}:`, err);
                    this.errorInIot = true;
                    this.emit('error', err);
                } else {
                    if(this.debug) console.log(`[SolarIoT] ✅ Subscrito em: ${topicDevice}`);
                    this.emit('subscribed', topicDevice);
                }
            });

            // Subscrição tópico módulo
            this.device.subscribe(topicModule, { qos: 0 }, (err) => {
                if (err) {
                    if(this.debug) console.error(`[SolarIoT] ❌ Falha ao assinar ${topicModule}:`, err);
                    this.errorInIot = true;
                    this.emit('error', err);
                } else {
                    if(this.debug) console.log(`[SolarIoT] ✅ Subscrito em: ${topicModule}`);
                    this.emit('subscribed', topicModule);
                }
            });

            // Handler de mensagens
            this.device.on('message', (topic, payload) => {
                const message = payload.toString();
                try {
                    const data = JSON.parse(message);
                    if (topic === topicDevice) {
                        this.emit('data', { topic, data });
                    } else if (topic === topicModule) {
                        this.emit('moduleData', { topic, data });
                    }
                } catch {
                    if (topic === topicDevice) {
                        this.emit('data', { topic, data: message });
                    } else if (topic === topicModule) {
                        this.emit('moduleData', { topic, data: message });
                    }
                }
            });
        }

        // Realtime request inicial
        this.startRealtimeRequest(devices, topicBuilder);
    }

    unSubscribe(devices, topicBuilder) {
        for (const d of devices) {
            let topicDevice = null;
            let topicModule = null;

            if (d.isRedyBox && d.deviceLocalId) {
                topicDevice = topicBuilder.realtimeFromRedyBox(d.deviceLocalId);
                topicModule = topicBuilder.moduleFromRedyBox(d.deviceLocalId);
            } else if (d.isWifi && d.deviceLocalId) {
                topicDevice = topicBuilder.realtimeFromWifi(d.deviceLocalId);
                topicModule = topicBuilder.moduleFromWifi(d.deviceLocalId);
            }

            if (topicDevice) this.device.unsubscribe(topicDevice);
            if (topicModule) this.device.unsubscribe(topicModule);
        }
    }

    startRealtimeRequest(devices, topicBuilder) {
        devices.forEach(d => {
            const topic = d.isRedyBox && d.deviceLocalId
                ? topicBuilder.realtimeToRedyBox(d.deviceLocalId)
                : d.isWifi && d.deviceLocalId
                    ? topicBuilder.realtimeToWifi(d.deviceLocalId)
                    : null;

            if (!topic) return;

            const message = JSON.stringify({
                id: uuidv4(),
                operationType: 'realtime',
                messageType: 'request',
                data: { timeout: 60 },
            });

            this._publish(topic, message, (err) => {
                if (err) if(this.debug) console.error('[SolarIoT] ❌ Erro ao enviar realtime request:', err);
                else if(this.debug) console.log(`[SolarIoT] 📤 Realtime request enviado: ${topic}`);
            });
        });
    }

    // Publica mensagens em tópicos de módulos
    updateModuleState(message, device, topicBuilder) {
        if (!device?.deviceLocalId) return;
        let topic = null;
        if (device.isRedyBox) topic = topicBuilder.moduleToRedyBox(device.deviceLocalId);
        else if (device.isWifi) topic = topicBuilder.moduleToWifi(device.deviceLocalId);

        if (!topic) return;

        try {
            this.device.publish(topic, message, { qos: 0 });
            if(this.debug) console.log(`[SolarIoT] 📤 updateModuleState enviado: ${topic}`);
        } catch (err) {
            if(this.debug) console.error('[SolarIoT] ❌ Erro updateModuleState:', err);
            this.errorInIot = true;
            this.emit('error', err);
        }
    }
}
