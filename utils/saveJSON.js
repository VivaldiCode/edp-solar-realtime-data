import fs from "fs/promises";

// ✅ Salva JSON em arquivo
export async function saveJSON(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}