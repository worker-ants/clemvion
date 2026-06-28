# Documentation Review — web-chat-quality-backlog.md

## 발견사항

- **[WARNING]** `spec_impact` frontmatter 필드 누락
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-backlog-closeout-c2d1d4/plan/complete/web-chat-quality-backlog.md` frontmatter (lines 1-5)
  - 상세: 이 파일은 `plan/complete/` 에 직접 신규 생성됐다. `.claude/docs/plan-lifecycle.md §5 Gate C` 에 따르면 완료 plan 의 frontmatter 에는 `spec_impact` 필드 선언이 필수다(`started` 가 2026-06-04 이후인 plan 에 한해 `spec-plan-completion.test.ts` 가 강제). 본 plan 의 `started: 2026-06-27` 은 그 범위 안에 든다. 섹션 D 에서 여러 spec 파일(`4-security.md`, `0-architecture.md`, `spec/5-system/12-webhook.md` 등)을 실제로 수정했으므로 `spec_impact: none` 이 아닌 변경 목록이 들어가야 한다.
  - 제안: frontmatter 에 아래와 같이 추가
    ```
    spec_impact:
      - spec/7-channel-web-chat/4-security.md
      - spec/7-channel-web-chat/0-architecture.md
      - spec/7-channel-web-chat/3-auth-session.md
      - spec/7-channel-web-chat/2-sdk.md
      - spec/7-channel-web-chat/1-widget-app.md
      - spec/5-system/12-webhook.md
    ```
    (실제 변경된 spec 경로 확인 후 조정)

- **[INFO]** backlog 성격의 plan 임에도 섹션 C 의 미완료 항목 언급이 불명확
  - 위치: `plan/complete/web-chat-quality-backlog.md`, 섹션 C 하위 들여쓰기 메모 (line 31)
  - 상세: C 섹션의 체크박스는 모두 `[x]` 이나, 들여쓰기 메모로 "추가 backlog 메모 — 전부 비차단" 이라고 명시한 `configFromQuery apiBase origin 검증(보안 #6)`, `phase=blocked Panel 테스트(#14)`, `1-widget-app §3.1·§2 spec 문서화(SPEC-DRIFT)` 3건이 아직 미처리 상태로 남아있다. `plan-lifecycle §2` 에서 "미해결 follow-up 항목이 하나라도 있으면 in-progress/" 라고 규정하나, 이 plan 은 "비차단 backlog 묶음" 이라는 특수 성격으로 설계됐고 문서 도입부에도 이를 명시하고 있어 실질적 규약 위반이라기보다 의도된 예외다. 그러나 리더 입장에서 "완전히 끝난 plan 인가?"가 모호할 수 있다.
  - 제안: 들여쓰기 메모를 별도 섹션 `## E. 미처리 비차단 메모 (picking 대기)` 로 격상시켜 이 plan 자체에서 더 이상 추적하지 않는 항목임을 명확히 하거나, 문서 도입부 인트로에 "C 섹션 들여쓰기 메모는 아직 처리되지 않은 INFO 급 항목으로 추후 별도 plan 또는 picking 시 신설" 이라는 한 줄을 추가한다.

- **[INFO]** PR 번호 참조 일부 불완전
  - 위치: 섹션 B (line 25-27), 섹션 C (line 30)
  - 상세: 섹션 A는 `PR #744` 로 명시됐고, D는 `PR 미정` 으로 솔직히 표기됐다. B·C 섹션은 PR 이름(`webchat-usewidget-split`, `webchat-widget-refactor`)과 commit hash 일부(`df77e61e6+`)로 표기되어 있어 실제 PR 번호가 확정되면 일관성이 떨어진다.
  - 제안: 현재 상태로도 추적은 가능하나, 머지 후 실제 PR 번호로 업데이트하는 것을 권장한다.

- **[INFO]** `owner: developer (TBD)` 미갱신
  - 위치: frontmatter line 4
  - 상세: 모든 항목이 완료(전부 `[x]`)된 상태로 `plan/complete/` 에 들어왔음에도 owner 가 `TBD` 로 남아있다. 완료 시점에 실제 담당자(worktree 수행자)를 기재하는 것이 이력 관리에 유리하다.
  - 제안: 실제 담당 역할/이름으로 교체한다.

## 요약

이 변경은 웹챗 백로그를 한 곳에 집약한 plan 문서를 `plan/complete/` 에 신규 생성한 것으로, 코드 파일 변경이 없어 독스트링·API 문서·인라인 주석·CHANGELOG 등 코드 중심 문서화 항목은 해당 사항이 없다. 문서 내용 자체는 각 항목이 명확한 PR 참조와 상태 표시를 갖추고 있고, 도입부의 "비차단 backlog" 성격 선언도 적절하다. 그러나 `plan-lifecycle §5 Gate C` 가 요구하는 `spec_impact` frontmatter 필드가 누락됐으며, 이는 `spec-plan-completion.test.ts` 빌드 가드에 의해 강제되는 항목이므로 WARNING 으로 분류한다. 나머지는 모두 선택적 개선 수준의 INFO 항목이다.

## 위험도

LOW
