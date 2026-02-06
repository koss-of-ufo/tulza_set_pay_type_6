import { uuidRegex, cyrToLatPan } from './utils.js';

export function parsePanText(text) {
  const lines = text.split(/\r?\n/);

  const rows = [];
  let currentPan = '';
  let pendingUuids = [];

  const uuidRe = new RegExp(uuidRegex, 'gi');

  // Больше вариантов написания PAN и команды.
  // Примеры, которые матчятся:
  // - "Сменить PAN на ABC123"
  // - "PAN: ABC123"
  // - "пан = АВС123"
  // - "поменять пан -> 123QWE"
  // - "установить PAN в ABC123"
  const panRe = /(?:^|[\s,;:()«»"'])(?:(?:сменить|заменить|изменить|поменять|скорректировать|установить)\s*)?(?:pan|пан)\s*(?:[:=→>-]*\s*(?:на|в)?\s*)?([A-Z0-9А-ЯЁ]{3,})\b/iu;

  // Иногда пишут: "на PAN ABC123" или "на пан ABC123"
  const panAltRe = /\b(?:на|в)\s*(?:pan|пан)\s*[:=→>-]*\s*([A-Z0-9А-ЯЁ]{3,})\b/iu;

  function extractUuids(line) {
    return line.match(uuidRe) || [];
  }

  function extractPan(line) {
    const m1 = line.match(panRe);
    const m2 = line.match(panAltRe);
    const raw = (m1 && m1[1]) || (m2 && m2[1]) || '';
    const pan = cyrToLatPan(raw.trim());
    return pan || '';
  }

  function pushRows(uuids, pan) {
    if (!pan) return;
    for (const u of uuids) rows.push({ transaction_uuid: u, pan });
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const uuids = extractUuids(line);
    const pan = extractPan(line);

    // Если PAN найден — обновляем currentPan
    if (pan) {
      currentPan = pan;

      // Если были UUID "до PAN" — применяем новый PAN к ним
      if (pendingUuids.length) {
        pushRows(pendingUuids, currentPan);
        pendingUuids = [];
      }

      // UUID, которые в этой же строке
      if (uuids.length) {
        pushRows(uuids, currentPan);
      }

      continue;
    }

    // PAN нет, но UUID есть
    if (uuids.length) {
      if (currentPan) {
        pushRows(uuids, currentPan);
      } else {
        // Пока PAN не задан — копим
        pendingUuids.push(...uuids);
      }
    }
  }

  // Если текст закончился, а PAN так и не встретили — pendingUuids игнорируем
  return rows;
}
