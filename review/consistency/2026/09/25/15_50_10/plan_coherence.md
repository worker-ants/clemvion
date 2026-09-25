# Plan 정합성 검토 — `spec-draft-workspace-path-guard-followup.md`

## 발견사항

없음. 아래는 확인 근거의 요약이다.

- **W1~W3·INFO1 전부가 이미 `plan/in-progress/workspace-path-guard-impl.md` §`--impl-prep` 경고 처리
  표가 "planner 턴" 으로 명시 위임한 항목**이고, 그 plan 의 체크리스트 `- [ ] planner 턴(W1 · W2 · W3 ·
  INFO 1) — --spec 게이트` 는 아직 미체크다. target 은 정확히 그 위임을 이행하는 문서이며, plan 이
  "결정 필요" 로 남긴 어떤 항목도 target 이 다르게 결정하지 않았다 — 처리 방향(변경 1~3, INFO 1)이
  impl plan 의 표·구현 중 결정 절과 문장 단위로 일치한다.
- target 이 인용하는 네 spec 파일의 현재 본문을 직접 Read 로 대조했다 — 변경 1 대상 줄(`9-user-profile.md`
  159행), 변경 2 대상 문장(`1-auth.md` 831행, (b) 결론), 변경 4 삽입 지점(`error-codes.md` §5 첫 문단
  뒤)이 target 이 적은 "전" 텍스트와 정확히 일치하고, 아직 2026-09-25 각주가 붙지 않은 상태임을 확인했다
  (중복 적용 위험 없음).
- 변경 1·2 가 인용하는 `data-flow/12-workspace.md` 의 두 앵커(`#경로-파라미터-워크스페이스도-가드가-본다-2026-09-25`,
  `#url-slug--fe-라우팅-sot-≠-backend-인가-sot`)는 실제 헤딩과 슬러그가 일치해 링크가 착지한다.
- 변경 3 의 전제("이 PR 이 만들거나 고친 저장소 가드 셋이 `code:` 어디에도 없다")를 `1-auth.md`·
  `swagger.md` frontmatter 를 직접 읽어 재확인했다 — 둘 다 `workspace-param-binding*`·`param-uuid-pipe*`·
  `workspace-roles-attachment.spec.ts` 를 담고 있지 않다(0건, target 의 실측과 일치). 저장소의 기존
  `code:` 등재가 전부 `repo-guards/__tests__/**` 개별 glob(디렉터리 통째 glob 없음)이라는 target 의
  "기각한 대안" 근거도 `swagger.md`·`review-citations.md`·`2-api-convention.md` 세 곳에서 재확인된다.
- 변경 4 의 전제(`code: 'forbidden'` 발행처 0건)와 §3 행에 이미 박힌 "(2026-09-25 `forbidden` 을 이 행에서
  뺐다…)" 각주도 실측과 일치한다.
- 다른 `plan/in-progress/*` (`auth-guard-reflection-hardening.md`, `spec-sync-auth-gaps.md`,
  `nestjs-v12-coordinated-upgrade.md` 등, RolesGuard·`@WorkspaceId()`·`1-auth.md`/`9-user-profile.md`
  를 언급하는 파일들)의 미해결 항목(`- [ ]`)을 열어 대조했으나, target 이 편집하는 정확한 절(§3 워크스페이스
  전환 마지막 줄, §부트 캐너리 (b), §5 머리말)과 겹치는 열린 결정은 없다. `auth-guard-reflection-hardening.md`
  §1 안의 동일 문구("캐너리는 호출부에 아무것도 요구하지 않으면서 같은 위험을 닫는다")는 완료된(`[x]`) 과거
  결정 기록이며 `@WorkspaceId()` 축에 한정된 서술이라 target 의 (b) 각주(`@WorkspaceParam` 예외)와
  모순되지 않는다 — 해당 plan 은 해당 문구를 갱신 대상으로 지목하지 않는다.
- `nestjs-v12-coordinated-upgrade.md` §C 의 캐너리 기준값(142) 재실측 책임은 target 이 아니라
  `workspace-path-guard-impl.md` 구현 요구 1 이 이미 명시적으로 지고 있다(target 의 스코프 밖, 별도
  plan_coherence INFO 로 이미 추적됨 — `review/consistency/2026/09/25/15_15_21` INFO 3).

## 요약

target 문서는 같은 PR 의 spec 커밋(`e2e257707`) 뒤 `--impl-prep`(`15_15_21`, BLOCK: NO)가 남긴 W1·W2·
W3·INFO1 을 처리하는 planner 턴 산출물이며, 그 처리 방식은 `workspace-path-guard-impl.md` 가 미리 위임한
방향과 정확히 일치한다 — 미해결 결정을 우회하거나 일방적으로 재정의한 곳이 없다. 네 변경의 전제(대상 줄
텍스트, frontmatter `code:` 부재, 발행 이력 부재)를 저장소 원본 대조로 재확인했고 전부 실측과 일치했다.
다른 in-progress plan 과 편집 대상 절이 겹치는 곳도 없다. Plan 정합성 관점에서 문제 없음.

## 위험도

NONE
