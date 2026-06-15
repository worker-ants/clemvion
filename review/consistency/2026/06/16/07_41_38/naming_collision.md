# 신규 식별자 충돌 검토 결과

**검토 대상**: `spec/2-navigation/6-config.md` 구현 변경 사항 (diff-base: 86b50b29)
**검토 범위**: 신규 도입된 프론트엔드 파일·식별자의 충돌 분석

---

## 발견사항

### 발견사항 1
- **[WARNING]** `STATUS_BADGE_VARIANT` 동명 상수가 두 곳에 정의됨
  - target 신규 식별자: `const STATUS_BADGE_VARIANT` (module-local, non-exported) in `codebase/frontend/src/app/(main)/authentication/page.tsx` line 59
  - 기존 사용처: `export const STATUS_BADGE_VARIANT` in `codebase/frontend/src/lib/utils/execution-status.ts` line 23 — workflows 실행 이력 화면들(`workflows/[id]/executions/page.tsx`, `executions/[executionId]/page.tsx`)이 import 해 사용
  - 상세: 두 상수의 키 집합이 다르다. 기존 `execution-status.ts`는 `completed/failed/running/pending/cancelled/waiting_for_input` (6개 키), authentication page의 신규 정의는 `completed/running/failed/pending` (4개 키, `cancelled`·`waiting_for_input` 부재). 값 타입은 동일(`"success" | "warning" | "destructive" | "outline"`). page.tsx 내 코드 주석 `// (page 전용 — lib/utils/execution-status.ts 의 동명 상수와 값 집합이 달라 export 하지 않는다.)` 가 의도적 분리임을 명시한다. TypeScript 모듈 스코프로 분리돼 있어 런타임 충돌은 없지만, 동일 이름으로 다른 키 집합을 가진 두 상수가 같은 프로젝트에 존재해 혼동 가능성이 있다.
  - 제안: 현재 의도적 분리는 주석으로 문서화돼 있고 모듈 스코프로 격리돼 있어 기능 충돌은 없다. 명명 명확화를 원한다면 authentication page의 상수를 `AUTH_USAGE_STATUS_BADGE_VARIANT` 또는 `USAGE_CALL_STATUS_BADGE_VARIANT`로 rename하여 도메인을 명시하는 방안을 고려할 수 있다. 현재 상태는 경고 수준이며 차단 필요는 없다.

---

### 발견사항 2
- **[INFO]** 프론트엔드 `UsageRecentCall` / `UsagePeriodCounts` 명명과 백엔드 DTO 명명 불일치
  - target 신규 식별자: `interface UsageRecentCall`, `interface UsagePeriodCounts` in `codebase/frontend/src/app/(main)/authentication/auth-config-types.ts`
  - 기존 사용처: 백엔드 `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` — 동일 shape를 `AuthConfigUsageCallDto` / `AuthConfigUsagePeriodCountsDto`로 정의
  - 상세: 프론트엔드 인터페이스는 `Usage` prefix를 공유하지 않아(`UsageRecentCall` vs `AuthConfigUsageCallDto`) 백엔드 DTO 명명 규칙과 대칭되지 않는다. 동일 의미의 DTO쌍이 서로 다른 prefix 체계를 따라 추후 공유 타입 추출 시 혼선 가능성이 있다.
  - 제안: 프론트엔드 인터페이스를 `AuthConfigUsageCall` / `AuthConfigUsagePeriodCounts`로 rename하거나, 별도 공유 타입 패키지에 추출할 경우 단일 명명 체계를 정해 양측을 맞추는 것을 권장한다. 기능 충돌은 없으므로 INFO 수준.

---

### 충돌 없음 확인 항목

다음 항목은 검토 결과 충돌 없음 확인:

- **`AuthConfig` 인터페이스** (`auth-config-types.ts`): 이전에 `page.tsx` 내 module-local로 정의됐던 인터페이스를 단순히 모듈로 추출한 것. 백엔드 `AuthConfig` entity class (`entities/auth-config.entity.ts`) 및 `AuthConfigDto`는 별도 네임스페이스(backend). 프론트엔드 내 중복 정의 없음.
- **`AuthConfigUsage`**: 이전 `page.tsx` module-local에서 `auth-config-types.ts`로 이동. 백엔드의 `AuthConfigUsageDto`와 명칭이 거의 일치하며 동일 도메인을 표현 — 의도적 대칭.
- **`AUTH_TYPES`**: `auth-config-types.ts`에서 신규 export. 백엔드의 `SUPPORTED_AUTH_TYPES`(`mcp-tool-provider.ts`)는 완전히 다른 상수명이며 다른 목적(MCP auth 지원 여부 판별). 충돌 없음.
- **`pickPlaintextSecret`**: `page.tsx` module-local에서 `auth-config-types.ts`로 이동. 동일 기능의 단순 추출. 코드베이스 내 다른 동명 함수 없음.
- **`useAuthConfigForm` / `UseAuthConfigForm` / `AuthDialogMode`**: 신규 식별자. 전체 코드베이스에서 충돌 없음.
- **`AuthConfigCreateForm` / `AuthConfigEditDialog` / `AuthConfigFormFields`**: 신규 컴포넌트. 기존 `auth-config-select.tsx`의 `AuthConfigSelect` / `AuthConfigOption`과 prefix 일관성 유지. 충돌 없음.
- **`SECRET_AUTOCLEAR_MS`**: `page.tsx` 내 module-local 상수로 유지됨. 코드베이스 내 다른 동명 상수 없음.
- **파일 경로**: 신규 파일 5개(`auth-config-types.ts`, `auth-config-create-form.tsx`, `auth-config-edit-dialog.tsx`, `auth-config-form-fields.tsx`, `use-auth-config-form.ts`)가 모두 `app/(main)/authentication/` 디렉토리 내에 위치. 기존 파일명(`auth-config-form.ts`, `page.tsx`)과 충돌 없음. 명명 컨벤션(`auth-config-*` prefix) 일관성 유지.
- **API endpoint / 이벤트 / ENV var**: 이번 변경에서 신규 endpoint·이벤트·환경변수는 도입되지 않음.

---

## 요약

이번 변경은 `authentication/page.tsx`의 God Component를 단일 목적 컴포넌트·훅·타입 모듈로 분리하는 순수 리팩터링이다. 신규 도입된 식별자(`AuthConfig`, `AuthConfigUsage`, `AUTH_TYPES`, `pickPlaintextSecret`, `UseAuthConfigForm` 등)는 모두 기존 `page.tsx` 내 module-local 정의의 추출이거나 신규 훅/컴포넌트 분리이며, 타 도메인과의 의미 충돌은 발견되지 않았다. 주목할 사항은 `STATUS_BADGE_VARIANT` 상수가 `lib/utils/execution-status.ts`에 이미 export된 이름으로 존재하는데, `authentication/page.tsx`가 동일 이름의 module-local 상수를 정의한다는 점이다. 코드 주석으로 의도적 분리가 명시돼 있고 TypeScript 모듈 경계로 런타임 충돌은 없으나, 동일 이름·다른 키 집합 구조는 혼동 가능성이 있어 명명 구체화를 권장한다. 그 외 `UsageRecentCall` / `UsagePeriodCounts`가 백엔드 DTO와 prefix 체계가 다른 점은 일관성 보완 수준의 사항이다.

---

## 위험도

LOW
