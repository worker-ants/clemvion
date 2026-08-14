### 발견사항

- **[INFO]** 이번 라운드(`16_29_50`)에서 API 계약에 영향을 줄 수 있는 실질 변경은 이전 `api_contract.md`(`14_55_29`, `15_58_26`)가 이미 리뷰한 범위에서 벗어나지 않는다 — 새 커밋 2개(`dfc63bbb7`, `a78ab029e`) 중 코드 변경은 `dfc63bbb7` 하나뿐이고, 그 내용은 (a) `stripAndRedact` null 분기 회귀 테스트 추가, (b) 이미 구현된 동작을 spec 문서(`EIA §6.2`, `WS §4.4 Rationale`)에 뒤늦게 반영한 것이다. `a78ab029e` 는 코드 변경 없이 plan 문서·리뷰 산출물만 추가했다.
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:704-753`(`stripAndRedact` null 분기 `it.each`), `spec/5-system/14-external-interaction-api.md:687-691`(§6.2 신규 blockquote), `spec/5-system/6-websocket-protocol.md:1057-1065`(WS §4.4 Rationale addendum)
  - 상세: `git log`(16:22, 16:29 커밋)와 각 커밋의 `git show --stat`으로 확인. 응답 스키마·엔드포인트·인증 로직 자체를 건드리는 diff 는 없다.
  - 제안: 없음.

- **[INFO]** `stripAndRedact` null 분기 테스트 추가는 API 응답 계약(“결과 없음” = `null` vs “빈 결과” = `{}`)의 회귀를 실제로 막는 긍정적 변경이다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:704-728`(`it.each(['completed'...], ['failed'...])` — `outputData` 가 `null` 이면 `result`/`error` 도 `null`)
  - 상세: `stripAndRedact`(`interaction.service.ts:98`)는 호출부 3곳(waiting/`result`/`error`)에 흩어져 있던 null 가드를 헬퍼 1곳으로 접었는데, 이 리팩터가 `null`→`{}` 로 값을 바꿔도 잡아낼 테스트가 이전엔 없었다. terminal 두 경로(`result`/`error`, `interaction.service.ts:439,443`)는 이 테스트로 실제로 RED 판별력이 확인됐고(뮤턴트로 실측, 커밋 메시지 기재), waiting 경로는 `?? {}`(`interaction.service.ts:379`)가 흡수하는 비대칭도 JSDoc 에 함께 기록됐다. DTO 의 `result?: ... | null` / `error?: ... | null` nullable 계약과 정확히 일치한다.
  - 제안: 없음(positive finding).

- **[INFO]** `GET /api/external/executions/:executionId`(§5.3, REST 단발 상태 조회) 응답에 `llmCalls` strip 이 적용된다는 사실이 여전히 §5.3 본문에는 인라인으로 없다 — `15_58_26` api_contract.md 에서 이미 지적된 항목이 이번 두 커밋(§6.2·WS §4.4 갱신)으로도 닫히지 않았다
  - 위치: `spec/5-system/14-external-interaction-api.md:434`(`### 5.3 단발 상태 조회`) 절 vs. 신규로 추가된 `:687-691`(§6.2 blockquote, webhook 전용 절)
  - 상세: 이번 라운드에 새로 들어간 blockquote 는 `## 6. API 명세 — Outbound Notification`(webhook) 하위 `### 6.2 페이로드 — execution.waiting_for_input` 절에 있다. §5.3 은 별개 섹션(`## 5. API 명세 — Inbound`)이라 이 blockquote 의 발견성이 §5.3 독자에게 미치지 않는다. 동작 자체는 이미 올바르게 구현·테스트돼 있고(`stripAndRedact`), Rationale(§R17 부근)에도 서술이 있어 계약 위반은 아니지만, §5.3 을 단독으로 읽는 API 소비자는 여전히 이 사실을 놓칠 수 있다.
  - 제안: 급하지 않음(CRITICAL/WARNING 아님) — 다음 §5.3 관련 편집 시 `구현 상태 (V1)` 콜아웃 근처에 한 줄 인라인 추가를 권고. 신규 지적 아니라 이월.

- **[해당 없음]** 이번 diff 는 새 엔드포인트·URL 경로·페이지네이션·인증/인가 로직을 추가/변경하지 않는다. `error.code`/`nodeId` 의 `null` 가능성 문서화(`spec/1-data-model.md`, `EIA §6.4`)도 기존 구현 동작을 뒤늦게 문서에 반영한 것으로, DTO·wire 형태 변경은 없다(§6.4 상태 문서만 갱신, 대응 코드는 이번 diff 범위 밖).

### 요약

이번 라운드의 실질 코드 델타는 커밋 `dfc63bbb7` 하나이며, `stripAndRedact`(`interaction.service.ts:98`)의 null 분기 회귀 테스트를 추가하고 이미 구현된 depth-무관 `llmCalls` strip 동작을 spec 문서(EIA §6.2, WS §4.4 Rationale)에 뒤늦게 반영했을 뿐이다. API 계약 관점에서 새로 도입된 breaking change·응답 스키마 드리프트·인증/인가/페이지네이션 변경은 없으며, 앞선 두 라운드(`14_55_29`, `15_58_26`)가 이미 확인한 "OpenAPI `additionalProperties: true` 라 스키마 파괴 없음", "REST/WS 두 표면이 동일 유틸을 공유해 응답 계약이 대칭화됨", "null/키-생략 부재 표현 관례 보존" 결론은 이번 라운드에서도 그대로 유효하다. 유일하게 남은 항목은 §5.3(REST 단발 조회) 본문에 `llmCalls` strip 사실이 인라인으로 없다는 발견성 이슈로, 이번 두 커밋으로도 닫히지 않고 그대로 이월된다 — 계약 위반이 아니라 문서 발견성 개선 제안(INFO)이다.

### 위험도
LOW
