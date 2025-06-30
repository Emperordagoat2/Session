import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync, readFileSync } from "fs";
import { rm } from "fs/promises";
import QRCode from "qrcode";
import * as P from "pino";
import { makeWASocket, useMultiFileAuthState, Browsers, delay } from "baileys";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const removeFile = async filePath => {
	if (!existsSync(filePath)) return false;
	await rm(filePath, { recursive: true, force: true });
};

export const handleQR = async (req, res) => {
	const id = Math.random().toString(36).substring(2);

	const QrSocket = async () => {
		const { state, saveCreds } = await useMultiFileAuthState(
			join(__dirname, `temp/${id}`)
		);
		try {
			const sock = makeWASocket({
				auth: state,
				printQRInTerminal: false,
				logger: P.pino({ level: "silent" }),
				browser: Browsers.macOS("Desktop"),
			});

			sock.ev.on("creds.update", saveCreds);
			sock.ev.on("connection.update", async s => {
				const { connection, lastDisconnect, qr } = s;

				if (qr) {
					const buffer = await QRCode.toBuffer(qr);
					res.writeHead(200, { "Content-Type": "image/png" });
					return res.end(buffer);
				}

				if (connection === "open") {
					await delay(5000);
					const data = readFileSync(join(__dirname, `temp/${id}/creds.json`));
					const b64data = Buffer.from(data).toString("base64");
					const session = await sock.sendMessage(sock.user.id, { text: b64data });

					const message = `
QR code connected successfully.
Create a creds.json file and input the above session ID.

For help:
- Channel: https://whatsapp.com/channel/0029VambPbJ2f3ERs37HvM2J
- Main group: https://chat.whatsapp.com/LAGzevfryMmJuy6NwkiSvd
- GitHub: https://github.com/Emperordagoat
- Owner: https://wa.me/2347041620617

Do not share your SESSION_ID with anyone to keep your WhatsApp messages secure.
Follow and star the repo for updates.
`;
					await sock.sendMessage(
						sock.user.id,
						{ text: message },
						{ quoted: session }
					);

					await delay(100);
					await sock.ws.close();
					await removeFile(join(__dirname, `temp/${id}`));
				} else if (
					connection === "close" &&
					//@ts-ignore
					lastDisconnect?.error?.output?.statusCode !== 401
				) {
					await delay(10000);
					QrSocket();
				}
			});
		} catch (err) {
			console.log(err);
			await removeFile(join(__dirname, `temp/${id}`));
			if (!res.headersSent) {
				res.writeHead(503, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ code: "Service Unavailable" }));
			}
		}
	};

	await QrSocket();
};
