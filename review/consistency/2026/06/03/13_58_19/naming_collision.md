# 신규 식별자 충돌 검토 결과

> 검토 모드: `--impl-prep` (구현 착수 전 검토)  
> 대상: `spec/` 워크트리 변경분 (spec-sync-audit worktree vs main)  
> 검토일: 2026-06-03

---

## 발견사항

### 1. [WARNING] `plan/in-progress/spec-sync-workflow-list-gaps.md` — main 에 존재하지 않는 plan 파일 참조

- **target 신규 식별자**: `plan/in-progress/spec-sync-workflow-list-gaps.md` (파일 경로)
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/spec-sync-audit/spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:` 항목에서 참조. 파일 자체는 worktree 의 `plan/in-progress/spec-sync-workflow-list-gaps.md` 에만 존재하고 main 의 `/Volumes/project/private/clemvion/plan/in-progress/` 에는 없다.
- **상세**: target spec 이 main 에 머지될 때 참조하는 plan 파일이 함께 커밋되지 않으면 dangling reference 가 된다. `spec/conventions/spec-impl-evidence.md` 의 frontmatter 파싱 가드(`INCLUDE_PREFIXES`)와 plan-lifecycle 검증 툴이 존재하지 않는 plan 파일을 phantom pending_plan 으로 취급할 수 있다.
- **제안**: spec 변경과 함께 `plan/in-progress/spec-sync-workflow-list-gaps.md` 를 동일 커밋(또는 선행 커밋)으로 main 에 포함시킬 것. 또는 해당 plan 파일이 이 PR 범위 밖이라면 `pending_plans` 항목을 이번 spec 변경에서 제거한다.

---

### 2. [INFO] `Node.category` enum 에 `trigger` 추가 — `spec/1-data-model.md` vs `spec/4-nodes/0-overview.md` 기존 불일치 해소

- **target 신규 식별자**: `trigger` 값이 `spec/1-data-model.md §2.6 Node.category Enum` 에 추가됨
- **기존 사용처**: `spec/4-nodes/0-overview.md:84` 에서 이미 `trigger / logic / flow / ai / integration / data / presentation` 7종으로 정의. 백엔드 코드(`manual-trigger.schema.ts`, `graph-traversal.service.ts`, `workflow-assistant-stream.service.ts` 등)도 이미 `category: 'trigger'` 를 사용 중.
- **상세**: target 이 `spec/1-data-model.md` 의 6값 목록(`logic / flow / ai / integration / data / presentation`)에 `trigger` 를 추가해 `spec/4-nodes/0-overview.md` 및 구현체와 정합화하는 올바른 수정. 실질적 충돌 없음 — 기존 불일치를 해소하는 동기화 수정.
- **제안**: 추가 조치 불필요. 단, `spec/4-nodes/0-overview.md` 의 기존 정의와 중복 선언이 되므로 어느 하나를 canonical SoT 로 명시하거나 cross-reference 를 유지하는 것이 좋다.

---

### 3. [INFO] `DashboardSummaryDto` 필드 — `inactiveWorkflows` 제거, `activeWorkflows`·`runs7dPrevious`·`runs7dChangePercent` 추가

- **target 신규 식별자**: `activeWorkflows`, `runs7dPrevious`, `runs7dChangePercent` (spec 에 추가); `inactiveWorkflows` (spec 에서 제거)
- **기존 사용처**: `codebase/backend/src/modules/dashboard/dto/responses/dashboard-response.dto.ts` — `activeWorkflows`, `runs7dPrevious`, `runs7dChangePercent` 이미 구현됨. `inactiveWorkflows` 는 코드베이스 어디에도 존재하지 않음(spec 전용 phantom 필드였음).
- **상세**: target 이 spec 을 코드베이스 실제 DTO 와 맞추는 수정. `successRate` 의 분모도 `(completed + failed)` → `(7일 전체 실행 건수)` 로 보정하여 서비스 계층(`successCount / runs7dResult`) 과 일치. 기존 spec 이 잘못 기술된 것이므로 충돌 없음.
- **제안**: 추가 조치 불필요.

---

### 4. [INFO] `chain_id` 컬럼 타입 변경 — `UUID NOT NULL (자기참조)` → `UUID? NULLABLE`

- **target 신규 식별자**: `chain_id: UUID?` (NULLABLE 모델)
- **기존 사용처**: 구 `spec/1-data-model.md §2.13 Execution` 에서 `chain_id: UUID NOT NULL` (원본=자기참조, cross-chain re-run 불가 의미). `migrations/V067__execution_re_run_chain.sql` 헤더에서 이미 "spec §9.1 은 NOT NULL 로 기술하나 구현은 NULLABLE 모델 채택" 명시.
- **상세**: target 이 `chain_id: UUID? NULLABLE` + `re_run_of: UUID?` 로 변경하여 V067 마이그레이션과 정합화. 기존 NOT NULL 모델 정의는 구현 대비 잘못된 spec 으로, target 이 이를 수정. 의미 충돌 없음.
- **제안**: 추가 조치 불필요. `spec/5-system/13-replay-rerun.md §9.1` 에도 동일한 NULLABLE 근거가 기술되어 있음을 확인.

---

### 5. [INFO] `folderId` 쿼리 파라미터 — `GET /api/workflows` spec 에 추가

- **target 신규 식별자**: `folderId` (query param) — `spec/2-navigation/1-workflow-list.md §3 API` 에 추가됨
- **기존 사용처**: `codebase/backend/src/modules/workflows/dto/query-workflow.dto.ts:39` 에 이미 `folderId?: string | null` 로 구현됨. 구 spec API 테이블에 `folderId` 가 빠져 있던 gap 을 채우는 수정.
- **상세**: 식별자 충돌 없음. spec 누락 항목 추가.
- **제안**: 추가 조치 불필요.

---

## 요약

target 의 `spec/` 변경은 전체적으로 기존 구현(코드베이스)과 불일치했던 spec 항목들을 동기화하는 수정으로, 새로운 의미적 충돌을 유발하는 식별자는 발견되지 않았다. 다만 `spec/2-navigation/1-workflow-list.md` 가 참조하는 `plan/in-progress/spec-sync-workflow-list-gaps.md` 파일이 현재 worktree 에만 존재하고 main 에는 없어, 해당 spec 변경이 main 에 머지될 때 plan 파일을 동반 포함하거나 frontmatter 참조를 정리해야 한다. 기존 spec 에 이미 문서화된 `interactionType` 의 이중 enum 사용(action 기록 vs WaitingInteractionType)은 target 이 변경하지 않으므로 이번 범위 내 새로운 충돌이 아니다.

## 위험도

LOW
