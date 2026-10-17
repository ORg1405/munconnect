// Datas no fuso da cota (o "dia" vira à meia-noite local, não em UTC).

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute"), s: get("second") };
}

// Diferença (ms) entre o relógio local do fuso e UTC no instante `date`.
function offsetMs(date: Date, timeZone: string): number {
  const p = localParts(date, timeZone);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// AAAA-MM-DD no fuso informado.
export function dayKey(date: Date, timeZone: string): string {
  const p = localParts(date, timeZone);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

// Próxima meia-noite local depois de `date` (instante UTC).
export function nextMidnight(date: Date, timeZone: string): Date {
  const p = localParts(date, timeZone);
  const localMidnightAsUtc = Date.UTC(p.y, p.m - 1, p.d + 1, 0, 0, 0);
  let guess = localMidnightAsUtc - offsetMs(date, timeZone);
  // Corrige se o offset mudar entre agora e a meia-noite (horário de verão).
  guess = localMidnightAsUtc - offsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

// "3h 12min", "45min", "30s" — para mensagens de cota.
export function formatDuration(ms: number): string {
  const totalSec = Math.max(1, Math.ceil(ms / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.ceil(totalSec / 60);
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (h === 0) return `${min}min`;
  return min === 0 ? `${h}h` : `${h}h ${min}min`;
}
