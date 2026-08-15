# 유지보수성(Maintainability) Review

## 검토 범위 요약

이 diff 는 `origin/main` 대비 누적분이며, 이 브랜치는 이미 세 차례(`13_58_27`, `14_47_14`,
`15_00_41`) ai-review maintainability 라운드를 거쳤다. 각 라운드가 CRITICAL 0 으로 수렴했고
직전 라운드(`15_00_41`)는 WARNING 0 / INFO 4(전부 "범위 밖 등재" 또는 사소)로 끝났다.

이번 라운드에서 실제로 **새로 추가된 코드**는 마지막 커밋(`6f39a7167`, "코드를 되돌리면서 그
코드를 설명하려고 방금 고친 문서를 안 되돌렸다")이 `bf0f86ca8` 대비 건드린 두 파일뿐이다
(`git diff bf0f86ca8 6f39a7167 -- codebase/ plan/ spec/` 로 직접 확인):

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeCancelledExecution`
  0행 재조회 블록에 `try/catch` 추가(재조회 자체 실패 시 fail-closed skip)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 위 회귀를 잡는
  신규 테스트 `(d)` 추가 + `saved()` 반환 타입 명시 + `finishedAt` 되쓰기 단언 추가

나머지 파일(`retry-turn.service.ts` 등)은 `15_00_41` 리뷰 시점 이후 변경이 없어(diff 없음, 직접
`git diff` 로 확인) 재검토하지 않는다. `spec/conventions/node-cancellation.md`·plan 문서 변경은
코드가 아니라 이 리뷰의 관할 밖이다.

## 발견사항

- **[WARNING]** 신규 테스트 `(d)` 가 같은 `describe` 블록의 `arrange()` 헬퍼를 쓰지 않고 그 안의
  설정을 손으로 재구현한다 — 헬퍼가 존재하는 이유 자체를 스스로 무너뜨림
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:1143-1156`
    (`it('(d) 재조회가 throw 해도 호출자로 전파하지 않는다 ...')`) vs 같은 블록의
    `arrange()` 헬퍼 정의 `:1074-1096`
  - 상세: `arrange(liveStatus)` 는 정확히 이 자리(`finalizeCancelledExecution — 0행 매칭의 두 의미`)의
    공통 셋업 — `eventEmitter.emitExecution` spy, `mockExecutionRepo.query.mockResolvedValueOnce([])`
    (guarded UPDATE 0행) — 을 한 곳에 모아 두려고 만든 헬퍼다. 그런데 신규 `(d)` 는 `arrange()` 를
    호출하는 대신 그 안의 두 줄(`eventEmitter` spy 획득 + `emitExecution` mock, `query.mockResolvedValueOnce([])`)을
    함수 밖에서 그대로 복제한 뒤, `findOneBy` 만 `mockRejectedValueOnce` 로 바꿔 쓴다. `arrange` 는
    현재 `liveStatus: ExecutionStatus | null` 만 받아 "성공 응답의 세 가지 값"만 표현할 수 있고
    "reject" 를 표현할 방법이 없어서 이런 우회가 생긴 것으로 보인다. 이 파일이 같은 PR 안에서
    스스로 남긴 교훈("불완전한 mock 이 다른 무관한 테스트를 조용히 vacuous 하게 만드는 것을 막기
    위한 방어" — `retry-turn.service.spec.ts` 주석, `13_58_27`/`15_00_41` 리뷰가 반복 지적한 패턴)과
    정확히 같은 종류의 리스크다: 앞으로 `arrange()` 의 셋업(예: `eventEmitter` spy 방식, 추가
    mock 필드)이 바뀌면 `(d)` 는 조용히 stale 해질 수 있다 — 지금은 셋업이 짧아 위험이 작지만,
    같은 블록 안에 "공유 헬퍼" 와 "손으로 복제한 우회" 가 나란히 있는 것 자체가 다음 편집자에게
    혼란을 준다.
  - 제안: `arrange` 시그니처를 `arrange(liveStatus: ExecutionStatus | null | 'reject')` 또는
    `arrange({ liveStatus } | { rejects: Error })` 형태로 확장해 `(d)` 도 헬퍼를 통해서만 셋업하게
    통일. 최소한 주석으로 "왜 `arrange` 를 안 쓰는지" 한 줄을 남기면 다음 편집자가 의도된 예외인지
    누락인지 헷갈리지 않는다.

- **[INFO]** 신규 테스트 `(d)` 가 `(b)`·`(c)` 사이에 삽입되어 레이블 순서(a→b→d→c)가 파일 순서와
  어긋난다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:1123`(`(a)`),
    `:1137`(`(b)`), `:1143`(`(d)`), `:1158`(`(c)`)
  - 상세: 바로 위 `describe` 앞 블록 주석(`:1066-1071`)이 "0행 매칭은 두 가지를 뜻한다" 며 (a)/(b)
    두 갈래를 설명하고, 함수 JSDoc 도 (a)/(b) 두 갈래 서술이다. 테스트는 여기에 "재조회 실패"(`(c)`,
    "행을 못 읽으면") 를 세 번째 갈래로, 이번에 "재조회가 throw"(`(d)`) 를 네 번째로 추가해 왔다.
    `(d)` 를 `(c)` 뒤에 이어 붙이지 않고 `(b)`/`(c)` 사이에 끼워 넣어, 처음 읽는 사람이 "왜 c 가
    d 뒤에 오지" 하고 한 번 더 생각해야 한다. 기능에는 영향 없는 순수 가독성 이슈.
  - 제안: `(d)` 블록을 `(c)` 아래로 옮기거나, 알파벳 대신 "재조회 실패(throw)"/"재조회 실패(null)"
    처럼 서술형 레이블로 바꿔 순서 의존성을 없앨 것. 긴급하지 않음.

- **[INFO]** 새로 추가된 `try/catch` 안의 로그 접두사 템플릿 리터럴이 같은 함수 안에서 문자 그대로
  2회 중복된다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4931`,
    `:4940` (둘 다 `` `finalizeCancelledExecution(${savedExecution.id}) [${logContext}]: ` `` 로 시작)
  - 상세: `catch (err)` 블록의 `logger.warn`(재조회 실패)과 그 아래 `if (live?.status !== CANCELLED)`
    블록의 `logger.warn`(선점 판정)이 같은 접두사 문자열을 각각 다시 타이핑했다. 이번 diff가
    두 번째 `logger.warn` 을 새로 추가하면서 기존 첫 번째 `logger.warn` 의 접두사를 그대로
    복제한 형태다. 함수가 짧고 두 곳뿐이라 실질 위험은 낮지만, 세 번째 분기가 추가되면 같은
    복제가 반복될 조건이다.
  - 제안: 함수 시작부에 `const logPrefix = \`finalizeCancelledExecution(${savedExecution.id}) [${logContext}]: \`;`
    를 두고 두 `logger.warn` 이 재사용하게 하면 문자열이 한 곳에서만 정의된다. 사소한 개선이라
    긴급하지 않음.

## 확인했으나 문제 없음 (양호한 점)

- `saved()` 테스트 헬퍼에 반환 타입을 명시적으로 붙인 것(`:1099-1107`)은 이 저장소가 기록한 교훈
  ("추론에 맡기면 통과 이유가 우연이 되거나, 타입이 좁아 단언이 막힌다")을 정확히 따른 방어다 —
  실제로 주석이 "추론에 맡기면 단언 줄에서 '속성이 없다' 로 떨어진다" 고 이유를 남겼다.
  `finishedAt`/`durationMs` 를 명시적으로 optional 로 선언해 되쓰기 대상 필드를 타입에서도
  드러낸 점도 좋다.
  - `Read` 로 로컬 `tsc` 관련 설정까지 재확인하지는 않았으나, 이 변경 자체는 새 필드를 읽기
    쉽게 만드는 방향이라 유지보수성에 부정적 영향 없음.
- 신규 `try/catch`(`:4924-4937`)의 인라인 주석이 "왜 여기서 throw 하면 안 되는가"(호출부가 이미
  catch 블록 안이라 에러 핸들러가 터진다)와 "왜 실패 시 skip 을 택했는가"(관측 가능한 무음 >
  관측 불가능한 오시그널)를 모두 명시해, 이 함수의 나머지 부분과 같은 수준의 "왜" 설명 밀도를
  유지한다. 새 분기가 늘었지만 각 분기의 근거는 코드만 읽어도 추적 가능하다.
- 이 함수(`finalizeCancelledExecution`)의 순환 복잡도가 이번 `try/catch` 추가로 한 단 더 깊어진
  것은 사실이나(분기 `!persisted` → `try/catch` → `live?.status !== CANCELLED`), 이는 `15_00_41`
  라운드가 이미 "핵심 결함을 닫는 자리라 여기 흩어 두는 것 자체는 타당" 이라고 판단한 동일 함수의
  연장선이며 새로운 성격의 부채가 아니다 — 별도 WARNING 으로 재기재하지 않는다.

## 요약

이번 라운드에서 실질적으로 새로 추가된 코드는 `finalizeCancelledExecution` 의 재조회 실패 방어용
`try/catch` 한 블록과 그에 대응하는 테스트 하나뿐이다. 프로덕션 코드 쪽은 "왜"를 설명하는 인라인
주석 밀도가 유지되고 함수 복잡도 증가도 이미 인지된 부채의 연장선이라 새 문제로 채점하지 않는다.
테스트 쪽에서는 같은 블록에 이미 존재하는 `arrange()` 공유 헬퍼를 쓰지 않고 셋업을 손으로
재구현한 신규 테스트 `(d)` 가 이 PR 이 스스로 반복 지적해 온 "불완전/우회 mock 셋업" 패턴과
같은 결의 회귀 위험을 남긴다(WARNING). 레이블 순서 어긋남과 로그 접두사 2회 중복은 기능에
영향 없는 사소한 가독성 이슈(INFO)다. CRITICAL 급 발견은 없다.

## 위험도

LOW
