# Cross-Spec 일관성 검토 — spec/5-system/ (masking-residuals, impl-done)

## 검토 범위와 방법

`git diff origin/main...HEAD` 로 실제 변경분을 확정했다(프롬프트 번들은 예산 초과로
`spec/5-system/**` 19개 파일 본문이 전부 생략돼 있어, 아래는 프롬프트 대신 워킹트리를
절대경로로 직접 `Read`/`grep` 한 결과다):

- `spec/5-system/14-external-interaction-api.md` (1줄: "boundary masking parity" → "egress masking parity")
- `spec/5-system/4-execution-engine.md` (신규 블록쿼트 + `_resumeCheckpoint`/`_retryState` 관련 3곳 정정)
- `spec/5-system/6-websocket-protocol.md` (1줄: 동일 용어 정정)
- `spec/conventions/egress-masking.md`, `spec/conventions/node-output.md` (Principle 0/7 정정 + 신규 각주)
- `spec/2-navigation/14-execution-history.md` R-5 (정정 블록 확장), `spec/3-workflow-editor/4-ai-assistant.md`, `spec/4-nodes/3-ai/1-ai-agent.md` (동일 용어 정정 3곳)

핵심 변경 내용: 노드 `config` echo 마스킹을 **저장 시점(엔진 boundary, `handler-output.adapter.ts`
의 `maskSensitiveFields`)에서 egress 전용(REST `redactStoredDataForResponse` / WS
`maskWireEnvelope`, 둘 다 `deepRedactSecrets*` 공유)으로 이전** — 표현식(`$node["X"].config.<field>`)
이 마스킹된 리터럴이 아니라 원문을 읽게 하기 위함.

## 발견사항

- **[WARNING]** R-5 W2 서술("HTTP Request·Send Email")이 그 두 노드 타입의 config 모델과 어긋남
  - target 위치: `spec/5-system/4-execution-engine.md` §Engine Raw Config Exposure 신규
    블록쿼트("표현식도 원문을 읽는다... [실행 내역 R-5 정정]") — 이 블록쿼트가 근거로 지목하는
    `spec/2-navigation/14-execution-history.md` R-5 정정의 W2 문단("자격증명을 노드 `config` 에
    평문으로 담는 노드 타입(HTTP Request · Send Email 등)에서만 문제가 되므로, 근본 처방은 AI
    Agent 의 `llmConfigId` 처럼 자격증명 참조를 간접화하는 것")
  - 충돌 대상: `spec/4-nodes/4-integration/0-common.md` §6 표("`config`: 사용자 입력 raw echo
    (Principle 7)... **자격증명은 echo 금지** — `integrationId` 만 echo"), `spec/4-nodes/4-integration/3-send-email.md`
    §1/§4.2 표("`config.integrationId` ... 자격증명 자체는 echo 되지 않음"), `spec/4-nodes/4-integration/1-http-request.md`
    §4 step 2("Config echo 빌드... url 만 sanitizeUrlCredentials 결과로 교체" — `integrationId` 참조 방식)
  - 상세: R-5(및 그걸 인용하는 5-system/4-execution-engine.md 블록쿼트)는 "HTTP Request·Send
    Email 이 config 에 자격증명을 문자열 그대로 담는 노드 타입"이라 전제하고, 처방으로
    "AI Agent 의 `llmConfigId` 처럼 자격증명 참조를 간접화"를 제시한다. 그러나 이 두 노드는
    자기 자신의 spec(0-common.md Principle 7, http-request.md §4, send-email.md §1/§4.2)에서
    이미 **`integrationId` 참조 간접화를 쓰고 있고 credential echo 를 명시적으로 금지**한다 —
    특히 Send Email 은 `integrationId` 필수의 SMTP Integration 참조 외에 config 에 자격증명이
    들어갈 경로 자체가 없다(수동 SMTP 자격증명 입력 필드가 존재하지 않는다). HTTP Request 에서
    문자열 그대로의 자격증명이 config 에 남는 유일한 경로는 `authentication='custom'` 서브모드의
    수동 `headers` 항목(예: 사용자가 직접 입력한 `Authorization: Bearer <token>`)뿐인데, 이는
    노드 타입 전체가 아니라 하나의 인증 서브모드에 국한된 좁은 예외다. 이 서술은 `review/code/2026/08/27/10_53_52/security.md`
    의 W2 권고 문구를 그대로 옮긴 것으로 보이는데(같은 표현), 원 리뷰도 같은 imprecision을
    갖고 있어 target 이 상위 스펙(0-common/http-request/send-email)과 대조 검증 없이 그대로
    받아썼다. 결과적으로 "이 두 노드 타입에 간접화 처방이 필요하다"는 결론이 두 노드의 기존
    spec 이 이미 규정한 사실(간접화가 이미 구현돼 있음)과 어긋난다 — 향후 이 rationale 을 읽고
    "HTTP Request/Send Email 에 llmConfigId 패턴을 신규 도입해야 한다"고 오판할 위험이 있다.
  - 제안: R-5 W2 문단(및 5-system/4-execution-engine.md 가 이를 인용하는 문장)을 정정해
    실제 위험 표면을 좁혀 적는다 — 예: "HTTP Request 의 `authentication='custom'` 서브모드에서
    사용자가 직접 입력한 헤더 값" 정도로 한정하거나, Send Email 을 예시에서 제거한다. 또는
    "credential 참조 간접화"가 이미 `integrationId` 로 존재함을 언급하고, 남는 위험은
    "Integration 자격증명이 런타임에 헤더/바디로 주입된 *이후*, 같은 워크스페이스의 다른 노드가
    그 결과값을 표현식으로 재사용해 제3자에게 전달하는 경로"(즉 config 가 아니라 `output`/runtime
    injected 값의 relay)임을 정확히 구분해 적는다.

- **[INFO]** 코드 주석이 정정 전 용어("boundary masking parity")를 그대로 인용
  - target 위치: (spec 아님, 코드) `codebase/backend/src/modules/websocket/websocket.service.ts:448`
    — `maskWireEnvelope` 의 JSDoc 이 "EIA §R17 이 같은 인구를 근거로 *"안전성은 롤 게이팅이
    아니라 **boundary masking parity** 에 의존"* 이라며..." 라고 인용
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` (target, 이번 diff 로 "boundary
    masking parity" → "egress masking parity" 로 정정됨), `spec/5-system/6-websocket-protocol.md` (동일 정정)
  - 상세: spec 쪽 용어는 이번 PR 에서 "boundary masking parity" → "egress masking parity" 로
    전수 스윕됐음을 확인했다(spec/** 전체 grep 결과 잔존 0건). 그런데 그 근거로 코드 주석이
    인용하던 정확히 그 옛 문구가 코드에는 그대로 남아, 코드→spec 역참조 시 이제는 존재하지
    않는 phrase 를 찾게 된다. spec-vs-spec 충돌은 아니지만(spec/** 안에서는 완전히 일관됨),
    이번 rename 결정의 sync 누락 지점이라 기록한다.
  - 제안: `websocket.service.ts:448` 의 JSDoc 인용구를 "egress masking parity" 로 함께 갱신
    (기능 동작 변경 없음, 문서 동기화만).

## 요약

이번 diff(`spec/5-system/{14-external-interaction-api,4-execution-engine,6-websocket-protocol}.md`
+ 관련 conventions/노드 스펙)는 "config 마스킹을 저장 시점에서 egress 전용으로 이전"한다는
단일 결정을 문서화하며, 그 결정에 쓰인 핵심 용어 rename("boundary masking parity" →
"egress masking parity")과 메커니즘 서술(`maskSensitiveFields` boundary 제거 →
`deepRedactSecrets*` 로 통합)은 관련된 8개 spec 파일 전역에 걸쳐 grep 기준 잔존 모순 없이
일관되게 반영되어 있다 — CRITICAL 급 데이터 모델·API 계약·상태 전이·RBAC 충돌은 발견되지
않았다. 다만 이 결정의 부수 rationale(R-5 W2, 크로스-노드 자격증명 릴레이 우려)이 예시로
든 "HTTP Request·Send Email" 노드 타입은, 그 노드들 자신의 기존 spec(Integration 공통
규약·개별 노드 문서)이 이미 규정한 credential-echo-금지 + `integrationId` 간접화 모델과
어긋나는 부정확한 전제를 담고 있어 WARNING 으로 남긴다. 코드 주석 한 곳의 용어 미동기화는
INFO 로 별도 기록.

## 위험도

LOW
