# Spec 정합성 정정 — S3 키 패턴 / execution_path 컬럼

직전 PR #5 (data-flow spec 작성) 에서 발견된 두 가지 정합성 이슈를 후속으로 정리한다.

## 배경

PR #5 의 `spec/data-flow/file-storage.md`·`spec/data-flow/execution.md` 작성 과정에서 다음 두 정합성 이슈가 노출되었다.

1. **S3 키 패턴 불일치** — `spec/0-overview.md §2.7` 의 버킷 구조 다이어그램이 `{workspaceId}/knowledge-base/{kbId}/{documentId}_{originalName}` 로 표기되어 있으나, 실제 코드(`backend/src/modules/knowledge-base/knowledge-base.service.ts:723`) 는 `kb/<kbId>/<docId>/<filename>` 패턴을 사용한다.
2. **execution_path 컬럼 폐기 미반영** — `backend/migrations/V036__execution_drop_execution_path.sql` 가 `execution.execution_path UUID[]` 컬럼을 DROP 했고, `V035__execution_node_log_create.sql` 가 `execution_node_log` 테이블을 신설해 대체했으나, `spec/1-data-model.md §2.13` 가 여전히 옛 컬럼을 언급하고 있었다.

## 작업 항목

- [x] **§2.7 정정** — `spec/0-overview.md` 의 버킷 구조 다이어그램에서 KB 키 패턴을 `kb/{kbId}/{documentId}/{sanitizedFilename}` 로 정정하고, 영역별 상태(구현됨 vs 계획) 표를 추가. 코드 reference (`backend/src/modules/knowledge-base/knowledge-base.service.ts:723`, `backend/.env.example:55`) 명시.
  - Form/Avatar 영역은 코드 측 upload 호출이 존재하지 않으므로 "계획" 상태로 분리 표기. `s3Service.upload` 호출 site 는 grep 결과 KB 한 곳뿐.
- [x] **§2.13 정정** — `spec/1-data-model.md` 의 Execution 테이블에서 `execution_path UUID[]` 행 제거. 신규 §2.13.1 `ExecutionNodeLog` 추가. 인덱스 전략 표에 `(execution_id, id)` 추가. 본문 하단 Rationale 섹션 신설 — V035/V036 migration 인용.
- [x] **plan 노트 생성** — 본 문서.
- [~] **data-flow cross-link 갱신** — skip. 본 worktree base 가 main 이라 PR #5 의 `spec/data-flow/` 가 존재하지 않음. PR #5 머지 후 별도 follow-up.

## 결정·근거

- **`forms/` · `avatars/` 영역의 spec 표기 유지** — 두 영역 모두 backend 에 실제 upload 호출 site 가 없음 (`grep s3Service.upload backend/src` 결과 KB 만). 코드와 모순이 아니라 "계획" 상태이므로 그대로 두되, 상태 컬럼으로 명시 분리.
- **`execution_path` 잔존 언급 확인** — `spec/5-system/4-execution-engine.md:692` 도 본 컬럼을 언급하지만, 거기는 "이전 모델 ... 부터 대체" 라는 history 맥락의 정확한 서술이므로 수정 불필요. `spec/1-data-model.md` 의 잔존 표기만 정정 대상.
- **Rationale 위치** — `spec/1-data-model.md` 는 기존에 Rationale 섹션이 없었음. CLAUDE.md 의 "권장 3섹션 구성" 에 맞춰 본문 끝에 신설.

## 검증

- `grep -n "execution_path" spec/1-data-model.md` → V036 DROP / Rationale 맥락에서만 등장 (옛 컬럼 행 row 는 0)
- `grep -n "knowledge-base/{kbId}" spec/0-overview.md` → 0 hit
- `grep -n "kb/{kbId}" spec/0-overview.md` → 1+ hit
- `python3 scripts/check-doc-links.py` → 신규 BROKEN 0 (baseline 11 유지)

## 후속

- PR #5 (`worktree-agent-aba12ac1347e1d069`) 머지 후, `spec/data-flow/file-storage.md`·`spec/data-flow/execution.md` 의 Rationale 메모(있다면 "1-data-model 정합성은 후속 plan" 류) 를 "본 plan 에서 해소됨" 으로 한 줄 갱신. 본 plan 의 작업 자체는 끝이므로 본 항목 처리 후 `plan/complete/` 로 이동.
