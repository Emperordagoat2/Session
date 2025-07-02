import {
	Browsers,
	delay,
	DisconnectReason,
	fetchLatestBaileysVersion,
	makeCacheableSignalKeyStore,
	makeWASocket,
	useMultiFileAuthState,
} from "baileys";
import { Boom } from "@hapi/boom";
import P from "pino";
import fs, { readFileSync } from "fs";
import pathModule from "path";

const logger = P.pino({ level: "silent" });

function clearAuth(path = "session") {
	if (fs.existsSync(path)) {
		const files = fs.readdirSync(path);
		for (const file of files) {
			const curPath = pathModule.join(path, file);
			if (fs.lstatSync(curPath).isDirectory()) {
				fs.rmSync(curPath, { recursive: true, force: true });
			} else {
				fs.unlinkSync(curPath);
			}
		}
	}
}

/**
 *
 * @param {string} phone
 * @returns
 */
export async function handlePair(phone) {
	if (!phone) {
		console.error("No phone number provided");
		return { error: "Phone number is required" };
	}

	const phoneNumber = phone.replace(/[^0-9]/g, "");
	if (!phoneNumber) {
		console.error("Invalid phone number format");
		return { error: "Invalid phone number format" };
	}

	try {
		const { state, saveCreds } = await useMultiFileAuthState("session");
		const { version } = await fetchLatestBaileysVersion();
		const sock = makeWASocket({
			auth: {
				creds: state.creds,
				keys: makeCacheableSignalKeyStore(state.keys, logger),
			},
			logger,
			version,
			browser: Browsers.windows("Firefox"),
			syncFullHistory: false,
			emitOwnEvents: true,
		});

		return new Promise(async (resolve, reject) => {
			sock.ev.process(async events => {
				if (events["creds.update"]) {
					await saveCreds();
				}

				if (events["connection.update"]) {
					const { connection, lastDisconnect } = events["connection.update"];
					console.log("Connection update:", connection);

					if (connection === "close") {
						const error = lastDisconnect?.error
							? new Boom(lastDisconnect.error)
							: null;
						const reason = error?.output?.statusCode;

						if (
							[DisconnectReason.loggedOut, DisconnectReason.badSession].includes(
								reason
							)
						) {
							console.error("Critical error:", reason);
							clearAuth();
							reject({ error: `Critical error: ${reason}` });
						} else if (reason === DisconnectReason.restartRequired) {
							console.warn("Restart required:", reason);
							reject({ error: `Restart required: ${reason}` });
							handlePair(phone);
						} else {
							console.error("Disconnected:", reason || "unknown");
							clearAuth();
							reject({ error: `Disconnected: ${reason || "unknown"}` });
						}
					}

					if (connection === "open") {
						try {
							console.log("Connection opened, sending session");
							await delay(5000);
							const session = readFileSync("./session/creds.json", {
								encoding: "utf-8",
							});
							await sock.sendMessage(sock.user.id, { text: session });
							clearAuth();
							process.exit();
							resolve({ success: true, session });
						} catch (err) {
							console.error("Failed to process session:", err.message);
							reject({ error: `Failed to process session: ${err.message}` });
						}
					}
				}
			});

			if (!sock.authState?.creds?.registered) {
				try {
					console.log("Requesting pairing code for:", phoneNumber);
					await delay(2000);
					const code = await sock.requestPairingCode(phoneNumber, "EMPERORX");
					resolve({ code });
				} catch (err) {
					console.error("Failed to request pairing code:", err.message);
					reject({ error: `Failed to request pairing code: ${err.message}` });
				}
			}
		});
	} catch (err) {
		console.error("Unexpected error in handlePair:", err.message);
		return { error: `Unexpected error: ${err.message}` };
	}
}
