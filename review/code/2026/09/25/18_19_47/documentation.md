# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `CHANGELOG.md` 의 "실측" 라우트 개수가 실제 코드와 크게 어긋난다 — 특히 admin 은 실제의 절반 수준으로 축소돼 있다.
  - 위치: `CHANGELOG.md:31` (`## Unreleased — 워크스페이스 권한 거부가 코드를 싣고, 경로의 워크스페이스를 가드가 판정한다` 항목, "`@Roles()` 가 붙은 **모든** 라우트(2026-09-25 실측 editor 66 · admin 9 · owner 7 · viewer 5)" 문장)
  - 상세: 이 문장은 "거부 코드 변경이 `@Roles()` 붙은 **모든** 라우트에 전역으로 영향을 준다"는 것을 외부 API 소비자에게 알리는 목적으로 쓰였다(직전 라운드 `RESOLUTION.md`(`review/code/2026/09/25/16_39_25/RESOLUTION.md:18`)에 따르면 W8 "CHANGELOG 에 전역 범위가 강조되지 않음"에 대한 답으로 이 수치가 추가됐다). 그런데 이 문장이 커밋된 시점(`85a38d00f`)은 이미 같은 PR 의 이전 커밋(`d5031b699` — "경로 15곳(workspaces 14 · 전환 1)을 `@WorkspaceParam('id')` 로. 역할 요구는... Admin 8 · Owner 2(remove 신규...)")이 `workspaces.controller.ts` 에 `@Roles('admin')` 8곳 · `@Roles('owner')` 1곳(신규)을 이미 추가한 **뒤**였다. 이번 diff(파일 17, `workspaces.controller.ts` 라인 126·155·319·351·404·439·483·532)에서도 이 8곳의 `@Roles('admin')` 추가가 그대로 보인다.
    저장소를 AST 아닌 라인 단위로 직접 세어 보면(주석 속 `@Roles('...')` 언급은 제외, `*.controller.ts` 전수, 2026-09-25 현재/이 PR 병합 시점 기준):
    - `admin`: **17건** (alerts 3 · audit-logs 1 · auth-configs 5 · workspaces 8) — CHANGELOG 는 9
    - `editor`: **63건** — CHANGELOG 는 66 (이 PR 은 editor 데코레이터를 추가·삭제하지 않았다 — PR 전후 값이 같아야 하는데도 다르다)
    - `owner`: **4건** (executions 2 · workspaces 2) — CHANGELOG 는 7
    - `viewer`: **4건**(agent-memory 2 · knowledge-base 1 · workflows 1) — CHANGELOG 는 5 (이 셋 다 이 PR 밖의 파일이라 PR 전후로 값이 변할 이유가 없는데도 다르다)
    합계는 88(실제) vs 87(CHANGELOG)로 얼추 비슷해 보이지만 버킷별로는 admin 이 실제 대비 **약 47%만** 반영돼 있다 — "이 코드 변경이 미치는 라우트 범위"를 알리는 것이 이 문장의 목적인데, 정확히 그 목적에 쓰이는 숫자가 가장 크게 어긋나 있다. CHANGELOG 상단이 스스로 못박은 규칙("판정과 수치는 **main 대비 · 머지 시점**이다")과도 맞지 않는다 — 9 는 이 PR 이 추가하기 **이전**의 admin 개수(alerts+audit-logs+auth-configs = 9)와 정확히 일치해, 자신이 방금 추가한 8곳을 빠뜨리고 잰 값으로 보인다.
  - 제안: `editor 63 · admin 17 · owner 4 · viewer 4`(2026-09-25 병합 시점 실측, 총 88건)로 정정할 것. 앞으로 이런 수치를 적을 때는 "PR 이 스스로 추가한 데코레이터까지 포함해 최종 상태를 다시 센다"를 체크리스트로 둘 만하다(이 저장소의 다른 가드 파일(`param-uuid-pipe-guard.ts`)이 같은 실수를 정규식→AST 정정 사례로 이미 한 번 문서화해 두었다).

## 요약

이번 PR(경로 워크스페이스 가드, 30개 코드 파일)의 문서화 수준은 5라운드에 걸쳐 이례적으로 정교하게 다듬어졌다 — 모든 신규·변경 공개 함수/클래스에 JSDoc 이 있고, 근거는 `spec/data-flow/12-workspace.md` §Rationale("경로 파라미터 워크스페이스도 가드가 본다" · "가드 거부의 오류 코드")로 정확히 교차 참조되며, 그 spec 섹션이 실제로 이 PR 의 최신 정정(세 메서드 오라클, 커밋 `4c6f4f033`)까지 반영하고 있음을 직접 대조로 확인했다. `spec/5-system/1-auth.md` 의 부트 캐너리 절도 `@WorkspaceParam` 카운팅 신설을 이미 반영했다. 기존 주석이 이번 변경으로 틀리게 된 자리는 전부 취소선(`~~...~~`) + "(2026-09-25 정정)" 관례로 원문을 보존한 채 정정했고(`workspaces.service.ts`, `workspaces.service.spec.ts`, `workspace-rbac.e2e-spec.ts`, `role-gate.tsx` 등 — 직전 라운드 WARNING 이 지적한 `role-gate.tsx` 도 이번엔 고쳐져 있다), `param-uuid-pipe-guard.ts` 의 모집단 수치(136 = `@Param` id-형 121 + `@WorkspaceParam` 15)도 CHANGELOG·spec·가드 주석·e2e 스펙 전부 같은 숫자로 일치했다. 유일하게 발견한 결함은 CHANGELOG 의 "실측" 라우트 개수 문장으로, 실제 저장소를 다시 세어 보니 admin 이 절반 이하로 축소돼 있고 이 PR 이 손대지 않은 editor·owner·viewer 수치도 어긋나 있었다 — 이 PR 자신이 만든 admin 라우트 증가를 반영하지 못한 채 잰 값으로 보인다. 그 외에는 30개 파일 전체에서 API 문서(`@ApiForbiddenResponse`) 갱신 누락·오래된 주석·설정 문서 공백을 찾지 못했다.

## 위험도

LOW
