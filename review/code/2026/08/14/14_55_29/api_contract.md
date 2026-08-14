# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** REST 응답(`GET /api/external/executions/:id`)에서 `llmCalls` 필드가 어떤 깊이에서도 제거되도록 바뀌어 응답 바디 내용이 변한다 — 다만 스키마·문서화된 계약을 깨는 breaking change 는 아니다
  - 위치: `CHANGELOG.md:34-35` (Unreleased 항목), `codebase/backend/src/modules/external-interaction/interaction.service.ts` `redactAndStrip`/`getStatus` (git diff `origin/main..HEAD`, 이 파일은 프롬프트에서 diff 가 생략돼 게이트 번호 없음 — 함수명으로 기재), 대조: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts` `result`/`error`/`NodeOutputContextDto.nodeOutput` 필드(`additionalProperties: true` 로 선언된 열린 map)
  - 상세: `getStatus` 의 waiting `nodeOutput` · terminal `result` · terminal `error` 세 출구 모두 이제 `deepRedactSecrets`(값 마스킹) + `stripExternalOnlyFields`(필드 삭제)를 함께 거친다. 이 변경으로 이전에 (버그로) 중첩 경로에서 새고 있던 raw LLM 프롬프트(`llmCalls[].requestPayload`/`responsePayload`)가 REST 응답에서도 사라진다. 이 필드에 우연히 의존하던 외부 클라이언트 입장에서는 응답 내용이 달라지는 것이 사실이지만, (1) `spec/5-system/6-websocket-protocol.md` §4.4 가 이미 "`llmCalls` 는 모든 외부 수신자에서 strip 된다" 고 선언한 **문서화된 계약**이었고 이번 수정은 그 선언을 실제로 충족시키는 교정이며, (2) `ExecutionStatusDto` 의 `result`/`error`/`context.nodeOutput` 은 애초에 `llmCalls` 를 포함해 어떤 하위 필드도 스키마상 약속하지 않는 열린 map(`type:'object', additionalProperties:true`)이라 OpenAPI 스키마 자체는 깨지지 않는다. CHANGELOG 도 "이미 전송된 데이터라 워크스페이스별 운영 판단이 필요하다" 는 사후 대응 필요성을 명시해 적절히 커뮤니케이션됐다.
  - 제안: 추가 조치 불필요. 다만 외부 통합자에게 공지가 필요한 조직이라면 이 CHANGELOG 항목을 API 변경 공지 채널로도 전파할 것을 권장.

- **[INFO]** REST snapshot 과 WS fanout(SSE/webhook/chat-channel)이 동일 데이터에 서로 다른 정화 수준을 적용해 오던 불일치를 이번 diff 가 공유 헬퍼로 통일했다 — 응답 형식 일관성 관점에서 긍정적
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:454-457`, `:528-531` (`stripExternalOnlyFields(wireEnvelope, MAX_SANITIZE_DEPTH)` 호출부, 게이트 확인), `codebase/backend/src/shared/utils/strip-external-only-fields.ts` (신규 공유 유틸, git diff 상 게이트 없음 — 함수 `stripExternalOnlyFields`/`stripDeep`)
  - 상세: 수정 전에는 같은 `iext_*`/`itk_*` 토큰으로 접근하는 동일 데이터를 두고 REST `getStatus` 는 값 마스킹만, WS fanout 은 top-level 필드 삭제만 적용해 두 표면의 응답이 서로 다른 수준으로 새고 있었다. 이번 커밋들이 `shared/utils/strip-external-only-fields.ts` 로 로직을 단일화하고 REST 쪽 세 출구를 `redactAndStrip` 한 헬퍼로 묶어, "같은 토큰이 접근하는 같은 데이터는 어느 표면에서 봐도 같은 수준으로 정화된다" 는 일관성을 실제로 회복시켰다. 이는 API 계약 관점에서 바람직한 방향이다.
  - 제안: 없음(현행 유지 권장). 새로운 외부 표면이 추가될 때도 이 공유 헬퍼를 재사용하도록 관례를 유지할 것.

- **[INFO]** `spec/5-system/14-external-interaction-api.md` §R17 이 `getStatus` 응답 정화를 "secret-shape 만 치환" 으로만 서술해, 이번에 추가된 필드-삭제(`stripExternalOnlyFields`) 동작을 아직 반영하지 못한다 — 단, 이미 planner 인계로 등재된 추적 항목이라 새로 발견된 갭이 아님
  - 위치: `spec/5-system/14-external-interaction-api.md:1350-1351` (§R17 본문), 추적 항목: `plan/in-progress/spec-draft-eia-62-waiting-payload.md:130-137` ("§R17 정정")
  - 상세: 이 diff 는 `spec/` 을 건드리지 않았고(developer 는 `spec/` read-only), spec-draft 문서에 "현행은 `getStatus` 를 *secret-shape 만 치환* 으로 서술하는데 실제로는 값 마스킹 + 필드 삭제를 병행한다 … 코드가 spec 을 앞질러 있다" 로 정확히 등재해 planner 로 넘긴 상태다. API 응답이 실제로 spec 보다 더 엄격(더 많이 가림)한 방향으로 앞서 있어 계약 위반은 아니며, 문서 drift 자체는 인지·추적되고 있다.
  - 제안: 없음(planner 턴에서 §R17 갱신 예정 — 이 리뷰가 재차 요구할 필요 없음).

## 요약

이번 변경은 새 엔드포인트·라우트·요청 검증·페이지네이션·인증/인가 로직을 추가/수정하지 않는 순수 응답-바디 보안 수정이다. `GET /api/external/executions/:id`(REST)와 SSE/webhook/chat-channel(fanout)이 공유하는 새 유틸(`stripExternalOnlyFields`)로 raw LLM 프롬프트(`llmCalls`)를 깊이 무관하게 제거하도록 통일했고, 응답 DTO(`ExecutionStatusDto`)는 애초에 해당 하위 필드를 스키마로 약속한 적이 없는 열린 map 이라 OpenAPI 계약 자체는 깨지지 않는다. 이 필드가 이미 WS §4.4 spec 상 "모든 외부 수신자에서 strip" 으로 선언돼 있었던 점에서, 이번 수정은 새로운 breaking change 라기보다 기존에 선언된 계약을 실제 구현이 뒤늦게 충족시킨 교정이며, REST·fanout 두 표면 간 응답 정화 수준의 불일치도 함께 해소해 응답 형식 일관성이 개선됐다. 유일한 잔여는 EIA spec §R17 본문 서술이 새 구현(필드 삭제 병행)을 아직 반영하지 못한 문서 drift인데, 이는 developer 권한 밖으로 이미 planner 인계 항목(`spec-draft-eia-62-waiting-payload.md` §(7))에 정확히 등재돼 있어 이 리뷰가 새로 지적할 결함이 아니다. 버전 관리(URL 미포함 단일 버전 운영, `2-api-convention.md:31`)·에러 응답·요청 검증·URL 설계·페이지네이션·인증/인가 관점에서는 이번 diff 로 인한 변경이나 위험이 없다.

## 위험도

LOW
