# Plan 정합성 검토 — spec/5-system/ (impl-prep)

대상 plan: `plan/in-progress/trigger-uuid-and-guide-error-codes.md`
(`rotateBotToken` ParseUUIDPipe 부재 + 유저 가이드 오귀속 두 종)

## 발견사항

- **[INFO]** §C 트래커 등재 약속이 아직 미이행 (진행 상태 확인용, 결함 아님)
  - target 위치: `trigger-uuid-and-guide-error-codes.md` §C "이번 배치에서 하지 않는 것 —
    등재만 한다" (`LLM_AUTH_ERROR`·`LLM_MODEL_NOT_FOUND`·`INTEGRATION_ERROR`·
    `NODE_EXECUTION_FAILED`·`MAKESHOP_API_ERROR` 5종 + KO 라벨 부재 축)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` — 해당 5종/축은
    현재 트래커에 grep 0건(미등재 실측 완료)
  - 상세: 계획서가 "두 항목 모두 spec-draft-nullable-notation-followups.md 에 등재한다"고
    명시했고 체크리스트에도 `C: 트래커 2건 등재`가 별도 항목으로 있다. impl-prep 시점이라
    아직 미체크인 것 자체는 정상이나, 이 등재가 실제로 이뤄지지 않으면 "실재 코드를 먼저
    정해야 하는 미해결 결정"(§C 본문이 스스로 인정)이 어디에도 기록되지 않은 채 사라진다.
    같은 트래커의 §1.10 Rationale(`AUTH_CONFIG_NOT_FOUND` 404 전환 판단)이 이미 "별
    결정이며 트래커에 등재돼 있다"는 형태로 살아 있는 선례이므로, 같은 패턴을 따르는 것이
    맞다.
  - 제안: 이 plan 종료 전 체크리스트의 `C: 트래커 2건 등재`를 실제로 수행했는지 확인.
    등재 시 "실재 코드 확정 전까지는 이름만 바꾸지 않는다"는 현재 plan 의 판단 근거를
    함께 옮겨 다음 세션이 같은 실측을 반복하지 않게 할 것.

- **[INFO]** 확인 완료 — TRIGGER_NOT_FOUND → RESOURCE_NOT_FOUND 정정은 기존 spec 과 충돌 없음
  - target 위치: `trigger-uuid-and-guide-error-codes.md` §B "축 2" 및 "그래서 이 클래스는
    …여섯 곳이다"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:3110-3122`
    (동일 항목의 원 등재)
  - 상세: 실측으로 대조 — `spec/data-flow/10-triggers.md:74`(`Hk-->>Ext: 404
    TRIGGER_NOT_FOUND`)와 `codebase/backend/src/modules/hooks/hooks.service.ts:120`은
    webhook 인입 경로로 이미 정확히 귀속돼 있고, `spec/2-navigation/2-trigger-list.md:246`은
    트리거 REST 삭제 404 를 `RESOURCE_NOT_FOUND` 로 이미 정확히 쓰고 있다. 즉 plan 이
    고치려는 대상(`content/docs/**/*.mdx` 유저 가이드 4곳 + `backend-labels.ts`/
    `backend-labels.test.ts` 주석 2곳)은 spec 이 이미 올바르게 서술한 사실을 **유저 가이드·
    코드 주석만** 따라가지 못하고 있던 자리다. spec 자체를 고치는 것이 아니므로 developer
    쓰기 권한 경계(`spec/` read-only)와도 부딪히지 않는다.
  - 제안: 없음 (참고용 확인 기록).

- **[INFO]** 확인 완료 — `ParseUUIDPipe` 추가(item A)는 spec 문서 갱신을 요구하지 않음
  - target 위치: `trigger-uuid-and-guide-error-codes.md` §A "처분"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:3118-3122`
  - 상세: `triggers.controller.ts`는 `spec/5-system/15-chat-channel.md`와
    `spec/2-navigation/2-trigger-list.md` 양쪽 frontmatter `code:`에 걸려 있어 이 파일의
    동작 변경(비-UUID `:id` → 500 대신 400 `VALIDATION_ERROR`)이 spec-linked 변경인지
    확인했다. 그러나 저장소 관행상 `ParseUUIDPipe` 기본 실패(제네릭 `VALIDATION_ERROR`,
    3-error-handling.md §1.3 기본값)는 이미 135/136 곳에 적용돼 있는데도 각 도메인 spec
    (예: `2-trigger-list.md §3`, `15-chat-channel.md §5.4`)에 엔드포인트별 "malformed id
    → 400" 행을 개별 등재하지 않는 것이 기존 패턴이다(§5.4 표에 `X-Workspace-Id` **헤더**
    형식 오류만 별도 행으로 있는 것은 동일 컨텍스트에 다른 400 사유
    `WORKSPACE_ID_REQUIRED`와 구분해야 했기 때문이지, `:id` 경로 파라미터의 기본
    `ParseUUIDPipe` 실패를 위한 것이 아니다 — 실측: 동일 §5.4 표에 그런 행 없음). 따라서
    plan 이 §5.4/§3 표를 갱신하지 않는 것은 누락이 아니라 기존 문서화 관행과 일치한다.
  - 제안: 없음 (참고용 확인 기록).

- 교차 plan 충돌 없음 — `triggers.controller.ts` · `rotateBotToken` · `ParseUUIDPipe` ·
  `MCP_ALLOW_INSECURE_URL` · `backend-labels.ts` · `mcp-servers*.mdx` · `telegram*.mdx` ·
  `02-nodes/triggers*.mdx` 를 다른 in-progress plan(`auth-guard-reflection-hardening.md`,
  `spec-sync-auth-gaps.md`, `spec-sync-external-interaction-api-gaps.md`)에서도 grep 했으나
  전부 이미 종결된 별개 사안(워크스페이스 `:id` UUID 강도 비대칭 — 2026-08-09 완료, 트리거
  회전 감사 로깅 — 완료, `execute` 여분 키 거부 여부 — 2026-08-23 결정 완료)이거나 무관한
  1회 언급이다. 현재 활성 미해결 결정과 겹치는 자리 없음.

## 요약

`trigger-uuid-and-guide-error-codes.md`는 자신의 출처 트래커
(`spec-draft-nullable-notation-followups.md` 3110~3122행)가 요구한 선실측(비-UUID 입력의
실제 응답 코드, 오귀속 전수 스캔)을 정확히 수행했고, 그 결과(RESOURCE_NOT_FOUND 가 옳고
TRIGGER_NOT_FOUND 는 webhook 전용이라는 판정)는 현재 spec(`data-flow/10-triggers.md`,
`2-navigation/2-trigger-list.md`)의 기존 서술과 정확히 일치해 새로운 결정을 만들지 않는다.
§C 로 미룬 5개 에러 코드·KO 라벨 부재 축은 "실재 코드가 먼저 정해져야 하는 별개 결정"으로
명시적으로 등재만 하겠다고 밝혀 미해결 결정을 우회하지 않는다. 다른 in-progress plan과의
파일·엔드포인트 중복이나 선행조건 미해소도 발견되지 않았다. 유일한 관찰 사항은 §C 의
트래커 등재가 이 세션 종료 전에 실제로 이행되는지 확인이 필요하다는 것뿐이다.

## 위험도

LOW
