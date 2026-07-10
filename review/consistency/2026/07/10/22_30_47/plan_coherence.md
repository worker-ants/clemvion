# Plan 정합성 검토 — `spec-draft-eia-context-schema-absence-convention.md`

## 검토 대상 및 방법

- Target: `plan/in-progress/spec-draft-eia-context-schema-absence-convention.md` (spec draft, --spec 모드)
- `plan/in-progress/**` 전체 목록 대조 + 특히 지시받은 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (EIA §5.3 `getStatus.context` 항목이 `[x]` 완료로 표기된 문서) 를 직접 읽고, target 이 인용하는 코드(`interaction.service.ts`)와 spec 본문(`spec/5-system/14-external-interaction-api.md` §5.3/§R17, `spec/conventions/swagger.md` §1-4/§5-2, `spec/5-system/2-api-convention.md` §5)을 실물 대조했다.
- `swagger.md`/`api-convention.md`/`conversation-thread.md`/`execution-context.md` 를 인용하거나 같은 절을 건드리는 다른 in-progress plan 이 있는지 grep 으로 전수 확인했다.

## 발견사항

### [INFO] `spec-sync-external-interaction-api-gaps.md` 에 신규 draft 로의 cross-ref 부재
- target 위치: 문서 전체 (특히 헤더 "출처: PR #874 ... 후속 2건의 API 계약 갭")
- 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 "**`GET /api/external/executions/:id` 의 currentNode / context 실값** (§5.3)" 항목 (`[x]`, 2026-07-08 재검증 완료로 표기)
- 상세: 두 문서는 **같은 코드 경로(`interaction.service.ts` `getStatus()`)와 같은 spec 절(§5.3/§R17)을 다루지만 축이 다르다** — 기완료 plan 항목은 "`context` 가 null placeholder 가 아니라 실값을 담는가"(런타임 동작)를 검증한 것이고, target draft 는 "그 실값의 **OpenAPI 스키마 표현**(`Record<string,unknown>|null`+`additionalProperties:true` 로 뭉개진 것)과 **null vs 키생략 표기 컨벤션**을 문서화·표준화"하는 것이다. 두 축은 상호 배타적이지 않고 target 이 fact 로 인용하는 3-way 분기(`interaction.service.ts:257-322`)·`conversationThread` 키생략 문단(§5.3 L436-441)·R17 Rationale(§1104-1157)을 코드/spec 원문과 직접 대조한 결과 **전부 정확히 일치**했다 — target 이 완료 plan 항목의 결론을 뒤집거나 재해석하지 않고 그 위에 새 축(schema)을 얹는 형태다. 다만 완료 plan 문서 쪽에는 이 신규 schema 후속 draft 로의 포인터가 없어, 향후 그 plan 만 읽는 독자는 "getStatus.context 관련 갭은 전부 끝났다"고 오인할 소지가 약간 있다 (실제로는 schema/convention 축이 별도로 진행 중).
- 제안: 필수는 아니나, `spec-sync-external-interaction-api-gaps.md` 의 해당 `[x]` 항목 끝에 "(OpenAPI schema 표현 + null/키생략 컨벤션은 별도 `spec-draft-eia-context-schema-absence-convention.md` 로 분리 진행)" 1줄을 추가하면 추적성이 좋아진다. (`ai-agent-tool-connection-rewrite.md` 가 EIA SSE payload 항목에 유사한 cross-ref 를 이미 남긴 선례가 있음.)

## 교차 확인 결과 (충돌 없음 — 기록용)

- **미해결 결정과의 충돌**: `plan/in-progress/**` 전체에서 `swagger.md §1-4`, 신설 예정 `api-convention.md §5.4`, `getStatus.context` 스키마화를 "결정 필요"로 남겨둔 항목은 없다. target 이 내리는 결정(닫힌 union 은 `oneOf`+조건부 `discriminator`, 열린 map 은 현행 `additionalProperties: true` 유지, `conversationThread` 는 정규화하지 않고 키생략 그대로 유지)은 어떤 plan 의 미결 사항도 우회하지 않는다.
- **선행 plan 미해소**: target 이 전제하는 두 선행 사실 — (1) EIA §5.3 `getStatus` 가 `context`/`currentNode` 를 실값으로 반환한다, (2) `conversationThread` 가 durable 스냅샷에서 키생략 방식으로 노출된다 — 은 모두 `spec-sync-external-interaction-api-gaps.md` 의 `[x]` 항목과 spec §R17 (2026-07-09 재조정) 로 이미 확정·구현된 상태다. `interaction.service.ts:257-322` 직접 대조로 코드-스펙-plan 3자 일치를 확인했다. 미해소 선행조건 없음.
- **후속 항목 누락**: `swagger.md §1-4/§5-2`, `api-convention.md §5` 절, `conversation-thread.md`, `execution-context.md`, `node-output.md` 를 참조하거나 편집 대상으로 삼는 다른 in-progress plan(`ai-agent-tool-connection-rewrite.md`, `node-output-redesign/*`, `parallel-p2-followups.md`, `exec-intake-followups.md`, `execution-engine-residual-gaps.md`, `spec-sync-websocket-protocol-gaps.md` 등)을 전수 확인했으나, target 의 §1-4 개정(closed-union/open-map 분리)·§5.4 신설·EIA cross-ref 갱신과 겹치거나 무효화되는 후속 항목은 없다. 섹션 번호 충돌도 없다 (`swagger.md` 는 `N-M` 하이픈 체계, target 이 건드리는 §5-2 는 각주 추가뿐; `api-convention.md` 는 `N.M` 점 체계이고 기존 하위섹션이 §5.3 에서 끝나 §5.4 신설이 비어 있는 번호를 채운다).

## 요약

target draft 는 `spec-sync-external-interaction-api-gaps.md` 가 이미 완료로 표기한 EIA §5.3 `getStatus.context` 실값 노출 작업과 **같은 코드/spec 절을 다루지만 다른 축(런타임 값 vs OpenAPI 스키마 표현·부재 표기 컨벤션)** 을 다뤄 충돌·중복이 없으며, 인용한 코드 라인·spec 문구·Rationale 을 전부 원문과 대조해 정확함을 확인했다. `swagger.md`/`api-convention.md`/`conversation-thread.md` 를 건드리는 다른 in-progress plan 과도 절 번호·결정 사항 겹침이 없다. 유일한 개선 여지는 완료 plan 쪽에 신규 draft 로의 1줄 포인터를 남겨 추적성을 높이는 것(INFO, 비차단).

## 위험도
LOW

STATUS: SUCCESS
