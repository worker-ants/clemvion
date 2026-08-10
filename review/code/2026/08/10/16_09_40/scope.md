# 변경 범위(Scope) Review

대상 커밋: `deb9b6978` — "feat(webchat): 재로드 REST 오류 분기 3종 구현"
대상 파일 3개: `use-widget-eager-start.test.ts` · `use-widget.ts` · `spec/7-channel-web-chat/3-auth-session.md`

## 발견사항

- **[INFO]** 코드/테스트 diff 자체는 스코프 이탈 없음
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:486-528` (새 `404`/`401` 분기, catch 블록 내부), `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:244-375` (신규 `it` 4건)
  - 상세: `use-widget.ts` 의 추가분은 기존 `seedWaitingFromStatus` 의 `catch` 블록 안에 `404`/`401` 분기를 삽입하는 것으로 국한되며, 마지막 `soft-fail` 주석 한 줄(`// soft-fail — 그 외 오류는 종료로 오판하지 않는다.`, gate 528)만 문구가 다듬어졌을 뿐 로직 변경이 아니다. `use-widget-eager-start.test.ts` 는 기존 `describe` 블록 안에 새 `it` 4개(404·401-성공·401-재차실패·500-soft-fail)를 순수 추가했을 뿐, 기존 테스트·헬퍼·import 는 손대지 않았다. 두 파일 모두 이번 기능(재로드 REST 오류 분기 3종)에 1:1로 대응하며, 무관한 리팩토링·포맷팅·주석 정리·import 정리는 발견되지 않았다.
  - 제안: 없음(참고용).

- **[INFO]** spec 본문 갱신도 기능과 1:1 — frontmatter 미변경 판단은 타당함
  - 위치: `spec/7-channel-web-chat/3-auth-session.md:66` (diff hunk `@@ -63,7 +63,7 @@`)
  - 상세: diff 는 §3.1 상단의 "v1 구현 현황(부분)" 안내 문구 **한 문단만** 교체한다 — "`404`·복구불가 `401` REST 분기와 `401 → 낙관적 refresh 1회` 는 여전히 미구현(Planned)" → "…도 구현됐다(2026-08-10)". frontmatter(`3-auth-session.md:1-13`, 특히 `status: implemented` at line 3)는 diff 밖이며 실제로 건드리지 않았다. 이 판단(frontmatter 를 `#1130` 소관으로 남겨두고 본문만 현행화)은 스코프 관점에서 타당하다: (1) frontmatter `status`/`pending_plans` 필드는 이 PR 의 관심사가 아니라 `#1130` 이 활성 편집 중인 별도 축이고, 지금 이 PR 이 손대면 그 필드에서 실제 텍스트 충돌이 발생한다. (2) 이 diff 만 놓고 보면 자기완결적이다 — frontmatter `status: implemented` 는 원래도 변경 전/후 동일했고, 본문이 이제 그 `status` 와 다시 일치하게 됐다(종전엔 frontmatter=`implemented` 인데 본문이 "미구현" 이라고 자인하는 기존 모순이 있었고, 이 diff 는 그 모순을 없애는 방향으로만 움직인다). 즉 이 PR 자체는 build 가드(`spec-status-lifecycle.test.ts` 등)를 깨지 않는 범위 안에서 최소 변경으로 남았다.
  - 제안: 없음 — 이 결정 자체는 유지 권장.

- **[WARNING]** 두 PR 의 머지 순서 의존을 커밋 메시지에만 남긴 것은 불충분
  - 위치: 커밋 `deb9b6978` 메시지 "## PR #1130 과의 순서 (중요)" 섹션 (diff 대상 파일 어디에도 이 문구는 없음 — `git log -1` 로만 확인 가능)
  - 상세: 이 상호작용은 단순 텍스트 충돌이 아니라 **의미적 조정 의무**다 — `spec-impl-evidence.md §3` 의 `partial → implemented` 자동 승격 가드는 "`pending_plans` 가 `complete/` 로 이동하는 커밋 안"에서만 발동하므로, `#1130` 이 먼저 머지돼 `status: partial` + `pending_plans:` 를 심어도 그 `pending_plans` 가 가리키는 plan 이 실제로는 이미(이 PR 로) 완료됐다는 사실을 아무 가드도 자동으로 알아채지 못한다 — 누군가 수동으로 그 plan 을 `complete/` 로 옮기고 `status` 를 되돌려야 한다. 이 조치를 트리거할 유일한 단서가 현재는 `git log` 로 이 특정 커밋의 본문을 읽어야만 보인다는 점이 약하다: (1) 이 브랜치엔 아직 PR 이 생성되지 않았고(`gh pr view` 확인 — "no pull requests found"), PR 이 생성될 때 커밋 본문이 그대로 PR 설명으로 승계된다는 보장이 없다(다중 커밋·squash·웹 UI 생성 시 유실 가능). (2) `spec/7-channel-web-chat/3-auth-session.md` 본문 자체에는 `#1130` 언급이 전혀 없어, 이 spec 을 직접 열어보는 사람/에이전트(`project-planner`, `consistency-checker`, 차후 이 파일을 만지는 아무 세션)는 이 의존성을 알 방법이 없다. (3) `plan/in-progress/` 에도 이 상호작용을 추적하는 항목이 없다(검색 결과 없음) — 이 저장소의 관례상 "진행 중 조율이 필요한 사실"은 `plan/` 또는 spec `## Rationale` 에 남기는 것이 단일 진실 원칙에 부합하는데, 이번 건은 어느 쪽에도 없다.
  - 제안: 최소한 다음 중 하나는 추가할 것 — (a) 이 브랜치의 PR 설명(`gh pr create --body`)에 커밋 메시지의 "PR #1130 과의 순서" 섹션을 그대로 포함시켜 GitHub 상에서 두 PR 리뷰어/머저가 직접 보이게 하거나, (b) `#1130` 쪽 PR 에도 상호 링크 코멘트를 남기거나, (c) 짧은 `plan/in-progress/*.md` 항목(또는 기존 관련 plan)에 "두 PR 중 나중에 머지되는 쪽이 `3-auth-session.md` frontmatter `status`/`pending_plans` 를 재판정해야 함"을 체크리스트로 남겨 머지 이후에도 추적 가능하게 할 것.

- **[INFO]** developer 롤의 `spec/` 쓰기 경계와의 정합성 — 문제는 아니나 참고
  - 위치: 커밋 전체(`codebase/**` + `spec/7-channel-web-chat/3-auth-session.md` 동일 커밋)
  - 상세: `CLAUDE.md` 는 "개발자(`developer`)는 `spec/` read-only, 구현 중 spec 변경 필요 시 멈추고 `project-planner` 위임"이라고 명시한다. 이 커밋은 `feat(webchat)` 타이틀로 `codebase/**` 와 `spec/**` 를 한 커밋에 함께 바꿨다. 다만 이 spec 변경은 새로운 spec **결정**을 만드는 것이 아니라 이미 spec 이 확정 서술해 둔 동작(§3.1-2·§R4)을 그대로 구현한 뒤 "구현됨"으로 사실 갱신한 것뿐이라 실질적 스코프 이탈로 보기는 어렵다. 이 저장소 이력에도 유사 선례(`feat`/`fix` 커밋이 `codebase/**`+`spec/**` 를 함께 수정한 예, 예: `8d84f6e9f`)가 있고, 그 커밋은 정작 `spec/conventions/` 만은 "developer 권한 밖" 이라며 별도 draft 로 분리했다 — 즉 이 프로젝트의 실제 관행은 "일반 spec 본문의 사실 동기화는 developer 커밋에 포함 가능, conventions/ 등 정책성 문서는 분리"로 보인다. 이번 변경 대상은 conventions 가 아니므로 관행과 어긋나지 않는다.
  - 제안: 조치 불요. 다만 향후 세션이 "spec 변경 필요 시 project-planner 위임" 문구를 문자 그대로 적용할지, 이번처럼 "이미 확정된 spec 을 그대로 구현한 사실 동기화"는 developer 스코프로 볼지 애매하면 `CLAUDE.md` 규약에 명시적 예외 문구를 추가하는 편이 이후 판단 비용을 줄인다(이번 리뷰의 판단 요청 밖이므로 별도 항목으로만 남김).

## 요약

세 파일의 diff 자체는 "spec 이 정의해 둔 재로드 REST 오류 분기 3종(404/401 성공/401 재차실패) 구현 + 그 경계를 고정하는 회귀 테스트 + 그 사실을 반영한 spec 문구 갱신"이라는 단일 의도에 정확히 대응하며, 무관한 리팩토링·포맷팅·주석/임포트 정리·기능 확장은 없다. frontmatter 를 건드리지 않은 판단(불머지 PR #1130 과의 충돌 회피)도 diff 단독으로는 자기완결적이라 타당하다. 다만 두 PR 사이의 머지 순서 의존이라는 실질적 조정 의무를 커밋 메시지 본문에만 적어 둔 것은, 아직 PR 조차 생성되지 않은 이 시점 기준으로 발견 가능성이 낮아 — GitHub PR 설명 또는 `plan/` 항목 등 더 지속적이고 눈에 띄는 위치에도 같은 내용을 남길 것을 권장한다.

## 위험도

LOW
