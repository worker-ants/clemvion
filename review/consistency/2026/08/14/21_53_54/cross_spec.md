STATUS=success cross_spec review complete — no CRITICAL/WARNING found (prior CRITICAL already resolved by commit 462455a52 immediately preceding this run)
===REPORT_MARKDOWN_BELOW===
# Cross-Spec 일관성 검토 — spec/5-system/ (impl-done, diff-base=origin/main)

## 점검 범위

이번 diff(`origin/main...HEAD`)가 실제로 건드린 spec 은 3개뿐이었다 (프롬프트 번들은 예산 초과로 `spec/5-system/14-external-interaction-api.md` 본문·실제 코드 diff 등 18개 파일이 생략되어 있어, 직접 `git diff origin/main...HEAD -- spec/` 및 절대경로 `Read`/`grep` 으로 재확인했다):

- `spec/5-system/6-websocket-protocol.md` (+18/-7) — `llmCalls` 외부 strip 결정의 범위 정정(WS fanout + EIA REST `getStatus()` 양쪽, 깊이 무관)
- `spec/5-system/14-external-interaction-api.md` (+125/-40) — `waiting_for_input` webhook 봉투 재구조화, `interaction` 블록 Planned 명시, `error.code`/`nodeId` null 허용, `getStatus` strip+redact 병행
- `spec/1-data-model.md` (+1/-1) — `Execution.error` 구조에 `nodeId`/`code` nullable + `details?` 추가

이 diff 직전 커밋(`462455a52`)이 이미 **`waitingNodeType` SoT 상충** CRITICAL 을 자체 발견·수정했음을 로그에서 확인했다 — EIA §6.2 가 `node.type → waitingNodeType` 을 "외부 소비 필드"로 잘못 선언해 WS §4.4 의 "WS 내부 부가 식별자" 선언과 정반대였던 것을, "외부 소비 매핑 없음 + `interactionType` 으로 분기" 로 정정. 현재 HEAD 기준으로 양쪽 문서를 재대조한 결과 이 항목은 해소되어 있다.

## 발견사항

없음 (CRITICAL/WARNING/INFO 모두 없음). 검토한 6개 관점 중 실측 결과:

1. **데이터 모델 충돌** — `Execution.error = { nodeId: uuid|null, code: string|null, message, details? }` (data-model.md). `spec/5-system/4-execution-engine.md`, `spec/5-system/3-error-handling.md`, `spec/data-flow/3-execution.md` grep 결과 이 필드를 다른 shape 으로 재선언하는 곳 없음. `details` 출처로 인용한 [`conventions/node-output.md §3.2`](spec/conventions/node-output.md) 앵커 실재 확인.
2. **API 계약 충돌** — EIA `waiting_for_input.interaction.*` 의 URL 을 절대 `/v1/...` 에서 상대 `/api/external/...` 로 정정한 것은 [`2-api-convention.md §1`](spec/5-system/2-api-convention.md) "버전 | URL 경로에 포함하지 않음" 규칙과 오히려 **일치**시킨 것(종전이 위반 상태였음). `interaction` 블록을 Planned 로 낮춘 것에 대해 `spec/7-channel-web-chat/**`(architecture/widget-app/sdk) 전수 grep — `submitUrl`/`streamUrl`/`statusUrl`/`cancelUrl`/`expectedCommands` 를 소비한다고 서술한 곳 없음 → 다른 표면이 이 필드에 의존하지 않아 하향 조정이 안전.
3. **요구사항 ID 충돌** — 신규 ID 부여 없음(diff 는 서술 정정 위주).
4. **상태 전이 충돌** — 상태 머신 변경 없음.
5. **권한·RBAC 모델 충돌** — 해당 없음.
6. **계층 책임 충돌** — `strip-external-only-fields.ts` 가 `6-websocket-protocol.md`·`14-external-interaction-api.md` 양쪽 `code:` frontmatter 에 동시 등재됐고, 두 문서의 서술("필드명 기준 깊이 무관", "WS fanout + EIA REST `getStatus()` 양쪽")이 동일 문구로 정합 — 오너십 분리가 아니라 "단일 공용 유틸" 로 의도적으로 수렴한 것이며 두 문서 서술이 어긋나지 않는다. EIA §6.5 의 `llmCalls` strip 언급도 WS §4.4 결정을 인용하는 형태로 단일 SoT 유지.

## 부가 확인 (모두 정합)

- `error.code === null` 허용(EIA §6.4) ↔ `spec/5-system/15-chat-channel.md` CCH-ERR-04 는 이미 "`error.code === null` 은 `executionFailedInternal` fallback" 을 정의해 두고 있어 — nullable 화가 **기존 소비자 계약을 깨지 않고 오히려 그 계약이 이미 상정한 케이스를 문서로 명문화**한 것.
- EIA 신규 앵커(`§R17`, `§6.4`, `§6.5`) 및 WS 참조 앵커(`§4.4.6`) 모두 실제 헤더로 해석됨(dangling anchor 없음).
- `spec/7-channel-web-chat/0-architecture.md` 의 SSE wire 필드 매핑 서술(`waitingNodeId`/`interactionType`/`nodeOutput.*`/`buttonConfig`/`conversationThread`, `waitingNodeType` 미언급)이 정정된 EIA §6.2 blockquote 와 정확히 일치.

## 요약

이번 diff 는 spec/5-system/ 내부 3개 문서(WS 프로토콜·EIA·data-model)에 걸친 **작은 정정 diff**로, 직전 커밋이 이미 CRITICAL(WaitingNodeType SoT 상충)을 발견·해소한 뒤의 상태다. 현재 HEAD 기준으로 데이터 모델(Execution.error nullable 필드)·API 계약(URL 버전 세그먼트 제거)·계층 책임(strip 유틸 공용화) 세 축을 관련 spec 전체(chat-channel, channel-web-chat, api-convention, node-output, error-handling, data-flow) 와 대조한 결과 새로운 모순은 발견되지 않았다. 오히려 이번 변경들은 기존에 이미 다른 문서(CCH-ERR-04, api-convention §1)가 상정해 둔 계약과 뒤늦게 정합을 맞추는 방향이다.

## 위험도
NONE
