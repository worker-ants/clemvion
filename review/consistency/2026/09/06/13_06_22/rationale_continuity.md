# Rationale 연속성 검토 — `plan/in-progress/spec-draft-review-citations-enforcement.md`

## 검토 전제

target 은 `review-citations.md`/`spec-impl-evidence.md` 의 `## Rationale` 문구
("이 규약에는 시행하는 코드가 없다")가 신규 가드 `dto-jsdoc-citation-guard.ts` 로 반증됐다는
전제 위에서 **변경안 (A)(B)(C)** 를 제시하는 planner 초안이다. 두 spec 파일의 현재 원문
(`spec/conventions/review-citations.md`, `spec/conventions/spec-impl-evidence.md`)과 실제
가드 코드(`codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts` +
`dto-jsdoc-citation.spec.ts`)를 직접 읽어 target 의 인용·주장을 대조했다.

- "developer 가 못 고친다" 는 근거(그 문장을 developer 가 쓴 게 아님)는 `git blame` 으로
  실측 확인됨 — `90c1751e8` (2026-09-05, `#1287`)이 등재. 조작된 이력 아님.
- `review/consistency/2026/09/06/12_53_29` Critical 1건, `review/code/2026/09/06/12_28_02`
  W2 인용도 실제 존재 확인. 지어낸 선례 아님(`feedback_rationale_rejected_alternatives_need_history` 우려 해당 없음).

## 발견사항

- **[CRITICAL] 변경안 (A)·(B) 는 §3 "DTO·컨트롤러 JSDoc 카브아웃" 전체가 강제된다고
  주장하지만, 신규 가드는 DTO 쪽만 검사한다 — 같은 문서 안 변경안 (C) 와 자기모순**
  - target 위치: `plan/in-progress/spec-draft-review-citations-enforcement.md:27`
    (*"이제 §3(DTO·컨트롤러 JSDoc 카브아웃)을 AST 로 강제하는 코드가 있다"*),
    `:58` 의 표 (*"§3 (DTO·컨트롤러 JSDoc 카브아웃) | **예** — 위 가드"*)
  - 과거 결정 출처: `spec/conventions/review-citations.md` `## Rationale` 두 항목이
    명시적으로 세운 원칙 — *"`spec/**` 을 '위반 0건' 이라 적었다가 반증됐다"* (*"범위를
    넓히는 편집은 그 범위를 재는 일까지 포함한다"*) 와 *"이 수치를 처음 셀 때 거짓 0 을
    냈다"* (*"이 문서의 모든 수치는 그 절차를 거쳤다 — 0 은 언제나 '없다' 와 '못 찾았다'
    두 가지다"*). 이 문서 자체가 두 번의 실측-없는-주장 실패를 Rationale 로 박아 놓았다.
  - 상세: 실제로 `dto-jsdoc-citation-guard.ts` 의 `findDtoJsDocCitations` 는
    `isResponseDtoFile()` (`swagger-dto-contract-guard.ts` 의 `/dto/responses/` 매칭)로
    걸러진 파일만 스캔한다 — 컨트롤러 파일(`*.controller.ts`)은 대상이 아니다.
    `swagger.md §3` 은 `introspectComments: true` 가 DTO 뿐 아니라 컨트롤러 메서드 JSDoc 도
    `@ApiOperation` summary/description 으로 승격시킨다는 전제 위에서 "DTO·컨트롤러" 를
    함께 카브아웃 대상으로 묶었으므로, 컨트롤러 쪽 JSDoc 리뷰-인용 유출은 **여전히 사람이
    잡아야 하는 사각지대**로 남아 있다. 그런데 target 자신도 이를 알고 있다 — 같은 문서
    바로 아래 변경안 (C) (`:92`) 는 정확히 *"§3 의 **DTO 카브아웃**은 2026-09-06 이후
    강제된다"* 로 컨트롤러를 뺀 채 좁혀 쓴다. 즉 (A)/(B) 의 표는 넓게, (C) 의 문장은 좁게 —
    **같은 초안 안에서 같은 사실에 대해 두 가지 폭의 주장**이 공존한다. 이 상태로
    `review-citations.md`·`spec-impl-evidence.md` 양쪽 `## Rationale` 에 그대로 반영되면,
    이 PR 이 막으려 했던 바로 그 실패 양식(측정 없는 범위 확장 주장)이 §3 을 대상으로
    재발한다 — 그것도 "3번째 실패" 를 막으려던 문서 안에서.
  - 제안: (A) 의 표·서술에서 "§3 (DTO·컨트롤러 JSDoc 카브아웃)" 을 "§3 의 **DTO** 카브아웃"
    으로 좁히거나, 표를 DTO 행과 컨트롤러 행으로 분리해 컨트롤러 쪽을 "**아니오** — 컨트롤러
    JSDoc 은 여전히 사람이 본다" 로 명시한다. (B) 의 `code:` 등재 자체는 유지하되, 그 등재가
    커버하는 표면(§3 중 DTO 서브셋)을 Rationale 문구와 정확히 일치시킨다.

## 요약

target 은 developer 가 고칠 수 없는 이유(조건 1 미충족)를 정확히 진단했고, `git blame`·
`review/**` 인용 모두 실측으로 뒷받침되며, 취소선 보존 방식(변경안 A)도 CLAUDE.md 자기-반증형
소정정 관례를 그대로 따른다는 점에서 절차상 건전하다. 그러나 target 이 고치려는 바로 그
Rationale 항목 — "이 규약에는 시행하는 코드가 없다" — 을 정정하면서, 이 문서(`review-citations.md`)
자신이 두 번이나 명시적으로 박아 놓은 "실측 없는 범위 주장 금지" 원칙을 §3 커버리지 서술에서
다시 어겼다. 실제 가드는 DTO 서브셋만 검사하는데 (A)·(B) 는 "DTO·컨트롤러" 전체가 강제된다고
쓰고, 같은 문서의 (C) 는 옳게 "DTO" 로만 좁혀 써서 초안 내부에 폭이 다른 두 주장이 공존한다.
이 상태로 spec 에 반영되면 컨트롤러 JSDoc 인용 유출 사각지대가 "이미 강제됨" 으로 오독되어
차기 리뷰가 그 축을 건너뛸 위험이 생긴다 — 이는 이 PR 이 막으려는 문제(문서가 사람이 실측하지
않은 채 강제 여부를 단언)를 §3 범위에서 재현하는 것이다. spec 반영 전 표현 폭을 (C) 수준으로
맞추면 해소되는 국소적 결함이다.

## 위험도

CRITICAL
