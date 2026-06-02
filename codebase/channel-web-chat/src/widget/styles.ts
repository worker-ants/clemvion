// 위젯 인라인 스타일 (iframe 내부 격리 — 호스트 CSS 영향 없음). 최소 v1 테마(색·위치는 boot config).
export const widgetStyles = `
.wc-root { font-family: system-ui, -apple-system, sans-serif; }
.wc-launcher { position: fixed; bottom: 16px; right: 16px; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.wc-root[data-position="bottom-left"] .wc-launcher { right: auto; left: 16px; align-items: flex-start; }
.wc-launcher-suggestions { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.wc-bubble { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 8px 14px; font-size: 14px; cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,.1); }
.wc-launcher-btn { position: relative; width: 56px; height: 56px; border: 0; border-radius: 50%; color: #fff; font-size: 24px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.2); }
.wc-unread { position: absolute; top: -2px; right: -2px; min-width: 18px; height: 18px; background: #ef4444; color: #fff; border-radius: 9px; font-size: 11px; line-height: 18px; padding: 0 4px; }
.wc-panel { position: fixed; bottom: 16px; right: 16px; width: 360px; max-width: calc(100vw - 32px); height: 540px; max-height: calc(100vh - 32px); display: flex; flex-direction: column; background: #fff; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,.18); overflow: hidden; }
.wc-root[data-position="bottom-left"] .wc-panel { right: auto; left: 16px; }
.wc-panel-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #f0f0f0; }
.wc-panel-title { font-weight: 600; }
.wc-panel-close { border: 0; background: none; font-size: 16px; cursor: pointer; }
.wc-panel-body { flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
.wc-messages { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.wc-bubble-msg { max-width: 80%; padding: 8px 12px; border-radius: 12px; font-size: 14px; white-space: pre-wrap; word-break: break-word; }
.wc-assistant { align-self: flex-start; background: #f3f4f6; }
.wc-user { align-self: flex-end; background: #5B4FE9; color: #fff; }
.wc-quick-actions, .wc-suggestions { display: flex; flex-wrap: wrap; gap: 6px; }
.wc-action, .wc-suggestion { background: #fff; border: 1px solid #d1d5db; border-radius: 14px; padding: 6px 12px; font-size: 13px; cursor: pointer; }
.wc-form { display: flex; flex-direction: column; gap: 8px; }
.wc-form-row { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.wc-form-row input, .wc-form-row select { padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 8px; }
.wc-form-submit, .wc-newchat { align-self: flex-start; background: #5B4FE9; color: #fff; border: 0; border-radius: 10px; padding: 8px 14px; cursor: pointer; }
.wc-error { color: #b91c1c; font-size: 13px; }
.wc-ended { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; font-size: 14px; }
.wc-composer { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid #f0f0f0; }
.wc-composer-input { flex: 1; border: 1px solid #d1d5db; border-radius: 18px; padding: 8px 14px; font-size: 14px; }
.wc-composer-send { width: 36px; height: 36px; border: 0; border-radius: 50%; background: #5B4FE9; color: #fff; cursor: pointer; }
.wc-composer-send:disabled { opacity: .4; cursor: default; }
.wc-disclaimer { padding: 6px 12px; font-size: 11px; color: #9ca3af; text-align: center; }
.wc-presentations { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
.wc-pres-buttons { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.wc-pres-button { background: #fff; border: 1px solid #d1d5db; border-radius: 12px; padding: 5px 11px; font-size: 13px; cursor: pointer; text-decoration: none; color: inherit; }
.wc-pres-button[data-style="primary"] { background: #5B4FE9; color: #fff; border-color: #5B4FE9; }
.wc-pres-button[data-style="danger"] { background: #e64980; color: #fff; border-color: #e64980; }
.wc-carousel { border: 1px solid #e5e7eb; border-radius: 12px; padding: 10px; background: #fff; }
.wc-carousel-img { width: 100%; max-height: 140px; object-fit: cover; border-radius: 8px; }
.wc-carousel-title { font-weight: 600; font-size: 14px; margin-top: 6px; }
.wc-carousel-desc { font-size: 13px; color: #4b5563; margin-top: 2px; }
.wc-carousel-nav { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
.wc-carousel-prev, .wc-carousel-next { border: 1px solid #d1d5db; background: #fff; border-radius: 8px; width: 28px; height: 28px; cursor: pointer; }
.wc-carousel-prev:disabled, .wc-carousel-next:disabled { opacity: .4; cursor: default; }
.wc-carousel-count { font-size: 12px; color: #6b7280; }
.wc-table-wrap { overflow-x: auto; }
.wc-table { border-collapse: collapse; font-size: 13px; width: 100%; }
.wc-table th, .wc-table td { border: 1px solid #e5e7eb; padding: 5px 8px; text-align: left; }
.wc-table th { background: #f9fafb; font-weight: 600; }
.wc-table-truncated { font-size: 11px; color: #9ca3af; margin-top: 4px; }
.wc-chart-title { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
.wc-chart-svg { width: 100%; max-width: 280px; height: auto; }
.wc-template-body { font-size: 14px; white-space: pre-wrap; word-break: break-word; }
`;
