import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
});

const DESCRIPTION =
  'Da RAL a netto annuo e mensile, con il dettaglio di ogni trattenuta, la formula applicata e il riferimento normativo. Anno d’imposta 2026.';

export const metadata: Metadata = {
  // Su Vercel l'URL di produzione arriva dall'ambiente; in locale resta il dev server.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : 'http://localhost:3210'),
  ),
  title: 'Calcolatore Netto/Lordo 2026',
  description: DESCRIPTION,
  applicationName: 'Calcolatore Netto/Lordo',
  openGraph: {
    type: 'website',
    locale: 'it_IT',
    title: 'Calcolatore Netto/Lordo 2026',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Calcolatore Netto/Lordo 2026',
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body className={`${inter.className} ${inter.variable} ${jetbrainsMono.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
