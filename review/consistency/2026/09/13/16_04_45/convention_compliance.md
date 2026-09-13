# 정식 규약 준수 검토 — convention_compliance

## 검토 방식 안내 (선행 사실 확인)

프롬프트 번들의 `## 구현 변경 사항`(diff 본문)은 **컨텍스트 예산 초과로 절단**되어 있었고,
누락 파일 목록에 `<git diff origin/main...HEAD -- code_areas>` 자체가 포함돼 있었다(=diff
가 프롬프트에 전혀 실리지 않음). 지시에 따라 diff 를 프롬프트로 판정하지 않고, SoT 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/guide-identifier-existence`, 이 checker
의 실제 CWD 와 동일 경로)에서 `git diff origin/main...HEAD` 를 직접 실행해 실제 변경분을 확인했다.

**실제 변경(코드 스코프, 5파일/약 969줄)**:
- 삭제: `guide-error-code-existence.test.ts`(189줄) · `guide-error-code-scan.ts`(184줄)
- 신설: `guide-identifier-existence.test.ts`(330줄) · `guide-identifier-scan.ts`(227줄)
- 수정: `guide-sanitized-message-parity.test.ts`(참조 문구 갱신, 4줄)
- 문서: `CHANGELOG.md`·`PROJECT.md`(가드 카탈로그 갱신) · `plan/in-progress/guide-identifier-existence.md`(신설) · `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커 갱신)

`scope(spec/conventions/)` 델타는 실측대로 **0개 파일**(정상 — 코드 전용 PR).

## 발견사항

### [WARNING] 신규/개명 가드 파일이 `user-guide-evidence.md` §2/§2.1/frontmatter `code:` 에 미등재 — 단, 이미 planner 트래커에 정확히 반영돼 있음
- target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` ·
  `guide-identifier-scan.ts` (신규), `CHANGELOG.md`/`PROJECT.md` 의 "SoT: `spec/conventions/user-guide-evidence.md §2`" 인용부
- 위반 규약: `spec/conventions/user-guide-evidence.md` §2 "Build-time 가드 (3건)" 표 · §2.1
  관계표 · frontmatter `code:` (현재 7개 경로, 신규 3파일 미포함)
- 상세: `PROJECT.md`/`CHANGELOG.md`는 `guide-identifier-existence.test.ts`의 SoT를
  `user-guide-evidence.md §2`로 명시하지만, 그 spec 문서 자체의 §2 표는 여전히 "가드 3건"
  (`impl-anchor-existence`·`integrations-coverage`·`triggers-coverage`)만 세고 있고
  `guide-identifier-existence`/`guide-sanitized-message-parity`는 §2.1 관계표에도
  frontmatter `code:` 목록에도 없다. "SoT" 라 부르는 문서가 인용 대상을 실제로 소유하지
  않는 상태 — spec-impl-evidence 관점의 drift다.
- 이미 알려진 상태임: 이 gap 은 이번 PR 이 새로 만든 것이 아니라 `#1330`(guide-error-code-*
  최초 도입) 때부터 있던 상태이고, 이번 세션의 `--impl-prep`(`review/consistency/2026/09/13/12_33_41`)
  에서 3개 checker 가 수렴 지적했다. `spec/` 쓰기는 `project-planner` 전속(CLAUDE.md)이라
  developer 는 자기 권한 밖으로 정확히 판단해 스스로 spec 을 고치지 않았고, 대신
  `plan/in-progress/spec-draft-nullable-notation-followups.md:3247`의 기존 planner
  백로그 항목(`[ ]` 미체크 유지) 문구를 이번 리네임에 맞춰 갱신했다(파일명
  `guide-error-code-*`→`guide-identifier-*`, "Rationale 병기 필요"까지 명시). 처리
  방식 자체는 CLAUDE.md 의 역할 경계를 정확히 지켰다.
- 제안: 코드 쪽에서 추가로 할 일은 없음(스코프 밖). 다음 planner 턴에서
  `spec-draft-nullable-notation-followups.md:3247` 항목을 처리할 때 §2 표를 "5건"으로,
  §2.1 관계표에 2행 추가, frontmatter `code:` 에 `guide-identifier-scan.ts` ·
  `guide-identifier-existence.test.ts` · `guide-sanitized-message-parity.test.ts` 3개를
  보태고, "허용목록 없음" 원칙 번복의 Rationale 을 함께 기록할 것 — 해당 항목이 이미 이
  세 가지를 "한 턴에 함께" 처리하라고 명시하고 있으므로 그대로 따르면 된다.

### [INFO] 규약 미해당 확인 — 나머지 4개 관점은 이번 diff 에 적용 대상이 없음
- target 위치: 전체 diff
- 상세: (1) API 응답/이벤트 페이로드/에러 코드 **출력 포맷**은 이번 diff 가 건드리지 않음
  (테스트·스캐너 코드만 변경). (2) 문서 구조 규약(Overview/본문/Rationale 3섹션,
  `_product-overview.md`/`0-` prefix)은 `spec/**` 신설·변경이 없어 해당 없음 —
  `plan/in-progress/guide-identifier-existence.md` 는 plan 문서라 그 3섹션 규약(spec 문서용)
  대상이 아니다. (3) API 문서(OpenAPI/Swagger 데코레이터·DTO 명명)도 컨트롤러/DTO 변경이
  없어 해당 없음. (4) `error-codes.md` §1 의 `UPPER_SNAKE_CASE` 표기 규약과 신규 스캐너의
  정규식(`[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+`, 밑줄 최소 1개 요구)이 정합적이다 — 위반 없음.
- 제안: 없음(정보성 확인).

### [INFO] `review-citations.md` 규약 준수 확인
- target 위치: `guide-identifier-scan.ts`·`guide-identifier-existence.test.ts` 의 리뷰 인용
  주석 (`review/consistency/2026/09/13/11_33_51`, `review/code/2026/09/13/14_41_14` 등)
- 상세: `spec/conventions/review-citations.md` §2 는 `codebase/**` 주석에서 **bare `hh_mm_ss`
  금지**, 날짜 포함 형태를 요구한다. 신규/변경 파일 전수를 `hh_mm_ss` 패턴으로 grep 했으나
  날짜 없이 단독으로 쓰인 인용은 0건 — 모두 `review/<type>/YYYY/MM/DD/hh_mm_ss` 전체 경로
  형태(§2 "권장")를 쓰고 있다. `plan/**` 두 파일의 인용(예: "라운드 1/2/3/4" 표의 세션 ID)은
  같은 규약 §3 표에 의해 애초에 적용 대상이 아니다(`plan/**` 명시 제외).
- 제안: 없음(정보성 확인, 위반 없음).

## 요약

이번 PR(코드 스코프 5파일)은 `spec/conventions/` 를 직접 건드리지 않는 순수 코드 변경이며,
새로 만든 가드 파일의 명명(`guide-identifier-*`)·위치(`__tests__/`)·리뷰 인용 형식은 기존
컨벤션(`user-guide-evidence.md` 의 파일 배치 패턴, `review-citations.md` §2, `error-codes.md`
의 `UPPER_SNAKE_CASE` 표기)과 정합한다. 유일한 실질적 규약 이격은 `user-guide-evidence.md`
자신이 "SoT" 라 주장하는 §2 가드 목록·§2.1 관계표·frontmatter `code:` 가 실제 가드 인벤토리
(이번 리네임 포함)를 못 따라가는 drift 인데, 이는 developer 권한 밖(spec 쓰기는
project-planner 전속)이라 이번 PR 이 직접 고칠 수 없는 항목이고, 이미 3개 독립 checker 가
수렴 지적한 뒤 planner 전용 백로그 항목(`spec-draft-nullable-notation-followups.md:3247`)으로
정확히 등재·갱신돼 있어 프로세스상 올바르게 처리됐다. 새로운 CRITICAL 위반은 발견되지 않았다.

## 위험도

LOW
