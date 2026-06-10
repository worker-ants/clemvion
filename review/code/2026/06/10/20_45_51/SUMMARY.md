# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 회귀 없음. 이번 diff 는 spec 문서 갱신 3종 + consistency 리뷰 산출물 3종이 주체이며, 일부 구현 코드 변경이 동반됨. Critical 발견 없음. 유일한 WARNING 은 `resolveParallelEngineFlag` read-once 캐시에 대한 테스트 케이스 누락으로, 기능 동작에는 영향이 없으나 회귀 감지 공백이 존재함.

---

## Critical 발견사항

없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `resolveParallelEngineFlag` read-once 캐시 회귀 가드 누락 — W2 describe 블록 주석에 두 메서드(`resolveMaxNodeIterations` / `resolveParallelEngineFlag`) 모두 명시했으나 실제 테스트는 `MAX_NODE_ITERATIONS` 경로만 검증. `PARALLEL_ENGINE` 키 호출 횟수 단언 없어 캐시 파괴 시 침묵 회귀 위험 | `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` describe `env read-once cache (perf #14) — W2` | W2 블록에 (1) 첫 `execute` 에서 `PARALLEL_ENGINE` 키로 `configService.get` 1회만 호출됨 단언, (2) 두 번째 `execute` 에서 재호출 없음 단언 — 기존 `MAX_NODE_ITERATIONS` 케이스 패턴 준용 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation / Testing | 삭제된 `sortByStartedAt` 이름이 주석에 잔존 — 백엔드 실행 엔진 5곳, 프론트엔드 테스트 2곳 | engine.service.ts 4007,4180,5584,5910,6575; use-execution-events.test.ts 294,403 | 주석 내 `sortByStartedAt` → `selectSortedNodeResults` 일괄 교체 |
| 2 | Documentation | `importWorkflow` 배치 insert 의 hook/cascade 부재 전제가 spec Rationale 미기재 | `spec/2-navigation/1-workflow-list.md` Rationale | 1문장 추가 (후속) |
| 3 | Documentation | `selectSortedNodeResults` JSDoc 캐시 만료 조건 미기재 | execution-store.ts 382-394 | 한 줄 추가 (후속) |
| 4 | Architecture | `S3Service.deleteMany` JSDoc 의 "KB 삭제 cleanup 전용" — 인프라 레이어에 도메인 누출 | s3.service.ts | 범용 설명으로 교체 |
| 5 | Architecture | 엔진 God Object 에 캐시 필드 추가 패턴 반복 | engine.service.ts | 중기 `ExecutionConfigCache` 분리 고려 (현시점 YAGNI) |
| 6 | Architecture | frontend 파생 인덱스 Map 3종 — 명시적 trade-off | execution-store.ts | INFO 유지 |
| 7 | Requirement | 10-parallel §4 의 rollback card 에 read-once 미병기 (line 14 와 비대칭) | 10-parallel.md §4 | 병기 (후속) |
| 8 | Maintainability | engine §2.1 표 셀 길이 불균형 | 4-execution-engine.md | 각주 위임 (후속) |
| 9 | Maintainability | file-storage 진입점 불릿 주석 수준 비대칭 | 4-file-storage.md | 통일 (후속) |
| 10 | Maintainability | file-storage §3 인용 블록 관심사 혼재 | 4-file-storage.md | 블록 분리 (후속) |
| 11 | Performance | deleteMany 청크 병렬/순차 전략 spec 미기재 | s3.service.ts / 4-file-storage.md | 후속 |
| 12 | Performance | rehydration 배치의 JS 레벨 dedup — 대규모 시 DISTINCT ON 검토 | engine §7.5 | 후속 |
| 13 | Security | S3 key workspace prefix 부재 — presigned URL 도입 시 재검토 | 4-file-storage Rationale | 기존 Rationale 인지 사항 |
| 14 | Security | AI_RETRY_STATE_TTL 범위 검증 미명시 | engine §1.3 | 후속 |
| 15 | Dependency | p-limit 언급 — 본 diff 에 package.json 변경 없음 (기존 의존) | 10-parallel.md | 확인됨 (기존 dependencies) |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 |
|----------|--------|
| security / performance / requirement / scope / side_effect / maintainability / dependency / database / concurrency / api_contract / user_guide_sync | NONE |
| architecture / testing / documentation | LOW |

## 권장 조치사항

1. **[WARNING]** W2 블록에 `resolveParallelEngineFlag` read-once 가드 2 케이스 추가.
2. **[INFO 단기]** `sortByStartedAt` 잔존 주석 7곳 교체.
3-8. INFO 후속 항목 — RESOLUTION 보류 표 참조.

## 라우터 결정

라우터 미사용 — 사유: routing=skipped. 전체 reviewer 실행.
