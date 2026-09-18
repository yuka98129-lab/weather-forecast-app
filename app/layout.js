import "./globals.css";

export const metadata = {
  title: "天気予報アプリ",
  description: "OpenWeatherMap APIと連携した天気予報Webアプリ",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
