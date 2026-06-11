# 정식 규약 준수 검토 결과

**대상 문서**: `spec/2-navigation/14-execution-history.md`
**검토 모드**: spec draft (`--spec`)
**검토 일시**: 2026-06-11

---

## 발견사항

### [INFO] 문서 구조 — Rationale 내 Re-run 위임 주석의 위치

- **target 위치**: `## Rationale` 마지막 블록쿼트 (`> Re-run 버튼·chain 추적(§3.7)의 설계 결정은 …`)
- **위반 규약**: 직접 위반은 아님. CLAUDE.md 정보 저장 위치 원칙 ("결정의 배경·근거 — 해당 spec 문서 끝의 `## Rationale`") 과는 합치하나, §3.7 에서 다루는 Re-run 관련 내용이 `Rationale` 섹션 R-4 내용(`Skipped 노드`) 뒤에 블록쿼트 형식으로 덧붙여져 체계 외부처럼 보인다.
- **상세**: R-4 다음에 번호 없는 블록쿼트로 Re-run 위임 설명이 결합되어 있어, Rationale 내 numbered 항목 체계(R-1 ~ R-4)의 일관성이 약간 깨짐.
- **제안**: 독립 번호 항목 없이 블록쿼트 형식을 유지하는 것은 허용 가능하나, "본 문서는 화면 배치만 정의한다" 는 위임 사유를 인라인 주석으로 두는 것 자체는 INFO 수준. 변경 불요 또는 `### R-5. Re-run / chain 위임` 으로 번호화하는 것이 가독성에 유리.

---

### [INFO] API 엔드포인트 경로 표기 — `/api/executions/workflow/:workflowId` 복수 리소스 패턴

- **target 위치**: `## 5. API 엔드포인트` 표 첫 번째 row
- **위반 규약**: `spec/5-system/2-api-convention.md §2.2` — "리소스는 복수형 명사", "중첩은 2단계까지", "케밥 케이스"
- **상세**: `/api/executions/workflow/:workflowId` 의 중간 세그먼트 `workflow` 가 단수 표기다. 규약의 복수형 명사 원칙에 따르면 `/api/executions/workflows/:workflowId` 가 기대값. 규약 §2.2 예시들(`/api/workflows`, `/api/knowledge-bases`)은 모두 복수형이다. 단, 현재 "모든 API는 이미 구현되어 있으며, 추가 백엔드 작업은 불필요하다" 고 명시되어 있어 구현체와 맞게 문서화된 것일 수 있다.
- **제안**: 현행 엔드포인트가 이미 `workflow` 단수로 라이브 운영 중인 경우, spec 에서 `workflow` 를 유지하면서 각주로 "naming inconsistency — historical artifact" 를 명시하거나, 다음 major 리팩 기회에 복수형으로 정정하는 트래킹 항목을 Rationale 에 남기는 것을 권장. 구현과 spec 이 일치하므로 현 시점 CRITICAL 은 아님.

---

### [WARNING] 응답 DTO 의 camelCase vs snake_case 혼재 — `triggerSource` / `triggerLabel` 필드명 일관성

- **target 위치**: `## 2. 실행 내역 목록 페이지 §2.4 Trigger 출처 분류` 마지막 문장 및 `## 5. API 엔드포인트` 응답 JSON 샘플
- **위반 규약**: `spec/5-system/2-api-convention.md §5.2 목록 응답` — 응답 샘플이 전반적으로 camelCase 를 사용하고 있으며(`startedAt`, `finishedAt`, `durationMs`, `workflowId`, `reRunOf`, `chainId`, `dryRun`, `totalNodeCount` 등) API 규약은 JSON camelCase 를 암묵적 표준으로 채택. `spec/conventions/swagger.md §1-1` — DTO 필드에 JSDoc 한국어 주석 + class-validator 패턴 권장.
- **상세**: `triggerSource` 와 `triggerLabel` 은 camelCase 로 일관하며 문제없다. 그러나 §2.4 Trigger 분류 표의 `source` 컬럼 값(`subworkflow`, `manual`, `schedule`, `webhook`, `unknown`) 과 §5 응답 JSON의 `"triggerSource": "schedule"` 이 일관성 있게 표기되어 있다. WARNING 은 다음 이유: §5 샘플 JSON 의 `"executionPath": []` 에 대해 Rationale R-1 에서 "목록 응답에서는 항상 빈 배열" 이라 설명하는데, 이 필드가 목록 응답 DTO 에 노출되는 이유 자체가 모호하다. 목록 API 응답 DTO 가 `executionPath: []` 를 상시 고정값으로 반환한다면, 규약 `spec/5-system/2-api-convention.md §5.2` 의 "불필요한 필드 비포함" 원칙(암묵적)에 반해 dead-weight 필드가 응답에 실린다. 채용 여부는 구현 DTO 에서 확인해야 하나, spec 이 이 필드를 목록 응답에 노출한다고 명시한 것 자체가 규약과의 긴장을 만든다.
- **제안**: `executionPath` 가 목록 응답에서 항상 `[]` 라면 해당 필드를 목록 API 응답 DTO에서 **제외**하고 상세 API 전용으로 한정하는 것이 규약(불필요 필드 배제, N+1 회피 원칙)에 부합. 현재 R-1 에서 이유를 설명하고 있으므로 spec 문서 자체의 논거는 명확하나, 필드를 노출하지 않도록 변경해 규약과 정합을 맞추는 것을 권장. 규약 갱신보다는 target 수정 적합.

---

### [WARNING] `spec/conventions/spec-impl-evidence.md` frontmatter — `id` 값의 basename 정합

- **target 위치**: 문서 frontmatter (`id: execution-history`)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — "`id`: string (kebab-case). 파일 basename(확장자 제외) 기반 권장." 파일 basename 은 `14-execution-history` 이고 `id` 는 `execution-history`.
- **상세**: 규약은 "파일 basename(확장자 제외) 기반 **권장**" 이므로 의무는 아니다. 숫자 prefix(`14-`) 를 생략한 것은 다른 spec 들과도 동일한 패턴(예: `spec/5-system/2-api-convention.md` → `id: api-convention`)이므로, 프로젝트 관례상 숫자 prefix 생략은 허용된 패턴으로 보인다. 단, 동일 basename(`execution-history`)이 다른 영역에 존재할 경우 규약 §2.1 의 "영역 prefix 로 충돌 회피" 원칙이 요구된다.
- **제안**: 현재 프로젝트 내 `execution-history` id 가 다른 파일과 충돌하지 않는 한 현행 유지 가능. `spec-frontmatter.test.ts` 가 id uniqueness 를 검증하므로 빌드에서 충돌 감지 가능. INFO → WARNING 으로 격상한 이유는 `spec/conventions/spec-impl-evidence.md §2.1` 이 "basename 기반 권장" 을 명시하고 있어 prefix 포함(`14-execution-history`)이 더 명확하기 때문. 변경하려면 동일 id 를 참조하는 다른 문서도 함께 갱신 필요.

---

### [INFO] API 규약 `PUT` 금지 규칙 — spec 에서 `PUT` 사용 언급 없음 (양호 확인)

- **target 위치**: `## 5. API 엔드포인트` 전체
- **위반 규약**: `spec/5-system/2-api-convention.md §3` — "PUT: 사용하지 않음 (PATCH 선호)"
- **상세**: target 문서의 API 표에 GET / POST 만 정의되어 있고 PUT 은 없다. 규약 위반 없음. 확인 차 기재.

---

### [INFO] 문서 내 DTO 명명 패턴 — `ExecutionDto` 참조 (swagger 규약과의 연계)

- **target 위치**: `## 2. 실행 내역 목록 페이지 §2.4` 인라인 주석 ("목록 API(`GET /api/executions/workflow/:workflowId`)의 `ExecutionDto`")
- **위반 규약**: `spec/conventions/swagger.md §1-1` — DTO 클래스명은 PascalCase, `spec/5-system/2-api-convention.md §5.2`
- **상세**: `ExecutionDto` 는 PascalCase + `Dto` suffix 패턴을 따르고 있어 swagger 규약과 정합. 문서 내 참조 표기 방식도 일관됨. 이상 없음.

---

## 요약

`spec/2-navigation/14-execution-history.md` 는 전반적으로 정식 규약을 잘 따르고 있다. frontmatter 스키마(`id`/`status`/`code`)가 `spec/conventions/spec-impl-evidence.md §2` 를 준수하며, 문서 3섹션(Overview / 본문 / Rationale) 구조가 CLAUDE.md 정보 저장 위치 원칙에 부합하고, API 응답 포맷이 `spec/5-system/2-api-convention.md §5.2` 의 `{ data, pagination }` 봉투를 정확히 따른다. 주요 주의 사항은 두 가지: (1) 목록 API 응답 샘플에 상시 `[]` 로 고정된 `executionPath` 필드가 포함되어 불필요 필드 노출 규약과 긴장 관계를 가짐 (WARNING), (2) `/api/executions/workflow/:workflowId` 의 `workflow` 단수 표기가 복수 명사 규약과 미정합하나 이미 구현된 엔드포인트이므로 historical artifact 처리가 적절함 (INFO). 금지 항목(PUT 사용, 규약 명시 패턴 위반) 은 발견되지 않았다.

## 위험도

LOW
