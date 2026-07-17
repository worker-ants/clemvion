# Plan 정합성 Check 결과

대상: `spec/7-channel-web-chat/` (impl-done, diff-base `origin/main`)
브랜치: `claude/webchat-replay-unavailable-consume` (HEAD `c8b998bc1`)

## 핵심 질문에 대한 결론 (선행 컨텍스트)

이 브랜치는 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 "(후속) web-chat 위젯
클라이언트 소비" 항목을 `[ ]` → `[x]` 로 종결하며, `origin/main`(PR #957 merge 시점)이 남긴 "⚠ 머지 전
판단 필요 — 구조 문제"(`useEiaStream` 분리 선행 검토 요구)에 "구조 개선 — `worldGen` 단일화" 절로 답한다.

- `git diff origin/main...HEAD -- plan/in-progress/spec-sync-external-interaction-api-gaps.md` 로 실제
  변경분을 확인한 결과, "분리가 아니라 가드 단일화를 택했다"는 판단과 그 근거(4종 staleness 가드 →
  `worldGenRef` 단일화, 재현된 3개 잔존 버그, mutation 검증)가 plan 문서에 상세히 기록돼 있다.
- 코드로 직접 검증 — `worldGenRef`/`pendingResetRef`/`seedWaitingFromStatusRef`/`finalizeEnded` 가
  `codebase/channel-web-chat/src/widget/use-widget.ts` 에 실재하고, plan 이 인용한 회귀 테스트명
  (`"복원된 세션이 이미 terminal → ENDED 전이 + SSE 미오픈 + storage 부활 없음"`,
  `describe("useWidget — 버퍼 만료 재동기화(execution.replay_unavailable, §3.1)")`)이
  `use-widget-eager-start.test.ts` 에 그대로 존재한다. plan 의 "완료" 서술은 과장이 아니다.
- target(`spec/7-channel-web-chat/1-widget-app.md §3.1`)의 신규 서술
  (`git diff origin/main...HEAD -- spec/7-channel-web-chat/1-widget-app.md`, 13행 추가)도 이 구현과
  1:1 대응한다 — "서버 emit·위젯 리스너·소비 분기가 모두 구현됐다"·"스냅샷이 이미 terminal 이면 종료로
  확정한다" 서술이 `handleEiaEvent`/`seedWaitingFromStatus` 의 실제 동작과 일치.
- `[x]` 로의 flip 은 이 브랜치 자신의 merge 와 원자적으로 일어나므로, #957 이 못박은 "머지 전까지 `[ ]`
  유지" 규칙도 위반하지 않는다(코드 없이 `[x]`만 먼저 landing 되는 상태가 생기지 않음).
- 다른 `plan/in-progress/**` 파일 전수를 `web-chat|widget|위젯|replay_unavailable|worldGen|useEiaStream|
  useEiaSession|채널 웹챗|7-channel-web-chat` 키워드로 스캔한 결과, 본 주제와 교차하는 파일은
  `spec-sync-external-interaction-api-gaps.md`(위 항목 자신)와 `eia-context-schema-followups.md`
  (같은 브랜치의 별개 완료 항목 — `EventSource stub` 헬퍼 추출, 대상 다름·충돌 없음) 뿐이다. 다른
  in-progress plan 이 "결정 필요"로 남긴 항목과 충돌하는 결정은 발견되지 않았다.

즉 이 질문 자체("#957 의 구조 문제 제기에 대한 답이 정합한가")에는 **정합**이라는 결론이다. 다만 아래에서
별도로 발견한 **인접 spec 파일의 stale 서술**은 이 브랜치의 코드 변경이 초래한 부수 효과이며 갱신이
누락됐다.

## 발견사항

- **[WARNING]** `3-auth-session.md §3.1` 의 "여전히 미구현(Planned)" 주석이 이 브랜치의 코드 변경으로
  부분적으로 stale 화됐으나 target 은 갱신하지 않음
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md:62`(§3.1 blockquote "v1 구현 현황(부분)")
    및 `:71`(REST 분기표 "`200`+`status`∈{완료/실패/취소}(종료) → storage 정리 후 `[ended]`" 행).
    이 파일은 target 디렉토리(`spec/7-channel-web-chat/`) 안에 있으나 이번 브랜치 diff 에는
    **포함되지 않았다**(`git diff origin/main...HEAD -- spec/7-channel-web-chat/3-auth-session.md` 결과 없음).
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 "(후속) web-chat 위젯
    클라이언트 소비" 항목(이번에 `[x]`) — 이 항목이 도입한 코드 변경이 원인.
  - 상세: `3-auth-session.md:62` 는 "아래 2단계의 **200+종료·404·복구불가 401 REST 분기**와 `401 →
    낙관적 refresh 1회` 는 여전히 미구현(Planned)"이라고 세 branch 를 하나로 묶어 서술한다. 그러나 이번
    브랜치의 commit `be3e311f3`("fix(web-chat): seed 반환 계약으로 종료 게이팅")가
    `use-widget.ts` `seedWaitingFromStatus` 에 추가한 로직
    (`if ((TERMINAL_EVENTS as readonly string[]).includes(\`execution.${status.status}\`)) { finalizeEnded(...); return "ended"; }`)
    은 `applyConfig()` 의 새로고침 세션 복원 분기(`loadSession` 직후 호출, 코드 주석 자체가 "새로고침
    복원(N1)"이라 명명)에서도 그대로 재사용된다 — `origin/main` 버전의 `seedWaitingFromStatus` 에는 이
    분기가 **없었음**을 `git show origin/main:codebase/channel-web-chat/src/widget/use-widget.ts` 로
    직접 확인했다. `finalizeEnded` 는 `teardownSession()`(storage 삭제 포함) + `ENDED` 전이 + host 통지를
    수행하므로, 정확히 `3-auth-session.md:71` 이 "Planned" 라고 선언한 "`200`+종료 → storage 정리 후
    `[ended]`" 분기를 구현한 것과 동일하다. 즉 세 갈래("200+종료"·"404"·"401+refresh") 중 **"200+종료"
    하나는 이제 사실이 아닌데도** blockquote 는 여전히 셋을 뭉뚱그려 "미구현"이라 말한다(404·401 낙관적
    refresh 는 `catch` 블록이 여전히 상태코드 구분 없는 soft-fail 이라 실제로 미구현 — 그 두 갈래는
    문구가 정확함).
    `1-widget-app.md:114`(이번 diff 로 추가된 텍스트) 자신도 "같은 판정은 **세션 복원 시점**(§3.1
    재open 복원)에도 적용되며"라고 이 연결을 인지하고 있었는데도 `3-auth-session.md` 쪽은 갱신되지
    않았다. `review/code/2026/07/17/06_53_03/requirement.md` 의 "spec fidelity 확인"도 `3-auth-session.md`
    를 대조했지만 **다른 문장**(`:79` 의 410 storage 정리 규칙)만 확인했고 `:62`/`:71` 의 이 staleness 는
    어느 리뷰 라운드에서도 지적되지 않았다(6개 라운드 RESOLUTION.md 전수 스캔 결과 미언급).
  - 제안: `3-auth-session.md §3.1` blockquote 를 "200+종료는 `seedWaitingFromStatus` 가 구현(2026-07-17,
    `execution.replay_unavailable` 소비와 동일 로직 공유) — 404 `EXECUTION_NOT_FOUND` 분기와 `401` 낙관적
    refresh 만 잔여 Planned" 로 좁혀 갱신. 아울러 이 좁혀진 잔여 범위(404 분기 + 401 낙관적 refresh)는
    현재 **어떤 `plan/in-progress/**` 파일에도 추적되지 않는다**(전수 grep 결과 0건 — spec 안에 "이 REST
    오류 분기·낙관적 refresh 완전 구현은 후속 결정으로 남긴다"는 문장만 있고 대응 체크리스트 항목이 없음).
    `spec-sync-external-interaction-api-gaps.md` 에 신규 `[ ]` 항목으로 등재하거나 별도 plan 파일을 여는
    것을 권장 — 이 프로젝트가 이미 `1-widget-app.md §R8`("존재하지 않는 제약을 Planned 로 남기면 후속
    작업자가 이미 있는 변환기를 중복 구현하고, 진짜 제약이 가려진다")에서 스스로 지적한 것과 같은 유형의
    drift 다.

- **[INFO]** `useEiaSession` 분리 후속이 체크리스트 항목이 아니라 완료 항목의 산문에만 남음
  - target 위치: 해당 없음(target 자체엔 영향 없음 — plan 문서 내부 추적 이슈).
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:44` — "분리는 여전히 후속
    후보 — 다만 그 경계는 `useEiaStream`(스트림)이 아니라 `useEiaSession`(세션 라이프사이클 전체,
    ≈300/735줄)이어야 하고, 가드가 하나로 정리된 지금 상태에서 하는 편이 안전하다."
  - 상세: 이 문장은 `[x]` 로 체크된 "(후속) web-chat 위젯 클라이언트 소비" 항목 **본문 산문 안**에 있다.
    plan-lifecycle 관행상(예: 본 파일의 다른 항목들이 "별도 후속으로 분리" 시 새 `[ ]` 불릿을 만드는
    패턴, `- [ ] getStatus 일반 nodeOutput 키-allowlist` 등과 대비) 이 refactor 후보는 상위 항목이
    `[x]` 로 닫히고 이 plan 파일이 최종적으로 `plan/complete/` 로 이동하면 자칫 묻힐 위험이 있다(지금
    당장은 같은 파일에 미해결 `[ ]` 항목이 2개 더 있어 이동 대상이 아니므로 즉각적 위험은 아님).
  - 제안: 이 refactor 후보를 별도 `- [ ]` 불릿(예: "`useEiaSession` 분리 검토 — 가드 단일화 이후 후속
    후보")으로 승격해 향후 이 plan 이 완료 이동될 때 함께 유실되지 않도록 한다. 급하지 않으므로 이번
    PR 내에서 처리할 필요는 없음.

## 요약

이 브랜치가 PR #957 이 남긴 "머지 전 판단 필요 — 구조 문제" 노트에 제시한 답(`worldGen` 단일화, 분리
기각)은 plan 서술·실제 코드·target spec(`1-widget-app.md §3.1`) 삼자가 모두 일치하며, 다른
`plan/in-progress/**` 문서가 열어둔 결정과 충돌하지도 않는다 — 핵심 질문에는 정합 판정이다. 다만 조사
과정에서, 이 브랜치가 `execution.replay_unavailable` 소비를 위해 손댄 `seedWaitingFromStatus` 가 새로고침
세션 복원 경로에도 재사용되면서 **`3-auth-session.md §3.1`(같은 target 디렉토리의 인접 문서)이 "여전히
미구현(Planned)"이라 선언한 세 REST 분기 중 하나("200+종료")를 사실상 구현**해 버렸는데, 이 브랜치도
6라운드에 걸친 `/ai-review` 도 그 인접 문서 갱신을 놓쳤다는 새 발견(WARNING)을 확인했다. CRITICAL 급 결정
충돌은 없다.

## 위험도
MEDIUM
