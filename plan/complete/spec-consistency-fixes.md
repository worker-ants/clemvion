# Spec 정합성 정정 — S3 키 패턴 / execution_path 컬럼

직전 PR #5 (data-flow spec 작성) 에서 발견된 두 가지 정합성 이슈를 후속으로 정리한다.

## 배경

PR #5 의 `spec/data-flow/4-file-storage.md`·`spec/data-flow/3-execution.md` 작성 과정에서 다음 두 정합성 이슈가 노출되었다.

1. **S3 키 패턴 불일치** — `spec/0-overview.md §2.7` 의 버킷 구조 다이어그램이 `{workspaceId}/knowledge-base/{kbId}/{documentId}_{originalName}` 로 표기되어 있으나, 실제 코드(`backend/src/modules/knowledge-base/knowledge-base.service.ts:723`) 는 `kb/<kbId>/<docId>/<filename>` 패턴을 사용한다.
2. **execution_path 컬럼 폐기 미반영** — `backend/migrations/V036__execution_drop_execution_path.sql` 가 `execution.execution_path UUID[]` 컬럼을 DROP 했고, `V035__execution_node_log_create.sql` 가 `execution_node_log` 테이블을 신설해 대체했으나, `spec/1-data-model.md §2.13` 가 여전히 옛 컬럼을 언급하고 있었다.

## 작업 항목

- [x] **§2.7 정정** — `spec/0-overview.md` 의 버킷 구조 다이어그램에서 KB 키 패턴을 `kb/{kbId}/{documentId}/{sanitizedFilename}` 로 정정하고, 영역별 상태(구현됨 vs 계획) 표를 추가. 코드 reference (`backend/src/modules/knowledge-base/knowledge-base.service.ts:723`, `backend/.env.example:55`) 명시.
  - Form/Avatar 영역은 코드 측 upload 호출이 존재하지 않으므로 "계획" 상태로 분리 표기. `s3Service.upload` 호출 site 는 grep 결과 KB 한 곳뿐.
- [x] **§2.13 정정** — `spec/1-data-model.md` 의 Execution 테이블에서 `execution_path UUID[]` 행 제거. 신규 §2.13.1 `ExecutionNodeLog` 추가. 인덱스 전략 표에 `(execution_id, id)` 추가. 본문 하단 Rationale 섹션 신설 — V035/V036 migration 인용.
- [x] **plan 노트 생성** — 본 문서.
- [x] **data-flow cross-link 갱신** — PR #5 머지 후 plan-cleanup 후속 작업(2026-05-13) 에서 `spec/data-flow/4-file-storage.md` Rationale §S3 key 권장 문구 + `spec/data-flow/3-execution.md` Rationale §execution_path DROP 두 곳에 본 plan 으로 해소됐다는 cross-link 추가.
- [x] **잔존 broken refs 11건 일괄 정정** — `check-doc-links.py` 가 baseline 으로 보고하던 11건(docs-consolidation 2026-05-12 잔존)을 동일 PR 안에서 해소. 세 그룹:
  - Group A (1건): `spec/2-navigation/14-execution-history.md` 의 옛 `./2-workflow-editor.md` 참조를 `../3-workflow-editor/_product-overview.md` 로 정정.
  - Group B (4건): `spec/3-workflow-editor/_product-overview.md` 와 `spec/4-nodes/3-ai/_product-overview.md` 의 `../frontend/...` 상대 깊이를 `../../frontend/...` / `../../../frontend/...` 로 정정.
  - Group C (6건): 5개 MDX (`first-workflow`, `ui-tour`, `what-is-this`, `overview`, `integration-management`) 의 frontmatter `spec:` 배열에서 옛 `prd/*.md` 항목을 매핑된 `spec/*.md` 로 교체 (`spec/0-overview.md`·`spec/2-navigation/_product-overview.md`·`spec/3-workflow-editor/_product-overview.md`·`spec/2-navigation/4-integration.md`·`spec/4-nodes/3-ai/_product-overview.md`). 매핑 결과가 기존 항목과 중복되는 2건은 중복 제거.

## 결정·근거

- **`forms/` · `avatars/` 영역의 spec 표기 유지** — 두 영역 모두 backend 에 실제 upload 호출 site 가 없음 (`grep s3Service.upload backend/src` 결과 KB 만). 코드와 모순이 아니라 "계획" 상태이므로 그대로 두되, 상태 컬럼으로 명시 분리.
- **`execution_path` 잔존 언급 확인** — `spec/5-system/4-execution-engine.md:692` 도 본 컬럼을 언급하지만, 거기는 "이전 모델 ... 부터 대체" 라는 history 맥락의 정확한 서술이므로 수정 불필요. `spec/1-data-model.md` 의 잔존 표기만 정정 대상.
- **Rationale 위치** — `spec/1-data-model.md` 는 기존에 Rationale 섹션이 없었음. CLAUDE.md 의 "권장 3섹션 구성" 에 맞춰 본문 끝에 신설.

## 검증

- `grep -n "execution_path" spec/1-data-model.md` → V036 DROP / Rationale 맥락에서만 등장 (옛 컬럼 행 row 는 0)
- `grep -n "knowledge-base/{kbId}" spec/0-overview.md` → 0 hit
- `grep -n "kb/{kbId}" spec/0-overview.md` → 1+ hit
- `python3 scripts/check-doc-links.py` → `OK: 0 broken refs across 79 markdown files + frontend MDX frontmatter.` (baseline 11 → 0)

## 후속

- PR #5 머지 후 `spec/data-flow/4-file-storage.md`·`spec/data-flow/3-execution.md` Rationale 두 곳에 본 plan 해소 cross-link 추가 완료 (2026-05-13). 작업 closure → `plan/complete/` 로 이동.
