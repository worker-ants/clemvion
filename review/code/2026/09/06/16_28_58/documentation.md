# 문서화(Documentation) 리뷰

## 개요

대상 diff(`origin/main...HEAD`)는 `User` 엔티티 컬럼 노출 방어 3축(구조 축
`user-entity-exposure-guard.ts`, 이름 축 `user-secret-absence.ts`, JSDoc 인용 축
`dto-jsdoc-citation-guard.ts`) 신설, 트리거 `endpoint_path` 409 충돌 계약 구현,
`WorkflowVersionsService` 의 `creator` 투영 수정, `review_guard._parse_frontmatter_code`
YAML 파서 결함 수정, 그리고 `CHANGELOG.md`·`spec/conventions/*`·`plan/in-progress/*`
문서 갱신으로 구성된다. 여러 차례의 리뷰·컨시스턴시 라운드(`10_13_22` ~ `15_53_00`)를
거치며 이전에 지적된 문서화 결함(JSDoc orphan 블록, e2e 라벨 충돌, stale count, fixture
경로 인라인 중복, plan 번호 목록 순서 등)이 이번 라운드에서 실제 코드·문서를 열어
재확인한 결과 모두 해소돼 있었다. 새로 하나를 찾았다 — 아래 참조.

## 발견사항

- **[WARNING]** in-progress plan 문서에, 같은 문서 뒤쪽에서 이미 해소됐다고 기록한 문제를 "하지 말라"고 지시하는 stale caveat 이 남아 있다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:410`(`> **`code:` 에 YAML 주석을 넣지 마라** — 게이트 파서가 그 줄에서 끊는다. ...`) — 아직 열려 있는(`- [ ]`, 375행) "신규 검출 3축을 §5.4 「검증 층」과 `code:` 에 등재" 항목 안의 캐비아트. 대조: 같은 파일 `1257`행의 `- [x] harness: code: 블록 리스트의 YAML 주석이 게이트 파서를 조용히 끊는다` — `1258`행에 `✅ 2026-09-06 해소 — 파서가 빈 줄·`#` 주석을 건너뛴다`.
  - 상세: 410행의 캐비아트는 `review/code/2026/09/06/13_39_20`(파서가 아직 버그를 갖고 있던 시점)을 근거로 "YAML 주석을 넣으면 게이트가 끊긴다"고 다음 planner 턴에게 지시한다. 그런데 같은 브랜치가 그 직후(커밋 `8b67300b5`, 14:25)에 정확히 그 파서 버그를 고쳤고(`_parse_frontmatter_code` 가 빈 줄·`#` 주석을 건너뛰도록 수정, 회귀 테스트 7건), 그 결과를 `spec/conventions/spec-impl-evidence.md`(이번 diff, §2.1 `code` 행)가 "그런 문서의 `code:` 는 준수 예시와 시행 코드를 섞어 담아도 되고, **범주를 인라인 YAML 주석으로 갈라도 된다 — 2026-09-06 이후로 안전하다**" 라고 명시적으로 뒤집었다. 실제로 `spec/conventions/review-citations.md` 의 frontmatter 도 이번 diff 에서 `code:` 블록 리스트 안에 범주 구분용 `#` 주석 두 줄을 넣은 채로 최종 상태에 남아 있다(정상 동작 확인됨, `731 대 731` 실측). 즉 410행의 지시는 파서가 고쳐지기 **전** 시점의 임시 회피책이었는데, 그 문서의 다른 열린 체크리스트 항목(아직 실행되지 않은 §5.4 등재 작업) 안에 그대로 남아 다음 planner 턴이 그것을 읽고 "YAML 주석은 여전히 위험하다"고 오판할 수 있다. 같은 파일 안에서 두 항목(375행대 미완료 항목의 캐비아트 vs 1257행대 완료 항목의 해소 기록)이 같은 주제에 대해 서로 다른 시점의 진실을 말하고 있어, 부분만 읽으면(특히 375행 항목을 열어 그 지시대로 산문·표만 쓰면) 이미 안전해진 더 간결한 방법(인라인 YAML 주석)을 불필요하게 피하게 된다.
  - 제안: 410~412행에 `2026-09-06 (8b67300b5) 파서 수정으로 이 제약은 해소됨 — `review-citations.md` 가 인라인 YAML 주석을 실제로 쓴다` 같은 정정 주석을 덧붙이거나, 캐비아트 자체를 지우고 1257행 항목을 가리키는 링크로 대체한다.

## 요약

전반적으로 문서화 품질은 매우 높다 — 새 가드 3종(`user-entity-exposure-guard.ts`,
`dto-jsdoc-citation-guard.ts`, `user-secret-absence.ts`)과 서비스 수정(`triggers.service.ts`,
`workflow-versions.service.ts`) 모두 "왜 이 형태인가"·"왜 다른 대안을 기각했는가"를 실측
수치와 함께 남기고, JSDoc 은 실제 대상 함수 위에 정확히 붙어 있으며(과거 라운드가 지적한
orphan JSDoc 은 이번 최종본에서 재확인 결과 정상 위치), `CHANGELOG.md` 는 이번 diff 전체를
정확하고 상세하게 반영한다. `spec/conventions/review-citations.md`·`spec-impl-evidence.md`
의 자기-반증형 소정정도 CLAUDE.md 의 5조건(취소선 보존·축 단위 국한·실측 동반·planner 턴
경유)을 충실히 따른다. 유일하게 찾은 결함은 `plan/in-progress/` 문서 내부에 시점이 다른
두 서술이 공존하는 것으로, 코드나 spec 의 정확성에는 영향이 없으나 아직 실행되지 않은
체크리스트 항목을 읽는 다음 사람을 오도할 수 있어 WARNING 으로 판단한다.

## 위험도

LOW
