# 신규 식별자 충돌 검토 — spec/2-navigation/6-config.md

## 발견사항

- **[INFO]** Rationale 섹션 내 R-N 식별자는 파일 로컬 범위
  - target 신규 식별자: `R-1` ~ `R-6` (spec/2-navigation/6-config.md 내부 앵커)
  - 기존 사용처: 동일 `2-navigation/` 폴더의 여러 파일이 각자 `R-1`~`R-N` 을 독립 사용 — `5-knowledge-base.md R-1`(임베딩 select-only), `2-trigger-list.md R-1`(workflowId read-only), `14-execution-history.md R-1`(목록 API 응답 제한) 등
  - 상세: R-N 앵커는 파일 내 로컬 fragment 이며, Markdown 앵커는 문서별 독립 네임스페이스다. 동일 번호가 다른 문서에서 다른 의미로 쓰이더라도 기술적 충돌(broken link)은 없다. 단, target 본문 line 207 의 `[지식 저장소 §2.4.1·R-3](./5-knowledge-base.md#r-3-상세-상단에-검색-불가-배너--지금-재임베딩-cta-를-둔-이유)` 와 같은 라인에서 target 자체의 `R-3(번복)` 섹션이 함께 언급되어 "R-3"이 두 의미로 보이는 독해 부담이 있다. 이는 naming collision 이 아니라 독자 혼동 가능성이다.
  - 제안: 현행 유지 가능. 혼동을 줄이려면 cross-doc 참조 시 항상 파일명+앵커 전체(`./5-knowledge-base.md#r-3-…`)를 쓰는 관행(이미 준수됨)을 계속 유지할 것.

- **[INFO]** `id: config` frontmatter ID 유일성 확인
  - target 신규 식별자: frontmatter `id: config`
  - 기존 사용처: 전체 `spec/` 트리에서 `id: config` 를 가진 다른 `.md` 파일 없음
  - 상세: 충돌 없음. 다만 `spec/4-nodes/**/0-common.md` 파일 6개가 모두 `id: common` 을 중복 사용하는 기존 패턴이 있으므로 엄밀한 uniqueness 를 강제하지 않는 컨텍스트임.
  - 제안: 해당 없음.

- **[INFO]** `/api/auth-configs/:id/usage` (단수) vs `/api/integrations/:id/usages` (복수) 명칭 비일관성
  - target 신규 식별자: `GET /api/auth-configs/:id/usage` (단수)
  - 기존 사용처: `spec/2-navigation/4-integration.md` 의 `GET /api/integrations/:id/usages` (복수, line 814)
  - 상세: 두 endpoint 모두 "사용 현황 조회"를 표현하지만 suffix 형태가 다르다. `usage` 는 집합 명사로 단수가 적절한 경우도 있으나, API 규약(`spec/5-system/2-api-convention.md`)에서 복수 집합명을 일관 적용한다면 불일치다. 현재 API convention spec 에서 `/usage` vs `/usages` 에 대한 명시 규칙은 확인되지 않는다.
  - 제안: 명명 불일치이나 서로 다른 리소스(`AuthConfig` vs `Integration`)의 하위 경로라 실제 충돌은 없다. 향후 API 규약에서 통일 가이드를 추가하는 것을 INFO 수준으로 권장.

- **[INFO]** `ModelInfo` 타입명 — 데이터 모델과의 용어 구분 이미 명시됨
  - target 신규 식별자: `ModelInfo[]` 응답 타입 (B.2 기본 모델 선택 UX에서 참조)
  - 기존 사용처: `spec/5-system/7-llm-client.md §3.5` 에 `ModelInfo` 가 provider `listModels` 응답 항목 DTO 로 정의됨. `spec/1-data-model.md §2.16` 에 용어 구분 주석 존재 (`ModelConfig` 와 `ModelInfo` 는 접두어 `Model` 공유하나 별개)
  - 상세: target 문서가 `ModelInfo` 를 새로 도입하는 것이 아니라 기존 정의를 참조하는 구조이며, 데이터 모델과 LLM Client spec 양쪽에서 이미 구분이 명시되어 있다. 충돌 없음.
  - 제안: 해당 없음.

## 요약

`spec/2-navigation/6-config.md` 가 도입·사용하는 식별자(frontmatter `id: config`, API endpoint 집합, 엔티티명 `AuthConfig`/`ModelConfig`, 에러 코드 `MODEL_CONFIG_INVALID`, 감사 액션 `auth_config.*`/`model_config.*`, Rationale R-1~R-6) 는 기존 spec 과 중복·충돌하지 않는다. API endpoint 는 `spec/5-system/7-llm-client.md` 및 `spec/data-flow/7-llm-usage.md` 가 동일 표면(`/api/model-configs/*`)을 인용하고 있고 내용이 정합한다. `/api/auth-configs/:id/usage` 의 단수 suffix 가 `integrations` 의 복수 `/usages` 와 스타일 불일치를 보이나 충돌은 아니다. Rationale R-N 번호는 파일 로컬 범위이며 cross-doc 참조가 앵커 전체를 포함하므로 혼동 위험이 낮다. 전체적으로 신규 식별자 충돌은 존재하지 않는다.

## 위험도

NONE
