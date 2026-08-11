# 정식 규약 준수 검토 — convention_compliance

검토 대상: `spec/7-channel-web-chat` (impl-done, diff-base `origin/main`, scope=code_areas)
관련 규약: `spec/conventions/spec-impl-evidence.md`

## 발견사항

### [INFO] `3-auth-session.md` `partial → implemented` 승격 — 검증 결과: 정당함 (규약 위반 아님)

- target 위치: `spec/7-channel-web-chat/3-auth-session.md` frontmatter (`status`, `pending_plans` 제거)
- 관련 규약: `spec/conventions/spec-impl-evidence.md` §3 (`status` 라이프사이클), §3.1 (`partial → implemented`: "마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격")
- 상세: `git diff origin/main...HEAD -- spec/7-channel-web-chat/3-auth-session.md` 로 실측했다.
  - `origin/main` 쪽 상태: `status: partial` + `pending_plans: [plan/in-progress/webchat-reload-rest-error-branches.md]` (이건 별도 PR #1130 이 만든 CRITICAL 정정 — "본문이 미구현을 자인하는데 `status: implemented` 였다"는 결함을 고친 것).
  - 이 브랜치(`deb9b6978` 이하)는 #1130 이 머지되기 **전** 시점에서 분기했고, 그 사이 실제로 §3.1-2·§R4 가 서술한 `404`/`401`(낙관적 refresh)/`410` REST 오류 분기 3종을 **코드로 구현**했다(diff 상 `use-widget.ts` §checkStatus 관련 +374줄, 회귀 테스트 다수 — `execution.not_found`/`execution.token_revoked`/`recoverFromExpiredToken` 등).
  - `origin/main` 을 머지하는 커밋(`51e8c72e8`)에서 두 가지가 **같은 커밋 안**에서 함께 일어났다: (a) `plan/in-progress/webchat-reload-rest-error-branches.md` → `plan/complete/webchat-reload-rest-error-branches.md` 이동(신규 110줄, in-progress 쪽은 병합 후 사라짐 — `git show 51e8c72e8:plan/in-progress/...` 없음 확인), (b) `3-auth-session.md` frontmatter 를 (병합 충돌 해소로) `status: implemented` + `pending_plans` 제거 상태로 확정. 즉 §3.1 이 요구하는 "같은 commit 안에서 승격" 조건을 merge commit 이 실질적으로 충족한다.
  - `code:` 목록 6개 경로(`session-store.ts`/`api-base.ts`/`eia-client.ts`/`use-widget.ts`/`use-session-generations.ts`/`use-token-refresh.ts`) 전부 워킹트리에 실존 확인 — §4 `spec-code-paths.test.ts` 통과 조건 충족.
  - `spec/0-overview.md` 도 같은 diff 안에서 "5/6 implemented, 3-auth-session 은 partial" → "6/6 implemented" 로 동기 갱신됐고, web-chat 영역 6개 spec 문서(`0-architecture`~`5-admin-console`) 전부 `status: implemented` 임을 직접 확인했다(단독으로 뒤처진 문서 없음).
  - `## Rationale` §R4 의 구 배너("결정은 내려졌으나 구현은 없다 (Planned)")도 이 diff 에서 제거돼 본문·frontmatter·code 세 층이 정합한다.
- 결론: **승격은 정당하다.** merge commit 을 승격 커밋으로 쓴 것이 다소 이례적인 메커니즘이지만(직접 커밋이 아니라 병합 충돌 해소), 커밋 메시지(`deb9b6978`)가 사전에 "이 PR 이 먼저 머지되면 #1130 의 partial 근거가 사라지므로 그쪽에서 재판정해야 한다"고 명시적으로 예고했고, 실제로 병합 시점에 그 재판정이 이뤄졌다. 스키마·가드 관점에서도 결함 없음.
- 제안: 조치 불필요. 다만 향후 유사 상황(두 PR 이 같은 spec frontmatter 를 다른 방향으로 건드리는 경우) 재현 시, 병합 충돌 해소를 "승격 커밋"으로 쓰기보다 병합 직후 별도의 명시적 `docs:` 커밋으로 분리하면 `git blame`/이력 추적이 더 쉬워진다 — 강제 사항은 아님.

### [WARNING] `plan/complete/webchat-reload-rest-error-branches.md` 본문 내부 자기모순 — "완료" 선언과 "구현하지 않았다" 서술이 공존

- target 위치: `plan/complete/webchat-reload-rest-error-branches.md` §"본 PR 에서 한 것 (2026-08-10)" (파일 106~114줄)
- 관련 규약: 직접적인 frontmatter 스키마 위반은 아니라 `spec-plan-completion.test.ts`(Gate C) 대상은 아니다. 다만 CLAUDE.md "정보 저장 위치 단일 진실 원칙"과 `.claude/docs/plan-lifecycle.md` 가 전제하는 "완료 plan = 최종 상태를 정확히 반영"이라는 암묵 규약에 해당.
- 상세: 파일 상단 배너(12~14줄)는 "**상태**: **완료**(2026-08-10) ... `pending_plans` 에서 제거하고 `status` 를 `implemented` 로 승격했다"라고 선언하고, §"미구현 항목" 체크리스트(71~83줄)도 4개 항목 모두 `[x]` 로 완료 표시한다. 그런데 바로 아래 §"본 PR 에서 한 것 (2026-08-10)" (106~114줄)은 같은 날짜를 달고 "frontmatter 정정... **위 3개 항목의 구현은 하지 않았다**"라고 정반대로 서술한다. 이 절은 이 plan 이 아직 `plan/in-progress/`(unstarted stub)였던 **이전 단계**(아마도 #1130 시점)의 요약이 그대로 남은 것으로 보이며, `plan/complete/` 로 이동해 "완료"로 확정된 지금 시점 기준으로는 stale/오독 위험이 있다.
- 제안: §"본 PR 에서 한 것" 절에 "(이 절은 #1130 시점 기록 — 실제 구현은 본 PR 의 §미구현 항목 체크리스트로 대체 완료됨)" 같은 시점 각주를 달거나, 절 제목을 "본 문서의 이전 단계(정정만) 기록"으로 바꿔 최종 완료 서술과 시제 충돌을 없앨 것을 권장. (Gate C 가드는 통과하므로 build 차단 사유는 아님 — 문서 정확성 개선 권고.)

### [INFO] `plan/complete/webchat-reload-rest-error-branches.md` — Gate C `spec_impact` 스키마 검증 결과: 적합

- target 위치: `plan/complete/webchat-reload-rest-error-branches.md` frontmatter (`spec_impact:`)
- 관련 규약: `spec/conventions/spec-impl-evidence.md` §4.2 `spec-plan-completion.test.ts`(Gate C), 구현 `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts`
- 상세: `started: 2026-08-10` ≥ cutoff `2026-06-04` 이므로 Gate C 강제 대상. `spec_impact` 는
  ```yaml
  spec_impact:
    - spec/7-channel-web-chat/3-auth-session.md
    - spec/0-overview.md
  ```
  형태로 **YAML 리스트**(bare string 아님, 빈 배열 아님) — `hasValidSpecImpact`/`danglingSpecImpact` 조건을 그대로 만족한다. 두 경로 모두 실측 결과 `spec/` 하위에 실존하는 `.md` **파일**(디렉터리 아님)이고, 실제로 이 PR 의 diff 에서 둘 다 수정됐다(즉 "선언은 있는데 실제로 안 건드림" 케이스도 아니다). `../` 이탈이나 빈 문자열 등 가드가 특히 경계하는 함정도 없음.
- 제안: 조치 불필요.

## 요약

명시적으로 요청된 두 항목 모두 실측 결과 **정식 규약 위반이 없다.** (1) `3-auth-session.md` 의 `partial → implemented` 승격은 `spec-impl-evidence.md §3.1` 이 요구하는 "같은 commit 안에서 `pending_plans` complete 이동 + status 승격" 조건을 `51e8c72e8` 병합 커밋이 실제로 충족하며, 근거인 REST 오류 분기 3종 구현이 diff 에 실재하고 `code:`/영역 6개 spec 문서 상태·`spec/0-overview.md` 서술까지 전부 동기화됐다. (2) `plan/complete/webchat-reload-rest-error-branches.md` 의 `spec_impact` 는 Gate C 스키마(YAML 리스트, 실존 spec 파일 2개)를 정확히 만족한다. 다만 같은 plan 문서 내부에 "완료" 선언과 모순되는 이전 단계 잔존 서술(§"본 PR 에서 한 것")이 남아 있어 문서 정확성 관점의 WARNING 하나를 별도로 등재했다 — build 가드를 통과하므로 차단 사유는 아니지만 이 저장소가 반복적으로 겪어 온 "plan 서술이 철회로 거짓이 되는" 유형이라 방치하면 오독 소지가 있다. 그 외 번들에 포함된 web-chat 영역 코드 diff(REST 오류 분기·`recoverFromExpiredToken`·`conversationEnded.reason` 값들)는 기존 명명·출력 포맷 규약(2-sdk.md §3 의 "열린 문자열 reason" 등)과 충돌 없이 정합했다. 컨텍스트 예산 초과로 `4-security.md`/`_product-overview.md`/`0-architecture.md`/`5-admin-console.md` 본문은 번들에서 생략됐으나, 이번 검토 항목(frontmatter 승격·Gate C)에는 두 target(`3-auth-session.md`, plan 파일)이 온전히 포함돼 있어 직접 영향은 없다.

## 위험도

LOW
