# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토)
검토 범위: V-16/V-17 — KB rerank DTO Swagger 문서 문자열 정정 + web-chat-sdk README / byo-ui-headless `firstMessage` 폐기 패턴 정정
diff-base: `origin/main`

---

## 발견사항

### 데이터 모델·API 계약 충돌

**[INFO]** `RagSearchDto.topK` Swagger `default:5` 제거 — spec §3.4 와 완전 정합
- target 위치: `codebase/backend/src/modules/knowledge-base/dto/rag-search.dto.ts` — `@ApiPropertyOptional({ default: 5 })` 제거
- 충돌 대상: `spec/5-system/9-rag-search.md §2.1`, §3.4
- 상세: spec §2.1 의 KB tool 정의는 "`top_k` 미지정 시 §3.4 동적 token-budget 컷이 주입 수를 결정한다 (고정 default 없음)"고 명시한다. `@ApiPropertyOptional({ default: 5 })` 제거는 이 정책을 Swagger 문서에 반영하는 것으로 충돌이 아니라 spec 과의 정합 수정이다. 변경 후 description 에 "미지정 시 고정 default 가 아니라 token-budget + inject-cap 동적 점수 컷(§3.4)이 최종 주입 수를 결정한다"는 설명이 추가되어 spec §3.4 와 일치한다.
- 제안: 변경 내용 유지. 다른 spec 영역과 모순 없음.

**[INFO]** `CreateKnowledgeBaseDto.rerankMode` Swagger — `cross_encoder_llm` 설명 정정
- target 위치: `codebase/backend/src/modules/knowledge-base/dto/create-knowledge-base.dto.ts` line 40
- 충돌 대상: `spec/5-system/9-rag-search.md §3.3.1`, §3.3.2, `spec/1-data-model.md §2.16.1`
- 상세: 구 설명 "`cross_encoder_llm` 은 추가 LLM grading(후속 구현)"을 "conditional escalate listwise LLM grading"으로 수정한다. spec §3.3.1 표는 "`cross_encoder_llm` — `cross_encoder` 후 조건부(conditional escalate) listwise LLM grading 1콜"이라 명시하고, §3.3.2 注記는 "두 모드 모두 구현됨"을 확정했다. DTO comment 의 "후속 구현" stale 주석 제거는 spec 과의 정합 수정이며 cross-spec 충돌 없음.
- 제안: 변경 내용 유지.

**[INFO]** `CreateKnowledgeBaseDto.rerankLlmConfigId` / `UpdateKnowledgeBaseDto.rerankLlmConfigId` Swagger — "(후속 구현)" 문구 제거
- target 위치: 두 DTO 파일의 `rerankLlmConfigId` `@ApiPropertyOptional.description`
- 충돌 대상: `spec/1-data-model.md §2.11 rerank_llm_config_id`, `spec/5-system/9-rag-search.md §3.3.2`
- 상세: `spec/1-data-model.md §2.11` 은 `rerank_llm_config_id`를 `cross_encoder_llm` 모드의 grading LLM 로 정의하며 구현 완료 상태다. "(후속 구현)" 제거 후 description 은 "조건부 listwise grading LLMConfig"로 정정되어 spec 과 일치한다.
- 제안: 변경 내용 유지.

### API 계약 충돌

**[INFO]** `web-chat-sdk/README.md` BYO-UI 예제 — `firstMessage` → `profile` 단독 패턴으로 변경
- target 위치: `codebase/packages/web-chat-sdk/README.md` lines 99–103, 111
- 충돌 대상: `spec/7-channel-web-chat/1-widget-app.md §3 ("firstMessage 미사용")`, `§R6`
- 상세: spec §3 은 "webhook payload 는 `profile` 만 싣는다. 첫 사용자 텍스트도 일반 `submit_message` 로 전송"을 명시하고, §R6 은 `firstMessage` 메커니즘 폐기 근거를 상세히 설명한다. README 의 구 예시 `{ firstMessage }` → `{ profile }` + submit_message 설명 추가는 spec 과의 정합 수정이다. cross-spec 충돌 없음.
- 제안: 변경 내용 유지.

**[INFO]** `byo-ui-headless.ts` — `firstMessage` 파라미터 제거, `profile?` 파라미터 추가
- target 위치: `codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts` — `startHeadlessChat` 시그니처 변경
- 충돌 대상: `spec/7-channel-web-chat/1-widget-app.md §3 ("firstMessage 미사용")`, `spec/7-channel-web-chat/2-sdk.md §4 (BootConfig profile)`
- 상세: spec §3 은 `firstMessage` 폐기를 확정하고 webhook payload 는 `profile` 단독으로 명시한다. `byo-ui-headless.ts` 의 `firstMessage: string` 파라미터 제거 및 `profile?: Record<string, unknown>` 교체는 spec 패턴과 일치한다. `2-sdk.md §4 BootConfig` 의 `profile?: Record<string, unknown>` 타입과도 일관된다.
- 제안: 변경 내용 유지.

---

## 요약

이번 변경(V-16/V-17)은 모두 **코드 측 문서 문자열을 기존 spec 에 맞추는 정합 수정**이다. KB rerank DTO 의 `cross_encoder_llm` 설명(stale "후속 구현" 문구 제거 → "conditional escalate") 및 `topK default:5` 제거는 `spec/5-system/9-rag-search.md §3.3.1–§3.4` 의 확정된 동작과 일치하며, web-chat-sdk README 및 `byo-ui-headless.ts` 의 `firstMessage` 폐기 패턴은 `spec/7-channel-web-chat/1-widget-app.md §R6` 의 정책을 코드에 반영한 것이다. 데이터 모델 충돌, API 계약 충돌, 요구사항 ID 충돌, 상태 전이 충돌, RBAC 충돌, 계층 책임 충돌은 모두 없다. 이 변경이 오히려 기존 spec 과의 불일치를 해소한다.

---

## 위험도

NONE
