# 문서화(Documentation) Review

## 발견사항

- **[INFO]** `admitExecutionOrDefer` 함수 최상단 docstring 이 반환값 3가지(`admitted`/`cancelled`/
  `deferred`)만 열거하고, 이번 diff 가 추가한 명시적 `throw` 경로(비-배열 shape 가드)는 함수
  계약(contract) 레벨에서 언급하지 않는다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` —
    `admitExecutionOrDefer` 함수 docstring (Read 로 확인한 실제 파일 줄 2852~2869행, 이번 diff
    범위 밖·미변경). 신규 가드 자체는 diff 게이트 `2931`~`2935`(파일 3, `if (!Array.isArray(rows))
    { throw new Error(...) }`).
  - 상세: 가드 지점의 인라인 주석(게이트 `2922`~`2930`)은 "왜 throw 를 유지하는가" 를 훌륭하게
    설명하지만, 그 설명은 국소적이다. `runExecutionFromQueue`(3616행)는 `admitExecutionOrDefer`
    호출(3669행)을 try/catch 로 감싸지 않으므로, 이 throw 는 그대로 호출자 바깥(BullMQ consumer)
    으로 전파된다. 함수 시그니처(`Promise<'admitted' | 'cancelled' | 'deferred'>`)와 상단
    docstring 만 읽으면 "이 함수는 항상 세 값 중 하나로 resolve 된다" 로 오해하기 쉽다 — 실제로는
    "또는 throw" 라는 네 번째 갈래가 있고, 이번 diff 로 그 갈래가 우연한 크래시가 아니라 **의도된
    동작**으로 승격됐다. (참고: DB 오류 등으로 인한 암묵적 throw 는 이 diff 이전에도 같은 자리에서
    발생 가능했으므로 "throw 가능성" 자체는 신규가 아니다. 다만 이번 변경으로 그 갈래가 이름 있는
    의도적 계약이 됐는데 top-level 계약 서술은 갱신되지 않았다.)
  - 제안: docstring 반환값 목록 뒤에 한 줄 — "드라이버가 `UPDATE ... RETURNING` 에 배열이 아닌
    값을 돌려주면(shape 이상) 위 세 값 대신 throw 하며, 트랜잭션은 롤백되고 호출자(`
    runExecutionFromQueue`)는 이를 catch 하지 않고 그대로 전파한다" 를 추가하면 계약이 완전해진다.

- **[INFO]** `SNAPSHOT_CACHE_MAX_ENTRIES` 를 `const` → `export const` 로 바꾸면서, 자매 상수
  `MAX_EXECUTION_PATH_ROWS` 가 갖고 있는 "왜 export 됐는지" 한 줄 설명이 이번에도 추가되지 않았다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:63`
    (`export const SNAPSHOT_CACHE_MAX_ENTRIES = 256;`, 파일 5 diff 게이트 `63`)
  - 상세: `MAX_EXECUTION_PATH_ROWS`(42행)는 바로 위에 `// 테스트에서도 동일 상수를 참조하도록
    export.` 를 명시한다. `SNAPSHOT_CACHE_MAX_ENTRIES` 의 JSDoc(51~62행, 이번 diff 미변경)은 캐시
    설계는 상세히 설명하지만 export 사유는 없다 — 같은 파일 안 두 export 상수의 문서화 패턴이
    여전히 갈린다. (이전 라운드 `14_01_46/documentation.md` INFO 2 가 이미 지적했고,
    `14_01_46/RESOLUTION.md` 가 "무조치 — 자매 상수와 비대칭이나 소비처가 정의부·내부·테스트뿐"
    으로 의식적으로 유예한 항목이라 신규 지적은 아니다. 다음 라운드에서도 남아 있음을 재확인.)
  - 제안: (여전히 선택) JSDoc 끝에 `테스트에서 상한 값(256)·LRU 방향 회귀를 고정하기 위해 export.`
    한 줄 추가.

- **[INFO]** `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 admission 가드 "완료" 기록이
  무관한 선행 단락("required-check 등록" 논의) 바로 뒤, 빈 줄 2개 연속 뒤에 삽입돼 있다 — 같은
  문서의 다른 "완료" 메모(빈 줄 1개, 관련 체크박스 바로 아래)와 서식·배치가 다르다.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:1147-1149` (파일 6 diff 게이트,
    빈 줄 2개 + `> **완료 (2026-08-13, backlog-final-three)**` 시작부)
  - 상세: 관련 체크박스(`- [x] execution-engine.service.ts 의 admission 자리...`, 게이트 `1121`)
    로부터 멀리 떨어진 문서 맨 끝에 위치해 향후 독자가 근처에서 찾기 어렵다. 이전 라운드
    `14_01_46` 의 scope/documentation 리뷰가 이미 지적했고 `RESOLUTION.md` 가 "무조치 — 서식" 으로
    의식적으로 유예한 항목이라 신규는 아니다. 기능적 영향은 없다.
  - 제안: (선택) 완료 메모를 게이트 `1121` 체크박스 바로 아래로 이동 + 빈 줄 1개로 정리.

## 확인된 양호 사항 (참고)

- `chat-channel.dispatcher.spec.ts` 신규 JSDoc(`isSubFilterNull` 분기 설명, `makeDispatcherHarness`
  설명)을 실제 `chat-channel.dispatcher.ts:192-206` 로직과 대조한 결과 정확히 일치한다 — "sub-filter
  에 의한 정상 null 은 debug, 그 외는 warn" 서술이 실제 삼항과 완전히 부합한다.
- `execution-engine.service.spec.ts` 신규 테스트 JSDoc 이 서술하는 "가드를 처음엔 `return
  false`(defer)로 썼다가 `throw` 로 되돌렸다" 는 이력을, 실제 소스(`execution-engine.service.ts:
  2926-2936`)의 현재 상태(`throw new Error(...)`)와 대조해 확인 — 서술이 현재 코드와 일치하고
  stale 하지 않다.
- 이전 라운드(`14_01_46`)가 지적했던 "`admitExecutionOrDefer` 의 `'deferred'` 서술 3곳이 새
  deferred 경로를 반영 못해 stale" WARNING 은, 가드를 `return false`(defer) 에서 `throw`(롤백)로
  되돌리면서 **새 `deferred` 경로 자체가 사라져 자동 해소**됐다 — `RESOLUTION.md` 의 주장을 실제
  코드로 재확인했다. 현재 docstring 의 "`deferred`: ws/wf cap 초과 → delayed 재큐" 서술은 여전히
  정확하다.
- `plan/in-progress/spec-draft-eia-notification-payload-contract.md` 의 "체크리스트 잔재 제거"
  수정(파일 7)은, 직전 라운드(`17_05_10/plan_coherence.md` WARNING 1 — 문자열 포함(`s.index("##
  Rationale")`) 기반 섹션 절단이 본문 인용문과 충돌해 깨진 헤딩 + `[x]`/`[ ]` 모순 8줄을 남겼던
  결함)를 정확히 겨냥해 해소했다. 수정 후 파일을 직접 열어 확인한 결과 중복·모순 블록 없이
  "### 실행 (2026-08-13)" 체크리스트가 곧바로 `## Rationale` 로 이어진다 — 깨끗하게 고쳐졌다.
- 신규 env 변수·설정 옵션 추가 없음 — 설정 문서 갱신 불필요.
- 공개 API·엔드포인트·REST 계약 변경 없음 — API 문서·README 갱신 불필요.
- `CHANGELOG.md` 미등재는 이전 라운드가 "관측된 결함이 아닌 순수 진단 개선, 판정(둘 다 예외)은
  종전과 동일" 근거로 의식적으로 유예한 결정이며, 실제로 `TypeError`(암묵적 롤백) → `Error`(명시적
  롤백)로 **행동 변화 없이 진단 메시지만 개선**된 것이 맞다 — 저장소의 다른 CHANGELOG 항목들(예:
  "캐시 엔트리가 깨지면 요청이 500 이 됐다")과 달리 관측 가능한 사용자/클라이언트 영향이 없어
  구분이 타당하다.

## 요약

이번 diff 는 이전 라운드(`14_01_46`)에서 유예됐던 테스트 공백 2건을 메우는 신규 테스트 3세트와,
그 테스트가 검증하는 소품 프로덕션 변경 2건(`Array.isArray` fail-closed 가드, `SNAPSHOT_CACHE_
MAX_ENTRIES` export)으로 구성된다. 신규로 추가된 JSDoc·인라인 주석은 모두 실제 소스 로직과
line-level 로 대조해 정확함을 확인했고, 이전 라운드가 지적한 "`'deferred'` 서술 stale" WARNING 은
가드를 `throw` 로 되돌리는 설계 변경 자체로 자연스럽게 해소됐다(증상별로 주석을 억지로 맞추지
않고 원인을 없앤 것이 오히려 더 견고하다). 남은 지적은 전부 INFO 수준 — 함수 최상단 docstring 이
새로 명시적/의도적이 된 throw 경로를 계약에 반영하지 않은 점, export 상수의 "왜 export 인지" 주석
비대칭, plan 문서 서식 nit — 이며 그중 뒤 둘은 이전 라운드가 이미 인지하고 의식적으로 유예한
항목의 재확인일 뿐 신규 결함이 아니다. README·API 문서·설정 문서·예제 코드는 이번 diff 범위에서
해당 사항 없음.

## 위험도

LOW
