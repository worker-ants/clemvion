# Cross-Spec 일관성 검토 — cross_spec

## 검토 범위 재확인

prompt payload 는 컨텍스트 예산 초과로 target 문서 본문·`git diff` 인용이 전부 생략되어 있었다. 대신 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`, HEAD `6570ca3bb`)에서 직접 `git diff origin/main...HEAD`(merge-base `9a4d3e32b` = origin/main) 를 실행해 실제 변경 범위를 확인했다.

실제 diff(5 파일, +254/-37, 전부 `codebase/backend/`):

- `execution-engine/execution-engine.service.ts` (+15) — `admitExecutionOrDefer` 의 `UPDATE ... RETURNING` 결과가 배열이 아니면 `throw`(트랜잭션 롤백 보존). 판정 로직 자체는 불변, 진단/방어만 추가.
- `execution-engine/execution-engine.service.spec.ts` (+33) — 위 가드에 대응하는 신규 테스트 1건.
- `executions/executions.service.ts` (+1/-1) — 기존 내부 상수 `SNAPSHOT_CACHE_MAX_ENTRIES`(종결 상태 execution `findById` LRU 캐시 상한, 256)에 `export` 키워드만 추가. 값·동작·키 스코프(execution ID 단위) 불변.
- `executions/executions.service.spec.ts` (+59) — 위 상수를 이용한 LRU 상한·evict 방향 테스트 2건.
- `chat-channel/chat-channel.dispatcher.spec.ts` (+182, net) — 순수 테스트 리팩터(공통 harness 추출) + 기존 동작(`toChatChannelEvent` null 의 debug/warn 로그 레벨 분기)을 검증하는 신규 테스트 2건. `chat-channel.dispatcher.ts` 본체는 diff 에 없음(동작 변경 없음).

`spec/5-system/**` 자체에는 이번 diff 범위(`origin/main...HEAD`) 에 변경이 없다 — R8 idempotency-key 캐시 스코프 관련 spec 변경(#1156/#1154/#1160/#1162/#1166 등)은 이미 `origin/main`(=merge-base)에 병합 완료된 상태였다.

## 발견사항

이번 diff 범위에서 CRITICAL/WARNING 급 cross-spec 충돌은 발견되지 않았다. 확인한 근거는 다음과 같다.

- **`SNAPSHOT_CACHE_MAX_ENTRIES` 캐시와 EIA §R8 idempotency 캐시는 별개 개념이다** — task 이름("eia-r8-cache-scope")과 표면적 유사성 때문에 동일 캐시로 오인하기 쉬우나, 전자는 `ExecutionsService.findById` 결과의 execution-ID 키 인스턴스 로컬 LRU(종결 상태 전용)이고, 후자는 `interaction:idempotency:<executionId>:<route>:<key>` Redis 캐시(`spec/5-system/14-external-interaction-api.md` §R8, `spec/data-flow/15-external-interaction.md` L260)다. 이번 diff 는 후자를 전혀 건드리지 않았고, 전자의 키 스코프도 export 추가 외 변경이 없다 — 두 캐시 간 스코프 혼선 없음.
- **`admitExecutionOrDefer` 신규 throw 는 HTTP 계약과 무관** — 호출부가 `runExecutionFromQueue`(BullMQ job consumer, `execution-run` 큐)이며 HTTP 요청 처리 경로가 아니다. 따라서 `spec/5-system/3-error-handling.md` 의 HTTP status 매핑이나 EIA API 계약에 새 미문서화 상태코드를 발생시키지 않는다. 판정("이 UPDATE 가 admit 됐는가")도 바꾸지 않고 실패 시 트랜잭션을 롤백해 §8(`spec/5-system/4-execution-engine.md` L1701 "조건부 UPDATE(RETURNING)로 카운트→비교→전이")가 이미 전제하는 원자성 불변식을 오히려 더 엄격히 보존한다.
- **`executions.service.ts` 주석의 "sticky session WS 배포" 전제는 기존 spec 과 정합** — `spec/5-system/6-websocket-protocol.md` L906 이 이미 "소켓은 인스턴스 상주(sticky) 전제라 Redis 불요"를 명시하고 있어, 이번 코드 주석이 새로 도입한 미문서화 아키텍처 가정이 아니다. 또한 `spec/5-system/4-execution-engine.md` §4.3(L901) "운영 토폴로지에 따른 분기는 없다"는 실행 엔진의 정합성 메커니즘(원자 claim 등)에 대한 진술이고, 이번 캐시는 성능(hit ratio) 전용이라 miss 시 정상 DB fallback 이므로 그 불변식과 상충하지 않는다.
- **`chat-channel.dispatcher.spec.ts` 변경은 순수 테스트** — 대상 소스(`chat-channel.dispatcher.ts`)에 diff 가 없어 새 동작/계약이 생기지 않았다. `spec/5-system/15-chat-channel.md`(R8 "Fan-out facade 의 분리")·`spec/data-flow/14-chat-channel.md` 어느 쪽과도 충돌 여지가 없다.

## R8 식별자 중복에 대한 참고 (INFO, 이번 diff 기인 아님)

`spec/5-system/14-external-interaction-api.md`(§R8 "Idempotency-Key 와 `submit_form` 검증 실패의 관계")와 `spec/5-system/15-chat-channel.md`(R8 "Fan-out facade 의 분리 — per-trigger listener 정책")는 서로 다른 두 결정에 같은 로컬 레이블 `R8` 을 쓴다. 각 문서의 `## Rationale` 섹션이 파일 단위로 R1..Rn 을 독립적으로 번호 매기는 기존 컨벤션이며, cross-reference 는 관찰된 범위에서 전부 `[Spec EIA §R8]` / `(R8 §v1 구조)` 처럼 문서명을 동반해 모호성이 실질적으로 없었다. 이번 diff 와 무관하고 신규 결정도 아니므로 INFO 로만 기록 — 액션 불필요.

## 요약

이번 라운드의 실제 diff(`origin/main...HEAD`)는 execution 엔진 admission-gate 방어 강화(트랜잭션 롤백 불변식 보존), 기존 인스턴스-로컬 스냅샷 캐시 상수의 테스트 가시성 export, 그리고 chat-channel dispatcher 로그 레벨 분기에 대한 순수 테스트 보강으로 구성된 소규모 변경이다. `spec/5-system/**` 본문 변경은 없으며, EIA §R8 idempotency 캐시·§8 admission gate·§6 WS sticky-session 전제 등 인접 spec 영역과 대조한 결과 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 직접적 모순을 찾지 못했다. task 이름이 시사하는 "R8 캐시 스코프"와 실제로 변경된 `SNAPSHOT_CACHE_MAX_ENTRIES` 는 서로 다른 캐시이므로 혼동하지 않도록 위에 명시했다.

## 위험도
NONE
