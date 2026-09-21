import { NextResponse } from "next/server";
import { localDateKeyFromUnix } from "@/lib/forecast";

// APIキーはサーバー側だけで参照する(NEXT_PUBLIC_を付けないのでクライアントには渡らない)
const API_KEY = process.env.OPENWEATHER_API_KEY;
const BASE_URL = "https://api.openweathermap.org/data/2.5/forecast";
const GEO_URL = "https://api.openweathermap.org/geo/1.0/direct";
// One Call API 3.0は新規購入不可になり、4.0(モジュール分割型)に統一された。
// 日別データは timeline/1day エンドポイントで取得する(1回の呼び出しで最大10日分)。
const ONECALL_URL = "https://api.openweathermap.org/data/4.0/onecall/timeline/1day";

// UV指数(One Call API)は取得できないプラン/キーもあるので、
// 失敗しても天気予報自体は表示できるように、ここだけ個別にtry/catchする
async function fetchUviByDate(latitude, longitude) {
  try {
    const start = Math.floor(Date.now() / 1000);
    const res = await fetch(
      `${ONECALL_URL}?lat=${latitude}&lon=${longitude}&start=${start}&appid=${API_KEY}`
    );
    if (!res.ok) {
      // デバッグ用: 原因をターミナルに出力する(失敗してもアプリは壊さない)
      const errBody = await res.text().catch(() => "");
      console.error("[UV] One Call API 4.0 fetch failed:", res.status, errBody);
      return null;
    }

    const data = await res.json();
    if (!Array.isArray(data.data)) {
      console.error("[UV] Unexpected response shape:", JSON.stringify(data).slice(0, 300));
      return null;
    }

    const uviByDate = {};
    for (const day of data.data) {
      const key = localDateKeyFromUnix(
        day.dt,
        day.timezone_offset ?? data.timezone_offset ?? 0
      );
      uviByDate[key] = day.uvi;
    }
    return uviByDate;
  } catch {
    return null;
  }
}

export async function GET(request) {
  if (!API_KEY) {
    return NextResponse.json(
      { error: "サーバーにAPIキーが設定されていません。.env.localを確認してください。" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city");
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  try {
    let latitude = lat;
    let longitude = lon;
    let resolvedName = null;

    // 都市名指定の場合は先にジオコーディングで緯度経度に変換する
    if (city && (!lat || !lon)) {
      const geoRes = await fetch(
        `${GEO_URL}?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`
      );
      if (!geoRes.ok) {
        return NextResponse.json(
          { error: "都市の検索に失敗しました。" },
          { status: geoRes.status }
        );
      }
      const geoData = await geoRes.json();
      if (!geoData.length) {
        return NextResponse.json(
          { error: `「${city}」が見つかりませんでした。都市名を確認してください。` },
          { status: 404 }
        );
      }
      latitude = geoData[0].lat;
      longitude = geoData[0].lon;
      resolvedName =
        geoData[0].local_names?.ja || geoData[0].name || city;
    }

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: "都市名または緯度・経度を指定してください。" },
        { status: 400 }
      );
    }

    const forecastRes = await fetch(
      `${BASE_URL}?lat=${latitude}&lon=${longitude}&units=metric&lang=ja&appid=${API_KEY}`
    );

    if (!forecastRes.ok) {
      const errBody = await forecastRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: errBody.message || "天気情報の取得に失敗しました。" },
        { status: forecastRes.status }
      );
    }

    const data = await forecastRes.json();
    const uviByDate = await fetchUviByDate(latitude, longitude);

    return NextResponse.json({
      city: resolvedName || data.city?.name,
      country: data.city?.country,
      timezoneOffset: data.city?.timezone, // 秒単位
      list: data.list, // 3時間ごとの予報(5日分)
      uviByDate, // 日付("YYYY-MM-DD")ごとのUV指数。取得できない場合はnull
    });
  } catch (err) {
    return NextResponse.json(
      { error: "天気情報の取得中にエラーが発生しました。" },
      { status: 500 }
    );
  }
}
