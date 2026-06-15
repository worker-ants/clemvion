# 요구사항(Requirement) 리뷰

## 변경 개요

`authentication/page.tsx` God Component 를 분리하는 순수 구조 리팩토링:
- `use-auth-config-form.ts` — 폼 상태·검증·다이얼로그 제어 커스텀 훅 신규 추출
- `auth-config-create-form.tsx` — 생성 다이얼로그 컴포넌트
- `auth-config-edit-dialog.tsx` — 편집 다이얼로그 컴포넌트
- `auth-config-form-fields.tsx` — 공유 입력 필드 컴포넌트
- `auth-config-types.ts` — 공유 타입·상수·헬퍼 추출
- `page.tsx` — 위 분리 후 슬림화 (1066→621줄)

---

## 발견사항

### [INFO] `openCreate` 가 기존 상태를 초기화하지 않음
- 위치: `use-auth-config-form.ts` `openCreate()` 함수
- 상세: `close()` 는 모든 필드를 초기화한 뒤 `setMode(null)` 을 호출한다. 반면 `openCreate()` 는 `setMode("create")` 만 수행한다. 훅 주석에 "다이얼로그를 닫을 때마다 폼이 초기화되므로 `openCreate` 는 별도 초기화 없이 모드만 전환하면 된다" 고 명시되어 있으며, 정상 사용 시(`close()` -> `openCreate()`) 이 설명은 맞다. 그러나 사용자가 `close()` 없이 `openCreate()` 를 두 번 연속 호출하거나, `openEdit()` -> `close()` 없이 직접 `openCreate()` 를 호출하면 이전 편집 폼 값이 잔존할 수 있다.
- 제안: `openCreate()` 내에서 명시적으로 필드를 리셋하거나, 훅 주석에 "현재 page.tsx 오케스트레이터는 다이얼로그가 열린 상태에서 openCreate 를 재호출할 경로가 없다" 는 사실을 기록해 의도를 명확히 한다.

### [WARNING] 편집 다이얼로그 열린 상태에서 "Add" 버튼 클릭 시 편집 폼 값이 create 다이얼로그에 노출됨
- 위치: `use-auth-config-form.ts` `openCreate()` + `page.tsx` "Add" 버튼 onClick
- 상세: `page.tsx` 에서 `AuthConfigEditDialog` 와 `AuthConfigCreateForm` 은 `form.mode` 조건부로 상호 배타적으로 렌더된다. 그러나 편집 다이얼로그(`mode === "edit"`)가 열려있을 때 "Add" 버튼(`form.openCreate` 직결)을 누르면 mode 가 `"create"` 로 전환되며 편집 폼 필드값(name, type, apiKeyHeader 등)이 create 다이얼로그에 그대로 표시된다. "Add" 버튼은 고정 z-50 오버레이로 시각적으로 차단되지만, 키보드·스크린리더 접근은 가능하다. 결과적으로 편집→create 전환 시 이전 편집 대상의 name/type/config 가 노출된다.
- 제안: `openCreate()` 내에서 `close()` 의 초기화 로직을 먼저 수행한 뒤 `setMode("create")` 를 호출한다. 또는 `page.tsx` onClick 을 `() => { form.close(); form.openCreate(); }` 로 교체한다.

### [INFO] `regenerateMutation` 성공 시 `form.setGeneratedKey` 를 호출하지만 표시 UI 없음
- 위치: `page.tsx` `regenerateMutation.onSuccess`
- 상세: `if (secret) form.setGeneratedKey(secret)` 를 호출하지만 이때 `form.mode` 는 `null` (다이얼로그 닫힘)이다. `AuthConfigCreateForm` 은 `form.mode === "create"` 일 때만 렌더되므로 재생성 성공 후 평문 키가 UI 에 표시되지 않는다. 이 동작은 분리 전 page.tsx 와 동일(bit-identical)하며 의도된 동작이다. spec §A.4 재생성 흐름은 "기존 키 폐기 후 새 키 생성 (확인 필요)" 까지만 명시하며 재생성 직후 평문 표시 여부는 spec 이 침묵하는 영역이다.
- 제안: 별건 이슈 — 이 PR 스코프 밖. 재생성 후 평문 표시 기능이 필요한 경우 별도 plan 항목으로 처리.

### [INFO] Copy 버튼 `aria-label` 누락 (생성 완료 화면)
- 위치: `auth-config-create-form.tsx` generatedKey 표시 영역 Copy 버튼
- 상세: 닫기 버튼에는 `aria-label={t("common.close")}` 가 있으나, Copy 버튼에는 `aria-label` 이 없어 접근성 불완전.
- 제안: `aria-label={t("common.copy")}` 또는 관련 i18n 키 추가.

### [INFO] [SPEC-DRIFT] spec `6-config.md` frontmatter `code:` 목록 미갱신
- 위치: `spec/2-navigation/6-config.md` frontmatter `code:` 섹션 (라인 8)
- 상세: frontmatter `code:` 가 `codebase/frontend/src/app/(main)/authentication/page.tsx` 만 명시하며, 이번에 신설된 5개 파일(`use-auth-config-form.ts`, `auth-config-create-form.tsx`, `auth-config-edit-dialog.tsx`, `auth-config-form-fields.tsx`, `auth-config-types.ts`)이 누락되어 있다. 이는 코드 버그가 아니라 spec 메타데이터 갱신 누락이다.
- 제안: 코드 유지 + spec 반영. 대상: `spec/2-navigation/6-config.md` frontmatter `code:` 에 5개 파일 경로 추가.

### [INFO] 기능 완전성 — 순수 구조 리팩토링, 모든 기능 동작 분리 전과 동일
- 상세: 검증(validateAndProceed), 페이로드 조립(buildAuthConfigPayload / buildAuthConfigUpdatePayload), 에러 toast, RBAC (isAdmin 가드), reveal/regenerate/delete 흐름, usage drawer 모두 정상 이관. i18n 키 불변. 게이트(lint·tsc·unit 4419·build) PASS 확인(plan 기록).

---

## 요약

이 변경은 `authentication/page.tsx` 의 God Component 를 5개 단일-목적 컴포넌트·훅으로 분리하는 순수 구조 리팩토링이다. 기능·UI·API 호출·i18n 키는 모두 불변이며 분리 전후 bit-identical 동작이 보장된다. 주요 발견사항은 **[WARNING]: `openCreate()` 가 상태를 초기화하지 않아, 편집 다이얼로그가 열린 상태에서 "Add" 버튼을 누르면 편집 필드값이 create 폼에 노출**될 수 있는 점이다. 현재 고정 z-50 오버레이로 시각적으로는 차단되나 완전한 방어가 아니다. spec 정합 측면에서는 `6-config.md` frontmatter `code:` 목록에 신설 파일이 반영되지 않은 메타데이터 누락([SPEC-DRIFT]: spec 갱신 필요, 코드 fix 불필요)이 확인된다.

---

## 위험도

LOW
