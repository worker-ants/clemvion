# 요구사항(Requirement) 리뷰 결과

## 발견사항

### 파일 1·3: create-knowledge-base.dto.ts / update-knowledge-base.dto.ts — `cross_encoder_llm` 설명 갱신

- **[INFO]** 변경 의도와 구현 완전 일치
  - 위치: `create-knowledge-base.dto.ts` L153-155(rerankMode description), L198-200(rerankLlmConfigId description); `update-knowledge-base.dto.ts` L173
  - 상세: 구 문자열 `"후속 구현"` 제거 및 `conditional escalate` 동작 명시. spec `5-system/9-rag-search.md §3.3.1` 모드 표에서 `cross_encoder_llm` 는 `"조건부(conditional escalate) listwise LLM grading 1콜"` 로 정의됐고, `§3.3.2` 주석도 "두 모드 모두 구현됨"을 명시한다. 코드 변경 후 Swagger 설명이 spec 본문과 정확히 일치한다.
  - 제안: 없음 (정정 완료).

- **[INFO] [SPEC-DRIFT]** `rerankLlmConfigId` JSDoc 주석 업데이트 — spec 본문 미갱신
  - 위치: `create-knowledge-base.dto.ts` L254 (JSDoc comment), `update-knowledge-base.dto.ts` (해당 필드 JSDoc 없음)
  - 상세: `create-knowledge-base.dto.ts` L254 의 JSDoc 이 이번 변경으로 `"cross_encoder_llm grading LLMConfig (후속)"` → `"cross_encoder_llm grading LLMConfig"` 로 정정됐다. spec `5-system/9-rag-search.md §3.3` 의 `rerank` 서브필드 정의표에는 `rerank_llm_config_id` 항목이 없고, `2-navigation/5-knowledge-base.md §2.2 리랭킹` 열에서도 `"Grading LLM (Cross-encoder + LLM 시)"` 라고 UI 라벨만 존재한다. spec 이 API 필드 명칭·설명을 직접 표기하지 않으므로 엄밀한 drift 는 아니지만, 두 DTO 간 JSDoc 일관성(update DTO 는 JSDoc 없음)은 INFO 수준.
  - 제안: 코드 유지. `spec/5-system/9-rag-search.md §3.3` 또는 `spec/2-navigation/5-knowledge-base.md §2.2` 에 `rerankLlmConfigId` API 필드명·설명을 추가하면 완결(spec-coverage 갱신 권장).

---

### 파일 2: rag-search.dto.ts — `topK` default 제거 및 설명 갱신

- **[INFO]** 변경 의도와 구현 완전 일치
  - 위치: `rag-search.dto.ts` L35-44
  - 상세: `@ApiPropertyOptional` 에서 `default: 5` 제거, 설명을 "inject-cap 상한 + 미지정 시 동적 점수 컷(§3.4)" 으로 교체. spec `5-system/9-rag-search.md §3.4` Rationale "왜 `ragTopK` 기본값(5)을 제거했나"와 §2.1 `top_k` 설명 "미지정 시 §3.4 동적 점수 컷이 주입 청크 수를 결정"과 정확히 일치한다.
  - 제안: 없음.

- **[WARNING]** `topK` 필드에 `@IsInt()` 대신 `@IsNumber()` 사용 — spec 과 타입 불일치
  - 위치: `rag-search.dto.ts` L342-344 (`@IsNumber() @Min(1) @Max(50)`)
  - 상세: spec `5-system/9-rag-search.md §2.1` KB tool 파라미터 정의에서 `top_k` 는 `"type": "integer"` 다. 현재 `@IsNumber()` 는 소수점(float)도 허용한다. `@ApiPropertyOptional` 에는 `minimum`/`maximum` 정수 bounds 가 설정됐으나 validator 는 정수 강제를 하지 않는다. 이 변경 자체가 이 문제를 도입하지는 않았으나(기존 코드의 잠재 문제), 이번 변경이 해당 필드 설명을 수정하면서 검토 대상이 됐다.
  - 제안: `@IsNumber()` → `@IsInt()` 교체 검토 (`import { IsInt }` 추가 필요). spec §2.1 `"type": "integer"` 와 일치시킨다.

---

### 파일 4: web-chat-sdk/README.md — `firstMessage` 폐기 패턴 교체

- **[INFO]** 변경 의도와 구현 완전 일치
  - 위치: `README.md` L591-602
  - 상세: `triggerWebhook(endpointPath, { firstMessage })` → `triggerWebhook(endpointPath, { profile })` 교체, `submit_message` 가 모든 입력의 경로임을 주석으로 명시. spec `7-channel-web-chat/1-widget-app.md §3 "firstMessage 미사용"` 및 `§R6` 의 폐기 결정과 정확히 일치한다.
  - 제안: 없음.

- **[INFO] [SPEC-DRIFT]** README 의 BYO-UI 섹션 설명이 spec `2-sdk.md §2` 보다 상세함
  - 위치: `README.md` L666-691
  - 상세: README 가 `firstMessage` 폐기 이유(multi_turn 의 webhook 첫 턴 미소비), `submit_message` 우선 원칙, 토큰 갱신 패턴을 상세 주석으로 추가했다. `spec/7-channel-web-chat/2-sdk.md §2` 의 M2 BYO-UI 설명은 이 세부 내용 없이 `"@workflow/sdk 직접 사용"` 수준. 코드 문서가 spec보다 더 정확하고 풍부하다 — spec 이 낡은 경우.
  - 제안: 코드 유지. `spec/7-channel-web-chat/2-sdk.md §2` 에 BYO-UI 예제 흐름(webhook profile-only → submit_message 첫 텍스트, firstMessage 폐기 이유) 설명 보강 권장.

---

### 파일 5: byo-ui-headless.ts — 함수 시그니처 변경

- **[INFO]** 변경 의도와 구현 완전 일치
  - 위치: `examples/byo-ui-headless.ts` L715-737
  - 상세: `firstMessage: string` 파라미터 제거, `profile?: Record<string, unknown>` 추가, `triggerWebhook` 호출에서 `profile ? { profile } : {}` 사용. spec `1-widget-app.md §3 "firstMessage 미사용"` + `§R6` 전환 결정과 일치.
  - 제안: 없음.

- **[WARNING]** `startHeadlessChat` 시그니처 변경이 기존 호출자와 브레이킹 변경
  - 위치: `examples/byo-ui-headless.ts` L779-787
  - 상세: `firstMessage: string` (필수 2번째 인자) 제거 후 `profile?: Record<string, unknown>` (선택 4번째 인자)로 변경됐다. 파라미터 순서도 변경됨(`handlers` 가 3번째, `profile` 이 4번째). 예제 파일이지만 README 에서 `startHeadlessChat 헬퍼` 로 참조되며 실제 사용자가 복사·재사용할 가능성이 있다. 변경 자체는 spec-correct 이나, 기존 호출자가 있다면 컴파일 오류 없이 런타임에 `firstMessage` 값이 `handlers` 로 전달될 수 있다.
  - 제안: 예제 파일이므로 심각도는 낮으나, JSDoc 또는 파일 상단 주석에 `"Breaking: firstMessage 파라미터 제거됨 (§R6)"` 을 명시하면 사용자 혼란을 방지할 수 있다. 현재 JSDoc 에 이미 변경 이유가 설명돼 있어 실질적 위험은 LOW.

- **[INFO]** `onError` 핸들러 경로에서 `close()` 미호출
  - 위치: `examples/byo-ui-headless.ts` L820
  - 상세: SSE `onError` 시 `handlers.onError?.(err)` 만 호출하고 `sub.close()` 를 호출하지 않는다. 이는 이번 변경이 도입한 문제가 아니나(기존 코드), 에러 후 SSE 연결이 계속 열려있을 수 있다. 예제 파일이므로 INFO.
  - 제안: 교육용 예제라면 `onError: (err) => { handlers.onError?.(err); sub.close(); }` 패턴을 추가하면 더 정확한 예시가 된다.

---

### 파일 6: plan/in-progress/spec-code-cross-audit-2026-06-10.md

- **[INFO]** 체크리스트 갱신이 실제 변경 내용과 일치
  - 위치: plan 파일 L856-857
  - 상세: `"V-06·V-08 — PR #530"` 으로 PR 번호 구체화 및 `"V-16·V-17 — rag-webchat-doc-strings 브랜치(본 PR)"` 항목 추가. 변경된 4개 파일의 목적(KB DTO Swagger stale 정정 + web-chat-sdk firstMessage 폐기 패턴 교체)이 정확히 기술됐다.
  - 제안: 없음.

---

## 요약

본 변경은 audit V-16(KB DTO Swagger `cross_encoder_llm 후속 구현` stale)과 V-17(web-chat-sdk README·byo-ui-headless 예제의 `firstMessage` 폐기 패턴)을 코드 측 문서 문자열 정정으로 해소한다. 6개 파일 모두 의도한 기능을 완전히 구현하고 있으며, spec `5-system/9-rag-search.md §3.3`, `7-channel-web-chat/1-widget-app.md §R6`, `7-channel-web-chat/2-sdk.md §2` 와 line-level 로 일치한다. `"후속 구현"` 표현 제거·`firstMessage` 삭제·`profile`-only webhook 패턴 모두 spec 요구사항을 충족한다. 주요 주의사항은 두 가지다: (1) `rag-search.dto.ts` 의 `topK` 필드가 `@IsNumber()` 를 사용하나 spec 은 integer 타입을 지정하므로 `@IsInt()` 로 교체가 권장되고, (2) `startHeadlessChat` 시그니처 변경은 spec-correct 이지만 기존 호출자에게 브레이킹 변경이다. 두 건 모두 이번 diff 가 도입한 신규 버그가 아닌 기존 코드 또는 의도적 API 변경이며 전체적으로 위험도는 LOW.

## 위험도

LOW
