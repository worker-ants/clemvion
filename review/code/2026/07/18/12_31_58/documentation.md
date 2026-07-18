# 문서화(Documentation) 리뷰

## 스코프 노트

리뷰 대상 11개 파일 중 실질 코드/plan 변경은 파일 1-3(테스트 파일, `interaction-type-registry.ts`,
plan 문서)이다. 파일 4-11 은 `/consistency-check` 오케스트레이터가 생성한 리뷰 산출물(SUMMARY·
checker 리포트·meta.json)로, 프로젝트 관례상 `review/` 하위에 그대로 커밋되는 게 정상이며 그 자체가
보고서이므로 별도 JSDoc/README 요구사항이 적용되지 않는다. 아래 발견사항은 주로 파일 1-3 대상이다.

## 발견사항

- **[INFO]** (긍정) AST 가드 메커니즘 설명 JSDoc — 모범 사례
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts`
    `collectCodeStringLiterals` 함수 상단 JSDoc, self-test `describe` 블록 상단 주석
  - 상세: 이번 diff 가 추가한 "정규식 리터럴은 `RegularExpressionLiteral`이라 `StringLiteral`이 아니므로
    수집 대상에서 자동 제외된다"는 설명은 실제 구현(`ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node)`, 정규식 리터럴 분기 없음)과 정확히 일치함을 확인했다.
    `UUID_REGEX` 예시 인용도 실제로 `use-execution-events.ts:38`에 해당 상수가 존재해 근거가 있다.
    threat model(왜 정규식이 아니라 AST 파서인지)과 self-test 존재 이유(회귀 시 침묵하는 가드 방지)까지
    설명해 "왜"를 남기는 이 저장소의 Rationale 관례에 부합한다.
  - 조치 불요 — 참고 기록.

- **[INFO]** (긍정) "grep 가드" → "AST 가드" 주석 정정 — 정확한 오래된 주석 수정
  - 위치: `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` (모듈 상단 JSDoc,
    `IS_MULTI_TURN_INTERACTION` 위 JSDoc, 총 3곳)
  - 상세: 실제 가드 구현이 정규식 grep 이 아니라 `ts.createSourceFile` 기반 AST 파싱으로 이미 전환됐음에도
    주석이 옛 명칭("grep 가드")을 그대로 남겨두고 있던 오래된 주석(stale comment)이었다. 두 파일 모두에서
    `grep` 잔존 여부를 재검색해 확인한 결과 잔여 언급이 없다(전수 정정). spec
    (`spec/conventions/interaction-type-registry.md`)도 같은 날짜 커밋으로 이미 "AST 가드"/"AST(코드
    리터럴) 스캔" 용어에 수렴해 있어, 코드 주석·spec 용어·실제 구현 3자가 일치한다.
  - 조치 불요 — 참고 기록.

- **[WARNING]** plan 의 "harness task 로 분기" 주장에 추적 가능한 링크 부재
  - 위치: `plan/in-progress/interaction-type-guard-comment-false-negative.md` "후속" 섹션의
    `[harness, 비차단]` 항목, `[심각도 격상 2026-07-18]` 문단
  - 상세: 해당 문단은 "본 항목은 interaction-type-guard 작업과 무관한 harness 인프라 결함이라 **별도
    harness task 로 분기**(아래 종결 처리 참조) — 이 분기로 본 plan 의 종결 조건을 충족한다"고 서술한다.
    그러나 이 diff·현재 `plan/` 트리 어디에도 그 "별도 harness task" 를 가리키는 구체적 파일 경로나
    task 이름/ID 가 없다(저장소 전체를 검색해도 해당 번들링 결함을 다루는 신규 plan 파일이 발견되지
    않음). 체크박스 자체는 정직하게 `[ ]`(미체크) 로 남아 있어 "체크박스=실제 상태" 관례는 지켰지만,
    산문이 "분기로 종결 조건을 충족한다"고 현재형으로 단언하는 것과, 실제로는 아직 분기 대상 파일이
    존재하지 않는 상태 사이에 괴리가 있다 — 이후 이 plan 을 다시 여는 사람이 "그 harness task 어디
    있지?"를 추적할 수단이 없다.
  - 제안: (a) "분기" 를 실제로 수행할 때 그 결과물(`plan/in-progress/<harness-bundler-fix>.md` 등)의
    경로를 이 문단에 명시적으로 링크하거나, (b) 아직 분기가 실행 전이라면 "충족한다"(완료 서술)를
    "충족시킬 예정이다/분기가 필요하다"로 낮춰 상태를 정확히 반영. 이 항목은 BLOCK 대상이 아니며
    본 plan 이 `in-progress/`에 남아있는 근거 자체와도 모순되지 않으므로 후속 커밋에서 가볍게 정리 가능.

- **[INFO]** (스코프 밖, 참고용) `interaction-type-registry.md` frontmatter `code:` 글로브 누락
  - 위치: `spec/conventions/interaction-type-registry.md` frontmatter `code:` 목록
  - 상세: 리뷰 산출물(`rationale_continuity.md`, 파일 11)이 관찰한 내용을 교차 확인 — 해당 spec 의
    `code:` 글로브 목록에 이번 diff 의 실제 SoT 모듈인
    `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` 자체가 없다(§5 본문은 이
    파일을 SoT 모듈로 명시 인용함에도). 이번 diff 가 만든 drift 는 아니고 이미 존재하던 상태이며,
    spec 은 `developer` write-scope 밖이라 이 PR 범위에서 고칠 항목도 아니다.
  - 제안: 조치 불요 — `spec-coverage` 축의 사안으로 이미 별도 게이트에 위임됨(리뷰 산출물 파일 11 확인).
    참고 기록만 남김.

- **[INFO]** CHANGELOG 미갱신 — 적절
  - 위치: `CHANGELOG.md` (변경 없음)
  - 상세: 이 저장소의 `CHANGELOG.md`는 사용자 가시 동작 변경·버그 수정 위주로 기록되는 관례를 보인다
    (기존 항목들이 전부 기능/버그 fix). 이번 diff 는 주석 wording 정정 + 테스트 fixture 보강으로
    런타임 동작 변경이 없으므로 CHANGELOG 항목이 필요 없다는 판단이 기존 관례와 일치한다.
  - 조치 불요.

- **[INFO]** README/API 문서 — 해당 없음
  - 이번 diff 는 새 환경변수·설정 옵션·API 엔드포인트·공개 인터페이스를 도입하지 않는다(테스트 파일
    내부 헬퍼 함수·주석 wording 정정뿐). README/API 문서 갱신 필요성 없음.

## 요약

이번 변경은 실질적으로 "주석 정확성" 그 자체를 목적으로 하는 diff(스테일된 "grep 가드" 표현을 실제
구현에 맞는 "AST 가드"로 정정 + self-test fixture 보강)이며, 문서화 관점에서는 오히려 모범적이다 —
정정 전수 확인(잔여 "grep" 언급 0건), 새 fixture 케이스마다 "왜 이 케이스가 필요한가"를 주석으로 남겼고,
mutation 프로브로 각 케이스의 실효성까지 plan 문서에 기록했다. 유일한 개선 여지는 plan 문서의 harness
후속 항목이 "별도 task 로 분기했다"고 현재형으로 단언하면서도 그 task 를 추적할 구체적 링크가 없다는
점(WARNING) 이며, 이는 BLOCK 사유가 아니다. spec `code:` 글로브 누락은 이 diff 이전부터 있던 사안으로
스코프 밖이다.

## 위험도

LOW
