# Cross-Spec 일관성 검토 — `spec-draft-eia-context-schema-absence-convention`

검토 대상: `plan/in-progress/spec-draft-eia-context-schema-absence-convention.md` (spec draft, --spec 모드)
관련 spec: `spec/conventions/swagger.md` · `spec/5-system/2-api-convention.md` · `spec/5-system/14-external-interaction-api.md` · `spec/conventions/conversation-thread.md` · `spec/conventions/node-output.md` · `spec/conventions/execution-context.md`

## 검토 방법

target 이 인용하는 모든 spec 본문을 실제 저장소 파일에서 직접 읽고(`swagger.md` §1-4/§5-2, `api-convention.md` §5.1-§5.3/§8.2, `14-external-interaction-api.md` §5.3/§6.2/§R17, `conversation-thread.md` §2/§8.4, `execution-context.md` 원칙3), target 이 인용/paraphrase 한 문장이 실제 원문과 어긋나지 않는지, 그리고 target 이 새로 도입하는 규칙이 같은 문서군의 다른 곳(특히 target 이 직접 손대지 않는 부분)과 모순을 만드는지 확인했다. 코드(`interaction.service.ts` L280-324)도 대조해 "배경 — 코드 실증" 절의 사실 관계를 재확인했다 — 정확했다(`buttons && buttonConfig` → `buttonConfig{buttons,nodeOutput}`, 그 외 truthy `interactionType` → `nodeOutput` 그대로, 3-way 포함 `null` 정확).

## 발견사항

### [WARNING] EIA §5.3 예시 JSON 이 target 의 신설 스키마(closed union)와 이미 모순 — Gap 3 이 이를 고치지 않음

- **target 위치**: 갭 1 (property-level `oneOf` 스키마화) + 갭 3 "cross-ref (경미)" 체크리스트 항목 (`EIA §5.3/§R17 cross-ref`)
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` §5.3 (L444-471) 의 `getStatus` 응답 예시 JSON
- **상세**:
  target 의 "배경 — 코드 실증" 표와 §R17(L1104-1178, 특히 L1113-1115)은 `getStatus.context` 를 **2-variant 닫힌 union** 으로 정확히 기술한다 — `{interactionType, waitingNodeId, conversationThread?, buttonConfig:{buttons,nodeOutput}}` 또는 `{interactionType, waitingNodeId, conversationThread?, nodeOutput}`. 코드(`interaction.service.ts:296-322`)로 재확인해도 정확하다.
  그런데 같은 문서 §5.3 의 예시 JSON 블록(L459-465)은 여전히
  ```
  "context": {
    "formConfig":         { ... },
    "buttonConfig":       { ... },
    "conversationConfig": { ... },
    "conversationThread": { ... }
  } | null,
  ```
  형태로, (a) `interactionType`/`waitingNodeId` 가 `context` 내부에 없고, (b) `formConfig`/`buttonConfig`/`conversationConfig` 가 마치 셋 다 후보 키인 것처럼 보이며(실제로는 `nodeOutput` 하나로 통합돼 그 **안에** `formConfig`/`conversationConfig` 가 들어간다), (c) `"seq": 42`(L468)가 바로 위 "구현 상태" 콜아웃이 명시하는 "seq 는 항상 `0` placeholder"(L429, R17 L1121)와도 모순이다. 이 illustrative 블록은 실제로는 §6.2 outbound **notification** payload 형태를 그대로 복제한 것으로 보이며(§6.2 L564-568과 동일 구조), §6.2 의 자체 각주(L575-583)가 "SSE/REST 실제 wire 는 이 notification 형태와 다르다"고 이미 경고하는 바로 그 stale 패턴이 §5.3 에도 남아 있다.
  target 의 갭 1 은 이 code-accurate 2-variant 구조를 Swagger `oneOf` 로 formalize 하는 작업이고, 갭 3 은 §5.3/§R17 에 "링크만 추가"하는 경미한 작업으로 분류돼 있다. 하지만 갭 1 이 반영되면 같은 endpoint 에 대해 **Swagger 스키마(정확)** 와 **§5.3 인라인 예시(부정확)** 가 같은 문서군 안에서 서로 다른 shape 을 주장하게 된다 — API 계약 문서로서 자기모순이며, 향후 이 DTO 를 구현/수정하는 개발자가 §5.3 예시를 참조해 잘못된(§6.2 notification 형) shape 을 만들 위험이 있다.
- **제안**: 갭 3 체크리스트를 "cross-ref" 에서 "cross-ref + §5.3 예시 JSON 정정"으로 확장한다. §5.3 의 `context` 예시를 R17/코드가 기술하는 실제 2-variant 구조(`interactionType`/`waitingNodeId`/`conversationThread?` + `buttonConfig{buttons,nodeOutput}` 또는 `nodeOutput`)로 교체하고, 겸사겸사 `"seq": 42` 를 `0`(placeholder) 로 정정하는 것을 같은 PR 범위에 포함할 것을 권장한다. (§6.2 의 notification payload 예시는 그대로 두어도 무방 — 그건 실제로 다른 wire 다.)

### [WARNING] 신설 `api-convention §5.4` 에 Gap 1 과 동형의 "소급 적용 아님" 캐리브가 없음 — 기존 다수 `키 생략` 필드와의 관계가 불명확

- **target 위치**: 갭 2 개정안 — `spec/5-system/2-api-convention.md §5.4 "부재 표현"` 신설 텍스트 (특히 "기본은 `null` 이다. 키 생략은 위 (a)/(b) 중 하나에 해당할 때만 쓰고, **해당 필드를 문서화하는 절에 사유를 명시한다**" 문장)
- **충돌 대상**: 프로젝트 전역에 이미 존재하는 다수의 "키 생략/omit" 패턴 문서 — 예: `spec/5-system/11-mcp-client.md:356` (`mcpDiagnostics` 미시도 시 키 omit), `spec/2-navigation/4-integration.md:1549` (enum 밖 `status` omit), `spec/2-navigation/4-integration.md:853` (`requiresCafe24Approval` 는 cafe24 외 provider 는 omit), `spec/conventions/chat-channel-adapter.md:379-395` (`details.statusCode` omit) 등
- **상세**: target 은 갭 1(swagger §1-4 개정)에는 "적용 범위 (신규 변경 한정): 기존 `additionalProperties: true` 필드를 일괄 소급 스키마화하지 않는다" 는 명시적 non-retroactive 캐리브를 둔다. 반면 갭 2(api-convention §5.4)에는 이런 캐리브가 없다 — "기본은 null, 예외는 (a)/(b) 사유 명시 의무"라는 문장은 신규/기존 구분 없이 general MUST 로 읽힌다. api-convention.md 는 cross-cutting SoT 라 이미 여러 영역 spec 이 사유 문구 없이 "omit" 을 채택해 뒀는데(위 예시들), 이들이 §5.4 기준 (b) "선택적 부가 컨텍스트라 소비자가 부재를 정상 경로로 다룰 때" 에 실질적으로 부합하더라도, 명시적 문구("해당 필드를 문서화하는 절에 사유를 명시")를 갖추지 않았다는 점에서 §5.4 신설 직후 기술적으로 "미준수"로 보일 수 있다.
- **제안**: 갭 1 과 동형으로 "본 규칙은 신규로 도입/변경되는 필드에 적용하며, 기존에 문서화된 키 생략 필드(예: `mcpDiagnostics`, cafe24 `status`/`requiresCafe24Approval`, chat-channel-adapter `statusCode`)는 이미 (b) 를 만족하는 것으로 간주해 소급 정정을 요구하지 않는다" 는 한 문장을 §5.4 본문에 추가할 것을 권장한다. 이는 향후 `/consistency-check`·`spec-coverage` 같은 감사 도구가 기존 필드들을 오탐(false positive)으로 잡는 것을 예방한다.

### [INFO] Rationale 문구 "1-node-common 의 노드 output 규약" — 문서 관계 표현이 다소 모호

- **target 위치**: `## Rationale` — "왜 봉투만 스키마화하는가" 단락, "`1-node-common` 의 노드 output 규약([node-output.md](../conventions/node-output.md))과 SoT 가 이중화된다"
- **충돌 대상**: `spec/conventions/node-output.md` (독립 문서, frontmatter `id: node-output`) · `spec/3-workflow-editor/1-node-common.md` (L306 에서 node-output.md 를 "CONVENTIONS Principle 7" 로 인용)
- **상세**: `node-output.md` 는 `1-node-common.md` 의 하위 섹션이 아니라 **독립된 conventions 문서**이며, `1-node-common.md` 가 그것을 참조하는 관계다(실제로는 다른 여러 노드 문서도 `node-output.md` 를 참조한다 — `1-node-common` 전용 규약이 아니다). target 문구는 두 문서를 동일시하는 것처럼 읽힐 소지가 있다. 실질적 결론(봉투만 스키마화, 노드별 payload 는 열어 둠)은 정확하고 다른 spec 과 충돌하지 않으므로 CRITICAL/WARNING 은 아니다.
- **제안**: 반영 시 "`node-output.md`(1-node-common.md 등 여러 노드 문서가 참조하는 공용 output 규약집)" 정도로 문구를 정정해 문서 계층 오인을 방지.

## 점검했으나 충돌 없음 확인

- **데이터 모델**: target 은 엔티티/DB 필드를 정의하지 않는다 (`1-data-model.md` 의 `Execution`/`Trigger`/`NodeExecution` 등과 무충돌).
- **요구사항 ID**: 신설 §`api-convention §5.4` 는 기존 문서에서 미사용 섹션 번호(`grep` 결과 §5.4 참조 0건)이며, `swagger.md §1-4`/`§5-2` 는 기존 절 번호를 그대로 재사용(신규 절 번호 충돌 없음).
- **API 계약(형태 자체)**: 갭 1 이 제안하는 `oneOf` 봉투 모델은 `interaction.service.ts` 실제 반환값과 정확히 일치하며(코드 재확인 완료), 기존 `ApiOkWrappedOneOfResponse`(응답 레벨 oneOf, OAuth begin 분기)와 스코프가 겹치지 않는다.
- **상태 전이**: target 은 `Execution`/`NodeExecution`/`Integration` 등의 상태 머신을 변경하지 않는다.
- **RBAC**: target 은 권한 모델을 변경하지 않는다 (EIA 인증은 `iext_*`/`itk_*` 토큰 스킴 그대로).
- **`conversationThread` 정규화 관련 계약**: target 이 "정규화 대상 아님"으로 명시한 판단은 `conversation-thread.md §8.4`(L339-351)·`7-channel-web-chat/1-widget-app.md`(L89, L98)·`3-auth-session.md`(L62-70) 의 기존 계약과 전부 일치한다(모두 SSE/REST 동일 wire·키 생략 전제로 서술).
- **swagger §1-4 개정 범위**: `swagger.md §1-4` 를 참조하는 다른 spec 문서는 없음(`grep` 결과 0건) — 개정이 다른 영역의 기존 참조를 깨뜨리지 않는다.

## 요약

target 문서는 코드 실증이 정확하고, 인용하는 기존 spec 문구(§5.2/§5.3/§8.2 `api-convention.md`, 원칙 3 `execution-context.md`, §4/§8.4 `conversation-thread.md`)도 원문과 일치한다. 새로 정의하는 두 규칙(swagger 닫힌-union vs 열린-map 구분, api-convention 부재표현 `null` vs 키생략) 은 데이터 모델·요구사항 ID·상태 전이·RBAC 층위에서 다른 영역과 직접 충돌하지 않는다. 다만 (1) target 이 손대는 바로 그 EIA §5.3 예시 JSON 이 target 이 formalize 하려는 code-accurate shape 과 이미 어긋나 있고 갭 3 의 "경미한 cross-ref" 범위로는 이 불일치가 해소되지 않는 점, (2) 신설 `api-convention §5.4` 규칙이 프로젝트 전역의 기존 "키 생략" 필드들에 소급 적용되는지 명시하지 않아 감사 도구·후속 리뷰에서 오탐을 유발할 수 있는 점은 반영 전 정정을 권장한다. 둘 다 CRITICAL 수준의 즉시 차단 사유는 아니다.

## 위험도

LOW
