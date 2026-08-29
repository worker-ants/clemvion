# 요구사항(Requirement) 리뷰 — `#1233` 후속 라운드 (11_58_35 리뷰의 RESOLUTION)

## 검증 방법

- `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts` ·
  `codebase/backend/src/nodes/data/code/code.handler.spec.ts` · `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` ·
  `plan/in-progress/deps-peer-gating-and-eslint10.md` 를 Read 로 전체 열람.
- `codebase/packages/expression-engine/src/errors.ts` / `evaluator.ts` / `index.ts` 를 직접 읽어
  `ExpressionError` 서브클래스(`SyntaxError`/`ReferenceError`/`TypeError`)의 own property 구성과
  `position` 인자 전달 여부를 확인.
- scratch 디렉터리(`/private/tmp/claude-501/.../scratchpad/probe_position.mjs`, 저장소 밖)에서
  `evaluate()` 를 직접 호출해 세 fixture(`{{ $input. }}` / `{{ $input.nonExistent.deep }}` /
  `{{ $input.count.b.c }}`)가 실제로 `ExpressionSyntaxError`/`ExpressionReferenceError`/
  `ExpressionTypeError` 로 갈라지는지, `code`/`position` 값이 캐너리 화이트리스트·모양 단언과
  일치하는지 실측 재현.
- `npx jest expression-resolver.service.spec.ts` / `code.handler.spec.ts` 를 직접 실행해 plan 문서가
  주장하는 "137 tests" (47+90) 를 재현.
- `spec/5-system/3-error-handling.md` §6.3.1 본문·Rationale 을 읽어 `secret-resolver.service.ts`
  신규 주석 문단과 line-level 대조.
- `git diff origin/main --stat` / `git status --short` 로 저장소 상태 확인. 저장소 트리에는 쓰지 않았고
  (probe 는 scratch 에서 저장소 밖 dist 파일을 import 만 함), 위 jest 실행도 read-only.

## 관측 — 병렬 리뷰어의 일시적 뮤테이션 (저장소 트리, 본 리뷰와 무관)

리뷰 도중 `codebase/packages/expression-engine/src/errors.ts` 를 다시 열었을 때 `FunctionError` 에
`attemptedFunctionSource` 필드가 주입된 상태를 시스템 알림으로 관측했다 — 본 리뷰어가 넣은 변경이
아니다(어떤 Write/Edit 도 실행하지 않았음). 병렬로 도는 다른 reviewer(아마 testing/security)의
뮤테이션 검증으로 보인다. 재확인 시점(`git status --short`, `git diff -- .../errors.ts`)에는 이미
원복되어 clean 이었다 — 조치 불요. 원칙(뮤테이션 관측 시 보고)에 따라 기록만 남긴다.

## 발견사항

이번 diff(코드 3파일 + plan 문서)는 직전 리뷰 라운드(`review/code/2026/08/29/11_58_35`)가 지적한
WARNING 3건에 대한 RESOLUTION 커밋이다. 세 건 모두 실측으로 재검증했고, 전부 **완전히 해소**됐다 —
CRITICAL/WARNING 없음.

- **[확인 — WARNING #1 해소 검증됨]** "4개 오류 종류" 과대 서술 + syntax-error 1종만 코드화됐던 갭
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:183-220`
  - 상세: "4개" 문구는 제거되고 "세 하위 클래스 전부"로 정정됐다(`grep -n "4개" <파일>` = 0건).
    `it.each` 가 `ExpressionSyntaxError`/`ExpressionReferenceError`/`ExpressionTypeError` 세 fixture를
    실제 실행 경로로 통과시키며, 각 케이스마다 `cause.name`(fixture 판별력) · `Object.keys(cause).sort()`
    (화이트리스트) · `code`/`position` 모양을 모두 단언한다. scratch 에서 `evaluate()` 를 직접 호출해
    세 fixture 가 정확히 문서가 주장하는 클래스·코드로 갈라짐을 재현했다: `{{ $input. }}` →
    `ExpressionSyntaxError`/`EXPR_SYNTAX_ERROR`/`position=11`(정수), `{{ $input.nonExistent.deep }}` →
    `ExpressionReferenceError`/`EXPR_REFERENCE_ERROR`/`position=undefined`, `{{ $input.count.b.c }}` →
    `ExpressionTypeError`/`EXPR_TYPE_ERROR`/`position=undefined`. `position` 이 Reference/Type 케이스에서
    `undefined` 인 것은 테스트의 결함이 아니라 실제 소스 사실이다 — `evaluator.ts` 의 `ReferenceError`/
    `TypeError` 생성 지점(11곳 확인) 중 **어느 곳도 `position` 인자를 전달하지 않는다**(`SyntaxError` 만
    tokenizer/parser 에서 `position` 을 넘긴다). 따라서 `shape.position === undefined ||
    Number.isInteger(shape.position)` 단언은 세 fixture 에 걸쳐 두 분기(정수/undefined)가 모두 실제로
    exercise 되며 착시(vacuous `||`)가 아니다. `npx jest expression-resolver.service.spec.ts` 재실행 —
    47/47 통과(이전 45 + `it.each` 신규 2건).
  - 제안: 없음 — 조치 완료 확인.

- **[확인 — WARNING #2 해소 검증됨]** plan 문서 "뮤테이션 5/5" 서술에서 M3 누락
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md:437`
  - 상세: M3(`캐너리 화이트리스트에서 position 제거`) 행이 표에 추가돼 M1~M5 다섯 행이 모두 서술된다.
  - 제안: 없음 — 조치 완료 확인.

- **[확인 — WARNING #3 해소 검증됨]** 캡처 보일러플레이트 중복
  - 위치: `expression-resolver.service.spec.ts:25-34`(`captureThrown`), `code.handler.spec.ts:15-24`
    (`captureRejected`)
  - 상세: 두 헬퍼가 vacuity 방지 단언(`expect(thrown).toBeInstanceOf(Error)`)을 품고 있고, 두 파일의
    `cause` 관련 4개 테스트(기존 2 + 신규 C2 캐너리 2) 전부가 헬퍼를 통해서만 `thrown`/`cause`를 얻는다.
    `grep`으로 두 spec 파일에 남은 `try {` 블록을 확인한 결과 나머지는 `$env`/`process.env` 관련
    `try/finally` 원복 패턴(무관)뿐이고, `cause` 캡처 목적의 수동 try/catch 는 남아 있지 않다 — 추출이
    누락 없이 전체 적용됐다.
  - 제안: 없음 — 조치 완료 확인.

- **[확인 — spec fidelity]** `secret-resolver.service.ts` 신규 문단이 §6.3.1 Rationale 과 line-level 일치
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:95-99`
  - 상세: 신규 문단 "§6.3.1 은 '소비처가 직렬화하는가' 를 기준으로 삼는 안을 명시적으로 기각했다"는
    `spec/5-system/3-error-handling.md` Rationale(575-586행) "기각한 쪽은 '지금 `.cause` 가 클라이언트로
    직렬화되는가' 다 ... 소비처가 바뀌면 무너진다" 서술과 정확히 대응한다. 판정축이 C1(위 문단)이라는
    서술도 §6.3.1 본문의 "C1 AND C2, 하나라도 어긋나면 붙이지 않는다"와 일치 — 코드가 spec 을 정확히
    반영한다. spec-drift 나 코드 오류 어느 쪽도 없음.

- **[INFO, 조치 불요 — 이미 추적 중]** 나머지 잔여 항목(`secret-resolver.service.ts` "형제 3곳"→4곳,
  "enumerable" 근거 서술 중복)은 이번 diff 의 unchanged context 이고, `plan/in-progress/
  deps-peer-gating-and-eslint10.md` §2(490-497행)에 이미 후속 항목으로 등재돼 있다(developer SKILL
  §수렴 예외 (a)(b)(c)(d) 충족 — 새 지적 아님, 재확인만).

## 요약

이번 diff는 직전 라운드(`11_58_35`)의 WARNING 3건(테스트 커버리지 폭 과대 서술, plan 뮤테이션 표
누락, 캡처 보일러플레이트 중복)에 대한 RESOLUTION이며, 세 건 모두 실제 소스·테스트 실행·spec 본문
대조로 재검증한 결과 완전히 해소됐다. `it.each` 확장이 진짜로 세 오류 클래스를 실행 경로로 통과시키는지
`evaluate()` 직접 호출로 재현했고, `position` 단언의 `undefined` 분기가 vacuous 가 아니라 실제
`ReferenceError`/`TypeError` 생성 지점이 `position` 을 전달하지 않는다는 소스 사실을 반영함을 확인했다.
`secret-resolver.service.ts` 신규 주석은 spec §6.3.1 Rationale 과 line-level 로 정확히 일치한다.
TODO/FIXME/HACK/XXX 신규 없음, 모든 코드 경로가 적절한 값/예외를 반환한다. CRITICAL·WARNING 없음.

## 위험도

NONE
