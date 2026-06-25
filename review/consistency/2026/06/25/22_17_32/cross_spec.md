# Cross-Spec 일관성 검토 결과

검토 대상: refactor 03 m-3 — `integrations/new/page.tsx` (1444줄, behavior-preserving 분할)
검토 모드: `--impl-prep`
검토 일시: 2026-06-25

---

## 발견사항

### 발견사항 없음 (CRITICAL/WARNING/INFO 해당 없음)

아래에 검토한 6개 관점별 결과를 기술한다.

---

### 1. 데이터 모델 충돌

해당 없음.

본 리팩터링은 `spec/2-navigation/4-integration.md` 의 spec 변경 없이 프런트엔드 컴포넌트를 파일 단위로 분할하는 작업이다. `Integration` / `Workspace` / `WorkspaceMember` 등 데이터 엔티티 정의(`spec/1-data-model.md`)는 수정하지 않으며, 추출되는 컴포넌트·훅·유틸은 모두 기존 데이터 타입을 그대로 참조한다.

---

### 2. API 계약 충돌

해당 없음.

추출되는 단위:
- `AuthStep`, `TestStep`, `Cafe24PrivatePendingStep`, `MakeshopPendingStep` 컴포넌트 — UI 레이어. `POST /api/integrations/oauth/begin`, `POST /api/integrations/preview-test`, `POST /api/integrations` 등의 endpoint 호출 코드를 그대로 유지하며 파일만 이동.
- `useOauthPopupReturn` 훅 — `window.addEventListener('message', ...)` + `popup.closed` 폴링 + refs. 스펙 §3.5 팝업 postMessage 동작 불변.
- `useUnsavedChangesWarning` 훅 — `window.addEventListener('beforeunload', ...)`. 스펙 §3.6 이탈 가드 동작 불변.
- `openOAuthPopup` util — 팝업 600×700 열기. 스펙 §3.2 팝업 사이즈 일치.

request/response shape 변경 없음. 백엔드 엔드포인트 인터페이스 변경 없음.

---

### 3. 요구사항 ID 충돌

해당 없음.

신규 요구사항 ID 를 부여하지 않는다. `spec/2-navigation/4-integration.md §3` 의 기존 요구사항 경계(§3.1~§3.6)를 그대로 보존하는 분할이며, `spec/2-navigation/_product-overview.md` 의 `NAV-IN-*` ID 에 변화가 없다.

---

### 4. 상태 전이 충돌

해당 없음.

`spec/2-navigation/4-integration.md §3.1` 의 step 상태 기계(`Step 2 auth → Step 3 test → Step 4 save`) 경계는 분할 후에도 `NewIntegrationPage` (page.tsx default export)가 단독 소유한다. 추출되는 컴포넌트들은 상태를 받는 피제어 컴포넌트(controlled)로 설계되며 상태 전이 로직을 직접 수행하지 않는다. `step` 쿼리 파라미터 기반 제어(§3.1)는 page 레이어에 잔류한다.

---

### 5. 권한·RBAC 모델 충돌

해당 없음.

`scope` 필드(Personal/Organization) 제어, Organization 비활성 조건(Admin 이 아니면 비활성), `@Roles('editor')` 백엔드 가드는 컴포넌트 분할과 무관하게 기존 spec(§3.2 공통 필드 · §8 권한 규칙)과 동일하게 유지된다.

---

### 6. 계층 책임 충돌

INFO 수준 동기화 권장 2건을 식별했으나 구현 차단 사안은 아니다.

**[INFO] `components/integrations/steps/` 경로가 spec frontmatter `code:` 목록에 미등록**
- target 위치: `plan/in-progress/refactor/03-maintainability.md §m-3` 에서 결정된 추출 경로
- 충돌 대상: `spec/2-navigation/4-integration.md` frontmatter `code:` (lines 4–12)
- 상세: spec frontmatter 는 `codebase/frontend/src/app/(main)/integrations/_shared/*.tsx` 와 `codebase/frontend/src/lib/integrations/*.ts` 를 나열하지만 `codebase/frontend/src/components/integrations/steps/*.tsx` 는 미포함이다. 참고로 `spec/4-nodes/4-integration/4-cafe24.md` 와 `5-makeshop.md` 의 frontmatter 는 `components/integrations/*.tsx` 를 이미 등재하고 있어 동일 경로 체계가 선례로 존재한다.
- 제안: 구현 완료 후 `spec/2-navigation/4-integration.md` frontmatter `code:` 목록에 `codebase/frontend/src/components/integrations/steps/*.tsx` 를 추가 동기화. spec 본문(§3 상태기계 경계·동작) 변경은 불필요.

**[INFO] `openOAuthPopup` 이 두 경로에 중복 구현된 상태**
- target 위치: `codebase/frontend/src/app/(main)/integrations/new/page.tsx` line 1331 (inline 함수, `Window | null` 반환형) + `lib/integrations/` 추출 예정
- 충돌 대상: `codebase/frontend/src/app/(main)/integrations/[id]/open-oauth-popup.ts` (반환형 없는 `void` 버전, spec `integrations/[id]/**` code 경로)
- 상세: `[id]/open-oauth-popup.ts` 와 `new/page.tsx` 의 inline `openOAuthPopup` 은 동일 spec(§3.2 팝업 600×700, §3.5 팝업 message 처리) 을 구현하지만 반환형이 다르다(`void` vs `Window | null`). `new/page.tsx` 는 `popupRef.current = openOAuthPopup(result.authUrl)` 로 반환값을 활용(팝업 closed 폴링용 ref)한다. `lib/integrations/` 로 이동 시 `[id]/open-oauth-popup.ts` 를 같은 모듈로 통합하거나 두 파일이 계속 공존하게 된다.
- 제안: `lib/integrations/open-oauth-popup.ts` 로 통합 추출하고 `[id]/` 에서는 이를 re-export 또는 직접 import 로 전환하면 중복이 해소된다. 단, 반환형(`Window | null`)은 `useOauthPopupReturn` 의 ref 저장 때문에 필수이므로 `[id]/` 쪽도 반환형을 맞춰야 한다. 이는 선택적 개선이며 구현 차단 조건이 아니다.

---

## 요약

본 리팩터링은 `spec/2-navigation/4-integration.md §3` 이 명시한 상태 기계 경계(§3.1 쿼리파라미터·§3.5 팝업 postMessage·§3.6 이탈 가드·§5/§9.2 Cafe24/MakeShop 분기)를 보존하는 파일 분할로, 데이터 모델·API 계약·상태 전이·RBAC 어느 관점에서도 기존 spec 과의 직접 충돌이 없다. spec 도 변경하지 않는다. 확인된 사안은 INFO 2건으로, 하나는 spec frontmatter `code:` 목록 동기화 권장(구현 완료 후), 다른 하나는 `openOAuthPopup` 이 두 경로에 중복 구현된 상태에서 단일화 기회가 있다는 관찰이다 — 둘 다 구현 진행을 차단하지 않는다.

---

## 위험도

NONE
