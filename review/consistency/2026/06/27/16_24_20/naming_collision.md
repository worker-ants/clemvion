# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-draft-mc-endpoint-spec-sync.md`
검토 모드: spec draft (--spec)

---

## 발견사항

### 발견사항 없음 (CRITICAL/WARNING 0건)

target 문서가 도입하는 신규 식별자 4건을 전체 검색 코퍼스(`spec/`, `plan/in-progress/`, `codebase/backend/src/`)와 대조한 결과, 다른 의미로 이미 사용 중인 충돌이 확인되지 않았다. 개별 항목은 아래 INFO 에서 상술한다.

---

- **[INFO]** Rate Limiting 표 "10 req/min" 동일 숫자 중복 — 혼동 주의
  - target 신규 식별자: `spec/5-system/2-api-convention.md §7` 신규 행 "Provider probe API 3종 | 10 req/min (사용자 기준, `@Throttle` — 컨트롤러 `PROVIDER_PROBE_THROTTLE`)"
  - 기존 사용처: `spec/5-system/2-api-convention.md §7` 기존 행 "인증 API | 10 req/min (IP 기준)" (line 188)
  - 상세: 두 행이 같은 숫자(10 req/min)를 사용하지만 Rate-limit 범위가 다르다. "인증 API"는 **IP 기준** 쿼터이고, probe API는 `UserThrottlerGuard`가 `user:${sub}` 키를 사용하는 **사용자 기준** 쿼터다. 현재 §7 표 설계 자체가 "인증 API(IP 기준)"를 다른 범위로 분리한 전례가 있어 구조적 패턴은 일관되며, 신규 행이 "사용자 기준" 명시와 `PROVIDER_PROBE_THROTTLE` 상수 참조를 인라인으로 포함하면 혼동 여지는 낮다.
  - 제안: 신규 행의 제한 컬럼에 "(사용자 기준)"을 명시해 인증 API 행의 "(IP 기준)"과 직접 대비되도록 표기하면 충분하다. 이미 target 계획에 "(사용자 기준)" 표기가 포함돼 있어 추가 조치는 불필요하다.

- **[INFO]** `PROVIDER_PROBE_THROTTLE` 상수명 — spec 첫 등장
  - target 신규 식별자: `PROVIDER_PROBE_THROTTLE = { default: { ttl: 60_000, limit: 10 } }` (spec 본문 진입 예정 — `spec/5-system/7-llm-client.md §5.5`)
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/src/modules/llm/llm-model-config.controller.ts` line 40 (코드에서만 존재, spec 에는 미기재)
  - 상세: 코드에 이미 정의된 상수를 spec 문서에 처음 기재하는 doc-sync다. spec 내 다른 파일에서 같은 이름을 다른 의미로 사용하는 사례는 없다.
  - 제안: 해당 없음.

- **[INFO]** `LlmConfigController` 스테일 참조 정정 — 신규 식별자 아님
  - target 신규 식별자: (신규 도입 아님) 기존 스테일 참조 `LlmConfigController` → `LlmModelConfigController` 로 정정
  - 기존 사용처: `spec/5-system/8-embedding-pipeline.md` line 371 에 `LlmConfigController` 잔존; `spec/5-system/7-llm-client.md` lines 452·478 에 이미 `LlmModelConfigController` 로 기재
  - 상세: 두 파일에서 동일 컨트롤러를 다른 이름으로 부르는 기존 불일치를 정정하는 것이므로 새로운 충돌은 없다. 정정 후 `LlmModelConfigController` 가 단일 명칭으로 수렴한다.
  - 제안: 해당 없음.

- **[INFO]** `MODEL_TYPE_ENUM` / `ParseEnumPipe` — spec 본문 미노출 식별자
  - target 신규 식별자: 구현 상수 `MODEL_TYPE_ENUM = { chat, embedding }` 및 NestJS 내장 `ParseEnumPipe`
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/src/modules/llm/llm-model-config.controller.ts` lines 44–45, 124, 136 (코드에서만 존재)
  - 상세: target 계획 본문(배경 설명)에서 언급되지만 실제 spec 문서 변경에는 코드 상수명이 아닌 "허용값(`chat`·`embedding`) 외 400" 이라는 동작 서술로 표현될 것으로 보인다. `spec/5-system/8-embedding-pipeline.md §371` 기존 문구("서비스 레이어에서 필터링. `LlmConfigController` 는 `@ApiQuery` 데코레이터 추가")와 충돌 없이 보완·정정된다. 기존 spec의 `{ type?: 'chat'|'embedding' }` 표기와 의미 중복 없음.
  - 제안: 해당 없음.

---

## 요약

target 문서(spec-draft-mc-endpoint-spec-sync)가 도입하는 신규 식별자는 `PROVIDER_PROBE_THROTTLE` 상수명(`spec/5-system/7-llm-client.md §5.5` 첫 기재), Rate Limiting 표 신규 행, `LlmConfigController` → `LlmModelConfigController` 정정, 400 동작 서술 추가이다. 이 중 다른 의미로 이미 사용 중인 동일 식별자는 없다. Rate Limiting 표에서 "인증 API(IP 기준)"와 같은 숫자(10 req/min)가 중복 등장하나, 범위 한정어("사용자 기준" vs "IP 기준")가 이미 target 계획에 포함돼 있어 표 내 혼동 위험이 낮다. 나머지 항목은 코드에 이미 존재하는 사실의 doc-sync 이며 spec 네임스페이스 신규 진입이다.

## 위험도

NONE
