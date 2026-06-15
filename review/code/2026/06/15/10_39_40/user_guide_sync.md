# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

### [WARNING] Run with Input 데이터셋 기능 — `05-run-and-debug/running-a-workflow.{mdx,en.mdx}` 갱신 누락

- 변경 파일:
  - `codebase/backend/src/modules/workflow-test-datasets/` (신규 모듈 전체)
  - `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` (신규 Datasets UI 패널)
  - `codebase/frontend/src/lib/api/workflow-test-datasets.ts` (신규 API 클라이언트)
  - `codebase/frontend/src/lib/i18n/dict/{ko,en}/editor.ts` (15개 데이터셋 관련 키)
- 매트릭스 항목: `run-debug-flow-change` (semantic) — "실행·디버깅 흐름 변경이 `codebase/frontend/src/content/docs/05-run-and-debug/` 갱신 누락"
- 누락된 동반 갱신:
  - `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/codebase/frontend/src/content/docs/05-run-and-debug/running-a-workflow.mdx`
  - `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/codebase/frontend/src/content/docs/05-run-and-debug/running-a-workflow.en.mdx`
- 상세:
  이번 PR 은 "Run with Input" 다이얼로그에 **Datasets** 패널을 신설했다. 사용자는 이제 테스트 입력을 이름을 붙여 저장하고(`Save as Dataset`), 목록에서 불러오거나, workspace 공개(read-only) 또는 private 로 공유 범위를 설정하며, 타 유저의 공유본을 clone 하고, 자기 소유 항목을 삭제할 수 있다. 이는 이전과 질적으로 다른 사용자 경험이다.

  현재 `running-a-workflow.mdx` Step 3 은 "자주 쓰는 입력은 이름을 붙여 저장해두면 다음부터 원클릭으로 재사용할 수 있어요." 라고만 기술하며, `running-a-workflow.en.mdx` Step 3 은 "Save frequently used inputs with a name to reuse them with one click." 에 그친다. 아래 개념들이 전혀 안내되지 않는다:
  - `Datasets` 드롭다운 섹션의 존재 및 사용 방법
  - `Save as Dataset` 버튼 — 이름 입력 + workspace 공유 토글 흐름
  - visibility 개념(`private` / workspace 공유, read-only 공유)
  - 공유 데이터셋의 `Clone` 동작 (타 유저 수정 불가 → 복제 후 자기 소유로 편집)
  - `Delete` 동작 (소유자만 가능)

  사용자가 이 기능을 발견하더라도 공유·clone 개념을 이해하지 못하면 혼란이 발생한다. 특히 `isOwner: false` 인 공유 데이터셋에서 수정이 아닌 clone 만 제공된다는 점은 가이드 없이는 직관적이지 않다.

- 제안:
  `running-a-workflow.mdx` 와 `running-a-workflow.en.mdx` 에 "Run with Input — 데이터셋 저장·재사용" 절을 추가한다. 최소 포함 내용:
  1. `Save as Dataset` 흐름 (이름 입력 → visibility 선택 → 저장)
  2. `Datasets` 드롭다운 — 내 데이터셋 + workspace 공유본 목록, 클릭 시 입력에 적재
  3. visibility: private(기본) vs. workspace 공유(read-only)
  4. 공유본 Clone — 타 유저가 수정하려면 클론 필요
  5. Delete — 소유자만 가능

---

## i18n parity 점검

`codebase/frontend/src/lib/i18n/dict/ko/editor.ts` 와 `codebase/frontend/src/lib/i18n/dict/en/editor.ts` 에 동일한 15개 키(`datasets`, `datasetShared`, `datasetClone`, `datasetDelete`, `datasetListEmpty`, `datasetSaveAs`, `datasetSave`, `datasetNamePlaceholder`, `datasetShareWorkspace`, `datasetSaved`, `datasetSaveFailed`, `datasetCloned`, `datasetCloneFailed`, `datasetDeleted`, `datasetDeleteFailed`)가 양쪽에 모두 등록됐다. i18n parity 위반 없음.

---

## 기타 trigger 매칭 결과

| 매트릭스 행 (id) | 매칭 여부 | 근거 |
|---|---|---|
| new-node (glob: `codebase/backend/src/nodes/**`) | 불일치 | 신규 모듈은 `src/modules/workflow-test-datasets/` — `src/nodes/` 하위 아님 |
| node-schema-change (glob: `codebase/backend/src/nodes/**`) | 불일치 | 동일 이유 |
| new-ui-string (semantic) | 매칭 — 처리됨 | TSX 신규 UI 문자열; ko/en 양쪽 dict 등록 확인 → parity OK |
| integration-provider-change (semantic) | 불일치 | 통합/제공자 변경 아님 |
| new-userguide-section-dir (glob) | 불일치 | 신규 docs 섹션 디렉토리 없음 |
| backend-api-change (semantic) | 매칭 | 신규 controller + DTO 다수. swagger jsdoc 은 코드 내 구비됨. user-guide 페이지 갱신은 run-debug-flow-change 와 동일 경로 — 위 WARNING 에서 처리 |
| new-warning-code (semantic) | 불일치 | 신규 warningRule 없음 |
| new-error-code (glob: `error-codes.ts`) | 불일치 | `error-codes.ts` 변경 없음 |
| new-backend-ui-zod-value (semantic) | 불일치 | 신규 zod ui.label/hint 값 없음 |
| new-handler-output-field (semantic) | 불일치 | 신규 output.result.* 키 없음 |
| auth-session-flow-change (semantic) | 불일치 | auth 흐름 변경 없음 |
| expression-language-change (glob) | 불일치 | expression-engine 변경 없음 |
| run-debug-flow-change (semantic) | 매칭 — WARNING | 위 발견사항 참조 |
| env-runtime-change (semantic) | 불일치 | 환경 변수·런타임 변경 없음 |
| spec-major-change (glob) | 불일치 (본 PR 범위 기준) | spec 파일 변경 없음 (plan 파일만 변경) |
| new-cross-cutting-enum (semantic) | 불일치 | cross-cutting enum 추가 아님 (`TestDatasetVisibility` 는 workflow-test-datasets 모듈 전용) |
| auth-config-type-enum-change (semantic) | 불일치 | AuthConfig 변경 없음 |
| userguide-gui-flow-section (semantic) | 불일치 | MDX 변경 없음 |
| spec-defect-found (semantic) | 불일치 | spec 결함 발견 케이스 아님 |

---

## 요약

매트릭스 19개 trigger 중 실질적으로 매칭된 trigger 는 `run-debug-flow-change` (semantic) 1건이며, 누락된 동반 갱신 1건(WARNING)이 확인됐다. "Run with Input" 다이얼로그에 Datasets 저장·불러오기·공유·clone·삭제 기능이 신설됐으나, `codebase/frontend/src/content/docs/05-run-and-debug/running-a-workflow.{mdx,en.mdx}` 에는 관련 안내가 전혀 없어 사용자 가이드가 실제 기능보다 뒤처진다. i18n parity(ko/en 양쪽 15개 키 등록)는 정상이며 CRITICAL 이슈 없음.

## 위험도
WARNING
