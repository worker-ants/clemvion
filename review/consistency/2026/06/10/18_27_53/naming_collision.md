# 신규 식별자 충돌 검토 결과

검토 범위: `spec/2-navigation/` (구현 완료 후 검토, diff-base=origin/main)
실제 변경 파일: `spec/1-data-model.md`, `spec/2-navigation/2-trigger-list.md`, `spec/2-navigation/3-schedule.md`, `spec/data-flow/10-triggers.md`, `plan/in-progress/` 신규 4개 파일

---

## 발견사항

### 1. 충돌 없음 — `syncScheduleActivation()` 메서드명

- target 신규 식별자: `syncScheduleActivation()` — `spec/data-flow/10-triggers.md §1.4` 및 Rationale 에서 언급된 `TriggersService` 의 private 메서드명
- 기존 사용처: `spec/` 트리 어디에도 이 이름이 존재하지 않았음 (origin/main 기준). 코드베이스에는 `codebase/backend/src/modules/triggers/triggers.service.ts` 에 실제 구현됨 — spec 이 코드와 일치하는 정상 상태
- 상세: 기존 spec 에 없던 이름이며, 유사한 이름(`registerJob`, `removeJob` 등 BullMQ 관련 메서드)과 의미 혼동 없음. `registerJob`/`removeJob` 은 `ScheduleRunnerService` 의 public 메서드이고, `syncScheduleActivation` 은 이를 호출하는 `TriggersService` private wrapper — 역할 분리가 명확
- 제안: 해당 없음 (충돌 없음)

### 2. 충돌 없음 — `#14-schedule--trigger-동기화` 앵커

- target 신규 식별자: `[data-flow §1.4](../data-flow/10-triggers.md#14-schedule--trigger-동기화)` 형태의 링크가 `spec/1-data-model.md`, `spec/2-navigation/2-trigger-list.md`, `spec/2-navigation/3-schedule.md` 에 새로 추가됨
- 기존 사용처: `spec/data-flow/10-triggers.md` 의 `### 1.4 Schedule ↔ Trigger 동기화` 섹션 헤딩은 origin/main 에 이미 존재 — 앵커 자체는 신규가 아님. 해당 링크를 새로 참조하는 것만 추가됨
- 상세: 기존 앵커를 새 문서에서 참조하는 것이므로 충돌 없음. 앵커 텍스트가 기존 헤딩과 일치하는지 확인 완료: `### 1.4 Schedule ↔ Trigger 동기화` → 마크다운 슬러그 `#14-schedule--trigger-동기화` 로 정합
- 제안: 해당 없음

### 3. 충돌 없음 — `TriggerStateChangedEvent`

- target 신규 식별자: `TriggerStateChangedEvent` — `spec/data-flow/10-triggers.md` Rationale 섹션에서 **기각된 대안**으로만 언급됨. 실제로 도입되지 않음
- 기존 사용처: 코드베이스 및 spec 어디에도 이 이름이 존재하지 않음
- 상세: 이 이름은 spec 의 Rationale "이벤트 방식 vs private 메서드 방식 선택" 근거 서술에서 폐기된 선택지로 등장. 신규 식별자로 도입된 것이 아니므로 충돌 검토 대상 아님
- 제안: 해당 없음

### 4. 충돌 없음 — plan 파일 두 개가 동일 주제를 다룸

- target 신규 식별자: `plan/in-progress/trigger-schedule-reverse-sync.md` (owner: developer) 와 `plan/in-progress/spec-update-trigger-schedule-sync.md` (owner: resolution-applier)
- 기존 사용처: 두 파일 모두 신규 (origin/main 에 없음). `plan/complete/` 에도 동명 파일 없음
- 상세: 두 파일이 동일 구현 갭(역방향 동기화)을 다루지만 역할이 다름 — `trigger-schedule-reverse-sync.md` 는 구현 tracking 플랜(개발자), `spec-update-trigger-schedule-sync.md` 는 spec 표기 갱신 draft(resolution-applier). 이름이 겹치지 않고 role 이 분리되어 있으므로 충돌 없음. 다만 두 파일이 모두 `in-progress` 에 남는 경우 관리 부담이 있을 수 있음 (INFO)
- 제안: (INFO) 구현 tracking 플랜(`trigger-schedule-reverse-sync.md`) 은 체크리스트가 모두 완료됐으므로 `plan/complete/` 로 이동을 검토. spec update draft(`spec-update-trigger-schedule-sync.md`) 는 spec 변경이 이미 반영됐으므로 마찬가지로 이동 대상

### 5. INFO — `spec/2-navigation/3-schedule.md` Rationale 섹션 신규 추가

- target 신규 식별자: `spec/2-navigation/3-schedule.md` 에 `## Rationale` 섹션이 새로 추가됨 (2개의 subsection 포함)
- 기존 사용처: origin/main 에는 해당 파일에 `## Rationale` 가 없었음. 동일 영역 다른 파일(`2-trigger-list.md`, `14-execution-history.md` 등)은 이미 `## Rationale` 를 가짐
- 상세: spec 문서 3섹션 컨벤션(Overview / 본문 / Rationale)에 맞게 추가된 것으로, 충돌 없음. 명명 컨벤션 준수
- 제안: 해당 없음

---

## 요약

이번 target(trigger-schedule 역방향 동기화 갭 해소에 따른 spec 갱신)이 도입하는 신규 식별자는 다음과 같다: `syncScheduleActivation()` 메서드명 언급, `#14-schedule--trigger-동기화` 앵커 추가 참조, `## Rationale` 신규 섹션, plan 파일 4개 신규. 이 중 기존 사용처와 의미 충돌을 일으키는 식별자는 없다. `syncScheduleActivation`은 코드베이스에 실제 구현된 이름과 일치하며, 앵커는 이미 존재하는 섹션을 가리키고, `TriggerStateChangedEvent`는 도입이 아닌 기각 근거 서술에만 등장한다. plan 파일 중복 주제 건은 문서 관리 편의 차원의 INFO 수준 관찰이다.

---

## 위험도

NONE
