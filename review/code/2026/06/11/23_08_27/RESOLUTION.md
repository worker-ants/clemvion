# RESOLUTION — 23_08_27

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 (USER_GUIDE_SYNC) | 코드(docs) | `4c047d32` | models.en.mdx + models.mdx — Step 4·Callout·FieldTable Dimension·API 레퍼런스 자동 감지 동작으로 갱신 |
| #2 (ARCHITECTURE forwardRef) | 백로그 | — | 런타임 위험 없음, `plan/in-progress/unified-model-management.md §7 W4` 추적 |
| #3 (REQUIREMENT rerank testConnection) | 코드(comment) | `429a95c8` (기존) + `4c047d32` | 기존 commit 이 rerank 테스트 케이스 추가. 이번 commit 에서 JSDoc + 인라인 주석으로 UI 가드·graceful 실패 의도 명확화 |
| #4 (SIDE_EFFECT onSuccess PATCH) | 코드(comment) | `4c047d32` | 기존 주석 개선 — "PATCH 추가 발행(best-effort)" 명시 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (backend 6612 + frontend 4273+181 passed)
- e2e   : 통과 (188/188)

## 보류·후속 항목

- WARNING #2 (ARCHITECTURE forwardRef 순환): 즉시 fix 대상 아님 — `plan/in-progress/unified-model-management.md §7 W4` 백로그 추적
- INFO SPEC-DRIFT #1~4: false positive — spec 이미 commit `8b6126bb` 로 갱신됨 (확인 완료)
- INFO #12 (컨트롤러 레이어 dimension 직렬화 검증): 백로그. 현재 e2e 188 통과로 암묵적 검증됨
- INFO #13 (invalidate sideEffect 미검증): 백로그
- INFO #17 (forwardRef 주석): 백로그

## INFO 처리 내역

| INFO # | 조치 |
|--------|------|
| #8 EMBEDDING_CONFIG_FIXTURE 상수 추출 | `4c047d32` — llm.service.spec.ts 3중 중복 해소 |
| #9 매직 리터럴 1536/3072 명명 상수 | `4c047d32` — OPENAI_SMALL_DIM / OPENAI_LARGE_DIM 상수 추가 (backend + frontend) |
| #10 Swagger description 영문화 | `4c047d32` — ModelTestConnectionResultDto.dimension description 영문 통일 |
| #11 listModels kind-agnostic 테스트 | `4c047d32` — findEntity 가 kind 인수 없이 호출됨 assert 추가 |
| #14 chat 경로 dimension 미포함 assert | `4c047d32` — `'dimension' in result` === false 명시적 assert |
| #15 dimension=null 편집 writable 케이스 | `4c047d32` — readOnly 아님 반대 케이스 추가 |
| #16 testConnection JSDoc | `4c047d32` — @returns JSDoc 추가 |
