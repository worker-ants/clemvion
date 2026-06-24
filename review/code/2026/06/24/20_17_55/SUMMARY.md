# Code Review 통합 보고서

리뷰 대상: `refactor(frontend): M-2 — API_BASE_URL 분산 정의 통합 + 3001→3011 fallback 정정`

---

## 전체 위험도

**LOW** — 순수 동작 보존(behavior-preserving) 리팩터로 Critical 발견 없음. 신규 핵심 모듈 `constants.ts` 에 대한 단위 테스트 부재가 LOW 수준의 유일한 실질 위험.

---

## Critical 발견사항

_없음_

---

## 경고 (WARNING)

_없음_

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `constants.ts` 신규 모듈에 대한 단위 테스트 부재 — `API_BASE_URL` fallback 포트 3011, `WS_BASE_URL`, `getServerApiBaseUrl()` 우선순위 3경로 모두 미검증. 향후 포트 오타(3001 재도입)를 자동 감지하는 회귀 방지 망 없음 | `src/lib/api/constants.ts` (신규), `src/lib/api/__tests__/`, `src/lib/websocket/__tests__/` | `src/lib/api/__tests__/constants.test.ts` 신규 작성. `webhook-url.test.ts` 의 `process.env` + `vi.resetModules()` 패턴 참고. `client.test.ts` 에 `apiClient.defaults.baseURL` assert 1건, `ws-client.test.ts` 에 `io()` 첫 인자 `"http://localhost:3011/ws"` assert 1건 추가 권장 |
| 2 | Security | HTTP 평문 fallback URL — `API_BASE_URL`, `WS_BASE_URL`, `getServerApiBaseUrl()` 의 모든 dev fallback 이 `http://localhost:3011/...` 로 고정. env 미설정 비-dev 빌드 시 인증 토큰·세션 쿠키가 평문 전송될 수 있음 | `src/lib/api/constants.ts` lines 13, 18, 33–34 | CI 파이프라인에서 `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` / `INTERNAL_API_URL` 미설정 시 빌드 차단 검증 단계 추가, 또는 비-localhost URL + `http://` 조합 시 경고 출력 guard 추가 |
| 3 | Security | `getServerApiBaseUrl()` 서버 전용 함수에 클라이언트 호출 런타임 guard 없음. 클라이언트 호출 시 `NEXT_PUBLIC_API_URL` fallback 으로 degrade 해 실제 보안 임팩트는 낮으나 개발 단계 오용 조기 차단 어려움 | `src/lib/api/constants.ts` line 32, `auth-providers.ts` line 16 | 함수 상단에 `if (typeof window !== "undefined") throw new Error("getServerApiBaseUrl must only be called server-side")` 가드 추가 |
| 4 | Security | OAuth `startOauth()` 에서 `provider` 값이 `window.location.href` 에 직접 삽입 — 현재 TypeScript 타입 + `enabledProviders.includes()` 조건 렌더로 위험 낮으나, 서버 응답 타입이 런타임에 강제되지 않음 | `src/components/auth/login-form.tsx` line 195, `register-form.tsx` line 671 | `provider` 삽입 전 허용 목록(`["google", "github"]`) 런타임 검증 또는 `encodeURIComponent(provider)` 적용 |
| 5 | Maintainability | `constants.ts` 내 fallback 리터럴 `"http://localhost:3011/api"` 가 `API_BASE_URL` 정의와 `getServerApiBaseUrl()` 반환값 두 곳에 중복. SoT 파일 내부에서도 drift 잠재 위험 | `src/lib/api/constants.ts` | `const LOCAL_API_FALLBACK = "http://localhost:3011/api"` private 상수 선언 후 두 곳 참조 |
| 6 | Maintainability | `ws-client.ts` import 경로가 상대 경로(`"../api/constants"`)이고 코드베이스 우세 패턴은 `@/` alias — 파일 내 기존 스타일과는 일치하나 장기적으로 불일치 | `src/lib/websocket/ws-client.ts` line 3 | `ws-client.ts` 내 상대 경로를 `@/` alias 로 일괄 교체 (이번 PR 범위 외) |
| 7 | Documentation | `INTERNAL_API_URL` 서버 전용 환경변수가 `.env.example` 에 없음 — 쿠버네티스/도커 배포 신규 담당자가 놓칠 수 있음 | 배포 가이드, docker-compose | 기존 인프라 문서에 `INTERNAL_API_URL` 기재 여부 확인, 미기재 시 배포 가이드 또는 docker-compose 주석에 한 줄 추가 |
| 8 | Documentation | `ws-client.ts` 의 `WsClient` 인터페이스 및 공개 함수(`createWsClient`, `getWsClient`, `resetWsClient`)에 JSDoc 없음 (기존 상태) | `src/lib/websocket/ws-client.ts` | 향후 ws-client 수정 시 공개 함수 JSDoc 추가 (이번 PR 범위 외) |
| 9 | Maintainability | `register-form.tsx` 에서 `EMAIL_RE` 정규식이 컴포넌트 함수 본체 내 선언되어 렌더 사이클마다 재정의 (기존 코드) | `src/components/auth/register-form.tsx` | 모듈 최상단 파일 스코프로 이동 (이번 PR 범위 외) |
| 10 | Maintainability | `login-form.tsx` 의 TOTP 최소 길이 `6`, 복구 코드 최소 길이 `12` 가 named constant 없이 인라인 하드코딩 (기존 코드) | `src/components/auth/login-form.tsx` | `const TOTP_CODE_LENGTH = 6`, `const RECOVERY_CODE_MIN_LENGTH = 12` 추출 (이번 PR 범위 외) |
| 11 | Security | `console.error`/`console.warn` 으로 내부 에러 정보 클라이언트 콘솔 노출 — 토큰 값 자체는 미포함이나 스택 트레이스 노출 가능 | `assistant.ts` line 1467, `ws-client.ts` lines 2040, 2070 | 에러 로깅 시 `err.message` 만 출력 패턴으로 정제, 프로덕션 빌드에서 `console.*` 제거 설정 적용 여부 확인 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | HTTP fallback, `getServerApiBaseUrl` 클라이언트 호출 guard 부재, OAuth provider 런타임 검증 — 모두 기존 패턴 유지; 신규 취약점 없음 |
| architecture | NONE | DRY 리팩터 방향성 적절, 단방향 의존성만 존재, 순환 참조 없음 |
| requirement | NONE | M-2 세 개선 방안 완전 달성, spec §1.4.2 WebAuthn 일치, 포트 미규정 영역 |
| scope | NONE | 변경 7건 모두 plan 명시 파일, 범위 이탈 없음 |
| side_effect | NONE | 공개 API 시그니처 보존, 환경 변수 읽기 순서 동일, 전역 상태 오염 없음 |
| maintainability | NONE | SoT 집중, 명명 명확, fallback 리터럴 내부 중복이 유일 잠재 drift 위험 |
| testing | LOW | `constants.ts` 전용 단위 테스트 부재, baseURL/WS URL fallback 포트 assert 없음 |
| documentation | NONE | `constants.ts` JSDoc 우수, `auth-providers.ts` 주석 재배치 적절, `INTERNAL_API_URL` 배포 문서 확인 필요 |

---

## 발견 없는 에이전트

architecture, requirement, scope, side_effect, maintainability, documentation — 모두 **NONE** (발견사항은 INFO 수준 개선 여지만 존재).

---

## 권장 조치사항

1. **(가장 우선)** `src/lib/api/__tests__/constants.test.ts` 신규 작성 — `NEXT_PUBLIC_API_URL` 설정/미설정, `NEXT_PUBLIC_WS_URL` 설정/미설정, `getServerApiBaseUrl()` 우선순위 3경로(INTERNAL_API_URL → NEXT_PUBLIC_API_URL → fallback) 각 케이스 커버. 특히 fallback 포트 `3011` 회귀 방지 케이스 필수.
2. `client.test.ts` 에 `apiClient.defaults.baseURL` assert 1건, `ws-client.test.ts` 에 `io()` 첫 인자 포트 3011 assert 1건 추가 (또는 constants.test.ts 에서 일괄 커버).
3. `constants.ts` 내 `"http://localhost:3011/api"` 리터럴 중복 제거 — `LOCAL_API_FALLBACK` private 상수로 추출.
4. `getServerApiBaseUrl()` 에 `typeof window !== "undefined"` 서버 전용 guard 추가 (개발 단계 오용 조기 차단).
5. CI 빌드 파이프라인에 `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` 필수 env 검증 단계 추가 또는 배포 체크리스트에 필수 항목 명시.
6. `INTERNAL_API_URL` 의 배포 가이드/docker-compose 문서화 여부 확인 후 미기재 시 한 줄 추가.

---

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행** (8명, 전원 router_safety 강제 포함): `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (architecture 는 선별 포함)
- **제외** (6명):

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 순수 상수 통합 리팩터 — 런타임 성능 변경 없음 |
| dependency | 외부 패키지 추가/변경 없음 |
| database | DB 스키마/마이그레이션 변경 없음 |
| concurrency | 비동기·스레드·락 관련 변경 없음 |
| api_contract | 백엔드 API 엔드포인트·스키마 변경 없음 |
| user_guide_sync | 사용자 가이드/문서 변경 없음 |
