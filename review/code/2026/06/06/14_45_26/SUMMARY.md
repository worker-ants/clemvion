# Code Review 통합 보고서 (2차 — resolution-applier fix 포함 최종 상태)

## 전체 위험도
**LOW** — Carousel/blocking 노드 pre-park window intra-row inconsistency 버그 수정 PR. Critical 발견 없음. WARNING 3건(SPEC-DRIFT 2 + backend JSDoc 역방향 참조 누락 1)은 코드 동작 정확성에 영향 없는 유지보수성 사항이며, SPEC-DRIFT 2건은 spec 갱신 위임 완료.

---

## Critical 발견사항
해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | SPEC-DRIFT | spec §1.1 "원자성 보장"이 pre-park window intra-row inconsistency + `reconcilePreParkWaitingStatus` 보정 전략 미기술. 코드는 올바름, spec 이 낡음 | spec/5-system/4-execution-engine.md §1.1 | 코드 유지. spec-update draft 로 project-planner 위임 (사용자 결정 — 후속 분리) |
| W2 | SPEC-DRIFT | frontend `isNodeWaitingForInput` 2차 defense-in-depth 전략 spec 미기재 | apply-execution-snapshot.ts JSDoc; spec §1.1 | 코드 유지. W1 과 동일 draft 통합 (후속 분리) |
| W3 | MAINTAINABILITY | `isNodeWaitingForInput`→backend 정방향 cross-ref 는 있으나, backend `reconcilePreParkWaitingStatus`→frontend 역방향 연결고리 없음. backend 부터 보는 개발자가 frontend 동기화 요건 놓칠 수 있음 | executions.service.ts `reconcilePreParkWaitingStatus` JSDoc | JSDoc 에 "조건 변경 시 frontend `apply-execution-snapshot.ts: isNodeWaitingForInput` 도 동일 변경 필요(의도적 중복 방어)" 한 줄 추가 → **본 PR 처리** |

---

## 참고 (INFO) — 요약
- I1 ARCH: 두 레이어 독립 판정 사본, 컴파일타임 강제 없음 → W3 역방향 ref + spec invariant 로 완화. 장기 e2e 드리프트 탐지 후보.
- I2 ARCH: `{...ne, status}` shallow copy — 현재 status 만 교체라 문제 없음. 향후 outputData 정규화 시 deep copy 필요(JSDoc 보완 권고).
- I3 ARCH: `isNodeWaitingForInput` export — barrel 재노출 확인 후보(리팩토링).
- I4 ARCH: free function 배치 적절, 파일 크기 임계 시 utils 추출 후보.
- I5 ARCH: blocking outputData envelope 계약 spec 미명시 → spec-update draft 에 포함 권고.
- I6 REQ: `findByWorkflow` list 경로 미적용 — 의도된 동작(빈 배열).
- I7 REQ: PENDING 포함은 방어적·의도적.
- I8 TEST: backend `ai_agent` nodeType 픽스처 부재(nodeType 무관 함수) — 코멘트/케이스 권고.
- I9 TEST: 첫 intra-row 케이스(prevStatus=waiting wipe 차단)에 per-node nodeStatuses 단언 누락 → **본 PR 보강**.
- I10 DOC: backend/frontend JSDoc spec 참조 형식 불일치.
- I11 DOC: spec §1.1 갱신 전 링크 공백(후속 plan 위임 명시).
- I12 SEC: e2e fallback JWT — 기존 값, 포맷 변경만. env 우선 패턴 보호.
- I13 CONC: pre-park window 자체는 존속(read-side 정규화로 신규 동시성 위험 없음). 근본 제거는 후속(두 save 단일 트랜잭션).
- I14 SCOPE: e2e 포맷 변경 3줄 혼재 — 미미, 허용.
- I15 MAINT: plan 체크리스트 완료이나 plan/complete 이동 미수행 — follow-up(spec-update) 존재로 in-progress 유지(의도).

---

## 에이전트별 위험도
| 에이전트 | 위험도 | 핵심 |
|----------|--------|------|
| security | NONE | 신규 취약점 없음. read-side 정규화 DB write 없음 |
| architecture | LOW | 두 레이어 독립 판정 사본(연결고리 주석 수준). pure function/enum 적절 |
| requirement | LOW | SPEC-DRIFT 2(위임). 기능 요구 충족 |
| scope | LOW | 변경 파일 전부 목적/규약 산출물 |
| side_effect | LOW | pure function, DB write 없음, 신규 race 없음 |
| maintainability | LOW | backend JSDoc 역방향 ref 누락(W3) |
| testing | LOW | ai_agent 픽스처·첫 케이스 per-node 단언(INFO) |
| documentation | LOW | JSDoc 참조 형식 불일치(INFO). XML 아티팩트 해소 확인 |
| concurrency | NONE | 신규 동시성 위험 없음 |

---

## 권장 조치 / 처리
1. **[W3 — 본 PR]** backend `reconcilePreParkWaitingStatus` JSDoc 역방향 cross-ref 추가.
2. **[W1/W2 — 후속]** spec §1.1 갱신은 사용자 결정대로 spec-update draft 로 project-planner 위임.
3. **[I9 — 본 PR]** 첫 intra-row 테스트 per-node nodeStatuses 단언 추가.
4. 나머지 INFO 는 추적 기록(후속/선택).

라우터: 실행 8명(router_safety 강제 포함), 제외 6명(performance/dependency/database/concurrency/api_contract/user_guide_sync — 라우터 선별).
</content>
