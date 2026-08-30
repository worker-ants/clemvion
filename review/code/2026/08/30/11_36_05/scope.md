# 변경 범위(Scope) Review

## 조사 방법

프롬프트에 실린 diff 4건(`websocket.service.spec.ts` + plan 3건)이 실제로는 단일 커밋
`10f7a2350`(`test(ws): facade 재수출을 명시 계약으로 — ws-event-types-extract 종결`) 하나임을
`git log`/`git merge-base --is-ancestor`로 확인했다. `origin/main`과의 3-dot diff 기준으로
이 브랜치가 origin/main 대비 추가한 커밋은 이 하나뿐이며, 프롬프트가 "새 파일"·"파일 삭제"로
표시한 `plan/complete/*.md` ↔ `plan/in-progress/*.md` 쌍은 실제로는 `git mv`(rename) 이고,
`git diff <merge-base> 10f7a2350 -- <old> <new>`로 실제 내용 델타를 직접 대조했다.

## 발견사항

- **[INFO]** 이 PR(단일 커밋)이 자신의 작업(facade 커버리지 테스트 1건)과 무관한 다른 세션의
  plan 트래커까지 함께 `complete/`로 옮긴다
  - 위치: `plan/complete/spec-draft-followups-drain-2026-08-30.md` (신규, `git mv` 원본은
    `plan/in-progress/spec-draft-followups-drain-2026-08-30.md`)
  - 상세: 이 문서의 frontmatter는 `worktree: spec-followups-drain-08e637` · `owner:
    project-planner`로, 현재 커밋이 속한 워크트리(`ws-facade-coverage-close-bda707`,
    `owner: developer`)와 다른 별도 세션·역할의 산출물이다. 실제 diff는
    `status: in-progress` → `status: complete` 단 한 줄만 바꾸는 순수 `git mv`이고 본문 내용은
    전혀 건드리지 않았다. 커밋 메시지에 "함께 정리 — planner 턴이 빠뜨린 것. 초안을 쓰고
    적용하고 머지까지 해 놓고 draft 자신을 옮기는 걸 잊었다"라고 명시적으로 이유를 밝혀
    은폐성은 없고, `plan/**`는 developer 쓰기 권한 범위(CLAUDE.md skill 표)라 권한 위반도
    아니다. 다만 "facade 재수출 커버리지 닫기"라는 이 PR의 1차 의도와는 별개 축의 정리이므로
    엄격히 보면 범위 밖 부수 작업이다.
  - 제안: 실질 위험은 없음(1줄 상태 플래그, 별도 커밋으로 분리해도 됐을 정도로 독립적).
    조치 불요 — 참고용으로만 기록.

- **[INFO]** `ws-event-types-extract.md` 이동 시 frontmatter `worktree` 필드가 원 작업
  워크트리에서 현재 워크트리로 덮어써진다
  - 위치: `plan/complete/ws-event-types-extract.md` frontmatter (`worktree:` 라인)
  - 상세: `worktree: ws-event-types-followups-4731db` → `worktree:
    ws-facade-coverage-close-bda707`. followups 라운드를 수행한 이전 워크트리 식별자가
    사라지고 이번 워크트리로 대체된다. 이 저장소의 plan-lifecycle 관례상 `worktree` 필드는
    "최종 처리 워크트리"를 기록하는 것으로 보이며(다른 완료 plan 파일들도 마지막 처리자
    기준), 계약 위반이라기보다 이력 정밀도 손실 수준이라 범위 문제로 보기 어렵다.
  - 제안: 조치 불요.

- 나머지 3개 델타 — 신규 테스트(`websocket.service.spec.ts`), `ws-event-types-extract.md`의
  `spec_impact` 채움 + 잔여 체크박스 `[x]` 처리(모두 이 plan 문서 본문이 스스로 "developer
  턴이 같은 PR에서 git mv + spec_impact 7줄을 넣으면 이 항목이 닫힌다"고 사전에 명시해 둔
  조건과 정확히 일치), `spec-sync-external-interaction-api-gaps.md`의 링크 경로 갱신(같은
  문서가 "이동 시 갱신할 살아있는 인입 링크"로 명시한 대상과 정확히 일치) — 은 모두 계획
  문서 자신이 미리 정의해 둔 작업 범위와 1:1로 대응한다. 포맷팅/주석/임포트 변경도 새로 추가된
  테스트 블록에 국한되며 기존 코드 스타일·구조를 건드리지 않는다.

## 요약

프롬프트가 4개 파일의 대규모 add/delete로 보여준 diff는 실제로는 커밋 1개, 파일 4개(그중
2개는 `git mv` rename)로 이루어진 매우 작고 목적이 명확한 변경이다. 핵심 코드 변경(facade
re-export 커버리지 테스트 1건, +24줄)과 plan 트래커 완료 처리(`ws-event-types-extract.md`
→ `complete/`, 관련 링크 갱신)는 그 plan 문서 자신이 사전에 못박아 둔 조건과 정확히
일치해 범위 이탈이 아니다. 유일하게 눈에 띄는 부수 작업은 다른 워크트리 소유의 이미 머지된
planner plan(`spec-draft-followups-drain-2026-08-30.md`) 상태 플래그를 함께
`complete/`로 옮긴 것인데, 커밋 메시지에 이유가 명시돼 있고 실질 변경은 frontmatter 1줄뿐이라
위험도는 낮다. 포맷팅·주석·임포트·설정 변경은 전부 새로 추가된 코드에 국한되며 기존 코드를
건드리는 불필요한 리팩토링·기능 확장·무관한 수정은 발견되지 않았다.

## 위험도

LOW
