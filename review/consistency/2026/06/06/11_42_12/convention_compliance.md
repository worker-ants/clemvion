# 정식 규약 준수 검토 결과

검토 대상: `spec/5-system/` (diff-base: `origin/main`)
검토 범위: `spec/5-system/7-llm-client.md`, `spec/5-system/8-embedding-pipeline.md`, `spec/5-system/9-rag-search.md`, `spec/5-system/17-agent-memory.md`
검토 모드: 구현 완료 후 (`--impl-done`)

---

## 발견사항

### [WARNING] `8-embedding-pipeline.md` 섹션 헤딩의 식별자 명명 불일치

- **target 위치**: `spec/5-system/8-embedding-pipeline.md` L131 (`### 5.4 비대칭 입력 (input_type / prefix)`) 및 L365 (`### 결정: 비대칭 입력(input_type / prefix) 배선`)
- **위반 규약**: CLAUDE.md "기술 명세: `spec/<영역>/*.md` 본문" — spec 문서 내 기술 식별자는 구현과 일관된 표기를 유지하는 것이 원칙
- **상세**: 섹션 헤딩에서 `input_type` (snake_case) 를 쓰지만, 같은 파일 본문(L133), `7-llm-client.md` (L73, L136–152, L396–416), `9-rag-search.md` (L275), `17-agent-memory.md` (L87), 그리고 구현 파일명(`embedding-input-type.ts`) 에서는 모두 `inputType` (camelCase) 또는 kebab-case(`embedding-input-type`) 를 사용한다. 헤딩만 `input_type` 를 혼용해 독자가 다른 개념으로 오인할 여지가 있다.
- **제안**: 헤딩을 `### 5.4 비대칭 입력 (inputType / prefix)` 및 `### 결정: 비대칭 입력(inputType / prefix) 배선` 으로 수정해 본문·코드와 일치시킨다.

---

### [INFO] `7-llm-client.md §3.3` SoT 교차 참조의 섹션 번호 누락

- **target 위치**: `spec/5-system/7-llm-client.md` L147 — "provider/모델별 적용은 `spec/5-system/8-embedding-pipeline.md §5` 가 SoT"
- **위반 규약**: 단일 진실 원칙(CLAUDE.md "정보 저장 위치") — 참조 대상 섹션을 정확히 명시해야 독자가 잘못된 위치를 SoT 로 오해하지 않음
- **상세**: 실제 SoT 는 `§5` 전체가 아니라 신설된 `§5.4` 다. `8-embedding-pipeline.md` 에서 역참조는 `[7-llm-client.md §8.3]` 으로 정확히 명시했는데 반대 방향(`7-llm-client.md` → `8-embedding-pipeline.md`)에서는 서브섹션 번호가 빠져있다.
- **제안**: L147 을 `spec/5-system/8-embedding-pipeline.md §5.4` 로 수정. `8-embedding-pipeline.md` Rationale L365 의 `§5.4` 참조 표기는 올바르다.

---

### [INFO] `8-embedding-pipeline.md` — `## Overview` 섹션 부재 (기존 상태, 신규 변경과 무관)

- **target 위치**: `spec/5-system/8-embedding-pipeline.md` 문서 전체 구조
- **위반 규약**: CLAUDE.md "제품 정의·요구사항: `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`" — spec 문서 권장 3섹션(Overview / 본문 / Rationale)
- **상세**: `8-embedding-pipeline.md` 는 `## Rationale` 섹션은 있으나 `## Overview` 섹션이 없고 `## 1. 개요` 로 직접 시작한다. 이번 diff 에서 신설된 `§5.4` 섹션은 이 기존 패턴 안에 자연스럽게 편입되어 있어 새로 위반을 추가하지는 않았다. 다만 `17-agent-memory.md` 와 `9-rag-search.md` 는 `## Overview (제품 정의)` 를 갖추고 있다.
- **제안**: 이번 변경의 범위 내에서는 수정 불필요. 별도 spec 정비 turn 에서 `## 1. 개요` 를 `## Overview` 로 통일하거나 `## 1. 개요` 앞에 간략한 `## Overview` 를 추가하는 것을 검토한다.

---

## 요약

이번 diff (`spec/5-system/` 내 4개 파일: `7-llm-client.md`, `8-embedding-pipeline.md`, `9-rag-search.md`, `17-agent-memory.md`) 는 비대칭 임베딩 `inputType` 파라미터 배선을 spec 에 반영하는 내용이다. 에러 코드는 신규 추가 없음, API endpoint 명명은 변경 없음, Rationale 섹션은 해당 파일에 정상 포함된다. 주요 발견사항은 `8-embedding-pipeline.md` 의 섹션 헤딩이 `input_type` (snake_case) 로 기술되어 본문·코드의 `inputType` (camelCase) 와 혼재하는 WARNING 1건과, `7-llm-client.md §3.3` 에서 SoT 교차 참조의 서브섹션 번호가 누락된 INFO 1건이다. 두 사항 모두 invariant 를 깨지는 않으나 명확성 측면에서 수정이 권고된다.

## 위험도

LOW
