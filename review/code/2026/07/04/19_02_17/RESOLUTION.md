# RESOLUTION — priority 3-tier triggerType threading ai-review

세션: `review/code/2026/07/04/19_02_17` · 대상: `1eefcca12`

## 조치 항목

| # | reviewer / 등급 | 파일:라인 | 조치 | fix commit |
| --- | --- | --- | --- | --- |
| W1 | maintainability / WARNING | `execution-engine.service.ts:3245` | 2줄 주석 merge-artifact — 매달린 `webhook` 조각 제거, `priority 3-tier(§4.3):` 단일 문단화 | (본 RESOLUTION 커밋) |
| W2 | documentation / WARNING | `spec/5-system/4-execution-engine.md:1090` | §8 본문 "3-tier 스코프 아님/2-tier 유지" → "구현 완료(manual>webhook>schedule, executedBy 우선, §4.3)" | (동일) |
| W3 | documentation / WARNING | `spec/data-flow/3-execution.md:68` | 옛 2-tier "PR2 threading 후속" → triggerType threading 구현 완료 서술 | (동일) |
| W4 | documentation / WARNING | `spec/data-flow/10-triggers.md:182` | 큐 카탈로그 표 동일 stale 서술 → 구현 완료 서술 | (동일) |
| I5 | documentation / INFO | `plan/in-progress/exec-intake-followups.md:13` | priority 3-tier 항목 `[x]` 체크 + 완료 요약 | (동일) |

### 미조치(기록) INFO

- **env-var 표 `(PR2)`** (`4-execution-engine.md:1246`) — 동시성 cap PR 라벨(priority 3-tier 무관). scope creep 회피로 유지.
- **fallback 비대칭** (`execute()` `?? 'webhook'` vs `resolveExecutionRunPriority` 내부 `undefined→schedule`) — `execute()` 가 유일 호출자·항상 resolved 값 전달 → dead path. 기능 영향 0. 유지.
- **discriminated union 컴파일 강제 한계** — `triggerId` variant `triggerType` 타입이 JSDoc(‘webhook’/‘schedule’)보다 넓음. 3 호출부 안전 리터럴 + JSDoc 경계로 완화. 유지.
- **테스트명 `(PR2)` / XFF chat-channel 테스트 미assert** — 무해·형제 테스트 커버. 유지.

## TEST 결과 (조치 후 재수행)

- lint: 통과 (42s)
- unit: 통과 (affected 48)
- build: 통과 (105s)
- e2e: 통과 (230) — 첫 시도는 Docker VM 디스크 100%(`initdb pg_wal: No space left`)로 인프라 FAIL → `docker builder prune -af`(44GB 회수) 후 재수행 PASS. 코드 무관.

## 보류·후속 항목

없음. (INFO 잔여는 위 "미조치(기록)" 로 판정 종결 — 별도 plan 이관 불요.)
