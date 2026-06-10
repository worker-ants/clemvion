# Rationale 연속성 검토 결과

검토 범위: `spec/2-navigation/` (diff vs origin/main)  
변경 파일: `1-workflow-list.md`, `2-trigger-list.md`, `3-schedule.md`  
검토 일시: 2026-06-10

---

## 발견사항

- **[INFO]** `1-workflow-list.md` — 상태 필터 버그 경고 제거 (코드 수정 완료 반영)
  - target 위치: `spec/2-navigation/1-workflow-list.md §2.3` 필터 경고 주석
  - 과거 결정 출처: 해당 파일 §2.3 내 ⚠️ 경고 ("서버 계약·클라이언트가 어긋난 파라미터를 보낸다")
  - 상세: 기존에 `?isActive=` vs `?status=` 불일치를 코드 버그로 명시한 경고 주석을 "수정 완료" 서술로 교체했다. Rationale 에 기각된 대안이 아니라 기존 버그 수정 완료 반영이므로 continuity 충돌 없음. 다만 이 변경을 뒷받침하는 Rationale 항목이 파일 내에 없다 — 향후 동일 spec 을 읽는 사람이 "왜 경고가 사라졌는가"를 알 수 없다.
  - 제안: `1-workflow-list.md ## Rationale` 에 "상태 필터 파라미터 불일치 수정 완료(날짜)" 한 항목을 추가해 변경 이력을 남길 것을 권장.

- **[INFO]** `2-trigger-list.md` — Schedule 삭제 시 BullMQ `removeJob` 명시 추가
  - target 위치: `spec/2-navigation/2-trigger-list.md §4.3` 삭제 정책 불릿
  - 과거 결정 출처: `spec/data-flow/10-triggers.md §1.4 Schedule ↔ Trigger 동기화` (이미 `removeJob` 명시)
  - 상세: `data-flow/10-triggers.md §1.4` 는 이미 Trigger 삭제 시 `removeJob` 호출을 명세하고 있으며, 2-trigger-list.md 변경은 동일 내용을 UI spec 레이어에도 노출한 것이다. 기존 결정과 완전히 일치하며 기각된 대안의 재도입이 아니다.
  - 제안: 충돌 없음. 다만 "양방향 동기화 SoT" 링크(`data-flow §1.4`)로의 참조를 이미 포함하고 있어 단일 진실 원칙도 충족된다.

- **[INFO]** `3-schedule.md §3` — Trigger 화면 토글이 `schedule.is_active` 와 BullMQ job 을 함께 갱신한다는 내용 추가
  - target 위치: `spec/2-navigation/3-schedule.md §3 Trigger 자동 생성 규칙`
  - 과거 결정 출처: `spec/data-flow/10-triggers.md §1.4` (양방향 동기화 계약 — trigger API PATCH `{ isActive }` → `syncScheduleActivation()` → schedule.is_active + BullMQ)
  - 상세: data-flow spec 의 기존 결정을 schedule.md 로 인용·확인한 것이다. 기각된 대안 재도입 없음.

- **[INFO]** `3-schedule.md §4` — `GET /api/schedules` sort/order "미구현/Planned" 표기 해제
  - target 위치: `spec/2-navigation/3-schedule.md §4 API` 첫 번째 행
  - 과거 결정 출처: 해당 파일 구 §4 ⚠️ 경고 ("sort/order 반영은 미구현/Planned")
  - 상세: 구 spec 의 "Planned" 는 기각된 대안이 아니라 미구현 사실 표기였다. 이번 변경은 구현이 완료됐음을 반영해 표기를 해제한 것이며, 새로 추가된 `## Rationale` 섹션("sort/order 쿼리 반영 — 미구현/Planned 표기 해제 (2026-06-10)")이 이유를 명시하고 있다. Rationale 절차 완전 준수.

- **[INFO]** `3-schedule.md §3 제약` — Trigger 화면 삭제 경로 상세 추가
  - target 위치: `spec/2-navigation/3-schedule.md §3 제약` 두 번째 불릿
  - 과거 결정 출처: `spec/data-flow/10-triggers.md §1.4`
  - 상세: 기존 data-flow spec 이 이미 정의한 동작(`removeJob` → FK CASCADE 삭제)을 schedule.md 제약 설명에도 노출한 것이다. SoT 링크가 포함되어 있으며 기존 결정과 일치한다.

---

## 요약

이번 `spec/2-navigation/` 변경 3건(workflow-list, trigger-list, schedule)은 모두 구현 완료 후 spec 동기화 성격의 수정이다. 기각된 대안의 재도입, 합의된 원칙 위반, 무근거 결정 번복은 발견되지 않았다. trigger-list 의 `removeJob` 추가와 schedule 의 BullMQ 동기화 세부 설명은 `data-flow/10-triggers.md §1.4` 에 이미 합의된 결정을 UI spec 레이어로 연결한 것이며 SoT 링크를 동반하고 있다. schedule.md 의 sort/order Planned 해제는 신규 `## Rationale` 섹션을 함께 추가해 번경 근거를 명문화했다. workflow-list.md 의 상태 필터 경고 제거는 Rationale 기록이 없어 소규모 INFO 권고 수준이나 결정 번복 수준의 위험은 아니다.

---

## 위험도

NONE
