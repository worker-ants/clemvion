# RESOLUTION — fix-carousel-waiting-status-4d4ed3 / 2026-06-06/13_57_06

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | spec (SPEC-DRIFT) | d6a84827 (draft 위임) | `plan/in-progress/spec-update-execution-engine-pre-park-window.md` — spec §1.1 에 pre-park read-window 정규화 항목 추가 제안 |
| #2 | spec (SPEC-DRIFT) | d6a84827 (draft 위임) | 위 동일 draft — frontend defense-in-depth 전략 spec 기재 제안 (#1+#2 통합) |
| #3 | 코드 | ecc17b15 | `isNodeWaitingForInput` JSDoc 에 "조건 변경 시 backend `reconcilePreParkWaitingStatus` 동기 변경 필요" + 의도적 중복 방어 레이어 연결고리 명시 |
| #4 | 코드 | ecc17b15 | `reconcilePreParkWaitingStatus` pure function 전환 — in-place mutation 제거, `map({...ne, status})` 반환. `'waiting_for_input'` 하드코딩 → `NodeExecutionStatus.WAITING_FOR_INPUT` enum. `snapshotCache` 참조 오염 방지. `nodeExecutions:reconciledNodeExecutions` 로 교체 |

## INFO 항목 조치 현황

| INFO # | 카테고리 | 조치 |
|--------|----------|------|
| #1 | 테스팅 | ecc17b15 — backend `status='pending'` + 봉투 케이스 test 추가; frontend PENDING 분기 test 추가 |
| #2 | 테스팅 | ecc17b15 — `isNodeWaitingForInput` 직접 unit 테스트 9개 (경계값 + terminal 제외 + null/undefined 가드) |
| #3 | 테스팅 | ecc17b15 — form/ai_agent nodeType intra-row 정규화 테스트 추가 |
| #4 | 테스팅 | ecc17b15 — 복수 nodeExecutions 혼합 케이스 (completed+inconsistent 공존) 테스트 추가 |
| #5 | 테스팅 | ecc17b15 — prevStatus=waiting 첫 intra-row 케이스에 per-node nodeStatuses 단언 추가 |
| #6 | 문서화 | 이미 clean (main 이 선행 처리 확인 — 아티팩트 없음) |
| #7 | 유지보수 | INFO only — JSDoc 길이 압축은 W4 pure function 전환으로 @param/@returns 태그 추가하여 부분 개선 |
| #8 | 유지보수 | ecc17b15 — `'waiting_for_input'` → `NodeExecutionStatus.WAITING_FOR_INPUT` enum (reconcile 함수 내부) |
| #9 | 유지보수 | ecc17b15 — 신규 reconcile 테스트 2개 `mockReturnValue` → `mockReturnValueOnce` 통일 |
| #10 | 아키텍처 | INFO only — export 캡슐화는 기록. 변경 없음 (직접 unit 테스트 추가로 테스트 커버리지는 보강) |
| #11–#15 | 기타 | INFO only — 추적 기록. 코드 변경 없음 |

## TEST 결과

- lint  : 통과 (35s)
- unit  : 통과 (6343 backend + 181 frontend passed)
- e2e   : 통과 (175/175)

## 보류·후속 항목

- **SPEC-DRIFT 위임**: `plan/in-progress/spec-update-execution-engine-pre-park-window.md`
  — spec/5-system/4-execution-engine.md §1.1 원자성 보장 섹션에 pre-park read-window
  정규화 (backend) + frontend defense-in-depth 전략을 기술하는 2개 항목 통합 draft.
  project-planner 가 `/consistency-check --spec` 후 반영 필요.
- INFO#10 (export 캡슐화): 배럴 제외 또는 공유 유틸 이전은 별도 리팩토링으로 추적.
- INFO#12 (e2e JWT 시크릿): 운영 유입 없음 확인됨 (테스트 전용). 주기 확인 권고만.
