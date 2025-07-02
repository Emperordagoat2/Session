import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const startServer = () => {
	console.log("🚀 Starting server...");

	const child = spawn("node", [join(__dirname, "index.mjs")], {
		stdio: "inherit",
		env: process.env,
	});

	child.on("close", code => {
		if (code !== null) {
			console.log(`🔄 Server exited with code ${code}, restarting...`);
			setTimeout(startServer, 1000);
		}
	});

	child.on("error", err => {
		console.error("❌ Server error:", err);
		setTimeout(startServer, 2000);
	});

	return child;
};

process.on("SIGINT", () => {
	console.log("\n👋 Shutting down...");
	process.exit(0);
});

process.on("SIGTERM", () => {
	console.log("\n👋 Shutting down...");
	process.exit(0);
});

startServer();
