# 유저 가이드 동반 갱신(User Guide Sync) 검토 결과

## 검토 개요

- PROJECT.md §변경 시 동반 갱신 표에서 매트릭스를 적재하였음 (11개 trigger 항목 확인).
- 변경 commit: `b3820314` — `feat(triggers): row ⋮ dropdown + type-specific delete confirmation (Plan A)`
- 변경 파일 18건 식별.

---

## 발견사항

발견된 CRITICAL / WARNING 이슈 없음.

### [INFO] 트리거 목록 Actions 컬럼 UX 변경 — 유저 가이드 반영 검토

- 변경 파일: `codebase/frontend/src/app/(main)/triggers/page.tsx`, `codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx`
- 매트릭스 항목: "신규 UI 문자열 (TSX)" — `codebase/frontend/src/lib/i18n/dict/{ko,en}/<section>.ts` **양쪽** 등록 필수
- 누락된 동반 갱신: 해당 없음 (아래 검증 내역 참고)
- 상세: 트리거 목록 페이지의 Actions 컬럼이 단일 토글 버튼에서 ⋮ DropdownMenu(4개 항목 + 삭제)로 재구성되었음. 사용자 가시 UX 변경이지만, 현재 `codebase/frontend/src/content/docs/` 에는 트리거 목록 관리 화면을 전용으로 설명하는 가이드 페이지가 존재하지 않음. `02-nodes/triggers.mdx` 는 Manual Trigger 노드 및 Webhook 기술 문서에 집중하고 있어 Actions 컬럼 UX 를 다루지 않음. 따라서 매트릭스의 docs MDX trigger 항목(노드 schema 변경 / 통합 변경 / 표현식 변경 / 실행·디버깅 흐름 변경) 중 어느 것에도 해당하지 않음. Navigation UI 변경에 대한 docs 동반 갱신 항목은 현재 매트릭스에 정의되어 있지 않아 형식 위반은 아님.
- 제안: 추후 트리거 목록 관리 화면(삭제 흐름, RBAC 메뉴 가시성 등)을 설명하는 유저 가이드 페이지 신설 여부를 spec 레벨에서 검토하는 것을 권장함.

---

## i18n parity 검증

| 키 경로 | KO | EN |
|---|---|---|
| `triggers.notFoundOnDelete` | "이미 삭제된 트리거예요" | "This trigger was already deleted" |
| `triggers.rowActions.viewDetails` | "상세 보기" | "View details" |
| `triggers.rowActions.viewHistory` | "호출 이력" | "Recent calls" |
| `triggers.rowActions.editInSchedule` | "스케줄 관리에서 편집" | "Edit in Schedules" |
| `triggers.rowActions.delete` | "삭제" | "Delete" |
| `triggers.rowActions.menuLabel` | "트리거 작업" | "Trigger actions" |
| `triggers.delete.title` | "트리거 삭제" | "Delete trigger" |
| `triggers.delete.button` | "삭제" | "Delete" |
| `triggers.delete.typeNameToConfirm` | "확인을 위해 트리거 이름 '{{name}}'을(를) 입력해 주세요" | "Type the trigger name '{{name}}' to confirm" |
| `triggers.delete.cascadeWarning` | "연결된 스케줄도 함께 삭제됩니다" | "The linked schedule will also be deleted" |
| `triggers.delete.confirm.webhook` | "이 트리거를 삭제하면 {{url}} 로 들어오는 모든 호출이 즉시 404 가 됩니다." | "Deleting this trigger will return 404 for all incoming calls to {{url}}." |
| `triggers.delete.confirm.schedule` | "이 트리거를 삭제하면 연결된 스케줄도 함께 삭제됩니다 (Cron: {{cron}}). 다음 실행 예정: {{nextRunAt}}." | "Deleting this trigger will also delete the linked schedule (cron {{cron}}). Next run was scheduled at {{nextRunAt}}." |
| `triggers.delete.confirm.manual` | "이 트리거에 연결된 워크플로 ({{workflowName}}) 는 보존되며, 트리거를 통한 외부 실행 진입점만 사라집니다." | "The connected workflow ({{workflowName}}) will be preserved — only the external execution entry point disappears." |

**결론: KO/EN 양쪽 parity 완전 충족. CRITICAL 없음.**

제거된 키 `triggers.deleteConfirm` 도 KO/EN 양쪽에서 동시 제거됨 — parity 유지.

---

## backend-labels.ts 검증

commit message 에 "Backend 변경 없음" 명시. `codebase/backend/` 의 소스 코드 변경이 없으므로 신규 warningCode / errorCode 발행 없음. `backend-labels.ts` 동반 갱신 trigger 에 해당하지 않음.

---

## 신규 섹션 디렉토리 검증

`codebase/frontend/src/content/docs/<NN>-<name>/` 형태의 신규 디렉토리 생성 없음. `locale.ts` 의 `SECTION_LABELS_BY_LOCALE` 갱신 trigger 에 해당하지 않음.

---

## 요약

PROJECT.md §변경 시 동반 갱신 매트릭스의 11개 trigger 항목과 변경 파일 18건을 대조하였음. 매칭된 trigger 1건(신규 UI 문자열), 누락 0건. dict/ko/triggers.ts 와 dict/en/triggers.ts 양쪽에 신규 키 13개가 동시 등록되어 i18n parity 완전 충족. backend 변경 없으므로 warningCode/errorCode 매핑 trigger 해당 없음. 신규 섹션 디렉토리 없음. docs MDX 갱신 관련 항목(노드 schema / 통합 / 표현식 / 실행·디버깅)에 해당하는 변경 없음. INFO 1건(Navigation UI 변경에 대한 유저 가이드 신설 미정의 — 매트릭스 외 영역으로 위반 아님).

---

## 위험도

NONE
