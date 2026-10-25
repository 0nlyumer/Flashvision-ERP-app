// Smoke harness — renders the REAL ArtLoginView (Paper Leaf login) so the
// login-margins job can measure the card's on-screen geometry in a real
// browser under the SAME body display-scale AppContext applies in
// production (webScale 75%: body zoom + compensating width/height — the
// generated index.html applies those body styles before this bundle runs,
// exactly like AppContext does on mount). NOT part of the app build.
import '../src/index.css';
import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ArtLoginView from '../src/components/login/ArtLoginView';
import { getLoginThemeById } from '../src/utils/loginThemes';
// The production theme image is the public file /login-themes/paper-leaf.jpg
// (byte-identical). The harness loads over file://, where that absolute path
// cannot resolve, so the SAME file is imported here — vite inlines it as a
// data URI (assetsInlineLimit) and the component renders the identical bytes.
import paperLeafUrl from '../public/login-themes/paper-leaf.jpg';

function Harness() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const usernameInputRef = useRef(null);
  return (
    <ArtLoginView
      theme={{ ...getLoginThemeById('paper-leaf'), image: paperLeafUrl }}
      companyName="Flashvision"
      identifier={identifier}
      setIdentifier={setIdentifier}
      password={password}
      setPassword={setPassword}
      showPassword={showPassword}
      setShowPassword={setShowPassword}
      rememberMe={rememberMe}
      setRememberMe={setRememberMe}
      isCapsLockOn={false}
      errorMessage=""
      lockoutSeconds={0}
      sessionExpiredNotice=""
      isSubmitting={false}
      handoverMessage=""
      shakeField={null}
      onSubmit={(e) => e.preventDefault()}
      onForgotPassword={() => {}}
      onKeyDown={() => {}}
      onKeyUp={() => {}}
      usernameInputRef={usernameInputRef}
    />
  );
}

createRoot(document.getElementById('root')).render(<Harness />);
