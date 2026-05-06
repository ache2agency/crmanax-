"use client";

export default function SignoutButton() {
  const handleSignout = async () => {
    localStorage.removeItem('windsor_login_at');
    const form = document.createElement('form');
    form.method = 'post';
    form.action = '/auth/signout';
    document.body.appendChild(form);
    form.submit();
  };

  return (
    <button type="button" onClick={handleSignout}>
      Cerrar sesión
    </button>
  );
}
