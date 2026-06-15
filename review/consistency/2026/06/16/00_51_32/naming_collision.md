# 신규 식별자 충돌 검토 결과

검토 범위: `spec/2-navigation/6-config.md` (impl-done 모드, diff-base=1899c05e)
대상 diff: God Component 분리 — `auth-config-types.ts`, `auth-config-create-form.tsx`, `auth-config-edit-dialog.tsx`, `auth-config-form-fields.tsx`, `use-auth-config-form.ts` 신규 생성 + `page.tsx` 리팩토링

---

## 발견사항

### **[CRITICAL]** `STATUS_BADGE_VARIANT` 이름 충돌 — 두 파일에서 동일 상수명으로 다른 값 집합 정의

- **target 신규 식별자**: `export const STATUS_BADGE_VARIANT` — `auth-config-types.ts` line 60-69
- **기존 사용처**: `export const STATUS_BADGE_VARIANT` — `/codebase/frontend/src/lib/utils/execution-status.ts` line 23-33
- **상세**: 두 상수는 다른 값 집합을 가진다. `auth-config-types.ts` 버전은 `{ completed, running, failed, pending }` 4종(인증 사용 이력 status 표시용), `execution-status.ts` 버전은 `{ completed, failed, running, pending, cancelled, waiting_for_input }` 6종(워크플로 실행 status 표시용). 현재는 import path 가 달라 직접 컴파일 오류는 없다. 그러나 `page.tsx`(authentication)은 `auth-config-types` 의 것을, `workflows/[id]/executions/page.tsx` 와 `executions/[executionId]/page.tsx` 는 `execution-status` 의 것을 각각 import 한다. 향후 두 import 를 같은 모듈에서 사용하면 alias 없이 컴파일 오류가 발생하며, 이름이 같아 잘못된 쪽에서 import 하면 `cancelled`/`waiting_for_input` 상태의 badge 가 누락되거나 의도와 다른 variant 로 렌더링된다.
- **제안**: `auth-config-types.ts` 의 상수를 `USAGE_STATUS_BADGE_VARIANT` 또는 `AUTH_USAGE_BADGE_VARIANT` 로 rename 해 scope 를 명확히 한다. 또는 `execution-status.ts` 의 `STATUS_BADGE_VARIANT` 를 재사용하고(이미 해당 상수가 모든 status 를 포함하므로) `auth-config-types.ts` 에서 re-export 하거나 직접 import 하는 방식으로 통합한다. `page.tsx` line 674 는 이미 `?? "outline"` fallback 을 사용 중이라 6종 상수로 교체해도 안전하다.

---

### **[WARNING]** `TYPE_LABEL_KEYS` vs `AUTH_CONFIG_TYPE_LABEL_KEYS` — 동일 데이터의 두 이름 중복

- **target 신규 식별자**: `export const TYPE_LABEL_KEYS` — `/codebase/frontend/src/app/(main)/authentication/auth-config-types.ts` line 53-58
- **기존 사용처**: `export const AUTH_CONFIG_TYPE_LABEL_KEYS` — `/codebase/frontend/src/components/triggers/auth-config-select.tsx` line 13-18
- **상세**: 두 상수는 완전히 동일한 키-값 쌍(`api_key→typeApiKey`, `bearer_token→typeBearerToken`, `basic_auth→typeBasicAuth`, `hmac→typeHmac`)을 담고 있다. `AUTH_CONFIG_TYPE_LABEL_KEYS` 는 triggers 영역 3개 파일에서 이미 사용 중이고, `TYPE_LABEL_KEYS` 는 authentication 페이지에서 사용한다. 새 AuthConfigType 이 추가될 때 두 상수를 모두 수정해야 하는 drift 위험이 있다.
- **제안**: `TYPE_LABEL_KEYS` 를 제거하고 `auth-config-select.tsx` 의 `AUTH_CONFIG_TYPE_LABEL_KEYS` 를 단일 SoT 로 사용한다. `page.tsx` 는 `@/components/triggers/auth-config-select` 에서 import 하도록 변경한다. 또는 `auth-config-types.ts` 에서 `TYPE_LABEL_KEYS` 를 canonical 로 두고 `auth-config-select.tsx` 가 `as AUTH_CONFIG_TYPE_LABEL_KEYS` 로 re-export 하는 방향도 가능하다.

---

### **[WARNING]** `AUTH_TYPES` 신규 상수 — `AUTH_CONFIG_TYPE_LABEL_KEYS` 와 labelKey 데이터 중복

- **target 신규 식별자**: `export const AUTH_TYPES` — `/codebase/frontend/src/app/(main)/authentication/auth-config-types.ts` line 46-51
- **기존 사용처**: `AUTH_CONFIG_TYPE_LABEL_KEYS` — `/codebase/frontend/src/components/triggers/auth-config-select.tsx` line 13-18
- **상세**: `AUTH_TYPES` 는 `{ value, labelKey }[]` 배열이고 `AUTH_CONFIG_TYPE_LABEL_KEYS` 는 `Record<string, TranslationKey>` 이므로 이름 충돌은 없다. 그러나 두 자료 구조가 동일한 4종 type의 labelKey 값을 각각 소유해 새 type 추가 시 양쪽을 모두 수정해야 한다.
- **제안**: `AUTH_TYPES` 를 SoT 로 두고 `AUTH_CONFIG_TYPE_LABEL_KEYS`(및 `TYPE_LABEL_KEYS`)를 `Object.fromEntries(AUTH_TYPES.map(t => [t.value, t.labelKey]))` 로 파생시켜 단일 관리 지점을 확보한다.

---

### **[INFO]** `AuthConfig` 인터페이스 — `AuthConfigOption` 과 관계 명시 권장

- **target 신규 식별자**: `export interface AuthConfig` — `/codebase/frontend/src/app/(main)/authentication/auth-config-types.ts` line 9-18
- **기존 사용처**: `export interface AuthConfigOption` — `/codebase/frontend/src/components/triggers/auth-config-select.tsx` line 7-11
- **상세**: `AuthConfigOption` 은 `{ id, name, type }` 경량 projection, `AuthConfig` 는 `{ id, name, type, isActive, lastUsedAt?, config?, ipWhitelist? }` 전체 응답 타입으로 의미가 다르다. 직접 이름 충돌은 없다. 두 타입 모두 동일한 query key `["auth-configs"]` 의 응답을 표현하는 것처럼 보여 혼동 여지가 있다.
- **제안**: 두 타입의 파일 중 하나에 "full shape vs. slim projection" 관계를 단 한 줄 주석으로 cross-reference 하면 충분하다. 예: `AuthConfigOption` 에 `/** AuthConfig 의 slim projection — trigger 선택용. 전체 shape 는 auth-config-types.ts 의 AuthConfig. */`.

---

## 요약

이번 God Component 분리에서 도입된 신규 식별자 중 런타임 오동작으로 이어질 수 있는 CRITICAL 충돌이 1건 확인됐다. `STATUS_BADGE_VARIANT` 가 신규 `auth-config-types.ts`(인증 사용 이력용 4종 variant)와 기존 `lib/utils/execution-status.ts`(워크플로 실행용 6종 variant)에 동일 이름의 exported 상수로 동시에 존재한다. 현재는 import path 가 달라 컴파일 오류가 없으나, 향후 같은 파일에서 혼용될 경우 alias 없이 충돌하거나 잘못된 쪽에서 import 시 badge 렌더링이 의도와 달라지는 무음 버그가 생긴다. 추가로 `TYPE_LABEL_KEYS`/`AUTH_CONFIG_TYPE_LABEL_KEYS` 완전 중복(WARNING 1건), `AUTH_TYPES` labelKey 데이터 중복(WARNING 1건), `AuthConfig`/`AuthConfigOption` 관계 명시 권장(INFO 1건)이 있다. 나머지 신규 식별자(`AuthDialogMode`, `UseAuthConfigForm`, `useAuthConfigForm`, `AuthConfigCreateForm`, `AuthConfigEditDialog`, `AuthConfigFormFields`, `AuthConfigUsage`, `UsagePeriodCounts`, `UsageRecentCall`, `pickPlaintextSecret`)는 기존 사용처와 충돌하지 않는다.

## 위험도

MEDIUM
