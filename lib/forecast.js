const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];

// OpenWeatherMapのdt(UTC秒)とcity.timezone(UTCからのオフセット秒)から
// その都市の「現地時刻」としてのDateを作る(UTCゲッターで読み出す前提)
function toLocalDate(dtSeconds, timezoneOffsetSeconds) {
  return new Date((dtSeconds + timezoneOffsetSeconds) * 1000);
}

function dateKey(localDate) {
  const y = localDate.getUTCFullYear();
  const m = String(localDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(localDate.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// UTC秒のdtとタイムゾーンオフセット(秒)から "YYYY-MM-DD" の日付キーを作る
// (One Call APIのdaily.dtなど、forecast以外のデータとも日付を揃えるために使う)
export function localDateKeyFromUnix(dtSeconds, timezoneOffsetSeconds) {
  return dateKey(toLocalDate(dtSeconds, timezoneOffsetSeconds));
}

/**
 * 3時間ごとの予報リストを日付ごとにグループ化し、
 * 各日の代表値(最高/最低気温・湿度・降水確率・代表天気)を計算する
 */
export function groupForecastByDay(list, timezoneOffsetSeconds) {
  const groups = new Map();

  for (const entry of list) {
    const local = toLocalDate(entry.dt, timezoneOffsetSeconds);
    const key = dateKey(local);
    if (!groups.has(key)) {
      groups.set(key, { key, localDate: local, entries: [] });
    }
    groups.get(key).entries.push({ ...entry, localDate: local });
  }

  const days = Array.from(groups.values()).map((group) => {
    const { entries, localDate, key } = group;

    const temps = entries.map((e) => e.main.temp);
    const humidities = entries.map((e) => e.main.humidity);
    const pops = entries.map((e) => e.pop ?? 0);

    // 正午に一番近いエントリを「その日の代表天気」として使う
    const representative = entries.reduce((closest, e) => {
      const hour = e.localDate.getUTCHours();
      const closestHour = closest.localDate.getUTCHours();
      return Math.abs(hour - 12) < Math.abs(closestHour - 12) ? e : closest;
    }, entries[0]);

    return {
      key,
      weekday: WEEKDAYS_JA[localDate.getUTCDay()],
      month: localDate.getUTCMonth() + 1,
      date: localDate.getUTCDate(),
      minTemp: Math.min(...temps),
      maxTemp: Math.max(...temps),
      avgHumidity: Math.round(
        humidities.reduce((a, b) => a + b, 0) / humidities.length
      ),
      maxPop: Math.round(Math.max(...pops) * 100),
      description: representative.weather?.[0]?.description ?? "",
      icon: representative.weather?.[0]?.icon ?? "01d",
      entries,
    };
  });

  days.sort((a, b) => (a.key < b.key ? -1 : 1));
  return days;
}

/**
 * その日の気温・降水確率から、傘や服装に関する簡単なアドバイスを作る
 */
export function getClothingAdvice(day) {
  const tips = [];

  if (day.maxPop >= 30) {
    tips.push("☔ 傘を持っていった方が安全です");
  }

  if (day.maxTemp < 18) {
    tips.push("🧥 服装は長袖がいいと思います");
  } else if (day.maxTemp >= 28) {
    tips.push("👕 薄着・半袖で過ごしやすい気温です");
  } else {
    tips.push("🍃 羽織れるものが1枚あると安心です");
  }

  return tips;
}

/**
 * UV指数(数値)を、見て分かりやすいラベルに変換する
 * (参考: 気象庁・WHOのUVインデックス区分)
 */
export function getUviLabel(uvi) {
  if (uvi == null) return null;
  if (uvi < 3) return { level: "弱い", advice: "日焼け止めは必須ではありません" };
  if (uvi < 6) return { level: "中程度", advice: "日焼け止めがあると安心です" };
  if (uvi < 8) return { level: "強い", advice: "日焼け止め・帽子があるといいです" };
  if (uvi < 11) {
    return { level: "非常に強い", advice: "日焼け止め・日傘などの対策推奨です" };
  }
  return { level: "極端", advice: "できるだけ日差しを避けてください" };
}

/**
 * その日の天気・アドバイスをまとめて、読み上げ用の自然な文章にする
 */
export function buildSpeechText(day, cityName) {
  const advice = getClothingAdvice(day)
    .map((tip) => tip.replace(/^[^\p{L}\p{N}]+/u, "")) // 先頭の絵文字を除去
    .join("。");

  const uvi = getUviLabel(day.uvi);
  const uviText = uvi ? `紫外線は${uvi.level}です。` : "";

  return (
    `${cityName ?? ""}の${day.month}月${day.date}日、${day.weekday}曜日の天気をお伝えします。` +
    `天気は${day.description}、気温は最高${Math.round(day.maxTemp)}度、` +
    `最低${Math.round(day.minTemp)}度、湿度は${day.avgHumidity}パーセント、` +
    `降水確率は${day.maxPop}パーセントです。${uviText}${advice}。`
  );
}
