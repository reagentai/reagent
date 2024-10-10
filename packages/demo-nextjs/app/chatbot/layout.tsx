export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="dark w-full h-full">{children}</div>;
}
