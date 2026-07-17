# Plan 정합성 검토 결과

> 대상: `spec/2-navigation` 사용자 가이드(/docs) 사이드바 무한 중첩 라우팅 버그 수정 계획
> (실제 작업 plan: `plan/in-progress/user-guide-routing-loop-fix.md`)
> 검토 모드: --impl-prep

## 사전 확인 메모

`prompt_file` 의 "Target 문서"/"구현 대상 영역" 필드가 실제 파일 경로가 아니라 작업
설명 문자열이 그대로 들어가 있음(orchestrator payload 조립 이슈로 추정). 실제 diff 는
`(없음)` — 아직 구현 착수 전(코드 변경 없음)이라는 뜻으로 해석했다. 이에 맞춰
`plan/in-progress/user-guide-routing-loop-fix.md` 를 target 작업으로 간주하고, 그 계획이
가정하는 근본원인·spec 인용(`spec/2-navigation/_layout.md:85`, `spec/2-navigation/9-user-profile.md:155-158`)
을 실제 코드(`sidebar.tsx`, `(main)/[...rest]/page.tsx`, `(main)/w/[slug]/`)와 대조해 검증했다.

## 발견사항

- **[INFO]** catch-all terminal 동작(notFound/dashboard-forward)이 spec 에 명문화되지 않음
  - target 위치: `plan/in-progress/user-guide-routing-loop-fix.md` §결정 (`rest[0]==="w"` 분기 — `/w/<slug>` 단독은 dashboard forward, 그 외는 `notFound()`)
  - 관련 spec: `spec/2-navigation/_layout.md:85`("구 무-slug 경로는 catch-all 이 흡수"만 서술), `spec/2-navigation/11-error-empty-states.md:56,70`(일반 404 정책·무효 slug FE redirect 는 있으나 "유효 slug + 미지의 sub-path → 404" 케이스는 명시 없음)
  - 상세: plan 은 ①(사이드바 docs bare href)에 대해서는 "spec 변경 불요 — 구현만 정렬"이라고 명확히 근거를 댔지만, ②(catch-all 을 terminal 로 바꿔 `/w/<slug>/<미지의경로>` 를 notFound() 시키는 것)는 기존 spec 문구("구 무-slug 경로 흡수")의 범위를 넘는 신규 동작이다. 다만 이는 `11-error-empty-states.md` 의 일반 "존재하지 않는 라우트 → 404" 정책과 상충하지 않고 오히려 그 정책을 구조적으로 강제하는 방향이라 스펙 위반은 아니다. 다만 이번 버그의 근본 원인이 "코드 주석에만 적혀 있던 잘못된 가정"(`page.tsx:15` "specific route 가 우선하므로 `/w/[slug]/...` 는 여기 오지 않는다")이었던 만큼, 같은 실수 재발을 막으려면 이 catch-all 의 terminal 계약을 spec 에도 한 줄 남겨두는 편이 안전하다.
  - 제안: 필수 차단 사유는 아니므로 constructor 판단에 맡기되, 여유가 있으면 `_layout.md:85` 또는 `11-error-empty-states.md` §1.3 부근에 "`/w/<slug>` 하위 미지의 경로는 catch-all 이 `notFound()` 로 종결한다(무한 리다이렉트 방지)" 한 줄 추가를 권장. 없어도 --impl-prep 통과에는 지장 없음.

## 교차 확인 (충돌 없음 — 참고용)

- `plan/in-progress/spec-sync-user-profile-gaps.md:25` — "docs(`/docs`)는 워크스페이스 무관이라 계속 slug 밖(설계)"를 이미 완료([x]) 항목으로 명문화. target 의 근본원인 판단(① sidebar.tsx 가 docs 에 예외를 안 둔 것은 버그, spec 의도와 불일치)과 **정합** — 미해결 결정을 우회하는 것이 아니라 이미 확정된 설계 의도를 코드에 뒤늦게 맞추는 작업.
- `plan/complete/workspace-slug-routing.md:37,45-51,72` — 원 슬러그 라우팅 설계가 "specific route 우선이라 docs 를 자연 제외"라는 가정 하에 `docs bare 유지`를 26개 파일 링크 마이그레이션의 명시적 항목(§5)으로 뒀었다. `sidebar.tsx` 가 그 항목을 놓쳐 지금 버그가 된 것으로 보이며, target plan 은 이 완료된 plan 의 원래 의도를 정확히 복원하는 방향 — 충돌 없음.
- 코드 확인: `(main)/[...rest]` catch-all 은 `(main)` 그룹에만 존재하고 `(editor)` 그룹(`(editor)/w/[slug]/...`, editor-slug-phase2 완료분)에는 대응 catch-all이 없어 동일 결함 클래스가 없음을 확인 — target 의 수정 범위(`(main)/[...rest]/page.tsx`)가 충분하며 후속 항목 누락 없음.
- `(main)/w/[slug]/` 하위에 `page.tsx` 부재 확인 — target 의 "부수 발견"(`/w/<slug>` 단독도 동일 루프) 진술과 일치.
- `buildWorkspaceHref` idempotent 화 "미채택" 결정에 대해 다른 in-progress plan 이 idempotent 동작을 전제하거나 요구하는 곳 없음(grep 전수 검색 결과 target 문서 자신만 매치) — 일방적 결정 우회 없음.
- `workspaceScoped` 플래그명이 다른 spec/plan 의 기존 명명과 충돌하지 않음(신규 용어, 중복 없음).
- worktree 재사용 확인: 이 worktree(`manual-trigger-default-param-e0d395`)의 원래 과제 `plan/complete/manual-trigger-default-param.md` 는 이미 완료 상태 — 새 과제(라우팅 버그 fix)로 재사용된 것이며 미완료 작업 방치 아님.

## 요약

target(`user-guide-routing-loop-fix.md`)이 인용한 spec 근거(`_layout.md:85`, `9-user-profile.md:155-158`)와 실제 코드(`sidebar.tsx`, `(main)/[...rest]/page.tsx`, `(main)/w/[slug]/` 부재)를 대조 검증한 결과 진술이 정확했고, 이미 완료된 `workspace-slug-routing.md`/`editor-slug-phase2.md`·진행 중인 `spec-sync-user-profile-gaps.md` 의 "docs 는 slug 밖 유지" 설계 의도와도 정합했다. 다른 in-progress plan 중 이 라우팅 영역(`sidebar.tsx`/`buildWorkspaceHref`/`(main)/[...rest]`)을 건드리는 것은 없어 후속 항목 무효화나 선행 미해소 의존성도 발견되지 않았다. 유일한 관찰은 catch-all 의 새 terminal(404) 계약이 spec 문언 밖의 확장이라는 INFO 수준 참고이며, 진행을 막을 사유는 아니다.

## 위험도

NONE
