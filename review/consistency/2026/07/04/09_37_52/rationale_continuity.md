# Rationale 연속성 검토 — spec/5-system/4-execution-engine.md (impl-done)

## 검토 배경

target 은 `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts` 클래스 주석과
`execution-engine.service.ts` `segmentStartMs` 주석 두 곳의 **comment-only** 변경이다. 두 변경 모두 같은 커밋
(`47307a5d7 docs(spec): 04 execution-engine — C-3 실행 컨텍스트 in-memory 정직화`)에서 `spec/5-system/4-execution-engine.md`
본문·§Rationale 갱신과 함께 이루어졌다. 즉 코드 주석은 spec 변경에 따라오는 SoT 동기화이지, 독립적으로 새 결정을 도입하는
diff 가 아니다. 이 전제 위에서 (a) 코드 주석이 인용하는 spec Rationale 이 실제로 그 내용을 담고 있는지, (b) 그 Rationale 이
과거 결정·다른 spec 문서의 Rationale 과 충돌하지 않는지를 검토했다.

## 발견사항

### INFO — Redis context store 정정은 기각이 아니라 "미구현 서술 제거"이며, 인접 Rationale과 정합

- target 위치: `execution-context.service.ts` 클래스 JSDoc L53-63 (`**Segment-local in-memory execution context — by design (Redis store 미채택).**`)
- 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale "실행 컨텍스트 in-memory + DB durable — Redis context store 미채택"` (신규, 2026-07-04) + `spec/0-overview.md §Rationale "실행 엔진: Redis 큐 + 분산 워커 풀" (§2.4)`
- 상세: 과거 spec 본문(§6.2/§9.2, 정정 전)은 "실행 컨텍스트를 Redis 에 저장(TTL: 실행 타임아웃×2)"·`exec:{ws}:execution:{id}:context`/`:status`/`node:output`/`:heartbeat`/`:lock`/`queue:priority` 6종 키를 **기술**하고 있었으나, 이번 조사(2-agent, 코드 grep 0건)로 이 6종은 **애초에 구현된 적이 없는 Phase-1 설계 문서 잔존물**임이 확인됐다. 코드(`ExecutionContextService.contexts = new Map<string, ExecutionContext>()`)는 처음부터 in-memory 전용이었다. 따라서 이번 변경은 "합의된 결정을 번복"하는 것이 아니라 "구현되지 않은 옛 설계 문서를 걷어내고 실제 아키텍처로 정직화"한 것 — target 문서 자체가 새 Rationale 항목에 이 경위(초기 설계 → 미구현 확인 → 실제 모델 문서화)를 명시적으로 기록해 두었으므로 "결정의 무근거 번복"에 해당하지 않는다.
- `spec/0-overview.md §2.4 Rationale`(Redis 기반 BullMQ 큐 + 분산 워커 풀 채택)와도 층위가 분리되어 충돌하지 않는다 — 0-overview 는 Redis 를 "큐 백엔드·운영 lock·pub/sub·세션 관리"로 열거(§244)하고 execution **context store** 는 애초에 그 목록에 없다. 이번 정정은 큐 인프라(BullMQ, `exec:cont:seq`, `exec:recover:lock` 등 §9.2 잔존 키)는 그대로 유지하고, 구현된 적 없는 context/status/output/heartbeat/lock/priority 6종만 제거했으므로 상위 Rationale 과 모순 없음.
- 제안: 없음 (target 이 이미 SoT 를 정확히 인용하고 있어 추가 조치 불요).

### INFO — PR3→PR4 under-count 주석 정정은 spec 자체의 self-correction 을 그대로 반영

- target 위치: `execution-engine.service.ts` L475-482 (`segmentStartMs` JSDoc, "**PR4** stalled-job 재배달 + 세그먼트-start 영속 구현 시 flush 훅 추가를 검토한다")
- 과거 결정 출처: `spec/5-system/4-execution-engine.md §Rationale "Graceful Shutdown 시 active-running 시간 under-count 허용 (PR2a 결정)"` 의 `> **정정 (PR3, 2026-07-04)**` 인용구
- 상세: 옛 주석은 "PR3 stalled-job 재배달 구현 시 세그먼트 flush 훅 추가를 검토한다"였으나, 실제로는 PR3(#795, 제어된 re-drive)가 세그먼트-start 를 영속하지 않아 under-count 를 해소하지 못한다는 사실이 이후 확인됐다. spec Rationale 은 이를 "이전 서술은 …로 예고했으나 … 정정한다"는 형태로 **스스로 번복을 명시**하고 있고(과거 예고가 틀렸음을 인정 + 새 근거 기재), 코드 주석도 정확히 같은 내용(PR3 는 미해소, PR4 로 이연)으로 갱신됐다. "결정의 무근거 번복"이 아니라 "번복 사유가 spec Rationale 에 명문화된" 모범 사례.
- 제안: 없음.

### INFO — 코드 실제 구현과 주석의 정합성 확인

- target 위치: `execution-context.service.ts` L70-84 (`private readonly contexts = new Map<string, ExecutionContext>()`)
- 상세: Redis client·Redis store 관련 import/의존성이 해당 서비스에 전혀 없음을 확인했다(순수 in-memory `Map`). 주석이 주장하는 "Redis context store 를 두지 않는다"는 서술은 코드 사실과 일치한다 — 반대로 "코드에 없는 기능을 spec 이 요구한다"는 CRITICAL 패턴(구현 누락)의 우려는 해당 없음.
- 제안: 없음.

## 요약

target diff 는 코드 신 기능 추가가 아니라, 같은 커밋에서 함께 갱신된 `spec/5-system/4-execution-engine.md` 의 신규 `## Rationale` 두 항목("실행 컨텍스트 in-memory + DB durable — Redis context store 미채택", "Graceful Shutdown … under-count" 의 PR3 정정)을 코드 주석에 SoT 인용 형태로 동기화한 것이다. 두 변경 모두 (1) 기각된 대안을 재도입하지 않고, (2) `spec/0-overview.md` 의 상위 Redis/큐 아키텍처 Rationale 과 층위가 분리되어 충돌하지 않으며, (3) 과거 서술(미구현 Phase-1 Redis 설계, PR3 under-count 해소 예고)을 번복하는 사유가 spec Rationale 자체에 명시적으로 기록되어 있고, (4) `conventions/execution-context.md` 의 in-memory Map 라우팅 원칙과도 정합한다. Rationale 연속성 관점에서 결함이나 위반은 발견되지 않았다.

## 위험도

NONE
