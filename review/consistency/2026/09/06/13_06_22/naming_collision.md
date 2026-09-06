# 신규 식별자 충돌 검토

## 검토 대상

`plan/in-progress/spec-draft-review-citations-enforcement.md` — `spec/conventions/review-citations.md`
의 `## Rationale`(변경안 A) · frontmatter `code:`(변경안 B) · `spec/conventions/spec-impl-evidence.md
§2.1`의 선례 인용(변경안 C)을 정정하는 planner 턴 초안.

target 은 새 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수를 도입하지 않는다(기존 두
convention 문서의 서술 정정과 frontmatter `code:` 항목 추가뿐). 검토는 §6(파일 경로 충돌) 관점,
특히 **동일 대상에 대한 병렬 등록**에 집중했다.

## 발견사항

- **[WARNING]** `review-citations.md` `code:` 등록 대상 glob 이 두 개의 동시 진행 plan 에서
  서로 다른 폭으로 도입되고 있다
  - target 신규 식별자: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation*.ts`
    (변경안 B, `plan/in-progress/spec-draft-review-citations-enforcement.md:72`)
  - 기존/병렬 사용처: `plan/in-progress/spec-draft-nullable-notation-followups.md:398` —
    같은 등록 대상(`review-citations.md` 의 `code:`)에 `dto-jsdoc-citation-guard*.ts` 를 쓰라고
    적은 열린 체크박스 항목(`- [ ] 신규 검출 3축을 §5.4 「검증 층」과 code: 에 등재`, 아직
    미종결)이 있다. 두 plan 모두 같은 Critical(`review/consistency/2026/09/06/12_53_29`,
    followups 문서는 `10_13_23` W1 경유)에서 파생됐고 같은 파일을 가리키지만, 등록 문구가
    다르다.
  - 상세: 실제 디렉터리에는 `dto-jsdoc-citation-guard.ts` 와 `dto-jsdoc-citation.spec.ts` 두
    파일이 있다(`find codebase/backend/src/repo-guards/__tests__ -iname '*jsdoc-citation*'` 로
    확인). target 의 glob(`dto-jsdoc-citation*.ts`)은 **두 파일 모두** 매치하지만, 자매 plan
    의 glob(`dto-jsdoc-citation-guard*.ts`)은 `-guard` 를 요구하므로 **`dto-jsdoc-citation.spec.ts`
    를 매치하지 못한다**. 둘 중 어느 쪽이 먼저 `spec/` 에 반영되느냐에 따라 최종 `code:` 값이
    갈리고, 좁은 쪽이 이기면 `spec-code-paths.test.ts` 가드는 여전히 통과하지만(≥1 매치 요건은
    `-guard.ts` 만으로 충분) `_spec_linked_changes()`(fnmatch 기반 spec-linked 판정, 자매 plan
    문서가 명시)가 `.spec.ts` 테스트 파일 변경을 spec-linked 로 인식하지 못하는 사각지대가
    남는다 — 원래 이 Critical 이 고치려던 "가드를 약화·삭제해도 게이트가 안 문다" 문제의 **부분
    재발**이다. 두 plan 은 서로를 인용하지 않고(자매 plan 은 `review-citations.md` 를 자신의
    frontmatter `spec_impact` 에도 등재하지 않음 — `spec-draft-nullable-notation-followups.md:8-12`
    확인), 어느 쪽이 최종본을 쓰는지 조율 지점이 없다.
  - 제안: target 변경안(B)을 적용할 때 자매 plan(`spec-draft-nullable-notation-followups.md`)의
    해당 체크박스 항목을 **동일 glob(`dto-jsdoc-citation*.ts`, `-guard`·`.spec` 양쪽 포함)으로
    맞추고 "처리 완료"로 표시**하거나, 최소한 target 문서에 "이 항목이 자매 plan 의 동일 체크박스를
    대신 닫는다"는 상호 참조를 남긴다. 둘 다 그대로 두면 나중에 어느 쪽 세션이 먼저 `spec/` 에
    쓰느냐에 따라 좁은 glob 이 채택될 위험이 있다.

## 요약

target 은 신규 요구사항 ID·엔티티·엔드포인트·이벤트·환경변수를 도입하지 않아 §1~§5 관점에서는
충돌이 없다. 유일한 실질 이슈는 §6(파일 경로) 관점의 **병렬 등록 폭 불일치**다 — 같은 Critical
에서 파생된 두 개의 열린 plan(`spec-draft-review-citations-enforcement.md`,
`spec-draft-nullable-notation-followups.md`)이 동일한 `code:` 슬롯에 서로 다른 넓이의 glob 을
쓰라고 적어 두었고, 좁은 쪽이 최종본이 되면 `.spec.ts` 테스트 파일이 spec-linked 판정에서 다시
빠지는 부분 재발이 가능하다. 그 외 대상 문서(변경안 A·C)는 기존 헤딩·필드·선례 인용을 제자리에서
정정할 뿐 새 식별자를 만들지 않으므로 충돌 소지가 없다.

## 위험도

LOW
