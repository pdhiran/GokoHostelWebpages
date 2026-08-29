async function fetchWithRetry(url: string, init: RequestInit, retries = 1): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("json") && attempt < retries) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      throw err;
    }
  }
  return fetch(url, init);
}

export function useAdminApi(password: string, username?: string) {
  const apiCall = async (body: Record<string, any>) => {
    const payload: Record<string, any> = { password, ...body };
    if (username) payload.username = username;
    const res = await fetchWithRetry("/api/admin/checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res;
  };

  return { apiCall };
}

export { fetchWithRetry };
