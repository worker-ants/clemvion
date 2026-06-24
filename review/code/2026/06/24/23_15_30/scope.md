# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] 주석 변경 — 삭제된 early-return 에 대한 기존 주석 제거 및 신규 JSDoc 교체
- 위치: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts` `registerInFlight` JSDoc
- 상세: 기존 주석 "shutdown 진행 중이면 무시 (이미 큐 consume 중단된 상태로 새 진입은 없음 — race 대비 가드)" 를 제거하고, early-return 제거의 기술적 근거·§11.2/§4.2 참조·multi-instance stall 사유를 기술한 JSDoc 블록으로 교체했다. 이는 early-return 제거와 직접 연동된 주석이므로 불필요한 주석 변경이 아니라 코드 의도 설명의 필수 갱신이다.
- 제안: 조치 불요.

### [INFO] 테스트 케이스 완전 교체 — 기존 'shutdown 중 register 무시(멱등)' 테스트 삭제 후 신규 단언으로 대체
- 위치: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.spec.ts` diff 라인 60~89
- 상세: 삭제된 early-return 을 검증하던 `'shutdown 중 register 호출은 무시 (멱등)'` 테스트가 제거되고, 동일 위치에 `'shutdown 중(세그먼트 완료 진행 중) register 된 노드도 추적되어 grace 만료 시 마킹된다'` 테스트로 교체되었다. 기존 테스트는 이번 변경으로 삭제된 동작(`inFlightCount === 0` 단언)을 검증했으므로, 삭제 자체가 이번 범위의 일부다. 신규 테스트도 동일 범위(M-2 드리프트 수정) 내에서 새 동작(ne-early + ne-late WHERE 절 포함)을 단언한다.
- 제안: 조치 불요.

### [INFO] review/consistency/2026/06/24/22_32_23/ 하위 파일 다수 포함 — impl-prep 산출물 커밋 동반
- 위치: `review/consistency/2026/06/24/22_32_23/SUMMARY.md`, `_retry_state.json`, `convention_compliance.md`, `cross_spec.md`, `naming_collision.md`, `plan_coherence.md`, `rationale_continuity.md`, `meta.json`
- 상세: consistency-check --impl-prep 결과물 8개가 구현 커밋과 동일 커밋에 포함되어 있다. review/** 산출물은 `review/consistency/**` 경로에 허용되며 이 경우 그 규칙을 따른다. consistency-check 출력이 구현 변경과 동일 커밋에 있어 "impl-prep 완료 후 구현" 순서를 증명하는 맥락에서 의도된 포함이다.
- 제안: 조치 불요.

## 요약

이번 변경(M-2)은 `ShutdownStateService.registerInFlight` 의 early-return 한 줄 제거라는 극히 좁은 구현 범위를 가진다. 실제 코드 변경은 `shutdown-state.service.ts` 의 4줄 제거와 그에 동반된 JSDoc 교체로 완전히 범위 내에 있으며, 테스트 변경도 삭제된 동작 검증 테스트를 신규 동작 검증 테스트로 1:1 교체한 것으로 현재 작업과 직접 연동된다. 불필요한 리팩토링, 기능 확장, 무관한 파일 수정, 임포트 변경, 설정 변경은 전혀 없다. 포맷팅 변경도 발견되지 않았다. 동일 커밋에 포함된 consistency-check 산출물 8개는 해당 프로젝트의 impl-prep 의무 절차에서 자동 생성된 것으로 의도하지 않은 영역 수정에 해당하지 않는다.

## 위험도

NONE
