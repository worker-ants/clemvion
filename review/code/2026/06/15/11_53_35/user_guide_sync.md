# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 매트릭스 적재 현황

- JSON SSOT: `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/.claude/config/doc-sync-matrix.json` (rows: 19개)
- PROJECT.md §변경 유형 → 갱신 위치 매핑: 보조 적재 완료
- 변경 파일 식별: 3개 커밋 (`3bc1ee3c`, `60635810`, `e7b491c9`) 에 걸쳐 도출

## 변경 파일 집합 (리뷰 대상)

Backend 신규 모듈 (`workflow-test-datasets`):
- `codebase/backend/migrations/V097__workflow_test_dataset.sql`
- `codebase/backend/src/modules/workflow-test-datasets/entities/workflow-test-dataset.entity.ts`
- `codebase/backend/src/modules/workflow-test-datasets/dto/create-workflow-test-dataset.dto.ts`
- `codebase/backend/src/modules/workflow-test-datasets/dto/update-workflow-test-dataset.dto.ts`
- `codebase/backend/src/modules/workflow-test-datasets/dto/responses/workflow-test-dataset-response.dto.ts`
- `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts`
- `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts`
- `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.module.ts`
- `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.spec.ts`
- `codebase/backend/src/app.module.ts`, `codebase/backend/src/app.module.spec.ts`, `codebase/backend/src/database/root-entities.ts`
- `codebase/backend/test/workflow-test-dataset.e2e-spec.ts`

Frontend:
- `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` (신규 UI)
- `codebase/frontend/src/lib/api/workflow-test-datasets.ts`
- `codebase/frontend/src/lib/i18n/dict/ko/editor.ts`
- `codebase/frontend/src/lib/i18n/dict/en/editor.ts`
- `codebase/frontend/src/content/docs/05-run-and-debug/running-a-workflow.mdx`
- `codebase/frontend/src/content/docs/05-run-and-debug/running-a-workflow.en.mdx`

Spec:
- `spec/3-workflow-editor/3-execution.md`
- `spec/1-data-model.md`

## 매트릭스 trigger 매칭 결과

| 매트릭스 행 | 매칭 여부 | 동반 갱신 상태 |
|---|---|---|
| `backend-api-change` (controller + DTO glob) | 매칭 | 충족 — swagger jsdoc 작성됨, `05-run-and-debug/` 갱신됨 |
| `run-debug-flow-change` (semantic — 실행 흐름 신규 기능) | 매칭 | 충족 — `running-a-workflow.mdx` + `.en.mdx` 양쪽 신규 섹션 추가됨 |
| `new-ui-string` (TSX `editor-toolbar.tsx` 신규 한국어 UI) | 매칭 | 충족 — `dict/ko/editor.ts` + `dict/en/editor.ts` 양쪽 동시 추가 (parity 확인) |
| `new-error-code` (ErrorCode enum glob — `error-codes.ts`) | 비매칭 | 해당 없음 — `DUPLICATE_NAME`/`FORBIDDEN` 은 inline throw-site, `error-codes.ts` enum 변경 없음 |
| `new-warning-code` (warningRules) | 비매칭 | 해당 없음 — warningRules 변경 없음 |
| `new-node` / `node-schema-change` | 비매칭 | 해당 없음 — `codebase/backend/src/nodes/**` 변경 없음 |
| `auth-session-flow-change` | 비매칭 | 해당 없음 — `codebase/backend/src/modules/auth/**` 변경 없음 |
| `expression-language-change` | 비매칭 | 해당 없음 — expression-engine 변경 없음 |
| `new-userguide-section-dir` | 비매칭 | 해당 없음 — 신규 섹션 디렉토리 없음 (기존 `05-run-and-debug/` 에 파일 추가) |

## 발견사항

### [INFO] 신규 API 에러 코드 DUPLICATE_NAME/FORBIDDEN 의 ERROR_KO 미등록

- 변경 파일: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.service.ts`
- 매트릭스 항목: `new-error-code` — "현재 backend-labels.ts 에 ERROR_KO 매핑 테이블이 없어 영문 message 가 그대로 노출됨. 후속 plan 에서 ERROR_KO 신설 검토 — 그 전까지는 errorCode 추가 시 사용자 가시 ko 노출을 PR 본문에 명시"
- 관련 경로: `/Volumes/project/private/clemvion/.claude/worktrees/exec-test-dataset-22/codebase/frontend/src/lib/i18n/backend-labels.ts`
- 상세: 서비스는 `ConflictException({ code: 'DUPLICATE_NAME' })`, `ForbiddenException({ code: 'FORBIDDEN' })` 을 throw 한다. 이 코드들은 `error-codes.ts` enum 에 추가된 것이 아니라 인라인 throw-site 이므로 `new-error-code` glob trigger 는 기술적으로 비매칭이다. 단, 사용자 가시 에러 코드가 `ERROR_KO` 에 미등록인 상태이며, 프론트엔드가 이 코드를 `translateBackendError` 경로로 처리할 경우 영문 fallback 이 노출된다. PR 본문에 사용자 가시 ko 노출 방침이 명시됐는지 불명확하며, 에러 메시지 처리가 toast 핸들러 레이어에서 별도로 처리되면 무해할 수 있다.
- 제안: 프론트엔드 `editor-toolbar.tsx` 의 에러 처리 코드를 확인해 `DUPLICATE_NAME`/`FORBIDDEN` 이 toast 메시지로 직접 한국어 처리되는지 점검. 그렇지 않다면 `backend-labels.ts` 의 `ERROR_KO` 에 아래 키 추가 권장:
  - `DUPLICATE_NAME`: "같은 이름의 데이터셋이 이미 있어요. 다른 이름을 사용해 주세요."
  - `FORBIDDEN`: 이 코드는 범용적이므로 기존 처리 존재 시 중복 등록 불필요.

## 요약

매트릭스 전체 19개 trigger 중 3개가 이 변경 set 에 매칭되었다 (`backend-api-change`, `run-debug-flow-change`, `new-ui-string`). 3개 모두 동반 갱신이 충족된 상태이다: swagger jsdoc 작성, `running-a-workflow.mdx`+`.en.mdx` KO/EN 양쪽 "테스트 데이터셋" 섹션 신규 추가, `dict/ko/editor.ts`+`dict/en/editor.ts` i18n parity 완료. 누락은 0건이며, `DUPLICATE_NAME` 에러 코드의 `ERROR_KO` 미등록은 인라인 throw-site 라 엄격한 매트릭스 trigger 에는 해당되지 않으나 회색 지대 주의 사항으로 INFO 1건 기록한다.

## 위험도

LOW

STATUS=success ISSUES=1
