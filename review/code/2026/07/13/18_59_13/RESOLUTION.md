# Resolution — edge §4.1 엣지 분할 ai-review 2회차 (2026-07-13 18:59)

원 위험도 **MEDIUM** (CRITICAL 0 + WARNING 4). 1회차 CRITICAL(컨테이너 새 노드 body 재편입)은 `isContainer` 가드로 해소됨을 requirement·architecture 가 코드 대조로 재확인. disk-write gap(architecture/user_guide_sync) journal 복구 → architecture=LOW(구조적 관심 2건, 현 안전), user_guide_sync=NONE(가이드 4파일 갱신 완료 확인).

## Warning

| # | 카테고리 | 발견 | 조치 |
|---|----------|------|------|
| 1 | REVIEW-GAP | architecture·user_guide_sync disk-write gap | **복구** — journal.jsonl 에서 전문 복구·디스크 기록. architecture=LOW(핸들명 정밀도·비원자성 = 1회차 대응한 구조적 관심, 신규 결함 아님), user_guide_sync=NONE. 숨은 CRITICAL/WARNING 없음. |
| 2 | 테스트 | `onDrop` 통합 배선(removeEdge→onConnect×2 시퀀스) 미실행 테스트 | **반영** — `editor-store.test.ts` "엣지 분할 store 시퀀스" describe: **plain 분할 → onConnect 2회 성공, 최종 엣지 A→N·N→B 2개** 테스트로 원자성 불변식을 assertion 으로 고정(배선 회귀 가드). |
| 3 | 테스트 | 컨테이너 body 내부 체인 엣지 분할 시 새 노드 containerId 상속 미검증 | **반영** — 같은 describe: **Loop body 내부 체인(L.body→A→B→L.emit) 분할 시 새 노드 N 이 containerId `L` 상속**(removeEdge 전역 재도출 + onConnect Rule 3 조합) 통합 테스트. 실행 확인 통과. |
| 4 | UX/부작용 | `onDrop` 이 예고 없이 "노드 추가"→"엣지 분할" 전환, 20px 히트 폭 내 근접 드롭 시 의도치 않은 분할 가능 | **이월(후속 개선, 비차단)** — spec·유저가이드에 의도 동작으로 문서화됨. 드래그 중 대상 엣지 하이라이트 프리뷰는 별도 UX 개선 task(`task_78c80fec`)로 분리. |

## INFO(반영/이월)
- (arch #1 / maint) "컨테이너 경계" 를 핸들명으로 판정 — `body`·`emit` 은 컨테이너 전용 예약 핸들(emit 은 `RESERVED_INPUT_HANDLE_IDS`)이라 핸들명만으로 정밀함을 JSDoc 에 명시. store 의 node-type+핸들 방식과 정밀도 동일(경계 판정엔 노드 타입 불필요) → node-aware 재구현은 over-coupling 이라 미채택.
- (arch #2 / side_effect #5) removeEdge→onConnect×2 비원자성 = 구조적 부채. CRITICAL 수정 + 원본 body/emit 제외로 두 onConnect 가 거부 분기에 걸릴 수 없어 현재 안전(#2 통합 테스트가 이 불변식을 lock). `evaluateConnection` 확장 PR 시 `buildEdgeSplitPlan` 게이트 동반 갱신 필요를 JSDoc/spec 에 기록. 별도 store 원자 액션은 현 시점 over-engineering.
- (maint #4/#6) onDrop 인라인 오케스트레이션 비대화·`SplitConnection`↔`Connection` 중복·매직스트링 → `task_78c80fec`(훅 추출 포함)·후속 정리 이월.

## 검증
- tsc `--noEmit` clean · edge-utils+editor-store **156 passed**(통합 2 추가) · eslint 0 errors(잔여 1 warning=기존 aria, 무관) · e2e 44 suites/253 · fresh `/ai-review` 3회차로 수렴 확인.
