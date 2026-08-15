STATUS=success

===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (재확인 라운드)

## 방법론 노트

이 PR 은 이미 `09_58_24` → `10_18_38` → `10_34_51` → `10_52_07/08` → `11_09_44` → `11_29_02` →
`11_44_10` → `11_59_09` → `12_26_36` 로 최소 9라운드의 테스트 리뷰·RESOLUTION 사이클을 거쳤다.
프롬프트 diff 는 `execution-engine.service.ts`/`.spec.ts`·`terminal-duration.*` 등 다수 파일이
크기 제한으로 생략돼 있어, `Read`/`Bash`/`grep` 으로 저장소를 직접 열어 대조했다. 직전 라운드
(`12_26_36`)가 잡은 WARNING(`markExecutionCancelled` affected=0 테스트의 vacuous mock)이 그
RESOLUTION(`67ad84a54`)에서 실제로 고쳐졌는지 소스 레벨로 재확인했고, 이번 라운드가 다루는
파일들을 실제로 `jest` 실행해 결과를 확인했다.

```
npx jest execution-engine.service.spec.ts retry-turn.service.spec.ts dashboard.service.spec.ts \
  statistics.service.spec.ts chat-channel.dispatcher.spec.ts terminal-duration.spec.ts \
  executions.service.spec.ts
→ Test Suites: 7 passed, 7 total / Tests: 614 passed, 614 total
```

## 발견사항

- **[INFO]** `retry-turn.service.spec.ts` 의 완료/취소 emit 단언 4곳이 `durationMs` 값을
  `expect.any(Number)` 로만 확인한다 — 타입만 검증하고 실제 산출값(부호·계산식)은 검증하지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:691`,
    `:727`, `:858`, `:894`
  - 상세: `resolveTerminalDurationMs(execution)` 가 어떤 이유로든 (예: 잘못된 인자, 항상 `0`
    반환, `NaN`) 오작동해도 `expect.any(Number)` 는 여전히 통과한다 — `NaN` 도
    `typeof NaN === 'number'` 라 통과한다. 다만 같은 파일의 인접 테스트
    (`:1104-1116`, `:1187` 부근 `completeRetryExecution`/`failRetryExecution` 케이스)는
    `setArg.durationMs === setArg.finishedAt.getTime() - execArg.startedAt.getTime()` 관계식으로
    실값을 고정하는 더 강한 패턴을 이미 쓰고 있어, 남은 4곳만 상대적으로 약하다. 이 항목은
    `10_18_38`→`12_26_36` 라운드 전체가 반복 확인·수용한 것과 동일한 판단이며(헬퍼 자체가
    `terminal-duration.spec.ts` 25 케이스로 두텁게 커버), 이번 라운드도 재확인 결과 이견 없음 —
    실질 위험은 낮다.
  - 제안: 우선순위 낮음. 다음 편집 시 `expect.any(Number)` 4곳도 `:1104` 패턴(관계식 비교)으로
    올리면 층위 간 방어가 균일해진다.

- **[INFO]** `retry-turn` 재진입 시 DB(COALESCE 로 보존된 T1)와 emit(재계산된 T2)의
  `durationMs` 가 어긋나는 알려진 갭에 emit 값 자체를 단언하는 회귀 테스트가 없다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:1235`
    (`'finishedAt/durationMs 는 COALESCE 로 보존하고 error 는 SET 절에서 제외한다'`)
  - 상세: 이 테스트는 DB 쪽 `SET` 절이 `COALESCE(duration_ms, :newDurationMs)` 형태인지(SQL 형태)만
    확인하고, 같은 시나리오에서 실제로 emit 되는 `EXECUTION_CANCELLED` payload 의 `durationMs`
    값(재계산된 T2 — DB 에 영속된 T1 과 다를 수 있음)은 단언하지 않는다. 이 불일치 자체는 이 PR 이
    새로 만든 게 아니라 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` §"retry-turn
    재진입 시 DB 와 emit 의 `durationMs` 가 어긋난다"(`10_34_51` W1)에 **의도적으로 미수정·등재**된
    상태이므로, 지금 회귀 테스트가 없는 것 자체는 기대된 상태다(고칠 계획이 없는 버그의 "정상 동작"을
    캐너리로 고정하면 나중에 실제로 고칠 때 오히려 그 테스트를 지워야 한다). 다만 트래커 항목이
    닫힐 때 이 gap 도 함께 검증돼야 하므로 기록 목적으로 남긴다.
  - 제안: 조치 불필요(트래커에 이미 등재). 해당 트래커 항목을 나중에 닫을 때 "DB 값 == emit 값"
    관계식 테스트를 함께 추가할 것.

- **[INFO]** `finalizeCancelledExecution`(엔티티 로드 경로)에 `durationMs` 전용 exact-match
  emit 단언이 없다 — 4개 raw-SQL 자매 경로와 비대칭
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4876` 부근
  - 상세: `cancelParkedExecution`/`markWebChatIdleTimeout`/`markExecutionCancelled`/
    `markQueueWaitTimeout`/`finalizeStalledExhausted` 5개 raw-UPDATE 경로는 전부 `RETURNING` mock 값과
    emit 값을 정확 매칭(`4242`/`600000`/`3600000`/`7200000`/`1234`)으로 고정했는데,
    `finalizeCancelledExecution` 은 `expect.any(Number)` 수준에 머문다. `12_26_36` 라운드가 이미
    같은 항목을 INFO 로 확인했고(헬퍼 자체가 두텁게 커버돼 실질 위험 낮음), 이번 라운드도 재확인
    결과 이견 없음.
  - 제안: 우선순위 낮음.

## 확인됨 — 직전 라운드(`12_26_36`) WARNING 이 실제로 정정됨

- `markExecutionCancelled: affected=0 (이미 처리됨) 이면 EXECUTION_CANCELLED emit 억제` 테스트
  (`execution-engine.service.spec.ts:15019`)의 로컬 mock 체인(`:15052-15068`)에
  `setParameter`/`returning` 이 이제 존재하고 `mockReturnValue(chain)` 으로 정상 체이닝된다 —
  `.setParameter is not a function` 으로 인한 조기 catch-흡수(가드 미실행) 문제가 해소됐음을
  소스 레벨로 재확인했다.
- `admitExecutionOrDefer`(`execution-engine.service.ts:2886` `markQueueWaitTimeout` 포함) 경로도
  `execution-engine.service.spec.ts:4543` 테스트가 `duration_ms: 600000` RETURNING 값과 emit 을
  정확 매칭한다 — 이 경로는 자신만의 의미(큐 대기 시간)라 다른 4경로로 대체 증명이 안 되는데도
  실제 함수 본문을 태워서 검증한다(caller 쪽 stub 과 별개로 이 describe 블록은 real invocation).

## 그 외 확인 (문제 없음)

- `terminal-duration.spec.ts`: 25 케이스로 기존값 우선·계산 폴백·`startedAt`/`finishedAt` 각각·둘 다
  부재·Date 아닌 값·Invalid Date·시계 역행 음수·int4 상한 saturate·`NaN`/`Infinity` 폴백·`0`
  falsy 오판 방지까지 경계값을 촘촘히 고정 — 갭 없음.
- `chat-channel.dispatcher.spec.ts` 신규 `durationMs 전파` describe: `completed`/`failed`/`cancelled`
  × 숫자·`null`·키 부재(레거시) 조합을 `it.each` 로 고정, `%s` 타이틀이 `status` 를 찍어 세 케이스가
  서로 다른 이름으로 구분됨(직전 라운드가 지적한 타이틀 충돌 재발 없음).
- `dashboard.service.spec.ts`/`statistics.service.spec.ts` 의 "completed 만 센다" 가드: `setup()`
  이 매 테스트 새 mock/인스턴스를 만들어 테스트 간 격리가 유지되고(`dashboard.service.spec.ts:54-69`,
  `statistics.service.spec.ts:19-65`), statistics 쪽은 "두 집계 메서드를 모두 호출해야 각자의 필터
  누락을 잡는다"는 함정을 주석으로 명시하고 실제로 둘 다 호출한다(`statistics.service.spec.ts:72-73`).
  mock 이 SQL 을 실행하지 않아 필터 존재 유무만 검증한다는 한계는 트래커에 이미 등재됨.
- `executions.service.spec.ts` int4 클램프 회귀 테스트(`:774-800`): `stop()` 이 사용하는 것은 raw SQL
  이 아니라 JS 계산(`resolveTerminalDurationMs` 직접 호출) 이므로 mock 체인에 `setParameter`/
  `returning` 이 없어도 정상 — production 코드(`executions.service.ts:796-808`)와 대조해 vacuous
  아님을 확인. `set.mock.calls[0][0].durationMs === PG_INT4_MAX` 로 saturate 값을 정확히 고정.
- 이번 대상 spec 7개 파일 전체 실행 결과 **614/614 통과**, 콘솔 에러 없음(직전 라운드가 잡았던
  `.setParameter is not a function` 로그도 재현되지 않음).

## 요약

이 PR 은 9라운드 이상의 반복 리뷰를 거치며 "vacuous mock"·"threading 미검증"·"sentinel 불일치"
같은 결함 클래스를 사실상 소진했다. 이번 라운드에서 직전(`12_26_36`) WARNING 의 실제 정정을
소스 레벨로 재확인했고, 5개 raw-SQL 종결 경로(park 취소·위젯 idle·재개실패 취소·큐 대기 타임아웃·
stalled 소진) 전부가 `RETURNING` → emit 값 threading 을 정확 매칭으로 고정하고 있음을 확인했다.
남은 항목은 전부 이전 라운드들이 이미 검토·수용한 INFO 수준(약한 `expect.any(Number)` 단언 4곳,
의도적으로 미수정 상태인 DB≠emit drift 의 회귀 테스트 부재, `finalizeCancelledExecution` 의
exact-match 부재)이며, 새로운 CRITICAL/WARNING 급 커버리지 갭은 발견되지 않았다.

## 위험도

LOW
