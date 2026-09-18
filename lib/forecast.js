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
    tips.push("傘を持っていった方が安全です");
  }

  if (day.maxTemp < 18) {
    tips.push("服装は長袖がいいと思います");
  } else if (day.maxTemp >= 28) {
    tips.push("薄着・半袖で過ごしやすい気温です");
  } else {
    tips.push("羽織れるものが1枚あると安心です");
  }

  return tips;
}
