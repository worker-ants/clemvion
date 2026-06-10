## 발견사항

- **[INFO]** `syncScheduleActivation()` 설계 선택에 대한 Rationale 미작성
  - target 위치: `plan/in-progress/spec-update-trigger-schedule-sync.md` §갱신 대상 4곳 전반
  - 과거 결정 출처: `spec/data-flow/10-triggers.md ## Rationale` — 역방향 동기화 구현 방법에 대한 항목 없음
  - 상세: target 은 `syncScheduleActivation()` 이라는 private 메서드 경유 방식으로 역방향 동기화를 구현한 사실만 명시한다. 이 메서드를 별도 추출한 이유, "update() 내 inline" 대신 "private method" 로 분리한 설계 선택의 근거가 `spec/data-flow/10-triggers.md ## Rationale` 에 새 항으로 추가되지 않는다. 기존 Rationale 에 해당 항목이 없었으므로 CRITICAL/WARNING 은 아니지만, 향후 리뷰어가 왜 `syncScheduleActivation()` 가 별도 메서드로 존재하는지 spec 에서 확인할 수 없다.
  - 제안: `spec/data-flow/10-triggers.md ## Rationale` 에 "역방향 동기화 `syncScheduleActivation()` 추출 이유" 항 1개 추가. "triggers.service.ts update() 와 remove() 두 경로에서 동일 로직(schedule.is_active 저장 + registerJob/removeJob 분기)을 재사용하므로 private 메서드로 추출" 정도로 충분.

## 요약

target 문서가 제안하는 4곳의 "구현 갭" 표기 제거·현행화는 기존 `spec/1-data-model.md §2.9.1` 의 "역방향도 동일" 계약 원문을 오히려 이행 완료 상태로 복원하는 작업이다. `spec/2-navigation/2-trigger-list.md` R-4(PATCH body 단일 경로, /toggle 미채택)·R-16(isActive drawer read-only)·`spec/0-overview.md §2.4`(BullMQ invariant)·`spec/data-flow/10-triggers.md §1.3`(process()는 schedule.is_active 만 확인) 등 기존 모든 Rationale 결정과 충돌하지 않는다. 기각된 대안의 재도입·합의 원칙 위반·무근거 번복·invariant 우회는 발견되지 않았다. 유일한 보완 사항은 `syncScheduleActivation()` 설계 선택을 Rationale 에 명문화하지 않는다는 점(INFO 수준)이다.

## 위험도

LOW
