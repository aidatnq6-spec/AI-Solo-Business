import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { AppShell } from "@/components/app-shell";
import "./globals.css";
export const metadata:Metadata={title:"Sổ Nội Dung — Nội dung dành cho kế toán",description:"Bàn làm việc cá nhân tạo, duyệt và lưu nội dung cho bốn kênh mạng xã hội."};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      {/* Browser extensions can add body attributes before React hydrates.
          Keep this exception on body so child mismatches remain visible. */}
      <body suppressHydrationWarning>
        <WorkspaceProvider>
          <AppShell>{children}</AppShell>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
