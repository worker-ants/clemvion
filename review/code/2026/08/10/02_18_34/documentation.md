# 문서화(Documentation) 리뷰

## 리뷰 대상
- `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` (Review, 전체 파일 컨텍스트, 193줄)

## 교차 검증 방법
파일 헤더 주석이 `plan-scan.ts`/`spec-links.ts`(정본 구현), `.claude/docs/plan-lifecycle.md §3/§4`,
`spec/conventions/spec-impl-evidence.md §4.2`, `PROJECT.md` 4곳을 각각 인용하므로, 인용된 내용이
실제 그 문서·코드와 지금도 일치하는지 4곳 모두를 직접 열어 대조했다.

- `plan-scan.ts` — `collectLivePlanMarkdown`/`collectCompletePlanMarkdown`/`findNonTerminalCompletedPlans`/
  `TERMINAL_PLAN_STATUSES`(`complete`/`implemented`/`applied`/`superseded`) 모두 실재, 주석 서술과 일치.
- `spec-links.ts:304` — `export { collectLivePlanMarkdown };` 확인 — "하위호환 re-export" 서술 정확.
- `spec-impl-evidence.md §4.2` 표의 `plan-frontmatter.test.ts` 행 — "판정 로직은 `plan-scan.ts`(수집·status)와
  `spec-links.ts`(링크) 소관이고 이 파일은 호출부다" — 대상 파일의 실제 구조(호출만 하고 로직은 두 모듈에)와 일치.
- `plan-lifecycle.md §4` — `worktree`/`started`/`owner` 필수 필드, `(unstarted)` sentinel, terminal status
  4종, `#1108`·`#1117` 두 번 놓친 실패, 135건 실측 등 대상 파일이 인용하는 모든 사실이 원문과 일치(문구까지 동일한
  곳도 다수 — 같은 PR 에서 동기화됐음을 시사).
- `PROJECT.md:277` — 이 가드를 "3종" 으로 요약한 서술이 대상 파일의 현재 3개 검사군(frontmatter 필드 /
  terminal status / 상대링크)과 정확히 일치.

전 구간에서 불일치를 발견하지 못했다. 특히 이 파일 자신의 24-26번째 줄 주석(`> 이 주석은 추출 직후
spec-links.ts 를 정본으로 적은 채 남아 있었다...`)이 명시하는 과거 stale 서술(ai-review documentation
WARNING)은 최근 커밋(`f5f454844`, "헤더 주석의 정본을 plan-scan.ts 로 정정")에서 이미 수정 완료된 상태다.

## 발견사항

- **[INFO]** 헤더 주석에 과거 리뷰 라운드의 postmortem 서술이 다층으로 누적되어 있음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:13-51` (특히 24-26, 33-50)
  - 상세: 헤더 주석이 "현재 규칙"과 "그 규칙이 한때 어떻게 틀렸었는지에 대한 회고"를 같은 블록에 섞어
    서술한다(`> 이 주석은 추출 직후 ... 남아 있었다`, `2026-08-09: 이동이 남기는 두 갭을 함께 막는다` 등).
    내용은 전부 사실과 일치하고 각 인용 문서(§3/§4 등)와도 정확히 대조되지만, 신규 독자가 "지금 지켜야 할
    불변식"과 "예전에 있었던 실수" 를 분리해서 읽어야 하는 부담이 있다.
  - 제안: 기능적 문제는 아니므로 강제 수정은 불필요. 다만 다음 라운드에 이 파일을 다시 만지게 되면, 이미
    해소된 과거형 서술(예: 24-26번째 줄의 "한때 틀렸었다" 대목)은 커밋 메시지/`plan-lifecycle.md` Rationale
    쪽으로 옮기고 소스 주석은 "현재 규칙 + 왜 이 스코프인가"만 남기는 정리를 고려. (본 프로젝트가 ai-review
    인용을 인라인 주석에 남기는 것을 관례로 삼고 있어 강한 권고는 아님.)

이 외 CRITICAL/WARNING 급 발견 없음. JSDoc 부재(`collectTopLevelPlans` 등 로컬 helper)는 인접 주석이
충분히 대체하고 있어 지적 대상 아님. README·CHANGELOG — 이 저장소는 harness/test-only 변경에
CHANGELOG 엔트리를 요구하지 않는 것이 기존 관례(§CI/backend-checks 등 최근 harness PR 도 미기재)이고,
가드 목록은 `PROJECT.md`(SoT)에 이미 정확히 반영되어 있어 갭 없음.

## 요약
대상 파일은 문서화 관점에서 이례적으로 잘 관리되어 있다 — 헤더 주석이 인용하는 4개 외부 문서
(`plan-scan.ts`, `spec-links.ts`, `plan-lifecycle.md`, `spec-impl-evidence.md §4.2`, `PROJECT.md`)를
모두 직접 열어 대조한 결과 서술과 구현이 정확히 일치했고, 과거 라운드에서 지적됐던 stale 참조
(spec-links.ts → plan-scan.ts 정정)도 이미 수정된 상태였다. 유일한 지적은 주석 스타일에 대한 INFO
수준 제안(과거형 postmortem 서술의 응축)이며 액션 아이템은 아니다.

## 위험도
NONE
