# Rationale 연속성 검토 결과

검토 모드: --impl-done  
scope: spec/2-navigation/6-config.md  
diff-base: origin/main

---

### 발견사항

발견된 위반 사항 없음.

아래는 각 변경 요소별 Rationale 정합 확인 기록이다.

---

**[INFO] PROVIDER_PROBE_THROTTLE 상수화 — 기존 throttle 결정과 정합**

- target 위치: `llm-model-config.controller.ts` 상단 `const PROVIDER_PROBE_THROTTLE`
- 관련 결정 출처: `spec/5-system/7-llm-client.md §5.5` — `@Throttle(10/60s)` for `preview-models`; `spec/2-navigation/6-config.md §3 Model Config API`
- 상세: `{ default: { limit: 10, ttl: 60_000 } }` 를 3개 핸들러에서 `PROVIDER_PROBE_THROTTLE` 상수로 추출한 순수 DRY 리팩토링이다. spec 이 `preview-models` 에 `10/60s` throttle 을 명시하고 있고, `:id/test`·`:id/models` 에도 동일 인라인 값이 이미 적용돼 있던 상태를 단일 SoT 로 정리한 것이다. 행동 변경 없음.
- 제안: 필요 없음. 기존 spec 결정과 완전 정합.

---

**[INFO] MODEL_TYPE_ENUM + ParseEnumPipe — 허용 enum 정의를 단일 SoT 로 정렬**

- target 위치: `llm-model-config.controller.ts` `MODEL_TYPE_ENUM`, `listModels` `@Query('type', new ParseEnumPipe(...))`, `@ApiBadRequestResponse`
- 관련 결정 출처: `spec/5-system/8-embedding-pipeline.md §` line 371 (서비스 레이어 `{ type?: 'chat'|'embedding' }` 필터); `spec/data-flow/7-llm-usage.md` (`?type=chat|embedding`); `spec/5-system/2-api-convention.md` (400 = 유효성 검증 실패)
- 상세: 기존 `@ApiQuery enum: ['chat', 'embedding']` (Swagger 전용) 와 `type?: 'chat' | 'embedding'` (정적 타입 전용) 가 서로 분리돼 있던 것을, `MODEL_TYPE_ENUM` 하나에서 파생시켜 `ParseEnumPipe` 런타임 검증·Swagger enum·파라미터 타입을 일치시켰다. 이전에는 규격 외 값(예: `bogus`)이 서비스 레이어까지 통과됐으나, 이제 pipe 단계에서 400 을 반환한다. spec 이 `type` 의 허용값을 `chat | embedding` 으로 명시하고 있고, API 규약이 유효성 검증 실패를 400 으로 규정하므로 결정 방향과 정합한다. 서비스 레이어 필터(embedding-pipeline spec line 371)는 제거되지 않고 유지된다 — pipe 는 service 레이어 필터 앞에 추가된 방어 레이어로, 기존 결정을 번복하지 않는다.
- 제안: 필요 없음. 단, `spec/5-system/7-llm-client.md §5.5` 혹은 `spec/2-navigation/6-config.md §3` 의 `:id/models` API 설명에 `type` 허용값 이외의 값에 대한 400 동작을 한 줄로 명시하면 spec-impl 정합도가 높아진다 (현재 spec 은 `type=chat|embedding` 의 정상 경로만 기술). 의무 사항 아님.

---

**[INFO] @ApiBadRequestResponse 추가 — Swagger 문서 보완**

- target 위치: `listModels` 핸들러의 `@ApiBadRequestResponse` 데코레이터
- 관련 결정 출처: `spec/5-system/2-api-convention.md §4` (응답 코드 목록·에러 envelope)
- 상세: ParseEnumPipe 가 400 을 반환하는 새 경로가 생겼으므로 Swagger 에 `@ApiBadRequestResponse` 를 추가한 것이다. 기존 spec 에 "Swagger 에 에러 응답을 문서화하지 말라"는 결정이 없으며, API 규약 §4 의 에러 문서화 패턴과 정합한다.
- 제안: 필요 없음.

---

### 요약

이번 diff 의 모든 변경 요소(PROVIDER_PROBE_THROTTLE 상수화, MODEL_TYPE_ENUM + ParseEnumPipe 적용, @ApiBadRequestResponse 추가, e2e 테스트)는 기존 spec Rationale 에서 명시적으로 거부되거나 합의된 원칙과 충돌하는 결정을 재도입하지 않는다. PROVIDER_PROBE_THROTTLE 은 행동 변경 없는 DRY 리팩토링이며, ParseEnumPipe 는 spec 이 정의한 `chat | embedding` enum 을 런타임에도 강제하는 방어-심층화로 API 규약의 400=유효성검증실패 원칙과 정합하고, 서비스 레이어 필터(embedding-pipeline Rationale line 371)를 제거하지 않으므로 기존 결정을 번복하지 않는다.

### 위험도

NONE
