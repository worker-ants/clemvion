# API 계약(API Contract) 리뷰

검토일: 2026-06-03  
범위: feat-web-chat-demo PR (dev-only 데모 하니스 + 포트 분리)

---

## 발견사항

### [INFO] postMessage 프로토콜(`wc:*`) 계약 — 하위 호환성 및 스키마 준수

- **위치**: `codebase/channel-web-chat/src/app/demo/demo-host.tsx` 전체, `demo-config.ts` `buildBootConfig`
- **상세**: 본 변경이 직접 정의하는 HTTP API 엔드포인트나 REST 경로는 없다. 외부 계약면은 host↔iframe 간 postMessage 프로토콜(`wc:boot`, `wc:command`, `wc:ready`, `wc:event`, `wc:resize`)이다. `buildBootConfig`가 조립하는 `BootMessage` 페이로드는 `@/widget/host-bridge`의 타입을 그대로 사용하므로 계약 타입 드리프트 위험이 없다. 데모에서 노출하는 명령(`open`/`close`/`sendMessage`)은 위젯이 실제 처리하는 명령만으로 한정되어 있으며, 미구현 명령(`show`/`hide`/`updateProfile`)은 의도적으로 제외되었고 주석으로 명시되어 있다.
- **제안**: 현행 유지.

### [INFO] `apiBase` / `triggerEndpointPath` 입력 검증 범위

- **위치**: `demo-config.ts` `isBootReady` (라인 596-598), `buildBootConfig` (라인 601-626)
- **상세**: `isBootReady`는 두 필드의 `.trim().length > 0` 만 확인한다. `apiBase`에 대한 URL 형식 검증(예: `URL` 생성자를 통한 유효성)이나 프로토콜 제약(`http://` 또는 `https://`)이 없다. 다만 이 컴포넌트는 dev-only 데모 하니스이고 입력자가 개발자 본인이므로, 잘못된 URL은 위젯의 fetch 실패로 즉시 드러난다. 프로덕션 API 계약에 영향이 없는 범위다.
- **제안**: 프로덕션 계약 무관. 필요 시 `URL` 생성자 wrap으로 URL 형식 검증을 추가할 수 있으나 필수 아님.

### [INFO] postMessage `targetOrigin` 고정 — 보안 적절성

- **위치**: `demo-host.tsx` 라인 793 (`win.postMessage({ type, payload }, window.location.origin)`)
- **상세**: `postToWidget`은 `targetOrigin`을 `window.location.origin`으로 고정한다. 위젯 iframe의 `src`가 `WIDGET_SRC`(`NEXT_PUBLIC_BASE_PATH + "/"`)이며 same-origin이므로 `"*"`를 쓰지 않은 것은 올바르다. 수신 측에서도 `e.source`와 `e.origin` 이중 검증(`wc:` prefix 필터 포함)이 적용되어 있다(라인 802-805). 이는 consistency-check I6 항목의 요구사항을 충족한다.
- **제안**: 현행 유지.

### [INFO] 데모 라우트 게이팅 — 인증/인가 대신 환경 기반 접근 제어

- **위치**: `src/app/demo/page.tsx`, `demo-config.ts` `isDemoEnabled`
- **상세**: `/demo` 경로는 `NODE_ENV !== "production"` 또는 `NEXT_PUBLIC_ENABLE_DEMO === "1"` 조건으로만 게이팅된다. 별도의 인증/인가가 없으나, 이 라우트는 정적 export(`next build`)에서 `notFound()`를 통해 제외되므로 프로덕션 번들에 포함되지 않는다. `NEXT_PUBLIC_ENABLE_DEMO=1` 로 prod preview를 활성화해도 외부 사용자가 접근할 수 있는 상황이지만, 데모는 민감 데이터를 다루지 않고 개발자 도구 역할이므로 인증 요건 미적용은 합리적이다.
- **제안**: prod preview용 opt-in escape hatch(`NEXT_PUBLIC_ENABLE_DEMO=1`)가 CI/CD 파이프라인에서 의도치 않게 활성화되지 않도록 배포 문서나 CI 환경변수 목록에 주의 표시를 권장한다. (차단 사유 아님)

---

## 요약

이 변경은 HTTP REST API 엔드포인트, URL 경로 설계, 페이지네이션 등 전통적인 API 계약 관점에서 평가할 요소가 없는 dev-only 데모 하니스 추가다. 외부 계약면은 host↔iframe 간 `wc:*` postMessage 프로토콜이며, 이는 기존 `BootMessage` 타입을 그대로 참조하여 타입 드리프트 없이 구현되었다. 수신 측 보안 검증(`event.source` + `event.origin` + `wc:` prefix 필터)도 올바르게 적용되었다. 발견사항 전부 INFO 등급이며, 기존 클라이언트에 대한 breaking change나 API 계약 위반은 없다.

---

## 위험도

NONE
