# Plan 정합성 검토 결과

> 대상 작업: `plan/in-progress/user-guide-routing-loop-fix.md` (사이드바 "사용자 가이드"(`/docs`)
> 클릭 시 `/w/<slug>/w/<slug>/.../docs` 무한 중첩 라우팅 버그 fix)
> 검토 모드: `--impl-prep spec/2-navigation/` (session `00_21_55` 의 payload 조립 오류를
> 정정한 재실행)

## 사전 확인

- `plan/in-progress/user-guide-routing-loop-fix.md` 를 읽고, 인용된 spec 좌표
  (`spec/2-navigation/_layout.md:85`, `spec/2-navigation/9-user-profile.md:158`,
  `spec/2-navigation/10-auth-flow.md:443`, `spec/2-navigation/11-error-empty-states.md
  §1.3`)를 실제 파일에서 재확인했다. 참고로 이번 payload 코드블록에는 `_layout.md`·
  `9-user-profile.md` 가 포함되지 않았으나(0-dashboard/1-workflow-list/10-auth-flow/
  11-error-empty-states/13-user-guide/14-execution-history/15-system-status/
  16-agent-memory 만 포함), plan 이 근거로 삼는 핵심 문서라 파일시스템에서 직접 열람해
  대조했다.
- `plan/in-progress/**` 전수 중 이 라우팅 영역(`sidebar.tsx` / `buildWorkspaceHref` /
  `(main)/[...rest]`)을 언급하는 것은 `user-guide-routing-loop-fix.md` 자신과
  `spec-sync-user-profile-gaps.md` 뿐임을 확인(grep).
- 작업 트리에 이미 구현 diff 가 존재해(`sidebar.tsx`/`(main)/[...rest]/page.tsx`/`href.ts`/
  테스트) plan 의 서술이 실제 코드와 일치하는지도 함께 검증했다.

## 발견사항

- **[INFO]** catch-all terminal(404) 계약의 spec 보강이 아직 파일로 존재하지 않음
  - target 위치: `plan/in-progress/user-guide-routing-loop-fix.md` 체크리스트 `#10`
    ("spec 보강 draft (`spec-update-catch-all-terminal-contract.md`) → project-planner 위임", 미체크)
  - 관련 plan: 해당 파일은 `plan/in-progress/`·`plan/complete/` 어디에도 아직 생성되어 있지
    않다(확인 완료). session `00_21_55` 에서 이 항목이 WARNING(`rationale_continuity` W#2)
    이었으나, 같은 세션의 재검토 및 이번 세션 `rationale_continuity` (INFO #4) 모두
    "`11-error-empty-states.md §1.3` 의 기존 '존재하지 않는 라우트 → 404' 정책과 상충하지
    않고 오히려 그 정책을 구조적으로 강제하는 방향" 이라는 결론에 도달해 INFO 로 하향됨을
    확인했다(재검증 결과 동일 결론 — 아래 상세 참고).
  - 상세: `_layout.md:85` 는 현재 "구 무-slug 경로로 진입하면 catch-all 이 활성 slug 로
    흡수한다" 만 서술하고, `/w/<slug>/<미지의 경로>` 를 `notFound()` 로 종결하는 신규 분기는
    spec 문언 범위 밖의 확장이다. 다만 `11-error-empty-states.md:66` ("404 감지: 존재하지
    않는 라우트 접근 시 표시")·`:70` (무효/비멤버 slug 는 별개의 FE redirect 케이스로 이번
    분기와 겹치지 않음)과 상충하지 않으므로 spec 위반은 아니다. `10-auth-flow.md:443` 의
    "redirect-only 중간 경로"(로그인 후 `/dashboard` 흐름)도 `rest[0]==="w"` 분기 대상이
    아니라(그 경로는 `rest=["dashboard"]`, `rest[0]!=="w"`) 반증되지 않음을 코드로 확인했다.
    plan 은 이 follow-up 을 체크리스트 마지막 항목(#10)으로 이미 포함해 project-planner
    위임을 예정하고 있어 "누락"은 아니고 "미완료 예정 항목"이다.
  - 제안: 차단 사유 아님. 다만 이번 세션 `rationale_continuity`(INFO #4)가 "spec 보강 draft
    는 본 PR 내 실제 작성 필수"로 명시했으므로, `#10` 체크박스가 본 PR 종료 전에 실제로
    `plan/in-progress/spec-update-catch-all-terminal-contract.md` 파일 생성 + project-planner
    위임까지 이어지는지 확인 권장(리뷰 단계에서 누락되면 spec-코드 drift 로 이월).

## 교차 확인 (충돌 없음 — 참고용)

- `plan/in-progress/spec-sync-user-profile-gaps.md:25` — "docs(`/docs`)는 워크스페이스
  무관이라 계속 slug 밖(설계)" 를 이미 완료(`[x]`) 항목으로 명문화. target 의 근본원인
  판단(① `sidebar.tsx` 가 docs 에 예외를 안 둔 것은 버그, spec 의도와 불일치)과 정합 —
  미해결 결정을 우회하는 것이 아니라 이미 확정된 설계 의도를 코드에 뒤늦게 맞추는 작업.
- `plan/complete/workspace-slug-routing.md`(phase 1) / editor-slug-phase2(완료) — 원 슬러그
  라우팅 설계와 "docs bare 유지" 의도를 target 이 정확히 복원하는 방향. 선행 plan 미해소
  없음(둘 다 완료 상태).
- `spec/2-navigation/9-user-profile.md:158` — "slug 밖 유지(워크스페이스 무관·별 그룹): 유저
  가이드(`/docs`) · 인증(`/login` 등)" 문구가 plan 의 인용과 정확히 일치.
- `(main)/w/[slug]/` 하위 `page.tsx` 부재 확인 — target 의 "부수 발견"(`/w/<slug>` 단독도
  같은 루프) 진술과 일치. `(editor)` 그룹에는 대응 catch-all 자체가 없어 동일 결함 클래스
  없음(수정 범위 충분).
- `buildWorkspaceHref` idempotent 화 "미채택" 결정에 대해, 이를 전제하거나 요구하는 다른
  in-progress plan 없음(전수 grep) — 일방적 결정 우회 없음.
- `workspaceScoped` 신규 필드명이 다른 spec/plan 기존 명명과 충돌하지 않음.
- 코드 실측: 현재 작업 트리 diff(`(main)/[...rest]/page.tsx`, `sidebar.tsx`, `href.ts`)가
  plan 의 "결정" 절 서술(①`workspaceScoped` 플래그, ②`rest[0]==="w"` 종결 분기, ③
  idempotent 미채택 근거 docstring화)과 정확히 일치함을 확인 — plan 과 실제 구현 사이
  드리프트 없음.

## 요약

target(`user-guide-routing-loop-fix.md`)이 인용한 spec 근거(`_layout.md:85`,
`9-user-profile.md:158`, `10-auth-flow.md:443`, `11-error-empty-states.md §1.3`)를 실제
파일과 대조한 결과 모두 정확했고, `spec/2-navigation/` 이 "결정 필요"로 남겨둔 미해결
항목과 충돌하는 결정도 없었다. 이미 완료된 `workspace-slug-routing.md`/editor-slug-phase2 및
진행 중인 `spec-sync-user-profile-gaps.md` 의 "docs 는 slug 밖 유지" 설계 의도와도 정합하며,
이 라우팅 영역을 건드리는 다른 in-progress plan 이 없어 후속 항목 무효화나 선행 plan
미해소도 발견되지 않았다. 유일한 관찰은 catch-all 의 새 terminal(404) 계약을 spec 에
반영하는 후속 작업(체크리스트 #10, `spec-update-catch-all-terminal-contract.md`)이 아직
파일로 존재하지 않는다는 점인데, 이는 plan 자신이 이미 마지막 단계로 추적 중인 예정 항목이라
"누락"이 아니라 "완료 확인 필요" 수준의 INFO 다.

## 위험도

NONE
