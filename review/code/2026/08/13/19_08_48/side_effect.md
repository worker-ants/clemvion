# 부작용(Side Effect) Review

## 대상 요약

`git diff origin/main..HEAD` 기준 실질 프로덕션 코드 변경은 3곳이다:
1. `codebase/backend/src/common/utils/assert-row-array.ts` (신규) — 순수 타입 좁히기 assertion 헬퍼.
2. `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertRowArray` 3곳
   적용(`admitExecutionOrDefer`/`lockNonTerminalExecutionRow`/`updateExecutionStatus`) + `admitExecutionOrDefer`
   호출을 `try/catch` 로 감싸 throw 시 `releaseExecutionRouting` 후 재전파.
3. `codebase/backend/src/modules/executions/executions.service.ts` — `assertRowArray` 1곳(`computeChainDepth`)
   적용 + `SNAPSHOT_CACHE_MAX_ENTRIES` 를 `const` → `export const` 로 가시성 확대.

나머지는 대응 spec 4개(테스트 전용, mock/spy 로컬 격리), `plan/in-progress/*.md`(문서), 그리고
`review/code/**`·`review/consistency/**` 하위 30여 개(이 PR 체인의 이전 리뷰 라운드 산출물,
CLAUDE.md 가 명시한 저장 위치에 정확히 대응하는 정상 산출물)다.

이 diff 는 이미 5차례(`14_01_46`→`17_15_21`→`18_00_11`→`18_19_33`→`18_38_10`) side_effect 리뷰를
거쳐 throw 조건·트랜잭션 스코프·`releaseExecutionRouting` 배선이 고정됐다. `18_38_10` 이후 추가된
유일한 코드 커밋(`ef4ff8d5d`)은 `git show ef4ff8d5d -- codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
로 직접 대조한 결과 **주석 문구만** 고쳤다(재배달 근거를 "BullMQ 재배달로 자가 치유"에서
"`attempts:1` 이라 재배달 없음, DLQ 보존이 진짜 이유"로 정정) — 실행 코드 diff 는 0줄이다.
`chat-channel.dispatcher.spec.ts` 변경분도 같은 커밋에서 JSDoc 위치 이동·헬퍼 리네이밍·
pass-through 래퍼 제거뿐임을 대조 확인했다(테스트 전용, 프로덕션 영향 없음).

## 발견사항

- **[INFO]** `admitExecutionOrDefer` 호출을 `try/catch` 로 감싸 **모든** throw 에 대해
  `releaseExecutionRouting` 을 무조건 호출 — 새로 넓어진 부작용 경로
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `runExecutionFromQueue` 내부
    (`try { admission = await this.admitExecutionOrDefer(...) } catch (err) { this.eventEmitter.releaseExecutionRouting(executionId); throw err; }`)
  - 상세: 이 catch 는 `assertRowArray` 가 던지는 경우뿐 아니라 `admitExecutionOrDefer` 내부에서
    발생할 수 있는 **다른 모든 예외**(예: advisory lock 쿼리 실패, 트랜잭션 커넥션 단절 등)에도
    동일하게 반응한다. 이전에는 그런 예외가 나면 routing context 가 영구히 남았으므로, 이번
    변경은 실질적으로 그 클래스 전체를 고치는 strict improvement 다. `grep -n "admitExecutionOrDefer"`
    로 호출부가 이 함수 하나뿐임을 확인했고, `releaseExecutionRouting` 은 `Map.delete` 기반이라
    (`websocket.service.ts:449-451`) 등록 안 된 executionId 에 대해서도 안전한 no-op — `deferred`
    분기(바로 아래)가 이미 같은 전제로 무조건 release 하는 기존 패턴과 대칭이다.
  - 제안: 조치 불요 — 의도된 수정(ai-review `17_15_21` WARNING 2 대응)이고 호출부 단일성·
    idempotency 전제를 직접 코드로 재확인했다.

- **[INFO]** `computeChainDepth` 가 non-array 응답에 대해 "조용한 fail-open 값 반환"에서
  "throw"로 인터페이스 동작이 바뀌어 `reRun()` API 응답 코드가 달라짐
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` `computeChainDepth` 내부
    `assertRowArray(rows, ...)` 호출, 호출부는 같은 파일 `reRun()` (`const depth = await this.computeChainDepth(executionId);`)
  - 상세: 변경 전에는 `rows` 가 배열이 아니어도 실제로는 `rows[0]` 접근에서 이미 `TypeError` 가
    터졌으므로(암묵적 throw), 이번 변경은 판정을 새로 여는 것이 아니라 에러 메시지를
    일반 `TypeError` → 진단 가능한 `Error("raw SQL 결과가 배열이 아님 ...")` 로 바꾸는 것에
    가깝다. `reRun` 본문을 읽은 결과 `computeChainDepth` 호출 이전에는 DB 쓰기가 없어(조회·
    권한체크·dry-run pre-flight 뿐) throw 로 인한 부분 상태 변경 위험은 없다. 다만 이 `Error`
    는 `ConflictException` 같은 Nest `HttpException` 이 아니므로 전역 예외 필터를 거쳐 500 으로
    응답된다 — 도달 조건이 드라이버 계약 위반이라는 희박한 경로이지만 클라이언트가 500 을 받을
    수 있다는 점은 명시적으로 남긴다.
  - 제안: 조치 불요(의도된 정확성 수정, RR-PL-05 우회 차단). 이 예외를 더 구체적인 4xx 로
    노출하고 싶다면 별도 백로그로 검토 가치 있음(이번 diff 범위 밖).

- **[정보, 부작용 없음]** `SNAPSHOT_CACHE_MAX_ENTRIES` 가시성 확대(`const` → `export const`)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts`
  - 상세: 값(256) 불변. `grep -rn "SNAPSHOT_CACHE_MAX_ENTRIES" codebase/backend/src` 로 재확인한
    소비처는 정의부·내부 사용처(`writeSnapshotCache`)·`executions.service.spec.ts` 뿐이다. 자매
    상수 `MAX_EXECUTION_PATH_ROWS` 와 동일 export 패턴이라 새로운 전역/공개 인터페이스 위험 없음.
  - 제안: 조치 불요.

- **[정보, 부작용 없음]** `jest.spyOn(Logger.prototype, 'debug'/'warn')` 전역(prototype) 패치 —
  테스트 프로세스 내부에 한정, `try/finally` 로 복원 보장
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts` 신규
    `describe('ChatChannelDispatcher.handle — toChatChannelEvent null 의 로그 레벨 분기', ...)` 두 `it` 블록
  - 상세: `@nestjs/common` `Logger` 클래스 prototype 을 패치하지만 두 테스트 모두 assertion 실패
    시에도 복원되도록 `finally` 로 감쌌다. Jest 는 파일별 모듈 격리이므로 타 spec 파일로 전파되지
    않는다. `execution-engine.service.spec.ts` 신규 admission 가드 테스트의 `emitSpy()` 도 동일하게
    `try/finally` 로 감싸져 있음을 직접 확인했다.
  - 제안: 조치 불요.

- **[정보, 부작용 없음]** 신규 구조적 회귀 테스트가 프로덕션 소스 파일을 `readFileSync` 로 읽음 —
  읽기 전용, 파일 생성·수정·삭제 없음
  - 위치: `codebase/backend/src/common/utils/assert-row-array.spec.ts`
    `describe('자매 지점 전수 — 가드 누락 회귀 가드', ...)` 블록
  - 상세: `join(__dirname, '..', '..')` 로 `codebase/backend/src` 를 잡고 `execution-engine.service.ts`
    (`assertRowArray(` 3회)·`executions.service.ts`(1회) 를 텍스트로 읽어 정규식 카운트만 한다.
    직접 `grep -c "assertRowArray(" ...` 로 재확인한 실측값(3, 1)이 스펙의 하드코딩된 기대값과
    일치한다. 파일을 변경하지 않으며 테스트 프로세스 밖으로 영향이 새지 않는다.
  - 제안: 조치 불요.

- **[해당 없음]** `plan/in-progress/*.md`, `review/code/**`, `review/consistency/**` 신규/수정 —
  순수 문서·이전 리뷰 라운드 산출물, 코드 실행 경로에 영향 없음. `backend-lint-gate-broken-on-main.md`
  frontmatter 의 `worktree` 필드 갱신도 메타데이터일 뿐 런타임 부작용 없음.

## 요약

이번 diff 의 실질 프로덕션 코드 변경은 4곳의 raw SQL 결과 shape 가드를 `assertRowArray()` 헬퍼로
통일하고, 그중 admission 경로 하나에 한해 예외 시 `releaseExecutionRouting` 을 무조건 호출하도록
`try/catch` 를 새로 두른 것이다. 직접 코드를 대조한 결과 이 catch 는 assertRowArray 유발 예외뿐
아니라 admission 내부의 모든 예외 클래스에 적용되지만, 호출부가 단일하고 release 헬퍼가
idempotent 라 새로운 위험을 만들지 않는다(오히려 이전에 존재하던 "routing 영구 잔류" 결함 범위를
넓게 닫는다). `computeChainDepth` 는 non-array 응답에서 조용한 fail-open 값 대신 throw 하도록
바뀌어 `reRun` API 가 그 조건에서 500 을 반환하게 되지만, 도달 이전 DB 쓰기가 없어 부분 상태
위험은 없고 의도된 정확성 수정이다. `SNAPSHOT_CACHE_MAX_ENTRIES` export 확대는 값 불변·소비처
제한적이라 위험 없음. `Logger.prototype` 스파이·프로덕션 파일 `readFileSync` 는 모두 테스트
스코프에 갇혀 있고 복원/읽기전용이 보장된다. `18_38_10` 리뷰 이후 추가된 유일한 코드 커밋
(`ef4ff8d5d`)은 `git show` 로 직접 대조해 실행 코드 diff 가 0줄(주석·테스트 리네이밍뿐)임을
확인했다. 전역 변수 신설, 예상치 못한 파일시스템 쓰기, 환경 변수 읽기/쓰기, 의도치 않은 네트워크
호출, 공개 시그니처의 파괴적 변경은 발견되지 않았다.

## 위험도

NONE
