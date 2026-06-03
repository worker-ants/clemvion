# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] 변경 범위는 작업 목적과 전반적으로 일치함
- 위치: 파일 1~34 전체
- 상세: 이번 변경의 목적은 `interactionAllowedOrigins` 편집 표면(API + UI + 문서)을 추가하는 것이다. 파일 목록을 보면 backend DTO/controller/service/test(파일 1~5), frontend API client/UI/i18n(파일 6, 9~11), 문서(파일 7~8), plan/spec(파일 12, 29~34), consistency review 산출물(파일 13~28)로 구성된다. 각 파일의 변경이 해당 목적 내에 있다.

---

### [WARNING] plan 파일에 구현 체크박스가 완료 표시된 채 포함됨 — plan 파일이 코드와 함께 커밋됨
- 위치: `plan/in-progress/spec-draft-workspace-settings-api.md` (파일 12) — `## Phase: 구현` 섹션의 `[x]` 체크박스 다수
- 상세: `spec-draft-workspace-settings-api.md`는 spec draft plan 이라는 이름에도 불구하고 "## Phase: 구현" 섹션이 포함되어 구현 완료(`[x]`) 체크박스까지 모두 기록되어 있다. plan 파일이 spec draft + 구현 tracking을 모두 담고 있어, 단일 파일이 두 역할을 겸한다. 이는 경계 위반이라기보다 plan 문서 설계 문제이나, spec draft plan이 구현 완료 상태를 직접 포함하는 것은 plan-lifecycle 규약 상 spec draft phase와 impl phase의 분리 원칙과 어긋날 수 있다.
- 제안: 구현 완료 tracking은 별도 impl plan으로 분리하거나, 이 plan 파일이 통합 plan 역할을 한다는 것을 frontmatter에 명시한다.

---

### [INFO] consistency review 산출물 파일 2세트가 함께 커밋됨 — 정상적인 워크플로 산출물
- 위치: `review/consistency/2026/06/03/15_00_43/` (파일 13~20), `review/consistency/2026/06/03/15_11_15/` (파일 21~28)
- 상세: consistency check가 두 번 수행된 결과물(첫 번째는 BLOCK: YES, 두 번째는 BLOCK: NO)이 모두 커밋에 포함되어 있다. 이는 작업 프로세스의 기록으로 정상이다. `_retry_state.json`(파일 14, 22) 또한 오케스트레이터 상태 파일로 설계 의도에 맞는 포함이다.
- 제안: 없음. 워크플로 규약에 따른 정상 산출물이다.

---

### [INFO] `spec/1-data-model.md` 변경은 단순 cross-ref 추가 — 범위 내
- 위치: 파일 29, 라인 `| settings | JSONB | ...`
- 상세: 기존 `interactionAllowedOrigins` 설명 끝에 `**편집: PATCH /api/workspaces/:id/settings**` 참조 문구를 추가하는 것으로, 신규 기능에 대한 cross-ref 갱신이다. 데이터 모델 정의 자체를 변경하지 않는다.

---

### [INFO] spec 파일 4개(`spec/2-navigation/9-user-profile.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/14-external-interaction-api.md`, `spec/7-channel-web-chat/4-security.md`, `spec/data-flow/12-workspace.md`) 변경은 계획된 spec 갱신 범위 내
- 위치: 파일 30~34
- 상세: plan 파일 12의 "## Phase: Spec 갱신" 체크박스에 명시된 항목과 실제 spec 변경이 일치한다. 기존 문서 구조의 다른 섹션을 건드리지 않고 필요한 항목만 추가/수정한다. 포맷팅 또는 무관한 내용 수정은 발견되지 않았다.

---

### [INFO] frontend `workspace/settings/page.tsx` 변경에 `Loader2` 임포트가 이미 파일에 존재하는지 확인 불가 — 기존 임포트 사용으로 판단
- 위치: 파일 6, `/codebase/frontend/src/app/(main)/workspace/settings/page.tsx`
- 상세: diff에서 `Plus`, `Globe` 두 아이콘이 새로 임포트되었고, `Loader2`는 이미 파일에 존재했을 것으로 보인다(diff에 `Loader2` 임포트 추가가 없음). `EmbedOriginsCard`/`EmbedOriginsEditor` 컴포넌트 내에서 `useQuery`, `useMutation`, `useQueryClient`, `useState`, `toast`, `parseApiError`, `Label`, `Card`, `CardHeader`, `CardTitle`, `CardContent`가 사용되는데, 이들의 임포트가 diff에 나타나지 않는 것으로 보아 이미 파일에 존재하는 임포트를 재사용하는 것으로 판단된다. 임포트 범위 초과 없음.

---

### [INFO] 문서 파일(`web-chat.mdx`, `web-chat.en.mdx`) 변경은 UI 구현에 맞춰 기존 설명을 업데이트하는 것으로 범위 내
- 위치: 파일 7~8
- 상세: 기존 텍스트 설명을 삭제하고 GUI 설정 흐름으로 교체한 것이다. `ImplAnchor` 컴포넌트 추가, Callout 재배치, BYO-UI 링크 업데이트 모두 해당 섹션의 내용을 실제 구현된 UI 경로로 동기화하는 작업이다. 관련 없는 섹션은 수정되지 않았다.

---

## 요약

이번 변경은 `interactionAllowedOrigins` 편집 표면(backend API, frontend UI, i18n, 문서, spec)을 추가하는 단일 목적에 집중되어 있으며, 각 파일의 변경이 해당 목적 범위를 벗어나지 않는다. 불필요한 리팩토링, 무관한 파일 수정, 포맷팅 변경, 불필요한 임포트 정리 등의 범위 이탈 징후는 발견되지 않았다. consistency review 산출물 2세트(총 12개 파일)가 함께 커밋된 것은 워크플로 규약에 따른 정상 포함이다. plan 파일이 spec draft와 구현 tracking을 겸하는 설계는 범위 위반은 아니나 plan-lifecycle 분리 원칙과의 정합성 측면에서 INFO로 기록한다.

## 위험도

NONE
