# 부작용(Side Effect) Review

## 대상 요약

실질 코드 변경은 6개 파일 (파일 1~6). 나머지(파일 7~46)는 `plan/in-progress/*.md` 체크박스
갱신과 이전 리뷰/일관성 검토 세션(`14_01_46`, `17_15_21`, `14_18_42`, `17_05_10`)의 산출물이
저장소에 신규 커밋되는 것으로, `git diff origin/main...HEAD --stat`으로 전부 `.md`/`.json`
문서 파일임을 확인했다 — 런타임 부작용 대상이 아니다.

이번 세션은 이미 두 차례 리뷰(`14_01_46`, `17_15_21`)를 거친 diff의 재검토다. 두 라운드 모두
side_effect WARNING을 냈고 각각 `RESOLUTION.md`로 조치가 기록돼 있다(트랜잭션 롤백 불변식
정정, admission throw 시 routing release 추가). 이번 라운드에서는 그 조치가 실제로 현재
코드에 반영돼 있는지 직접 코드를 읽어 재확인했고, 그 위에서 새로운 부작용을 찾는다.

## 발견사항

- **[정보, 재확인 — 발견 아님]** admission throw 시 routing release가 실제로 배선돼 있고,
  release 자체는 등록 여부와 무관하게 안전(idempotent)함을 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3679-3685`
    (`runExecutionFromQueue` 내부 `try { admission = await this.admitExecutionOrDefer(...) }
    catch (err) { this.eventEmitter.releaseExecutionRouting(executionId); throw err; }`)
  - 상세: `releaseExecutionRouting`(`codebase/backend/src/modules/websocket/websocket.service.ts:449`)은
    `Map.delete(executionId)` 한 줄이라, `execution.triggerId`가 falsy라 애초에
    `registerExecutionRouting`이 호출되지 않은 경로(3662행 `if (execution.triggerId)`)에서도
    catch 블록이 무조건 `releaseExecutionRouting`을 호출하지만 존재하지 않는 키 삭제는
    예외·로그·부수효과 없이 조용히 no-op이다. 이중 release(추후 `deferred` 분기·terminal
    event 자동 release와 겹치는 경우)도 같은 이유로 안전 — 새로운 부작용 없음.

- **[정보, 재확인 — 발견 아님]** `updateExecutionStatus`의 guard는 자매 3곳과 롤백 성격이
  다르다는 점이 코드 주석에 이미 명시돼 있고, 그 차이가 실제로 안전한 방향임을 호출부
  구조로 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8524`
    (`if (!Array.isArray(updated))`) — 이 UPDATE(8491행)는 `this.executionRepository.query`
    직접 호출로 애플리케이션 트랜잭션 밖(autocommit)이다.
  - 상세: `admitExecutionOrDefer`(2936행)와 `lockNonTerminalExecutionRow`(8206행) 두 guard는
    `manager.transaction`/`dataSource.transaction` 콜백 내부에 있어 throw가 실제 롤백을
    부른다. 반면 `updateExecutionStatus`의 guard가 fire하는 시점엔 이미 UPDATE 문이
    autocommit으로 실행된 뒤이므로(드라이버가 배열 아닌 값을 반환한 방어적 케이스에서),
    throw는 그 UPDATE를 되돌리지 못한다 — 코드 주석(8521-8523행)이 이를 정확히 인지하고
    있다. 이 guard가 실제로 발동하면 `recordRunningSegmentStart`/`emitTerminalExecutionMetrics`
    (8533-8536행, terminal event 발행·메트릭 기록 포함)가 스킵된 채 예외가 전파된다.
    `updateExecutionStatus`의 모든 실제 호출부(643, 2266, 2364, 2441, 2531, 3465, 4192, 4317,
    4640, 4764, 4827행 — 총 11곳)를 grep으로 확인한 결과 전부 `await`되고 있어 fire-and-forget
    unhandled rejection 경로는 없다. 설계 의도(관측 불가능한 유실을 관측 가능한 실패로 전환)와
    실제 도달 가능성(정상 pg 드라이버에서는 사실상 불가능)을 감안하면 이 비대칭은 새로운
    결함이 아니라 이미 인지되고 문서화된 트레이드오프다.

- **[INFO]** `Array.isArray` guard 4곳이 예외 타입/메시지를 암묵적 `TypeError`에서 명시적
  `Error`로 바꾼다 — 문자열 매칭 기반 외부 모니터링이 있다면 조용히 끊길 수 있음
  - 위치: `execution-engine.service.ts:2936`(`admitExecutionOrDefer`), `:8206`
    (`lockNonTerminalExecutionRow`), `:8524`(`updateExecutionStatus`),
    `codebase/backend/src/modules/executions/executions.service.ts:324`(`computeChainDepth`)
  - 상세: 이전에는 `rows`/`live`/`updated`가 배열이 아니면 `.length`/`[0]` 접근에서
    `Cannot read properties of undefined` `TypeError`가 던져졌다. 이번 diff는 같은 조건을
    명시적으로 검사해 다른 문구의 `Error`를 던진다. 제어 흐름(throw → 상위 전파 → 트랜잭션
    롤백 또는 BullMQ job 실패)은 4곳 모두 이전과 동일해 기능적 회귀는 없다. 다만 로그 문자열에
    의존하는 alerting 규칙이 외부에 있었다면 매칭이 끊긴다 — 이전 두 라운드(`14_01_46`,
    `17_15_21`)의 side_effect 리뷰가 이미 지적한 항목의 재확인이며 조치 불요로 판단됐다.
  - 제안: 조치 불요. 운영 알림 규칙이 별도로 존재한다면 문구 갱신을 함께 검토(기존 판단 유지).

- **[INFO]** `SNAPSHOT_CACHE_MAX_ENTRIES` 가시성 확대(`const` → `export const`) — 공개
  인터페이스 변경, 재확인 결과 소비처는 정의부·내부 구현·테스트뿐
  - 위치: `executions.service.ts:63`
  - 상세: 값(256) 불변, `grep -rn "SNAPSHOT_CACHE_MAX_ENTRIES" codebase/backend/src` 결과
    정의부·`writeSnapshotCache` 내부·신규 테스트 외 소비처 없음을 재확인. 자매 상수
    `MAX_EXECUTION_PATH_ROWS`가 이미 동일 목적으로 export돼 있어 패턴도 일관. 이전 라운드
    지적의 재확인.

- **[정보, 부작용 없음]** 신규 테스트가 `Logger.prototype.debug`/`warn`을 전역(prototype)
  스파이로 패치하지만 전부 `try/finally`로 복원
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts` 신규
    `describe('ChatChannelDispatcher.handle — toChatChannelEvent null 의 로그 레벨 분기', ...)`
    블록 내 두 `it` — `debugSpy`/`warnSpy` 선언 직후 `try { ... } finally { debugSpy.mockRestore();
    warnSpy.mockRestore(); }`로 감싸져 있음을 diff로 직접 확인.
  - 상세: `@nestjs/common`의 `Logger` prototype을 패치하는 전역성 변경이지만 assertion 실패
    시에도 복원이 보장되고, Jest 파일별 모듈 격리로 타 스펙 파일에 전파되지 않는다. 이전
    라운드가 이미 확인한 패턴과 동일.

- **[정보, 부작용 없음]** `makeDispatcherHarness` 공용 헬퍼 — mock 인스턴스 공유 없음 재확인
  - 위치: `chat-channel.dispatcher.spec.ts` `function makeDispatcherHarness(...)`
  - 상세: 매 호출마다 새 `jest.fn()`/객체 리터럴을 생성해 반환하므로, 두 `describe` 블록이
    mock 인스턴스를 공유하지 않는다. `execution-engine.service.spec.ts`의
    `mockExecutionRepo.manager.transaction`/`mockExecutionRepo.query` 재할당,
    `executions-rerun.service.spec.ts`의 `execRepo.query` 재할당도 모두 각 파일 최상위
    `beforeEach`에서 해당 mock 객체 자체를 새로 만드는 구조라(직접 확인) 테스트 간 상태
    누수 없음.

- **[해당 없음]** `plan/in-progress/*.md`, `review/code/**`, `review/consistency/**` 신규 커밋 —
  순수 문서
  - 위치: 파일 7, 8 및 파일 9~46 전체
  - 상세: `git diff origin/main...HEAD --stat`로 전 파일이 `.md`/`.json`임을 확인. 체크박스
    갱신·이전 리뷰 세션 산출물 커밋으로 코드 실행 경로에 영향을 주는 상태 변경이 아니다.
    전역 변수·파일시스템 부작용(문서 파일 자체의 정상적 생성 제외)·시그니처/인터페이스
    변경·환경 변수·네트워크 호출·이벤트/콜백 어느 관점에도 해당하지 않는다.

## 요약

이번 diff의 실질 프로덕션 코드 변경은 두 파일(`execution-engine.service.ts`의
`Array.isArray` guard 3곳 + admission throw 시 routing release, `executions.service.ts`의
`computeChainDepth` guard 1곳 + 상수 export)이다. 이전 두 라운드(`14_01_46`, `17_15_21`)가
지적한 side_effect WARNING(트랜잭션 커밋 vs defer 판정 불일치, admission throw 시 routing
context 미해제)이 실제로 현재 코드에 조치돼 있음을 직접 소스를 읽어 재확인했다 — throw는
유지되고, 4개 guard 지점 중 3곳(`admitExecutionOrDefer`/`lockNonTerminalExecutionRow`/
`computeChainDepth`)은 트랜잭션 콜백 내부라 throw가 실제 롤백을 부르고, 나머지 1곳
(`updateExecutionStatus`)은 애플리케이션 트랜잭션 밖이라 throw가 롤백을 부르지 못한다는
비대칭이 코드 주석에 명시돼 있고 그 트레이드오프도 타당하다(정상 도달 불가능한 방어적
케이스, 모든 호출부가 await되어 unhandled rejection 위험 없음). `releaseExecutionRouting`은
`Map.delete` 기반이라 미등록 상태에서 호출해도 안전. 나머지는 예외 문구 변경(로그 매칭
규칙 존재 시에만 영향, INFO)과 export 가시성 확대(값 불변, 소비처 없음, INFO), 그리고
테스트 파일의 전역 `Logger.prototype` 패치(try/finally로 안전 복원)뿐이다. 신규
CRITICAL/WARNING급 부작용은 발견하지 못했다.

## 위험도

LOW
