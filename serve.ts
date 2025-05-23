// serve.ts
import { serve } from "bun";
const port = 3000;
serve({
    port: port,
    async fetch(req) {
        const url = new URL(req.url);
        const path = url.pathname;
        console.log(`Request for ${path}`);
        if (path.startsWith("/js/")) {
            const file = Bun.file(`dist/${path.slice("/js/".length)}`);
            console.log(`Serving ${file}`);
            if (await file.exists()) return new Response(file);
            return new Response("Not Found", { status: 404 });
        }

        // fallback to demo/
        const fallback = Bun.file(`demo${path === "/" ? "/index.html" : path}`);
        if (await fallback.exists()) return new Response(fallback);

        return new Response("Not Found", { status: 404 });
    },
});
console.log(`🚀 Server running at http://localhost:${port}`);