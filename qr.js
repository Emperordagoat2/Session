const PastebinAPI = require('pastebin-js'),
pastebin = new PastebinAPI('EMWTMkQAVfJa9kM-MRUrxd5Oku1U7pgL')
const {makeid} = require('./id');
const QRCode = require('qrcode');
const express = require('express');
const path = require('path');
const fs = require('fs');
let router = express.Router()
const pino = require("pino");
const {
	default: TAIRA_TECH,
	useMultiFileAuthState,
	jidNormalizedUser,
	Browsers,
	delay,
	makeInMemoryStore,
} = require("maher-zubair-baileys");

function removeFile(FilePath) {
	if (!fs.existsSync(FilePath)) return false;
	fs.rmSync(FilePath, {
		recursive: true,
		force: true
	})
};
const {
	readFile
} = require("node:fs/promises")
router.get('/', async (req, res) => {
	const id = makeid();
	async function TAIRA_TECH_CODE() {
		const {
			state,
			saveCreds
		} = await useMultiFileAuthState('./temp/' + id)
		try {
			let TAIRA_TECH_SESSION = TAIRA_TECH({
				auth: state,
				printQRInTerminal: false,
				logger: pino({
					level: "silent"
				}),
				browser: Browsers.macOS("Desktop"),
			});

			TAIRA_TECH_SESSION.ev.on('creds.update', saveCreds)
			TAIRA_TECH_SESSION.ev.on("connection.update", async (s) => {
				const {
					connection,
					lastDisconnect,
					qr
				} = s;
				if (qr) await res.end(await QRCode.toBuffer(qr));
				if (connection == "open") {
					await delay(5000);
					let data = fs.readFileSync(__dirname + `/temp/${id}/creds.json`);
					await delay(800);
				   let b64data = Buffer.from(data).toString('base64');
				   let session = await TAIRA_TECH_SESSION.sendMessage(TAIRA_TECH_SESSION.user.id, { text: data });
				   let messg = `
          *_QR CODE HAS CONNECTED SUCCESSFULLY._*
ALL YOU NEED TO DO IS CREATED A CREDS.JSON FILE .
INPUT ABOVE SESSION ID IN IT 
NOTE- CODE MUST END WITH AAA NOT (TIMESTAMP).
╔═════◇
║       『MADE BY EMPEROR』
║ *Channel:* _https://whatsapp.com/channel/0029VambPbJ2f3ERs37HvM2J_
║ *main gc:* _https://chat.whatsapp.com/LAGzevfryMmJuy6NwkiSvd_
║ *Github:* _https://github.com/Emperordagoat_
║ *Owner:* _https://wa.me/2347041620617_
║ *Note :*_Do not provide your SESSION_ID to_
║ _anyone otherwise that can access your WA messages_
║ _*Follow Me and Star my repo for more 🫡.*_
╚════════════════════════╝`
 await TAIRA_TECH_SESSION.sendMessage(TAIRA_TECH_SESSION.user.id,{text:messg },{quoted:session})
 


					await delay(100);
					await TAIRA_TECH_SESSION.ws.close();
					return await removeFile("temp/" + id);
				} else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
					await delay(10000);
					TAIRA_TECH_CODE();
				}
			});
		} catch (err) {
			if (!res.headersSent) {
				await res.json({
					code: "Service Unavailable"
				});
			}
			console.log(err);
			await removeFile("temp/" + id);
		}
	}
	return await TAIRA_TECH_CODE()
});
module.exports = router
