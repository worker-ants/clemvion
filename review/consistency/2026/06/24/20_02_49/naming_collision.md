# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-prep`
범위: M-2 frontend API_BASE_URL 분산 정의 + 3001 포트 fallback 버그 정정

---

## 발견사항

### [INFO] `lib/api/constants.ts` 신규 파일 경로 — 기존 constants 디렉터리와 구분 필요
- **target 신규 식별자**: `codebase/frontend/src/lib/api/constants.ts`
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/constants/` 디렉터리 존재 (현재 `a11y.ts` 포함)
- **상세**: 경로 충돌은 없다 (`lib/api/constants.ts` vs `lib/constants/`). 그러나 `lib/constants/` 라는 범용 상수 폴더가 이미 있는 상태에서 API 전용 상수를 `lib/api/constants.ts` 에 두면 "상수는 lib/constants/ 에" 라는 관행이 분기된다. 충돌은 아니지만 두 위치 사이 일관성 주석이 없으면 혼동 여지가 있다.
- **제안**: `lib/api/constants.ts` 배치는 API 모듈 응집도 측면에서 합리적이다. API URL 관련 상수는 `lib/api/constants.ts` 에, 비-API 전역 상수는 `lib/constants/` 에 두는 분리 의도를 파일 상단 주석으로 명시하면 충분하다.

---

### [INFO] `API_BASE_URL` 모듈-로컬 식별자 — 중앙화 후 로컬 정의 완전 제거 필요
- **target 신규 식별자**: `lib/api/constants.ts` 에서 export 할 `API_BASE_URL` (또는 그에 준하는 상수)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/codebase/frontend/src/lib/api/client.ts` line 4: `const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"` (모듈-비공개)
  - `/Volumes/project/private/clemvion/codebase/frontend/src/lib/api/auth-providers.ts` line 18-21: `const API_BASE_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3011/api"` (모듈-비공개)
  - `/Volumes/project/private/clemvion/codebase/frontend/src/components/auth/login-form.tsx` line 32: `const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3011/api"` (모듈-비공개)
  - `/Volumes/project/private/clemvion/codebase/frontend/src/components/auth/register-form.tsx` line 32: `const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3011/api"` (모듈-비공개)
- **상세**: 모두 모듈-비공개 상수이므로 export 충돌은 없다. 리팩터 후 4개 파일에서 해당 local const 가 제거되고 중앙 모듈에서 import 하는 방식으로 전환되므로 충돌 대신 통합이 이루어진다.
- **제안**: 4개 파일 모두에서 로컬 `const API_BASE_URL` 을 완전히 제거해야 잔여 로컬 정의와의 혼용을 차단한다.

---

### [WARNING] `client.ts` 의 fallback 포트 `3001` — 다른 3개 파일의 `3011` 과 의미 불일치
- **target 신규 식별자**: 중앙 `API_BASE_URL` 의 fallback 값 (통합 시 `3011` 로 단일화 예정)
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/api/client.ts` line 4 의 `"http://localhost:3001/api"` — `auth-providers.ts`, `login-form.tsx`, `register-form.tsx`, `.env.example` (line 27) 은 모두 `3011` 을 사용
- **상세**: 이것이 M-2 리팩터의 핵심 버그다. `client.ts` 만 `3001` 을 fallback 으로 쓰고 있어 환경변수 미설정 시 axios 클라이언트와 서버 사이드 fetch / OAuth redirect URL 이 다른 포트를 가리킨다. 중앙 상수 통합 시 `3001` 을 그대로 가져가면 버그가 영속된다.
- **제안**: `.env.example` 의 `NEXT_PUBLIC_API_URL="http://localhost:3011/api"` 를 canonical SoT 로 삼아 `3011` 을 단일 fallback 으로 채택해야 한다. `3001` 은 제거 대상.

---

### [INFO] `getServerApiBaseUrl()` 신규 함수 — 기존 동일 역할 함수 없음
- **target 신규 식별자**: `getServerApiBaseUrl()` (서버 사이드 API base URL 해석 함수)
- **기존 사용처**: frontend `src/` 전체에 동일 이름 또는 동일 역할의 exported 함수가 존재하지 않는다. `auth-providers.ts` 가 모듈 로컬로 동일 로직을 인라인 구현 중이며 이 함수가 그것을 추출한다.
- **상세**: 충돌 없음. 신규 도입이 적절하다.
- **제안**: 없음.

---

### [INFO] `INTERNAL_API_URL` 환경변수 — 기존 문서·코드와 완전 일치
- **target 신규 식별자**: `process.env.INTERNAL_API_URL` (constants 모듈 내 server-side URL 해석)
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/api/auth-providers.ts` line 19, `.env.example` line 62 (`# INTERNAL_API_URL="http://backend:3011/api"`), `README.md` 에 기존 정의된 환경변수
- **상세**: 동일 이름·동일 의미(서버 내부 API URL)가 이미 존재한다. 중앙 모듈이 같은 이름을 재사용하는 것은 일관성 측면에서 정확히 올바르다. 충돌 없음.
- **제안**: 없음.

---

## 요약

M-2 리팩터가 도입하는 신규 식별자(`lib/api/constants.ts`, `API_BASE_URL` 중앙 상수, `getServerApiBaseUrl()` 함수)는 기존 코드베이스와 의미 충돌이 없다. `API_BASE_URL` 은 현재 4개 파일에 모듈-로컬로 분산 정의되어 있어 export 충돌이 발생하지 않으며, 리팩터는 이를 단일 모듈로 통합하는 것이다. 유일한 주의사항은 `client.ts` 의 기존 fallback 값 `3001` 이 다른 파일의 `3011` 과 불일치하므로 중앙 상수 정의 시 `3011` 을 canonical fallback 으로 명시적으로 채택해야 한다는 점이다. 파일 경로 측면에서 `lib/api/constants.ts` 는 기존 `lib/constants/` 와 다른 경로이므로 파일 충돌 없음.

## 위험도

LOW
