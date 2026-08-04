// Taux de change EUR -> EGP, rafraîchi une fois par jour (mis en cache en
// mémoire pour ne pas refaire l'appel à chaque rendu).
let cached: { date: string; rate: number } | null = null;

export async function getEurToEgpRate(): Promise<number | null> {
  const today = new Date().toISOString().slice(0, 10);
  if (cached && cached.date === today) return cached.rate;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/EUR");
    const data = await res.json();
    const rate = data?.rates?.EGP;
    if (typeof rate === "number" && rate > 0) {
      cached = { date: today, rate };
      return rate;
    }
  } catch {
    // pas de connexion / API indisponible — on retombe sur le cache existant
  }
  return cached?.rate ?? null;
}
