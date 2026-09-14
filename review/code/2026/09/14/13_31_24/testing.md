# 테스트(Testing) Review — trigger-canary-hardening

## 검토 방법

코드 성격의 변경 6개 파일을 직접 열어(diff 가 프롬프트 크기 제한으로 생략된 파일 1·2·3 포함)
전문을 읽고, 실제로 다음을 실행해 확인했다.

- `npx jest --config jest.config.ts src/repo-guards/__tests__/trigger-secret-columns.spec.ts
  src/shared/testing/trigger-workflow-ref.spec.ts` → **24/24 GREEN**
  (가드 스위트 12 + 캐너리 self-spec 12, RESOLUTION 라운드 5 실측치와 일치).
- `npx jest --config test/jest-e2e.json schedule-trigger.e2e-spec.ts
  trigger-workflow-ref.e2e-spec.ts chat-channel-trigger-create.e2e-spec.ts` → DB 부재로
  런타임은 전부 `getaddrinfo ENOTFOUND postgres` 실패이지만, **ts-jest 컴파일 단계는 통과**했다
  (컴파일 에러였다면 DB 접속 이전에 그 에러가 떴을 것) — `tsconfig.build.json` 이
  `test/`·`*spec.ts`·`src/repo-guards/**`·`src/shared/testing/**` 를 전부 exclude 해 빌드
  ratchet 이 이 6 개 파일 중 어느 것도 typecheck 하지 않는다는 것을 먼저 확인했기 때문에, 이
  대체 경로로 신규 `expectTriggerWorkflowRef` 호출 3곳의 타입 정합을 검증했다.
- `CANONICAL_SOURCE`/`MIRROR_SOURCES` 가 가리키는 세 파일과 상수(`TRIGGER_RESPONSE_STRIP_COLUMNS`,
  `TRIGGER_SECRET_COLUMNS` ×2)가 실제로 존재함을 grep 으로 확인.
- `readStringArrayConst` 의 분기 ↔ 대조군 대응표(7행)를 실제 `it()` 목록과 1:1 대조.

이 배치는 이미 `/ai-review` 5라운드(11_27_40·11_52_13·12_17_14·12_37_01·13_04_49)를 거치며
vacuous 삼항식·미영속 방어 분기·문서한 보장(3항 중 2항만 잠김)·분기표 누락 대조군을 각각
CRITICAL 급 엄밀도로 찾아 고쳤고, 매 라운드 뮤테이션 전/후 실측이 RESOLUTION.md 에 남아 있다.
아래는 그 위에서 **이번 라운드에 처음 보는 관점**만 추가한 것이다 — 이미 처분된 항목은
재-flag 하지 않는다.

## 발견사항

- **[INFO]** `GET /api/triggers/:id`(단건 조회) 의 schedule 타입 `TriggerDto.workflow` 양성
  커버리지가 0건이다 — 재확인했지만 새 결함 아님.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` (파일 전체에 단건 GET 호출 없음,
    `grep "get(.*api/triggers/" ` 0건)
  - 상세: `plan/in-progress/trigger-canary-hardening.md` 104행이 *"이 파일에 단건
    `GET /api/triggers/:id` 는 없다 — 그래서 셋이다"* 라고 스스로 스코프를 좁혔고,
    `RESOLUTION.md`(11_27_40 INFO#2, 12_17_14 INFO#6)가 *"은폐 아니라 plan 이 스스로 좁힌
    스코프"* 로 이미 처분했다. 목록(C-2)·PATCH(G·H) 세 자리는 실제 코드로 잠겨 있으므로
    실질 회귀 방어는 있다 — 다만 "단건 조회" 라는 네 번째 응답 경로 자체는 이 트리거 타입에서
    한 번도 실측된 적이 없다는 사실은 남는다.
  - 제안: 조치 불필요(이미 트래커에 등재·처분됨). 다음에 이 파일을 다시 만지는 사람이 "3자리
    전부 커버됨"으로 오독하지 않도록, 트래커 포인터가 파일 헤더 docstring(25~30행)에도 있으면
    더 안전하지만 이는 문서 스타일 취향이라 강제하지 않는다.

- **[INFO]** `readStringArrayConst` 는 동일 이름의 지역/중첩 선언과 대상 최상위 `const` 를
  구분하지 않는다 — 이미 처분된 한계이나 코드 자체가 이번 라운드에도 그대로 남아 있어 재확인.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` `visit`
    함수 (`node.name.text === constName` 매칭 조건, `ts.isVariableDeclaration` 분기)
  - 상세: AST 를 깊이 우선으로 순회하며 스코프 구분 없이 이름만 비교하므로, 만약 대상 파일
    함수 본문 안에 같은 이름의 지역 변수가 먼저 등장하면 그것을 정본으로 오독할 수 있다.
    `RESOLUTION.md`(12_17_14 INFO#5, 12_37_01 INFO#4)가 "대상 3파일에는 해당 없음, 다음 접촉
    시 재고"로 이미 유예했고 지금도 대상 3파일에는 동명 지역 선언이 없어 실질 위험은 0이다.
    새 결함이 아니라 이전 유예의 유효기간이 아직 남아 있음을 재확인하는 차원.
  - 제안: 없음(이미 유예 처분됨). 새 사본(4번째 `MIRROR_SOURCES` 항목)이 추가되는 시점에
    재검토 대상.

- **[INFO, 긍정 확인]** `readStringArrayConst` 의 분기 ↔ 대조군 대응표(7행)가 실제 `it()`
  9개와 어긋남 없이 1:1 대응한다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts:96-225`
  - 상세: 표의 7행(부재→throw, 선언없음→null, 배열아님→null, 비문자열혼입→null, 정상값,
    `as const satisfies`, 괄호)이 각각 `it('대상 파일이 없으면…')`, `it('선언이 없으면…')`,
    `it('선언은 있는데 배열이 아니면…')`, `it('문자열이 아닌 원소가…')`, `it('래퍼가 없어도…')`,
    `it('as const satisfies… 도 벗긴다')`, `it('괄호로 감싼 선언도…')` 와 정확히 짝지어져
    빠진 분기가 없다. `.toThrow()` 단독이 아니라 메시지 정규식(`/옮겨졌거나 이름이 바뀌었다/`)
    으로 판별해, 이 저장소가 반복 지적한 "`.toThrow()` 는 무엇이 던졌는지 안 본다" 함정도
    실제로 피했다(직접 재실행해 GREEN 확인).
  - 제안: 없음.

- **[INFO, 긍정 확인]** e2e 신규 단언 3곳(`schedule-trigger.e2e-spec.ts` C-2·G·H)은 서로 다른
  독립 시나리오(목록 조회·PATCH 비활성·PATCH 재활성)에 각각 배치되어 있고, 각 `it()` 이
  스케줄 생성부터 단언까지 자기 완결적이라(다른 테스트의 side effect 에 의존하지 않음) 테스트
  격리에 문제가 없다. `expectTriggerWorkflowRef` 는 시그니처·구현 모두 이번 diff 밖(변경 없음)
  이라 새 mock 도입 없이 기존 실제 HTTP 응답을 그대로 검증한다 — mock 과 실제 동작의 괴리 없음.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:237-281`(C-2),
    `:388-396`(G), `:424-433`(H)
  - 제안: 없음.

## 요약

핵심 신규 테스트 자산(`trigger-secret-columns-guard.ts`/`.spec.ts`)은 이미 5라운드에 걸친
`/ai-review` 뮤테이션 검증으로 분기표 7행 전부가 대조군을 가지며, 직접 재실행한 결과도
12/12 GREEN 으로 그 상태를 재확인했다. e2e 3파일의 변경은 주석 정정(4·6) + 기존 헬퍼 재사용
단언 3곳(schedule-trigger) 추가뿐이라 회귀 위험이 낮고, DB 없는 환경에서도 ts-jest 컴파일
통과로 타입 정합을 별도 경로로 확인했다. 남은 갭(단건 GET schedule workflow 0건, 동명 지역
선언 미구분)은 둘 다 이전 라운드에서 이미 실측·처분되어 트래커/코드 주석에 등재된 상태이고,
이번 재확인에서도 상태가 바뀌지 않았다 — 새로운 Critical/Warning 은 없다.

## 위험도

LOW
