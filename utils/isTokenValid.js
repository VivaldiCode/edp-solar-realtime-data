import jwt from "jsonwebtoken";

// ✅ Checa se o JWT ainda é válido
export function isTokenValid(token) {
    try {
        const decoded = jwt.decode(token);
        if (!decoded || !decoded.exp) return false;
        const now = Math.floor(Date.now() / 1000);
        return decoded.exp > now + 60; // margem de 60s
    } catch (err) {
        return false;
    }
}