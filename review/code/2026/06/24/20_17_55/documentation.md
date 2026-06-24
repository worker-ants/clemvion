# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] constants.ts — 모듈 수준 JSDoc 우수: 환경변수 우선순위 설명 완비
- 위치: `codebase/frontend/src/lib/api/constants.ts` (전체)
- 상세: 파일 상단 블록 주석에 canonical SoT(.env.example), 빌드 타임 인라인 치환 동작, dev 전용 fallback 의도가 명시돼 있다. 각 export(`API_BASE_URL`, `WS_BASE_URL`, `getServerApiBaseUrl`)에 JSDoc 이 붙어 있으며, 특히 `getServerApiBaseUrl()`은 우선순위(`INTERNAL_API_URL` → `NEXT_PUBLIC_API_URL` → fallback)와 클라이언트 번들에서 undefined 로 degrade 되는 이유까지 설명한다. consistency-check INFO-4 권장("JSDoc 으로 우선순위 명시")이 구현 단계에서 완전히 반영됐다.
- 제안: 추가 조치 불필요.

### [INFO] auth-providers.ts — 이전 인라인 주석이 올바르게 이전됨
- 위치: `codebase/frontend/src/lib/api/auth-providers.ts` lines 1–6, 13–14
- 상세: 기존 파일에 있던 "Server-component fetches prefer INTERNAL_API_URL …" 설명 블록이 삭제됐고, 대신 호출부 인라인 주석(`// Server-component fetch — getServerApiBaseUrl() prefers INTERNAL_API_URL`)과 `See lib/api/constants.ts` 참조로 교체됐다. 파일 상단의 cache/read-only filesystem 이유 설명 주석은 그대로 유지됐다. 주석 정확성 면에서 변경 코드와 일치한다.
- 제안: 추가 조치 불필요.

### [INFO] assistant.ts — streamMessage JSDoc 이 기존 baseUrl 로컬 정의를 참조하지 않음(정상)
- 위치: `codebase/frontend/src/lib/api/assistant.ts` lines 1414–1425
- 상세: `streamMessage` 의 JSDoc 은 "fetch bypasses the axios response interceptor" 및 "401 refresh" 동작을 설명하며 URL 도출 방법은 별도 기술하지 않는다. 이는 URL 결정 책임이 `constants.ts` 로 위임됐으므로 적절한 관심사 분리다. 기존 주석(`// 401 → refresh once → retry`) 도 변경된 코드 흐름과 일치한다.
- 제안: 추가 조치 불필요.

### [INFO] ws-client.ts — 공개 인터페이스(WsClient) 에 JSDoc 없음 (기존 상태 유지)
- 위치: `codebase/frontend/src/lib/websocket/ws-client.ts` lines 2005–2017 (전체 파일 컨텍스트 기준)
- 상세: `WsClient` 인터페이스와 `createWsClient()`, `getWsClient()`, `resetWsClient()` 공개 함수에 JSDoc이 없다. 이 변경(PR M-2)이 추가한 것은 아니며 기존 상태이지만, 이번 리팩터가 해당 파일을 수정했으므로 기록한다. 복잡한 `connect_error` 처리 로직에는 상세한 인라인 주석이 잘 달려 있다.
- 제안: 이번 PR 범위 외 사항. 향후 ws-client 수정 시 `WsClient` 인터페이스 각 메서드와 `createWsClient()` / `getWsClient()` / `resetWsClient()` 에 JSDoc 추가 권장.

### [INFO] login-form.tsx / register-form.tsx — 컴포넌트 자체 JSDoc 없음 (기존 상태 유지)
- 위치: `codebase/frontend/src/components/auth/login-form.tsx`, `codebase/frontend/src/components/auth/register-form.tsx`
- 상세: 두 파일 모두 public export(`LoginForm`, `RegisterFormInner` 등)에 JSDoc이 없다. 기존 코드의 상태이며 이번 변경이 추가한 것은 아니다. `RegisterFormProps.invitationToken` 프로퍼티에는 spec 참조 JSDoc이 달려 있는 등 중요 props 문서화는 선별적으로 돼 있다. 변경된 부분(로컬 const 제거 → 중앙 import)은 주석 정확성에 영향을 주지 않는다.
- 제안: 이번 PR 범위 외 사항.

### [INFO] 환경변수 문서화: .env.example 이 canonical SoT 역할 — 추가 문서 불필요
- 상세: 커밋 메시지와 `constants.ts` 상단 주석 모두 `codebase/frontend/.env.example`을 canonical SoT로 명시한다. 신규 도입된 환경변수(`INTERNAL_API_URL`)는 서버 전용이고 `NEXT_PUBLIC_*` 가 아니므로 `.env.example` 에 추가할 필요는 없으나, 쿠버네티스/도커 배포 시 이 변수 설정 방법이 운영 문서에 언급되지 않으면 새 배포 담당자가 놓칠 수 있다.
- 제안: `INTERNAL_API_URL` 이 이미 기존 인프라 문서에 기재돼 있는지 확인하고, 미기재 시 배포 가이드(또는 docker-compose 주석)에 한 줄 추가 권장. 이번 PR 블록 사유는 아님.

### [INFO] CHANGELOG — 이 프로젝트에 CHANGELOG 파일 없음; 커밋 메시지가 역할 대체
- 상세: 커밋 메시지에 변경 범위(`3001→3011`, 영향 파일 6종, grep 검증 0건)가 충분히 기술돼 있어 히스토리 추적 목적으로 적절하다. 별도 CHANGELOG 파일은 프로젝트 관행상 없으며 필요 없다.
- 제안: 추가 조치 불필요.

## 요약

M-2 리팩터는 문서화 관점에서 전반적으로 우수하다. 핵심 신규 파일인 `codebase/frontend/src/lib/api/constants.ts`는 모듈 상단 블록 주석과 각 export 의 JSDoc 이 빌드 타임 동작, 환경변수 우선순위, dev fallback 의도를 명확히 설명하고 있으며 consistency-check 가 권장한 JSDoc 보완 사항도 구현 단계에서 완전히 반영됐다. `codebase/frontend/src/lib/api/auth-providers.ts`의 기존 인라인 설명 주석은 `constants.ts` 참조로 깔끔하게 재배치됐고 오래된 주석(stale comment) 문제도 없다. 기존 파일들(`ws-client.ts`, 인증 폼 컴포넌트)의 공개 함수 JSDoc 부재는 이번 PR이 만든 문제가 아니며 별도 개선 과제다. 운영 환경에서만 필요한 `INTERNAL_API_URL` 에 대한 배포 가이드 언급 여부만 추후 확인하면 충분하다.

## 위험도

NONE
