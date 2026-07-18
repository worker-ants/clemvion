# 정식 규약 준수 검토 — convention_compliance

- 검토 모드: 구현 완료 후 검토 (--impl-done, scope=`spec/conventions/`, diff-base=`origin/main`)
- target: `spec/conventions/` (전체) — 단, 아래 "방법론 노트" 참고

## 방법론 노트 (선행 확인 — 반드시 먼저 읽을 것)

`_prompts/convention_compliance.md` 에 실제로 번들된 target 본문은 `spec/conventions/audit-actions.md`
전문 + `spec/conventions/cafe24-api-catalog/`(`_overview.md`·`application.md`·`application/*.md` 8개·
`category.md`·`category/autodisplay.md` 일부) **뿐**이며, 파일 끝(1652행)에 `... (truncated due to size
limit) ...` 로 잘리고 이어지는 "## 정식 규약 모음 (spec/conventions/)" 섹션은 `(없음)` 으로 **완전히
비어 있다**. 즉 이번 세션은 이 작업(`interaction-type-guard-followup`)과 실제로 관련된
`spec/conventions/interaction-type-registry.md` 를 포함해 alphabetical 후순위 컨벤션 파일 전부가 target
정의에서 **100% 배제**됐다.

이는 신규 결함이 아니라 **이미 문서화된 known failure pattern**이 이번 세션에서 더 심한 형태로 재현된
것이다 — `plan/in-progress/interaction-type-guard-comment-false-negative.md` 의 후속 항목 4(harness,
비차단)가 정확히 이 케이스를 "**[심각도 격상 2026-07-18]** … 번들러가 실 target(`interaction-type-
registry.md`)을 '일부 누락'이 아니라 **100% 치환**(`cafe24-api-catalog/**` 222개 field 파일이 예산 소진)"
로 이미 escalate 해 별도 harness task 로 분기하기로 기록해 두었다. 아래 발견사항 1이 이 재현을 형식화한다.

번들 공백을 보완하기 위해 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/
interaction-type-guard-followup-bd683a`)를 절대경로로 직접 조사했다:
`spec/conventions/interaction-type-registry.md` 전문 Read, `git diff origin/main`/`git log`/
`git merge-base` 로 실 diff 재구성, 관련 plan 문서 정독.

**추가로 발견한 2차 구조적 문제(발견사항 2)**: `origin/main` 이 이 브랜치의 fork-point(`22cc48ef3`) 이후
독립 커밋(`d25f552b2`, PR #978)을 이미 병합해 앞서 있다. 이 때문에 orchestrator 가 계산한
`git diff origin/main` 은 **reverse-diff 오염**을 일으켜, 이 브랜치가 실제로 도입하지 않은 "제거"(IE
`errorPayload` 계약 문서·plan 파일 삭제 등)를 마치 이 브랜치의 변경인 것처럼 보여준다. 이 역시 같은 plan
문서(항목 4)가 별도로 언급한 known pattern("origin/main 이 fork-point 보다 앞설 때의 reverse-diff
오염")과 정확히 일치한다. 아래 발견사항 2가 실제 판정 기준(merge-base 대비 diff)을 재구성해 이 오염을
제거한다.

## 발견사항

- **[WARNING]** 리뷰 payload 번들링이 target 규약 전체를 100% 대체 (기존 harness 결함의 심화 재현)
  - target 위치: 세션 `_prompts/convention_compliance.md` 전체 — "## Target 문서" 섹션(41~1659행),
    특히 1652행 `... (truncated due to size limit) ...` 및 1655~1658행 "## 정식 규약 모음
    (spec/conventions/)" → `(없음)`
  - 위반 규약: 해당 없음 — 규약 문서 자체의 결함이 아니라 consistency-check 오케스트레이터의 번들링 로직
    결함
  - 상세: `spec/conventions/` alphabetical 순회 중 `cafe24-api-catalog/` 서브트리(224개 파일)가 프롬프트
    크기 상한을 전부 소진해, 이번 작업과 직접 관련된 `interaction-type-registry.md` 를 포함한 alphabetical
    후순위 컨벤션 파일 20개가 target 에서 **완전히** 빠졌다. 직전 세션(`review/consistency/2026/07/18/
    12_04_53/convention_compliance.md`)에서는 `audit-actions.md` 전문이라도 남았고 그 세션의 checker 가
    직접 대조로 우회했는데, 이번 세션은 그보다 더 심하게(0건) 잘렸다 — `plan/in-progress/
    interaction-type-guard-comment-false-negative.md:139-141` 이 예견·기록한 바로 그 악화다.
  - 제안: 신규 항목 생성 불필요 — 이미 위 plan 문서 후속 항목 4(harness, 비차단)로 추적 중이며 "별도
    harness task 로 분기" 하기로 돼 있다. 다만 그 분기 산출물(신규 harness plan 파일)이 이 워크트리
    어디에도 아직 존재하지 않는다(`plan/in-progress/harness-*.md` 3개 확인, 해당 내용 없음) — 분기가
    실제로 이뤄졌는지 재확인 필요(비차단, plan_coherence checker 영역과 중복 가능).

- **[WARNING]** diff-base(`origin/main`)가 이 브랜치의 fork-point 이후 앞서 있어 `git diff origin/main`
  결과가 reverse-diff 로 오염됨 — "제거"로 보이는 항목은 이 브랜치의 변경이 아님
  - target 위치: `git diff origin/main` 결과 중 `codebase/backend/src/nodes/ai/information-extractor/
    information-extractor.handler.ts`, `codebase/backend/src/nodes/core/node-handler.interface.ts`,
    `plan/in-progress/ie-endmultiturn-errorpayload-contract.md`(92행 "삭제"로 표시)
  - 위반 규약: 해당 없음 — 특정 spec/conventions 파일 위반이 아니라 diff-base 선택 자체의 문제
  - 상세: `git merge-base HEAD origin/main` = `22cc48ef3`. 이 브랜치(`claude/interaction-type-guard-
    followup-bd683a`, HEAD=`465abf334`)는 그 지점에서 분기해 AST 가드 정합화만 커밋했다. 반면
    `origin/main`(HEAD=`d25f552b2`, "docs(ai-nodes): IE endMultiTurnConversation — 엔진 errorPayload
    비소비를 계약 SoT 로 명시 (#978)")은 **같은 지점에서 독립적으로** IE 의 `errorPayload` 불소비를
    문서화하는 별도 세션의 작업을 병합했다. 두 브랜치는 서로 다른 파일을 건드리는 **병렬 세션**(사용자
    메모리 "백로그 착수 전 병렬 세션 머지 확인" 패턴과 동일 계열)이었을 뿐, 이 브랜치가 #978 의 문서화나
    `plan/in-progress/ie-endmultiturn-errorpayload-contract.md` 를 **의도적으로 되돌리거나 삭제한 사실이
    없다** — 애초에 이 브랜치엔 그 파일/변경이 존재한 적이 없다(fork-point 이후 origin 전용).
    `git diff 22cc48ef3 HEAD --stat` 로 재구성한 이 브랜치의 **실제** 변경분은 `interaction-type-
    exhaustiveness.test.ts`·`interaction-type-registry.ts`·`plan/in-progress/interaction-type-guard-
    comment-false-negative.md`·review 산출물뿐이다.
    부수 확인: 이 오염 때문에 워크트리의 **현재 상태**(`node-handler.interface.ts` 의 `errorMultiTurn…`
    docblock 이 "핸들러는 errorPayload 를 output.error 에 그대로 set 해야" 라는 범용 문구를 유지하는데,
    `InformationExtractorHandler.endMultiTurnConversation`(453~458행 vs 1185~1191행)은 실제로
    `errorPayload` 파라미터 자체를 받지 않아 인터페이스 docblock 과 구현이 어긋난 상태다)도 관찰되나,
    이는 fork-point(`22cc48ef3`) 시점에 이미 존재하던 **선재 갭**이고 origin/main 의 `#978` 이 이미
    해소한 것을 이 브랜치가 아직 rebase 로 흡수하지 못한 결과다 — 이 브랜치의 신규 도입이 아니므로
    CRITICAL 로 잡지 않는다.
  - 제안: (1) 리뷰 판정은 `git diff 22cc48ef3 HEAD` 기준으로 좁혀 재계산할 것 — 위 재구성 결과 CRITICAL
    급 신규 위반 없음(아래 발견사항 3). (2) 머지 전 이 브랜치를 `origin/main` 위로 rebase/merge 해
    `#978` 의 docblock 정합화를 흡수할 것(그래야 위 인터페이스-구현 불일치도 함께 해소된다). (3) harness
    측에는 이미 plan 문서가 추적 중인 "origin/main 이 fork-point 보다 앞설 때의 reverse-diff 오염"
    항목의 재현 사례로 참고할 수 있다.

- **[INFO]** 브랜치의 실질 신규 변경은 `spec/conventions/interaction-type-registry.md` 와 완전히 정합 —
  위반 없음
  - target 위치: `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` 14행,
    63~64행(주석 "grep 가드" → "AST 가드") · `codebase/frontend/src/lib/__tests__/
    interaction-type-exhaustiveness.test.ts` (self-test fixture 보강)
  - 위반 규약: 없음 — 오히려 `spec/conventions/interaction-type-registry.md` §1.2 rule 3(56행)·
    §2.1(77~78행)·§5(143행) 이 이미 일관되게 사용하는 "AST 가드" 명칭에 코드 주석을 맞추는
    **정합화**다. spec 은 PR #977 이 이미 "grep 서술 → AST 스캔 용어" 로 정정했고, 이번 브랜치는 그
    나머지(developer 소유 코드 주석 3곳)를 마저 정정한 것 — `plan/in-progress/interaction-type-guard-
    comment-false-negative.md` 118~121행의 체크리스트 항목과 정확히 일치한다.
  - 상세: `interaction-type-exhaustiveness.test.ts` 의 fixture 보강(union 타입 선언·객체 프로퍼티 값·
    정규식 리터럴 비오염 케이스)도 spec §5 Rationale(148~168행)이 명시한 "가드는 '깨뜨려 봤다'로만
    신뢰할 수 있다" 원칙을 그대로 실천한다 — 새 위반이 아니라 spec 이 요구하는 mutation-testing 엄격성의
    강화.
  - 제안: 해당 없음 (compliant).

## 요약

이번 세션의 실제 target 은 두 겹으로 왜곡돼 있었다 — (1) 번들러가 `interaction-type-registry.md` 를
포함한 실 target 규약을 100% 배제(cafe24-api-catalog 덤프에 예산 소진, 이미 escalate 된 known
pattern), (2) diff-base `origin/main` 이 이 브랜치의 fork-point 이후 독립 병합(#978)으로 앞서 있어
reverse-diff 오염이 겹쳤다. 두 문제 모두 `plan/in-progress/interaction-type-guard-comment-false-
negative.md` 가 이미 추적·기록한 harness known failure pattern 의 재현이며, 이 브랜치 코드의 새로운
결함이 아니다. 워크트리 직접 조사와 `merge-base` 기준 diff 재구성으로 실제 신규 변경분(정확히 3개
소스: `interaction-type-registry.ts` 주석 정정, `interaction-type-exhaustiveness.test.ts` fixture
보강, plan 문서 갱신)만 판정한 결과 `spec/conventions/interaction-type-registry.md` 위반은 없으며,
오히려 spec 이 이미 확정한 "AST 가드" 명칭·mutation-testing 원칙에 코드를 수렴시키는 정합화다. 다만
diff-base 오염으로 인해 `git diff origin/main` 원본만 보고 판정하면 "IE errorPayload 계약 문서 제거"
류의 **거짓 CRITICAL** 이 나올 수 있으므로, 하류 SUMMARY 집계 시 이를 이 브랜치 귀책으로 카운트하지
않도록 주의가 필요하다. 머지 전 `origin/main` rebase 를 권장한다(그래야 인터페이스 docblock ↔
`InformationExtractorHandler` 구현의 선재 불일치도 함께 해소된다).

## 위험도

LOW
