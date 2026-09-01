# 유지보수성(Maintainability) 리뷰 — 엔진 에러 코드 앵커링 (`EngineErrorCode`)

## 검증 방법

저장소 뮤테이션 없음(read-only). `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts`,
`engine-error-code-anchor.spec.ts` 는 diff 가 잘려 있어(파일 7) `Read` 로 현재 전체 소스를 직접
열어 확인했다. 이 diff 는 세 번째 리뷰 라운드(`20_59_14`)이며, 앞선 두 라운드
(`review/code/2026/08/31/20_27_29/`, `.../20_43_35/`)의 maintainability 리뷰·RESOLUTION 을
먼저 읽고 이미 지적·처분된 항목과 신규 항목을 구분했다.

## 발견사항

- **[INFO]** `collectBoundCodes` 안에서 "hit 기록" 로직이 두 곳에 중복 — 하나는 공용 `record()`
  클로저를 거치고, 하나(생성자 positional 인자 형태)는 거치지 않고 같은 로직을 다시 쓴다
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts` —
    `record()` 클로저 정의부(178~182행, `hits.push({ code: literal.text, file: …, line: … })`)와
    `NewExpression` 분기의 생성자 인자 루프(203~209행, `hits.push({ code: arg.text, file: …, line: … })`).
    두 블록은 `literal`/`arg` 라는 변수명만 다르고 `hits.push({ code, file, line })` 구성 로직이
    글자 그대로 동일하다.
  - 상세: `record()` 는 원래 3개 분기(객체 속성·변수/필드 선언·대입)의 hit 기록을 한 곳으로
    모으려고 도입된 헬퍼인데, 뒤이어(`20_43_35` W1 대응으로) 추가된 4번째 형태(생성자 positional
    인자)는 `record()` 가 요구하는 "바인딩 이름" 이 없어 재사용하지 못하고 push 로직을
    복사했다. `BareCodeHit` 의 필드 구성(`code`/`file`/`line` 산출식)이 바뀌면(예: 컬럼 정보
    추가, `line` 계산 방식 변경) 두 자리를 각각 손대야 하고, 한쪽만 고치면 조용히 갈라진다 —
    이 파일 자체가 "AST 처리 로직 형태별 반복이 다음 실패를 반복한다"는 교훈을 반복적으로
    docstring 에 남기고 있는데(정규식 1차 스캔의 실패, 앞선 라운드가 지적한 `unwrapAsExpression`
    2줄 중복), 같은 성격의 중복이 4번째 형태 추가 시 새로 생겼다.
  - 제안: `record()` 의 바인딩-이름 검사와 push 로직을 분리 — 예: `pushHit(literal: ts.Node): void`
    를 별도로 두고 `record(name, literal)` 이 이름 검사 통과 후 `pushHit` 을 호출하며, 생성자
    인자 분기도 같은 `pushHit` 을 직접 호출. 우선순위는 낮음(가드/테스트 전용 코드, 각 5줄
    내외의 지엽적 중복이며 두 자리 모두 같은 파일 60줄 내에 인접).

- **[INFO]** (재확인, 기존 처분 유지) `unwrapAsExpression` 패턴과 픽스처 디렉터리 경로 리터럴
  중복이 여전히 존재
  - 위치: `ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer`
    가 `readDeclaredCodes`(86~88행)와 `collectBoundCodes` 의 `VariableDeclaration`/
    `PropertyDeclaration` 분기(193~195행)에 반복. `'codebase/backend/src/repo-guards/__tests__'`
    문자열이 `engine-error-code-anchor.spec.ts:72,111` 에 두 번 리터럴로 반복.
  - 상세: 둘 다 `20_43_35` 라운드 maintainability 리뷰가 이미 지적했고, RESOLUTION 에 "우선순위
    낮음 — 세 번째 소비처가 생기는 시점이 자연스러운 착수 지점" 이라는 근거로 의도적으로
    미조치 처리됐다. 현재도 소비처가 2곳뿐이라 그 트리거 조건이 아직 충족되지 않았다 — 재지적이
    아니라 상태 변화 없음을 확인한 기록.
  - 제안: 조치 불요(기존 판단 유지). 3번째 소비처가 생기면 그때 공용 헬퍼로 추출.

이 외 CRITICAL/WARNING 급 발견 없음. 확인한 긍정적 포인트:

- 리터럴 9곳 → 상수 참조 치환(`ai-turn-orchestrator.service.ts`/`execution-engine.service.ts`/
  `shutdown-state.service.ts`)은 각각 한 줄 치환이며 함수 길이·중첩·복잡도에 영향이 없다.
- `EngineErrorCode` 신설 JSDoc(`error-codes.ts`)이 "왜 파일을 안 나눴는가"(SoT 분열 방지)와
  "왜 const 는 나눴는가"(기존 `ErrorCode` docstring 계약 범위 준수)를 근거와 함께 남겨, 다음
  사람이 같은 질문을 반복하지 않게 했다. 네이밍(`EngineErrorCode`/`EngineErrorCodeValue`)도
  기존 `ErrorCode`/`ErrorCodeValue` 컨벤션(UPPER_SNAKE 값, `as const`, `*Value` 파생 타입)을
  그대로 계승한다.
- `collectBoundCodes` 의 `visit` 함수는 4개 AST 노드 종류를 분기하는 dispatcher 라 분기 수는
  있지만 각 분기가 짧고 독립적이며, 순환 복잡도가 재귀 트리 walker 로서는 합리적인 수준이다.
  매직 넘버(`declared.size > 30`, `reason.length > 20`)는 왜 그 값인지 실측치와 함께 인라인
  주석으로 근거가 남아 있다(전 라운드에서 반영 확인).
- `ANCHORED_ELSEWHERE` 예외 목록은 사유 길이·dead-entry 검증 테스트로 "봐주기" 도피처가 되지
  않도록 강제한다 — 정책을 코드로 강제하는 설계.
- 신규 가드 3파일(guard/fixture/spec) 구성이 저장소 기존 형제 패턴(`redis-fail-open-catalog-guard.ts`)
  을 그대로 따라 일관성이 높다.

## 요약

이번 라운드에서 실질적으로 새로 발견된 것은 `collectBoundCodes` 내부에 4번째 형태(생성자
positional 인자, 직전 라운드 W1 대응으로 추가됨)가 `record()` 헬퍼를 우회하고 hit 구성 로직을
복사한 5줄 내외의 지엽적 중복 1건뿐이다 — 앞선 두 라운드가 지적한 `unwrapAsExpression`/픽스처
경로 중복은 여전히 존재하지만 이미 근거와 함께 의도적으로 미조치 처리된 상태로, 상태 변화가
없음을 재확인했다. 나머지 변경(9지점 리터럴→상수 리다이렉트, `EngineErrorCode` 신설)은 순수
기계적 치환이라 가독성·함수 길이·중첩·복잡도 어느 축에서도 새 위험이 없고, 네이밍·주석·기존
가드 패턴과의 일관성은 높은 수준을 유지한다. 발견 사항은 전부 INFO 이며 가드/테스트 전용
코드의 지엽적 중복이라 실제 유지보수 비용에 미치는 영향은 작다.

## 위험도

NONE
