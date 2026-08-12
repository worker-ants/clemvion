# Rationale 연속성 검토 — spec-draft-redis-key-registry.md

## 발견사항

- **[INFO]** 인접 네임스페이스 각주에 `_contextKey`(`bg:<executionId>:<backgroundRunId>`) 누락
  - target 위치: `## 제안 변경 > 1.` "인접 네임스페이스 각주" 항목 (target 라인 144-147)
  - 과거 결정 출처: `spec/conventions/execution-context.md` 원칙 4 (`## 1. 설계 원칙` §원칙4, 62번째 줄) — "`_contextKey?: string` … **in-memory Map 라우팅 전용** — Redis 키 패턴([execution-engine §9.1])과 무관하다."
  - 상세: 이 문서는 `background:run:<id>`(Socket.IO 채널)·BullMQ 큐명은 "Redis 키처럼 보이지만 아니다" 인접 네임스페이스로 명시했다. 그런데 `_contextKey` 의 `bg:<executionId>:<backgroundRunId>` 형태 역시 `{도메인}:{용도}:{식별자}` 와 동일한 시각적 형태를 가진 순수 in-memory Map 라우팅 키이며, `execution-context.md` 가 **이미 한 번 이 정확한 혼동을 예방하기 위해** "Redis 키 패턴과 무관하다" 라고 명문화해 둔 전례가 있다. target 이 새로 만드는 인벤토리가 "형태가 비슷하면 종류까지 같다고 넘겨짚지 말라" 는 자신의 핵심 교훈(§9.2 `background:run:<id>` 오분류 자기반성)을 완전히 관철하려면 이 두 번째 선례도 각주에 실어야 다음 사람이 `bg:*` 를 세 번째 Redis 키 후보로 오인하는 것을 막는다.
  - 제안: "인접 네임스페이스 각주" 항목에 `_contextKey`(`bg:<executionId>:<backgroundRunId>`, in-memory Map 라우팅 전용, SoT `conventions/execution-context.md` 원칙 4) 한 줄을 추가.

## 요약

target(`plan/in-progress/spec-draft-redis-key-registry.md`)은 Rationale 연속성 관점에서 이례적으로 견고하다 — 문서 자체가 이미 "계보" 절에서 `4-execution-engine.md §Rationale` 의 "실행 컨텍스트 in-memory + DB durable — Redis context store 미채택 (2026-07-04)" 결정을 정확히 인용해, §9.1 의 `{service}:{workspaceId}:...}` 패턴이 그 폐기된 Phase-1 설계의 유일한 생존 흔적임을 명시하고 새 Rationale("지켜진 적 없는 규칙은 규칙이 아니라 오해의 원천")까지 작성해 결정 번복을 정당화한다. §9.2 의 `core:{wsId}:rate:{userId}`/`ws:{wsId}:session:{connId}` 제거도 사후 재도입 조건(cafe24-backlog-residual.md A-3 follow-up — 실측 확인된 실재 항목)을 각주로 명시해 향후 되살리기를 근거 있게 열어 두었다. workspace 세그먼트 불필요 논증("executionId 가 이미 전역 유일 UUID")도 EIA §Rationale R8/R7 의 기존 선례를 그대로 재사용해 자기모순 없이 정합적이다. `background:run:<id>` WS 채널 오분류를 CRITICAL 지적 후 스스로 인접 네임스페이스 각주로 격리한 처리도 적절하다. 유일한 보완점은 인접 네임스페이스 각주가 `_contextKey`(`bg:*`) in-memory 라우팅 키라는, 이미 다른 spec(`conventions/execution-context.md`)이 선제적으로 명문화해 둔 동종 혼동 사례를 놓치고 있다는 것으로, 이는 INFO 수준의 완성도 보완이다. 기각된 대안 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 등 CRITICAL/WARNING 급 문제는 발견되지 않았다.

## 위험도
LOW
