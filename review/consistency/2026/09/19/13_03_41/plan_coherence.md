# Plan 정합성 검토 — `plan/in-progress/spec-draft-integration-connection-tests.md`

## 발견사항

- **[WARNING]** 같은 endpoint/DTO 를 겨누는 다른 in-progress plan 의 미해결 후속과 교차 참조 없음
  - target 위치: `plan/in-progress/spec-draft-integration-connection-tests.md` 전체(특히 `## 체크리스트` 3번째 항목
    "구현 — `--impl-prep` · 테스터 둘 · 테스트 · 가이드 한 줄 (developer, 같은 PR)")와 `## 비대상` 절 — 어느 쪽에도
    아래 관련 plan 에 대한 포인터가 없다.
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:3403`
    "`/api/integrations/:id/test` 의 MCP 전용 응답 필드 3종이 미선언 + 계약 검증자 미배선" (owner: developer 트랙,
    미해결 `- [ ]`, 2026-09-13 등재).
  - 상세: target 은 `IntegrationsService.dispatchTest`(`integrations.service.ts`)와 그 응답 shape
    (`IntegrationTestResult`/`TestConnectionResultDto`, `4-integration.md §9.1/§14.1`)에 새 `code` 값 다섯
    (`DB_AUTH_FAILED` 등)을 추가하는 구현을 "같은 PR" 로 예정하고 있다. 그런데 같은 파일·같은 반환 shape 을
    이미 다른 in-progress plan 이 겨누고 있다 — `spec-draft-nullable-notation-followups.md` 는 그 DTO 가
    `service_type='mcp'` 전용 필드(`capabilities`·`serverInfo`·`preview`) 셋을 여전히 미선언 상태로 두고 있고
    `assertMatchesContract` 배선도 이 endpoint 에는 아직 없다고 기록해 뒀다("함께 할 일: 이 엔드포인트에
    `assertMatchesContract` 배선"). 이 저장소는 같은 클래스의 상황(같은 절/파일을 겨누는 복수 plan 이 서로를
    모르는 것)을 이미 한 번 `plan_coherence` WARNING 으로 잡아 "한 턴에 묶어라" 로 처리한 선례가 있다(같은
    파일 §"`3-error-handling.md §1` 카탈로그가 통합·LLM 코드 계열을 통째로 누락한다" 항목, line 3234~3247 —
    "같은 절을 겨냥하는 plan 이 셋이다 — 한 턴에 묶어라"). target 이 이 사실을 모른 채 developer 턴에 진입하면
    (a) 같은 함수를 두 번 따로 열어 재발견 비용이 들거나, (b) 이번 PR 이 `dispatchTest` 반환 shape 을 건드리는
    자연스러운 기회인데도 인접 계약 미배선을 놓치고 지나갈 수 있다.
  - 제안: target 의 `## 비대상` 절 또는 `## Rationale` 에 `spec-draft-nullable-notation-followups.md:3403`
    포인터 한 줄을 추가해 둘 것. 두 항목을 반드시 한 PR 로 합치라는 뜻은 아니다(대상 필드가 다르다 — 이쪽은
    `code` 값 확장, 저쪽은 MCP 전용 필드 3종 선언 + 계약 검증자 배선) — 다만 developer 턴이 같은 서비스
    파일·같은 endpoint 를 만질 것을 알고 시작하도록 조율 메모를 남기는 편이 저장소가 이미 겪은 "따로
    처리하면 구조가 여러 번 갈린다" 패턴을 반복하지 않는다.

## 조사했으나 문제 없음으로 판정한 항목 (참고)

- `entity-column-declaration-drift` 의 BLOCK 근거(§5.4 소문자 코드)는 target 이 정확히 겨냥해 해소한다 —
  새 결정을 일방적으로 얹는 것이 아니라 그 CRITICAL 을 정정하는 방향이라 충돌 없음.
- `spec/conventions/error-codes.md` 의 진행 중 병기(`ErrorCode`/`EngineErrorCode`, `spec-conventions-engine-error-code-surface.md`)와
  `spec/5-system/3-error-handling.md §1.4` 카탈로그 재편(`spec-draft-nullable-notation-followups.md` ·
  `spec-update-node-cancellation-shutdown-classification.md` · `keyset-cursor-uuid-validation.md`)은 모두
  **노드 런타임/엔진 레벨** 에러 코드 표를 대상으로 한다. target 이 추가하는 다섯 코드는 기존 `EMAIL_CONNECT_FAILED`
  선례와 동일하게 **연결 테스트 전용 namespace**(`IntegrationTestResult.code`)이고 그 표들에 등재된 적이
  없다(`EMAIL_CONNECT_FAILED` 도 §1.4 에 없음, 실측 확인) — target 이 `3-error-handling.md`/`error-codes.md` 를
  건드리지 않는 것은 기존 패턴과 정합하며 위 진행 중 plan 들과 충돌하지 않는다.
- `4-integration.md` 는 오늘(2026-09-19) `spec-draft-nullable-notation-followups.md` 의 §11.2(만료 알림
  유일 키) 항목으로 이미 한 차례 편집됐다(커밋 `cef3687f2`, 이 worktree 브랜치에 반영됨). target 이 인용하는
  줄 번호(§3.3 236행 · §5.3 476행 · §5.4 490행 · §5.1/§5.2/§5.7 429·449·560행 · §9.2 810행 · §14.1
  1084행~ · `## Rationale` 1129행)는 현재 파일 상태와 실측 대조해 전부 일치한다 — §11.2(993행)는 이 모든
  절보다 뒤에 있어 앞쪽 절의 줄 번호에 영향이 없었다. staleness 없음.
- `node-output-redesign/database-query.md` · `node-output-redesign/http-request.md` 의 잔여 체크박스(SQL
  literal 안전성, `configEcho` spread 전환, legacy `output.response.error` 제거 등)는 모두 **런타임 실행
  경로**(handler 의 `execute()`)를 대상으로 하며 target 이 다루는 **연결 테스트 경로**(`dispatchTest`)와
  코드 경로가 분리돼 있다 — 겹치는 전제·충돌 없음. target 이 인용하는 SSL 매핑·SSRF 가드 재사용 서술도 이
  두 문서의 분석 내용과 정합한다.
- Google · GitHub · Webhook 통합을 새로 소비하는 노드/기능을 계획 중인 다른 in-progress plan 은 없다
  (`ai-agent-tool-connection-rewrite.md`·`marketplace-and-plugin-sdk.md` Phase C 포함 전수 확인) — "그 통합을
  쓰는 노드가 아직 없다" 는 target 의 전제와 충돌하는 계획 없음.
- rotate 400/422 불일치·SMTP SSRF CGNAT 누락·`http` 서비스 레지스트리 필드 갭·Google 자동 갱신 미구현 등
  target 이 "비대상 — 트래커에 올린다" 로 미룬 여섯 항목은 다른 어떤 in-progress plan 에도 아직 등재돼
  있지 않다(전수 grep 0건) — 중복 등재나 상충하는 처분 없음.

## 요약

target 문서는 이미 BLOCK 을 낸 CRITICAL(§5.4 소문자 코드)을 정확히 겨냥해 정정하며, 다른 진행 중 plan 이
"결정 필요" 로 남겨둔 항목을 우회하거나 충돌하는 결정을 내리지 않는다. 다섯 신규 에러 코드의 namespace
분리(연결 테스트 전용 vs 노드 런타임)도 기존 `EMAIL_CONNECT_FAILED` 선례·현재 진행 중인 카탈로그 재편 plan
들과 정합한다. 유일한 실질적 gap 은 target 의 developer 구현 단계가 같은 endpoint(`/api/integrations/:id/test`)와
같은 서비스 파일을 만지는데, `spec-draft-nullable-notation-followups.md` 가 그 자리에 이미 등재해 둔 미해결
DTO 계약 완결성 항목을 인지·교차 참조하지 않고 있다는 것이다 — 기능적으로 막는 충돌은 아니지만, 이 저장소가
반복적으로 겪어 정식화한 "같은 절/파일을 겨냥하는 plan 은 한 턴에 묶어라" 패턴에 해당해 조율 메모를 남길
가치가 있다.

## 위험도

LOW
