# 유지보수성(Maintainability) 리뷰

리뷰 대상 중 코드(가독성/네이밍/함수 길이/중첩/매직 넘버/중복/복잡도) 관점이 실질적으로
적용되는 파일은 `codebase/backend/src/modules/websocket/websocket.service.ts` 와
`codebase/backend/src/modules/websocket/websocket.service.spec.ts` 뿐이다. 나머지
(`CHANGELOG.md`, `plan/in-progress/*.md`, `review/**/*.md|json`)는 계획·리뷰 산출물
문서라 이 관점의 적용 대상이 아니다(선행 두 라운드 `10_32_27`·`11_02_16` 의 판단과 동일).

이번 라운드(`12_06_20`)는 직전 라운드(`11_02_16`) CRITICAL 1(경계 연산자 `>=` vs `>`
불일치)에 대한 조치 커밋(`b49ee4310`)이 반영된 이후 상태를 검토한 것이다. 그 커밋이
추가한 것은 (1) `stripDeep` 의 경계 연산자를 `>=`→`>` 로 1글자 수정 + 인라인 코멘트,
(2) 깊이 0·5·8·9·10·11·12 를 sweep 하는 신규 `it.each` 회귀 테스트다. 직전 라운드까지
지적됐던 "할당 없음 주장이 구현보다 넓다"(`10_32_27` W3)·"깊이 상한 없음"(W4) 은 이미
`out: T | null = null` lazy clone-on-write 패턴(`websocket.service.ts:396`, `:407`)과
`MAX_SANITIZE_DEPTH` 캡(`:393`)으로 해소된 상태를 재확인했고, 재차 지적하지 않는다.

## 발견사항

- **[WARNING]** 신규 `it.each` 테스트가 사용하는 깊이 값이 `MAX_SANITIZE_DEPTH` 상수가 아니라
  리터럴로 하드코딩돼 있고, 이는 **같은 파일의 6백 줄 앞에 있는 자매 테스트가 명시적으로
  피하라고 써 둔** 패턴이다 (매직 넘버 · 일관성)
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:819`
    (`it.each([0, 5, 8, 9, 10, 11, 12])(`) — 대조: `:203`(주석 "MAX_SANITIZE_DEPTH 를
    초과하는 깊이 페이로드 끝에 credential 을 박아 통째 마스킹이 되는지 검증. **상수
    변경 시 자동 추적되도록 매직넘버 대신 import.**"), `:205`(`for (let i = 0; i <
    MAX_SANITIZE_DEPTH + 2; i++) deep = { next: deep };`)
  - 상세: `sanitizePayloadForWs` 의 depth 경계 테스트(`:199`)는 `MAX_SANITIZE_DEPTH + 2`
    처럼 **상수 상대값**으로 깊이를 구성해, 상수가 바뀌어도 항상 "상한을 2 넘는 지점"을
    정확히 겨냥한다. 반면 이번에 추가된 `it.each([0, 5, 8, 9, 10, 11, 12])`(`:819`)는
    `MAX_SANITIZE_DEPTH`(현재 10)의 경계를 겨냥하려는 의도가 테스트 바로 위 JSDoc
    표(`:810-813`)에 명시돼 있음에도, 실제 배열은 리터럴 숫자로만 적혀 있다. 지금은
    상수값(10)과 리터럴이 우연히 맞아떨어지지만, `MAX_SANITIZE_DEPTH` 가 예컨대 8 로
    바뀌면 이 테스트의 8·9·10·11·12 는 더 이상 "경계 부근"이 아니라 "이미 한참 지난
    영역"이 되어 판별력을 잃는다 — 그런데도 테스트 자체는 여전히 통과하므로(값이 이미
    `[REDACTED_DEPTH]` 로 치환된 영역만 반복 검증) 이 테스트가 더 이상 경계를 검증하지
    않는다는 사실이 조용히 드러나지 않는다. 이 저장소 메모리에 반복 기록된 "판별력 없는
    fixture" 패턴과 같은 종류이고, 같은 파일 안에 정답 패턴(`:205`)이 이미 있다는 점에서
    더 아프다.
  - 제안: `it.each([0, 5, 8, 9, 10, 11, 12])` 를 `MAX_SANITIZE_DEPTH` 기준 상대값
    (예: `[0, MAX_SANITIZE_DEPTH - 5, MAX_SANITIZE_DEPTH - 2, MAX_SANITIZE_DEPTH - 1,
    MAX_SANITIZE_DEPTH, MAX_SANITIZE_DEPTH + 1, MAX_SANITIZE_DEPTH + 2]`)으로 바꿔
    `:203` 의 관례를 그대로 따르게 한다.

- **[WARNING]** 신규 `it.each` 테스트의 JSDoc 이 "`stripDeep` 은 `depth >=
  MAX_SANITIZE_DEPTH` 에서 멈추고 형제는 `depth >` 에서 치환한다 — 경계 연산자가
  다르다"고 **현재형**으로 서술하는데, **같은 커밋**이 `stripDeep` 의 연산자를 `>=`→`>`
  로 바꿔 그 불일치를 없앴다 — 테스트 코드에 처음부터 stale 서술이 실린 셈이다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.spec.ts:798-800`
    (`* \`stripDeep\` 은 \`depth >= MAX_SANITIZE_DEPTH\` 에서 멈추고 형제 …`) — 실제
    코드: `codebase/backend/src/modules/websocket/websocket.service.ts:393`
    (`if (depth > MAX_SANITIZE_DEPTH) return value;`, 형제와 동일 연산자)
  - 상세: 이 JSDoc 블록과 `stripDeep` 의 연산자 수정은 **같은 커밋**(`b49ee4310`)에
    함께 랜딩됐다. 커밋이 만든 최종 상태에서는 두 함수의 경계 연산자가 이미 `>` 로
    통일돼 있는데, 테스트 파일 안의 이 문장만은 "경계 연산자가 다르다"는 (수정 전)
    사실을 과거형 표시 없이 그대로 서술한다. 바로 위 프로덕션 코드의 인라인 주석
    (`websocket.service.ts:388-392`)은 같은 사건을 "종전 `>=` 는 형제보다 한 단계
    얕게 멈춰 …" 처럼 명시적 과거형으로 적어 현재 상태와 헷갈리지 않게 했지만, 테스트
    JSDoc 은 그 구분이 없다. 이 테스트 파일만 단독으로 읽는 유지보수자는 "지금도
    `stripDeep` 이 `>=` 를 쓴다"고 오해하기 쉽고, 이는 이 프로젝트가 반복적으로 지적해
    온 "문서한 진술이 실제 구현과 어긋난다" 패턴이 **테스트 코드 안에서, 도입 시점부터**
    재현된 사례다(성격은 반대 방향 — 여기서는 이미 고쳐진 결함을 아직 존재하는 것처럼
    서술).
  - 제안: 해당 문장을 "종전엔 `stripDeep` 이 `depth >= …`, 형제는 `depth > …` 로 서로
    달랐다(이 커밋에서 `>` 로 통일)"처럼 과거형+정정 사실을 명시하거나, 통일 이후
    시점의 서술로 다시 쓴다. 이력 서사는 그대로 남기되 "지금은 이렇다"를 분리해서 적으면
    충분하다.

- **[INFO]** 경계 연산자 통일이라는 같은 서사가 함수 JSDoc(`:360`) · 함수 본문 인라인
  주석(`:388-392`) · 테스트 JSDoc(`:796-817`) 세 곳에 중복 서술된다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:360`,
    `:388-392`; `codebase/backend/src/modules/websocket/websocket.service.spec.ts:796-817`
  - 상세: 이 저장소는 이미 무거운 주석 관례(리뷰 라운드 tag·근거 링크 포함)를 갖고
    있어 즉각적인 문제는 아니지만, 세 곳 중 한 곳만 갱신되고 나머지가 stale 로 남는
    사고(바로 위 WARNING 이 실제로 그 사례)가 반복될 표면이 넓어진다.
  - 제안: 필수 조치 아님. 다음에 이 경계 로직을 다시 건드릴 때 세 곳을 함께
    갱신하는 것으로 충분.

## 확인했으나 문제 없음 (positive findings)

- `stripDeep` 의 경계 연산자 수정(`>=`→`>`, `:393`) 자체는 1글자 diff 로 정확히
  형제 함수(`sanitizePayloadForWs:251`)와 일치시켰고, 부작용 없는 최소 변경이다.
- `it.each([0, 5, 8, 9, 10, 11, 12])` 테스트 자체의 본문 로직(깊이만큼 중첩 후
  `llmCalls` 배치 → fanout JSON 에 marker 부재 단언)은 간결하고 명확하며, 파라미터화
  테스트 이름(`'depth %i …'`)도 Jest 관례를 따른다. 위 WARNING 은 파라미터 값의
  출처(리터럴 vs 상수)에 대한 것이지 테스트 구조 자체의 문제는 아니다.
- `stripDeep` 함수 길이(약 30줄, `:387-421`)·중첩 깊이(배열/객체 분기 각 2단계)는
  이전 라운드 대비 변화 없고 여전히 양호한 수준이다.

## 요약

이번 라운드의 코드 변경은 직전 라운드 CRITICAL(경계 연산자 불일치)을 형제 함수와
정확히 맞추는 1글자 수정과, 그 판단을 실제 파이프라인으로 검증한 깊이 sweep 회귀
테스트 추가로 매우 좁게 스코프돼 있고, 연산자 수정 자체는 흠잡을 데 없다. 다만 새로
추가된 테스트에서 두 가지 유지보수성 결함이 함께 들어왔다 — (1) 깊이 경계값을
`MAX_SANITIZE_DEPTH` 상수가 아니라 리터럴로 하드코딩해, 같은 파일에 이미 있는 "상수
변경 시 자동 추적되도록 매직넘버 대신 import" 관례(`:203`)를 어겼고 상수가 바뀌면
조용히 판별력을 잃는다. (2) 같은 커밋이 고친 연산자 불일치를 테스트 JSDoc 이 여전히
현재형 "다르다"로 서술해, 테스트 코드 자체가 도입 시점부터 stale 서술을 안고
시작한다. 둘 다 동작 결함은 아니고 테스트 자체는 유효하지만, 다음 유지보수자가 이
파일만 읽고 오판할 수 있는 지점이라 WARNING 으로 기록한다. 그 외 함수 길이·중첩·
네이밍·중복 등은 이전 두 라운드에서 지적된 항목이 이미 정확히 해소된 상태를
재확인했고 새로운 문제는 없다.

## 위험도

LOW
