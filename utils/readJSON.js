import fs from "fs/promises";

// ✅ Lê JSON do arquivo, retorna null se não existir
export async function readJSON(filePath) {
    try {
        const raw = await fs.readFile(filePath, "utf-8");
        return JSON.parse(raw);
    } catch {
        return null;
    }
}