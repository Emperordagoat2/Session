import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { unlink, readFile } from "node:fs/promises";
import { Boom } from "@hapi/boom";
import * as P from "pino";
import {
	makeWASocket,
	useMultiFileAuthState,
	delay,
	makeCacheableSignalKeyStore,
	Browsers,
} from "baileys";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const removeFile = async filePath => {
	if (!existsSync(filePath)) return false;
	await unlink(filePath);
};

export const handlePair = async (req, res) => {
	const url = new URL(req.url, `http://${req.headers.host}`);
	const num = url.searchParams.get("number");
	const id = Math.random().toString(36).substring(2, 15);

	const pairSocket = async () => {
		const { state, saveCreds } = await useMultiFileAuthState(
			join(__dirname, `temp/${id}`)
		);
		try {
			const sock = makeWASocket({
				auth: {
					creds: state.creds,
					keys: makeCacheableSignalKeyStore(state.keys),
				},
				printQRInTerminal: false,
				logger: P.pino({ level: "fatal" }).child({ level: "fatal" }),
				browser: Browsers.windows("Chrome"),
			});

			if (!sock.authState.creds.registered) {
				await delay(1500);
				const cleanedNum = num?.replace(/[^0-9]/g, "");
				const code = await sock.requestPairingCode(cleanedNum, "emperorx");
				if (!res.headersSent) {
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ code }));
				}
			}

			sock.ev.on("creds.update", saveCreds);
			sock.ev.on("connection.update", async s => {
				const { connection, lastDisconnect } = s;
				if (connection === "open") {
					await delay(5000);
					const data = await readFile(join(__dirname, `temp/${id}/creds.json`));
					const b64data = Buffer.from(data).toString("base64");
					const session = await sock.sendMessage(sock.user.id, { text: b64data });

					const message = `
*Pair code connected successfully!*
To use, create a creds.json file and paste the above session ID.

For help and updates:
- Channel: https://whatsapp.com/channel/0029VambPbJ2f3ERs37HvM2J
- Main group: https://chat.whatsapp.com/LAGzevfryMmJuy6NwkiSvd
- GitHub: https://github.com/Emperordagoat
- Owner: https://wa.me/2347041620617

*Do not share your SESSION_ID with anyone. It gives access to your WhatsApp messages.*
`;
					await sock.sendMessage(
						sock.user.id,
						{ text: message },
						{ quoted: session }
					);

					await delay(100);
					await sock.ws.close();
					removeFile(join(__dirname, `temp/${id}`));
				} else if (
					connection === "close" &&
					//@ts-ignore
					lastDisconnect?.error?.output?.statusCode !== 401
				) {
					await delay(10000);
					pairSocket();
				}
			});
		} catch (err) {
			console.log("service restarted");
			removeFile(join(__dirname, `temp/${id}`));
			if (!res.headersSent) {
				res.writeHead(503, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ code: "Service Unavailable" }));
			}
		}
	};

	await pairSocket();
};
