import { ClientPreview } from "@/components/client-preview";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ClientPreview token={token} />;
}
