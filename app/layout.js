import "./globals.css";

export const metadata = {
  title: "Knowable — Learn anything deeply",
  description: "Personalized, interactive 10-minute courses built around your goal.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
