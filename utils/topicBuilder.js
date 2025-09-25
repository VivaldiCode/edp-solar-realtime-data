export const topicBuilder = {
    realtimeFromWifi: (deviceId) => `wifi/${deviceId}/fromDev/realtime`,
    realtimeToWifi: (deviceId) => `wifi/${deviceId}/toDev/realtime`,
    moduleFromWifi: (deviceId) => `wifi/${deviceId}/fromDev/module/changed`,
    moduleToWifi: (deviceId) => `wifi/${deviceId}/toDev/module/update`,
    realtimeFromRedyBox: (deviceId) => `rb/${deviceId}/fromDev/realtime`,
    realtimeToRedyBox: (deviceId) => `rb/${deviceId}/toDev/realtime`,
    moduleFromRedyBox: (deviceId) => `rb/${deviceId}/fromDev/module/changed`,
    moduleToRedyBox: (deviceId) => `rb/${deviceId}/toDev/module/update`,
};