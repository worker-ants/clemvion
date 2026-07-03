### 발견사항

- **[INFO]** 구현 변경이 기존 spec 문서 텍스트를 갱신하지 않음
  - target 위치: `spec/5-system/4-execution-engine.md` — 구현 대상 spec 영역이 payload 상 "(없음)"으로 명시됨 (spec 본문 diff 없음)
  - 충돌 대상: 없음 (참고용으로 확인한 `spec/0-overview.md` §2.4/Rationale, `spec/1-data-model.md` §2.13 Execution)
  - 상세: 이번 변경은 `execution-engine.service.ts` 내부 private 헬퍼 `failFirstSegmentSetupBestEffort` 추출(`runExecutionFromQueue`/`executeAsync` 두 catch 진입점이 공유)과 `executeAsync`(fire-and-forget sub-workflow 실행)의 setup-throw 시 best-effort terminal 마감 적용이다. `Execution.status` enum(pending/running/completed/failed/cancelled/waiting_for_input, `spec/1-data-model.md` §2.13)이나 `error.code` 어휘(`spec/1-data-model.md` §2.13 표의 `SERVER_INTERRUPTED`/`WORKER_HEARTBEAT_TIMEOUT`/`EXECUTION_TIME_LIMIT_EXCEEDED` 등)에 새 값을 추가하지 않았고, API 계약·엔드포인트·RBAC·엔티티 필드도 건드리지 않았다. 코드 주석은 `§7.1 stale fail(30분)`, 큐 경로 `W5`/`W7` 계약과의 동치성을 명시적으로 참조하고 있어 기존 spec 문서가 이미 서술한 "best-effort 마감으로 RUNNING/PENDING 잔류 방지" 원칙을 새 진입점에 일관 적용한 것으로 보인다.
  - 제안: spec 갱신 불필요. 다만 `4-execution-engine.md` §3.3(Background 실행)/§7.1/§7.5 어딘가에 "sub-workflow 비동기 실행(`executeAsync`)의 setup 실패도 큐 경로와 동일하게 best-effort 마감된다"는 문장이 아직 없다면, 문서 완전성 차원에서 project-planner 가 1줄 추가를 고려할 수 있다(강제 아님 — 이미 "동일 헬퍼 사용" 이라는 계약은 코드 주석 수준에서 명확).

### 요약
이번 target 변경은 spec 텍스트 수정이 없는(target spec 영역 "없음") 순수 구현 리팩터로, 기존에 `runExecutionFromQueue`(큐 경로)에서만 적용되던 "setup 단계 실패 시 best-effort terminal 마감" 계약을 `executeAsync`(sub-workflow fire-and-forget 경로)에도 동일한 헬퍼로 확장 적용한 것이다. 새로운 엔티티·필드·API·요구사항 ID·상태값·RBAC 규칙이 도입되지 않았으며, `spec/1-data-model.md`의 `Execution.status`/`error` 정의 및 `spec/0-overview.md`의 실행 엔진 아키텍처 서술과 충돌하는 지점이 없다. Cross-spec 일관성 관점에서 문제 없음.

### 위험도
NONE
