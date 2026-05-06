import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import CRM from './crm'
import SignoutButton from '@/components/SignoutButton'

export default async function Home() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  const metadata: any = user.user_metadata || {}
  const role = metadata.role || 'seller'
  const nombre = metadata.nombre || user.email?.split('@')[0] || 'Usuario'

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden" }}>
      <style>{`
        @media (max-width: 768px) { .top-user-bar { display: none !important; } }
      `}</style>
      <div className="top-user-bar" style={{
        padding:20,
        borderBottom:"1px solid #eee",
        display:"flex",
        justifyContent:"space-between",
        alignItems:"center",
        flexShrink:0,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span>Bienvenido {user.email}</span>
          {role === 'admin' && (
            <span style={{
              fontSize:10,
              padding:"2px 8px",
              borderRadius:999,
              background:"#111",
              color:"#E8A838",
              border:"1px solid #E8A838"
            }}>
              ADMIN
            </span>
          )}
        </div>

        <SignoutButton />
      </div>

      <div style={{ flex:1, minHeight:0, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <CRM />
      </div>
    </div>
  )
}