import { AppShell } from "@/components/app-shell";
import { ArkheProvider } from "@/components/arkhe-provider";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return <ArkheProvider><AppShell>{children}</AppShell></ArkheProvider>;
}
