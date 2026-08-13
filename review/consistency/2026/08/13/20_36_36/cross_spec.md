# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done)

## 검토 범위 요약

이번 diff 는 **spec 문서 변경이 전혀 없는 순수 코드 버그 수정**이다. TypeORM 0.3.31 +
pg 가 `UPDATE`/`DELETE ... RETURNING` 에 대해 `[rows, rowCount]` 튜플을 돌려주는데,
7개 소비 지점이 이를 행 배열로 오인해 왔던 결함을 `updateReturningRows()` 헬퍼로
일괄 수정한 것이다 (대상: `execution-engine.service.ts` 2곳, `knowledge-base.service.ts`
5곳). 대응 plan(`plan/in-progress/update-returning-tuple-shape.md`)의
`spec_impact: none` 표기를 실측으로 검증했다.

## 발견사항

교차 영역 충돌은 발견되지 않았다. 오히려 반대 방향을 확인했다 — **이 수정은 이미
문서화된 cross-spec 계약과 코드가 그동안 어긋나 있던 지점을 코드 쪽에서 바로잡는다**:

- **admission gate (§8, `spec/5-system/4-execution-engine.md:1133-1138,1694-1707`)**:
  "admission gate 는 PENDING→RUNNING 최초 진입에만 적용, stalled 재배달(§7.1)·park
  재개(§7.5)는 재심사하지 않는다" 는 이미 명시된 불변식이다. 튜플 버그로 `admitted` 가
  영원히 `false` 가 되면서, 모든 정상 admission 이 이 불변식을 어기고 §7.5 case B
  (크래시 재구동 경로)로 새어나가고 있었다(2s 지연 + `EXECUTION_STARTED`/
  `recordRunningSegmentStart` 미실행). 이번 수정은 코드를 이미 있는 spec 문언에
  맞춰 되돌린 것이지, spec 대비 새 이탈을 만들지 않는다.
- **KB CAS 락 (`spec/2-navigation/5-knowledge-base.md:149,216,221`,
  `spec/5-system/3-error-handling.md:196-197`, `spec/5-system/10-graph-rag.md:524,565`,
  `spec/5-system/8-embedding-pipeline.md:389`)**: 4개 문서가 공통으로 "진행 중이면
  409 `KB_REEXTRACT_IN_PROGRESS`/`KB_REEMBED_IN_PROGRESS` atomic CAS 로 차단" 을
  기술한다. 같은 튜플 버그로 `acquired.length === 0` 판정이 항상 거짓이 되어 락이
  한 번도 거절하지 않았다(동시 재추출/재임베딩 허용). 수정은 4개 문서가 이미 요구하는
  거절 동작을 처음으로 실제 작동시킨다.
- **빈 KB 즉시 idle 복귀 (`spec/5-system/8-embedding-pipeline.md:268`)**: "빈 KB 는
  진입 시 즉시 idle 로 되돌린다" 는 이미 문서화돼 있는데, 같은 버그로 `reset.length
  === 0` 분기가 죽어 있어 문서 0건 KB 가 `reembed_status='in_progress'` 로 영구
  좌초했다. 수정이 문서 문언대로 동작을 복구한다.

세 지점 모두 "코드가 spec 을 따라잡는" 방향이라 새로운 데이터 모델/API 계약/요구사항
ID/RBAC/계층 책임 충돌은 없다. 상태 전이 관점에서도 마찬가지 — §7.5 case B 트리거
조건("크래시/재배달 전용")과 실제 코드 경로가 이번에 비로소 일치한다.

- **[INFO] 이력 기록 권장 (선택)**
  - target 위치: 코드 diff 전체 (`update-returning-rows.ts` 및 7개 호출부)
  - 충돌 대상: 없음 — 참고 문서 `spec/5-system/4-execution-engine.md` §Rationale,
    `spec/5-system/8-embedding-pipeline.md` §Rationale
  - 상세: 이 저장소는 동일 결함 클래스(`agent-memory-admin` NotFound 미변환,
    `stuck-document-recovery` 가짜 job 2개)를 이미 두 번 Rationale 에 기록해 온
    관례가 있다. 이번 건은 §8 admission gate·§7.5 케이스 분리·KB CAS 락 3개
    문서·빈 KB idle 복귀까지 총 4개 spec 영역의 이미 있던 문언을 어기고 있었던
    범위가 넓어, 다음 spec 갱신 사이클에 Rationale 한 줄로 남겨 두면 재발
    추적에 유리하다. 코드 자체의 헤더 주석(`update-returning-rows.ts`)이 이미
    상세하므로 blocking 성격은 아니다.
  - 제안: `spec/5-system/4-execution-engine.md`(§8/§7.5 인접) 또는
    `spec/5-system/8-embedding-pipeline.md` Rationale 에 "UPDATE/DELETE RETURNING
    튜플 오인 결함 수정" 한 항목 추가 검토(선택, 이번 PR 필수 아님 — `spec_impact:
    none` 판단을 뒤집을 근거는 없음).

## 요약

이번 target(`spec/5-system/` 범위 impl-done 검토)은 spec 문서를 전혀 건드리지 않는
순수 백엔드 버그 수정이며, `plan/in-progress/update-returning-tuple-shape.md` 의
`spec_impact: none` 은 실측(§8 admission gate, KB CAS 락 4문서, 빈 KB idle 복귀 문언과
대조)으로 타당하다고 확인했다. 오히려 수정 전 코드가 이미 존재하던 cross-spec 계약
(4-execution-engine.md §8/§7.5 분리, 4개 문서에 걸친 KB 409 락, embedding-pipeline.md
빈 KB idle 복귀)을 조용히 어기고 있었고, 이번 diff 는 그 어긋남을 코드 쪽에서
해소한다. 데이터 모델·API 계약·요구사항 ID·RBAC·계층 책임 어느 관점에서도 새로운
충돌은 없다.

## 위험도

NONE
