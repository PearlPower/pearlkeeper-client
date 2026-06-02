import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { useStore } from "zustand";
import {
  Lock as LockIcon,
  Settings as SettingsIcon,
  Wallet as WalletIcon,
} from "lucide-react";
import { useAdapters } from "@prl-wallet/app-adapters";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export function MasterDetailLayout() {
  const { id: activeWalletId } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { stores } = useAdapters();
  const wallets = useStore(stores.walletList, (s) => s.wallets);
  const lockWallet = useStore(stores.lock, (s) => s.lock);

  const isSettingsRoute = location.pathname.startsWith("/settings");

  return (
    <SidebarProvider defaultOpen>
      <div data-testid="master-detail-grid" className="flex min-h-full w-full">
        <Sidebar
          collapsible="offcanvas"
          data-testid="master-pane"
          className="pb-10"
        >
          <SidebarHeader>
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Pearl Keeper
              </span>
              <SidebarTrigger />
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Wallets</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {wallets.map((w) => {
                    const isActive = activeWalletId === w.id;
                    return (
                      <SidebarMenuItem key={w.id}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => navigate(`/wallet/${w.id}`)}
                          aria-current={isActive ? "page" : undefined}
                          tooltip={w.name}
                          className="h-auto py-3"
                        >
                          <WalletIcon />
                          <span className="text-base font-semibold leading-snug truncate">
                            {w.name}
                          </span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarSeparator />
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="sm"
                  isActive={isSettingsRoute}
                  onClick={() => navigate("/settings")}
                  aria-current={isSettingsRoute ? "page" : undefined}
                  tooltip="Settings"
                  data-testid="sidebar-settings-link"
                  className="text-muted-foreground"
                >
                  <SettingsIcon />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="sm"
                  onClick={() => lockWallet()}
                  tooltip="Lock"
                  data-testid="sidebar-lock-button"
                  className="text-muted-foreground"
                >
                  <LockIcon />
                  <span>Lock</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>

          <SidebarRail />
        </Sidebar>

        <SidebarInset className="overflow-auto">
          <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/80 backdrop-blur px-3 py-2">
            <SidebarTrigger data-testid="sidebar-trigger-inset" />
          </header>
          <div className="flex-1">
            <Outlet />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
