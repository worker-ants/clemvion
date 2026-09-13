# Cross-Spec 일관성 검토 — `guide-error-code-truth` (--impl-done, scope=`spec/5-system/`, 라운드 2)

## 전제

이 브랜치는 `spec/5-system/**` 를 한 건도 바꾸지 않았다(스코프 델타 0 — 코드·유저 가이드·harness
전용 PR 이라 정상). 프롬프트의 diff 절은 예산 초과로 절단됐으므로, 실제 변경분은 워킹트리를
절대경로로 직접 대조했다(`git diff origin/main...HEAD -- codebase/` 1164줄 20파일 전문 확인).
이 세션은 같은 plan 에 대한 **세 번째 cross-spec 검토**다 — 앞선 두 라운드
(`review/consistency/2026/09/13/01_15_40`[--impl-prep] · `10_12_54`[--impl-done 라운드1])의
발견·처분 상태를 먼저 대조하고, 그 이후 코드가 더 바뀌었는지, 새 결함이 생겼는지만 추가로 봤다.

## 발견사항

- **[INFO] 라운드1 WARNING("`LLM_RATE_LIMIT` 두 표 중복")은 이번 HEAD 에서 해소 확인**
  - target 위치: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx` ·
    `.en.mdx` "엔진 수준" `<FieldTable>`
  - 충돌 대상: (해소됨 — 참고용 기록) `spec/5-system/3-error-handling.md §1.4`
  - 상세: `10_12_54` cross_spec WARNING#1 이 지목한 자리를 실측 재확인했다.
    `grep -n "LLM_RATE_LIMIT" run-results{,.en}.mdx` 결과 각 파일에서 **1회씩만** 출현하며
    (노드-종류별 `AI · LLM` 행), 엔진 수준 `<FieldTable>` 에서는 제거되어 있다. plan
    체크리스트("cross_spec W#1 — 고침")와 일치. 새로운 조치 불요.

- **[WARNING] `3-error-handling.md §1` 카탈로그가 통합(Cafe24/Makeshop)·OAuth 코드 계열을 여전히
  누락 — 이번 PR 이 새로 만든 것은 아니나 미해소 상태로 잔존**
  - target 위치: `spec/5-system/3-error-handling.md` §1.1~§1.12 (Integration 노드 도메인 전용
    §1.13 부재)
  - 충돌 대상: `spec/conventions/error-codes.md`("본 규율은 `CAFE24_*`·`OAUTH_*` 등 인라인
    문자열 발행 코드를 포함한다"), `spec/4-nodes/4-integration/{4-cafe24,5-makeshop}.md §6`
    (`CAFE24_*`/`MAKESHOP_*` 실재 카탈로그), `spec/2-navigation/4-integration.md`(`OAUTH_*` 계열)
  - 상세: `01_15_40` cross_spec WARNING#1 이 최초 지목했고, 이번 배치가 고친 결함(§C,
    `MAKESHOP_API_ERROR` 지어냄)이 정확히 이 사각지대에서 났다는 것도 그때 이미 확인됐다.
    `grep -n "CAFE24\|MAKESHOP\|OAUTH_" spec/5-system/3-error-handling.md` 는 지금도 0건이다 —
    이번 diff 는 `spec/**` 를 쓰지 않으므로(developer 쓰기 범위 밖) 이 갭을 좁히지 못했고
    그 사실 자체는 정상이다.
  - 상세(비판정 사유): `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미
    `- [ ] "3-error-handling.md §1 카탈로그가 통합·LLM 코드 계열을 통째로 누락한다" (planner,
    2026-09-13 등재)` 로 정확히 등재돼 있고, 같은 항목이 다른 두 plan(`spec-update-node-
    cancellation-shutdown-classification.md`·`keyset-cursor-uuid-validation.md`)의 겹치는
    제안까지 실측 병기해 한 턴에 묶도록 지시해 두었다. **새로운 발견이 아니라 확인 차원의
    재확인**이다.
  - 제안: 별도 조치 불요 — 위 planner 항목이 처리되면 자동 해소. 세 plan 을 한 planner 턴에서
    처리하라는 지시가 이미 있으므로 이 리뷰에서 추가로 할 일은 없다.

- **[WARNING] `testConnection` 실패 응답 shape 이 `7-llm-client.md`·`6-config.md` 어느 표에도
  없음 — 미해소 상태로 잔존**
  - target 위치: `spec/5-system/7-llm-client.md` §8.3 (`{ success: true }` / `{ success: true,
    dimension? }` 성공 케이스만 기술)
  - 충돌 대상: `spec/2-navigation/6-config.md` §B.3(동일하게 성공 케이스만), `spec/2-navigation/
    4-integration.md` §9.1(형제 엔드포인트는 `{success, code, message}` 실패 shape 명시)
  - 상세: `01_15_40` cross_spec WARNING#2 가 최초 지목했다 — 그때는 실패 shape 이 `message` 로
    "확정될 예정"이었는데 아직 spec 에 앵커가 없다는 경고였다. 지금은 그 `message` 결정이
    코드에 **이미 배선 완료**됐다(`llm.service.ts`·양쪽 DTO·`assertMatchesContract`·와이어
    HTTP 테스트까지) — 즉 SoT 부재 상태에서 구현이 한 단계 더 확정된 것이다. `spec/**` 는
    developer 쓰기 범위 밖이라 이 PR 이 두 표를 갱신하지 못한 것 자체는 정상이나, 확정된 계약이
    spec 표에 아직 없다는 gap 은 그대로 남아 있다.
  - 상세(비판정 사유): 같은 tracker 파일에 `- [ ] "testConnection 실패 응답 shape 이 어느 spec
    표에도 없다" (planner, 2026-09-13 등재 · "5개 checker 전원이 짚었다")` 로 이미 등재돼 있고,
    8갈래 문장 SoT 경로(`sanitize-error.util.ts`)까지 명시해 두었다. **새로운 발견 아님**.
  - 제안: 별도 조치 불요 — planner 항목 처리 시 두 표에 `{ success: false, message }` 를 추가
    하면 해소.

- **[INFO] `user-guide-evidence.md §2.1` 관계표가 신규 가드(`guide-error-code-existence`)를
  아직 반영하지 않음 — 미해소 상태로 잔존, 이미 tracker 등재**
  - target 위치: `spec/conventions/user-guide-evidence.md` §2("Build-time 가드 (3건)")·§2.1
  - 충돌 대상: `CHANGELOG.md` Unreleased 항목·신규 테스트 파일 헤더 주석이 이미 "그 컨벤션의
    가드 가족"이라고 서술
  - 상세: `10_12_54` cross_spec INFO 가 최초 확인했고, 지금도 `spec/conventions/user-guide-
    evidence.md:68` 는 여전히 "3건"이다(`grep` 재확인). `spec/**` 가 developer 쓰기 범위 밖이라
    이 PR 로는 해소 불가능한 항목이고, 같은 tracker 에 planner 항목으로 이미 등재돼 있다
    (`- [ ] "user-guide-evidence.md §2.1 관계표에 새 가드가 빠져 있다" (planner, 2026-09-13
    등재)`). **새로운 발견 아님**.
  - 제안: 별도 조치 불요.

## 검증 완료 — 라운드 1 이후 재확인해도 충돌 없는 항목

- `LlmService.testConnection` `error`→`message`, 양쪽 DTO `latencyMs` 제거: `7-llm-client.md
  §8.3`(성공 케이스만 서술)과 여전히 모순 없음. `models{,.en}.mdx` 8갈래 문장표는
  `sanitize-error.util.ts` 8개 반환 리터럴과 신설 `guide-sanitized-message-parity.test.ts` 로
  글자 단위까지 대조 고정됨 — 라운드1 이후 새로 추가된 안전장치.
- `run-results{,.en}.mdx`/`error-handling{,.en}.mdx` 의 `NODE_EXECUTION_FAILED`/
  `nodeName`→`LLM_TIMEOUT`/`nodeLabel` 치환은 `3-error-handling.md §1.4`·§2.2 예시와 정확히
  일치(§2.2 는 2026-08-17 에 이미 `nodeLabel` 로 정정돼 있었다).
- `integrations{,.en}.mdx` 의 `MAKESHOP_API_ERROR`→`MAKESHOP_404` + 코드 계열은
  `spec/4-nodes/4-integration/5-makeshop.md §6` 과 정확히 일치.
- `TestConnectionResultDto.code?: string` 신설은 `spec/2-navigation/4-integration.md §9.1`
  (`{success, code, message}` 기존 문서화)과 합치 — 과소 선언 방향의 gap 을 spec 쪽으로
  닫은 것. 형제 gap(MCP 전용 `capabilities`/`serverInfo`/`preview` 3종 미선언)은 이번 diff
  범위 밖이며 developer 항목으로 이미 등재됨(비CRITICAL, 부분 고침으로 명시).
- RBAC·상태 전이·요구사항 ID·데이터 모델 축에서는 이번 diff(라운드1 이후 변경분: JSDoc 이동,
  `collectBackendTokens` 파라미터명 정정, UI 실패 토스트 테스트 추가, `guide-sanitized-message-
  parity` 신규 가드)와 충돌하는 서술을 찾지 못했다.

## 요약

이번 라운드에서 관측된 코드 변경분(라운드1 리뷰 지적 10건 처분: `LLM_RATE_LIMIT` 중복 제거,
`nodeName`→`nodeLabel`, UI 실패 경로 테스트, 8갈래 문장 SoT 대조 가드, DTO `code?` 선언, plan
상호참조 실측 등)은 모두 기존 spec SoT(`3-error-handling.md`·`7-llm-client.md`·
`5-makeshop.md`·`2-navigation/4-integration.md`)와 정확히 합치하며, 라운드1에서 지목했던 유일한
WARNING(`LLM_RATE_LIMIT` 중복)은 해소가 확인됐다. 남은 세 항목(§1 카탈로그의 통합/OAuth 코드
누락, `testConnection` 실패 shape 미문서, `user-guide-evidence.md` 관계표 미갱신)은 이번 PR 이
새로 만든 결함이 아니라 `spec/**` 쓰기 권한 밖에서 생긴 pre-existing gap 이며, 셋 다
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 정확히
등재되어 있어 이 PR 을 막을 사유가 아니다. 이번 라운드가 새로 만든 `codebase/**` 결함은
발견되지 않았다 — plan 이 라운드2 진입 전 선언한 정지 규칙("Critical 0 이고 모든 발견이
이미 planner 등재분이거나 plan/review-only 로 닫히는 것")을 충족한다.

## 위험도

LOW
