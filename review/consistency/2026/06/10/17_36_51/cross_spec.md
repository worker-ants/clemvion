# Cross-Spec 일관성 검토 결과

대상: `plan/in-progress/spec-update-trigger-schedule-sync.md`
검토 기준: spec draft (--spec)

---

## 발견사항

### [WARNING] §1.4 표 행 배치 — "Schedule 삭제" Trigger 컬럼에 Trigger-API 삭제 동작 혼재

- target 위치: draft §2 `spec/data-flow/10-triggers.md §1.4` 표, "Schedule 삭제" 행의 Trigger 컬럼
- 충돌 대상: `spec/data-flow/10-triggers.md §1.4` 현재 표 구조 (이벤트 = 발화 주체 기준 행 분류)
- 상세: 현행 §1.4 표의 이벤트 컬럼은 "발화 주체(Schedule-side / Trigger-side)" 기준으로 행을 분리한다. "Schedule 삭제" 행은 Schedule API가 삭제 이벤트를 발화한 경우를 설명하는 행이다. draft의 "After"는 이 행의 Trigger 컬럼에 `DELETE /api/triggers/:id` (Trigger-API-initiated 삭제) 의 동작을 추가한다. 결과적으로 행 헤더("Schedule 삭제")와 컬럼 내용("Trigger 삭제 시 removeJob") 이 의미상 교차되어, 독자가 "Schedule 삭제 이벤트"를 읽으면서 "Trigger 삭제 API 호출 시 동작"을 동시에 읽게 된다.
- 제안: `Trigger(type='schedule') 직접 생성` 행이 이미 있는 패턴과 동일하게, `Trigger(type='schedule') 삭제` 행을 **별도 행**으로 추가해 Trigger-API-initiated 삭제 동작을 명확히 분리하는 방향이 바람직하다. 현재 draft는 이 행을 추가하지 않고 기존 "Schedule 삭제" 행의 Trigger 컬럼에 혼재시킨다. 채택 시 표 구조 일관성이 향상되며, `spec/2-navigation/2-trigger-list.md §4.3 cascade 동작` 표와도 정합성이 높아진다.

---

### [INFO] §1.3 주석 내 갭 언급 — 현행 파일에 "Before" 텍스트 부재

- target 위치: draft §2 `spec/data-flow/10-triggers.md §1.3` 수정 (줄 124 부근)
- 충돌 대상: `spec/data-flow/10-triggers.md` 현재 §1.3 하단 Note
- 상세: draft의 "Before" 텍스트(§1.3 > 주석 내 갭 언급, "동기화는 Schedule→Trigger 정방향만 구현 — §1.4 구현 갭 참조")가 현행 파일에 존재하지 않는다. 현행 파일 §1.3 해당 Note는 이미 "둘은 §1.4 에서 양방향 동기화"로 표현되어 있다. draft가 변경하려는 "Before" 텍스트는 이미 이전 업데이트에서 제거된 상태다.
- 제안: 이 항목의 변경은 이미 적용되었거나 불필요하다. 적용 전 현행 파일을 재확인해 불필요한 편집을 방지할 것.

---

### [INFO] §1.4 구현 갭 blockquote — 현행 파일에 "Before" 텍스트 부재

- target 위치: draft §2 `spec/data-flow/10-triggers.md §1.4` 구현 갭 blockquote 제거
- 충돌 대상: `spec/data-flow/10-triggers.md` 현재 §1.4
- 상세: draft의 "Before" blockquote ("구현 갭 — 역방향(Trigger→Schedule) 동기화 부재")가 현행 파일에 존재하지 않는다. §1.4 전체를 확인한 결과 해당 blockquote는 이미 제거된 상태이며, §3.1도 이미 "양방향"으로 표현되어 있다. 마찬가지로 `spec/1-data-model.md §2.9.1`과 `spec/2-navigation/3-schedule.md §3.1`의 "미구현 — 구현 갭" 텍스트도 현행 파일에 존재하지 않는다.
- 제안: draft의 4개 수정 대상 중 "Before" 텍스트가 이미 현행 파일에 없는 항목은 skip하고, 아직 추가되지 않은 상세 구현 설명(`syncScheduleActivation()` 참조, `removeJob` 호출 확인)만 선택적으로 적용하는 것이 바람직하다. 일괄 적용 시 sed-style replace가 해당 텍스트를 찾지 못해 에러가 발생할 수 있다.

---

### [INFO] `spec/2-navigation/2-trigger-list.md §4.3` 후속 검토 언급

- target 위치: draft 추가 정보 섹션 "연관 spec 파일: spec/2-navigation/2-trigger-list.md §4.3 — 해당 섹션 검토 후 필요 시 추가 수정"
- 충돌 대상: `spec/2-navigation/2-trigger-list.md §4.3` cascade 동작 표
- 상세: 현행 `§4.3 cascade 동작` 표의 `schedule` 행은 "trigger가 schedule 타입이면 CASCADE 삭제"만 기술하며, Trigger-API-initiated 삭제 시 `removeJob` 호출 여부를 명시하지 않는다. 구현이 완료된 현재, 해당 cascade 표에도 "`DELETE /api/triggers/:id` 시 `removeJob` 호출 후 삭제"를 추가하는 것이 data-flow 와의 일관성을 위해 필요하다. draft는 이를 "필요 시 추가 수정" 으로만 언급한다.
- 제안: draft와 함께 `§4.3` 표를 업데이트하거나, 후속 Plan 태스크로 명시적으로 등록할 것. 현재 상태로 채택 시 `§4.3` cascade 표가 구현 현황보다 부족한 정보를 담게 된다.

---

## 요약

Cross-Spec 일관성 관점에서 이 draft는 직접 모순(CRITICAL)을 유발하지 않는다. 수정 대상 4개 파일 모두 동일 도메인(Trigger-Schedule 동기화) 을 다루며 상호 참조 링크도 올바르다. 주요 위험은 두 가지다: (1) `spec/data-flow/10-triggers.md §1.4` 표에서 "Schedule 삭제" 행 Trigger 컬럼에 Trigger-API-initiated 삭제 동작을 혼재시키는 표 구조 비일관성(WARNING), (2) draft의 "Before" 텍스트가 현행 파일에 이미 존재하지 않아 적용 시 에러 또는 이중 적용 위험(INFO). `spec/2-navigation/2-trigger-list.md §4.3` cascade 표의 미업데이트도 구현 현황 반영 완결성 측면에서 후속 처리가 필요하다.

## 위험도

LOW
