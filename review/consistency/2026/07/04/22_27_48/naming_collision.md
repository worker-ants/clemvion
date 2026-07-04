# 신규 식별자 충돌 검토 — orphan pending backstop

## 검토 대상

- target: `spec/5-system/4-execution-engine.md` (§7.1, §7.4, §8, Rationale "orphan pending backstop") + `spec/data-flow/3-execution.md`
- 신규 식별자: `recoverOrphanPendingExecutions` (private method, `ExecutionEngineService`)
- 검토 모드: --impl-done, diff-base `origin/main`, SoT = 워크트리 `/Volumes/project/private/clemvion/.claude/worktrees/orphan-pending-69fef1` HEAD(`d55d3f59d`)

주의: 전달된 payload(`_prompts/naming_collision.md`)는 `spec/5-system/` 전 영역(1-auth·2-navigation 다수·8-embedding-pipeline·0-overview 등)을 통째로 번들해 실제 target diff("구현 변경 사항" 섹션)를 포함하지 않았다 — 과거 기록된 "impl-done spec 번들 버그"와 동일 패턴. 따라서 신규 식별자 `recoverOrphanPendingExecutions` 자체는 payload 어디에도 등장하지 않아, payload만으로는 검증이 불가능했다. 이에 따라 워크트리를 절대경로로 직접 조회해 실제 diff·spec·plan·코드를 재확인했다.

## 발견사항

- **[INFO]** `recoverOrphanPendingExecutions` 식별자 고유성 확인 — 충돌 없음
  - target 신규 식별자: `recoverOrphanPendingExecutions` (private method, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2913`)
  - 기존 사용처: 없음. `git grep -n "recoverOrphanPendingExecutions"` 전체 이력(all refs) 검색 결과 도입 커밋(`d55d3f59d`) 한 곳에서만 등장.
  - 상세: 동일 서비스 내 기존 `recoverStuckExecutions`(`:2814`, §7.4 부팅 backstop)가 이 신규 메서드를 호출하도록 통합됐다. 이름이 `recover*`/`*Stuck*`/`*Orphan*` 계열로 여러 개 존재하지만(`recoverStuckExecutions` / `reclaimStuckRunningExecution` / knowledge-base 모듈의 `recoverStuckEmbedding` / `recoverStuckGraphExtraction`) 각각 클래스·모듈·의미가 명확히 분리되어 있고, `recoverOrphanPendingExecutions` 라는 완전한 문자열의 중복은 없다.
  - 제안: 변경 불필요. 다만 `recoverStuckExecutions`(RUNNING 대상) / `recoverOrphanPendingExecutions`(PENDING 대상) / knowledge-base `StuckDocumentRecoveryService`(문서 임베딩/그래프 대상) 세 계열이 이름 패턴이 비슷해 신규 합류자가 혼동할 여지가 있으니, 코드 주석·spec Rationale 에 이미 있는 "같은 함수·트리거 재사용" 명시(§7.4/§8 Rationale)를 유지하면 충분.

- **[INFO]** 환경변수·에러코드·마이그레이션 신규 도입 여부
  - target 신규 식별자: (해당 없음 — 재사용만)
  - 기존 사용처: `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`(env, PR2b 기 도입) · `EXECUTION_QUEUE_WAIT_TIMEOUT`(error code, PR2b 기 도입) · `markQueueWaitTimeout`(기존 private method, `execution-engine.service.ts:2560`, PR2b 기 도입) · `queued_at`(V104 컬럼, 기 도입)
  - 상세: diff(`git diff origin/main...HEAD`) 확인 결과 `codebase/backend/migrations/` 에 신규 파일 없음, `.env`/config 관련 변경 없음, 신규 에러 코드 없음. CHANGELOG 항목("신규 migration·env·에러코드 없음")과 plan(`plan/in-progress/orphan-pending-backstop.md`) 체크리스트가 모두 이 사실과 일치한다.
  - 제안: 변경 불필요 — 사용자 지시("No new error codes/env/migration")와 실제 구현이 부합함을 확인.

- **[INFO]** API endpoint 신규 도입 여부
  - target 신규 식별자: 없음
  - 기존 사용처: 해당 없음
  - 상세: `git diff origin/main...HEAD --stat -- '**/*.controller.ts'` 결과 컨트롤러 변경 파일 0건. 본 변경은 순수 내부 백스톱(부팅 스캔) 로직이라 신규 REST/WS endpoint 가 없다.
  - 제안: 변경 불필요.

- **[INFO]** 파일 경로 컨벤션
  - target 신규 식별자: `plan/in-progress/orphan-pending-backstop.md`
  - 기존 사용처: 없음(신규 plan 파일)
  - 상세: `plan/in-progress/<name>.md` 명명 컨벤션에 부합하며 frontmatter(`worktree`/`started`/`owner`/`spec_impact`)도 규약을 따른다. 기존 `plan/in-progress/exec-intake-followups.md` 항목("orphan pending backstop")과 완료 표기가 상호 참조되어 일관적이다.
  - 제안: 변경 불필요.

## 요약

target 이 도입하는 유일한 신규 식별자 `recoverOrphanPendingExecutions` 는 전체 코드베이스·spec·plan 이력을 통틀어 이번 커밋에서만 등장하며 기존 어떤 식별자와도 문자열 충돌이 없다. 이름이 유사한 기존 식별자군(`recoverStuckExecutions`, `reclaimStuckRunningExecution`, knowledge-base 도메인의 `recoverStuckEmbedding`/`recoverStuckGraphExtraction`)은 클래스·모듈·대상 엔티티가 명확히 분리되어 의미 혼동 소지가 낮다. 사용자가 명시한 대로 신규 ENV/에러코드/마이그레이션도 도입되지 않았고(기존 `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`·`EXECUTION_QUEUE_WAIT_TIMEOUT`·`markQueueWaitTimeout`·`queued_at`(V104) 재사용), 신규 API endpoint·컨트롤러 변경도 없다. 다만 이번 호출에 전달된 payload 자체가 target diff 를 포함하지 못한 채 `spec/5-system/` 전 영역을 통째로 번들한 결함이 있어(과거 기록된 "impl-done spec 번들 버그"와 동일 패턴), payload 만으로는 신규 식별자를 특정할 수 없었고 워크트리 직접 조회로 보완했다 — orchestrator 측 payload 생성 로직 점검을 권고하나 이는 naming-collision 관점의 결함은 아니다.

## 위험도

NONE

BLOCK: NO

STATUS: SUCCESS