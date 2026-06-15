# 신규 식별자 충돌 검토 결과

대상: `spec/2-navigation/6-config.md` (구현 완료 후 검토, diff-base=1899c05e)
검토 범위: 신규 파일 5개 (`auth-config-types.ts`, `use-auth-config-form.ts`, `auth-config-create-form.tsx`, `auth-config-edit-dialog.tsx`, `auth-config-form-fields.tsx`) + `page.tsx` 변경

---

## 발견사항

### 1. [INFO] `AuthConfig` 인터페이스 — 프론트엔드 내 두 곳 정의

- **target 신규 식별자**: `export interface AuthConfig` — `/codebase/frontend/src/app/(main)/authentication/auth-config-types.ts` (L9)
- **기존 사용처**: 동일 파일명의 삭제된 `page.tsx` 내 로컬 `interface AuthConfig` (diff 에서 제거됨). 아울러 백엔드에 `class AuthConfig` (TypeORM 엔티티) 가 `/codebase/backend/src/modules/auth-configs/entities/auth-config.entity.ts` (L14) 에 존재.
- **상세**: 프론트엔드 내에서는 기존의 `page.tsx` 로컬 정의가 `auth-config-types.ts` 내 `export interface` 로 이동·승격된 것이므로 중복 정의는 없다. 백엔드 `class AuthConfig` 는 TypeORM 엔티티로 서로 다른 레이어에 위치하며 실제 충돌(import 오염)은 없다. 단, 외부 컴포넌트(`auth-config-select.tsx`)에서 동일한 개념을 `AuthConfigOption` 으로 별도 정의하고 있어 (`/codebase/frontend/src/components/triggers/auth-config-select.tsx` L7) 두 타입이 사실상 같은 엔티티를 가리킨다. 향후 `AuthConfig`(auth-config-types)와 `AuthConfigOption`(auth-config-select) 사이의 중복을 단일화할 여지가 있으나, 현 변경은 기존 `page.tsx` 인라인 정의를 그대로 추출한 것이라 새로운 충돌을 도입하지 않는다.
- **제안**: 기존 충돌이 아니므로 즉시 조치 불필요. 후속 정리 작업에서 `AuthConfigOption` 과 `AuthConfig` 의 단일화를 검토한다.

---

### 2. [INFO] `AUTH_TYPES` 상수 — 백엔드 `SUPPORTED_AUTH_TYPES` 와 동형이나 다른 네임스페이스

- **target 신규 식별자**: `export const AUTH_TYPES` — `auth-config-types.ts` (L50), 4개 값(`api_key`, `bearer_token`, `basic_auth`, `hmac`)을 labelKey 와 묶은 배열
- **기존 사용처**: `/codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts` (L41) `const SUPPORTED_AUTH_TYPES = new Set(['bearer_token', 'api_key', 'none'])` — MCP Integration 전용, 다른 type 집합, 다른 목적
- **상세**: 이름이 달라(`AUTH_TYPES` vs `SUPPORTED_AUTH_TYPES`) 직접 충돌은 없다. 프론트엔드 모듈 내에서도 이전에는 `page.tsx` 로컬 `const AUTH_TYPES`로 존재했고 이제 `auth-config-types.ts` 로 이동했으므로 순정 extract-refactor다. 외부 노출 범위도 `authentication/` 모듈 안으로 제한된다.
- **제안**: 충돌 없음. INFO 기록 목적.

---

### 3. [INFO] `AUTH_CONFIG_TYPE_LABEL_KEYS` — 기존 `auth-config-select.tsx` 와 의미 중복

- **target 신규 식별자**: `page.tsx` 에서 `AUTH_TYPES` 를 SoT 로 동적으로 파생하는 지역 상수 `TYPE_LABEL_KEYS` (L51)
- **기존 사용처**: `/codebase/frontend/src/components/triggers/auth-config-select.tsx` (L13) `export const AUTH_CONFIG_TYPE_LABEL_KEYS` — 동일한 4개 type→labelKey 매핑을 하드코딩으로 정의하며 triggers 화면에서 사용
- **상세**: `page.tsx` 의 `TYPE_LABEL_KEYS` 는 이제 `AUTH_TYPES` 에서 동적 파생되어 중복 정의를 줄인 점이 개선이다. 그러나 `auth-config-select.tsx` 의 `AUTH_CONFIG_TYPE_LABEL_KEYS` 는 여전히 하드코딩 중복이다. 이 변경이 기존 충돌을 새로 도입하지는 않는다.
- **제안**: `auth-config-select.tsx` 의 `AUTH_CONFIG_TYPE_LABEL_KEYS` 를 `AUTH_TYPES` 에서 파생하도록 변경하면 type-labelKey 매핑의 단일 SoT 가 완성되나, 현 PR 범위 밖이다.

---

### 4. [INFO] `AuthDialogMode` — 새 type, 기존 충돌 없음

- **target 신규 식별자**: `export type AuthDialogMode = "create" | "edit"` — `use-auth-config-form.ts` (L22)
- **기존 사용처**: 없음. 이전 `page.tsx` 의 인라인 `useState<"create" | "edit">` 리터럴 타입을 명명된 타입으로 승격
- **상세**: 전체 코드베이스에서 동명 타입/인터페이스 없음. 충돌 없음.

---

### 5. [INFO] `UseAuthConfigForm` 인터페이스 / `useAuthConfigForm` 훅 — 충돌 없음

- **target 신규 식별자**: `export interface UseAuthConfigForm`, `export function useAuthConfigForm` — `use-auth-config-form.ts`
- **기존 사용처**: 없음 (전체 코드베이스 grep 결과 `authentication/` 밖 참조 없음)
- **상세**: 신규 도입. 충돌 없음.

---

### 6. [INFO] `AuthConfigCreateForm`, `AuthConfigEditDialog`, `AuthConfigFormFields` — 충돌 없음

- **target 신규 식별자**: 위 세 컴포넌트 이름 + 각 Props 인터페이스
- **기존 사용처**: 없음. `authentication/` 디렉터리 외부에서 동명 컴포넌트 없음
- **상세**: 신규 도입. 충돌 없음.

---

### 7. [INFO] `pickPlaintextSecret` — 충돌 없음

- **target 신규 식별자**: `export function pickPlaintextSecret` — `auth-config-types.ts` (L58)
- **기존 사용처**: 이전 `page.tsx` 로컬 함수에서 `export` 로 이동 (추출). 코드베이스 전체에서 단일 정의
- **상세**: 함수가 모듈 경계를 넘어 export 됨으로써 테스트 가능해진 긍정적 변화. 충돌 없음.

---

### 8. [INFO] `UsageRecentCall`, `UsagePeriodCounts`, `AuthConfigUsage` — 충돌 없음

- **target 신규 식별자**: 위 세 인터페이스 — `auth-config-types.ts` (L21, L32, L38)
- **기존 사용처**: 이전 `page.tsx` 로컬 인터페이스에서 추출. 전체 코드베이스에서 동명 정의 없음
- **상세**: 충돌 없음.

---

## 요약

이번 변경은 `page.tsx` God Component 분리 리팩터링으로, 기존 로컬 정의(인터페이스·상수·함수·훅 상태)를 전용 모듈(`auth-config-types.ts`, `use-auth-config-form.ts` 등)로 추출한 것이다. 새로 도입된 모든 식별자는 이전 `page.tsx` 인라인 정의의 명명된 승격이거나 완전 신규 이름으로, 기존 다른 의미로 사용 중인 충돌 식별자가 발견되지 않았다. 주목할 점은 프론트엔드 `AuthConfig` 인터페이스(authentication)와 `AuthConfigOption` 인터페이스(triggers)가 같은 백엔드 엔티티를 가리키는 의미적 중복이 존재하나, 이는 이번 변경 이전부터 존재하던 상황이며 새로운 충돌을 도입하지 않는다.

## 위험도

NONE

---

관련 파일:
- `/Volumes/project/private/clemvion/.claude/worktrees/config-c1-auth-god-split-2a7314/codebase/frontend/src/app/(main)/authentication/auth-config-types.ts`
- `/Volumes/project/private/clemvion/.claude/worktrees/config-c1-auth-god-split-2a7314/codebase/frontend/src/app/(main)/authentication/use-auth-config-form.ts`
- `/Volumes/project/private/clemvion/.claude/worktrees/config-c1-auth-god-split-2a7314/codebase/frontend/src/components/triggers/auth-config-select.tsx`
- `/Volumes/project/private/clemvion/.claude/worktrees/config-c1-auth-god-split-2a7314/codebase/backend/src/modules/auth-configs/entities/auth-config.entity.ts`
