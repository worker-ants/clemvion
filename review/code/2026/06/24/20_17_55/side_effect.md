# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] constants.ts — 모듈 레벨 상수 평가 시점 고정
- 위치: `codebase/frontend/src/lib/api/constants.ts` 라인 13–15, 19–20
- 상세: `API_BASE_URL`과 `WS_BASE_URL`은 `const`로 선언되어 모듈 최초 로드 시 `process.env.*`를 한 번 읽어 값이 고정된다. Next.js의 `NEXT_PUBLIC_*` 변수는 빌드 타임 인라인 치환이므로 런타임에 환경 변수가 바뀌어도 영향 없다. 이는 기존 분산 정의들과 동일한 평가 방식이며 의도한 동작이다. 부작용 없음.
- 제안: 없음 (의도된 설계).

### [INFO] getServerApiBaseUrl() — 서버 전용 함수의 클라이언트 번들 포함 가능성
- 위치: `codebase/frontend/src/lib/api/constants.ts` 라인 31–37, `auth-providers.ts`
- 상세: `getServerApiBaseUrl()`은 서버 컴포넌트 전용으로 의도되었으나 `constants.ts`는 클라이언트도 import하는 파일(`client.ts`, `assistant.ts` 등)이다. 클라이언트 번들에 포함되어도 `process.env.INTERNAL_API_URL`은 `undefined`로 치환되어 자동 fallback하므로 실제 동작 부작용은 없다. 단, 함수 자체가 클라이언트 번들 사이즈에 추가된다.
- 제안: 허용 가능 수준. 향후 파일 분리(`constants.server.ts`)로 tree-shaking 최적화를 고려할 수 있으나 현 규모에서 불필요.

### [INFO] auth-providers.ts — 로컬 const에서 함수 호출로 전환
- 위치: `codebase/frontend/src/lib/api/auth-providers.ts` 라인 15
- 상세: 이전에는 모듈 레벨 `const API_BASE_URL`이 한 번만 환경 변수를 읽었다. 이제 `getServerApiBaseUrl()`이 `fetchEnabledOauthProviders()` 호출마다 실행된다. `process.env.*` 읽기는 순수 참조이며 Next.js 빌드 타임 치환 대상이므로 반복 호출에도 부작용 없다. 성능 오버헤드 무시 가능 수준.
- 제안: 없음.

### [INFO] 환경 변수 읽기 패턴 — 기존 동작 완전 보존
- 위치: `codebase/frontend/src/lib/api/constants.ts`
- 상세: `auth-providers.ts`의 기존 우선순위(`INTERNAL_API_URL → NEXT_PUBLIC_API_URL → fallback`)가 `getServerApiBaseUrl()`에 그대로 옮겨졌다. `login-form.tsx`, `register-form.tsx`, `client.ts`, `assistant.ts`의 기존 패턴(`NEXT_PUBLIC_API_URL || fallback`)도 `API_BASE_URL`에 보존되었다. 환경 변수 읽기 순서 변경 없음.
- 제안: 없음.

### [INFO] ws-client.ts — 로컬 변수명 변경 (WS_URL → WS_BASE_URL)
- 위치: `codebase/frontend/src/lib/websocket/ws-client.ts`
- 상세: 모듈-로컬 `WS_URL` const가 제거되고 import한 `WS_BASE_URL`로 교체되었다. 두 코드 모두 `${변수}/ws` 형태로 socket.io 연결에 사용되어 동작 동일. 이름 변경이 외부로 노출되지 않으므로 호출자 영향 없음.
- 제안: 없음.

### [INFO] 전역 변수 — 신규 도입 없음
- 위치: 변경 파일 전체
- 상세: `constants.ts`에 추가된 `API_BASE_URL`, `WS_BASE_URL` export는 module-scope 상수이다. JS 모듈 시스템에서 각 모듈은 격리된 스코프를 가지므로 이는 전역 변수(`window.*`, `global.*`)가 아니다. 전역 상태 오염 없음.
- 제안: 없음.

### [INFO] 시그니처 변경 없음 — 공개 API 보존
- 위치: 변경 파일 전체
- 상세: 7개 파일 중 어느 파일도 export하는 함수/타입/인터페이스의 시그니처를 변경하지 않았다. `OAuthProvider` 타입, `fetchEnabledOauthProviders()`, `assistantApi.*`, `apiClient`, `createWsClient()`, `getWsClient()` 등 모든 공개 API가 동일 시그니처를 유지한다. `getServerApiBaseUrl()`은 신규 추가된 export이므로 기존 호출자에 영향 없다.
- 제안: 없음.

### [INFO] 네트워크 호출 패턴 변경 없음
- 위치: `codebase/frontend/src/lib/api/assistant.ts`, `auth-providers.ts`
- 상세: `assistant.ts`의 `streamMessage`가 이전 3001 포트 대신 3011 포트(env 미설정 시)로 SSE 요청을 보낸다. 이는 의도된 버그 수정이며 env가 설정된 프로덕션 환경에서는 `NEXT_PUBLIC_API_URL`이 사용되어 포트 변경 없다. 새로운 네트워크 엔드포인트 도입 없음.
- 제안: 없음.

### [INFO] 이벤트/콜백 변경 없음
- 위치: 변경 파일 전체
- 상세: ws-client.ts의 socket.io 이벤트 핸들러 구조(`connect`, `connect_error`, `error` 등), assistant.ts의 SSE 파서, login/register form의 콜백 모두 변경 없다. URL 상수만 교체된 순수 리팩터이다.
- 제안: 없음.

## 요약

이번 변경은 분산된 URL 상수 정의를 `lib/api/constants.ts` 단일 모듈로 통합한 순수 리팩터이다. 모든 변경 파일에서 함수 시그니처, 공개 API, 이벤트 핸들러, 네트워크 호출 패턴이 그대로 보존되었다. 새로운 전역 변수나 파일시스템 부작용이 없으며, 환경 변수 읽기 순서도 기존과 동일하게 유지된다. env 미설정 개발 환경에서 `client.ts`와 `assistant.ts`의 fallback 포트가 3001에서 3011로 수정된 것은 의도된 버그 수정이며, `NEXT_PUBLIC_API_URL`이 설정된 프로덕션 및 정상 개발 환경에는 영향 없다. 부작용 관점에서 우려할 만한 발견사항 없음.

## 위험도

NONE
