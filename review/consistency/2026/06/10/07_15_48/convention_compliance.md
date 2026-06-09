# 정식 규약 준수 검토 결과

검토 모드: 구현 완료 후 (--impl-done)  
대상 범위: `spec/5-system/9-rag-search.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/5-system/8-embedding-pipeline.md`  
diff-base: origin/main

---

## 발견사항

### [INFO] tool_result 판별 키 표기 규약의 self-documentation 위치

- target 위치: `spec/5-system/9-rag-search.md` §2.2 callout block ("표기 규약")
- 위반 규약: `spec/conventions/node-output.md` §3.2 — `code` 는 `UPPER_SNAKE_CASE`; `spec/conventions/error-codes.md` §1·§3 — 에러 코드 명명 및 historical-artifact 레지스트리
- 상세: `not_searchable`, `reembedding_required`, `reembedding_in_progress`, `search_failed`, `none` 은 **tool_result content 문자열(LLM 컨텍스트용)** 이라 `UPPER_SNAKE_CASE` 규약이 적용되지 않는다. spec 본문도 이를 "다른 레이어" 로 정확히 설명하며 규약 위반이 아님을 인라인 주석으로 적절히 명시했다. 다만 이 레이어 구분 근거를 `spec/conventions/node-output.md` 나 `spec/conventions/error-codes.md` 에 각주/확장으로 등재한 공식 기록은 없다. spec 내 인라인 callout 으로만 정당화되어 있어, 향후 다른 문서에서 동일 패턴을 채택할 때 선례 출처가 불분명해질 수 있다.
- 제안: 현재 구현은 규약 위반이 아니다. 단, `spec/conventions/node-output.md` §3.2 또는 별도 callout 에 "tool_result content 문자열(LLM 컨텍스트 전달용)은 `UPPER_SNAKE_CASE` 대상이 아님" 항목을 한 줄 추가해 레이어 구분을 공식화하면 선례 포인터가 생긴다. 이번 리뷰에서 차단 필요 없음.

---

### [INFO] `skipReason` 값의 표기 규약 명시 위치

- target 위치: `spec/5-system/9-rag-search.md` §4.2 — `skipReason` 필드 정의 표
- 위반 규약: `spec/conventions/node-output.md` §3.2 `code` 는 `UPPER_SNAKE_CASE`; `spec/conventions/error-codes.md` §1
- 상세: `skipReason` 값(`empty_kb_list`, `kb_unsearchable`, `no_results`)은 `lower_snake_case` 다. `spec/5-system/11-mcp-client.md §6.2` 의 `skipReason` vocabulary 도 동일하게 `lower_snake_case` 를 쓰며, 해당 문서는 "에러 코드가 아닌 운영 진단용 enum" 으로 명명 규칙 분리를 명시하고 있다. `rag-search.md` §4.2 의 `skipReason` 도 동일 진단 성격이나, `mcp-client.md §6.2` 처럼 명시적인 규약 분리 근거 주석이 없다.
- 제안: `spec/5-system/9-rag-search.md` §4.2 에 `mcp-client.md §6.2` 의 선례를 인용하거나 "진단 enum — `lower_snake_case`, 에러 코드(`UPPER_SNAKE_CASE`)와 별개 레이어" 한 줄 주석을 추가하면 향후 검토자가 이를 규약 위반으로 오인하지 않는다. 이번 리뷰에서 차단 필요 없음.

---

### [INFO] `spec/2-navigation/5-knowledge-base.md` §2.2.1 `reembedStatus` 필드명 표기

- target 위치: `spec/2-navigation/5-knowledge-base.md` §2.2.1 — "응답 DTO 의 camelCase 필드 — DB `reembed_status` 매핑"
- 위반 규약: 규약 직접 위반 없음; `spec/conventions/swagger.md` §5-1 "응답 DTO 위치: `dto/responses/*-response.dto.ts`"
- 상세: spec 본문이 응답 DTO 의 camelCase 필드 이름(`reembedStatus`)을 직접 명시하고 DB 컬럼명(`reembed_status`)과의 매핑을 설명한다. swagger.md §5-1 은 DTO 파일 위치만 규정하며 필드 명명 패턴(camelCase)은 NestJS 관행이라 위반 아님. 표기 일관성 측면에서 spec 내 DB 컬럼명(`reembed_status`)과 DTO 필드명(`reembedStatus`)을 혼용하는 부분이 명확히 구분되어 있는지 확인 권장.
- 제안: 현재 기술 방식은 충분히 명확하다. 별도 조치 불필요.

---

### [INFO] `spec/5-system/8-embedding-pipeline.md` §7.3 — 문서 구조

- target 위치: `spec/5-system/8-embedding-pipeline.md` §7.3 (변경된 단락)
- 위반 규약: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
- 상세: §7.3 의 신규 단락(검색 불가 신호화 관련)은 본문에 사실 기술("제외는 silent 가 아니라 명시 신호로 전달")을 포함하나 그 결정 근거("왜 silent 에서 명시 신호로 바꿨나")는 `9-rag-search.md` 의 `## Rationale` 에 위치하며 cross-ref 를 달고 있다. 두 spec 에 걸친 Rationale 분산이 발생했으나, 근거가 "검색 엔진(9-rag-search)" 의 설계 결정이지 "임베딩 파이프라인(8-embedding)" 의 결정이 아니므로 `9-rag-search.md Rationale` 단일 귀속이 맞다. 현재 cross-ref 형태는 적절하다.
- 제안: 현재 구조 적절. 별도 조치 불필요.

---

## 요약

이번 변경(`spec/5-system/9-rag-search.md` §2.2·§3.1·§4.2·§5·§6·Rationale, `spec/2-navigation/5-knowledge-base.md` §2.1·§2.2.1, `spec/5-system/8-embedding-pipeline.md` §7.3)은 정식 규약(`spec/conventions/`) 의 직접적인 위반 사항이 없다. tool_result content 문자열 판별 키의 `snake_case` 표기는 `node-output.md §3.2`·`error-codes.md` 의 `UPPER_SNAKE_CASE` 에러 코드 규약과 레이어가 다름을 spec 내 callout 으로 적절히 설명했으며, `skipReason` 의 `lower_snake_case` 는 `mcp-client.md §6.2` 의 선례와 동일 패턴이다. 문서 3섹션 구조(Overview/본문/Rationale), `_product-overview.md` 명명, API endpoint 표기, 에러 코드 명명 모두 규약 준수 상태다. 발견된 4건은 모두 INFO 등급의 미래 유지보수성 개선 제안이며 채택 여부는 선택 사항이다.

## 위험도

NONE
