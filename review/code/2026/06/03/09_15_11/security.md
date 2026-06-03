# 보안(Security) 리뷰

리뷰 대상: Channel Web Chat 로컬 데모 호스트 + dev 포트 분리 PR
리뷰일: 2026-06-03

---

## 발견사항

### [INFO] package.json dev 스크립트 내 `source .env` — 셸 인젝션 가능성 낮음
- **위치**: `codebase/channel-web-chat/package.json` 라인 7
  - `"dev": "source .env 2>/dev/null; next dev --port ${PORT:-3013}"`
- **상세**: `source .env` 는 `.env` 파일을 현재 셸에 직접 실행(eval)한다. 만약 `.env` 파일에 임의 셸 명령이 포함될 경우 실행될 수 있다. 그러나 `.gitignore` 에 `.env*`(`.env.example` 예외)가 포함되어 있어 `.env` 는 저장소에 커밋되지 않는다. 또한 이는 로컬 dev 전용 스크립트이며, 파일을 직접 작성한 개발자가 실행한다는 신뢰 경계가 있다. 실질적인 공격 표면은 없다.
- **제안**: 현행 유지. 다만 팀 내 보안 정책이 더 엄격하다면 `dotenv-cli` 등의 전용 도구를 사용하거나 `export $(grep -v '^#' .env | xargs)` 대신 Next.js 의 내장 `.env` 지원(`next dev` 는 `.env` 자동 로드)을 활용할 수 있다. 이 경우 `source .env` 라인을 제거하고 `.env` 파일 자체를 Next.js 가 읽도록 하면 셸 레벨 eval 을 피할 수 있다.

---

### [INFO] postMessage `targetOrigin` — `window.location.origin` 사용 (양호)
- **위치**: `codebase/channel-web-chat/src/app/demo/demo-host.tsx` 라인 90 (전체 컨텍스트 기준)
  - `win.postMessage({ type, payload }, window.location.origin);`
- **상세**: `"*"` 와일드카드 대신 `window.location.origin` 을 `targetOrigin` 으로 지정하여 same-origin iframe 에만 메시지를 전달한다. 이는 OWASP 권장 postMessage 보안 실천이다. 데모가 same-origin 구조로만 운영된다는 아키텍처 전제가 코드에 정확히 반영되어 있다.
- **제안**: 현행 유지. 운영 SDK 로 포팅 시에는 cross-origin 대상 `targetOrigin` 을 설정 기반 화이트리스트에서 가져오도록 설계해야 한다.

---

### [INFO] 수신 메시지 이중 검증 — `event.source` + `event.origin` (양호)
- **위치**: `codebase/channel-web-chat/src/app/demo/demo-host.tsx` 라인 799–802 (diff 기준)
  ```
  if (e.source !== iframeRef.current?.contentWindow) return;
  if (e.origin !== window.location.origin) return;
  ```
- **상세**: 수신 `message` 이벤트에서 `event.source` 가 실제 iframe `contentWindow` 와 일치하는지, 그리고 `event.origin` 이 현재 origin 과 동일한지 두 가지를 모두 검증한다. 이는 consistency-check I6 항목이 요구한 보안 요건을 정확히 구현한 것이다. 허가되지 않은 제3자 프레임이나 외부 사이트의 메시지를 무시한다.
- **제안**: 현행 유지.

---

### [INFO] 데모 페이지 게이팅 — `isDemoEnabled` + `notFound()` (양호)
- **위치**: `codebase/channel-web-chat/src/app/demo/page.tsx`
- **상세**: `NODE_ENV === "production"` 이고 `NEXT_PUBLIC_ENABLE_DEMO !== "1"` 이면 `notFound()` 를 호출하여 라우트를 404 처리한다. `next build`(정적 export) 에서 production 빌드 시 해당 경로가 번들에서 실질적으로 제외된다. 단, Next.js CSR 정적 export 특성상 빌드 시 페이지 JS 번들이 `out/` 에 포함될 수 있다는 점에 유의해야 한다.
- **제안**: 게이팅 로직 자체는 올바르다. 추가적인 보안 강화가 필요하다면 `next.config.js` 의 `rewrites` / `redirects` 또는 빌드 타임 `generateStaticParams` 에서 아예 경로를 제외하는 방법을 검토할 수 있다. 현재 use-case(dev 하니스)에서는 충분하다.

---

### [INFO] `NEXT_PUBLIC_ENABLE_DEMO=1` — 클라이언트 번들 노출
- **위치**: `codebase/channel-web-chat/.env.example` 및 `demo-config.ts` `isDemoEnabled`
- **상세**: `NEXT_PUBLIC_*` 변수는 Next.js 빌드 시 클라이언트 번들에 인라인된다. `NEXT_PUBLIC_ENABLE_DEMO=1` 로 빌드된 production 번들에는 해당 값이 포함되므로, 누군가 번들을 분석하면 데모 모드가 활성화된 빌드임을 알 수 있다. 이는 기능 정보 노출에 해당하나, 데모 라우트 자체가 민감 정보를 담고 있지 않으며 dev 하니스임을 감안하면 실질적 위험은 낮다.
- **제안**: production 배포 시 `NEXT_PUBLIC_ENABLE_DEMO` 를 설정하지 않는 것이 기본 권장이다(`.env.example` 에도 주석 처리로 문서화됨). 운영 환경에서는 해당 변수를 설정하지 말 것.

---

### [INFO] `apiBase` 입력값 — URL 검증 부재
- **위치**: `codebase/channel-web-chat/src/app/demo/demo-config.ts` `buildBootConfig` 및 `demo-host.tsx` API Host 입력 필드
- **상세**: `apiBase` 는 사용자가 직접 입력하며 `.trim()` 만 수행하고 URL 형식 유효성 검사를 하지 않는다. 데모 페이지는 dev 전용이고, 입력값은 위젯 SPA 내부에서 fetch 엔드포인트로 사용된다. `javascript:` 등의 프로토콜을 입력하더라도 fetch API 는 `javascript:` URL 을 거부하므로 실질적인 XSS 경로는 없다. 다만 임의 외부 호스트로의 요청을 유도할 수 있다(SSRF 는 클라이언트 사이드이므로 브라우저 CORS 정책으로 차단됨).
- **제안**: dev 전용 하니스라는 점에서 현재 수준으로 충분하다. 운영 SDK 코드로 전파 시에는 `new URL(apiBase)` 로 파싱하여 허용 프로토콜(`https:`)과 도메인 화이트리스트를 검증하는 로직을 추가할 것.

---

### [INFO] `logDetail` 표시 — `JSON.stringify(payload)` XSS 관련
- **위치**: `codebase/channel-web-chat/src/app/demo/demo-host.tsx` — `appendLog` 및 `logDetail` span 렌더링
- **상세**: `detail: detail === undefined ? "" : JSON.stringify(detail)` 로 직렬화한 뒤 `<span style={S.logDetail}>{l.detail}</span>` 로 React 가 텍스트 노드로 렌더링한다. React 는 기본적으로 JSX 내 문자열을 이스케이프하므로 XSS 위험이 없다. `dangerouslySetInnerHTML` 을 사용하지 않음.
- **제안**: 현행 유지.

---

### [INFO] `.gitignore` 강화 — `.env*` + `!.env.example` (양호)
- **위치**: `codebase/channel-web-chat/.gitignore`
- **상세**: 기존 `.env*.local` 패턴에서 `.env*`(전체) + `!.env.example` 예외 패턴으로 변경하여 `.env`, `.env.local`, `.env.production` 등 실제 시크릿을 담을 수 있는 모든 env 파일이 커밋되지 않도록 강화했다. `.env.example` 은 샘플 값만 포함하고 실제 시크릿 없이 명시적으로 허용한다.
- **제안**: 현행 유지.

---

### [INFO] 하드코딩된 시크릿 부재 (양호)
- **위치**: 전체 변경 파일
- **상세**: API 키, 비밀번호, 토큰, 인증서 등 하드코딩된 시크릿이 코드 내에 없다. `defaultDemoForm.apiBase = "http://localhost:3011/api"` 는 로컬 개발 기본값으로 시크릿이 아니다.
- **제안**: 현행 유지.

---

## 요약

이번 PR 은 channel-web-chat 의 dev 전용 데모 하니스(`/demo` 라우트) 추가와 dev 포트 분리로 구성된다. 전반적인 보안 실천 수준이 양호하다. postMessage 통신에서 `targetOrigin` 을 `window.location.origin` 으로 고정하고, 수신 메시지를 `event.source` + `event.origin` 이중 검증하는 구현은 OWASP 권장 postMessage 보안을 정확히 따른다. `.gitignore` 강화로 env 시크릿 커밋 위험이 낮아졌고, 하드코딩된 시크릿은 없다. 데모 페이지 게이팅(`isDemoEnabled` + `notFound()`)은 production 노출을 효과적으로 차단한다. 경미한 관찰 사항으로 `package.json` dev 스크립트의 `source .env`(셸 eval), `apiBase` URL 형식 미검증이 있으나 모두 dev-only 범위이며 실질적 공격 표면이 없다. 운영 코드로 전파 시 URL 검증 및 `targetOrigin` 화이트리스트 설계가 필요하다.

---

## 위험도

LOW
