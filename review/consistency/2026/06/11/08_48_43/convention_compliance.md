# 정식 규약 준수 검토 결과

검토 범위: `V-16/V-17 + ai-review fix` — `create-knowledge-base.dto.ts`, `update-knowledge-base.dto.ts`, `rag-search.dto.ts`, `web-chat-sdk/README.md`, `web-chat-sdk/examples/byo-ui-headless.ts` (diff-base: origin/main)

적용 규약 출처: `spec/conventions/swagger.md`

---

## 발견사항

### [INFO] create-knowledge-base.dto.ts rerankMode description 길이 초과
- target 위치: `create-knowledge-base.dto.ts` L154 — `@ApiPropertyOptional description` (rerankMode 필드)
- 위반 규약: `spec/conventions/swagger.md §3) 주석/설명 톤` — "DTO `description`은 10~40자 내외"
- 상세: 현재 값은 201자. `off`/`cross_encoder`/`cross_encoder_llm` 세 enum 의 동작을 한 문장에 담아 길어졌다. 규약은 "내외(approximately)" 표현이라 hard limit 은 아니나, enum 설명은 관례상 `enum` 배열 메타로 분리하고 description 은 역할 요약 1~2문장에 그친다.
- 제안: description 을 "검색 후처리(리랭킹) 모드. off(기본)·cross_encoder·cross_encoder_llm 중 선택, 각 모드 동작은 enum 값 자체로 전달." 수준으로 단축하고, 세부 동작 설명은 JSDoc 주석(/** ... */)에 유지하면 convention 내에서 충분히 표현 가능하다. (이미 JSDoc `/** 리랭킹 모드 */`가 별도로 있으므로 JSDoc 에 상세 서술 이전이 자연스럽다.)

---

### [INFO] rag-search.dto.ts topK description 길이
- target 위치: `rag-search.dto.ts` L38 — `@ApiPropertyOptional description` (topK 필드)
- 위반 규약: `spec/conventions/swagger.md §3)` — DTO description 10~40자 내외
- 상세: 현재 값 104자. `inject-cap 상한` + `token-budget 동적 점수 컷` 행동을 설명하는 유효한 내용이나, 두 개념이 혼재해 규약 기준 1.5~2.5배 수준이다.
- 제안: "반환할 최대 유사 청크 개수(inject-cap 상한). 미지정 시 token-budget 동적 컷이 최종 주입 수를 결정." 정도로 단축 가능. 규약 soft limit 이므로 내용상 필요하면 유지 가능하나 §3 취지에 맞게 간결화를 권장한다.

---

## 긍정적 준수 사항

1. **JSDoc 추가** — `UpdateKnowledgeBaseDto` 의 rerankMode·rerankConfigId·rerankCandidateK·rerankScoreThreshold·rerankLlmConfigId 5개 필드에 JSDoc 주석이 추가됐다. `spec/conventions/swagger.md §1-1` "모든 필드에 JSDoc 추가(한국어)" 요건 충족.

2. **`ws` 약어 제거** — `update-knowledge-base.dto.ts` 의 기존 `ws default chat` 표현이 `워크스페이스 default chat` 으로 정정됐다. 일관된 한국어 용어 사용 원칙 준수.

3. **`@IsInt()` 적용** — `topK` 필드의 `@IsNumber()` → `@IsInt()` 정정. 정수 제약을 검증기 수준에서 정확히 표현하는 spec 정합 방향 수정으로, 규약 위반이 아닌 오히려 spec 정합 개선.

4. **`(후속 구현)` 스텁 문구 제거** — `create-knowledge-base.dto.ts` 및 `update-knowledge-base.dto.ts` 의 `(후속 구현)` 임시 주석이 제거되고 현재 구현된 동작 설명으로 대체됐다. Swagger 문서 품질 향상, 규약 준수.

5. **`web-chat-sdk/README.md` + `byo-ui-headless.ts`** — `firstMessage` 폐기 패턴 제거 후 `profile` 기반 webhook, `submit_message` 경로로 정정. 코드 예제의 spec 정합 방향 수정. 명명·출력 포맷 규약 위반 없음.

6. **문서 구조 규약** — 변경된 파일 중 spec 파일(`spec/` 경로)은 없으며, 코드측 DTO·README 한정이라 Overview/Rationale 3섹션 규약 적용 대상이 아니다.

---

## 요약

본 변경은 DTO JSDoc 보강, `@IsInt()` 정확화, `ws` 약어 → `워크스페이스` 전환, 스텁 문구 제거, web-chat-sdk 예제 정정으로 구성된 코드측 문서/검증 정정이다. `spec/conventions/swagger.md` 의 핵심 요건(JSDoc 필수, 한국어 설명, `@ApiPropertyOptional` 패턴)을 전반적으로 준수한다. 다만 `create-knowledge-base.dto.ts` 의 `rerankMode` description(201자)과 `rag-search.dto.ts` 의 `topK` description(104자)이 §3 권장 범위(10~40자)를 초과하며, 두 건 모두 INFO 등급 — 채택 차단 이유는 없고 향후 간결화 권장 사항이다.

---

## 위험도

LOW
