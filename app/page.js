"use client";

import { useEffect, useState } from "react";
import {
  groupForecastByDay,
  getClothingAdvice,
  getUviLabel,
  getLaundryAdvice,
  buildSpeechText,
} from "@/lib/forecast";

const FAVORITES_KEY = "weather-app-favorite-cities";

export default function Home() {
  const [cityInput, setCityInput] = useState("Tokyo");
  const [cityName, setCityName] = useState(null);
  const [lastCityQuery, setLastCityQuery] = useState(null);
  const [days, setDays] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [speaking, setSpeaking] = useState(false);

  // お気に入り都市をブラウザに保存しておき、次回アクセス時にも復元する
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(FAVORITES_KEY);
      if (saved) setFavorites(JSON.parse(saved));
    } catch {
      // 読み込みに失敗しても致命的ではないので何もしない
    }
  }, []);

  function saveFavorites(next) {
    setFavorites(next);
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    } catch {
      // 保存に失敗しても致命的ではないので何もしない
    }
  }

  function toggleFavorite() {
    if (!lastCityQuery) return;
    const isFav = favorites.includes(lastCityQuery);
    const next = isFav
      ? favorites.filter((f) => f !== lastCityQuery)
      : [...favorites, lastCityQuery];
    saveFavorites(next);
  }

  async function fetchWeather(params) {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams(params).toString();
      const res = await fetch(`/api/weather?${query}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "天気情報の取得に失敗しました。");
      }

      const grouped = groupForecastByDay(data.list, data.timezoneOffset ?? 0).map(
        (day) => ({
          ...day,
          uvi: data.uviByDate ? data.uviByDate[day.key] ?? null : null,
        })
      );
      setDays(grouped);
      setSelectedKey(grouped[0]?.key ?? null);
      setCityName(`${data.city}${data.country ? `, ${data.country}` : ""}`);
      setLastCityQuery(params.city ?? null);
    } catch (err) {
      setError(err.message);
      setDays([]);
      setSelectedKey(null);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    if (!cityInput.trim()) return;
    fetchWeather({ city: cityInput.trim() });
  }

  function handleFavoriteClick(favCity) {
    setCityInput(favCity);
    fetchWeather({ city: favCity });
  }

  function handleUseLocation() {
    if (!navigator.geolocation) {
      setError("このブラウザでは現在地の取得に対応していません。");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetchWeather({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      () => {
        setLoading(false);
        setError("現在地を取得できませんでした。位置情報の許可を確認してください。");
      }
    );
  }

  function handleSpeak() {
    if (!selectedDay) return;
    if (!("speechSynthesis" in window)) {
      setError("このブラウザでは音声読み上げに対応していません。");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      buildSpeechText(selectedDay, cityName)
    );
    utterance.lang = "ja-JP";
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  function handleStopSpeak() {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  const selectedDay = days.find((d) => d.key === selectedKey);
  const isFavorite = lastCityQuery ? favorites.includes(lastCityQuery) : false;
  const uviInfo = selectedDay ? getUviLabel(selectedDay.uvi) : null;
  const laundryInfo = selectedDay ? getLaundryAdvice(selectedDay) : null;

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-10 flex flex-col gap-6">
      <header className="text-center">
        <h1 className="text-2xl font-bold">天気予報アプリ</h1>
        <p className="text-sm text-slate-500 mt-1">
          都市を検索するか、現在地の5日間予報を確認できます
        </p>
      </header>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={cityInput}
          onChange={(e) => setCityInput(e.target.value)}
          placeholder="都市名を入力(例: Tokyo, Osaka, London)"
          className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
        <button
          type="submit"
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 transition"
        >
          検索
        </button>
        <button
          type="button"
          onClick={handleUseLocation}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 transition whitespace-nowrap"
        >
          現在地を使う
        </button>
      </form>

      {/* お気に入り都市 */}
      {favorites.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {favorites.map((fav) => (
            <button
              key={fav}
              onClick={() => handleFavoriteClick(fav)}
              className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 transition"
            >
              ★ {fav}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <p className="text-center text-sm text-slate-500">読み込み中...</p>
      )}

      {error && (
        <p className="text-center text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg py-2 px-3">
          {error}
        </p>
      )}

      {days.length > 0 && (
        <>
          {cityName && (
            <div className="flex items-center justify-center gap-2">
              <p className="text-center text-slate-600 font-medium">
                {cityName}
              </p>
              <button
                type="button"
                onClick={toggleFavorite}
                disabled={!lastCityQuery}
                title={
                  lastCityQuery
                    ? "お気に入りに登録/解除"
                    : "現在地はお気に入り登録できません"
                }
                className={`text-lg leading-none ${
                  lastCityQuery
                    ? "cursor-pointer"
                    : "cursor-not-allowed opacity-30"
                } ${isFavorite ? "text-amber-500" : "text-slate-300"}`}
              >
                ★
              </button>
            </div>
          )}

          {/* カレンダー: 5日分の日付選択 */}
          <div className="grid grid-cols-5 gap-2">
            {days.map((day) => (
              <button
                key={day.key}
                onClick={() => setSelectedKey(day.key)}
                className={`flex flex-col items-center rounded-lg border px-2 py-3 text-sm transition ${
                  day.key === selectedKey
                    ? "border-sky-600 bg-sky-50 text-sky-700"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <span className="text-xs text-slate-500">{day.weekday}</span>
                <span className="font-semibold">
                  {day.month}/{day.date}
                </span>
                <img
                  src={`https://openweathermap.org/img/wn/${day.icon}.png`}
                  alt={day.description}
                  className="w-8 h-8"
                />
              </button>
            ))}
          </div>

          {/* 選択した日の詳細 */}
          {selectedDay && (
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 flex flex-col items-center gap-3">
              <p className="text-slate-500 text-sm">
                {selectedDay.month}月{selectedDay.date}日({selectedDay.weekday})
              </p>
              <img
                src={`https://openweathermap.org/img/wn/${selectedDay.icon}@2x.png`}
                alt={selectedDay.description}
                className="w-20 h-20"
              />
              <p className="text-lg font-medium">{selectedDay.description}</p>
              <p className="text-3xl font-bold">
                {Math.round(selectedDay.maxTemp)}°
                <span className="text-lg text-slate-400 font-normal ml-1">
                  / {Math.round(selectedDay.minTemp)}°
                </span>
              </p>

              <div className="grid grid-cols-3 gap-3 w-full mt-2 text-center">
                <div className="rounded-lg bg-slate-50 py-3">
                  <p className="text-xs text-slate-500">湿度</p>
                  <p className="text-lg font-semibold">
                    {selectedDay.avgHumidity}%
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 py-3">
                  <p className="text-xs text-slate-500">降水確率</p>
                  <p className="text-lg font-semibold">{selectedDay.maxPop}%</p>
                </div>
                <div className="rounded-lg bg-slate-50 py-3">
                  <p className="text-xs text-slate-500">紫外線</p>
                  {uviInfo ? (
                    <p className="text-lg font-semibold">{uviInfo.level}</p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1">取得できません</p>
                  )}
                </div>
              </div>

              {/* 服装・持ち物のアドバイス */}
              <div className="w-full rounded-lg bg-sky-50 border border-sky-100 px-4 py-3">
                <p className="text-xs font-medium text-sky-700 mb-1">
                  今日のアドバイス
                </p>
                <ul className="text-sm text-sky-900 space-y-1">
                  {getClothingAdvice(selectedDay).map((tip) => (
                    <li key={tip}>・{tip}</li>
                  ))}
                  {uviInfo && <li>・☀️ {uviInfo.advice}</li>}
                  {laundryInfo && (
                    <li>
                      ・🧺 洗濯指数: {laundryInfo.level}({laundryInfo.advice})
                    </li>
                  )}
                </ul>
              </div>

              {/* 音声読み上げ */}
              <button
                type="button"
                onClick={speaking ? handleStopSpeak : handleSpeak}
                className="w-full rounded-lg border border-slate-300 py-2 text-sm font-medium hover:bg-slate-50 transition"
              >
                {speaking ? "⏹ 読み上げを止める" : "🔊 音声で読み上げる"}
              </button>

              {/* 3時間ごとの内訳 */}
              <div className="w-full overflow-x-auto mt-2">
                <div className="flex gap-3 min-w-max">
                  {selectedDay.entries.map((entry) => (
                    <div
                      key={entry.dt}
                      className="flex flex-col items-center text-xs text-slate-500 rounded-lg border border-slate-100 px-3 py-2"
                    >
                      <span>
                        {String(entry.localDate.getUTCHours()).padStart(2, "0")}時
                      </span>
                      <img
                        src={`https://openweathermap.org/img/wn/${entry.weather?.[0]?.icon}.png`}
                        alt={entry.weather?.[0]?.description}
                        className="w-6 h-6"
                      />
                      <span className="font-medium text-slate-700">
                        {Math.round(entry.main.temp)}°
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
