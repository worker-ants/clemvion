# RESOLUTION — external-interaction §5.2 `execution.replay_unavailable`

SUMMARY 위험도 LOW, Critical 0. Warning 3건은 전부 코드 fix, 잔여 1건 + INFO 2건은 문서화. 처리 상세:

## FIX (코드)

1. **[W-1 정수 정규화]** `sse-adapter.service.ts` `subscribe()` — `replayOrSignalUnavailable` 호출 시 `Math.floor(lastEventId)` 로 정규화. 공개 `?lastEventId=` 로 소수/malformed 가 와도 `lastEventId+1` 이 정수 seq 와 정합해 연속 buffer gap 오탐 제거. 테스트: `소수 lastEventId 는 floor 로 정규화`.
2. **[W-2 전구간 연속성]** `replayOrSignalUnavailable` `contiguous` 판정에 `replayable.every((e,i)=> i===0 || e.seq===replayable[i-1].seq+1)` 추가. 선두만 보던 판정이 배열 중간 hole(예: seq 3 유실 `[1,2,4]`)도 gap 으로 잡아 silent drop 잔존 제거. 테스트: `배열 중간 hole(seq 유실) 도 gap 으로 판정`.
3. **[W-3 wiring 테스트]** `sse-adapter.service.spec.ts` 에 `seq=0` replay_unavailable 이벤트를 실제 `writeSseFrame` 로 직렬화해 프레임에 `event: execution.replay_unavailable` 는 있고 `id:` 라인은 없음을 확인하는 wiring 테스트 추가 — 두 유닛(sentinel 생성 ↔ id 생략) 계약 드리프트 방어.

## 문서화 (spec)

4. **[W-4 잔여]** `14-external-interaction-api.md` Rationale R-replay-unavailable 에 **known limitation (v1 single-instance)** 명시 — 재시작 시 in-memory buffer 소실로 빈 buffer 를 "최신 수신"과 구분 불가. 지속·분산 버퍼는 §R10 후속.
5. **[I-5]** 동 Rationale 에 **신호 후 연결 유지** 명시 — REST `getStatus` seq=0 placeholder 라 재연결 근거 없음 → 병행 보정이 유일 흐름.

## 미조치 (저우선 INFO)
- magic 1000 상수 테스트 결합, 만료+cap 혼합 케이스 미테스트 — 회귀 안전(값 변경 시 fail-safe), 별도 조치 안 함.
- controller `stream()` 핸들러 전체 e2e 커버리지(pre-existing gap) — SSE 스트림 실연결 e2e 는 gap 트리거(5분 만료/1000 flood) 비현실적, 순수 로직은 unit 완비. 잔여로 남김.

## 재검증
- unit: external-interaction 196 pass, sse-adapter 19 pass, lint clean, build clean.
- (fix 는 additive-safety — 기존 통과 테스트 회귀 없음.)

## 최종 확인 (커밋 후, 2026-07-08)
- **fresh delta review**(post-resolution, requirement-reviewer): floor 정규화·전구간 every 두 fix 재검토 → **NONE** (음수 사전 차단·정수 불변·false-positive 부재 trace + jest 19/19 실행 확인).
- **fresh consistency**(rationale-continuity + cross-spec): won't-do·replay 배지 반영 CRITICAL 0. dangling Planned 참조(2-api-convention·4-execution-engine·EIA 매핑표) spec-only 동기 완료.
- 커밋 `d5f50503a` 의 codebase 4파일은 본 review(12_14_58) **이전에** 최종 편집됨(mtime 확인) — 리뷰 후 코드 무변경. Stop-hook 의 "code changed after review" 는 commit-time > review-dir-time 오탐(review_guard_push_timestamp 클래스).
- **TEST WORKFLOW 재수행(커밋 코드 기준)**: lint clean · unit(external-interaction 196) · build clean. e2e 243 은 byte-identical 커밋 코드에서 통과(변경 없음). BLOCK: NO.
