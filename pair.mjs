import {
	delay,
	DisconnectReason,
	makeWASocket,
	useMultiFileAuthState,
} from "baileys";
import { Boom } from "@hapi/boom";
import fs, { readFileSync } from "fs";
import pathModule from "path";
import { readFile } from "fs/promises";


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
		const sock = makeWASocket({
			auth: state
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
							await delay(10000);
							const session = await readFile("./session/creds.json", {
								encoding: "utf-8",
							});
							// Convert session content to base64
							const sessionBase64 = Buffer.from(session).toString('base64');
							await delay(3000)
							await sock.sendMessage(sock.user.id, { text: sessionBase64 });
							await delay(2500)
							clearAuth();
							process.exit();
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
					const code = await sock.requestPairingCode(phoneNumber, "CHAMPEMP");
					resolve(code);
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
