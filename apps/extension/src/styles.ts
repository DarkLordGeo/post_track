export const BUTTON_CSS = `
:host { all: initial; }
.pt-btn {
  all: unset; box-sizing: border-box; cursor: pointer;
  display: inline-flex; align-items: center; gap: 5px;
  height: 26px; padding: 0 10px 0 8px; border-radius: 999px;
  font: 600 12px/1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  letter-spacing: -0.005em; white-space: nowrap;
  color: #1f2430; background: #ffffff;
  border: 1px solid rgba(15, 20, 30, 0.14);
  box-shadow: 0 1px 2px rgba(15, 20, 30, 0.06);
  transition: background-color .15s, border-color .15s, color .15s, transform .1s;
}
.pt-btn:hover { background: #f4f6f8; border-color: rgba(15, 20, 30, 0.24); }
.pt-btn:active { transform: translateY(1px); }
.pt-btn:focus-visible { outline: 2px solid #12a37a; outline-offset: 2px; }
.pt-btn svg { width: 14px; height: 14px; flex: none; }
.pt-btn[data-state="tracked"] { color: #0b7a5a; background: #e8f7f1; border-color: rgba(18, 163, 122, 0.35); }
.pt-btn[data-state="tracked"]:hover { background: #dcf2ea; }
.pt-btn[data-state="error"] { color: #b42318; background: #fff1f0; border-color: rgba(180, 35, 24, 0.3); }
.pt-btn[data-state="saving"], .pt-btn[data-state="unknown"] { cursor: default; opacity: .75; }
.spin { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-color-scheme: dark) {
  .pt-btn { color: #e8eaee; background: #1d2129; border-color: rgba(255,255,255,0.16); }
  .pt-btn:hover { background: #262b35; }
  .pt-btn[data-state="tracked"] { color: #5fd3a9; background: rgba(18,163,122,.14); border-color: rgba(95,211,169,.35); }
  .pt-btn[data-state="error"] { color: #ff8a80; background: rgba(180,35,24,.16); }
}
`;

export const TOAST_CSS = `
:host { all: initial; }
.stack { position: fixed; z-index: 2147483647; right: 16px; bottom: 16px; display: flex; flex-direction: column; gap: 8px; align-items: flex-end; pointer-events: none; }
.toast {
  pointer-events: auto; display: flex; align-items: center; gap: 10px; max-width: 360px;
  padding: 10px 12px 10px 12px; border-radius: 10px;
  font: 500 13px/1.35 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #f4f5f7; background: #17191f; box-shadow: 0 10px 30px -8px rgba(0,0,0,.35), 0 0 0 1px rgba(255,255,255,.06);
  animation: in .22s cubic-bezier(.2,.8,.2,1) both;
}
.toast.out { animation: out .3s ease both; }
.dot { width: 8px; height: 8px; border-radius: 99px; background: #3ccf9a; flex: none; }
.toast.err .dot { background: #ff6b5e; }
.toast button { all: unset; cursor: pointer; margin-left: 4px; font-weight: 600; color: #7ee2bd; }
.toast button:hover { text-decoration: underline; }
@keyframes in { from { opacity: 0; transform: translateY(6px) scale(.98); } }
@keyframes out { to { opacity: 0; transform: translateY(4px); } }
`;
