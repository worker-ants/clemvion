# 신규 식별자 충돌 검토 — spec/5-system/ (impl-done)

## 조사 방법

`origin/main...HEAD` 의 `spec/5-system/**` 변경분과, 그것이 참조하는 연쇄 파일
(`spec/2-navigation/14-execution-history.md`, `spec/3-workflow-editor/4-ai-assistant.md`,
`spec/4-nodes/3-ai/1-ai-agent.md`, `spec/conventions/egress-masking.md`,
`spec/conventions/node-output.md`)의 diff 를 전문 확인했고, 대응 구현 diff
(`mask-sensitive-fields.util.ts`/`.spec.ts`, `handler-output.adapter.ts`,
`execution-context.service.ts`, `ai-turn-executor.ts`)도 절대경로 워크트리에서 직접 읽었다.
이번 변경은 **신규 엔티티·엔드포인트·이벤트·ENV·파일을 도입하지 않는다** — 노드 `config`
echo 마스킹을 저장 시점(`handler-output.adapter.ts` boundary)에서 egress(REST/WS) 시점으로
옮기고, 그에 맞춰 원칙 서술과 용어를 갱신하는 변경이다. 따라서 점검 관점 1~6 을 아래처럼
좁혀 적용했다.

## 점검 관점별 확인 결과

1. **요구사항 ID 충돌** — 신규 R-번호(`R-5`/`R-17` 등) 부여 없음. 기존 R-5(`spec/2-navigation/14-execution-history.md`)·R17(`spec/5-system/14-external-interaction-api.md`)의 **본문만 정정**됐다. 충돌 없음.
2. **엔티티/타입명 충돌** — `DEFAULT_SENSITIVE_KEYS` 가 `mask-sensitive-fields.util.ts` 에서 새로 `export` 됐지만 기존에 있던 모듈-내부 상수를 노출한 것뿐이고, 다른 영역에서 동명의 상수가 다른 의미로 쓰이는 사례는 없음(`git grep` 전수 확인). `redactStoredDataForResponse`/`maskWireEnvelope`/`deepRedactSecrets*` 는 모두 기존 구현 식별자를 그대로 인용 — 신규 도입 아님. 충돌 없음.
3. **API endpoint 충돌** — 신규 endpoint 없음. `GET /api/executions/:id` 등 기존 endpoint 참조만.
4. **이벤트/메시지명 충돌** — 신규 WS/webhook/queue 이벤트명 없음. `execution.retry_last_turn` 등 기존 이벤트만 재인용.
5. **환경변수·설정키 충돌** — 신규 ENV var 없음. `AI_RETRY_STATE_TTL_MINUTES` 등 기존 ENV 재인용뿐.
6. **파일 경로 충돌** — 신규 spec 파일 없음(전부 기존 파일의 본문 수정).

## 발견사항

- **[INFO]** 리네임된 용어("boundary masking parity" → "egress masking parity")의 잔존 인용 — 엄밀한 "충돌"은 아니나 인접 리스크로 기록
  - target 신규 식별자: `egress masking parity` (본 PR 이 `spec/2-navigation/14-execution-history.md:467,469`, `spec/5-system/14-external-interaction-api.md:1530`, `spec/5-system/6-websocket-protocol.md:196` 3곳에서 `boundary masking parity` → `egress masking parity` 로 일관 개명)
  - 기존 사용처: `codebase/backend/src/modules/websocket/websocket.service.ts:448` 의 JSDoc 이 여전히 `*"안전성은 롤 게이팅이 아니라 boundary masking parity 에 의존"*` 를 EIA §R17 의 직접 인용처럼 적어 두고 있다. 이 파일은 이번 diff 범위 밖(미변경)이다. `plan/complete/eia-fanout-and-internal-data-masking.md:89`, `plan/complete/eia-internal-rest-error-masking.md:48`, `plan/complete/spec-draft-eia-error-masking-catalog.md:77,124` 도 옛 문구를 담고 있으나 이들은 완료된 plan(역사 기록)이라 정정 대상이 아니다.
  - 상세: 두 문구가 같은 R-5/R17 원칙을 가리키는데 스펙 3곳은 개명됐고 코드 주석 1곳만 구용어로 남아, 향후 이 주석을 spec 의 "정확한 인용"으로 오인하면(예: grep 으로 `boundary masking parity` 를 찾아 R-5/R17 원문이라 믿는 경우) 두 텍스트가 실제로 같은 개념을 가리키는지 헷갈릴 수 있다. 기능적 충돌(다른 의미로 쓰이는 동일 식별자)은 아니고 **동일 개념의 신·구 표현 병존**에 가깝다.
  - 제안: `websocket.service.ts:448` 의 JSDoc 인용도 `egress masking parity` 로 동기화 — 단, 이 파일은 본 PR diff 밖이므로 별도 후속(작은) 커밋 또는 developer 자기-반증형 소정정 대상은 아니다(이건 spec 이 아니라 code 주석이므로 developer 가 즉시 고칠 수 있는 범위). plan_coherence/rationale_continuity 체커가 같은 항목을 이미 다루고 있다면 중복 조치 불필요.

## 요약

이번 target 변경은 신규 엔티티·엔드포인트·이벤트·ENV·spec 파일을 전혀 도입하지 않고, 기존 "config echo 마스킹을 저장 시점에서 egress 시점으로 옮긴다" 는 결정을 5-system 및 연쇄 참조 문서에 반영하는 용어 정정/서술 정정 성격의 PR이다. `DEFAULT_SENSITIVE_KEYS` export, `redactStoredDataForResponse`/`maskWireEnvelope`/`deepRedactSecrets*` 등 언급된 식별자는 모두 기존 구현과 1:1로 대응하며 다른 의미로 쓰이는 충돌 사례는 발견되지 않았다. 유일한 잔여 항목은 이번 diff 범위 밖의 `websocket.service.ts` 주석이 개명 전 용어("boundary masking parity")를 그대로 인용하고 있다는 점으로, 신규 식별자 충돌이라기보다 리네임 후속 동기화 누락에 가까워 INFO 로 기록한다.

## 위험도
NONE
