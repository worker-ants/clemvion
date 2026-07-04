# Cross-Spec 일관성 검토 — C-3 실행 컨텍스트 in-memory 정직화 (Redis context store 드리프트 제거)

대상: `plan/in-progress/spec-draft-c3-context-drift.md` (draft) → `spec/5-system/4-execution-engine.md` §6.2 / §7.5 / §9.1 / §9.2 + Rationale, `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts:55` 주석.

## 조사 방법

- 대상 spec 파일의 실제 working-tree diff(`git diff spec/5-system/4-execution-engine.md`)를 draft 의 Δ1~Δ5 항목과 1:1 대조.
- draft 가 "무결성/side-effect" 절에서 재확인 대상으로 지목한 `data-flow/3-execution.md`, `conventions/execution-context.md`, `2-navigation/15-system-status.md`/`5-system/16-system-status-api.md` 를 grep 하여 제거 대상 Redis 키(`:context`/`:status`/`node:{id}:output`/`worker:{id}:heartbeat`/`lock:{id}`/`queue:priority`) 잔존 여부 확인.
- `spec/0-overview.md` §1(아키텍처 다이어그램)·§2.4(Execution Engine)·§2.6(Data Layer)의 Redis 서술이 정정된 모델과 여전히 정합하는지 확인.
- 코드 주석(Δ5 대상 파일) 변경 여부 확인.

## 발견사항

이번 target 은 다른 영역과 **모순을 새로 만드는 draft** 가 아니라, 이미 다른 영역(`0-overview.md`, `data-flow/3-execution.md`, `conventions/execution-context.md`)이 서술하던 **실제 모델과 `4-execution-engine.md` 만 어긋나 있던 기존 드리프트**를 후자 쪽에서 제거해 정합시키는 변경이다. 조사 결과 CRITICAL/WARNING 은 발견되지 않았다.

- **[INFO]** `spec/0-overview.md` §2.4 "실행 상태 관리" 문구는 여전히 일반론적 표현
  - target 위치: (해당 없음 — target 문서 자체는 `0-overview.md` 를 건드리지 않음)
  - 충돌 대상: `spec/0-overview.md` §2.4 `Execution Engine` 항목 "실행 상태 관리 및 장애 시 복구 (active 세그먼트 stalled-job 재배달; `waiting_for_input` 은 무기한 보존)"
  - 상세: 모순은 아니다 — 이 문구는 Redis 를 특정하지 않고 "실행 상태 관리" 라는 일반 표현만 쓰므로 in-memory+DB 모델과도 자연히 호환된다. 다만 `0-overview.md` §2.6 Data Layer 절이 Redis 를 "캐시, BullMQ 큐 백엔드 (...), 운영 lock (...), pub/sub 채널 (...), 세션 관리" 로 나열하면서 실행 컨텍스트/상태 저장을 언급하지 않는 점이 이번 정정 방향과 이미 일치한다는 점을 재확인했다 — 즉 `0-overview.md` 는 애초에 드리프트가 없었다.
  - 제안: 조치 불필요. 향후 `0-overview.md` 편집 시 "실행 상태 관리"라는 표현이 Redis 오독을 유발하지 않는지 유의만 하면 된다.

- **[INFO]** cross-file 재확인 대상 3개 문서 — 드리프트 없음 확인
  - target 위치: draft "무결성/side-effect" 절 (라인 58)
  - 충돌 대상: `spec/data-flow/3-execution.md` §2.2~2.3, `spec/conventions/execution-context.md` 원칙4/Rationale, `spec/5-system/16-system-status-api.md`
  - 상세: 세 문서 모두 실제로 존재하는 Redis 키(`exec:cont:seq:*`, BullMQ 큐, `exec:recover:lock` 등)만 언급하며, 제거 대상인 6종 키(`:context`/`:status`/`node:{id}:output`/`worker:{id}:heartbeat`/`lock:{id}`/`queue:priority`)나 "Redis 가 실행 컨텍스트를 보관한다"는 서술은 존재하지 않는다. `conventions/execution-context.md` §원칙4 는 오히려 `_contextKey` 를 "in-memory Map 라우팅 전용 — Redis 키 패턴과 무관" 이라고 이미 명시해 정정된 모델과 사전에 일치했다. draft 가 "9-observability.md" 를 재확인 대상으로 적었으나 해당 파일은 `spec/5-system/` 에 존재하지 않는다(문서 맵에도 없음) — 사소한 오기이며 실질 리스크 없음.
  - 제안: 조치 불필요. `9-observability.md` 표기는 오기로 보이나 실제 검토 대상 문서가 다른 이름(`5-system/16-system-status-api.md` 등)으로 이미 커버됐으므로 재작업 불필요.

- **[INFO]** 제거된 6종 키에 대한 두 개의 잔존 언급은 의도된 "역사적 각주"
  - target 위치: draft Δ3 (§9.2 표 아래 note) / Δ4 (§Rationale 신규 섹션)
  - 충돌 대상: `spec/5-system/4-execution-engine.md` 라인 1120(§9.2 note), 라인 1419(§Rationale)
  - 상세: grep 결과 제거 대상 키 문자열이 이 두 곳에만 남아 있으며, 둘 다 "이 키들은 Phase-1 설계였고 구현되지 않았다/코드에 없다"는 명시적 부정 문구로 감싸여 있다. 다른 spec 영역에서 이 두 곳을 실제 사용 키로 오인해 참조하는 case 는 없었다(grep 전역 확인). data model·API 계약·상태 전이·RBAC 어느 관점에서도 모순 소지 없음.
  - 제안: 조치 불필요. 오히려 향후 동일 혼동 방지에 도움이 되는 설계다.

## 요약

이 target 은 Redis 기반 실행 상태 모델을 정의하는 새로운 spec 이 아니라, `4-execution-engine.md` 한 문서에 남아있던 미구현 Phase-1 서술을 실제 in-memory+PostgreSQL durable 모델로 정정하는 spec-drift cleanup 이다. 데이터 모델(Execution/NodeExecution 컬럼), API 계약, 요구사항 ID, 상태 전이, RBAC, 계층 책임 어느 관점에서도 다른 영역과 새 충돌을 만들지 않으며, 오히려 `0-overview.md`·`data-flow/3-execution.md`·`conventions/execution-context.md` 가 이미 갖고 있던 "실제 모델" 서술과 `4-execution-engine.md` 를 일치시킨다. 실제 코드 diff 확인 결과 draft 의 Δ1~Δ5 모두 target 파일에 정확히 반영되어 있고, 제거된 6종 Redis 키에 대한 참조가 다른 spec 영역 어디에도 남아있지 않음을 확인했다. Cross-Spec 관점에서 위험 요소는 없다.

## 위험도

NONE
