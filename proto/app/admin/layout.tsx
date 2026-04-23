"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BarChart3, Settings, Book, History, LogOut } from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin", label: "Дашборд", icon: BarChart3 },
  { href: "/admin/calibration", label: "Калибровка", icon: Settings },
  { href: "/admin/catalogs", label: "Справочники", icon: Book },
  { href: "/admin/history", label: "История", icon: History },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Login page has its own standalone layout — skip the shared chrome.
  if (pathname === "/admin/login") return <>{children}</>;

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-20">
        <header className="bg-white border-b px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#21A038] rounded-md" />
            <span className="font-semibold text-gray-900">Claim Assistant Admin</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 text-gray-500">
            <LogOut className="w-4 h-4" /> Выйти
          </Button>
        </header>
        <nav className="flex gap-1 px-4 py-2 bg-white border-b overflow-x-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap ${
                  active ? "bg-[#e8f5ea] text-[#21A038]" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </main>
  );
}
