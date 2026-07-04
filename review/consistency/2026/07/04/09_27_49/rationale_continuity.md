# Rationale 연속성 검토 — C-3 실행 컨텍스트 in-memory 정직화 (Redis context store 드리프트 제거)

## 대상

- target: `plan/in-progress/spec-draft-c3-context-drift.md`
- 근거 spec: `spec/5-system/4-execution-engine.md` §6.2 / §7.5 / §9.1 / §9.2 + `## Rationale` (특히 "실행 컨텍스트 in-memory + DB durable — Redis context store 미채택", "park 즉시 해제 + slow-path 일원화 (Phase B)", "Durable Continuation & Graceful Shutdown", "Phase 2 cont 후속 정리 3. 워커 크래시 복구 — BullMQ stalled-job 으로 일원화")
- 확인 결과: 위 신규 Rationale 항목(§6.2/§9.2, 2026-07-04)은 이미 `spec/5-system/4-execution-engine.md` 1417~1424행에 반영되어 있고, 본문 §6.2 저장전략표(777행)·§7.5(961행)·§9.2 키 표 note(1120행)도 이미 정정된 상태다. 본 검토는 target draft 가 그 반영과 논리적으로 정합한지를 확인한다.

## 발견사항

이번 검토에서 CRITICAL/WARNING 수준의 발견사항은 없다.

- **[INFO]** Δ4 "신규 Rationale" 표현이 실제로는 기존 3개 결정의 종합(synthesis)임을 더 명시하면 좋음
  - target 위치: `plan/in-progress/spec-draft-c3-context-drift.md` Δ4
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §Rationale "park 즉시 해제 + slow-path 일원화 (Phase B)" (park=세그먼트 종료·모든 재개=rehydration), "Durable Continuation & Graceful Shutdown" (always-enqueue, "키 없음 = DB 재구성"), "Phase 2 cont 후속 정리 3." (heartbeat 포기 → BullMQ stalled-job 일원화)
  - 상세: target 이 "Δ4 — §Rationale 신규 ..." 라고 표현하지만, 그 내용(park-release 이중화 위험 (a), cross-instance 는 이미 §4.2 dedup + §7.4/§7.5 로 해소 (b), 성능·복잡도 (c))은 새로운 결정이 아니라 기존 세 Rationale 항목이 이미 확립한 원칙들의 필연적 귀결을 한 곳에 요약·명문화하는 것이다. 실제로 반영된 spec 의 신규 Rationale 문단(1417~1424행)도 "Redis 큐 + 분산 워커 풀(§0-overview)" · "park 즉시 해제 + slow-path 일원화" · "Phase 2 cont 후속 정리 3." 세 항목을 cross-ref 하며 정합적으로 작성됐다 — 문제는 없으나, "신규 Rationale" 이라는 표현이 마치 새 결정을 내리는 것처럼 읽힐 여지가 있다.
  - 제안: 표현을 "신규 Rationale 항목 — 기존 결정(park-release/Durable Continuation/heartbeat→stalled)의 통합 근거 문서화" 정도로 명확히 하면 향후 이 항목을 읽는 사람이 "새 설계 결정"과 "기존 결정의 spec 본문 정합화"를 혼동하지 않는다. (이미 실제 spec 반영본은 이 관계를 cross-ref 로 잘 드러내고 있어 필수 수정은 아님.)

## 정합성 확인 상세 (참고용, 위반 아님)

1. **park-release 모델과의 정합** — target 이 "재개는 §7.5 rehydration 이 항상 DB 에서 복원(park=세그먼트 종료로 in-memory 소멸)"이라고 서술하는 것은, 기존 Rationale "park 즉시 해제 + slow-path 일원화 (Phase B)"가 이미 확립한 "park = 세그먼트 종료, 모든 재개 = rehydration 단일 경로"(B1·B2 분리 불가 원칙)의 직접적 재진술이다. Redis context store 를 두지 않는 이유 (a)("park 시 durable 진실은 이미 PostgreSQL 이므로 Redis 사본은 rehydration 소스를 이원화")는 오히려 park-release 설계를 **보호**하는 근거로 정확히 작동한다. 위반 없음 — 정합.

2. **Durable Continuation 원칙과의 정합** — "Durable Continuation & Graceful Shutdown" Rationale 의 "Sticky fast-path 제거 — 항상 publish 원칙 보존"·"키 없음 즉시 throw 폐기 원칙의 확장"(옛 §7.4 "키 없음 → silent skip" → BullMQ 시대 "키 없음 = DB 에서 재구성")과 target 의 "항상 DB 에서 복원. 같은 인스턴스가 우연히 context 를 들고 있으면 재사용하나 최적화일 뿐 정합성 전제 아님" 서술은 동일한 원칙의 연장이다. "정합성 전제가 아니다"라는 명시는 옛 sticky fast-path 기각 결정(로컬 Map 히트를 정합성 근거로 쓰지 않는다)과 정확히 일치한다. 위반 없음 — 정합.

3. **§7.1 heartbeat → stalled 결정과의 정합** — "Phase 2 cont 후속 정리 3. 워커 크래시 복구 — BullMQ stalled-job 으로 일원화" (2026-06-04 결정, "별도 heartbeat 채널 도입을 포기하고 BullMQ 내장 stalled-job 으로 일원화... 구 초안의 heartbeat 미응답 기반 판정 전제는 폐기")가 이미 확정한 결정을, target 의 Δ3(worker heartbeat 키 제거 → BullMQ stalled-job 대체, §9.1 sub 예시 `heartbeat` → `seq/lock/session`)이 §9.2 Redis 키 표라는 다른 표면에서 뒤늦게 정합화하는 것이다. 새 결정이 아니라 이미 결정된 사실을 spec 의 또 다른 드리프트된 표(§9.2)에 반영하는 것 — 결정 번복이 아니라 결정의 일관 적용. 위반 없음 — 정합.

4. **`conventions/execution-context.md` 원칙 4 (엔진 내부 필드)와의 관계** — `_contextKey` 를 in-memory Map 키로 규정한 원칙 4와, target 의 "in-memory segment-local ExecutionContext" 모델은 상충하지 않는다. 오히려 원칙 4가 이미 "context 의 in-memory Map 키는 어떤 노드 핸들러도 소비하지 않는 순수 라우팅 식별자"라고 전제하고 있어, target 의 in-memory 모델 명문화가 이 전제와 자연스럽게 부합한다.

5. **기각된 대안의 재도입 여부** — target 이 "Redis context store 미채택"을 결론짓는 근거 (a)(b)(c)는 기존 spec 이 이미 명시적으로 기각한 대안(Redis pub/sub 유지, 별도 heartbeat 채널, 별도 owner/heartbeat 컬럼 등)을 다시 채택하는 것이 아니라, 그 기각들을 하나의 절(§6.2/§9.2 Rationale)로 통합해 "왜 Redis 전면 store 를 두지 않았는가"를 명료화하는 것이다. 재도입 사례 없음.

## 요약

target draft(`spec-draft-c3-context-drift.md`)가 제안하는 "Redis 실행상태 모델 → in-memory segment-local + PostgreSQL durable + §7.5 rehydration" 정정은, 기존 spec 의 세 핵심 Rationale — "park 즉시 해제 + slow-path 일원화 (Phase B)"의 park-release 원칙, "Durable Continuation & Graceful Shutdown"의 always-enqueue/DB-재구성 원칙, "Phase 2 cont 후속 정리 3."의 heartbeat→BullMQ stalled-job 일원화 결정 — 과 정면으로 부합하며 오히려 그 결정들의 필연적 논리적 귀결이다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 등 어느 관점에서도 문제되는 지점을 찾지 못했다. target 이 "Δ4 신규 Rationale"이라 칭한 부분은 실질적으로 새 결정이 아니라 기존 세 결정의 통합 근거 기록이므로 표현을 다소 명확히 할 여지(INFO)만 있다. 실제 spec 반영본(`4-execution-engine.md` 1417~1424행 등)도 위 cross-ref 를 갖춘 형태로 이미 정합적으로 기록돼 있다.

## 위험도

NONE
