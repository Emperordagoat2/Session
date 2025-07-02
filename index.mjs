import { createServer } from "http";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFile } from "fs/promises";
import { EventEmitter } from "events";
import { handlePair } from "./pair.mjs";

EventEmitter.defaultMaxListeners = 500;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PORT = process.env.PORT || 9000;

const serveFile = async (res, filePath) => {
	try {
		const content = await readFile(filePath);
		res.writeHead(200, { "Content-Type": "text/html" });
		res.end(content);
	} catch (err) {
		res.writeHead(500, { "Content-Type": "text/plain" });
		res.end("Internal Server Error");
	}
};

export const handlePairRequest = async (req, res) => {
	const url = new URL(req.url, `http://${req.headers.host}`);
	const phone = url.searchParams.get("phone");

	if (!phone) {
		console.log("❌ Missing phone parameter.");
		res.writeHead(400, { "Content-Type": "application/json" });
		return res.end(JSON.stringify({ error: "Phone parameter required" }));
	}

	console.log(`📞 Spawning with phone: ${phone}`);

	try {
		const result = JSON.stringify(await handlePair(phone));
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(result);
	} catch (error) {
		console.log("❌ Handler error:", error.message);
		res.writeHead(500, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ error: error.message }));
	}
};

const handleRequest = async (req, res) => {
	const url = new URL(req.url, `http://${req.headers.host}`);
	const pathname = url.pathname;

	if (pathname.startsWith("/code")) {
		return handlePairRequest(req, res);
	}

	if (pathname === "/pair") {
		return serveFile(res, join(__dirname, "pair.html"));
	}

	if (pathname === "/") {
		return serveFile(res, join(__dirname, "main.html"));
	}

	res.writeHead(404, { "Content-Type": "text/plain" });
	res.end("Not Found");
};

const app = createServer(handleRequest);

app.listen(PORT, () => {
	console.log(`
  Don't Forget To Give Star
  Server running on http://localhost:${PORT}
  `);
});

export default app;
