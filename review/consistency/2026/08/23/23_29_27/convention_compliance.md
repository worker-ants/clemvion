# 정식 규약 준수 검토 — `spec/5-system/` (nodeOutput allowlist SSE 확대)

## 검토 범위

- diff: `spec/5-system/14-external-interaction-api.md`(§R17 `nodeOutput` allowlist 확대) ·
  `spec/5-system/6-websocket-protocol.md`(§4.4 wire caveat 1문단 추가)
- 대조 대상: `spec/conventions/node-output.md` · `spec/conventions/egress-masking.md` ·
  `spec/conventions/spec-impl-evidence.md` · `spec/conventions/interaction-type-registry.md`
- 코드 확인(절대경로, HEAD worktree): `codebase/backend/src/shared/utils/node-output-allowlist.ts` ·
  `codebase/backend/src/modules/websocket/websocket.service.ts` ·
  `codebase/backend/src/modules/external-interaction/interaction.service.ts`

## 발견사항

- **[WARNING]** `egress-masking.md` 의 파이프라인 순서 서술이 이번 변경으로 stale
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "`nodeOutput` 일반 키 allowlist" 절
    (SSE/fanout 확대 부분) + `spec/5-system/6-websocket-protocol.md` §4.4 wire caveat 추가 문단
  - 위반 규약: `spec/conventions/egress-masking.md` §2 "마스킹은 한 번 — 그 뒤 단계는 마커를 덮지 않는다"
  - 상세: `egress-masking.md` §2 는 `WebsocketService.toFanoutEnvelope` 의 호출 순서를 **"`maskWireEnvelope`(wire 단계) → `stripExternalOnlyFields` → `attachRoutingContext` 순"** 3단계로 명시하고, 자신을 "구현 좌표계 SoT"로 선언한다(§Overview "SoT 분리" 표). 그런데 이번 diff 로 실제 코드(`websocket.service.ts` `toFanoutEnvelope` JSDoc, 확인함)는 **"strip → nodeOutput allowlist → routing 첨부"**의 4단계이고, target 문서(§R17 새 절 + WS §4.4 새 caveat)는 이 새 `nodeOutput` allowlist 단계를 정책·범위 차원에서 정확히 기술한다. 하지만 `egress-masking.md` §2 의 순서 열거·§1 좌표계 표 어디에도 이 신규 단계가 반영되지 않았다 — §3 "이 문서는 기계가 지키지 않는다" 절에 최근(2026-08-23) 두 건의 표 갱신 실례(`assistant-mask-leak`, `masking-gate-consolidation`)가 기록돼 있지만 이번 nodeOutput allowlist 건은 빠져 있다. `egress-masking.md` 를 SoT 로 참조하는 다음 독자는 `toFanoutEnvelope` 의 실제 파이프라인을 3단계로 오인한다.
  - 제안: `egress-masking.md` §2 의 순서 문장에 `nodeOutput allowlist` 단계를 추가하거나(예: "`maskWireEnvelope` → `stripExternalOnlyFields` → `allowlistFanoutNodeOutput` → `attachRoutingContext`"), §3 "표를 갱신한 실례" 목록에 이번 건을 등재한다. target 문서 쪽에서 조치한다면 §R17 새 절 말미에 "egress-masking §2 파이프라인 순서 갱신 필요" caveat 를 남겨 다음 세션이 두 문서를 동기화하게 한다.

- **[INFO]** `NODE_OUTPUT_ALLOWED_KEYS` 3-갈래 목록이 spec·코드 JSDoc·배열 세 곳에 중복
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 새 표("갈래 | 키 | 무엇이 지키나")
  - 상세: 동일한 키 목록이 이미 `node-output-allowlist.ts` 코드 자체에도 (1) `NODE_OUTPUT_ALLOWED_KEYS` 배열과 (2) 그 배열을 설명하는 JSDoc 표 두 곳으로 존재하며, 코드 주석 스스로 "이 표는 아래 배열의 요약이 아니라 그 배열과 함께 갱신되어야 하는 미러다"라고 명시해 drift 위험을 인지하고 있다. 이번 diff 는 그 목록을 spec 문서에도 표로 재기재해 3중 동기화 지점을 만든다. 다만 이 미러링 자체는 이번 diff 이전(구 버전은 산문으로 2/3 그룹을 이미 미러링)부터 있던 기존 패턴을 표로 확장한 것뿐이라 새로 도입된 위험은 아니다.
  - 제안: (강제 아님) 새 키 추가 시 "배열 → JSDoc 표 → spec 표" 세 곳 동시 갱신이 필요함을 spec 표 옆에 한 줄로 명시하면, 이 저장소가 반복 경험한 "미러가 배열보다 낡는" 패턴을 사전 차단할 수 있다.

## 검증 완료 (위반 아님 — 참고용)

- `NODE_OUTPUT_ALLOWED_KEYS` 의 "핸들러 계약 공개분" 그룹(`config`·`output`·`meta`·`port`·`status`)은 `spec/conventions/node-output.md` Principle 0 의 5필드 정의와 정확히 일치. `_resumeState`/`_retryState` 제외도 Principle 0 의 "internal top-level 필드 허용 예외" 서술과 일치.
- chat-channel 4키(`payload`·`title`·`rendered`·`nodeType`)의 SoT 인용 `spec/5-system/15-chat-channel.md` §(c) "`renderPresentationByType` shape 처리 우선순위"는 실제로 존재(694~703행 확인).
- `waitingNodeType` vs `nodeOutput.nodeType` 구분 인용 §6.2 "외부 소비 매핑 없음" 문구는 실제 736~742행에 존재, 인용 정확.
- 내부 WS 는 신규 field-allowlist 대상이 아니라는 주장은 코드 순서(`maskWireEnvelope` → `broadcastToChannel`(내부 WS, allowlist 미적용) → `toFanoutEnvelope`(외부 fanout, allowlist 적용))와 일치. 기존 value-masking(내부 WS 도 적용됨, `execution.ai_message` 불릿)과 레이어가 다르다는 구분도 코드와 일치해 모순 없음.
- REST `getStatus` 도 동일 `allowlistNodeOutputKeys` 를 호출함(`interaction.service.ts:392`) — "REST 와 SSE 는 같은 강도" 주장이 코드로 뒷받침됨.
- `spec-impl-evidence.md` frontmatter 규약 관점에서 신규 `code:` 항목(`websocket.service.ts`)은 실존 경로. `status: partial` + `pending_plans` 유지도 문제없음.
- 문서 구조(Overview/본문/Rationale 3섹션) 관점에서 이번 변경은 기존 `## Rationale` 섹션 내부(§R17 하위)에 국한돼 구조 규약 위반 없음.
- 취소선(`~~...~~`) + "해소(날짜)" 패턴은 이 문서가 반복 사용해 온 기존 표기 관례와 일치.

## 요약

이번 diff(`spec/5-system/14-external-interaction-api.md` §R17, `6-websocket-protocol.md` §4.4)는 `spec/conventions/node-output.md` 의 필드 분류, `spec/5-system/15-chat-channel.md`/§6.2 의 기존 SoT 인용을 정확히 재사용하고, 코드(`node-output-allowlist.ts`·`websocket.service.ts`·`interaction.service.ts`)의 실제 동작과도 어긋남 없이 정합하다. 정식 규약 위반으로 볼 CRITICAL 은 발견되지 않았다. 다만 이 변경이 `toFanoutEnvelope` 파이프라인에 새 단계(`nodeOutput` allowlist)를 영구적으로 추가했음에도, 그 파이프라인의 "구현 좌표계 SoT"를 자처하는 `spec/conventions/egress-masking.md` §2 의 순서 서술이 갱신되지 않아 정식 규약 문서 자체가 target 이 서술하는 최신 파이프라인보다 뒤처졌다(WARNING 1건). 부수적으로 allowlist 키 목록이 코드·spec 양쪽에서 3중 미러링되는 기존 패턴이 이번에 표 형식으로 굳어진 점은 INFO 로 남긴다.

## 위험도

LOW
