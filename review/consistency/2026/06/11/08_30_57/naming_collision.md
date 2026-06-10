# 신규 식별자 충돌 검토 결과

## 검토 대상

변경 범위: V-16/V-17 코드측 문서 문자열 정정 (KB rerank DTO Swagger + web-chat-sdk README/byo-ui-headless)

- `/codebase/backend/src/modules/knowledge-base/dto/create-knowledge-base.dto.ts`
- `/codebase/backend/src/modules/knowledge-base/dto/update-knowledge-base.dto.ts`
- `/codebase/backend/src/modules/knowledge-base/dto/rag-search.dto.ts`
- `/codebase/packages/web-chat-sdk/README.md`
- `/codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts`

---

## 발견사항

신규 식별자(타입명·API endpoint·이벤트명·환경변수·설정키·파일 경로)가 본 diff 에 도입되지 않는다. 이번 변경은 **순수 문서 문자열(Swagger description, JSDoc, 코드 주석, README 예시) 교정**이다. 아래는 변경된 기술 용어 각각이 기존 정의와 일치하는지 확인한 결과다.

### [INFO] `conditional escalate` 용어 — spec §3.3.2 와 일치, 충돌 없음

- target 신규 식별자: Swagger description 내 `조건부(conditional escalate)` 표현
- 기존 사용처: `/Volumes/project/private/clemvion/spec/5-system/9-rag-search.md` §3.3.2, §3.3 표, §Rationale; `/Volumes/project/private/clemvion/spec/data-flow/6-knowledge-base.md` L202, L283
- 상세: `cross_encoder_llm` 모드를 "후속 구현"에서 "cross-encoder 후 조건부(conditional escalate) listwise LLM grading" 으로 교정. spec §3.3.2 의 정의("상위 점수가 평탄/모호할 때만 escalate")와 정확히 일치한다. 기존 사용처에서 동일 의미로 쓰이므로 충돌 없음.
- 제안: 해당 없음.

### [INFO] `inject-cap` 용어 — spec §3.4 와 일치, 충돌 없음

- target 신규 식별자: `RagSearchDto.topK` Swagger description 내 `inject-cap 상한` 표현
- 기존 사용처: `/Volumes/project/private/clemvion/spec/5-system/9-rag-search.md` L233, L257, L394 등; `/Volumes/project/private/clemvion/spec/1-data-model.md` L355; `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/0-common.md` L45
- 상세: spec §3.4 에서 `inject-cap` 은 "명시 top_k 있으면 그 값, 없으면 `RAG_MAX_INJECT_COUNT`(12) ceiling" 으로 정의된 확립 용어다. DTO description 에 동일 의미로 추가됐으므로 충돌 없음.
- 제안: 해당 없음.

### [INFO] `topK default:5` 제거 — spec §3.4 의 "고정 default 없음" 원칙과 일치

- target 신규 식별자: `RagSearchDto.topK` `@ApiPropertyOptional` 에서 `default: 5` 삭제
- 기존 사용처: `/Volumes/project/private/clemvion/spec/5-system/9-rag-search.md` L91 ("고정 default 없음"), L194 ("D1 이전의 `LIMIT topK(5)` 고정 COUNT 선차단을 … 대체한 것이 핵심 변경")
- 상세: spec 는 `top_k` 의 고정 default 를 명시적으로 폐기했다. `default: 5` 가 Swagger 에 남아 있던 것이 stale 이며 제거가 정확하다. 충돌 없음.
- 제안: 해당 없음.

### [INFO] `profile` 파라미터 — spec §R6 및 2-sdk.md 와 일치, 충돌 없음

- target 신규 식별자: `startHeadlessChat` 함수 서명에서 `firstMessage: string` 제거 → `profile?: Record<string, unknown>` 추가
- 기존 사용처: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/2-sdk.md` L107 (`profile?: Record<string, unknown>`); `/Volumes/project/private/clemvion/spec/7-channel-web-chat/1-widget-app.md` L69; `/Volumes/project/private/clemvion/spec/7-channel-web-chat/3-auth-session.md` L40
- 상세: spec `2-sdk.md` 의 `ClemvionWidgetOptions` 에 이미 동일 타입 `profile?: Record<string, unknown>` 이 정의돼 있다. `startHeadlessChat` 의 parameter 추가도 spec 의 패턴과 완전히 일치한다. 충돌 없음.
- 제안: 해당 없음.

### [INFO] `firstMessage` 폐기 — spec §R6 와 일치, 충돌 없음

- target 신규 식별자: `firstMessage` 파라미터 제거 + "폐기됐다(1-widget-app §R6)" 주석
- 기존 사용처: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/1-widget-app.md` §R6 L127~138 (`firstMessage` 폐기 근거 상세 기술); L33 ("`firstMessage` payload 미사용")
- 상세: spec 는 이미 `firstMessage` 메커니즘 폐기를 §R6 에 명시했다. 코드 주석이 spec 의 §R6 를 정확히 인용하고 있어 충돌 없음.
- 제안: 해당 없음.

### [INFO] `submit_message` 커맨드 — spec 기존 정의와 일치, 충돌 없음

- target 신규 식별자: README/byo-ui-headless 예시 주석 내 `submit_message` 로 첫 사용자 텍스트 전송 설명
- 기존 사용처: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/1-widget-app.md` L31, L42, L46; `/Volumes/project/private/clemvion/spec/7-channel-web-chat/0-architecture.md` L69; `/Volumes/project/private/clemvion/spec/7-channel-web-chat/3-auth-session.md` L46
- 상세: `submit_message` 는 EIA interact 커맨드로 spec 전반에 걸쳐 확립된 이름이다. 새 주석에서 이 커맨드를 참조하는 것은 기존 정의와 완전히 일치한다.
- 제안: 해당 없음.

---

## 요약

이번 diff 는 Swagger description, JSDoc, README 예시 코드 주석을 spec 에 맞게 정정하는 순수 문서 교정이다. 신규 타입명·DTO·인터페이스·API endpoint·이벤트명·환경변수·설정키·파일 경로가 도입되지 않는다. 변경된 모든 기술 용어(`conditional escalate`, `inject-cap`, `profile`, `submit_message`, `firstMessage` 폐기 표현)는 각각 `spec/5-system/9-rag-search.md`, `spec/7-channel-web-chat/1-widget-app.md`, `spec/7-channel-web-chat/2-sdk.md` 에 이미 확립된 정의와 충돌 없이 일치한다. 식별자 충돌 위험이 없다.

---

## 위험도

NONE
