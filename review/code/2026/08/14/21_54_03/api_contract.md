### 발견사항

- **[INFO]** 라이브 외부 REST 엔드포인트(`GET /api/external/executions/:id`)의 응답 payload 형태가 버전 표식 없이 축소됨 — 이미 문서화된 계약(WS §4.4 "모든 외부 수신자에서 strip 된다")을 사후 강제하는 보안 수정이라 신규 breaking change 는 아님 (직전 라운드 `16_44_37` 부터 이어지는 재확인)
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:98`(`function stripAndRedact`), 호출부 `:384`(`nodeOutput`/waiting)·`:446`(`result`)·`:450`(`error`)
  - 상세: `stripAndRedact` 가 `deepRedactSecrets`(값 마스킹만) 앞에 `stripExternalOnlyFields`(필드 삭제, 깊이 무관)를 추가로 걸면서 세 출구 모두에서 `llmCalls`/`meta.turnDebug[].llmCalls` 필드가 응답에서 완전히 사라진다. 이 필드를 (의도치 않게) 수신해 오던 외부 클라이언트 입장에서는 응답 스키마가 조용히 좁아지지만, `CHANGELOG.md`(`## Unreleased — (보안) llmCalls raw 프롬프트가 외부로 새고 있었다`)가 "이미 전송된 데이터는 되돌릴 수 없고 외부 통합자가 저장했을 수 있다"는 영향 범위를 명시적으로 공지하고 있다. DTO(`ExecutionStatusDto`/`NodeOutputContextDto`/`ButtonsContextDto`)는 애초에 `nodeOutput`/`result`/`error`를 `additionalProperties: true`인 열린 map 으로 문서화하고 있어(`spec/conventions/node-output.md` 위임), 이번 변경으로 OpenAPI 스키마 자체의 갱신이 필요하지도 않다.
  - 제안: 추가 조치 불필요. 이 EIA 표면에 정식 버저닝 세그먼트가 없는 상태(관례상 `/v1/` 미사용, `spec/5-system/2-api-convention.md` §1)라 별도 버전 신호보다 CHANGELOG 공지로 갈음하는 현재 처리가 합리적이다.

- **[INFO]** (positive) `null` vs `{}` 응답 구분이 헬퍼 통합(`stripAndRedact`) 이후에도 회귀 테스트로 보존됨
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts` — `outputData`가 `null`이면 `result`/`error`는 `{}`가 아니라 `null`이어야 한다는 `it.each` 블록, `nodeOutput`이 `null`이어도 `context` 조립이 깨지지 않는다는 케이스
  - 상세: `stripAndRedact`(`interaction.service.ts:99`)는 `value === null || value === undefined`이면 `null`을 명시적으로 반환해, 헬퍼 통합 이전 3곳에 흩어져 있던 null 가드를 하나로 접으면서도 "결과 없음"(`null`)과 "빈 결과"(`{}`)를 API 컨슈머가 구분할 수 있는 기존 계약을 유지한다. 이 구분이 깨지면 클라이언트가 실질적 스키마 회귀를 겪는데, 전용 테스트로 명시적으로 고정돼 있다.
  - 제안: 없음(확인 완료).

- **[INFO]** 이번 라운드(`21_54_03`)의 API 표면 관련 실질 델타는 없음 — spec 문서 오너십 정정 1건뿐
  - 위치: `spec/5-system/14-external-interaction-api.md`(§6.2 blockquote, `waitingNodeType` 행 삭제) — commit `462455a52`
  - 상세: 직전 라운드(`16_44_37`) 이후 이 세션에서 추가된 코드 변경은 `interaction.service.ts:104-107`에 성능 실측 수치를 덧붙인 JSDoc 주석뿐(로직 무변경)이고, 나머지 델타는 `spec-draft-eia-62-waiting-payload.md`의 벤치마크 기록과 `spec/5-system/14-external-interaction-api.md`에서 "`node.type` → `waitingNodeType`이 외부 소비 필드"라던 서술을 철회한 것이다. `waitingNodeType`은 종전과 동일하게 wire 에 평면으로 계속 실린다(코드 변경 없음) — 바뀐 것은 "누가 그 필드를 문서 SoT 로 소유하는가"(WS §4.4 vs EIA §6.2)라는 문서 내부 오너십 서술이지, 실제 REST/WS 응답 바이트나 클라이언트 계약이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** 인증/인가·요청 검증·URL 설계·페이지네이션 표면은 이번 diff 전체(누적)로도 변경되지 않음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.controller.ts:57,166-188`(`@Controller('external/executions')`, `@Get(':executionId')`) — 이번 diff 에 이 파일은 포함되지 않음
  - 상세: 변경은 `getStatus` 응답 payload 를 조립하는 세 지점의 후처리(strip+redact) 함수 교체와 WS fanout 헬퍼의 공유 유틸 추출에 한정된다. `isInternalCtx`/`InteractionGuard` 등 인증·인가 체크, 라우트 경로, 요청 DTO, 목록 API(대상 없음)는 손대지 않았다.
  - 제안: 조치 불필요.

### 요약

이번 diff 의 핵심은 신규 엔드포인트·URL·버전·요청 검증·페이지네이션·인증 변경이 없는 보안 버그 수정으로, 외부 REST(`GET /api/external/executions/:id`)·WS fanout·webhook·chat-channel 로 새던 `llmCalls` debug 필드(raw LLM 프롬프트/대화 이력)를 깊이 무관 strip 으로 막는다. 이 축소는 이미 문서화돼 있던 계약(WS §4.4 "모든 외부 수신자에서 strip 된다")을 실제로 강제하는 시정이며, 응답 DTO 는 애초에 해당 필드들을 열린 map(`additionalProperties: true`)으로 문서화하고 있어 OpenAPI 스키마 자체의 드리프트도 없다. `null` vs `{}` 구분은 헬퍼 통합 후에도 전용 회귀 테스트로 보존된다. 직전 API 계약 리뷰 라운드(`16_44_37`, LOW) 이후 이 세션에서 추가된 것은 성능 실측 JSDoc 주석과 `spec/5-system/14-external-interaction-api.md` 의 `waitingNodeType` 오너십 서술 철회(코드/wire 무변경)뿐이라 API 계약 관점의 신규 위험은 없다. 유일하게 유의할 점(응답 payload 가 버전 신호 없이 조용히 좁아짐)은 CHANGELOG 공지로 이미 완화돼 있다.

### 위험도
LOW
