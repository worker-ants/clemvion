# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. 이전 3라운드(`10_53_52` CRITICAL 1건, `11_25_15`/`12_00_05` WARNING 다수)의 지적사항은 4개 reviewer(security/requirement/testing/documentation) 전원이 소스 재대조·재현으로 해소를 독립 확인했다. 이번 라운드 신규 발견은 WARNING 2건(하나는 testing·documentation 두 reviewer가 동일 지점을 지적해 통합, 다른 하나는 이미 문서화된 의도적 트레이드오프)뿐이며 forced whitelist(documentation, requirement, security, testing) 4명 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing/documentation | `setStructuredOutput` JSDoc 이 "참조로 저장(no defensive copy) — `handler-output.adapter.spec.ts`의 `toBe` 캐너리가 고정한다"고 주장하지만, 그 캐너리는 `adaptHandlerReturn` 만 호출하고 `ExecutionContextService`/`setStructuredOutput` 은 import 조차 안 된다. 실제로도 `structuredOutputCache[nodeId] = { ...adapted }` 라 top-level 은 새 객체이고, 참조가 공유되는 건 한 단계 안쪽 `adapted.config` 뿐 — JSDoc 서술이 레벨을 섞어 오해 소지. testing 팀이 `structuredOutputCache[nodeId] = adapted` → `{ ...adapted }` 로 바꾸는 뮤테이션(참조-보존을 깨는 변경)을 직접 적용해 `execution-context.service.spec.ts` + `handler-output.adapter.spec.ts` 66/66 GREEN 을 실측 확인 — 이 계약을 깨도 아무 테스트도 못 잡는다. | `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts:141-148`(JSDoc), `:160`(구현); 대조 `handler-output.adapter.spec.ts:164-172`(`toBe` 캐너리, 범위 밖) | JSDoc 을 "top-level 래퍼는 새로 만들지만 그 안의 `config` 는 `adapted.config` 와 동일 참조"로 정정하고, `execution-context.service.spec.ts` 에 `expect(ctx.structuredOutputCache[nodeId].config).toBe(adapted.config)` 형태의 직접 `toBe` identity 캐너리 추가(자매 `setEngineResolvedConfig` 엔 대조군 `not.toBe` 권장) |
| 2 | security | config 안전성이 storage-time 마스킹 → egress-only 로 전환되며 두 방어축이 약화됨: (1) DB 에 `outputData.config` 가 이제 원문 저장 — 백업/관리자 쿼리/향후 export API 가 항상 원문을 봄, (2) 같은 워크스페이스 작성 권한자가 표현식으로 한 노드의 `config.apiKey` 를 다른 노드 body 에 실어 제3자로 전송하는 크로스-노드 자격증명 릴레이가 구조적으로 가능. safe-by-construction → safe-by-convention 전환이라 신규 egress 엔드포인트가 두 마스킹 헬퍼(REST/WS)를 우회하면 조용히 샐 수 있음. (이미 `spec/2-navigation/14-execution-history.md` R-5 정정 블록과 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 명시 등재된 **의도된·문서화된 트레이드오프** — 신규 미문서화 결함 아님, 비차단) | `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:30-53`; `spec/2-navigation/14-execution-history.md` R-5 정정 블록 | 근본 처방(자격증명을 값이 아닌 `llmConfigId` 등 참조로 담는 패턴 일반화)의 트래커 우선순위 유지. 이 PR 자체는 조치 불요 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement/security | 이전 3라운드 CRITICAL 1건(포함관계 캐너리가 `DEFAULT_SENSITIVE_KEYS`에서 파생되지 않던 결함) + WARNING 4건(spec mirror sweep 불완전 3곳, vacuous 빈 문자열 캐너리)이 전부 해소됨을 독립 재현(신규 키 추가 → 정확히 그 키만 RED)·22개 키 전수 정규식 대조·line-level spec 재대조로 확인 | `mask-sensitive-fields.util.ts:10`, `.spec.ts:139/160-165`, `node-output.md:256`, `4-execution-engine.md:193/203/1510`, `1-ai-agent.md:480/755/979` | 없음 |
| 2 | requirement | 3라운드 연속 미수정이던 문법 깨진 주석 문장이 이번엔 문장 전체를 취소선 처리하는 방식으로 근본 재작성되어 해소됨 | `mask-sensitive-fields.util.ts:38-40` | 없음 |
| 3 | security | WS 전용 로컬 `CREDENTIAL_KEY_PATTERN`(좁은 사본)은 `sanitizePayloadForWs` 한 곳에만 쓰이고, config echo 경로는 `maskWireEnvelope`→공유 넓은 정규식을 타므로 이 PR 범위에 영향 없음(별건 트래커 W6 기재 일치) | `websocket.service.ts:78-79` vs `sanitize-error-message.ts:112` | 없음(별건 추적 중) |
| 4 | security/testing/documentation | `setStructuredOutput` 이 `adapted`(및 그 안의 `config`)를 참조로 캐시에 저장 — 마스킹 boundary 가 겸하던 암묵적 deep-clone 소실. 보안 취약점은 아니며(1st-party 코드), 데이터 무결성/aliasing 관점 이슈 | `execution-context.service.ts:140-160` | 없음(위 WARNING #1 로 테스트 갭만 별도 처리) |
| 5 | testing/requirement | 핵심 회귀 스위트(`mask-sensitive-fields.util.spec.ts`, `handler-output.adapter.spec.ts`) 직접 실행 결과 2 suites/84 tests 전부 GREEN | 해당 없음 | 없음 |
| 6 | testing | 안전 주장을 검증하는 캐너리들이 실제 egress 진입점(`redactStoredDataForResponse`/`maskWireEnvelope`)이 아니라 저수준 공유 함수 `deepRedactSecrets` 를 직접 호출 — 여러 이전 라운드가 이미 "기존부터 있던 갭, 이 PR 신규 아님"으로 판정한 항목의 반복 확인 | `handler-output.adapter.spec.ts` | 없음(별건 추적) |
| 7 | documentation | `plan/complete/**` 4개 문서(`assistant-mask-leak.md`, `spec-update-assistant-masking.md`, `eia-internal-rest-error-masking.md`, `spec-draft-cross-audit-doc-batch.md`)가 제거된 어댑터 boundary 를 현재형으로 서술한 채 남아 있음 — plan lifecycle 관례상 완료 스냅샷은 소급 수정하지 않는 것이 정상이라 조치 불필요 | 위 4개 경로 | 조치 불필요(관례) |
| 8 | documentation | CHANGELOG "Unreleased" 항목, `mask-sensitive-fields.util.ts` export JSDoc, `handler-output.adapter.ts` 인라인 주석, 6개 spec 문서 미러 스윕이 3라운드의 자기교정 끝에 이번 시점 기준 전수 정합 확인됨 | 다수(문서 참조) | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 이전 CRITICAL 해소 재확인 + storage→egress-only 전환의 문서화된 트레이드오프(WARNING, 비차단) |
| requirement | LOW | 이전 CRITICAL/WARNING 전부 재현/재대조로 해소 확인, 신규 결함 없음 |
| testing | LOW | 핵심 회귀 84/84 GREEN, `setStructuredOutput` JSDoc 인용 캐너리가 실제 경로를 안 덮는 테스트 갭(WARNING) 발견 |
| documentation | LOW | 6개 spec + CHANGELOG 미러 스윕 정합 확인, 동일 JSDoc 과장 서술(WARNING) 독립 지적 |

## 발견 없는 에이전트

없음 (4개 에이전트 전원 발견사항 있음, 단 전체 위험도는 LOW).

## 권장 조치사항
1. `execution-context.service.spec.ts` 에 `setStructuredOutput` 전용 identity 캐너리(`expect(ctx.structuredOutputCache[nodeId].config).toBe(adapted.config)`) 추가하고, `execution-context.service.ts:141-148` JSDoc 을 "top-level 래퍼는 새로 생성, `config` 만 참조 공유"로 정정한다 (WARNING #1).
2. security WARNING #2(storage-time→egress-only 전환에 따른 DB 원문 저장·크로스노드 릴레이 가능성)는 이미 spec R-5 및 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 등재된 트레이드오프이므로 이번 PR 병합을 막지 않되, 자격증명을 참조(`llmConfigId` 등)로 다루는 근본 처방의 트래커 우선순위를 유지한다.
3. 나머지 INFO 항목은 조치 불필요(양호 확인 또는 관례상 정상).

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 reviewer 강제 포함(router_safety forced): `documentation, requirement, security, testing` (4명 전원, 제외 0명). forced 전원 결과 확보됨 — 화이트리스트 미이행 없음.
