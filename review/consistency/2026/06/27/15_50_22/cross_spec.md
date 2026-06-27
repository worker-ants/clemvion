# Cross-Spec 일관성 검토 결과

검토 범위: `spec/2-navigation/6-config.md` (--impl-done, diff-base=origin/main)
구현 대상: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` + `test/workspace-rbac.e2e-spec.ts`

---

## 발견사항

### [INFO] `GET /api/model-configs/:id/models` — `?type` 쿼리 파라미터와 400 응답이 spec API 테이블에 미기재

- **target 위치**: `spec/2-navigation/6-config.md §3 Model Config API` 표
- **충돌 대상**: `spec/data-flow/7-llm-usage.md §53`, `spec/5-system/8-embedding-pipeline.md §371`
- **상세**: 구현 diff 가 `ParseEnumPipe(MODEL_TYPE_ENUM, { optional: true })` 를 `GET :id/models` 의 `?type` 쿼리 파라미터에 추가해, `bogus` 등 허용값 외 입력 시 400 을 반환하는 behavior-change 를 도입했다. `@ApiBadRequestResponse` 도 함께 추가됐다.
  - `spec/data-flow/7-llm-usage.md §53` 은 `?type=chat|embedding` 필터를 언급하고 있어 허용값 자체는 일치한다(`MODEL_TYPE_ENUM = { chat, embedding }` ↔ `ModelInfo.type: 'chat' | 'embedding'` — `spec/5-system/7-llm-client.md §3.5` SoT와도 정합).
  - 그러나 `spec/2-navigation/6-config.md §3` API 표의 해당 행 `"GET /api/model-configs/:id/models"` 은 `(chat/embedding)` 를 설명 괄호 안에만 언급할 뿐, `?type` 을 정식 쿼리 파라미터로 기재하지 않으며 400 응답도 문서화하지 않는다.
  - `spec/5-system/8-embedding-pipeline.md §371` 은 "`{ type?: 'chat'|'embedding' }` 옵션을 서비스 레이어에서 필터링" 이라 기술하는데, `ParseEnumPipe` 도입으로 유효하지 않은 값은 서비스 레이어에 도달하기 전에 파이프 레이어에서 400 으로 거부된다. 이는 모순은 아니지만 서비스 레이어 필터링이 전부인 것처럼 읽히는 서술이 동작 범위와 어긋난다.
- **제안**:
  - `spec/2-navigation/6-config.md §3` API 표의 `GET /api/model-configs/:id/models` 행에 `?type=chat|embedding (optional)` 을 정식 쿼리 파라미터로 추가하고, 400 응답(`허용값 외 type 전달 시`) 을 Response 항목에 명시한다.
  - `spec/5-system/8-embedding-pipeline.md §371` 을 "컨트롤러 `ParseEnumPipe` 가 허용값(`chat|embedding`)을 강제하고, 서비스 레이어는 해당 옵션으로 목록을 필터링한다" 로 보완한다.
  - `spec/data-flow/7-llm-usage.md §53` 의 `?type=chat|embedding` 필터 설명에 "허용값 외 입력 시 400" 을 추가한다.

---

### [INFO] `spec/5-system/2-api-convention.md §7 Rate Limiting` 표 — provider probe 10 req/min 미기재

- **target 위치**: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` (PROVIDER_PROBE_THROTTLE 상수, 3개 핸들러 공유)
- **충돌 대상**: `spec/5-system/2-api-convention.md §7`, `spec/5-system/7-llm-client.md §5.5`
- **상세**: `spec/5-system/7-llm-client.md §5.5` 는 `POST preview-models` 에 `@Throttle(10/60s)` 가 적용된다고 명시하지만, `spec/5-system/2-api-convention.md §7` Rate Limiting 표에는 "일반 API 100 req/min" 과 "인증 API 10 req/min" 두 범주만 있다. `:id/test`·`:id/models` 에 대한 10 req/min 제한은 어느 spec 에도 기재되지 않는다. diff 는 3개 핸들러를 상수로 통일했을 뿐 throttle 값은 기존 그대로(10/60s)이므로 이번 diff 에서 새로 생긴 drift 는 아니지만, 상수 가시화로 인해 기존 미기재 gap 이 드러났다.
- **제안**: `spec/5-system/2-api-convention.md §7` 표에 "Provider probe API (`preview-models`·`:id/test`·`:id/models`) — 10 req/min (사용자 기준, 과금 provider 호출 보호)" 행을 추가하거나, `spec/5-system/7-llm-client.md §5.5` 주석에서 해당 정책이 `:id/test`·`:id/models` 에도 동일 적용됨을 명시한다.

---

## 요약

이번 diff(`mc-endpoint-hardening`) 의 핵심 변경은 `ParseEnumPipe` 를 통한 `?type` 쿼리 파라미터 런타임 검증(허용값: `chat|embedding`, 위반 시 400) 과 Swagger `@ApiBadRequestResponse` 추가다. 허용값 집합(`MODEL_TYPE_ENUM`) 은 `spec/5-system/7-llm-client.md §3.5 ModelInfo.type` 및 `spec/data-flow/7-llm-usage.md` 기재값과 완전히 일치하며, RBAC(`preview-models`·`:id/test` = Editor+, `:id/models` = Viewer+)도 `spec/2-navigation/6-config.md §3` 과 정합한다. throttle 값 변경은 없다. 두 발견사항 모두 기존 구현이 이미 채택한 행동을 spec 문서가 미기재한 동기화 권장(INFO) 수준이며, 두 영역이 서로 작동 불가해지는 모순(CRITICAL)이나 우선순위 결정이 필요한 잠재 충돌(WARNING)은 없다.

## 위험도

LOW
