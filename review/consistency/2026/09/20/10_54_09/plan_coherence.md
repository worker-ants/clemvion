# Plan 정합성 검토 — spec/4-nodes/4-integration/ (--impl-done)

## 검토 개요

target scope(`spec/4-nodes/4-integration/`)의 `origin/main` 대비 spec 델타는 0개 파일 —
이 브랜치(`ssrf-catch-instanceof-7b3f1a`)는 SSRF 가드 소비자 넷의 catch 를
`instanceof SsrfBlockedError` 로 가르는 코드 전용 변경(`plan/in-progress/ssrf-catch-instanceof.md`,
`spec_impact: none`)이다. 아래는 그 구현이 target spec 텍스트 및 `plan/in-progress/**` 의
미해결 결정·후속 항목과 정합한지를 확인한 결과다.

## 발견사항

- **[INFO]** 후속 항목은 이미 같은 턴에 트래커로 등재됨 — 신규 누락 없음
  - target 위치: `spec/4-nodes/4-integration/0-common.md` §4.2 (공통 에러 코드 표),
    `1-http-request.md` frontmatter `code:` / §4.2, `2-database-query.md` §6.2
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` (SSRF catch instanceof
    항목 바로 아래에 2026-09-20 신규 추가된 3개 항목 — "가드 고장이 preflight 냐 리다이렉트 홉이냐에
    따라 다른 코드로 나간다", "가드 «고장» 메시지에는 host/IP 마스킹이 없다", "`1-http-request.md`
    frontmatter `code:` 에 `http-redirect.ts` · 세 에러 표에 «가드의 고장» 트리거"(owner: planner))
  - 상세: 이번 구현은 SSRF 가드가 판정(`SsrfBlockedError`)이 아닌 오류를 던졌을 때
    `http-request.handler.ts`/`database-query.handler.ts` 에서 `INTEGRATION_CALL_FAILED` 로,
    `database-connection-tester.ts` 에서 `DB_CONNECT_FAILED` 로 승격한다. target 문서의 현재
    텍스트는 이 신규 트리거를 명시하는 별도 표 행을 아직 갖고 있지 않다 — 다만 `0-common.md` §4.2 는
    `INTEGRATION_CALL_FAILED` 를 이미 "기타 일반 예외(분류되지 않은 실패) … `IntegrationError` 가
    아닌 throw 의 기본 코드" 로 정의해 두고 있어, 이번 신규 트리거는 그 기존 정의의 **인스턴스**이지
    새 계약은 아니다. `DB_CONNECT_FAILED` 쪽도 `spec/2-navigation/4-integration.md` §5.5/§7 이
    "연결 테스트에서 인증 외 실패(네트워크·타임아웃·TLS 등)" 의 catch-all 로 이미 문서화해 뒀다 —
    범위 밖(`spec/2-navigation/`)이라 이번 diff 대상은 아니지만 기존 정의와 충돌 없음을 확인.
    즉 target 문서를 당장 갱신하지 않아도 spec 계약 위반은 아니며, 표에 트리거를 한 줄 추가하는
    것은 명확성 개선(WARNING 아님) 수준이다. 이 항목은 이미 developer 자신이 같은 커밋 세트에서
    tracker 에 owner: planner 로 등재해 뒀다(`RESOLUTION.md` 10_38_57 "등재는 이 턴에").
  - 제안: 별도 조치 불요 — 다음 planner 턴이 트래커 항목을 소비하면 됨. (누락이 아니라 이미 추적됨을
    확인하는 차원의 기록.)

- **[INFO]** 자식 plan(`ssrf-catch-instanceof.md`) 체크리스트 잔여 3건 — target 과는 무관, 이 리뷰가
  그 게이트 중 하나
  - target 위치: 해당 없음 (plan 문서 자체)
  - 관련 plan: `plan/in-progress/ssrf-catch-instanceof.md` 체크리스트 — `[ ] /ai-review 수렴`,
    `[ ] --impl-done`, `[ ] 트래커 해소 · 이 plan plan/complete/ 로`
  - 상세: `/ai-review` 는 3라운드 "수렴 예외"로 이미 종결됐고(`review/code/2026/09/20/10_38_57/RESOLUTION.md`),
    그 라운드는 남은 Warning 둘(W1·W2)을 등재로 갈음하며 "이 마무리 커밋이 체크리스트 셋 + `plan/complete/`
    이동을 해소한다" 고 적었다. 현재 워크트리에는 그 마무리 커밋이 아직 없고(plan 파일은
    `plan/in-progress/`에 그대로, 체크박스 3개 미해소), 반면 트래커(`spec-draft-nullable-notation-followups.md`)
    는 이미 이 항목을 `[x]` 로 표시하며 `plan/complete/ssrf-catch-instanceof.md` 경로를 선(先)-참조한다.
    이 자체는 target spec 과의 충돌이 아니라 plan 라이프사이클 진행 중 상태이며, 이번 `--impl-done`
    통과가 그 마무리 커밋의 전제 조건으로 보인다.
  - 제안: 이 리뷰(현재 실행 중인 `--impl-done`)가 BLOCK: NO 로 수렴하면, 마무리 커밋에서 체크리스트
    3건을 체크하고 plan 을 `plan/complete/` 로 이동 + 트래커 참조 경로 정합성 재확인.

## 요약

target(`spec/4-nodes/4-integration/`)은 이 브랜치에서 변경되지 않았고, 구현(SSRF 가드 catch 를
`instanceof SsrfBlockedError` 로 가르는 것)은 target 이 이미 선언한 기존 계약(`0-common.md` §4.2
`INTEGRATION_CALL_FAILED`, `2-navigation/4-integration.md` 의 연결 테스트 catch-all 코드들)과 충돌하지
않는다. `plan/in-progress/` 에서 "결정 필요" 로 남겨진 항목을 이 변경이 우회하거나 일방적으로 정한
사례는 발견되지 않았고, 이 변경이 만든 문서 갭(에러 코드 표에 새 트리거 한 줄 미기재)은 developer 가
같은 턴에 이미 `spec-draft-nullable-notation-followups.md` 에 owner: planner 로 등재해 둔 상태라
누락이 아니다. 다만 자식 plan 의 체크리스트(ai-review 수렴/`--impl-done`/`plan/complete/` 이동)는
아직 열려 있어, 이번 `--impl-done` 통과 이후 마무리 커밋에서 정리돼야 한다.

## 위험도
NONE
