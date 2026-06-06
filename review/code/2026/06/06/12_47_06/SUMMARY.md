# Code Review 통합 보고서

## 전체 위험도
**LOW** — 보안·아키텍처·API 계약·요구사항 측면에서 Critical 발견 없음. 유지보수성·테스트 커버리지에서 경미한 WARNING 4건 존재. 전반적으로 품질이 높은 변경 세트.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `AzureOpenAIClient.embed` e5 prefix 상속 경로 테스트 부재. `LocalClient`와 동일 상속 구조임에도 대응 spec 파일 없음. Azure endpoint에서 비대칭 임베딩 모델 사용 시 동일 회귀 위험 존재. | `codebase/backend/src/modules/llm/clients/azure-openai.client.ts` | `azure-openai.client.spec.ts` 신규 생성, `local.client.spec.ts` 패턴으로 e5 prefix 상속 경로 고정. Azure에서 e5 미사용이 확실하면 INFO로 다운그레이드. |
| 2 | Testing | `searchVectorGroup` 및 `searchGraphKb`의 임베딩 차원 불일치 시 graceful skip 방어 분기 미커버. `rag-search.service.ts` L381–386 및 L456–465의 "dim 불일치 → 경고 후 빈 배열 반환" 경로가 테스트 없이 묻힐 수 있음. | `codebase/backend/src/modules/knowledge-base/search/rag-search.service.spec.ts` | "embed가 dim이 다른 벡터 반환 시 해당 그룹/KB를 스킵하고 다른 그룹 결과 유지" 케이스 추가. |
| 3 | Maintainability | `embedding-model-combobox.tsx`의 `Parameters<typeof formatEmbeddingOptionLabel>[0]` 타입 표현이 장황하고 간접 결합 형성. 함수 시그니처 변경 시 타입 추론이 함께 변하며, 유지보수자가 타입 확인을 위해 함수 정의까지 탐색해야 함. | `codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` — renderOption 콜백 | `Pick<ModelInfo, "id" \| "name">`으로 명시하거나 `embedding-model-recommendation.ts`에서 named type export 추가. |
| 4 | Maintainability | `llm.service.spec.ts` 두 신규 테스트 케이스의 `as any` 타입 단언이 이유 주석 없이 사용됨. 기존 파일의 `as never` 패턴과 불일치(일관성 낮음). | `codebase/backend/src/modules/llm/llm.service.spec.ts` — config 객체 | 의도 주석 추가, 또는 기존 패턴으로 통일. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `applyEmbeddingInputPrefix` 비멱등 계약이 테스트로 고정됨. 향후 호출 경로 증가 시 "단 한 번 호출" 불변식 외부 보장 부담. | `embedding-input-type.spec.ts` | 호출 경로 증가 시 멱등화 또는 internal-only visibility 고려. 현재 수용 가능. |
| 2 | Architecture | `LocalClient` 테스트가 `@ts-expect-error`로 내부 private 필드 직접 교체 — 화이트박스 결합. | `local.client.spec.ts` | 장기적으로 factory/injection 포인트 도입 권고. 현재 수용 가능. |
| 3 | Architecture | `useCallback` 방어적 안정화 — `ModelSelectField`가 `memo` 아님 → 실제 효과 없음. | `embedding-model-combobox.tsx` | 제품 결정(사용자 확인)으로 방어적 적용 유지. |
| 4 | Side Effect | `isKoreanRecommendedEmbeddingModel` 반환값 `text-embedding-3` true→false 시맨틱 변경(의도된 정책). | `embedding-model-recommendation.ts` | 직접 소비처는 combobox 하나, 위임 완료. 확인 완료. |
| 5 | Documentation | `isKoreanRecommendedEmbeddingModel` 공개 함수 JSDoc 부재. | `embedding-model-recommendation.ts` | `formatEmbeddingOptionLabel` 수준 JSDoc 추가. |
| 6 | Documentation | `applyEmbeddingInputPrefix` 비멱등 설계 근거가 테스트에만 존재, 소스 JSDoc 없음. | `embedding-input-type.ts` | `@remarks 멱등 아님` 1줄 추가. |
| 7 | Documentation | `text-embedding-3` 제외 결정에 벤치마크 출처 없음. | `5-knowledge-base.md §2.2` | Rationale에 벤치마크 근거 1–2줄(선택). |
| 8 | Documentation | recall `inputType:'query'` 링크가 단방향만 추가. | `3-information-extractor.md` | 역방향 spec 언급 추가 검토. |
| 9 | Maintainability | `local.client.spec.ts`의 `'http://localhost:1234/v1'` 매직 문자열. | `local.client.spec.ts` | 상수 추출 권고(강제성 낮음). |
| 10 | Testing | 기존 cross_encoder 테스트 mock 패턴 불일치(`mockResolvedValue` + `mockResolvedValueOnce` 혼합). | `rag-search.service.spec.ts` | 순서 통일(가독성, 기존 코드). |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 이슈 없음. 테스트 픽스처 더미값 허용 범위. |
| architecture | NONE | 레이어 책임 분리·의존성 역전·모듈 경계 정합. INFO 4건. |
| requirement | NONE | 11개 파일 전체 spec·구현 정합. |
| scope | NONE | 변경 범위 모두 작업 의도 내. |
| side_effect | LOW | `isKoreanRecommendedEmbeddingModel` 시맨틱 변경(의도된 정책), 위임 완료. |
| maintainability | LOW | WARNING 2건: 장황한 타입 표현, `as any` 주석 누락. |
| testing | LOW | WARNING 2건: Azure 상속 경로 미커버, dim 불일치 graceful skip 미커버. |
| documentation | NONE | 문서화 품질 높음. INFO 4건. |
| api_contract | NONE | HTTP API 계약 변경 없음. |

## 라우터 결정

라우터 선별 실행 (`routing_status=done`). 실행 9명 / 강제포함 7명 / 제외 5명(performance·dependency·database·concurrency·user_guide_sync).

---

검토 대상: P6 임베딩 follow-up (commit 490e4a72)
검토 일시: 2026-06-06 12:47:06
