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
    <main className="min-h-screen bg-[#f5f6f7]">
      <div className="sticky top-0 z-20">
        <header className="bg-white border-b border-gray-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#21A038] flex items-center justify-center">
                <span className="text-white font-bold text-lg leading-none">S</span>
              </div>
              <span className="font-display font-bold text-gray-900 text-lg">Claim Assistant Admin</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 text-gray-500 rounded-xl">
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Выйти</span>
            </Button>
          </div>
        </header>
        <nav className="bg-white border-b border-gray-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2 flex gap-1 overflow-x-auto">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                    active ? "bg-[#e8f5ea] text-[#21A038]" : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
      {children}
    </main>
  );
}
