# 요구사항(Requirement) 리뷰

대상: `git diff origin/main..HEAD` (2 커밋: `a1e2ec8af` fix(frontend), `e6e0fdc0d` docs(review))
실질 코드 변경 파일: `codebase/frontend/eslint.config.mjs`, `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts`
(나머지 13개 파일은 `review/code/2026/07/17/18_06_36/**` — 선행 ai-review 세션 산출물 문서/JSON, 애플리케이션 로직 없음)

## 배경 확인

이 브랜치는 `review/code/2026/07/17/17_29_21/SUMMARY.md` WARNING #1(flat config 병합 의미론 미반영)·#2(bare 형태 부재)·#3(정규식 중복) 및 후속 자체 리뷰(`18_06_36`) WARNING #1(severity 강등 미탐지)의 해소 커밋이다. 각 항목을 코드 레벨에서 독립적으로 재검증했다.

- **W#3 (정규식 중복)**: `COMPONENTS_PATH_RE = String.raw\`^(@\/components(\/.*)?|(\.\.\/)+components(\/.*)?)$\`` 로 상수화 후 두 selector(`ImportExpression`, `CallExpression`)가 템플릿 리터럴로 공유. `String.raw` 의 raw 문자열과 기존 두 인라인 문자열 리터럴(`"...\\/..."`)이 JS 파싱 후 산출하는 문자 시퀀스가 바이트 단위로 동일함을 직접 검증(둘 다 최종적으로 `\/`, `\.\.\/` 리터럴 백슬래시-문자를 담음) — 순수 리팩터, 동작 회귀 없음. **해소 확인**.
- **W#1 (flat config "나중 블록 우선" 병합)**: `layeringBlock`(단수 `.find`) → `layeringBlocks`(복수 `.filter`) + `Object.assign({}, ...layeringBlocks.map(...))` 로 병합. `Object.assign` 은 좌→우 순서로 뒤 소스가 앞 소스를 rule-key 단위로 덮어쓰므로 flat config 의 실제 병합 동작(뒤 override 가 이긴다)과 일치. 현재 `eslint.config.mjs` 구조(단일 `files: ["src/lib/**"]` 블록이 배열 최후미)에서는 이 시뮬레이션이 정확하다. **해소 확인**.
- **W#2 (bare 형태 부재)**: `it.each` 에 `import "@/components";` / `import "../components";` / `import("@/components")` / `require("../components")` 4건 추가, 대응 근접 오탐(negative) 케이스도 `@/components-legacy/x`, `../componentsShared/x` 2건 추가. 정규식 `^(...)$` 앵커 특성상 `components-legacy`/`componentsShared` 는 `(\/.*)?$` 나 종료 앵커에 매칭되지 않아 "no error" 기대와 실제 동작이 일치. **해소 확인**.
- **18_06_36 WARNING #1 (severity 강등 미탐지)**: (a) `mergedRules["no-restricted-imports"|"no-restricted-syntax"]` 의 severity 를 `ruleSeverity()` 로 직접 assert, (b) `layeringErrors()` 의 실제 `Linter#verify()` 출력 `message.severity === 2` 를 위반 케이스 전건에서 assert. (b) 는 ESLint 가 config 표기(문자열/숫자)와 무관하게 lint message 의 `severity` 를 항상 0/1/2 로 정규화해 내보내므로 config 표기법에 의존하지 않는 견고한 탐지 경로다. 이 테스트가 `eslint.config.mjs` 실 파일을 로드하므로, 프로덕션 config 에서 실제로 severity 가 다운그레이드되면 unit test 단계에서 직접 실패한다(별도 mutation 시뮬레이션이 아니어도 회귀 시 자동 감지). **해소 확인**.

## 발견사항

- **[INFO]** `ruleSeverity()` 주석이 실제 구현보다 넓은 범위(정규화)를 주장 — "문자열/숫자 어느 표기든" 부분은 실질적으로 미구현
  - 위치: `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:297-301`
  - 상세: 주석 "규칙 배열의 첫 원소(severity)를 문자열/숫자 어느 표기든 정규화해 꺼낸다"는 마치 `2`(숫자) 와 `"error"`(문자열)를 동등하게 취급하도록 정규화한다는 인상을 주지만, 실제 구현은 `Array.isArray(rule) ? rule[0] : rule` 로 **배열 래핑만 해제**할 뿐 값 자체(`"error"` vs `2`)는 정규화하지 않는다. 현재 `eslint.config.mjs` 는 항상 `"error"` 문자열 리터럴만 쓰므로 지금 당장 오작동하지는 않지만, 만약 향후 누군가 규칙을 `[2, {...}]` (ESLint flat config 상 `"error"` 와 완전히 동등한 숫자 표기)로 무해하게 바꾸면 `expect(ruleSeverity(mergedRules[...])).toBe("error")` 단정이 실제로는 아무 것도 다운그레이드되지 않았음에도 **거짓 실패(false-fail)** 한다. 다행히 실패 방향이 fail-loud(안전한 쪽, 실제 취약점을 놓치는 fail-open 이 아님)이고, 같은 케이스에서 `layeringErrors()` 의 `m.severity === 2` 검증(ESLint 가 내부적으로 항상 숫자로 정규화해 내보내는 실제 lint message 기반)은 이 문제에 영향받지 않아 회귀 탐지 자체의 신뢰성은 유지된다.
  - 제안: 주석에서 "문자열/숫자 어느 표기든 정규화" 문구를 제거하거나, 실제로 `rule === 2 || rule === "error"` 형태의 동등성 정규화를 구현해 주석과 일치시킨다. 우선순위 낮음(현재 오작동 없음, 코멘트 정확성 이슈).

- **[INFO]** (spec fidelity, 신규 갭 아님) `src/lib → components` 레이어 경계 규약을 다루는 전용 `spec/conventions/*.md` 문서가 여전히 부재
  - 위치: N/A — `spec/conventions/` 전수 grep 결과 관련 문서 없음 (직접 확인: `frontend-layering`, `layering`, `src/lib` 관련 convention 문서 검색 결과 0건)
  - 상세: 요구사항 리뷰 관점 #9(spec fidelity) 기준, 이 diff 의 대상 로직(레이어 역전 금지 규칙)을 정의하는 spec 문서 자체를 찾지 못했다 — 다만 이는 이번 diff 가 새로 만든 갭이 아니라 선행 리뷰(`review/code/2026/07/17/17_29_21/SUMMARY.md` WARNING#4)에서 이미 식별·`project-planner` 위임 트래킹 중인 항목이며, 이번 두 커밋의 실제 diff 범위(정규식 상수화 + 테스트 정밀도 보강)와는 직접 충돌하지 않는다.
  - 제안: 조치 불요(이번 diff 범위 아님). 기존 트래킹(선행 리뷰 WARNING#4, `project-planner` 위임)이 유효하므로 중복 이슈 생성 불필요.

- **[INFO]** TODO/FIXME/HACK/XXX 주석 없음 — `git diff origin/main..HEAD -- codebase/` 전수 grep 결과 0건. 미완성 작업 시사 표식 없음.

## 반환값·에러 시나리오·엣지 케이스 체크 (요약)

- `ruleSeverity()` 는 배열/비배열 모든 입력 경로에서 값을 반환(undefined 케이스 포함 — 규칙 키 부재 시 `mergedRules[key]` 가 `undefined` 이고 `ruleSeverity(undefined)` → `undefined`, `toBe("error")` 로 명확히 실패해 진단 가능. 조용한 통과 없음).
- fail-open 가드(`Object.keys(mergedRules).length === 0`) 는 "블록 미발견" + "블록은 있으나 rules 병합 결과가 빈 객체" 두 조건을 모두 포괄하도록 정확히 확장됨(코드 로직은 정확, 에러 메시지 문구만 약간 뭉뚱그려짐 — 이미 maintainability 리뷰 INFO 로 캡처됨, 기능적 결함 아님).
- `errors.every((m) => m.severity === 2)` 는 선행 라인의 `expect(errors.length).toBeGreaterThan(0)` 덕분에 빈 배열의 vacuous-truth 함정에 걸리지 않음 — 검증됨.
- 근접 오탐(false-positive) 방지 정규식 앵커(`^...$`)가 `components-legacy`/`componentsShared` 를 정확히 배제함을 정규식 수동 트레이스로 재확인.

## 요약

두 실질 코드 파일(`eslint.config.mjs`, `eslint-layering-guard.test.ts`)의 변경은 선행 리뷰에서 지적된 WARNING #1(flat config 병합 의미론 미반영)·#2(bare 형태 사각지대)·#3(정규식 중복), 그리고 후속 자체 리뷰의 WARNING(severity 강등 미탐지)을 모두 정확하고 완전하게 해소한다 — 각 항목을 정규식 바이트 동등성 대조, 글롭/정규식 수동 트레이스, 테스트 케이스 개수 교차검증(RESOLUTION.md 의 "23/23", mutation fail 건수 등)으로 독립 재확인했으며 전부 일치했다. TODO/FIXME 등 미완성 표식은 없고, 모든 함수가 모든 경로에서 적절한 값을 반환한다. 유일한 신규 발견은 `ruleSeverity()` 주석이 실제보다 넓은 정규화 범위를 주장하는 경미한 comment-implementation 불일치(INFO, fail-loud 방향이라 실사용상 위험 낮음)이며, spec 문서 부재는 이미 별도 트래킹 중인 기존 갭으로 이번 diff 의 신규 결함이 아니다. Critical/Warning 급 요구사항 미충족 사항은 발견되지 않았다.

## 위험도

NONE
