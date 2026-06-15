# Code Review 통합 보고서

> 대상: `config-c1-auth-god-split` 브랜치 — `authentication/page.tsx` God Component 분리 (순수 구조 리팩토링)
> 생성: 2026-06-16 00:39:27

---

## 전체 위험도

**MEDIUM** — RBAC 불일치(Regenerate·Delete 버튼 Admin 가드 누락)와 regenerate 후 평문 키 미표시 회귀 가능성이 수정 필요 수준이며, 나머지 발견사항은 대부분 유지보수 개선 권고이다.

---

## Critical 발견사항

_없음_

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / RBAC | Regenerate 버튼에 `isAdmin` 가드 없음. Edit·Reveal 은 `{isAdmin && ...}` 보호되어 있으나 Regenerate 버튼은 모든 인증 사용자에게 표시되어 클릭 시 `POST /auth-configs/:id/regenerate` 호출로 기존 키 즉시 무효화 가능. spec §3.2 RBAC(Editor/Viewer = R) 위반이며 백엔드 가드 약화 시 보안 위험 | `page.tsx` Regenerate 버튼 렌더링 영역 | `{isAdmin && <Button onClick={...}>Regenerate</Button>}` 래핑 적용. 백엔드 `POST /auth-configs/:id/regenerate` `@Roles('admin')` 가드 확인 |
| 2 | Security / RBAC | Delete 버튼에 `isAdmin` 가드 없음. 비-admin 사용자가 확인 모달을 열고 `DELETE /auth-configs/:id` 호출 가능. DoS 성격의 설정 삭제 공격 경로 | `page.tsx` Delete(Trash2 아이콘) 버튼 렌더링 영역 | `{isAdmin && <Button onClick={...}>Delete</Button>}` 래핑 적용. 백엔드 `DELETE /auth-configs/:id` `@Roles('admin')` 가드 확인 |
| 3 | Testing | regenerate 성공 후 `form.setGeneratedKey(secret)` 호출 시 `form.mode === null` 이므로 `AuthConfigCreateForm`(mode==="create" 조건)이 렌더되지 않아 평문 키가 UI에 표시되지 않을 수 있음. 분리 전 `showDialog=true` + `setGeneratedKey` 동시 설정 패턴과 달라 동작 회귀 가능성. 이 경로의 통합 테스트 없음 | `page.tsx` `regenerateMutation.onSuccess` | regenerate 성공 시 평문 키 표시 동작을 통합 테스트로 검증. 표시가 의도적으로 제거됐다면 `setGeneratedKey` 호출 제거 또는 별도 표시 경로 마련 |
| 4 | Testing | 분리된 UI 컴포넌트 3개(`AuthConfigFormFields`, `AuthConfigCreateForm`, `AuthConfigEditDialog`)에 직접 단위 테스트 없음. `typeDisabled`/`showPassword`/`showTypeLockedHint` prop 조합 분기가 통합 테스트로만 간접 커버됨 | `auth-config-form-fields.tsx`, `auth-config-create-form.tsx`, `auth-config-edit-dialog.tsx` | `AuthConfigFormFields` 단위 테스트 추가. 최소한 edit 다이얼로그 X 버튼 닫기 assertion을 `authentication-form.test.tsx`에 추가 |
| 5 | Testing | `useAuthConfigForm` 훅 테스트에서 `hmac` 타입 `collectFormState` 경로 및 `hmacHeader`·`hmacAlgorithm` 초기값 미검증 | `use-auth-config-form.test.tsx` | `type: "hmac"` + `hmacHeader`·`hmacAlgorithm` 케이스를 `collectFormState` 테스트에 추가. 초기값 테스트에 기본값 assertion 추가 |
| 6 | Architecture | `validateAndProceed`가 `toast.error`를 직접 호출하여 검증 로직과 UI 사이드이펙트 경계 혼재. 훅이 `sonner` 라이브러리에 직접 의존하고 오류 처리 전략 확장이 어려움 | `use-auth-config-form.ts` `validateAndProceed` 함수 내 `toast.error(...)` | 검증 오류를 `{ key, invalid? } \| null` 형태로 반환하고 호출자(`page.tsx`)에서 toast 표시. 또는 `onError?: (msg: string) => void` 콜백 DI |
| 7 | Maintainability | `AUTH_TYPES` 배열과 `TYPE_LABEL_KEYS` Record가 동일한 4개 type-to-labelKey 매핑을 중복 정의. 신규 인증 타입 추가 시 두 곳 모두 수정 필요 | `auth-config-types.ts` L1525–1537 | `export const TYPE_LABEL_KEYS = Object.fromEntries(AUTH_TYPES.map(t => [t.value, t.labelKey])) as Record<string, TranslationKey>;` 로 파생 |
| 8 | Maintainability | `fixed inset-0 z-50 ... bg-black/50` 오버레이와 `max-w-md rounded-lg border ... p-6 shadow-lg` 카드 구조가 Create/Edit 다이얼로그 2개 + page.tsx 내 Regenerate/Reveal/Delete 확인 모달 3개, 총 5회 중복 | `auth-config-create-form.tsx` L813–826, `auth-config-edit-dialog.tsx` L1009–1022, `page.tsx` 확인 모달 | `DialogShell` 공통 컴포넌트(`title`, `onClose`, `children`) 추출 |
| 9 | Maintainability | `close()` 함수가 10개 상태를 개별 setter로 초기화. 신규 필드 추가 시 `useState` 초기화와 `close()` 두 곳 모두 수정 필요 | `use-auth-config-form.ts` `close()` 함수 (L2991–3003) | 초기값을 상수 객체로 추출하고 `useState` 와 `close()` 양쪽에서 동일 상수 참조. 또는 `useReducer` 전환 |
| 10 | Architecture | `UseAuthConfigForm` 인터페이스 16개 멤버. `AuthConfigEditDialog`는 `generatedKey`/`setGeneratedKey` 불필요, `AuthConfigCreateForm`은 `editTargetId` 불필요 — ISP 위반 가능성 | `use-auth-config-form.ts` `UseAuthConfigForm` 인터페이스 (L32–65) | 단기 현상 유지 가능. 장기적으로 `Pick<UseAuthConfigForm, ...>` 소비자별 서브타입 뷰 도입 검토 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect | `openCreate()`가 필드를 초기화하지 않음. 현재 호출 경로에서는 항상 `mode === null` 상태에서 호출되어 실제 문제없음. 암묵적 계약이라 신규 호출자에게 함정 가능 | `use-auth-config-form.ts` `openCreate()` | JSDoc에 "mode가 null인 상태에서만 안전" 명시 또는 `close()` 호출 후 mode set으로 변경 |
| 2 | Security | generatedKey가 React state에 평문 보관. 설계 의도(1회 표시)이며 `close()` 시 즉시 `setGeneratedKey(null)` 처리됨. DevTools 개발 빌드 노출은 Next.js 기본 동작으로 완화 | `use-auth-config-form.ts` (`useState<string \| null>(null)`) | 현 구현 허용 수준. 강화 필요 시 `useRef` 활용 검토 |
| 3 | Security | Reveal 30초 타이머. 탭 백그라운드 시 브라우저 스로틀링으로 실제 노출 창이 30초 초과 가능 | `page.tsx` `window.setTimeout(..., 30_000)` | `visibilitychange` 구독으로 탭 숨김 즉시 hide 가능. 현 UX 보조 수준 |
| 4 | Security | IP Whitelist 클라이언트 검증 올바름. 백엔드 DTO의 각 배열 원소 독립 검증 여부는 이번 리뷰 범위 밖 | `use-auth-config-form.ts` `validateAuthConfigForm` | 백엔드 DTO에서 `@IsIP()` 또는 `@Matches(CIDR_REGEX)` 각 원소 적용 확인 권장 |
| 5 | Requirement | spec frontmatter `code:` 목록에 신규 5개 파일 미등록 | `spec/2-navigation/6-config.md` frontmatter | `project-planner`가 frontmatter `code:` 갱신 여부 판단 |
| 6 | Requirement | regenerate 후 `form.setGeneratedKey(secret)` 호출 시 `form.mode === null` → `AuthConfigCreateForm` 미렌더로 평문 미표시. 기존 버그 이전(기존 `showDialog=false` 상태와 동일). 별도 이슈 추적 권장 | `page.tsx` `regenerateMutation.onSuccess` | 별도 이슈 추적 |
| 7 | Maintainability | `select` 엘리먼트에 Tailwind 클래스 문자열 중복 하드코딩. `Input` 컴포넌트 추상화 패턴과 불일치 | `auth-config-form-fields.tsx` type select, hmac-algorithm select | `Select` UI 컴포넌트 추출 또는 공통 클래스 상수화 |
| 8 | Maintainability | `UseAuthConfigForm` 인터페이스가 setter를 14개 직접 노출. 소비자가 훅 내부 상태 구조에 직접 의존 | `use-auth-config-form.ts` `UseAuthConfigForm` 인터페이스 | 향후 `updateField(key, value)` 번들 추상화 검토 |
| 9 | Maintainability | page.tsx 내 Regenerate/Reveal/Delete 확인 모달 4개가 여전히 인라인. Create/Edit는 추출했으나 나머지는 미추출로 혼재 패턴 | `page.tsx` L2434–2569 | 후속 PR에서 나머지 4개 모달도 동일 패턴으로 추출 권장 |
| 10 | Testing | `authentication-form.test.tsx`의 `afterEach`에 `cleanup()` 중복 호출 (Vitest + RTL 자동 cleanup과 이중) | `authentication-form.test.tsx` | `afterEach`의 명시적 `cleanup()` 제거 |
| 11 | Testing | `use-auth-config-form.test.tsx`에서 `beforeEach`로 locale store 설정하나 `afterEach` 복원 없음. 다른 테스트 파일과 패턴 불일치 | `use-auth-config-form.test.tsx` | `afterEach(() => useLocaleStore.setState({ locale: "en" }))` 추가 |
| 12 | Testing | Copy 버튼 클릭 시 `onCopy(generatedKey)` 올바른 값 호출 여부 미검증 | `auth-config-create-form.tsx` generatedKey Copy 버튼 | 기존 plaintext-secret 테스트에 Copy 버튼 assertion 추가 |
| 13 | Documentation | `UseAuthConfigForm` 인터페이스 setter 군 그룹 주석 없음 | `use-auth-config-form.ts` | setter 그룹 위 `/** 개별 필드 setter — 대응 필드와 동일 이름의 set 접두사 변형 */` 한 줄 추가 |
| 14 | Documentation | `AuthConfigCreateFormProps`, `AuthConfigEditDialogProps` 개별 필드 JSDoc 없음. `auth-config-form-fields.tsx`는 있어 일관성 깨짐 | `auth-config-create-form.tsx`, `auth-config-edit-dialog.tsx` Props 인터페이스 | 콜백 계약 필드에 간단한 JSDoc 추가 (선택적) |
| 15 | Documentation | plan 파일 모든 항목 완료 상태. `plan/complete/` 이동 시점 검토 필요 | `plan/in-progress/spec-sync-config-gaps.md` | PR 완료 후 remaining open items 확인 및 이동 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | Regenerate·Delete 버튼 Admin 가드 누락 (WARNING 2건), 나머지 보안 구현 양호 |
| architecture | LOW | `validateAndProceed` 내 toast 직접 호출(레이어 혼재), `UseAuthConfigForm` ISP 위반 가능성 |
| requirement | LOW | spec §A.2–A.4 모든 비즈니스 규칙 이전 확인. spec frontmatter 미갱신·regenerate 평문 표시 버그 이전 (INFO) |
| scope | NONE | 플랜 산출물 5개와 1:1 일치. 의도 외 기능 추가 없음. 동작 불변 확인 |
| side_effect | LOW | `openCreate()` 미초기화 암묵적 계약. 현재 사용처에서 실제 문제 없음 |
| maintainability | LOW | AUTH_TYPES/TYPE_LABEL_KEYS 중복, 다이얼로그 셸 5중 복붙, close() 다중 setter 패턴 |
| testing | MEDIUM | regenerate 평문 표시 경로 미검증(회귀 가능), 분리된 3 컴포넌트 직접 단위 테스트 없음, hmac 타입 누락 |
| documentation | NONE | 전반 양호. setter 그룹 주석·Props JSDoc 일관성 소폭 개선 여지 |

---

## 발견 없는 에이전트

없음 — 모든 에이전트에서 발견사항 존재 (scope·documentation은 NONE 위험도이나 INFO 발견사항 보고).

---

## 권장 조치사항

1. **[즉시 필수] Regenerate 버튼에 `{isAdmin && ...}` 가드 추가** (WARNING #1) — 비-admin RBAC 위반 및 잠재적 키 무효화 공격 경로 차단. 백엔드 `@Roles('admin')` 가드 확인 병행.
2. **[즉시 필수] Delete 버튼에 `{isAdmin && ...}` 가드 추가** (WARNING #2) — 동일 이유. 백엔드 `@Roles('admin')` 가드 확인 병행.
3. **[즉시 필수] regenerate 후 평문 키 표시 경로 확인 및 통합 테스트 추가** (WARNING #3) — `regenerateMutation.onSuccess`에서 `openCreate()` 미호출로 `AuthConfigCreateForm` 미렌더되어 평문 키가 표시되지 않는 회귀 가능성. 의도적 제거라면 `setGeneratedKey` 호출 제거 또는 별도 표시 경로 마련.
4. **[권고] 분리된 UI 컴포넌트 3개 직접 단위 테스트 추가** (WARNING #4) — `typeDisabled`/`showPassword`/`showTypeLockedHint` prop 분기 직접 검증.
5. **[권고] `useAuthConfigForm` 테스트에 `hmac` 타입 케이스 추가** (WARNING #5) — `hmacHeader`·`hmacAlgorithm` 초기값 및 `collectFormState` 경로 커버.
6. **[권고] `AUTH_TYPES`에서 `TYPE_LABEL_KEYS` 파생** (WARNING #7) — 신규 인증 타입 추가 시 누락 오류 예방.
7. **[후속 PR 권고] `DialogShell` 공통 컴포넌트 추출** (WARNING #8) — 5중 다이얼로그 셸 중복 해소.
8. **[후속 PR 권고] `close()` 초기값 상수화** (WARNING #9) — 필드 추가 시 단일 수정 지점 확보.
9. **[선택적] `validateAndProceed` 레이어 책임 분리** (WARNING #6) — 검증 오류 반환 + 호출자 toast 표시.
10. **[선택적] plan 파일 `plan/complete/` 이동** (INFO #15) — 모든 항목 완료 상태 확인 후 라이프사이클 이동.

---

## 라우터 결정

라우터가 reviewer를 선별 실행함 (`routing=done`).

- **실행** (강제 포함): `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (8명 — 모두 router_safety 강제 포함)
- **제외** (6명):

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 순수 구조 리팩토링, 성능 임계 변경 없음 |
  | dependency | 외부 의존성 추가/변경 없음 |
  | database | 백엔드 DB 스키마·마이그레이션 변경 없음 |
  | concurrency | 동시성 관련 변경 없음 |
  | api_contract | API 엔드포인트·페이로드 구조 변경 없음 |
  | user_guide_sync | 사용자 대면 기능·동작 불변 |

- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (실행된 8명 중 7명 강제 포함)