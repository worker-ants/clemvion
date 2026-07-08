# ai-review SUMMARY — external-interaction §5.2 `execution.replay_unavailable`

- 대상 diff: `codebase/backend/src/modules/external-interaction/{sse-adapter.service.ts, interaction-stream.controller.ts}` + 신규 `interaction-stream.controller.spec.ts` + `sse-adapter.service.spec.ts` + spec-sync 4문서.
- 방식: 직접 Agent fan-out (requirement / testing / concurrency+side-effect+scope). Workflow disk-write 갭 회피(직접 fan-out 신뢰 — memory).
- 라우터 skip 없음(3 reviewer 명시 선택). BLOCK: NO.

## 위험도: LOW (Critical 0)

## 발견 (Warning 3 / Info 다수)

| # | reviewer | sev | 요지 | 처리 |
|---|---|---|---|---|
| 1 | requirement | WARNING | `lastEventId` 정수 미검증 — 공개 `?lastEventId=5.5` → `+1` 이 정수 seq 와 안 맞아 연속 buffer 도 gap 오탐 | **FIX**: `subscribe` 에서 `Math.floor` 정규화 + 테스트 |
| 2 | concurrency | WARNING | gap 판정이 선두만 확인 — 중간 hole(`[6,7,9]`)을 놓쳐 silent drop 잔존 가능 | **FIX**: `replayable.every` 전구간 연속성 + 테스트 |
| 3 | testing | WARNING | seq=0 sentinel → `id:` 생략의 두 유닛 계약을 잇는 wiring 테스트 부재 | **FIX**: `writeSseFrame` 경유 wiring 테스트 추가 |
| 4 | concurrency | WARNING(잔여) | v1 single-instance 재시작 시 빈 buffer 를 "최신 수신"과 구분 불가 | **문서화**: §5.2 Rationale known-limitation(§R10 후속) |
| 5 | requirement | INFO | 신호 후 subscriber 는 live 유지 — 의도(REST seq=0 이라 재연결 근거 없음) | **문서화**: §5.2 Rationale "신호 후 연결 유지" |
| 6 | requirement | INFO | cap-drop 확장은 spec 과 atomic 정합(SPEC-DRIFT 아님) | no-op |
| — | testing | INFO | magic 1000 결합, 만료+cap 혼합 미테스트 | 저우선, 미조치 |

## 검증
- unit: external-interaction 196 pass (sse-adapter 19 = 신규 10 + 기존 9). writeSseFrame 3.
- lint/build: clean. e2e: PASS 243 tests (regression, exit 0).
- 동시성: Node run-to-completion — subscribe/handleEvent 모두 await 없음, race 없음(concurrency reviewer 확인). `.sort` 는 filter 후 새 배열이라 buffer mutate 없음.

BLOCK: NO
