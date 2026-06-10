# 신규 식별자 충돌 검토 결과

## 발견사항

### [INFO] `data-flow §1.2` 링크 텍스트가 `§1.4` 로 수정되며 내부 anchor 추가

- **target 신규 식별자**: `./data-flow/10-triggers.md#14-schedule--trigger-동기화` (anchor 포함 링크 신규 추가)
- **기존 사용처**: `spec/1-data-model.md` 257번 줄 — `[data-flow §1.2](./data-flow/10-triggers.md)` (anchor 없는 plain 링크)
- **상세**: target 의 "After" 는 anchor `#14-schedule--trigger-동기화` 를 추가해 더 정밀한 링크로 변경한다. 동일 anchor 는 `spec/2-navigation/3-schedule.md` 115, 120번 줄에서도 이미 사용 중이므로 일관성 문제는 없다. 기존 line 257 의 텍스트 참조명("data-flow §1.2")이 "data-flow §1.4" 로 함께 바뀌지 않으면 링크 텍스트와 실제 섹션 번호가 불일치할 수 있으나, target 본문("After" 표 행)은 `[data-flow §1.4](./data-flow/10-triggers.md#14-schedule--trigger-동기화)` 로 텍스트·anchor 를 모두 수정하므로 이 불일치는 없다.
- **제안**: 변경 자체는 충돌 없음. 기존 다른 사용처(`spec/2-navigation/3-schedule.md` §3.1 링크, `spec/2-navigation/2-trigger-list.md` §4.3 §4.4 R-3)가 이미 `#14-schedule--trigger-동기화` anchor 를 참조 중이어서 추가 갱신 불필요.

---

### [INFO] 함수명 `syncScheduleActivation` — spec 신규 도입, 코드와 일치

- **target 신규 식별자**: `syncScheduleActivation()` — `spec/data-flow/10-triggers.md §1.4` 와 `spec/1-data-model.md §2.9.1` 의 "After" 텍스트에 처음 등장
- **기존 사용처**: `codebase/backend/src/modules/triggers/triggers.service.ts` 에 `private async syncScheduleActivation(...)` 로 이미 구현됨
- **상세**: 이 함수명은 spec 에 처음 노출되는 것이며 구현 코드와 동일하다. 이름 충돌이 아니라 spec↔코드 정합 달성.
- **제안**: 충돌 없음. 현행 그대로 유지.

---

### [INFO] "구현 현황" 블록 제목 — 기존 "구현 갭" 블록과 명명 패턴 상이

- **target 신규 식별자**: `> **구현 현황 — 역방향(Trigger→Schedule) 동기화**` (blockquote 제목)
- **기존 사용처**: 동일 파일 내 blockquote 는 `> **구현 갭 — ...`  패턴을 사용. 다른 spec 파일(`spec/data-flow/15-external-interaction.md`, `spec/data-flow/5-integration.md`)도 `> **구현 갭 — ...` 패턴 사용
- **상세**: target 은 "구현 갭" 블록을 "구현 현황" 블록으로 교체하며 제목 패턴을 바꾼다. "구현 현황"이라는 제목은 코퍼스 내 다른 blockquote 에는 없어 충돌은 없지만, 갭 해소 후 기존 상태를 기술하는 블록이 "구현 갭" 패턴과 다른 이름을 쓰는 첫 사례가 된다.
- **제안**: 충돌은 없다. 다만 나중에 다른 갭이 해소될 때도 동일 패턴("구현 현황")을 쓰도록 컨벤션으로 명시해 두는 것이 좋다. 현재 변경은 그대로 진행해도 무방.

---

## 요약

target 문서(`plan/in-progress/spec-update-trigger-schedule-sync.md`)가 도입하는 신규 식별자는 요구사항 ID, 엔티티/타입명, API endpoint, 이벤트명, 환경변수·설정키, 파일 경로 어느 범주에서도 기존과 충돌하지 않는다. `syncScheduleActivation` 함수명은 spec 에 처음 노출되지만 기존 구현 코드와 완전히 일치한다. 링크 anchor(`#14-schedule--trigger-동기화`)는 이미 코퍼스 내 두 개 파일이 동일하게 참조 중이라 일관성도 충족한다. "구현 현황" blockquote 제목은 기존 "구현 갭" 패턴과 다른 이름이지만 의미상 충돌이 아니라 상태 변화를 반영한 자연스러운 파생이다. 전체 위험도는 NONE 이다.

## 위험도

NONE
