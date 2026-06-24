# 유지보수성(Maintainability) 리뷰

## 발견사항

### 가독성 / 네이밍

- **[INFO]** `constants.ts` 파일명이 `lib/api/` 경로에 위치해 범위가 명확함
  - 위치: `codebase/frontend/src/lib/api/constants.ts`
  - 상세: 파일 상단 주석에 "비-API 전역 상수는 lib/constants/에 둔다"는 경계가 명시되어 있어 후속 기여자가 혼동 없이 파일을 찾을 수 있음. `API_BASE_URL` / `WS_BASE_URL` / `getServerApiBaseUrl()` 의 네이밍이 각각 사용 맥락(클라이언트, WebSocket, 서버 컴포넌트)을 충분히 구분함.
  - 제안: 없음. 현행 유지.

- **[INFO]** `register-form.tsx`의 `EMAIL_RE` 정규식이 컴포넌트 함수 본체 내 `checkEmailAvailability` 함수 직전에 선언되어 렌더 사이클마다 재정의됨
  - 위치: `codebase/frontend/src/components/auth/register-form.tsx` - `const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;`
  - 상세: 이번 PR 변경 대상이 아닌 기존 코드. 비용이 극히 낮은 리터럴이므로 실성능 문제는 없으나, 모듈 상단으로 올리면 "컴포넌트 외부에서도 의미있는 상수"임을 명시적으로 드러낼 수 있음.
  - 제안: 모듈 최상단(파일 스코프)으로 이동. 이번 PR 범위 외이므로 별도 이슈로 처리 가능.

### 중복 코드

- **[INFO]** `getServerApiBaseUrl()`과 `API_BASE_URL` 상수 양쪽에 fallback 문자열 `"http://localhost:3011/api"`가 중복 리터럴로 등장함
  - 위치: `codebase/frontend/src/lib/api/constants.ts` - `API_BASE_URL` 정의(라인 ~14)와 `getServerApiBaseUrl()` 반환값(라인 ~33)
  - 상세: 현재는 일치하나, 나중에 한쪽만 수정되면 분산 정의 문제가 재발함. SoT 파일 내부에서도 동일 리터럴 중복은 잠재적 drift 위험.
  - 제안: 내부 private 상수 `const LOCAL_API_FALLBACK = "http://localhost:3011/api";`를 선언하고 두 곳에서 참조. 현재 파일 크기가 작아 즉각적 위험은 낮으므로 WARNING 수준은 아님.

### 매직 넘버

- **[INFO]** `login-form.tsx`에서 TOTP 코드 최소 길이 `6`과 복구 코드 최소 길이 `12`가 named constant 없이 인라인 하드코딩됨
  - 위치: `codebase/frontend/src/components/auth/login-form.tsx` - `totpCode.trim().length < 6` (onSubmitTotp), `recoveryCode.trim().length < 12` (onSubmitRecovery)
  - 상세: 이번 PR 변경 대상이 아닌 기존 코드. auth 스펙에서 유래하는 값이지만 주석 없이 리터럴로만 존재해 수정 시 두 곳을 각각 찾아야 함.
  - 제안: `const TOTP_CODE_LENGTH = 6`, `const RECOVERY_CODE_MIN_LENGTH = 12` 등으로 추출. 이번 PR 범위 외.

### 일관성

- **[INFO]** `ws-client.ts`의 import 경로가 상대 경로(`"../api/constants"`)인 반면 `login-form.tsx`, `register-form.tsx`는 alias(`"@/lib/api/constants"`)를 사용함
  - 위치: `codebase/frontend/src/lib/websocket/ws-client.ts` - `import { WS_BASE_URL } from "../api/constants";`
  - 상세: 두 형태 모두 동작함. `ws-client.ts`는 기존에도 `"../api/client"`처럼 상대 경로를 사용하고 있어 파일 내 일관성은 유지됨. 단, 코드베이스 전반의 우세 패턴은 `@/` alias이므로 장기적으로 통일이 바람직함.
  - 제안: `ws-client.ts` 내 상대 경로를 `@/` alias로 일괄 교체 검토. 이번 PR 범위 외.

### 변경 품질 (긍정적 평가)

- **[INFO]** `auth-providers.ts`에서 원래 파일 상단에 있던 서버 컴포넌트 fetch 이유 주석이 `constants.ts` JSDoc으로 이동하고, 콜사이트에는 간결한 참조 주석이 남겨짐
  - 위치: `codebase/frontend/src/lib/api/auth-providers.ts` 라인 14-15
  - 상세: "See lib/api/constants.ts" 형태의 참조가 적절함. 상세 설명이 단일 SoT로 집중되고 콜사이트는 경량화됨. 정보 손실 없이 문서 분산을 해소한 좋은 패턴.

## 요약

이번 M-2 리팩터는 API/WS base URL fallback 정의를 5개 파일에서 `lib/api/constants.ts` 단일 모듈로 통합하고, 잘못된 포트 `3001`을 정규 포트 `3011`로 일괄 교정한 집중적인 유지보수성 개선 작업이다. 변경 범위가 좁고 목적이 명확하며, 기존 스타일·패턴을 잘 따른다. 신규 `constants.ts`는 세 수출물의 책임 경계와 우선순위를 JSDoc으로 충실히 문서화했고, 소비 파일 4곳에서 로컬 const를 완전히 제거해 향후 drift 가능성을 구조적으로 차단했다. 지적된 사항들은 모두 이번 PR 변경 대상이 아닌 기존 코드의 낮은 수준 개선 여지이며, 본 변경이 이를 악화시키지 않는다. 유일한 구조적 잔류 위험은 `constants.ts` 내 fallback 문자열 `"http://localhost:3011/api"`가 두 곳에 리터럴로 중복되는 점이지만, 같은 파일 내 변경이므로 관리 부담이 매우 낮다.

## 위험도

NONE
