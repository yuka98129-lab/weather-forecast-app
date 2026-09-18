"use client";

import { useState } from "react";
import { groupForecastByDay } from "@/lib/forecast";

export default function Home() {
  const [cityInput, setCityInput] = useState("Tokyo");
  const [cityName, setCityName] = useState(null);
  const [days, setDays] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

      const grouped = groupForecastByDay(data.list, data.timezoneOffset ?? 0);
      setDays(grouped);
      setSelectedKey(grouped[0]?.key ?? null);
      setCityName(`${data.city}${data.country ? `, ${data.country}` : ""}`);
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

  const selectedDay = days.find((d) => d.key === selectedKey);

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
            <p className="text-center text-slate-600 font-medium">{cityName}</p>
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

              <div className="grid grid-cols-2 gap-4 w-full mt-2 text-center">
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
              </div>

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
