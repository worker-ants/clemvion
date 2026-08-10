# 요구사항(Requirement) 리뷰 — codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts

## 점검 방법

- 대상 파일 전체 컨텍스트를 읽고, 참조하는 구현 모듈 `plan-scan.ts`(신설) · `spec-links.ts`(확장)와
  이들의 fixture 테스트 `plan-scan.test.ts` · `spec-links.test.ts` 를 함께 열어 실제 판정 로직·
  non-vacuity 증거를 대조했다.
- spec fidelity 는 `.claude/docs/plan-lifecycle.md` §3(이동 규칙)·§4(Frontmatter 스키마) 및
  `spec/conventions/spec-impl-evidence.md`(가드 등재 표, L15-16, L87, L132)를 대조했다.
- `pnpm vitest run` 으로 대상 3개 테스트 파일(175 tests)을 실행해 GREEN 을 확인했다 —
  fixture 파일(`plan-scan.test.ts`)이 `findNonTerminalCompletedPlans`/`collectLivePlanMarkdown`
  의 각 분기(위반 검출·archive 제외·index 제외·비-문자열 status skip·파싱 실패 skip)를
  합성 저장소로 실측 통과시켜, 이 파일이 의존하는 판정 로직이 vacuous 하지 않음을 확인했다.

## 발견사항

- **[INFO]** `plan-frontmatter.test.ts` 자신의 "the plan link scanner actually sees links
  (non-vacuity)" 테스트는 실제 링크/위반 개수가 아니라 `collectLivePlanMarkdown(root).length`
  (파일 수집 개수)만 하한 검사한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:164`
  - 상세: 이 자체는 "링크 추출·검증 로직이 실제로 도는가"를 증명하지 못하고 "파일 발견이
    죽지 않았는가"만 증명한다. 다만 링크 검출 로직 자체의 실제 탐지 증명은 같은 PR 의
    `spec-links.test.ts`(fixture, `findBrokenPlanLinks` 양성 검출 L170/177/182/189)가
    이미 별도로 수행하고 있어 이 파일의 하한 검사는 보조적 sanity 역할로 충분하며, 파일
    자신의 주석(L161-164)도 그 역할 분담을 명시하고 있다. 결함이 아니라 설계 의도.
  - 제안: 조치 불요. 굳이 강화한다면 `findBrokenPlanLinks(root)` 스캔 대상 파일 수(내부에서
    본 파일 수)까지 assert 할 수 있으나 현재도 안전.

## spec fidelity 대조 결과 (문제 없음)

- `WORKTREE_SENTINEL = "(unstarted)"`, `WORKTREE_PLACEHOLDER` 정규식(TBD/assigned at impl/
  미정/착수 시/pending) — `.claude/docs/plan-lifecycle.md` §4 L75 의 sentinel·placeholder
  거부 규정과 line-level 일치.
- `started` ISO 날짜 검증(Date 인스턴스 허용 포함) — §4 frontmatter 스키마(`started: 2026-05-13`)
  와 일치.
- `TERMINAL_PLAN_STATUSES = {complete, implemented, applied, superseded}`
  (`plan-scan.ts:100-105`) — §4 L80-83 "종료 상태 값" 목록과 정확히 일치. `in-progress` 미포함도
  §4 의 "디렉터리와 정면 모순이라 여기 없다" 서술과 일치.
- `status` 를 선택 필드로 취급(미선언은 위반 아님, 파싱 실패는 skip) — §4 L80-83 "선언 자체가
  없는 것은 정상이다(선택 필드)" 와 §5 체크리스트("선언 자체가 없으면 해당 없음")에 일치.
- 링크 무결성 검사가 top-level `plan/in-progress/*.md` 만 보고 `plan/complete/**` 는 제외 —
  §3 "인입 참조"(시점 기록 문서는 옛 경로 유지) 및 §4 L90-91 "`plan/complete/**` 는 대상이
  아니다" 와 일치.
- `spec/conventions/spec-impl-evidence.md` L132 의 가드 등재 서술("판정 로직은 `plan-scan.ts`
  (수집·status)와 `spec-links.ts`(링크) 소관")도 실제 import 구조(`plan-frontmatter.test.ts`
  가 `plan-scan.ts`·`spec-links.ts` 에서 로직을 가져다 쓰기만 함)와 일치 — 파일 상단 주석
  (L24-26)이 지적하는 "정본 문서 불일치"는 이미 해소된 상태로 확인됨(SPEC-DRIFT 아님, 이미
  동기화 완료).
- TODO/FIXME/HACK/XXX 주석 없음. 반환값 누락 경로 없음(모든 `it` 블록이 명시적 `expect`로
  종료, 헬퍼 함수 전부 정상 반환).

## 요약

`plan-frontmatter.test.ts` 는 plan 라이프사이클 frontmatter 3필드(worktree/started/owner)
검증, `status` 종료값 검증, 상대링크 무결성 검증의 세 축을 모두 커버하며 판정 로직을
`plan-scan.ts`/`spec-links.ts` 공유 모듈로 위임해 이전 리뷰가 지적한 "손으로 재구현된 walker
가 조용히 어긋나는" 위험을 제거했다. `.claude/docs/plan-lifecycle.md` §3-§5 및
`spec/conventions/spec-impl-evidence.md` 의 관련 서술과 필드명·기본값·검증 규칙·스코프가
line-level 로 일치하며, 공유 모듈의 실제 탐지 로직은 fixture 기반 negative-path 테스트
(`plan-scan.test.ts`, `spec-links.test.ts`)로 non-vacuity 가 실측 증명돼 있다(175 tests 전량
GREEN 실행 확인). CRITICAL/WARNING 급 결함 없음.

## 위험도

NONE
