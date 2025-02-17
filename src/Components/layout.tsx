import { ReactNode } from 'react';
import { Header } from './Header';

export function Layout({
  children
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="w-full h-screen flex flex-col items-center pt-[70px] pb-8">
      <Header />
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}
