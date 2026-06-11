# Cross-Spec 일관성 검토 결과

검토 범위: V-16/V-17 + ai-review fix (topK @IsInt, Update DTO JSDoc, Swagger §3.4 제거, ws→워크스페이스)
diff-base: origin/main

---

## 발견사항

### [INFO] topK @IsInt 변경 — spec top_k "integer" 정의와 정합

- target 위치: `codebase/backend/src/modules/knowledge-base/dto/rag-search.dto.ts` — `@IsInt()` 적용, `@IsNumber()` 제거
- 충돌 대상: `spec/5-system/9-rag-search.md` §2.1 KB tool 정의 `"top_k": { "type": "integer", ... }`
- 상세: spec 은 `top_k` 를 `"type": "integer"` 로 명시한다. 기존 코드의 `@IsNumber()` 는 부동소수점 입력도 허용하는 느슨한 검증이었다. `@IsInt()` 로 교체하면 spec 의 integer 제약과 일치한다. 충돌이 아니라 spec 방향으로 정정된 케이스다.
- 제안: 정합 완료. 추가 조치 불필요.

### [INFO] topK `default: 5` 제거 — spec "고정 default 없음" 정책과 정합

- target 위치: `rag-search.dto.ts` `@ApiPropertyOptional` — `default: 5` 행 제거
- 충돌 대상: `spec/5-system/9-rag-search.md` §3.4 Rationale "왜 `ragTopK` 기본값(5)을 제거했나" + §2.1 "미지정 시 §3.4 동적 점수 컷이 주입 청크 수를 결정 (고정 default 없음)"
- 상세: spec 은 D1 동적 컷 도입으로 고정 기본값 개념 자체를 폐기했다. Swagger 문서에 `default: 5` 가 남아 있으면 소비자가 "미지정 시 5개 주입" 으로 오해할 수 있다. 제거는 spec 정합 방향이다.
- 제안: 정합 완료. 추가 조치 불필요.

### [INFO] topK JSDoc "inject-cap 상한" 표현 — spec §3.4 용어와 일치

- target 위치: `rag-search.dto.ts` JSDoc/description — "inject-cap 상한" 추가
- 충돌 대상: `spec/5-system/9-rag-search.md` §3.4 §3.3 내 `inject-cap` 용어
- 상세: spec 이 사용하는 `inject-cap` 개념(명시 top_k → 상한 override, 미지정 → RAG_MAX_INJECT_COUNT ceiling)을 DTO 설명에 반영한 것이다. 타 spec 영역에서 `topK` 를 "반환할 최대 청크 수" 의 고정 컷으로 기술하는 곳은 없다. 일관하다.
- 제안: 정합 완료.

### [INFO] cross_encoder_llm 설명 "조건부(conditional escalate) listwise LLM grading" — spec §3.3.2 와 정합

- target 위치: `create-knowledge-base.dto.ts` + `update-knowledge-base.dto.ts` — `cross_encoder_llm` Swagger description 갱신
- 충돌 대상: `spec/5-system/9-rag-search.md` §3.3 테이블 `cross_encoder_llm` 행 "cross_encoder 후 조건부(conditional escalate) listwise LLM grading 1콜 — cross-encoder 상위 점수가 평탄/모호할 때만 escalate"
- 상세: 기존 코드 문서의 "후속 구현" 문구는 spec 이 해당 모드를 이미 구현 완료로 표시한 상태(§3.3 "두 모드 모두 구현됨", §2.16.1 RerankConfig "구현됨")와 모순이었다. 변경 후 설명은 spec 과 동일 의미를 코드에 복제한다. 충돌 없음.
- 제안: 정합 완료.

### [INFO] rerank_llm_config_id description "후속 구현" 문구 제거 — 데이터 모델 spec 과 정합

- target 위치: `create-knowledge-base.dto.ts` + `update-knowledge-base.dto.ts` — `rerankLlmConfigId` description 에서 "(후속 구현)" 제거
- 충돌 대상: `spec/1-data-model.md` §2.11 KnowledgeBase `rerank_llm_config_id` — "(V082)" 마이그레이션 완료 표기; §2.16.1 RerankConfig "구현 상태: 엔티티 + cross_encoder · cross_encoder_llm 두 모드 모두 구현됨"
- 상세: 데이터 모델 spec 은 이 필드가 V082 에서 이미 구현됐음을 명시한다. "후속 구현" 문구를 남겨두는 것이 spec 과 모순이었으며, 제거가 올바르다.
- 제안: 정합 완료.

### [INFO] ws→워크스페이스 표기 통일 — 코드 문서 내부 일관성 개선, spec 충돌 없음

- target 위치: `update-knowledge-base.dto.ts` `cross_encoder_llm grading LLMConfig` description — "ws default chat" → "워크스페이스 default chat"
- 충돌 대상: spec 문서들은 "ws" 약어를 (`spec/data-flow/7-llm-usage.md`, `spec/data-flow/6-knowledge-base.md` 등) 비형식 약어로 사용한다. `spec/5-system/9-rag-search.md` 는 "워크스페이스" 전체 표기를 사용한다.
- 상세: spec 에 "ws" 약어 전용 정의는 없다. 코드 문서에서 "워크스페이스" 전체 표기로 전환하는 것은 spec 의 정식 용어와 더 가깝다. 기존 spec 과의 직접 충돌은 아니며, 코드 내부 가독성 개선이다.
- 제안: 정합 방향. spec 내 "ws default" 표기가 다수 존재하나 코드 공개 문서(Swagger) 는 전체 표기가 타당하다. 추가 조치 불필요.

### [INFO] web-chat-sdk README `firstMessage` 제거·`profile` 전환 — spec 1-widget-app §R6 와 정합

- target 위치: `codebase/packages/web-chat-sdk/README.md` + `examples/byo-ui-headless.ts` — `firstMessage` → `profile` 전환, `submit_message` 명시
- 충돌 대상: `spec/7-channel-web-chat/1-widget-app.md` §R6 "firstMessage 유실" 결정 + 동 문서 §3.1 "firstMessage 미사용: webhook payload 는 profile 만 싣는다"; `spec/7-channel-web-chat/2-sdk.md` §4 BootConfig `profile?: Record<string, unknown>`
- 상세: spec 1-widget-app §R6 는 `firstMessage` 메커니즘이 AI Agent `multi_turn` 설계상 증발함을 명시하고 폐기했다. SDK 코드 예시는 이미 `firstMessage` 전제로 작성돼 spec 과 모순이었다. 변경 후 예시는 spec 에서 요구하는 `profile` payload + `submit_message` 흐름과 일치한다. `spec/5-system/14-external-interaction-api.md` 의 BYO-UI/headless 관련 언급과도 모순 없다.
- 제안: 정합 완료.

### [INFO] `startHeadlessChat` 시그니처 변경 (`firstMessage: string` → `profile?: Record<string, unknown>`) — spec SDK 공개 계약과 정합

- target 위치: `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts` 함수 시그니처
- 충돌 대상: `spec/7-channel-web-chat/2-sdk.md` §4 BootConfig 스키마 — `profile?: Record<string, unknown>` 포함, `firstMessage` 없음
- 상세: spec 의 BootConfig 에는 `firstMessage` 필드가 존재하지 않는다. `profile` 은 선택 필드로 정의된다. 함수 시그니처를 spec 과 정합시켰다. 파라미터 순서 변경(`firstMessage` 제거 → `profile?` 추가)은 breaking change 이나 이는 **example 파일**(`examples/` 하위)이므로 공개 npm API 계약에 직접 영향은 없다. 실제 공개 인스턴스 타입(`ChatInstance`) 에는 `startHeadlessChat` 가 포함되지 않는다.
- 제안: 정합 완료. 단, `byo-ui-headless.ts` 를 외부 문서·README 에서 직접 참조하는 경우 호출자가 함수 시그니처를 갱신해야 함을 인지해야 한다(spec 선행 변경이 이미 결정된 사항).

---

## 요약

이번 변경 세트(V-16/V-17 + ai-review fix)는 전적으로 코드측 문서·검증 로직을 spec 방향으로 정정하는 작업이다. 구체적으로 RAG 검색 DTO 의 `topK` 검증자를 spec 정의(integer)에 맞추고, 이미 구현 완료된 `cross_encoder_llm` 모드에서 "후속 구현" 잔재 문구를 제거하며, web-chat SDK 예시에서 폐기된 `firstMessage` 메커니즘을 spec §R6 결정에 맞게 `profile` + `submit_message` 흐름으로 교체했다. 검토한 모든 항목에서 spec 과의 직접 모순은 없으며, 기존에 spec 과 어긋났던 코드 문서를 spec 쪽으로 수렴시킨 것이다. 데이터 모델, API 계약, 상태 전이, RBAC, 계층 책임 어느 관점에서도 Cross-Spec 충돌이 발견되지 않았다.

## 위험도

NONE

STATUS: OK
