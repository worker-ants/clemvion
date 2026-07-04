# 변경 범위(Scope) Review — orphan pending backstop

검토 대상 14개 파일. `git diff origin/main...HEAD --stat` 결과가 payload 의 14개 파일·라인 수와 정확히 일치 — mis-scope 아님(fallback 불필요).

## 발견사항

- **[INFO]** `recoverStuckExecutions` 조기 반환(early-return) 제거는 의도된 설계 변경
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2826` 부근 (`if (reclaimedIds.length === 0) return;` 삭제 → `if (reclaimedIds.length > 0) { ... }` 블록화)
  - 상세: 기존 RUNNING re-drive 로직 자체는 내용 변경 없이 `if` 블록 안으로 들여쓰기만 됐고(diff 상 `-`/`+` 라인이 대부분 동일 텍스트의 재-들여쓰기), 그 뒤에 신규 `await this.recoverOrphanPendingExecutions()` 호출이 추가됐다. 이는 "PENDING 도 항상 스캔"이라는 이번 작업의 핵심 요구사항을 구현하기 위해 필연적으로 필요한 구조 변경이며, `plan/in-progress/orphan-pending-backstop.md` 설계 결정 3번("같은 lock·트리거 재사용 — running 회수 뒤 early-return 제거")과 `review/consistency/.../SUMMARY.md`/`rationale_continuity.md` 에도 사전 승인된 항목으로 명시돼 있다. 순수 리팩토링이 아니라 기능 추가에 종속된 필수 구조 변경 — 범위 내.
  - 제안: 없음(의도된 변경으로 판단).

- **[INFO]** spec 문서(`4-execution-engine.md`, `data-flow/3-execution.md`) 동시 개정
  - 위치: `spec/5-system/4-execution-engine.md` §7.1/§7.4/§8/Rationale, `spec/data-flow/3-execution.md` §3.1 mermaid·§3.3 표
  - 상세: 코드 변경(신규 `recoverOrphanPendingExecutions`)에 대응해 "후속/스코프 아님"으로 예고돼 있던 §8 line 1088 문구를 "구현 완료"로 갱신하고, §7.1/§7.4 서술과 data-flow 표·다이어그램을 동기화했다. `review/consistency/.../SUMMARY.md` 가 "착수 전 반영 필수"로 명시한 항목을 그대로 이행한 것이며, 새로운 요구사항이나 미승인 기능을 spec 에 끼워 넣지 않았다(추가된 절 "orphan pending backstop — recoverStuckExecutions 재사용 + PENDING cancel" 은 이번 변경의 근거 서술일 뿐 별개 주제 아님). 범위 내.

- **[INFO]** `review/consistency/2026/07/04/21_50_44/**` 신규 6개 파일
  - 위치: `SUMMARY.md`, `_retry_state.json`, `convention_compliance.md`, `cross_spec.md`, `meta.json`, `naming_collision.md`, `plan_coherence.md`, `rationale_continuity.md`
  - 상세: `--impl-prep` consistency-check 실행 산출물로, CLAUDE.md 규약("`developer` 는 구현 착수 직전 `consistency-check --impl-prep` 의무")에 따른 필수 아티팩트다. 코드 변경이 아니며 무관한 수정이 아니다. 다만 `convention_compliance.md` 자체가 명시하듯 payload mis-scope(spec/5-system/1-auth.md 전체가 잘못 실림)가 있었던 세션 산출물이지만, 체커가 이를 인지하고 실제 대상(`4-execution-engine.md` §7.4/§8)으로 스스로 보정해 판정했다고 밝히고 있어 결과 신뢰성에는 문제가 없다. 범위 내.

- **[INFO]** `LessThan` import 추가는 최소 필요분
  - 위치: `execution-engine.service.ts:10` — `import { DataSource, In, LessThan, Repository } from 'typeorm';`
  - 상세: 신규 `recoverOrphanPendingExecutions` 의 `queuedAt: LessThan(staleThreshold)` 조건에만 사용되며, 불필요한 임포트 정리나 무관한 임포트 변경은 없다.

- **[INFO]** 테스트 변경(unit 3케이스 + e2e 2케이스)은 신규 동작에 정확히 대응
  - 위치: `execution-engine.service.spec.ts` (`recoverOrphanPendingExecutions` describe 블록), `execution-concurrency-cap.e2e-spec.ts` (`insertPending`/`recoverStuck` 헬퍼 + 2 개 `it`)
  - 상세: 각 테스트는 plan 체크리스트("TDD: orphan scan 유닛 3 + e2e 2")와 1:1 대응하며, 기존 테스트 파일의 다른 `describe`/`it` 블록은 건드리지 않았다(diff 가 순수 추가만). `recoverStuck()` 헬퍼가 호출하는 `/api/executions/_test/recover-stuck-executions` 엔드포인트는 이번 diff 로 신설된 것이 아니라 기존 컨트롤러(`executions.controller.ts:212`)를 재사용 — 신규 API 표면 추가 없음.

CRITICAL/WARNING 등급 발견 없음. 포맷팅-only 변경, 사용하지 않는 임포트, 의도치 않은 설정 변경, 무관한 파일 수정은 없었다.

## 요약

이번 변경은 "orphan pending backstop" 단일 목적에 정확히 수렴한다 — 신규 private 메서드 1개(`recoverOrphanPendingExecutions`), 이를 호출하기 위한 `recoverStuckExecutions` 최소 구조 변경(early-return 제거, 로직 내용은 불변), 대응하는 unit/e2e 테스트, 그리고 사전에 컨센서스(`consistency-check --impl-prep` BLOCK: NO)를 받은 spec 문서 갱신(§8/§7.1/§7.4/Rationale + data-flow)으로 구성된다. `git diff origin/main...HEAD --stat` 이 payload 의 14개 파일과 정확히 일치해 mis-scope 우려도 없다. 관련 없는 리팩토링, 포맷팅 변경, 미승인 기능 확장, 무관한 파일 수정은 발견되지 않았다.

## 위험도
NONE

STATUS: SUCCESS
