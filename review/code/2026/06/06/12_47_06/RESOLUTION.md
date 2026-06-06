# RESOLUTION — 12_47_06

P6 임베딩 follow-up 리뷰(RISK LOW, Critical 0 / Warning 4 / Info 10) 후속 조치. 수동 fix.

## WARNING 조치 (4/4)

| # | 분류 | 조치 | 비고 |
|---|------|------|------|
| W-1 | Testing | `azure-openai.client.spec.ts` 신규 — AzureOpenAIClient.embed e5 prefix 상속 경로 회귀 가드(query/document/대칭) | LocalClient 와 동일 상속 구조. Azure 호환 배포 e5 서빙 케이스 커버 |
| W-2 | Testing | `rag-search.service.spec.ts` — embed 가 dim 불일치 벡터 반환 시 graceful skip 2케이스 추가(단일 그룹 스킵 / 다중 그룹 중 정상 그룹 유지) | searchVectorGroup 방어 분기(L381–386) 커버 |
| W-3 | Maintainability | `formatEmbeddingOptionLabel` 입력·combobox renderOption 파라미터 타입을 named `EmbeddingOptionModel = Pick<ModelInfo,"id"\|"name">` 으로 export·공유 — `Parameters<typeof ...>` 장황 추론 제거 | recommendation.ts 에서 export |
| W-4 | Maintainability | `llm.service.spec.ts` 신규 2케이스 `as any` 픽스처에 의도 주석 추가(파일 embed describe 의 기존 픽스처 패턴과 동일함 명시) | |

## INFO 조치 (선택 — 저비용 항목만)

| # | 분류 | 조치 | 비고 |
|---|------|------|------|
| I-5 | Documentation | `isKoreanRecommendedEmbeddingModel` JSDoc 추가 | |
| I-6 | Documentation | `applyEmbeddingInputPrefix` 소스 JSDoc 에 `@remarks 멱등 아님` 1줄 추가 | 테스트에만 있던 비멱등 계약을 소스에 명시 |
| I-9 | Maintainability | `local.client.spec.ts` 매직 엔드포인트 문자열 → `LOCAL_ENDPOINT` 상수 추출 | azure spec 도 `AZURE_ENDPOINT` 상수 사용 |
| I-4 | Side Effect | `isKoreanRecommendedEmbeddingModel` 소비처 재확인 — 직접 소비처는 combobox 1곳, `formatEmbeddingOptionLabel` 위임 완료. grep 으로 확인 | 추가 조치 불요 |
| I-3 | Architecture | useCallback — 제품 결정(사용자 "그래도 적용")으로 유지 | 의도된 방어적 안정화 |

## 미조치 (의도적)

| # | 분류 | 사유 |
|---|------|------|
| I-1 | Architecture | `applyEmbeddingInputPrefix` 멱등화 — 현재 호출 경로 단일, 비멱등 계약을 테스트+JSDoc 으로 고정해 충분. 호출 경로 증가 시 재검토 |
| I-2 | Architecture | 화이트박스 stub(`@ts-expect-error client.client`) — 기존 openai/google client spec 의 확립된 패턴. 단독 변경은 일관성 저해 |
| I-7 | Documentation | text-embedding-3 제외 벤치마크 출처 — 인용 가능한 단일 SoT 링크 부재로 보류(별도 spec grooming) |
| I-8 | Documentation | 역방향 spec 링크 — agent-memory §4 는 이미 inputType 명시. 추가 역링크는 additive 가치 낮아 scope 억제 |
| I-10 | Testing | 기존 cross_encoder 테스트 mock 패턴 — 본 변경 무관 pre-existing 코드, scope 외 |

## 함께 처리한 consistency-check INFO

| # | 조치 |
|---|------|
| Rationale Continuity #4 | `17-agent-memory.md §Rationale` 신규 소항에 KB 재임베딩 결정과의 영역 분화 cross-reference 1줄 추가 |

(consistency-check #1/#2/#5 는 타 spec·pre-existing·향후 plan 항목으로 미조치. #3 pending-plan 파일은 실존 확인 — 비이슈.)

## TEST 결과 (조치 후)

- backend 타깃: 106 passed (llm.service / embedding-input-type / local.client / azure-openai.client / rag-search.service)
- frontend 타깃: 33 passed (embedding-model-recommendation / embedding-model-combobox)
- 전체 lint / unit / build / e2e: 본 RESOLUTION 커밋 직후 재수행 결과로 갱신

## 비고 — 사전존재 baseline 실패 (본 변경 무관)

`spec-link-integrity.test.ts` 의 2 broken anchor(`14-external-interaction-api.md:243/251 → 12-webhook.md#31-응답-형식`)는 pristine origin/main 에서도 동일하게 실패(stash 검증 완료). 본 follow-up 이 건드리지 않은 webhook spec 의 사전존재 이슈로, project-planner 영역이라 본 작업 범위에서 제외.
