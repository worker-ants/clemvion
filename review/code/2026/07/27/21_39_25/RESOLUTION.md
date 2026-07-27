# RESOLUTION — retry-turn 종결 terminal 가드 (2차 라운드)

`review/code/2026/07/27/21_39_25` — Critical 1 / Warning 4.

## 조치 항목

| SUMMARY # | 분류 | 조치 | 비고 |
|---|---|---|---|
| Critical #1 (requirement) | 코드 | 수정 | **내가 만든 회귀였다.** 1차 라운드에서 엔진 통합 테스트를 통과시키려 넣은 멱등 no-op 분기가, 상태만 같을 뿐 **이번 시도의 새 `error`/`finishedAt`/`durationMs` 를 조용히 버렸다** — WS 는 새 에러를 emit 하는데 REST 재조회는 최초 실패 메시지를 반환하고 소요시간도 축소 보고됐다. 무가드 `save()` 였던 이전 코드엔 없던 회귀다 |
| Warning #1 (concurrency) | plan 이관 | 코드 변경 없음 | 비원자 `spawnedRow` claim — 1차 라운드에서 이미 등재. **이 PR 이 겨냥한 레이스와 별개**이고 그쪽은 닫혔다 |
| Warning #2 (architecture) | plan 이관 | 코드 변경 없음 | `forwardRef` 근거 주석이 같은 파일 docstring 과 모순. 실제 순환 여부 확인이 선행이라 별도 범위 |
| Warning #3 (maintainability) | plan 이관 | 코드 변경 없음 | `finalizeGuarded` 의 파라미터 in-place 변이가 시그니처에 안 드러남 |
| Warning #4 (testing) | plan 이관 | 코드 변경 없음 | spec 헤더 주석의 delegator 서술 drift |
| INFO 전반 | 조치 불요 / plan | — | 선재 부채·의도된 트레이드오프 |

## Critical #1 수정 방식

상태 전이는 그대로 건너뛰되(같은 상태이므로 전이할 것이 없다) **lifecycle 컬럼만
관측한 상태를 조건으로 걸어 갱신**한다:

```
UPDATE execution SET error, finished_at, duration_ms
WHERE id = :id AND status = :관측한_상태
```

그 사이 동시 cancel 이 상태를 바꿨다면 0행 매칭으로 조용히 무효화되므로, 이 PR 이 닫은
lost-update 보호를 깨지 않으면서 데이터 유실만 해소한다.

회귀 테스트: 멱등 분기에서도 `set` 에 이번 시도의 `error` 가 실리고, `andWhere` 로
관측한 상태가 조건에 걸리는지 단언.

## TEST 결과

- lint  : 통과
- unit  : 통과 (execution-engine 41 suite / 1,101)
- build : 통과
- e2e   : 통과 (260 passed)

## 보류·후속 항목

`plan/in-progress/retry-turn-terminal-guard.md` "후속(본 PR 밖)" 절에 등재.
