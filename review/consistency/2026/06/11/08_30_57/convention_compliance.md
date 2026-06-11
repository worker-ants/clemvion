# 정식 규약 준수 검토 결과

**검토 범위**: V-16/V-17 코드측 문서 문자열 정정 diff (diff-base=origin/main)  
**검토 일시**: 2026-06-11  
**검토 모드**: --impl-done

---

## 발견사항

### [INFO] `@ApiPropertyOptional` description 길이 — swagger.md §3) 권장 범위 경계
- target 위치: `create-knowledge-base.dto.ts` L38-39, `rag-search.dto.ts` L68-70, `update-knowledge-base.dto.ts` L84-85
- 위반 규약: `spec/conventions/swagger.md §3) 주석/설명 톤` — "DTO `description`은 10~40자 내외"
- 상세: 변경된 `description` 문자열들이 규약 권장 길이(10~40자)를 초과한다.  
  - `create-knowledge-base.dto.ts` 의 rerank 모드 description: `'검색 후처리(리랭킹) 모드. `off`(기본) 면 현행 cosine 검색, `cross_encoder` 는 wide 회수 후 cross-encoder 재점수화+동적 컷, `cross_encoder_llm` 은 cross-encoder 후 조건부(conditional escalate) listwise LLM grading. 검색 시점 적용이라 사후 변경 가능.'` — 약 110자.  
  - `rag-search.dto.ts` 의 topK description: `'반환할 최대 유사 청크 개수(inject-cap 상한). 미지정 시 고정 default 가 아니라 token-budget + inject-cap 동적 점수 컷(§3.4)이 최종 주입 수를 결정한다.'` — 약 74자.  
  - `create-knowledge-base.dto.ts` 의 grading LLMConfig description: `'cross_encoder_llm 모드의 조건부 listwise grading LLMConfig. 미지정 시 워크스페이스 default chat.'` — 약 49자.
- 제안: 규약이 "내외"(guidance)로 표현해 hard limit이 아님을 인정하고 있으나, spec §3.3.2 근거 링크 등 기술적으로 필수인 맥락이 포함된 경우다. Swagger UI 에서 개발자 UX 상 필요한 설명이라면 현행 유지 가능. 다만 규약 개정 시 "enum/mode 설명은 예외" 단서 추가를 검토할 것. 즉각 수정을 강제하지 않는다 (INFO 수준).

### [INFO] `rag-search.dto.ts` — `default: 5` 제거 후 JSDoc 주석과 `@ApiPropertyOptional` 정합성
- target 위치: `rag-search.dto.ts` L64-75 (변경 전: `/** 반환할 최대 유사 청크 개수 */`, 변경 후: `/** 반환할 최대 유사 청크 개수 (inject-cap 상한) */`)
- 위반 규약: `spec/conventions/swagger.md §1-1` — "모든 필드에 JSDoc 추가 (한국어)"; CLI 플러그인이 `/** ... */` → `description` 자동 전환
- 상세: `@ApiPropertyOptional({ description: ... })` 가 인라인으로 존재하고 JSDoc `/** ... */` 도 함께 있다. CLI 플러그인 (`introspectComments: true`) 이 JSDoc 을 description 으로 변환하면 인라인 `description:` 과 충돌하거나 중복될 수 있다. 현재 변경은 JSDoc 을 `/** 반환할 최대 유사 청크 개수 (inject-cap 상한) */`로, 인라인 description 을 더 상세한 문장으로 이원화했다.
- 제안: 규약 패턴(§1-1·§1-2)에 따라 JSDoc 을 단일 진실로 유지하거나, `@ApiPropertyOptional({ description: '...' })` 의 인라인이 JSDoc 을 override 함을 코드베이스에서 확인 후 하나를 제거하는 것이 바람직하다. 기능 버그는 아니므로 INFO 수준.

---

## 규약 준수 긍정 확인

다음 항목은 규약을 올바르게 준수하고 있음을 확인:

1. **DTO 파일 명명** — `create-knowledge-base.dto.ts`, `rag-search.dto.ts`, `update-knowledge-base.dto.ts` 모두 `*.dto.ts` 패턴 준수 (`spec/conventions/swagger.md §1`).

2. **`@ApiPropertyOptional` 사용** — optional 필드에 `@ApiPropertyOptional` 적용, `@IsOptional()` 과 조합 (`spec/conventions/swagger.md §1-3`).

3. **`cross_encoder_llm` description stale 문자열 제거** — 기존 "후속 구현" 표현 → "조건부(conditional escalate) listwise LLM grading" 으로 변경. spec `5-system/9-rag-search.md §3.3.2` ("구현됨" 명시)와 정합. stale 문자열이 API 소비자에게 미구현으로 오해하게 할 수 있어 제거가 타당.

4. **`topK` `default: 5` 제거** — spec `5-system/9-rag-search.md §3.4` ("미지정 시 동적 점수 컷이 주입 수 결정, 고정 default 없음") 와 정합. `@ApiPropertyOptional` 의 `default:` 필드가 Swagger UI 에서 사용자에게 잘못된 고정 기본값을 표시할 수 있었으므로 제거가 맞다.

5. **README/byo-ui-headless `firstMessage` 제거** — spec `7-channel-web-chat/1-widget-app.md §R6` ("firstMessage 메커니즘은 폐기", "webhook payload 는 profile 만 싣는다") 와 정합. 코드 예시를 spec 에 맞추는 방향.

6. **`profile` optional 처리** — `byo-ui-headless.ts` 에서 `profile?: Record<string, unknown>` 으로 optional parameter 추가. spec `7-channel-web-chat/1-widget-app.md` 의 "profile 은 선택" 의미와 정합.

7. **금지 항목 미위반** — 변경된 코드에 conventions 명시 금지 패턴(빈 껍데기 스키마, entity 직접 노출 등) 없음.

8. **문서 구조** — 변경 대상은 코드 문서 문자열(DTO Swagger/JSDoc, README, `.ts` 예제 주석)이며 `spec/` 문서 구조 규약(Overview/Rationale 섹션 등)과는 레이어가 다름. spec 변경 없음은 검토 범위 내 정상.

---

## 요약

V-16/V-17 변경 사항은 정식 규약(`spec/conventions/swagger.md`) 의 핵심 요건을 직접 위반하는 항목이 없다. 발견된 두 건은 모두 INFO 수준으로, (1) swagger.md §3 권장 description 길이 초과는 enum/mode 상세 설명이 필요한 기술적 이유가 있어 즉각 수정 의무가 없으며, (2) JSDoc 과 인라인 description 이원화는 기능 버그는 아니나 규약 §1-1·§1-2 단일 진실 패턴과 거리가 있다. stale "후속 구현" 표현 제거, topK `default: 5` 제거, firstMessage 폐기 패턴 반영은 모두 spec 과의 정합 방향으로 올바르게 수정됐다.

---

## 위험도

LOW
