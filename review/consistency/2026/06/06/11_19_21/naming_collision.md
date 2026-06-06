# 신규 식별자 충돌 검토 결과

검토 범위: `spec/5-system/` diff (`origin/main` 대비), 검토 모드: `--impl-done`

---

## 발견사항

### 1. INFO — `input_type` 섹션 헤딩 vs Cafe24 API 카탈로그 동명 필드

- **target 신규 식별자**: `spec/5-system/8-embedding-pipeline.md §5.4` 섹션 헤딩 `### 5.4 비대칭 입력 (input_type / prefix)` 및 Rationale `### 결정: 비대칭 입력(input_type / prefix) 배선`
- **기존 사용처**: `spec/conventions/cafe24-api-catalog/order/orderform-properties.md`, `spec/conventions/cafe24-api-catalog/order/orders.md`, `spec/conventions/cafe24-api-catalog/store/orderform-setting.md` 다수 줄 — Cafe24 주문서 추가항목 입력 형식(T/M/R/C/S/D/I)을 뜻하는 JSONB API 필드명으로 사용
- **상세**: 두 `input_type` 은 영역이 완전히 다르다. `spec/5-system/` 의 것은 embedding 비대칭 검색 힌트(`'query'`/`'document'`)를 뜻하는 내부 함수 파라미터 개념 명칭이고, Cafe24 카탈로그의 것은 외부 API 필드명(텍스트박스/라디오버튼 등 UI 입력 방식). 코드 레벨에서 충돌 지점은 없다. 그러나 같은 이름이 spec 내 다른 맥락에 두 군데 존재하므로 `spec/5-system` 에서 검색 시 cafe24 필드명과 혼동될 여지가 있다.
- **제안**: `spec/5-system/8-embedding-pipeline.md §5.4` 헤딩을 `### 5.4 비대칭 임베딩 입력 (inputType / prefix)` 로 변경해 camelCase `inputType` 을 기준 용어로 삼으면 Cafe24 `input_type`(snake_case) 과 시각적으로도 구분된다. 단 현재 충돌 수준이 낮으므로 필수 변경은 아님.

---

### 2. INFO — `embedding-input-type.ts` 코드 파일이 두 spec frontmatter 에 동시 등재

- **target 신규 식별자**: `spec/5-system/7-llm-client.md` frontmatter `code:` 에 `codebase/backend/src/modules/llm/embedding-input-type.ts` 추가; `spec/5-system/8-embedding-pipeline.md` frontmatter `code:` 에도 동일 경로 추가
- **기존 사용처**: origin/main 의 spec 에는 해당 파일 경로가 없었음 — 두 spec 이 동시에 신규 등재
- **상세**: `embedding-input-type.ts` 는 `llm` 모듈에 물리적으로 속하지만 `8-embedding-pipeline.md` 도 `code:` 목록에 포함했다. 같은 파일이 두 spec 에 등재되면 어느 spec 이 해당 파일을 소유하는지 모호해진다. 다만 `7-llm-client.md §3.3` 이 SoT 임을 본문에서 명시하고 `8-embedding-pipeline.md §5.4` 가 교차 참조하는 구조이므로 현재 기술 방향은 일관됨.
- **제안**: `embedding-input-type.ts` 를 `7-llm-client.md` 의 `code:` 에만 등재하고, `8-embedding-pipeline.md` frontmatter 에서는 제거 후 본문 교차 참조 링크([LLM 클라이언트 §3.3])만 두면 소유 관계가 명확해진다. INFO 수준 — 현재 동작에 영향 없음.

---

### 3. INFO — `LlmCallOptions` 타입이 spec 에 처음 등장하나 정의 위치가 코드 전용 SoT

- **target 신규 식별자**: `spec/5-system/7-llm-client.md §8.3` 에서 `LlmService.embed` 시그니처에 `opts?: Pick<LlmCallOptions, 'timeoutMs' | 'disableInnerRetry'>` 가 새로 기술됨. 각주에 "코드가 SoT(`llm.service.ts`)" 명시.
- **기존 사용처**: origin/main 의 spec 에는 `LlmCallOptions` 라는 타입명 없음. 코드 파일 `codebase/backend/src/modules/llm/llm.service.ts:43` 에 이미 정의됨.
- **상세**: 기존 spec 내 다른 의미와 충돌하지 않는다. spec 이 타입 정의를 코드 SoT 로 위임하면서도 본문에 파라미터 이름을 직접 기술하므로 코드에서 rename 시 spec 도 함께 갱신해야 하는 묵시적 결합이 생기지만, 이는 기존 `LLMClient` 인터페이스 기술 방식과 동일한 패턴임.
- **제안**: 특별한 조치 불필요. 기존 spec 기술 패턴과 일관됨.

---

## 요약

이번 diff(`spec/5-system/` 3개 파일: `7-llm-client.md`, `8-embedding-pipeline.md`, `17-agent-memory.md`)가 도입하는 신규 식별자는 `inputType`(`'query'|'document'`), `EmbedInputType` 타입, `embedding-input-type.ts` 파일 경로, `§5.4` 섹션 참조, `LlmCallOptions` 타입 참조, `config.taskType`(Gemini API 파라미터) 이다. 이 중 기존 spec 과 의미 충돌이 발생하는 CRITICAL 또는 WARNING 수준 항목은 없다. `input_type` 이라는 문자열은 Cafe24 API 카탈로그에 별도 의미로 존재하지만 영역(시스템 spec vs 외부 API 카탈로그)과 표기(camelCase vs snake_case)가 구분되어 있어 혼동 가능성이 낮다. `embedding-input-type.ts` 의 두 spec 동시 등재는 소유 모호성이 있으나 본문에서 SoT 를 명확히 지시하고 있어 정보성 수준이다.

---

## 위험도

LOW
