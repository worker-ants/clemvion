# 테스트(Testing) 리뷰

## 대상

실질 코드 변경 6개 파일: `chat-channel.dispatcher.spec.ts`, `execution-engine.service.spec.ts`,
`execution-engine.service.ts`, `executions-rerun.service.spec.ts`, `executions.service.spec.ts`,
`executions.service.ts`. (나머지 다수 파일은 `plan/**`·`review/**` 문서 커밋으로 테스트 관점 대상
아님.) `chat-channel.dispatcher.spec.ts`/`execution-engine.service.spec.ts` 는 프롬프트에서 diff 가
생략돼 `git diff origin/main...HEAD -- <path>` 로 직접 재구성해 검토했다.

## 발견사항

- **[INFO]** `updateExecutionStatus` 신규 `Array.isArray(updated)` 가드가 private 메서드 직접
  호출로만 테스트되고, 실제 프로덕션 호출부 12곳 중 어느 것을 통해서도 이 예외가 어떻게 전파되는지
  검증하지 않는다. 특히 `executeSync` 의 timeout 처리 경로(`updateExecutionStatus` 호출 자리)는
  **이미 존재하는 범용 `try/catch`** 로 감싸여 있어, 이 가드가 던지면 예외가 상위로 전파되지 않고
  `this.logger.warn(...)` 로 흡수된 뒤 계속 진행된다.
  - 위치: 가드 자체 — `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    (`updateExecutionStatus` 내부 `if (!Array.isArray(updated))` 블록). 흡수하는 호출부 —
    같은 파일의 `executeSync` timeout 처리 (`try { await this.updateExecutionStatus(reloaded,
    ExecutionStatus.FAILED); } catch (transitionErr) { this.logger.warn(...) }` 형태, 함수명
    `executeSync`). 신규 테스트는
    `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 의
    `it('updateExecutionStatus: guarded UPDATE 가 배열이 아니면 던진다 — 종결 이벤트 조용한 유실
    차단', ...)` 뿐이며 `svcAny.updateExecutionStatus(...)` 를 직접 호출한다.
  - 상세: 가드의 인라인 주석은 목적을 "관측 불가능한 유실을 관측 가능한 실패로 바꾸는 것"이라고
    명시한다. 그런데 위 호출부에서는 그 "실패"가 예외 전파가 아니라 `logger.warn` 한 줄로 축소된다
    — 로그로는 보이지만(완전히 침묵은 아님), 이 특정 호출 경로에서는 가드가 의도한 "실패 신호"가
    호출자에게 도달하지 않는다. 다만 이 흡수 자체는 이번 diff 가 새로 만든 회귀는 아니다 — 이전에도
    `rows.length` 접근에서 발생하던 암묵적 `TypeError` 를 같은 `catch` 가 동일하게 흡수했을 것이므로,
    판정(그대로 흡수)은 종전과 동일하다(RESOLUTION.md INFO 7 의 논리와 같은 이유). 그럼에도 "가드가
    이 특정 경로에서 실제로 어떻게 관측되는가"를 고정하는 테스트는 없다 — 이 경로를 캐너리로 남겨
    두면, 향후 이 catch 블록이 리팩터되며 조건이 넓어질 때(예: 모든 상태에서 흡수하도록) 회귀를
    잡을 수 있다.
  - 제안: (선택) `executeSync` timeout 처리 경로를 통해 `updateExecutionStatus` 가드가 발동하는
    시나리오의 캐너리 테스트를 추가하거나, 최소한 이 흡수가 의도된 것임을 가드 인라인 주석에 한 줄
    덧붙인다. 블로킹 사안은 아님.

- **[INFO]** 이번 diff 가 고친 결함 클래스("하드닝을 자매 함수에 미적용")를 재발 방지하는 구조적
  회귀 테스트가 없다. 이번엔 `grep -n '\.query<\|\.query('` 로 4곳(직접 재확인 완료: `executions.
  service.ts:305`, `execution-engine.service.ts:2916,8195,8491`) 전수를 세어 가드를 붙였지만, 이
  "전수 확인"은 코드에 고정되지 않고 리뷰 시점의 수작업 grep 에만 의존한다.
  - 위치: 해당 없음 (부재 — 4개 가드 사이트 자체는
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의
    `admitExecutionOrDefer`/`lockNonTerminalExecutionRow`/`updateExecutionStatus` 및
    `codebase/backend/src/modules/executions/executions.service.ts` 의 `computeChainDepth`)
  - 상세: 이 프로젝트 메모리(`feedback_defense_defined_one_notch_narrow`)가 명시하듯 "하드닝을
    자매 함수에 미적용"은 이 저장소에서 반복 관측된 결함 클래스이고, 이번 PR 의 커밋 메시지
    자체(`b3782f562`)가 "하드닝을 자매 3곳에 폈다 — 그중 하나는 조용히 fail-open 이었다"로 그
    재발을 인정한다. 지금은 4/4 가 가드됐지만, 향후 5번째 `.query<...RETURNING...>(` 호출이
    추가될 때 이 가드 누락을 잡아 줄 자동화된 신호(lint 규칙·정적 grep 테스트)가 없다 — 다음
    사람이 또 "자매 전수"를 세지 않으면 같은 클래스가 6번째로 재발할 수 있다.
  - 제안: (선택) 가벼운 구조적 테스트 하나 — 예를 들어 `execution-engine.service.ts`/
    `executions.service.ts` 소스를 문자열로 읽어 `\.query<.*\[\]>\(|\.query\(\s*\`` 패턴의 호출
    개수와 인접 `Array.isArray(` 가드 개수가 일치하는지 assert — 를 추가하면, 새 `.query()`
    RETURNING 호출이 가드 없이 추가될 때 CI 가 즉시 실패한다. 블로킹 사안은 아니며, 향후 유사
    PR 에서 재고할 수 있는 개선 아이디어로 남긴다.

- **[INFO]** `executions.service.spec.ts` 의 LRU 경계값 테스트가 256회 삽입을 `for` 루프 안에서
  순차 `await` 로 수행한다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts` — `it('snapshotCache
  는 256건 상한 — 257번째가 가장 오래된 키를 evict', ...)` 내부의 `for (let i = 0; i <
  SNAPSHOT_CACHE_MAX_ENTRIES; i += 1) { await service.findById(...); }`.
  - 상세: 기능적 결함은 아니다 — 순차 실행이 오히려 캐시 삽입 순서(LRU 판정의 핵심 전제)를 결정론적으로
    보장하므로 이 테스트에는 올바른 선택이다. `createQueryBuilder` mock 이 매 호출 새 QB 를 반환하는
    가벼운 mock 이라 실행 시간에 실질적 영향도 없어 보인다. 참고 사항으로만 남긴다.
  - 제안: 조치 불요.

## 확인된 양호 사항

- **가드 4곳(`admitExecutionOrDefer`/`lockNonTerminalExecutionRow`/`updateExecutionStatus`/
  `computeChainDepth`) 모두 대응 테스트가 있고, 에러 메시지 정규식(`/배열이 아님/`)이 실제 소스
  문구와 일치**함을 4곳 전부 직접 `Read` 로 대조 확인했다. `lockNonTerminalExecutionRow` 테스트는
  `true`/`false`/throw 세 경로를 모두 고정해 "가드가 정상 판정을 바꾸지 않는다"까지 함께 검증한다 —
  단순히 예외 케이스만 보는 대신 정상 회귀까지 같이 잠근 좋은 설계다.
- **admission throw → routing release 재전파 테스트**(`execution-engine.service.spec.ts`,
  `'admission 이 throw → routing release 후 그대로 재전파 + runExecution 미호출'`)는
  `mockWebsocketService.registerExecutionRouting`/`releaseExecutionRouting` 호출 여부와
  `runExecutionFromQueue(...)` 가 원본 에러 객체(`boom`)로 정확히 reject 하는지를 함께 확인해,
  "삼키면 BullMQ 가 성공으로 오판한다"는 회귀를 실제로 가른다. 인접 기존 테스트(`pendingRow`
  fixture 패턴)와 일관돼 격리·재사용성도 좋다.
- **`chat-channel.dispatcher.spec.ts` 로그 레벨 양방향 테스트**는 `debug`/`warn` 두 스파이를 모두
  세워 "한쪽 호출 + 다른 쪽 미호출"을 동시에 단언한다 — 삼항이 한쪽으로 굳는 회귀(정상 skip 이
  warn 으로 새거나, 에러성 null 이 debug 로 묻히는 경우)를 절반만 잡는 함정을 피했다. `finally` 로
  `Logger.prototype` 전역 스파이를 복원해 다른 스펙 파일로의 오염도 없다.
  `makeDispatcherHarness` 통합 이후 `buildDispatcher`(form 게이팅 describe)/신규 null 분기
  describe 가 동일 fixture 를 공유해도 매 호출 새 mock 인스턴스를 반환해 상태 누수가 없음을
  직접 코드로 확인했다.
- **LRU 경계값+방향 테스트**는 상한(256)뿐 아니라 evict 대상이 "가장 오래된" 키인지까지 손으로
  삽입/읽기 순서를 재계산해 검증한다 — "무언가 하나 지운다"만 고정하면 통과했을 방향 반전 회귀를
  실제로 가른다. `service` 가 outer `beforeEach` 에서 매 테스트 재생성돼 `snapshotCache`(인스턴스
  필드) 오염이 없음을 확인했다(`executions.service.spec.ts:106-147`).
  `SNAPSHOT_CACHE_MAX_ENTRIES` 상수 자체를 리터럴(`256`)로도 별도 고정한 테스트가 있어, "심볼만
  참조하면 상한이 조용히 바뀌어도 테스트가 따라간다"는 함정도 스스로 방지한다.
- **`executions-rerun.service.spec.ts` 의 `computeChainDepth` 가드 테스트**는 private 메서드가
  아니라 공개 API `service.reRun(...)` 을 통해 검증한다 — engine 스펙의 다른 세 가드 테스트가
  private 메서드를 직접 casting 해 부르는 것과 달리, 이 테스트는 "제한 우회의 실제 결과(새 실행이
  시작되는지)"까지 `engine.execute` 미호출로 직접 확인해 더 자기완결적이다. `beforeEach` 가
  `execRepo.query` 기본 mock 을 매번 재설정하므로 이 테스트의 `execRepo.query = jest.fn(() =>
  Promise.resolve(undefined))` override 가 다른 테스트로 새지 않는다.
- **Mock 이 실제 타입 계약과 일치**한다 — `EntityManager.query`/`Repository.query` 가 선언상
  `Promise<any>` 인 현실을 반영해 `undefined` 를 돌려주는 mock 으로 "배열 아님" 케이스를 만드는
  방식이 적절하다. 실제 pg 드라이버가 배열 아닌 값을 돌려주는 경우는 극히 드물지만, 가드가 방어하려는
  대상이 바로 이 타입 계약 위반이므로 mock 이 정확히 그 위반을 재현한다.
- **회귀**: 4개 가드 각각을 무력화하는 뮤테이션(M1~M4)이 baseline 대비 정확히 1건씩만 실패시킨다는
  것이 `RESOLUTION.md`(`17_15_21`)에 기록돼 있고, 이는 vacuous pass 가 아님을 뒷받침하는 강한 증거다
  — 이 리뷰에서 별도 재실행하지는 않았으나 서술과 소스 상태(각 가드의 정확한 위치·메시지)가
  일치함은 직접 대조했다.

## 요약

이번 diff 의 테스트 보강은 전반적으로 견고하다 — 4개 신규 런타임 가드(`Array.isArray` 방어) 모두
대응 테스트가 있고, 메시지 문구까지 실제 소스와 정확히 일치하며, 뮤테이션 테스트로 4/4 킬을 확인한
기록이 남아 있다. LRU 캐시·로그 레벨 삼항 분기 테스트는 "무언가 하나는 맞는다"류의 vacuous 함정을
피해 방향성 있는 단언(가장 오래된 키가 evict 되는지, 반대쪽 로그 레벨이 호출 안 되는지)을 갖췄고,
mock 은 격리·재사용성 모두 양호하다. 남은 지적은 전부 INFO 급 개선 여지다 — (1)
`updateExecutionStatus` 가드가 흡수되는 특정 호출부(`executeSync` timeout 처리)를 통한 관측 시나리오는
테스트되지 않았고(다만 이는 이번 diff 가 만든 새 회귀는 아님), (2) "하드닝을 자매 함수에 전수
적용"이라는, 이 저장소가 반복 겪어 온 결함 클래스를 앞으로도 구조적으로 막아 줄 회귀 테스트(예:
`.query()` RETURNING 호출 수 vs 가드 수 assert)가 없다. 둘 다 병합을 막을 사안은 아니며, 향후
유사 변경에서 고려할 만한 강화 아이디어로 남긴다.

## 위험도

LOW
