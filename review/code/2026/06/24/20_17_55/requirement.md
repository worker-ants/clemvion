# 요구사항(Requirement) 리뷰

리뷰 대상: M-2 API_BASE_URL 분산 정의 통합 + 3001→3011 fallback 정정

## 발견사항

### [INFO] 기능 완전성 — 통합 및 버그 수정 완전히 달성됨

- 위치: `codebase/frontend/src/lib/api/constants.ts` (신규), `client.ts`, `assistant.ts`, `ws-client.ts`, `auth-providers.ts`, `login-form.tsx`, `register-form.tsx`
- 상세: plan §M-2 의 세 개선 방안이 모두 이행됐다. (1) `constants.ts` 단일 정의처 신설. (2) `client.ts`·`assistant.ts`·`ws-client.ts` 의 잘못된 3001 fallback 을 3011 로 정정. (3) 4개 파일의 모듈-로컬 `const API_BASE_URL` 완전 제거 및 중앙 import 전환. `grep -rn "3001" frontend/src` 결과 기능 코드에 3001 잔류 없음(SVG·주석·문서 파일 제외).
- 제안: 없음.

### [INFO] spec 참조 일치 — 포트 번호는 spec 미규정 영역

- 위치: `spec/5-system/1-auth.md`, `spec/5-system/6-websocket-protocol.md`, `spec/5-system/2-api-convention.md`
- 상세: spec 본문 어디에도 `3001`·`3011` 포트 번호, `API_BASE_URL`, `INTERNAL_API_URL`, `NEXT_PUBLIC_API_URL` 을 직접 규정한 섹션이 없다. canonical SoT 는 `.env.example`(NEXT_PUBLIC_API_URL=:3011/api, NEXT_PUBLIC_WS_URL=:3011) 과 docker-compose APP_PORT 3011 이며, spec 본문과의 line-level 불일치 대상이 없다. 커밋 메시지의 "spec 변경 불요(포트 미규정)" 판단이 적절하다.
- 제안: 없음. spec fidelity 에 문제 없음.

### [INFO] `getServerApiBaseUrl()` — 서버 컴포넌트 전용 의도와 구현 일치

- 위치: `codebase/frontend/src/lib/api/constants.ts` L20-26, `codebase/frontend/src/lib/api/auth-providers.ts` L3
- 상세: `getServerApiBaseUrl()` 는 Next.js Server Component 전용으로 `INTERNAL_API_URL → NEXT_PUBLIC_API_URL → fallback` 우선순위로 동작한다. `INTERNAL_API_URL` 은 `NEXT_PUBLIC_*` 가 아니므로 클라이언트 번들에서 undefined 로 치환되어 자동으로 public URL fallback 된다. 이는 `auth-providers.ts` 의 기존 인라인 로직과 동일 우선순위를 유지하며 동작이 보존된다. 함수명·JSDoc·구현이 모두 일치한다.
- 제안: 없음.

### [INFO] 엣지 케이스 — 빈 env 값 처리 적절

- 위치: `codebase/frontend/src/lib/api/constants.ts` L11-14, L17-20
- 상세: `process.env.NEXT_PUBLIC_API_URL || fallback` 패턴은 빈 문자열(`""`)인 경우에도 fallback 으로 분기한다. Next.js 는 빌드 타임에 `NEXT_PUBLIC_*` 를 인라인 치환하므로 런타임에 빈 문자열이 되는 경우는 환경변수가 `=""` 로 설정된 명시적 오설정이다. 이 경우 fallback 3011 이 동작하는 것은 "env 오설정 → 개발 fallback" 으로 합리적이다.
- 제안: 없음.

### [INFO] WebAuthn 2FA 로직 — spec §1.4.2 와 정확히 일치

- 위치: `codebase/frontend/src/components/auth/login-form.tsx` L215
- 상세: `spec/5-system/1-auth.md §1.4.2` 는 "WebAuthn credential ≥ 1 이면 `methods: ['webauthn']`" 를 명시하며 "TOTP 코드 입력란은 숨김"을 요구한다. 구현은 `payload.methods.includes("webauthn") ? "webauthn" : "totp"` 로 WebAuthn 우선 분기하며, 화면 렌더 경로도 `twoFactorMethod === "webauthn"` / `twoFactorMethod === "totp"` 로 완전히 분리한다. 코드 주석도 spec §1.4.2 를 명시한다. spec 과 line-level 일치 확인.
- 제안: 없음.

### [INFO] 복구 코드 최소 길이 가드 — spec 미규정, 구현 독자 결정

- 위치: `codebase/frontend/src/components/auth/login-form.tsx` L286 (`recoveryCode.trim().length < 12`)
- 상세: `spec/5-system/1-auth.md` 는 WebAuthn 복구 코드의 최소 길이를 구체적으로 규정하지 않는다. 구현은 12자 미만 제출을 클라이언트에서 차단하는데, 이는 빈 코드·오탈자 조기 차단으로 UX 및 불필요한 API 호출을 방지하는 합리적 가드다. 실제 검증은 백엔드 해시 비교에서 이뤄진다.
- 제안: 없음. spec 침묵 영역의 합리적 구현.

### [INFO] OAuth startOauth 에 `rememberMe` 파라미터 전달 — spec 명세 범위 외

- 위치: `codebase/frontend/src/components/auth/login-form.tsx` L195-196
- 상세: `login-form.tsx` 의 `startOauth` 함수는 OAuth 리다이렉트 URL 에 `&rememberMe=true` 쿼리를 추가한다. `spec/5-system/1-auth.md §1.2 OAuth 소셜 로그인` 엔드포인트 표는 `GET /api/auth/oauth/:provider` 에 `rememberMe` 파라미터를 명시하지 않는다. 이는 기존 동작을 그대로 유지한 것(M-2 는 behavior-preserving 리팩터)이며 본 PR 의 변경 대상이 아니다. spec fidelity 관점에서 기존 동작으로 기록한다.
- 제안: 없음 (M-2 범위 외; 별도 spec 검토 필요 시 project-planner 위임).

### [INFO] TODO/FIXME — 없음

- 위치: 변경된 7개 파일 전체
- 상세: 미완성을 시사하는 TODO, FIXME, HACK, XXX 주석이 없다.
- 제안: 없음.

## 요약

M-2 리팩터의 핵심 목표(분산된 API/WS base URL 정의를 단일 `constants.ts` 로 통합하고 잘못된 3001 fallback 을 3011 로 정정)가 7개 파일에 걸쳐 완전히 달성됐다. `API_BASE_URL`, `WS_BASE_URL`, `getServerApiBaseUrl()` 세 export 모두 의도·명명·구현이 일치하며, 기존 auth-providers.ts 의 서버-사이드 우선순위 로직도 동등하게 보존됐다. spec 본문(§1.4.2 WebAuthn 우선 분기, §1.2 OAuth)과의 line-level 불일치는 발견되지 않았다. 포트 번호는 spec 미규정 영역이므로 spec fidelity 위반 대상이 아니다. 에러 시나리오(401 refresh-retry in assistant SSE, WebAuthn 브라우저 미지원 가드, 복구 코드 최소 길이 클라이언트 가드)도 적절히 처리돼 있다.

## 위험도

NONE
