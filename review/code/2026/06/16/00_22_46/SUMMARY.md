# Code Review 통합 보고서

> 대상: `authentication/page.tsx` God Component 분리 리팩토링 (config-c1-auth-god-split)
> 일시: 2026-06-16 00:22:46

## 전체 위험도

**MEDIUM** — 순수 구조 리팩토링으로 기능 회귀는 없으나, 핵심 훅(`useAuthConfigForm`)과 보안 관련 유틸(`pickPlaintextSecret`)에 대한 직접 단위 테스트가 부재하고, 편집→생성 폼 전환 시 상태 누출 가능성이 있다.

---

## Critical 발견사항

(없음)

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `useAuthConfigForm` 훅에 대한 직접 단위 테스트 없음 — `validateAndProceed`, `openCreate`, `openEdit`, `close`, `collectFormState` 등 핵심 상태 전환 로직이 훅에 집중되어 있으나 `renderHook` 기반 직접 테스트 파일이 없음 | `use-auth-config-form.ts` | `use-auth-config-form.test.ts` 신설. `openCreate→mode==="create"`, `openEdit(config)→mode==="edit"+필드초기화`, `close→mode===null+전체리셋`, `validateAndProceed` 각 분기 직접 검증 |
| 2 | Testing | `generatedKey` 1회 표시 흐름(create 성공 후 복사 UI)에 대한 통합 테스트 없음 — `postMock`이 `config: {}`를 반환해 `pickPlaintextSecret`이 null을 반환하는 경로만 검증, 평문 키 노출 + Copy 버튼 동작 경로가 완전히 미검증 | `auth-config-create-form.tsx` (generatedKey 분기) | `postMock`이 `{ data: { data: { id: "c1", type: "api_key", config: { key: "abc123" } } } }` 반환하는 시나리오 추가, `saveKeyNotice` 텍스트 노출·Copy 동작까지 검증 |
| 3 | Testing | `pickPlaintextSecret` 순수 함수에 대한 단위 테스트 없음 — `key ?? token ?? secret ?? password` 우선순위 체인으로 평문 비밀값을 추출하는 보안 관련 로직이 미검증 | `auth-config-types.ts` (`pickPlaintextSecret`) | `auth-config-types.test.ts` 신설 또는 기존 테스트에 `describe("pickPlaintextSecret")` 블록 추가. `key` 필드 우선, 각 폴백, null 반환, undefined config 처리 전 케이스 검증 |
| 4 | Requirement | 편집 다이얼로그 열린 상태에서 "Add" 버튼 클릭 시 편집 폼 값이 create 다이얼로그에 노출 — `openCreate()`가 상태를 초기화하지 않아 name/type/config가 create 폼에 잔류. z-50 오버레이로 시각적 차단이나 키보드·스크린리더 접근은 가능 | `use-auth-config-form.ts` `openCreate()` + `page.tsx` "Add" 버튼 onClick | `openCreate()` 내에서 `close()`의 초기화 로직을 먼저 수행한 뒤 `setMode("create")` 호출. 또는 `page.tsx` onClick을 `() => { form.close(); form.openCreate(); }`로 교체 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/2-navigation/6-config.md` frontmatter `code:` 목록에 신설 5개 파일 누락 — 코드 버그가 아닌 spec 메타데이터 갱신 누락 | `spec/2-navigation/6-config.md` frontmatter `code:` | 코드 유지 + spec 반영: `use-auth-config-form.ts`, `auth-config-create-form.tsx`, `auth-config-edit-dialog.tsx`, `auth-config-form-fields.tsx`, `auth-config-types.ts` 5개 경로 추가 |
| 2 | Maintainability | `AUTH_TYPES`와 `TYPE_LABEL_KEYS` 사이 type→labelKey 매핑 중복 — 향후 type 추가 시 두 곳을 동시에 수정 필요 | `auth-config-types.ts` | `TYPE_LABEL_KEYS`를 `Object.fromEntries(AUTH_TYPES.map(t => [t.value, t.labelKey]))`로 파생 |
| 3 | Maintainability | `close()` 내부 setState 11개 나열 — 새 필드 추가 시 `openEdit`·`close`·`collectFormState` 세 곳 동시 수정 필요 | `use-auth-config-form.ts` (`close()`) | `DEFAULT_FORM` 상수 + `useReducer` 또는 단일 `useState(DEFAULT_FORM)` 객체로 전환 |
| 4 | Maintainability | `AuthConfigCreateForm`과 `AuthConfigEditDialog`의 다이얼로그 껍데기 구조 및 헤더 패턴 중복. `page.tsx` 내부 확인 모달 4개 포함 총 6개 동일 패턴 존재 | `auth-config-create-form.tsx`, `auth-config-edit-dialog.tsx`, `page.tsx` | 공통 `ModalOverlay` / `ConfirmDialog` 컴포넌트 추출을 중기 과제로 기록 |
| 5 | Maintainability | `auth-config-form-fields.tsx` 내 네이티브 `<select>`와 Shadcn `<Input>` 혼용, 두 select가 동일 클래스 문자열 복사 | `auth-config-form-fields.tsx` | 네이티브 `<select>` className을 재사용 가능한 상수 또는 `SelectNative` 래퍼로 추출 |
| 6 | Maintainability | `validateAndProceed` 내 서로 다른 조건(빈 name, 빈 username, 빈 password)이 동일한 `"authentication.fillRequired"` 토스트 키 사용 | `use-auth-config-form.ts` (`validateAndProceed`) | 각 조건별 구체적 에러 키 또는 검증 결과를 구조체로 반환해 호출자가 처리 |
| 7 | Maintainability | `UseAuthConfigForm` 인터페이스의 setter 파라미터 명이 모두 `v`로 통일되어 IDE 힌트 의미 정보 감소 | `use-auth-config-form.ts` (인터페이스) | `value` 또는 각 필드에 맞는 구체적 이름으로 변경 |
| 8 | Testing | `AuthConfigFormFields`의 type별 조건부 렌더링 경로 부분 미검증 — `hmac`/`basic_auth`/`bearer_token` 타입 폼 필드 미검증 | `auth-config-form-fields.tsx` | `hmac` 타입 선택 시 `hmacHeader`/`hmacAlgorithm` 필드 노출 및 페이로드 매핑 케이스 1개 추가 |
| 9 | Testing | `validateAndProceed`의 `requirePassword` 분기 미검증 (`basic_auth` + password 미입력) | `use-auth-config-form.ts` | `basic_auth` 선택 + username 입력 + password 미입력 → 제출 → toastError 호출, `postMock` 미호출 검증 케이스 추가 |
| 10 | Testing | `close()` 호출 시 전체 필드 리셋 검증 없음 | `use-auth-config-form.ts` (`close()`) | `openEdit` → 필드 변경 → `close` → `openCreate` 후 필드가 기본값인지 확인하는 통합 테스트 추가 |
| 11 | Documentation | `UseAuthConfigForm` 인터페이스의 `ipWhitelist`(개행 구분 raw string 계약)와 `generatedKey`(1회 표시용 평문) 필드 JSDoc 부재 | `use-auth-config-form.ts` (인터페이스) | 두 필드에 인라인 `/** */` 주석 추가 |
| 12 | Documentation | `openCreate` JSDoc에 초기화 생략 의도 미기재 — 인터페이스만 보고 의도적 생략인지 버그인지 불분명 | `use-auth-config-form.ts` (`UseAuthConfigForm.openCreate`) | `/** 생성 모드로 전환. 폼 초기화는 close()가 담당하므로 별도 reset 없음. */` 추가 |
| 13 | Documentation | `STATUS_BADGE_VARIANT` 대응 타입(`UsageRecentCall.status`) 설명 부재 | `auth-config-types.ts` | `/** UsageRecentCall.status(Execution 실행 상태) → Badge variant 매핑. */` 한 줄 추가 |
| 14 | Documentation | `AuthenticationPage` 컴포넌트 JSDoc 없음 — 오케스트레이터 책임 범위 불명 | `page.tsx` (`export default function AuthenticationPage()`) | 함수 직전에 역할 설명 JSDoc 추가 |
| 15 | Documentation | `plan/in-progress/spec-sync-config-gaps.md` frontmatter `worktree: spec-sync-audit`와 실제 작업 worktree `config-c1-auth-god-split` 불일치 | `plan/in-progress/spec-sync-config-gaps.md` | 여러 worktree 공유 패턴임을 frontmatter 주석 또는 본문에 명시 |
| 16 | Side Effect | `regenerateMutation.onSuccess`에서 `form.setGeneratedKey`가 `mode=null` 상태에서도 호출되어 비일관 상태 가능 — 현재 렌더링 경로에서 오작동 없으나 이전 god-component와 동일 패턴 | `page.tsx` (`regenerateMutation.onSuccess`) | regenerate 성공 시 독립 상태로 분리 또는 `setGeneratedKey`에 `mode==="create"` guard 추가 |
| 17 | Requirement | `regenerateMutation` 성공 시 `form.setGeneratedKey` 호출하나 `mode=null`로 표시 UI 없음 — spec §A.4 재생성 흐름이 평문 표시 여부 침묵하는 영역, 분리 전과 동일 동작 | `page.tsx` `regenerateMutation.onSuccess` | 별건 이슈 — 이 PR 스코프 밖. 재생성 후 평문 표시 기능 필요 시 별도 plan 항목으로 처리 |
| 18 | Requirement | Copy 버튼 `aria-label` 누락 (생성 완료 화면) | `auth-config-create-form.tsx` (generatedKey 표시 영역 Copy 버튼) | `aria-label={t("common.copy")}` 또는 관련 i18n 키 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | 재시도 후 NONE | 비밀값 표시·검증·전송 경로 변경 없음, 평문 노출 신규 경로 없음 (재실행 결과) |
| architecture | 재시도 후 LOW | 계층화 적절(page=오케스트레이터, 훅=상태, 컴포넌트=프레젠테이션). 순환 의존성 없음 (재실행 결과) |
| requirement | LOW | `openCreate()` 상태 초기화 미실행으로 편집→생성 폼 전환 시 값 잔류 가능 (WARNING); SPEC-DRIFT: spec frontmatter 미갱신 |
| scope | NONE | 순수 구조 리팩토링, 플랜 산출물과 정확히 일치, 범위 위반 없음 |
| side_effect | LOW | `openCreate()` 불변식 미보장, `regenerateMutation.onSuccess` 비일관 상태 가능성 — 모두 이전 god-component와 동작 등가 |
| maintainability | LOW | 레이블 매핑 중복, 인라인 모달 패턴 6회 반복, select 혼용 등 INFO 수준 개선 여지 |
| testing | MEDIUM | 핵심 훅·보안 유틸·평문 키 표시 흐름 직접 테스트 부재 (WARNING 3건) |
| documentation | NONE | 전반적 양호, 일부 인터페이스 필드 JSDoc 보강 권고 (INFO 수준) |

> 비고: 최초 workflow 실행에서 security·architecture reviewer 가 status=success 로 보고됐으나 출력 파일을 생성하지 못해, main 이 동일 prompt 로 재실행한 결과를 위 표에 반영했다 (security.md / architecture.md 디스크 기록).

---

## 권장 조치사항

1. **[WARNING-4]** `openCreate()` 편집→생성 전환 시 이전 필드 노출 가능 — **분리 전 god-component 와 동작 등가(기존 동작 보존)**. 본 PR 의 목표는 동작 불변이므로 행동 변경은 하지 않고 별도 disposition. (현재 z-50 오버레이로 시각 차단, 실사용 경로 없음.)
2. **[WARNING-1·3 테스트 신설]** `use-auth-config-form.test.ts`(renderHook 직접 검증) + `auth-config-types.test.ts`(`pickPlaintextSecret` 우선순위 체인) — 리팩토링으로 로직이 훅/유틸에 집중된 만큼 회귀 가드 보강.
3. **[WARNING-2 테스트 추가]** `authentication-form.test.tsx`에 `generatedKey` 평문 표시 경로 시나리오 추가.
4. **[SPEC-DRIFT]** `spec/2-navigation/6-config.md` frontmatter `code:` 5개 파일 경로 추가 — planner 위임 (코드 revert 불필요).
5. **[INFO 중기]** `AUTH_TYPES`→`TYPE_LABEL_KEYS` 파생, `DEFAULT_FORM` 상수, 공통 `ModalOverlay`/`ConfirmDialog` 추출 등 유지보수성 후속 plan 등록.

---

## 라우터 결정

라우터가 선별(`routing_status=done`): 실행 8명 / 제외 6명.

- **실행** (8명): `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`
- **제외** (6명): `performance`(런타임 성능 변경 없음), `dependency`(의존성 변경 없음), `database`(스키마 변경 없음), `concurrency`(동시성 변경 없음), `api_contract`(API 변경 없음), `user_guide_sync`(가이드 영향 없음)
