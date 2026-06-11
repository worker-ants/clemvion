# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**MEDIUM** — naming_collision checker 에서 Critical 1건 발견 (probe read-only 정책과 dimension 자동 저장 간 의미 충돌). 나머지 checker 는 모두 LOW.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Naming Collision | "probe read-only" 정책과 "ModelConfig.dimension 자동 저장" 간 의미 충돌 — 서로 다른 엔티티(`ModelConfig.dimension` vs `KnowledgeBase.embedding_dimension`)를 대상으로 하면서 같은 단어("probe", "차원 저장")를 사용해 spec 독자에게 직접 충돌처럼 보임 | `spec/2-navigation/6-config.md §B.3` 변경안 (dimension 자동 저장 기술) | `spec/2-navigation/5-knowledge-base.md` L64 ("probe는 read-only 검증 — 측정한 차원을 `embedding_dimension`에 미리 저장하지 않는다"), `spec/5-system/9-rag-search.md` L353·L406 | §B.3 변경안에 "여기서 자동 저장하는 대상은 `ModelConfig.dimension`(SoT)이며, `KnowledgeBase.embedding_dimension`(파생 캐시)은 임베딩 적재 경로가 채운다 — KB spec의 probe read-only 정책과 상보 관계"라는 구분 문장을 명시적으로 추가. 또는 `spec/5-system/9-rag-search.md` Rationale의 "probe 차원을 미리 저장하지 않는다" 문장에 "KB의 `embedding_dimension`에"라는 수식어로 범위를 한정. |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec + Naming Collision | `LLMClient.testConnection(): Promise<boolean>` (인터페이스)과 `LlmService.testConnection` (서비스 레이어) 반환 타입 분리 미명시 — `§8.3` 서술도 미갱신, `StubLlmClient` 암묵적 계약 포함 | `spec/5-system/7-llm-client.md §3.1` 변경 제안 | `spec/5-system/7-llm-client.md` L87 (`testConnection(): Promise<boolean>`), L362 (`StubLlmClient`), §8.3 ("기존 chat / testConnection / resolveConfig 유지") | 변경 제안에 "LLMClient 인터페이스 `testConnection(): Promise<boolean>` 불변, 서비스 레이어 `LlmService.testConnection`이 `embed()` 결과에서 `vectors[0].length`를 추출해 `{ success, dimension? }` 반환"을 명시. `§8.3`도 동반 갱신. |
| 2 | Cross-Spec | `spec/2-navigation/6-config.md §B.5` before/after 교체 범위 불명확 — 현행 §B.5 전면 교체 여부 미명시 | `spec/2-navigation/6-config.md §B.3·§B.5` 변경 제안 | `spec/2-navigation/6-config.md §B.5` 현행 ("선택 모델의 벡터 차원 (예: 1536/3072). ModelConfig.dimension = SoT") | §B.5 변경 제안이 현행 §B.5 전체를 대체하는 것임을 명시. §B.3 변경과 §B.5 변경이 단일 UX 흐름을 이루는지 재검토. |
| 3 | Cross-Spec | `POST /api/model-configs/:id/test` 응답 shape 차이(`embedding: { success, dimension? }` vs `chat: { success }`)가 API 표에 미반영 | `spec/2-navigation/6-config.md §3 API 표` — 현행 응답 shape 기술 없음 | `spec/2-navigation/6-config.md §3 API 표` 현행 | API 표 해당 행 설명란에 `"embedding: { success, dimension? }, chat: { success }"`를 간략히 주석 추가. |
| 4 | Naming Collision | `rerank` kind 의 testConnection 지원 여부 직접 충돌 — 변경안 kind 표에 rerank 포함, 기존 spec "미제공" | `spec/5-system/7-llm-client.md` 변경안 kind 표 (rerank 행 포함) | `spec/2-navigation/6-config.md` L249 ("리랭커는 … 연결 테스트를 제공하지 않는다"), API 표 주석 ("chat/embedding 만 — rerank 미제공") | kind 표에서 rerank 행 삭제 또는 "rerank: API 미노출(§B.6.2) — 서비스 내부 호출 가능하나 미제공"으로 구분 명시. |
| 5 | Naming Collision | `§B.3` 크로스 레퍼런스 "LLM Client §3.1" 앵커 불일치 — §3.1에 probe 전략 상세 기술 없음 | `spec/2-navigation/6-config.md §B.3` 변경안 cross-reference | `spec/5-system/7-llm-client.md §3.1` 현행 (testConnection 한 줄 선언만) | 변경안 1번(llm-client.md 수정)에서 추가될 testConnection 명세의 앵커를 먼저 확정 후 §B.3 참조를 일치시킴. 서비스 계층 설명은 §8.3 추가 → §B.3는 "§B.5 / LLM Client §8.3"으로 수정 권고. |
| 6 | Rationale Continuity | `EmbedResponse` Planned 보류 결정과 dimension 추출 우회의 관계 — 독립 여부를 spec `## Rationale`에 미기술 | `spec/5-system/7-llm-client.md` 개정안 | `spec/5-system/7-llm-client.md §3.3` ("EmbedResponse Planned — usage/dimensions 메타데이터 반환 보류") | `## Rationale`에 "(a) testConnection 경로의 dimension 추출은 EmbedResponse Planned 트랙과 독립적인 서비스 레이어 전용 추출이며 LLMClient 인터페이스를 변경하지 않는다, (b) kind-agnostic ModelConfigService.findEntity 채택은 구 LlmConfigService chat-고정 경로를 대체하는 의도적 결정이다"를 명시 추가. |
| 7 | Convention Compliance | `spec_impact` 필드 frontmatter 미선언 — Gate C 적용 대상(started 2026-06-11) 완료 이동 시 build guard 강제 대상 | `plan/in-progress/spec-update-embedding-testconnection.md` frontmatter | `.claude/docs/plan-lifecycle.md §5 Gate C`, `spec/conventions/spec-impl-evidence.md §4.2` | frontmatter에 `spec_impact: [spec/5-system/7-llm-client.md, spec/2-navigation/6-config.md]` 초안 선언 추가. |
| 8 | Convention Compliance | API endpoint path parameter 표기 NestJS 스타일(`:id`) — spec 본문 반영 시 OpenAPI 스타일(`{id}`) 필요 | `plan/in-progress/spec-update-embedding-testconnection.md §3` | `spec/conventions/swagger.md §2-3`, `spec/5-system/2-api-convention.md` | spec 본문 반영 시 `POST /api/model-configs/{id}/test`로 표기 통일. |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `LLMClient.embed()` 인터페이스 불변 확인 — dimension 파생이 `vectors[0].length` 계산임을 draft에서 미명시 | `spec/5-system/7-llm-client.md §3.3` 변경 제안 | probe 설명에 "반환 벡터 배열의 첫 요소 길이(`vectors[0].length`)로 계산" 문구 추가. |
| 2 | Cross-Spec | `ModelConfigService.findEntity` 의존 방향 — `LlmModule → ModelConfigModule` spec 미명시 | `spec/5-system/7-llm-client.md` 변경 제안 | "설정 조회는 `ModelConfigService.findEntity` 사용, forwardRef 순환 의존 해소 백로그 W4 참조" 설계 결정 반영. |
| 3 | Cross-Spec | `spec/1-data-model.md §2.16 ModelConfig.dimension` — 자동감지·write-back 경로 미기술 | `spec/1-data-model.md §2.16` 현행 | dimension 필드 설명에 "(연결 테스트 성공 시 자동감지·자동저장 가능 — 상세 Config §B.3)" 1줄 주석 추가 권장. |
| 4 | Rationale Continuity | `LLMClient.testConnection` 레이어 경계 명시 보완 | `spec-update-embedding-testconnection.md §1 After 블록` | spec 개정 시 "서비스 레이어의 응답 shape"와 "LLMClient 인터페이스 계약은 불변"임을 한 줄 명시. |
| 5 | Rationale Continuity | `dimension` read-only 조건 — `EmbedResponse` Planned 도입 시 SoT 충돌 잠재 가능성 | `spec-update-embedding-testconnection.md §3 (§B.5 변경)` | "dimension SoT는 testConnection probe 결과(마지막 성공 값)이며, 향후 EmbedResponse 도입 후에는 embed 호출 응답을 통한 갱신 경로도 추가될 수 있음"을 각주로 추가. |
| 6 | Convention Compliance | `spec/5-system/7-llm-client.md` frontmatter `pending_plans`에 본 plan 미등록 | `spec/5-system/7-llm-client.md` frontmatter | spec 수정 PR에서 `pending_plans:`에 `plan/in-progress/spec-update-embedding-testconnection.md` 추가 또는 완료 즉시 제거. |
| 7 | Convention Compliance | spec 본문 반영 시 `unified-model-management.md §7 W4` 링크 — spec-link-integrity.test.ts 가드 실패 가능성 | `spec-update-embedding-testconnection.md §1·§3` 백로그 참조 | spec 본문 삽입 시 마크다운 링크 대신 백틱 인라인 텍스트로 유지. |
| 8 | Plan Coherence | `unified-model-management.md §7 W4` 참조가 "예정" 표현으로 완료/미완 혼재 | `spec-update-embedding-testconnection.md §1·§3` W4 참조 | "근본 원인 해소 완료(b1c37ac1), alias 모듈 정리(PR4)는 별도 진행 중"으로 구체화 권고. |
| 9 | Plan Coherence | `spec-update-pr2-embedding.md`와 embedding testConnection 동작 서술 정합 점검 필요 | `spec-update-pr2-embedding.md §2` 폴백 체인, target §1 probe 표 | target 반영 시 `spec-update-pr2-embedding.md §2`의 폴백 체인(§5.5)과 probe 표가 `resolveEmbedding()` 동작을 동일하게 서술하는지 교차 확인. |
| 10 | Plan Coherence | PR #545(`unified-model-mgmt-pr4`)가 `spec/2-navigation/6-config.md` 수정 중 — merge conflict 잠재 가능성 | `spec/2-navigation/6-config.md §B.3·§B.5` 변경 대상 | target "우선순위 및 연동" 항에 "PR #545 merge 후 반영 권고" 추가. |
| 11 | Plan Coherence | §B.3 변경안에서 기존 chat 연결 테스트 설명 보존 여부 불명확 | `spec-update-embedding-testconnection.md §2 After` | After 안에 기존 chat 연결 테스트 설명(모델 목록 조회 경량 호출, Connected/에러 표시)을 보존하고 embedding 분기를 추가하는 형태로 명확히 표기. |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | LLMClient 인터페이스/서비스 레이어 반환 타입 분리 미명시(WARNING 3건), API 응답 shape 미반영, embed() 인터페이스 불변 확인 필요(INFO) |
| Rationale Continuity | LOW | EmbedResponse Planned 트랙과 dimension 우회 추출의 독립성 미기술(WARNING), 레이어 경계 명시 보완(INFO) |
| Convention Compliance | LOW | spec_impact frontmatter 미선언(WARNING), API path parameter 표기 스타일 불일치(WARNING) |
| Plan Coherence | LOW | W4 참조 표현 정확도(INFO), PR #545 동시 편집 경합 주의(INFO), spec-update-pr2-embedding 정합 점검(INFO) |
| Naming Collision | MEDIUM | probe read-only vs ModelConfig.dimension 자동 저장 의미 충돌(CRITICAL), rerank testConnection 지원 여부 직접 충돌(WARNING), 크로스 레퍼런스 앵커 불일치(WARNING) |

---

## 권장 조치사항

1. **(BLOCK 해소 필수)** `spec/2-navigation/6-config.md §B.3` 변경안에 대상 필드 범위 명시 — "자동 저장 대상은 `ModelConfig.dimension`(SoT). `KnowledgeBase.embedding_dimension`(파생 캐시)은 임베딩 적재 경로가 채우며 KB spec의 probe read-only 정책과 상보 관계"를 명시적으로 추가. 또는 `spec/5-system/9-rag-search.md` Rationale의 probe 저장 금지 문장에 "KB의 `embedding_dimension`에" 수식어 추가로 범위 한정.
2. **(WARNING 해소 우선)** `spec/5-system/7-llm-client.md §8.3` (또는 신설 섹션)에 `LlmService.testConnection` 반환 타입 `{ success: boolean, dimension?: number }` 분리 기술. `LLMClient.testConnection(): Promise<boolean>` 인터페이스 불변임을 동시 명시.
3. **(WARNING)** kind 표에서 `rerank` 행 처리 — API 미노출(§B.6.2 일치) 명시 또는 삭제.
4. **(WARNING)** `spec/5-system/7-llm-client.md §§ Rationale`에 EmbedResponse Planned 트랙과의 독립성 및 kind-agnostic ModelConfigService 채택 근거 명시 추가.
5. **(WARNING)** `plan/in-progress/spec-update-embedding-testconnection.md` frontmatter에 `spec_impact: [spec/5-system/7-llm-client.md, spec/2-navigation/6-config.md]` 초안 선언 추가.
6. **(WARNING)** §B.3 크로스 레퍼런스 "LLM Client §3.1" → 실제 명세가 추가될 앵커(예: §8.3)로 수정.
7. **(INFO)** `spec/2-navigation/6-config.md §3` API 표 해당 행에 `embedding: { success, dimension? }` 응답 shape 주석 추가.
8. **(INFO)** `spec/1-data-model.md §2.16` dimension 필드 설명에 자동감지·write-back 경로 1줄 주석 추가.
9. **(INFO)** spec 본문 반영 전 PR #545(unified-model-mgmt PR4) merge 여부 확인 — `spec/2-navigation/6-config.md` 동시 편집 경합 예방.
10. **(INFO)** spec 본문 삽입 시 `unified-model-management.md §7 W4` 참조를 백틱 텍스트로 유지 (spec-link-integrity.test.ts 가드 회피).