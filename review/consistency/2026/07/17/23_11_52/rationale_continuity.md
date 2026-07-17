# Rationale 연속성 검토 — interaction-type-regex-fix

## 방법론 메모 (검토 신뢰도에 영향)

본 호출의 prompt 에 첨부된 "target 문서" 번들(`spec/conventions/` 하위 파일 알파벳순 dump, 2129줄)은 `audit-actions.md`→`cafe24-api-catalog/**`(50+ 파일)를 나열하다 크기 한도로 잘려, 실제로 이번 diff 와 직결되는 `spec/conventions/interaction-type-registry.md` 는 번들에 **포함되지 않았다** (전체 파일에서 `interaction-type` 문자열 검색 0건, preamble 제외). 또한 파일 뒷부분에는 `spec/2-navigation/3-schedule.md`·`4-integration.md` 등 `spec/conventions/` 밖 문서의 Rationale 발췌까지 섞여 있어, 번들이 실제로는 scope 밖 자료로 채워진 상태였다.

이 gap 을 보완하기 위해 워킹트리 절대경로로 다음을 직접 확인했다:
- `git diff origin/main...HEAD --stat` — 실제 변경 파일 3종(`codebase/frontend/.../interaction-type-exhaustiveness.test.ts`, `plan/in-progress/interaction-type-guard-comment-false-negative.md`, 이전 세션 review 산출물). **`spec/` 은 이번 diff 에서 전혀 변경되지 않았다.**
- `/Volumes/.../interaction-type-regex-fix-2303a6/spec/conventions/interaction-type-registry.md` 전문(§1.2, §2.1, §5 Rationale) — 실제 target spec.
- `git log`/`git show` 로 PR #272(최초 컨벤션 도입)·PR #968(known-limitation 주석 도입 + mutation 실측 문화 확립) 커밋 내용 대조.

아래 판정은 이 실제 확인에 근거한다 (번들 누락분이 아니라).

## 발견사항

- **[INFO]** spec 잔여 "grep" 표현이 실제 메커니즘(TS AST 파싱)과 어긋남
  - target 위치: `plan/in-progress/interaction-type-guard-comment-false-negative.md` "후속 (본 PR 범위 밖)" 항목이 스스로 지적. 실제 spec 위치는 `spec/conventions/interaction-type-registry.md` §1.2 rule 3("등록된 grep 대상 파일"), §2.1 표의 `system_error`/`rag` 행("AST 가드 대상 코드 파일... grep 검증 대상은"), §5 Rationale("AST 가드가 매트릭스 vs 코드 grep 결과를 build 단계에서 비교 fail")
  - 과거 결정 출처: `spec/conventions/interaction-type-registry.md §5` — PR #272 부터 이 가드를 "AST 가드"로 명명해왔으나 실제 구현은 정규식 grep 이었던 명명-구현 불일치가 이미 spec 자체에 존재
  - 상세: 이번 PR 은 구현을 정규식 grep → 실제 TS AST 리터럴 수집으로 교체해 "AST 가드" 라는 명칭에 구현을 수렴시켰다(개선, 후퇴 아님). 다만 spec 본문의 "grep 검증"/"grep 대상 파일" 서술은 여전히 옛 메커니즘을 지칭해 이제는 부정확하다. developer 는 `spec/` read-only 라 스스로 고치지 않고 plan 문서에 후속 항목으로 명시적으로 이월했다 — 은폐가 아니라 추적된 defer.
  - 제안: project-planner 가 다음 spec 편집 시 §1.2 rule 3·§2.1 두 행·§5 의 "grep" 표현을 "코드 AST 파싱 결과"/"등록 사이트 파일"로 갱신. 이번 PR 을 이 사유로 막을 필요는 없음(비차단 정합 보완).

## 요약

이번 diff(정규식 grep → TS 컴파일러 API 기반 string-literal 수집, `interaction-type-exhaustiveness.test.ts`)는 `spec/conventions/interaction-type-registry.md` 의 어떤 Rationale 항목도 재도입·번복하지 않는다. 오히려 동일 문서 §5 의 "강도 정정(2026-07-17 실측)" 문단이 명문화한 원칙 — "가드는 '있다'가 아니라 '깨뜨려 봤다'로만 신뢰할 수 있다" — 을 그대로 따라 양방향 mutation 실측(실분기 파손→red, 주석만 잔존→red, 무수정→green)으로 새 메커니즘을 검증했고, PR #968 이 발견해 "이번 PR 범위 밖" 으로 이월했던 known limitation(주석 인용에 의한 false negative)을 해소한다. 검토된 대안 기각(따옴표 종류 좁히기, 수제 주석 제거기)도 실측 근거를 갖춘 정상적인 설계 논증이며, spec Rationale 이나 CLAUDE.md 규약이 요구하는 "기각 대안=실제 이력" 기준에 부합한다(git log 로 PR #968/#272 인용의 사실관계 확인 완료). 유일한 잔여 항목은 spec 본문에 남은 "grep" 표현의 용어적 staleness로, developer 스스로 spec read-only 제약을 지켜 후속 작업으로 명시 이월했으므로 비차단 INFO 수준이다. 별도로, 이번 호출의 target 문서 번들이 실제 관련 spec(interaction-type-registry.md)을 누락한 채 무관한 대용량 cafe24 카탈로그로 채워져 있었다는 점은 orchestrator 번들링 로직 자체의 개선 여지로 기록해둔다.

## 위험도
LOW
