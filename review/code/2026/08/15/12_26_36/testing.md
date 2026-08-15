STATUS=success

===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰 — EIA 종결 이벤트 `durationMs` 배관

## 방법론 노트

이 PR 은 이미 (`09_58_24` → `10_18_38` → `10_34_51` → `10_52_07/08` → `11_09_44` → `11_29_02` →
`11_44_10` → `11_59_09`) 최소 8라운드의 테스트 리뷰를 거쳤고, RESOLUTION 문서들이 vacuous mock ·
threading 미검증 · sentinel 혼동 등 같은 결함 클래스를 반복적으로 잡아 왔다. 프롬프트 diff 만으로는
`execution-engine.service.ts`/`.spec.ts` 가 크기 제한으로 생략돼 있어, `git diff origin/main` 으로
전체 diff 를 직접 받고 `Read`/`Bash` 로 대조했다. 추가로 이전 라운드들이 반복 지적한 "GREEN 은
증거가 아니다" 교훈에 따라, 리뷰 대상 spec 파일들을 **실제로 `jest` 실행**해 콘솔 출력까지 확인했다
(`npx jest execution-engine.service.spec.ts retry-turn.service.spec.ts dashboard.service.spec.ts
statistics.service.spec.ts chat-channel.dispatcher.spec.ts terminal-duration.spec.ts`).

## 발견사항

- **[WARNING]** `markExecutionCancelled` 의 `affected=0` 회귀 테스트가 이 PR 로 인해 **vacuous 해졌다** — 8라운드 리뷰가 반복 지적해 온 것과 똑같은 결함 클래스의 **아홉 번째, 아직 안 잡힌 사례**
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 테스트
    `'markExecutionCancelled: affected=0 (이미 처리됨) 이면 EXECUTION_CANCELLED emit 억제'`
    (`grep -n` 결과 라인 15019, 로컬 mock override 는 15045-15060 부근:
    `mockExecutionRepo.createQueryBuilder = jest.fn().mockImplementation(() => { const chain = { update, set, where, andWhere, execute } ... })`)
  - 상세: 이 PR 이 프로덕션 코드 `markExecutionCancelled`
    (`codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2810-2878`)의 쿼리
    체인에 `.setParameter(TERMINAL_FINISHED_AT_PARAM, terminalFinishedAt)` 와
    `.returning(['id', 'duration_ms'])` 호출을 새로 추가했다(`durationMs` SQL 계산 배관). 그런데 이
    "affected=0" 테스트의 로컬 mock 은 `update/set/where/andWhere/execute` 5개 메서드만 갖고 있고
    `setParameter`/`returning` 이 없다 — `git show origin/main:...execution-engine.service.spec.ts`
    로 대조한 결과 이 블록은 PR 이전과 **완전히 동일**해 갱신에서 빠졌다.

    `markExecutionCancelled` 전체가 top-level `try { ... } catch (err) { this.logger.error(...) }` 로
    감싸여 있어(2817/2871-2877행), 체인 호출 중 `.setParameter is not a function` 이 `TypeError` 를
    던지면 그 예외가 **`.where()`/`.andWhere()`/`.returning()`/`.execute()` 가 실행되기도 전에** catch
    로 흡수되고 함수는 조용히 반환한다. 즉 테스트가 검증하려는 "`affected===0` 이면 emit 을
    안 한다" 라는 실제 분기 로직은 **한 번도 실행되지 않는다** — `cancelledEmits.toHaveLength(0)`
    이라는 단언은 그 가드가 맞아서가 아니라 **함수 전체가 예외로 조기 종료했기 때문에** 우연히
    참이 된다. `if ((result.affected ?? 0) > 0) { await this.emitCancellationEvent(...) }` 가드를
    (실수로) 통째로 지워도 이 테스트는 여전히 GREEN 이다 — 애초에 그 줄에 도달하지 못하기 때문이다.

    **실측**: `npx jest execution-engine.service.spec.ts -t "affected=0 \(이미 처리됨\)"` 를 격리
    실행하면 테스트는 통과(`1 passed`)하지만 콘솔에
    `[ExecutionEngineService] markExecutionCancelled(RESUME_INCOMPATIBLE_STATE) 실패 —
    execution=execution-1: this.executionRepository.createQueryBuilder(...).update(...).set(...)
    .setParameter is not a function` 에러 로그가 남는다. 전체 스위트 실행에서도 동일 문자열이
    정확히 1회만 나타나 이 블록이 유일한 잔존 사례임을 확인했다(같은 파일 내 `update: jest.fn()`
    패턴을 쓰는 다른 17개 블록은 전부 `setParameter`/`returning` 이 이번 PR 에서 함께 추가됨 —
    `claimResumeEntry`(L3316) · `markWebChatIdleTimeout`(`makeIdleQb`) ·
    `cancelParkedExecution`(`makeCancelQb`, `noopQb`) · `markQueueWaitTimeout`(`mkQb`) ·
    `finalizeStalledExhausted`(`mkExecQb`) · `RESUME_INCOMPATIBLE_STATE` 성공 케이스(L14798) 등).

    이 시나리오는 바로 그 "다른 worker 가 이미 처리해 중복 emit 을 막아야 한다" 는, 이 코드베이스가
    반복적으로 실전에서 겪어 온 동시성 회귀(§7.5 rehydration 레이스)의 안전망이다. 안전망 자체가
    조용히 무력화됐다는 점에서 이 PR 의 나머지 15경로가 받은 것과 같은 수준의 주의가 필요하다.
  - 제안: mock 에 `setParameter: jest.fn().mockReturnThis()`, `returning: jest.fn().mockReturnThis()`
    를 추가(다른 17개 블록과 동일 패턴). 추가 후 `if ((result.affected ?? 0) > 0)` 가드를 뮤테이션
    (예: `> 0` → 항상 true)해 실제로 RED 가 되는지 판별력까지 확인할 것 — 이 PR 의 여러 RESOLUTION
    이 요구해 온 최소 기준이다.

- **[INFO]** 신규 헬퍼 `terminal-duration.ts` 의 테스트 커버리지는 모범적 — 이번 라운드에서 추가로
  지적할 갭이 없음
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.spec.ts`
  - 상세: `resolveTerminalDurationMs`(기존값 우선 · 계산 폴백 · `startedAt`/`finishedAt` 각각
    부재/둘다 부재/null · Date 아닌 값 · Invalid Date · 시계 역행 음수 · int4 상한 saturate ·
    `NaN`/`Infinity` 폴백 · `0` 을 falsy 로 버리지 않음)과 `toFiniteNumber`(숫자/문자열/0-문자열/
    null/undefined/빈문자열/공백/비숫자문자열/NaN/객체), `TERMINAL_DURATION_MS_SQL`(파라미터명 일치·
    `started_at` 참조·상한 상수 포함·`GREATEST(0` 부재 확인)까지 25개 테스트로 경계값을 촘촘히
    고정했다. 특히 "0 은 falsy 로 버리지 않는다"·"SQL 쌍둥이와 같은 상한 상수" 처럼 이 PR 이전
    라운드가 실제로 겪은 회귀(§CRITICAL int4 saturate, W8 sentinel 불일치)를 캐너리로 남긴 방식이
    적절하다.
  - 제안: 없음.

- **[INFO]** `chat-channel.dispatcher.spec.ts` 의 신규 `durationMs` 전파 테스트도 세 상태(completed/
  failed/cancelled) × 숫자·`null`·키 부재(레거시 이벤트) 3가지 형태를 `it.each` 로 고정해
  consumer 계약 경계를 잘 덮는다(파일: `chat-channel.dispatcher.spec.ts` describe
  `'toChatChannelEvent — durationMs 전파'`). `it.each` 타이틀이 `%s` 로 `status` 를 찍도록 이미
  정정돼 있어(직전 커밋 `9482cc0c0`), 세 케이스가 서로 다른 테스트 이름으로 구분된다 — 타이틀
  충돌로 인한 마지막 실행 결과만 남는 사고 형태는 재발하지 않았다.
  - 제안: 없음.

- **[INFO]** `dashboard.service.spec.ts`/`statistics.service.spec.ts` 의 신규 "completed 만 센다"
  가드는 자리별 판별력이 RESOLUTION(`11_59_09` W2)에서 뮤테이션으로 실측됐고(자리 하나만 지워도
  RED), 이번 라운드에서 직접 재현해도 `avg7d`/`avgDurationMs`×2 필터 문자열 검사가 유효하다. 다만
  세 곳 모두 **mock 이 SQL 을 실행하지 않는다는 한계**(값이 아니라 필터 문자열의 존재만 검증)를
  주석에 이미 명시해 뒀고, SQL 값 수준 e2e 부재는 이미 트래커(`spec-sync-external-interaction-api-gaps.md`)에 등재돼 있다 — 새로 지적할 사항 아님.

- **[INFO]** `retry-turn.service.spec.ts` 의 durationMs 단언(3곳, `expect.any(Number)`)은 helper 가
  이미 NaN/음수/오버플로를 전수 방어하므로 약한 단언이어도 실질 위험이 낮다는 판단이 이전 라운드
  INFO 처분과 일치한다. 재확인 결과 이견 없음.

## 그 외 확인 (문제 없음)

- `execution-engine.service.spec.ts`/`retry-turn.service.spec.ts` 전체 실행: **491 passed** (2 suites,
  위 WARNING 항목의 콘솔 에러 1건 제외하면 전부 정상). `terminal-duration.spec.ts` +
  `chat-channel.dispatcher.spec.ts` + `dashboard.service.spec.ts` + `statistics.service.spec.ts`:
  **94 passed**.
- `finalizeCancelledExecution`(엔티티 로드 경로, `execution-engine.service.ts:4876`)의 durationMs 는
  전용 emit 단언 테스트가 없지만, 같은 형태(`resolveTerminalDurationMs(entity) ?? entity.durationMs`)의
  completed 경로 다수가 `expect.any(Number)` 로 이미 고정돼 있고 헬퍼 자체 테스트가 두텁다 — 이번
  라운드에서 별도로 요구할 만큼의 위험은 아니라고 판단(우선순위 낮음, INFO 수준).
- `driveResumeAwaited`/`markQueueWaitTimeout`/`finalizeStalledExhausted`/`cancelParkedExecution`/
  `markWebChatIdleTimeout` — 5개 raw-UPDATE 경로 전부 `RETURNING` mock 이 실제 값을 주고 emit 과
  정확 매칭(`durationMs: 4242`/`600000`/`3600000`/`7200000`/`1234`)으로 threading 을 검증한다 —
  이전 라운드들이 반복적으로 vacuous 였다고 지적한 자리들이 이번엔 전부 실질 검증이다(단, 위
  WARNING 항목의 "이미 처리됨" 케이스는 예외).

## 요약

`terminal-duration.ts` 헬퍼와 그 직접 호출부 대부분은 이 PR 의 8라운드 리뷰를 거치며 이미 매우
꼼꼼하게 회귀 테스트로 고정됐다(경계값·null·오버플로·threading 전부). 그러나 이번 라운드에서
`execution-engine.service.spec.ts` 를 실제로 실행해 콘솔 로그까지 대조한 결과, `markExecutionCancelled`
의 `affected=0` 시나리오 테스트 하나가 이 PR 이 추가한 `.setParameter()` 호출로 인해 **의도와 다른
이유로 통과하는 vacuous 테스트**가 됐다 — 프로덕션 코드의 `try/catch` 가 mock 미비로 인한
`TypeError` 를 흡수해 테스트가 검증하려던 분기(`affected>0` 가드)에 아예 도달하지 못한다. 이는 같은
PR 의 RESOLUTION 문서들이 "GREEN 은 증거가 아니다"·"mock 이 SQL 을 실행하지 않으므로…" 라는
교훈으로 8차례 반복해 온 바로 그 결함 클래스이며, 같은 파일 안의 유사 블록 17곳은 전부 정정됐는데
이 한 곳만 누락됐다. 프로덕션 로직 자체(가드 순서·guarded UPDATE)는 문제가 없어 보이지만, 그
로직을 지키는 안전망이 조용히 사라졌다는 점에서 수정이 필요하다.

## 위험도

MEDIUM
