const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders
    }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health" || url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "loot-market-api",
        bindings: {
          DB: Boolean(env.DB),
          MEDIA: Boolean(env.MEDIA)
        }
      });
    }

    return json({ ok: false, error: "Not found" }, 404);
  }
};
