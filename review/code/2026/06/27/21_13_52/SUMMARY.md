# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 정확성 이슈 없음(Critical 0). SPEC-DRIFT 1건(spec 갱신 필요) + 테스트·문서화·타입 강화 WARNING. scope reviewer 출력 미착지(재시도 필요 1건). 8 reviewer 디스크 기록, dependency/database/concurrency/api_contract/user_guide_sync 는 router skip(무관).

## Critical 발견사항
해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 처리 |
|---|----------|----------|------|
| 1 | SPEC-DRIFT | `spec/5-system/17-agent-memory.md` AGM-08 watermark 경로(§3·§7·§7 Rationale)가 구 flat 키 `_resumeState.lastExtractionTurnSeq` 기준. 코드(I12)는 `memoryState.lastExtractionTurnSeq` sub-namespace 로 이전 | **FIX** — spec 3곳 갱신 + 폴백 병기 (SPEC-DRIFT back-flow) |
| 2 | Security | 간접 프롬프트 인젝션 — 회수 메모리/요약이 system prompt 삽입. 기존 문서화된 구조적 한계(W-2), DATA_FENCE 완화책 적용 중 | **무대응** — 본 PR 무관 기존 한계 |
| 3 | Architecture | AgentMemoryAdminService SRP 미분리 — 런타임+admin+SQL 빌더 단일 서비스 혼재. 기존 백로그 | **이월** — Batch 3(프론트/어드민)에서 처리 예정 |
| 4 | Side Effect | saveMemories 시그니처 파괴적 변경(포지셔널→옵션). 구 호출 시 무음 no-op. diff 내 14곳 갱신·TS 컴파일 감지 | **대응** — TS 컴파일 통과 + embedCfgSource JSDoc 추가 |
| 5 | Maintainability/Testing | buildCosineMatch 파라미터 순서 계약 타입 미강제 + 파라미터 배열 직접 검증 테스트 부재 | **FIX** — 파라미터 순서 어설션 테스트 추가 |
| 6 | Testing | IE hydrateState 구 평면 키 폴백 경로 통합 테스트 부재 | **FIX** — 구 flat 키 resume 폴백 테스트 추가 |
| 7 | Documentation | readExtractionWatermark JSDoc 미확인 | **확인** — JSDoc 이미 존재(신 namespace 우선/폴백/undefined 계약 기술됨) |

## 참고 (INFO) — 채택분
- #9 readExtractionWatermark seq=0 경계 테스트 → **추가**
- #10 updateSummaryState undefined 초기화 테스트 → **추가**
- #11 memoryState 병합 시 타 키 보존 테스트 → **추가**
- #3 updateSummaryState "두 필드 함께" JSDoc → **추가**
- #5 hydrateState IIFE → const 분리 → **적용**
- #12 saveMemories embedCfgSource JSDoc → **추가**
- #15 wmOf → extractionWatermark 개명 → **적용**
- 나머지 INFO(SQL dim 재검증·Zod·narrow 타입·whereClause 공백 등) → 현 상태 안전, 비채택(근거: 화이트리스트/typeof 방어 충분, 규모 영향 미미)

## 에이전트별 위험도
security LOW · performance NONE(thread 단일읽기 개선) · architecture LOW · requirement LOW(SPEC-DRIFT) · side_effect LOW · maintainability LOW · testing LOW · documentation LOW. scope = 출력 미착지(재시도 필요 — 변경 성격상 scope creep 없음: diff 14파일 전부 메모리 모듈 한정).

## 권장 조치 → 처리
1. SPEC-DRIFT spec 갱신 (FIX, 본 PR — SPEC-DRIFT back-flow)
2. buildCosineMatch 파라미터 순서 테스트 (FIX)
3. IE hydrateState 폴백 테스트 (FIX)
4. readExtractionWatermark JSDoc (이미 존재)
5. AgentMemoryAdminService 분리 (이월 — Batch 3)
6. saveMemories/updateSummaryState JSDoc (FIX)
7. 소형 품질개선: IIFE→const, wmOf 개명 (적용)

상세 처리·커밋 매핑: RESOLUTION.md
