# 테스트(Testing) 리뷰 — retry_last_turn 2차 claim 삽입 위치 결함 수정 (6R 후속)

대상 커밋: `414550a1d` (`fix(engine): retry_last_turn 2차 claim의 삽입 위치 결함 2건 — 살아있는
delivery 오판·jsonb 부활 차단`), 직전 `b351731f0` 대비 diff.

검증 방법: `git diff HEAD~1..HEAD` 로 실제 diff 범위 확정 + 전체 파일 정독 +
`retry-turn.service.spec.ts`/`execution-engine.service.spec.ts` 직접 실행(477/477 PASS
확인) + **신규 코드에 대한 독립 mutation 검증 1건 재현**(아래 참조, cp 절대경로 원복 후
diff 0 확인·재실행 477/477 GREEN 재확인) + `review/code/2026/07/28/20_32_57` (6R 원 리뷰)
및 그 `RESOLUTION.md` 대조.

## 발견사항

- **[WARNING]** 이번 커밋이 신설한 "claim 성공 + in-memory `_retryState` 부재" 방어 분기가
  어떤 테스트로도 독립 검증되지 않는다 — 실측 mutation 으로 확인.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:337-348`
    (`if (!retryState) { ...; return; }` 블록, `applyRetryLastTurn` 내부)
  - 상세: 이 블록은 `b351731f0`→`414550a1d` 리팩터로 **새로 생긴 분기**다(이전엔 이 판정이
    claim 보다 앞에 있어 FAILED 로 마킹했고, 이번 수정으로 판정은 남기되 claim 뒤로 옮기고
    동작을 "로그만 남기고 discard" 로 바꿨다). 코드 주석 자체가 "구조적으로 도달 불가능해야
    하는 방어 분기" 라고 명시하지만, 바로 그런 종류의 "확신에 찬 불가능 판단"이 이 파일의
    Critical #1 을 만든 원인이었다(claim 성공 후 try 진입 전 구간에서 BullMQ 기본 재시도만으로
    "불가능하다고 믿었던" 상태가 실제로 재현됐다). 이 블록을 통째로 제거해도(= 이전 동작처럼
    `retryState` 무관하게 그냥 통과) 회귀가 잡히지 않는지 직접 재현했다:
    1. `cp` 로 원본 백업.
    2. 337-348행(`if (!retryState) {...}` 전체)을 삭제.
    3. `npx jest retry-turn.service.spec.ts execution-engine.service.spec.ts` 실행 →
       **477/477 all GREEN** (41 + 436, 실패 0건).
    4. `cp` 로 원복 후 `diff` 로 원본과 완전 일치 확인, 재실행 477/477 GREEN 재확인.

    즉 "claim 이 성공했는데 in-memory 값이 없으면 FAILED 로 마킹하지 않고 조용히 버린다"는,
    이번 PR 이 명시적으로 지키려는 계약(Critical #1 재발 방지 그 자체)이 **테스트로 잠겨 있지
    않다**. 커밋 메시지가 주장하는 "mutation 5/5 RED" 표(`plan/in-progress/
    retry-turn-terminal-guard.md` 6R 섹션, `RESOLUTION.md` mutation 표)에도 이 분기를 겨냥한
    항목은 없다 — (a) claim 순서 원복, (b) delete 제거, (c) discard→FAILED 로 되돌림, (d)
    `status=:running` 제거, (e) `jsonb_exists` 제거 5건은 모두 다른 지점을 겨냥한다. 기존
    테스트 `(c)`(`retry-turn.service.spec.ts` 소스 파일 기준 약 443행 부근, `findOneBy` 가
    처음부터 `status:RUNNING + _retryState 없음` 을 반환하는 케이스)는 claim mock 을
    `affected:0` 로 세팅해 **`!claimed` 분기**만 정확히 겨냥하고 있어, "claim 성공(`affected:1`)
    인데 in-memory 값만 없는" 조합은 어느 테스트에도 존재하지 않는다.
  - 제안: `retry-turn.service.spec.ts` 의 `applyRetryLastTurn — early-exit guards` describe
    블록에 케이스 1개 추가 — `createQueryBuilder().execute()` 를 `{ affected: 1 }` 로 두고
    (claim 성공을 흉내), `makeSpawnedRow({ inputData: {} })` 처럼 in-memory `_retryState` 가
    없는 row 를 주입한 뒤, `this.logger.error` 호출(또는 관측 가능한 대체 신호) + `save()`
    미호출 + `status` 가 `FAILED` 로 바뀌지 않음을 단언한다. 이렇게 하면 이 분기가 "이론상
    불가능"이 아니라 "코드로 존재하는 한 계약"으로 고정된다 — 이 파일이 이미 6 라운드에 걸쳐
    배운 교훈(불가능하다고 믿은 상태가 실제로 발생)과 정확히 같은 종류의 위험이다.

## 검증 노트 (참고용 — 발견사항 아님)

- 6R 원 리뷰(`review/code/2026/07/28/20_32_57`)가 지적한 Critical #1/#2 는 이번 커밋에서
  코드·테스트 양쪽으로 정확히 수정됐음을 직접 확인했다:
  - Critical #1 — `claimSpawnedRetryRow` 호출이 "`_retryState` 부재 → FAILED" 판정보다
    앞으로 이동했고, 재작성된 테스트 `(c)`(`retry-turn.service.spec.ts`, "findOneBy 가
    처음부터 status:RUNNING + _retryState 없음... discard 하고 save() 를 호출하지 않는다")와
    신규 회귀 테스트("claim 성공 후 try 진입 전 구간에서 예외가 나면 FAILED 로 마킹하지 않고
    그대로 throw 한다")가 정확히 이 순서 반전과 재배달 안전성을 검증한다. 후자는 (1)
    `rehydrateContext` reject → 예외가 그대로 propagate 되고 `save()` 미호출 확인, (2) 동일
    spawned row 를 "이미 claim 된 흔적"(status RUNNING + inputData 키 없음)으로 fresh 조회하는
    재배달을 시뮬레이션해 claim 실패(discard)로 안전 종료됨을 같은 테스트 안에서 순차 검증 —
    이 파일이 고치는 정확한 동시성 시나리오를 서술적으로 잘 포착한다.
  - Critical #2 — `delete spawnedRow.inputData[RETRY_STATE_KEY]` 추가에 맞춰 테스트 `(d)`/`(e)`
    양쪽에 `expect((row.inputData as Record<string, unknown>)._retryState).toBeUndefined()`
    단언이 추가됐다. 이 delete 를 제거하는 mutation 을 걸면 이 두 단언만으로 RED 가 나는지
    직접 로직을 추적했다 — `row` 는 `save()` 에 전달되는 바로 그 객체 참조이므로 delete 가
    없으면 `_retryState` 가 여전히 남아 단언이 실패한다. `applyRetryLastTurn` 안에서
    `save(spawnedRow)` 를 호출하는 지점은 이 두 분기(execution not-found / node not-found)
    뿐이라 커버리지 공백이 없다.
  - WARNING #8(6R) — 실 handler/context 파이프라인을 구동하는 통합 스펙
    (`execution-engine.service.spec.ts`) 이 claim 실패 분기를 한 번도 실행하지 않던 갭도 이번
    커밋이 `retryClaimQb.execute = jest.fn().mockResolvedValueOnce({ affected: 0 })` 신규
    테스트로 닫았다. `retryClaimQb` 는 outer `beforeEach` 에서 매 테스트 새 객체로 재생성되므로
    (373-381행) 이 override 가 다른 테스트로 누수되지 않음을 소스에서 확인했다.
  - WARNING #1(6R, `affected ?? 0` 폴백 미검증)·WARNING #7(6R, 실 Postgres 동시성 e2e 부재)은
    이번 라운드에서도 여전히 미조치이나, `RESOLUTION.md` 처분표에 명시적으로 plan 이관되어
    있고(`retry-turn-terminal-guard.md` §코드 표 #3 범위 확장) 카운트에서도 정확히 제외돼
    있다 — 조용히 누락된 것이 아니라 의도적 defer.
- `retry-turn.service.spec.ts`(41/41) + `execution-engine.service.spec.ts`(436/436) 직접
  실행해 477/477 PASS 확인(리뷰 시점 재현, 커밋 메시지의 unit 결과와 일치).
- 테스트 격리: 두 describe 블록 모두 outer `beforeEach` 에서 mock 을 전부 새로 생성하고,
  `mkLiveExecution`/`makeSpawnedRow` 계열 헬퍼가 매 호출 새 객체를 반환해 테스트 간 공유
  mutable 상태 문제가 없음을 확인했다(과거 "vacuous 단언" 함정에 대한 이 프로젝트의 반복
  교훈과 정합).
- 재배달 시뮬레이션 테스트(`claim 성공 후 try 진입 전 구간에서 예외가 나면...`)가 하나의
  `it()` 안에서 두 번째 `applyRetryLastTurn` 호출로 "재배달"을 표현하는 구조는 다소 밀도가
  높지만, 두 호출이 하나의 연속된 동시성 시나리오(1차 delivery 실패 → 재배달)를 서술하는
  것이라 분리보다 현재 구조가 오히려 의도를 더 명확히 전달한다 — 가독성 문제로 보지 않는다.

## 요약

이번 커밋은 6R ai-review 가 발견한 Critical #1(claim 삽입 위치로 인한 살아있는 delivery
오판)·Critical #2(claim 이 지운 `_retryState` 의 jsonb 부활)를 코드와 테스트 양쪽에서 정확히
닫았다 — 재작성된 회귀 테스트가 정확히 그 시나리오(claim 성공 후 try 진입 전 예외 → 재배달
안전성, delete 를 통한 부활 차단)를 검증하고, 통합 스펙의 claim-실패 커버리지 공백(WARNING #8)
도 함께 메웠다. 직접 실행(477/477 PASS)과 독립 mutation 재현으로 이 회귀 테스트들이 실제로
동작함을 확인했다. 다만 이번 리팩터로 **새로 생긴** "claim 성공 + in-memory 값 부재" 방어
분기(337-348행)는 어떤 테스트도 겨냥하지 않아, 그 블록을 통째로 제거해도 477개 테스트 전부
GREEN 으로 남는 것을 직접 재현으로 확인했다 — 이 분기가 지키려는 계약("이론상 불가능한 상태
에서도 절대 FAILED 로 마킹하지 않는다")은 정확히 이 파일이 6라운드에 걸쳐 반복 학습한 것과
같은 성격의 리스크이므로, 케이스 1개 추가로 방어 심도를 확보할 가치가 있다. 그 외 알려진 갭
(affected 폴백 미검증, 실 Postgres 동시성 e2e 부재)은 조용히 묻힌 것이 아니라 plan 에 명시
이관돼 있어 문제 삼지 않는다.

## 위험도

LOW
