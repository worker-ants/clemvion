# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** `plan/complete/member-auth-order.md` 를 가리키는 전방 참조 2곳이 아직 존재하지 않는 경로다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4945`, `:4956`
  - 상세: 두 줄 모두 `` `plan/complete/member-auth-order.md` `` 를 인용하지만, 실제 plan 파일은
    이 diff 시점에 여전히 `plan/in-progress/member-auth-order.md` (frontmatter `status: in-progress`)에
    있다. 그 파일 자신의 체크리스트에도 `[ ] /ai-review → 수렴(2라운드)`, `[ ] --impl-done`,
    `[ ] 트래커 항목 해소 + plan complete/ 로 (한 커밋으로)` 가 아직 미완이라, `complete/` 이동은
    별도의 마지막 커밋에서 일어날 예정이다. `.claude/docs/plan-lifecycle.md` §3 은 "이동은 마지막
    작업 PR 안에서" 하나의 커밋으로 하라고 규정하므로 최종적으로는 맞아떨어질 수 있지만, 지금
    시점에 이 경로를 읽는 사람(또는 grep 하는 도구)에게는 존재하지 않는 파일을 가리킨다. 이 인용은
    마크다운 링크(`[text](path)`)가 아니라 backtick 코드 텍스트라 `findBrokenPlanLinks` 류의 build
    guard 도 잡지 못한다(그 가드는 실제 markdown 상대링크만 검사) — 조용히 stale 로 남을 수 있다.
  - 제안: 지금 시점 기준으로는 `plan/in-progress/member-auth-order.md` 로 인용하거나, "이 PR 이 닫히면
    `plan/complete/` 로 옮겨질 예정" 임을 명시하는 문구를 덧붙인다. 이동이 실제로 이 PR 의 마지막
    커밋에서 함께 일어난다면 이동 커밋에서 이 두 인용도 다시 확인한다.

- **[INFO]** `removeMember()` JSDoc 의 "인가(앞의 둘)" 표현이 나열 순서와 어긋난다(직전 라운드 SUMMARY INFO #9 그대로 잔존)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:805`
  - 상세: `* 판정 순서: **멤버십 → 대상 존재 → self 위임 → admin → 대상이 owner 인가.** 인가(앞의 둘)를` —
    5단계 나열에서 "앞의 둘"은 위치상 1·2번째(멤버십·대상 존재)로 읽히는데, 실제로 인가에 해당하는
    단계는 1번째(멤버십)와 4번째(admin)다. 2번째(대상 존재, 404 판정)는 인가가 아니라 존재 확인이다.
    결론(“인가를 끝내기 전에는 대상에 대해 아무것도 답하지 않는다”)은 정확하지만, 그 근거로 삼는
    "앞의 둘"이라는 위치 지칭이 오독을 유발한다. 이전 라운드(`review/code/2026/09/24/11_10_45`
    documentation INFO #9)가 이미 같은 지점을 지적했고 "선택적/필수 아님"으로 유예됐다 — 이번 라운드도
    수정되지 않은 채 남아 있음을 재확인한다(에스컬레이션 아님, 기록 목적).
  - 제안: "인가(멤버십·admin)" 처럼 위치가 아니라 이름으로 지칭하거나, "비-멤버는 1단계에서,
    비-admin(그리고 owner 를 지목한 경우)은 4단계에서 끝난다"처럼 재서술.

## 요약

이번 diff 는 문서화 관점에서 전반적으로 모범적이다. `CHANGELOG.md` 는 프로젝트 관례(취소선 + 해소
주석으로 이전 항목의 전방 참조를 정정, 계약 변경 고지, "남는 것" 절로 남은 스코프 명시)를 정확히
따르고 있고, 직전 라운드(`review/code/2026/09/24/11_10_45`)가 지적한 CHANGELOG 미갱신(Critical)·
`wireFindOne` docstring stale(W2)·예고 문구 stale(W3)은 모두 실제 코드 상태와 대조해 정확히
수정됐음을 확인했다(`workspaces.service.spec.ts:1473-1481`, `:1668-1679`). `workspaces.service.ts` 의
새 JSDoc·인라인 주석은 판정 순서 재배치 이유·동시성 상호작용·`throwNotAMember`/`throwAdminRequired`
추출 근거를 코드와 정확히 대응해 서술하고, `spec/5-system/3-error-handling.md:46,49`·
`spec/5-system/1-auth.md:551` 의 stale 서술은 developer 쓰기 권한 밖임을 정확히 인지해 planner
백로그 항목으로 적절히 이관했다(인용된 줄 번호 전부 실측 대조로 정확함을 확인). 새로 남은 문제는
경미한 수준 둘뿐이다 — (1) 아직 이동하지 않은 plan 을 미래 경로(`plan/complete/...`)로 미리 인용한
전방 참조 2곳(WARNING, build guard 사각지대), (2) 5단계 순서 나열과 "인가(앞의 둘)"라는 위치 지칭이
어긋나는 JSDoc 표현 1곳(INFO, 이전 라운드에서 이미 유예 처리됨). 둘 다 코드 정확성이나 안전성에
영향을 주지 않는 순수 문서 표현 문제다.

## 위험도

LOW
