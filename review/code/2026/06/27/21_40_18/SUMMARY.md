# Code Review 통합 보고서 (fresh — resolution 커버)

> 세션 21:40:18 · 대상 Batch 2 (I3·I5·I-7·I12·W-8 + 21_13_52 RESOLUTION 적용분).
> diff-base 8c5fdf257 (merge-base). 이전 리뷰 21_13_52 의 resolution 커밋(107b7617c) 커버.

## 전체 위험도
**LOW** — Critical 0. requirement·scope 리뷰어 NONE (이전 RESOLUTION 전 항목 이행 + SPEC-DRIFT 해소 직접 확인). WARNING 5건은 방어적 하드닝·기존 백로그·거짓양성.

## Critical
발견 없음.

## 경고 (WARNING) + 처리

| # | 카테고리 | 발견 | 처리 |
|---|---|---|---|
| W-1 | API breaking / side-effect | saveMemories 옵션객체화 — 동적/spyOn 오용 시 무음 no-op 가능 | **FIX** — 런타임 가드 `typeof args !== 'object' → throw` + 테스트 추가 |
| W-2 | API contract | updateSummaryState 무조건 대입 — undefined 시 기존 값 소실 가능 | **문서로 수용** — JSDoc 계약("두 필드 함께") 추가됨. 유일 호출부는 항상 둘 다 전달. 타입 narrow 는 caller 의 `string\|undefined` 와 마찰이라 미채택 |
| W-3 | maintainability/type | buildCosineMatch 파라미터 순서 타입 미강제 | **처리완료** — recall/dedup 파라미터 순서 어설션 테스트로 계약 핀고정(리뷰어 "테스트로 고정됨" 인정) |
| W-4 | architecture/SRP | AgentMemoryService 책임 혼재 | **이월** — Batch 3 (기존 plan 백로그). buildCosineMatch 귀속은 분리 시 결정 |
| W-5 | doc/spec | spec 파일이 changeset diff 에 미포함 | **거짓양성** — 요구사항 리뷰어가 17-agent-memory.md §3·§7 4곳 `memoryState.lastExtractionTurnSeq` 갱신 직접 확인. 해소됨 |

## 참고 (INFO) — 채택분
- I-10: readExtractionWatermark 가 memoryState 원시값(오염)일 때 폴백→undefined 테스트 추가.
- 나머지 INFO(가독성 헬퍼 추출·매직넘버·공유 MemoryState 타입·dim 케이스·SoT 링크 등): 현 상태 안전·규모 미미로 비채택(근거 기재). I-3/I-8(memoryState 키 추가 시 양 핸들러 동기)·I-4(구 평면키 stale)는 후속 확장 시점 주석으로 안내.

## 에이전트별 위험도
security LOW(전부 INFO) · architecture LOW(SRP, 백로그) · requirement NONE · scope NONE · side_effect LOW · maintainability LOW · testing LOW(INFO 커버리지 갭) · documentation LOW(W-5 거짓양성) · database LOW(기존 패턴). user_guide_sync = 출력 미착지(무관 — user-guide 변경 0).

## 판정
LOW · Critical 0. W-1 fix 적용, 나머지 WARNING 처리완료/이월/거짓양성. 상세 RESOLUTION.md.
