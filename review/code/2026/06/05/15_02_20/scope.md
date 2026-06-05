# 변경 범위(Scope) 리뷰 결과

**리뷰 대상**: PR-B1 — form/button park-release + slow-path 일원화  
**리뷰 일시**: 2026-06-05

---

## 발견사항

### **[INFO]** consistency-check 산출물(파일 7~12)이 PR-B1 코드 변경과 함께 커밋에 포함됨
- 위치: `review/consistency/2026/06/05/13_59_30/` — SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md, naming_collision.md, meta.json (파일 7~12)
- 상세: 이 파일들은 `--impl-prep` consistency-check 의 산출물로, CLAUDE.md §정보 저장 위치 규약("일관성 검토 산출물: `review/consistency/<ISO>/`")에 따라 정당하게 포함될 수 있다. 단, 이 산출물들은 PR-B1 구현 코드 변경(파일 1~6)과 동일 커밋에 묶여 있어 커밋 단위가 혼합되어 있다. 기능 변경과 워크플로 산출물이 섞인 것은 범위 혼용이지만, 프로젝트 규약이 이를 명시적으로 허용 또는 강제하는 구조이므로 위반은 아니다.
- 제안: 허용 범위 내. 다만 코드 변경(파일 1~6)과 review 산출물(파일 7~12)을 별도 커밋으로 분리하면 이력 가독성이 향상된다.

### **[INFO]** `plan/in-progress/exec-park-durable-resume.md` 갱신이 PR-B1에 포함됨 (파일 6)
- 위치: `plan/in-progress/exec-park-durable-resume.md` — Phase B 체크박스 상태 갱신, PR-B1/B2 분할 결정, D3/D5 확정 기록
- 상세: 계획 파일 갱신은 CLAUDE.md §정보 저장 위치("진행 중 작업: `plan/in-progress/<name>.md`")의 정규 범위다. PR-B1 완료로 B1 체크박스를 `[x]`로 전환하고, B1/B2 분할 결정 및 D3/D5 확정을 기록한 것은 작업 범위에 부합한다.
- 제안: 해당 없음. 정상 범위.

### **[INFO]** 테스트 헬퍼 함수 `flushResumeDrive` 및 `armSlowPathResume` 신규 추가 (파일 3)
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `flushResumeDrive()`, `armSlowPathResume()` 함수 신규 정의
- 상세: 두 헬퍼 모두 PR-B1의 slow-path 재개(rehydration) 경로를 테스트하기 위해 반드시 필요한 테스트 인프라다. `armSlowPathResume`은 기존 `flushPromises()`로는 검증 불가한 detached 드라이브 완료를 처리하고, slow-path DB lookup mock을 무장한다. 이는 기능 확장이 아니라 변경된 구현을 정확히 커버하는 테스트 보조 코드다.
- 제안: 해당 없음. 범위 내 필수 추가.

---

## 요약

변경 범위 관점에서 PR-B1은 plan에서 정의된 목표("form/button park-release + slow-path 일원화 + `applyCancellation` async 전환")에 정확히 부합한다. 파일 1~2(processor: `void` → `await`, spec 주석 갱신)는 직접 목표, 파일 3~4(서비스 및 스펙 파일: `PARK_RELEASED` sentinel, `ParkMode` 타입, `cancelParkedExecution`, `runNodeDispatchLoop` 반환 타입, 테스트 갱신)는 기능 변경의 필수 연계 수정이다. 파일 5(신규 e2e 테스트)는 plan에서 "dockerized e2e 필수" 로 명시된 요건의 이행이다. 불필요한 리팩토링, 무관한 파일 수정, 의미 없는 포맷팅 변경, 사용하지 않는 임포트 추가 등은 발견되지 않았다. review 산출물(파일 7~12)과 plan 갱신(파일 6)의 동일 커밋 포함은 프로젝트 규약 내 허용 범위이며 INFO 수준의 가독성 제안만 해당된다.

---

## 위험도

NONE
