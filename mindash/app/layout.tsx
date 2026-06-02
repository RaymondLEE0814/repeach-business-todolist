import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mindash — 마인드맵으로 계획하고, 일정표로 바로 실행하세요',
  description:
    '개인과 작은 팀을 위한 마인드맵 기반 프로젝트 일정관리. 아이디어를 업무로 바꾸고, 오늘 할 일을 놓치지 않게 도와줍니다.',
  openGraph: {
    title: 'Mindash — 마인드맵으로 계획하고, 일정표로 바로 실행하세요',
    description:
      '아이디어가 할 일로 흩어지지 않게, 마인드맵과 일정표를 한 화면에 연결합니다.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
