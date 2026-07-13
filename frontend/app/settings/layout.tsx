import BizNav from "@/components/BizNav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="biz-layout">
      <BizNav />
      <div className="biz-layout-content">{children}</div>
    </div>
  );
}
