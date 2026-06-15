# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`
대상 구현 범위: `spec/2-navigation/6-config.md` (Auth God Component 분리 — God Component → `useAuthConfigForm` + `AuthConfigCreateForm` + `AuthConfigEditDialog` + `AuthConfigFormFields` + `auth-config-types.ts`)
diff-base: `1899c05e`

---

## 발견사항

### [INFO] `AuthConfig` 프론트엔드 인터페이스와 spec/1-data-model.md §2.17 의 필드 정합

- target 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-types.ts` — `AuthConfig` 인터페이스
- 충돌 대상: `spec/1-data-model.md §2.17 AuthConfig` 필드 목록
- 상세: 프론트엔드 `AuthConfig` 인터페이스는 `id / name / type / isActive / lastUsedAt? / config? / ipWhitelist?` 를 정의한다. spec §2.17 은 동일 엔티티에 `is_active` / `last_used_at` / `ip_whitelist` (snake_case) 를 정의하고 있으며 프론트엔드가 camelCase 로 매핑하는 것은 정상이다. spec §2.17 에는 `created_at` / `updated_at` 이 존재하나 프론트엔드 타입에는 없다 — 해당 필드가 목록 카드 UI 에 불필요해 생략된 것이며 실질적 모순은 아니다.
- 제안: 필요 시 생략 의도 주석 추가. spec 갱신 불필요.

---

### [INFO] `STATUS_BADGE_VARIANT` 상태값 열거 vs 실행 엔진 Execution status 전체

- target 위치: `auth-config-types.ts` — `STATUS_BADGE_VARIANT: { completed, running, failed, pending }`
- 충돌 대상: `spec/5-system/4-execution-engine.md` — Execution status enum (`waiting_for_input`, `cancelled` 등 포함 가능)
- 상세: 구현이 4종만 매핑한다. spec §A.3 은 `recentCalls.status` 가 워크플로 status enum 폴백을 포함함을 명시한다. `cancelled` / `waiting_for_input` 등 미등록 상태에 대해 `STATUS_BADGE_VARIANT[status]` 가 `undefined` 를 반환하면 Badge 렌더에서 잘못된 variant 가 전달될 수 있다.
- 제안: 사용 측에서 `STATUS_BADGE_VARIANT[status] ?? "outline"` fallback 이 이미 적용됐는지 확인하고, 미적용 시 추가 권고. spec 갱신 불필요.

---

### [INFO] `regenerateMutation.onSuccess` 의 `form.setGeneratedKey` 와 다이얼로그 렌더 경로 불일치

- target 위치: `page.tsx:151` — `if (secret) form.setGeneratedKey(secret)` (regenerateMutation 성공 시)
- 충돌 대상: `auth-config-create-form.tsx` — `form.generatedKey` 를 `form.mode === "create"` 조건 안에서만 렌더
- 상세: 재생성 플로우에서는 `form.mode` 가 `null` 이므로 `AuthConfigCreateForm` 이 마운트되지 않아 저장된 `generatedKey` 가 화면에 표시되지 않는다. 이는 리팩터링 이전 코드(`showDialog = false` 상태에서 `setGeneratedKey(secret)` 호출)와 동일한 동작이므로 새로 도입된 회귀가 아니라 기존 동작의 유지다. 재생성 키는 spec §A.4 의 `Reveal` 흐름으로 확인하는 것이 스펙 의도다. 다만 `form.generatedKey` 에 stale 값이 잔존할 수 있어 추후 `openCreate()` 시 예기치 않은 generatedKey 표시 가능성이 있다(`openCreate` 가 초기화를 수행하지 않으므로).
- 제안: `regenerateMutation.onSuccess` 에서 `form.setGeneratedKey` 를 호출하지 않거나, 재생성 키 표시를 별도 로컬 state 로 분리하는 것을 검토. spec 변경 불필요.

---

### [INFO] `useAuthConfigForm.openCreate` 필드 초기화 없이 모드만 전환

- target 위치: `use-auth-config-form.ts:openCreate()` — `setMode("create")` 만 호출, 필드 초기화 없음
- 충돌 대상: 없음
- 상세: 주석에 "close 가 초기화 담당" 으로 명시돼 있으며 spec 과 충돌하지 않는다. 기존 page.tsx 동작과 동일해 회귀 아님. 위 INFO(generatedKey stale)와 맞물려 사용자가 창을 닫지 않고 재생성 직후 `openCreate` 를 누르면 이전 generatedKey 가 노출될 수 있다.
- 제안: INFO 기록 only. spec 갱신 불필요.

---

### [INFO] `AuthConfig.type` TypeScript 유니온과 spec §2.17.3 "TypeScript 타입명 분리" 결정 일치

- target 위치: `auth-config-types.ts` / `auth-config-form.ts` — `AuthConfigType` (`api_key | bearer_token | basic_auth | hmac`)
- 충돌 대상: `spec/1-data-model.md §2.17.3` — "`AuthConfigType` 과 `IntegrationAuthType` 유니온 분리 정의"
- 상세: 구현이 spec 결정을 올바르게 이행. `basic_auth` 표기도 spec 의 의도적 구분(`Integration.auth_type=basic` vs `AuthConfig.type=basic_auth`)과 일치한다.
- 제안: 일치. 조치 불필요.

---

### [INFO] `pickPlaintextSecret` 우선순위 체인과 spec §2.17.2 마스킹 정책 일치

- target 위치: `auth-config-types.ts:pickPlaintextSecret` — `key ?? token ?? secret ?? password`
- 충돌 대상: `spec/1-data-model.md §2.17.2` — 마스킹 대상 `config.key / config.token / config.secret / config.password`
- 상세: 함수가 처리하는 필드 목록과 spec §2.17.2 의 마스킹 대상 목록이 정확히 일치하며, 우선순위 순서도 각 type 의 config 스키마(api_key→`key`, bearer→`token`, hmac→`secret`, basic_auth→`password`)에 부합한다.
- 제안: 일치. 조치 불필요.

---

## 요약

이번 변경은 `page.tsx` God Component 에서 `useAuthConfigForm` 훅·`AuthConfigCreateForm`·`AuthConfigEditDialog`·`AuthConfigFormFields`·`auth-config-types.ts` 로 UI 상태 로직을 추출하는 순수 리팩터링이다. `spec/2-navigation/6-config.md` 와 `spec/1-data-model.md §2.17` 에 정의된 AuthConfig 엔티티·타입·마스킹 정책·RBAC 규칙과의 직접 충돌은 발견되지 않았다. `regenerateMutation.onSuccess` 에서 `form.setGeneratedKey` 를 호출하나 렌더 경로가 없는 것은 리팩터링 이전부터 존재하던 동작 패턴이며 새로운 spec 위반이 아니다. `STATUS_BADGE_VARIANT` 의 미등록 상태 fallback 처리 여부만 구현 측 확인이 필요하다. 모든 발견사항이 INFO 수준이며 spec 수정이 필요한 충돌은 없다.

---

## 위험도

NONE
