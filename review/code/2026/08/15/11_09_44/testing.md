STATUS=success

===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (6차 라운드)

## 방법론 노트

프롬프트 번들에서 diff 가 생략된 파일(`execution-engine.service.spec.ts`/`.ts`,
`plan/in-progress/*.md`)은 `git diff origin/main -- <path>` 로 전문을 직접 열어 대조했다.
이 PR 은 이미 다섯 차례 ai-review 를 거쳤고(`09_58_24`/`10_18_38`/`10_34_51`/`10_52_08`),
각 라운드의 `testing.md`/`RESOLUTION.md` 를 먼저 읽어 (a) 이전 라운드가 지적하고 이번
diff 에 실제로 반영된 항목, (b) 근거와 함께 명시적으로 이월된 항목, (c) 아직 아무도 못 본
지점을 구분했다.

## 발견사항

- **[WARNING]** raw-UPDATE 5경로 중 `markQueueWaitTimeout` 은 **직접 실행하는 단위 테스트가
  전무**하고, `markWebChatIdleTimeout` 은 직접 호출은 되지만 emit 단언이 `objectContaining`
  이라 `durationMs` 값 threading 이 검증되지 않는다 — 3개 라운드 연속 이월, 이번 라운드도 미조치
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2884`
    (`markQueueWaitTimeout` 정의) / `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:3030-3061`
    (`markWebChatIdleTimeout` 테스트, emit 단언은 3054-3061 `objectContaining`)
  - 상세: `markQueueWaitTimeout` 을 호출하는 유일한 테스트(`execution-engine.service.spec.ts:5112`
    `admission cancelled → runExecution 미호출...`)는 `admitExecutionOrDefer` 자체를
    `jest.spyOn(...).mockResolvedValue('cancelled')` 로 스텁해 실제로는 `markQueueWaitTimeout`
    본문이 한 번도 실행되지 않는다(주석 자신도 "admit stub 이라 미호출" 이라고 명시). 이
    경로는 `TERMINAL_DURATION_MS_SQL` + `RETURNING` + `toFiniteNumber` 추출 + `emitCancellationEvent`
    까지 이어지는 이 PR 의 신규 로직 전부를 한 번도 실행하지 않고 머지된다. 게다가 이
    경로의 `durationMs` 는 다른 4경로와 의미가 다르다 — **실행 시간이 아니라 큐 대기
    시간**이다(코드 주석·CHANGELOG 가 명시). 의미가 다른 만큼 계산식이 잘못 배선돼도(예:
    `started_at` 대신 다른 컬럼을 참조) 이 사실을 알아챌 안전망이 전혀 없다. `markWebChatIdleTimeout`
    도 직접 호출은 되지만 `objectContaining` 이 `durationMs` 키를 아예 검사하지 않아 같은
    사각지대가 있다. 이 클래스의 결함(SQL 클램프 부재)이 실제로 이 PR 자체에서 **테스트가
    아니라 리뷰로만** 잡혔던 전례가 있다(`10_18_38` CRITICAL, `int4 out of range`) —
    "리뷰가 못 보면 아무도 못 본다" 는 위험이 실증된 자리인데, 정작 durationMs 도입 이후
    이 두 경로만 여전히 그 상태다. `09_58_24`/`10_18_38`/`10_34_51` 세 라운드가 동일하게
    지적했고 매번 "대표 2경로(`cancelParkedExecution`/`finalizeStalledExhausted`)가 null-분기·
    숫자-분기를 각각 정확 매칭으로 고정해 추출 패턴은 검증됨" 이라는 근거로 이월됐다 — 그
    근거 자체는 타당하지만(추출 로직 5곳이 문자 그대로 동일 패턴), **`markQueueWaitTimeout`
    의 "의미가 다른 값" 이라는 속성은 대표 2경로로 대체 증명되지 않는다**. 또한 이 항목은
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 자기 몫의 체크박스가
    없다(인접한 W10 은 "SQL 이 실제 Postgres 값 수준으로 검증된 적 없다"는 별개 항목 —
    이건 unit 배선 문제, W10 은 e2e 값 문제).
  - 제안: 최소 `markQueueWaitTimeout` 1건만이라도 직접 호출하는 단위 테스트를 추가(다른
    4경로와 동형 패턴 — `mkQb`/`installTx` 재사용 가능)해 `queued_at` 초과 → cancel →
    `emitCancellationEvent` 에 `durationMs: <RETURNING 값>` 이 실리는지 정확 매칭으로 고정할
    것. `markWebChatIdleTimeout` 도 기존 `objectContaining` 에 `durationMs` 키를 추가하는
    것만으로 충분(비용 낮음). 두 항목 다 review 산출물에만 3라운드째 남아있으므로
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 독립 체크박스로
    옮겨 적을 것을 권한다(review/** 는 SoT 가 아니라 다음 세션이 유실할 수 있다).

- **[WARNING]** 테스트 제목이 실제보다 넓은 커버리지를 주장한다 — "NaN/Infinity" 인데
  `Infinity` 입력 케이스가 없다 (`10_52_08` INFO5 로 이미 지적, "다음 편집 때 우선 처리"라고
  명시했으나 이번 편집에도 미반영)
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.spec.ts:65`
    (`it('durationMs 가 NaN/Infinity 면 계산으로 폴백한다', ...)`)
  - 상세: 테스트 본문은 `durationMs: Number.NaN` 한 가지 입력만 검사한다(:68). `Number.POSITIVE_INFINITY`
    를 `durationMs` 로 주는 케이스는 이 파일 어디에도 없다. 함수 자체(`Number.isFinite` 가드)는
    Infinity 도 NaN 과 동일하게 계산 폴백으로 처리하므로 동작은 맞을 것으로 보이지만, 제목이
    주장하는 커버리지와 실제 assertion 사이에 괴리가 있다 — 이 세션이 반복 지적해 온
    "GREEN 이 증거가 아니다" 패턴(제목이 실제보다 넓은 커버리지를 주장)의 재발이다.
  - 제안: `it.each([['NaN', Number.NaN], ['Infinity', Number.POSITIVE_INFINITY]])` 로
    바꾸거나 Infinity 케이스를 별도 `it` 으로 추가. 5분 미만 작업.

- **[INFO]** `cancelParkedExecution` 의 `durationMs: null` 단언(1건)은 raw UPDATE 가 **항상
  빈 결과**(`{ affected }`, `raw` 자체가 `undefined`)인 mock 경로만 검증한다 — 이 함수 자체에
  대해서는 "SQL 이 실제로 숫자를 돌려줄 때 그 값이 emit 까지 흐르는" 성공 분기가 검증되지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:3160-3168`
    (`makeCancelQb` — `execute` mock 이 `raw` 를 아예 안 줌) / `:3207-3213`
    (`durationMs: null` 단언)
  - 상세: 숫자-분기(RETURNING 이 실제 `duration_ms` 를 주는 경우)는 `finalizeStalledExhausted`
    (`:4822-4828`, `duration_ms: 4242`)가 대표로 검증한다. 추출 로직(`toFiniteNumber(...) ?? null`)
    자체는 5경로 전부 문자 그대로 동일한 한 줄이라 대표 검증으로 패턴이 충분히 실증됐다는
    점은 이전 라운드(`10_34_51`)의 판단에 동의한다 — 재차단 사유는 아니다. 다만 `cancelParkedExecution`
    은 숫자 성공 분기 자체가 이 함수 기준으로는 전무하다는 사실만 기록해 둔다.
  - 제안: 조치 불필요(이번 라운드). 위 WARNING 항목을 처리할 때 `makeCancelQb` 에
    `raw: affected > 0 ? [{ duration_ms: N }] : []` 형태로 바꾸면 겸사겸사 닫힌다.

- **[INFO]** `resolveTerminalDurationMs` 의 "이미 계산된 값(음수 포함) 신뢰" 분기에 음수
  캐너리 테스트 부재 (`10_34_51` 재확인, "강제 아님"으로 명시된 채 여전히 미반영)
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:33-35`
    (이미 유한수인 `row.durationMs` 는 부호 검사 없이 그대로 반환) — 테스트:
    `codebase/backend/src/shared/utils/terminal-duration.spec.ts:12-21` (양수 `999` 만)
  - 제안: 낮은 우선순위. 강제 아님(이전 라운드 판단 유지).

## 잘 된 점 (재확인)

- **`chat-channel.dispatcher.spec.ts` 회귀 테스트 신규 추가**(`durationMs 전파` describe,
  3종 상태 × 숫자/`null`/레거시 키부재)로 `10_34_51` 라운드가 MEDIUM 위험으로 지목한
  "외부 wire 변환 경계에 회귀 테스트가 없다" 는 핵심 지적이 실제로 해소됐다 — `it.each` 3종
  상태가 각각 숫자를 그대로 싣는지, `null`/키 부재를 올바르게 구분하는지 정확 매칭으로 고정.
- **`markExecutionCancelled`/`driveCallStackResume`** 의 `durationMs` 정확 매칭 단언이
  이번 diff 에 실제로 추가됨(`10_52_08` W1/W2 조치 확인) — mock 이 이미 주고 있던
  `raw: [{ duration_ms: 1234 }]` 값을 emit 단언에서도 검사하도록 고쳤다.
- **`terminal-duration.spec.ts`**(신규, 8 `describe`/25 케이스)는 순수 함수 단위 테스트의
  모범 사례를 유지한다 — 이미 계산된 값 보존, `startedAt`/`finishedAt` 각각·둘 다 부재·`null`
  (`it.each` 4-fixture), non-`Date` 값, `Invalid Date`, 시계 역행(음수)→`null`, `0`
  (falsy 아님, `??` vs `||` 회귀 명시 주석), pg 드라이버 문자열 bigint/numeric
  (`toFiniteNumber`)까지 촘촘하다. 12-21행 `it.each` 는 "이 PR 이 실제로 겪은 회귀"
  (조건 밖 계산이 throw 해 종결 emit 자체가 사라짐)를 재현하는 정확한 회귀 테스트다.
  `TERMINAL_DURATION_MS_SQL` 상수 테스트도 `LEAST(2147483647` 클램프·`GREATEST(0` 부재
  (음수 sentinel 통일)를 문자열 수준에서 고정한다.
- `retry-turn.service.spec.ts` 의 4곳 `durationMs: expect.any(Number)`는 헬퍼 레벨에서
  이미 촘촘히 검증된 null/NaN 분기와 결합해 적절한 수준의 wiring 검증이다 — fixture 의
  `startedAt`(`Date.now() - 60_000` 등)이 실제 `Date` 라 계산 분기를 실제로 태운다(사전에
  숫자를 박아 넣어 검증을 우회하는 형태가 아님).
- `execution-engine.service.ts` 의 `finalizeStalledExhausted` 테스트는 `raw` 원본 행이
  **snake_case**(`duration_ms`)로 온다는 드라이버 실제 shape 를 mock 에 정확히 반영했다
  (`#1168` 에서 배운 형태를 재사용) — mock 이 현실과 다른 shape 를 인코딩해 GREEN 이
  아무것도 증명하지 않는 부류의 결함이 아니다.
- 테스트 mock 확장(`setParameter`/`returning` 추가) 범위가 실제 프로덕션 호출 지점보다
  넓어 보이지만, 이는 `mockExecutionRepo.createQueryBuilder` 파일 전역 default mock 을
  공유하는 기존 구조에서 비롯된 필연적 파급이며 scope 이탈이 아니다(이전 라운드
  `scope.md` 실측과 일치, 이번 라운드에서도 재확인).

## 요약

핵심 신규 로직(`resolveTerminalDurationMs`/`toFiniteNumber`/`TERMINAL_DURATION_MS_SQL`)의
단위 테스트는 다섯 라운드를 거치며 이미 매우 탄탄하고, 이번 라운드에서 CRITICAL 급 결함은
발견되지 않았다. 이전 라운드가 MEDIUM 으로 지목했던 `chat-channel.dispatcher` 회귀 테스트
부재와 `markExecutionCancelled`/`driveCallStackResume` 의 미이행 단언은 이번 diff 에서
실제로 해소됐다 — 리뷰 사이클이 수렴 방향으로 작동하고 있다. 다만 raw-UPDATE 5경로 중
`markQueueWaitTimeout`(직접 호출 테스트 0건, 게다가 이 경로만 `durationMs` 의미가 "실행
시간"이 아니라 "큐 대기 시간"이라 대표 경로 검증으로 대체 증명되지 않는다)과
`markWebChatIdleTimeout`(직접 호출은 되나 `durationMs` 미단언)은 세 라운드째 같은 형태로
남아있고, `plan/` 트래커에 독립 항목으로 옮겨지지 않아 review 산출물에만 존재해 유실
위험이 있다. 테스트 제목이 실제 커버리지보다 넓게 주장하는 문제(`NaN/Infinity` 제목에
`Infinity` 미검증)도 직전 라운드가 "다음 편집 때 처리"라고 명시했음에도 이번 편집에
반영되지 않았다. 둘 다 비용이 낮고(각 1건 assertion 추가) 이 PR 이 스스로 세운 "리뷰로만
잡힌 결함은 비용을 실증한다"는 교훈과 정확히 같은 형태의 잔여 리스크라 WARNING 으로
유지한다.

## 위험도

LOW
