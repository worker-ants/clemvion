# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
검토 대상 영역: `spec/2-navigation/`

---

## 발견사항

### [CRITICAL] Schedule↔Trigger 동기화 방향 계약 충돌

- **target 위치**: `spec/2-navigation/3-schedule.md` §3.1 라이프사이클 표 (line 115, 120)
- **충돌 대상**:
  - `spec/1-data-model.md` §2.9.1 (Trigger–Schedule 동기화 규칙 표, "역방향 Trigger→Schedule 동기화는 미구현 — 구현 갭" 주석)
  - `spec/data-flow/10-triggers.md` §1.4 (구현 갭 명시 블록, "역방향 미구현 (구현 갭, 아래)")
  - `spec/data-flow/10-triggers.md` §3.1 ("`Schedule 과의 동기화는 Schedule→Trigger 정방향만 구현")
- **상세**: `spec/2-navigation/3-schedule.md` 의 라이프사이클 표는 "Schedule 활성/비활성 — 연결된 Trigger is_active 동기화 **(역방향도 동일)**" 이라고 기술하며, §3.1 제약 항목에도 "역방향: Trigger 삭제 시 Schedule도 삭제"와 묶여 양방향이 완전히 구현된 것처럼 기술되어 있다. 그러나 이 브랜치에서 갱신된 `spec/1-data-model.md`와 `spec/data-flow/10-triggers.md`는 역방향(Trigger API → Schedule / BullMQ) 동기화가 **미구현**임을 명시한다. `3-schedule.md`는 이 수정의 적용을 받지 않아 두 spec 간에 직접 모순이 발생한다.
- **제안**: `spec/2-navigation/3-schedule.md` §3.1의 라이프사이클 표를 다음과 같이 수정한다.
  - "연결된 Trigger is_active 동기화 (역방향도 동일)" → "연결된 Trigger is_active 동기화 (역방향 Trigger→Schedule 동기화는 **미구현 — 구현 갭**, [data-flow §1.4](../data-flow/10-triggers.md#14-schedule--trigger-동기화) 참조)"
  - §3.1 제약: "역방향: Trigger 삭제 시 Schedule도 삭제" 항목에 "단, Trigger API 직접 삭제 시 BullMQ `removeJob` 미호출 누락 있음 — [data-flow §1.4](../data-flow/10-triggers.md#14-schedule--trigger-동기화)" 경고를 추가한다.

---

### [WARNING] `spec/2-navigation/2-trigger-list.md` §4.3 삭제 결과 설명에 BullMQ 누수 갭 미반영

- **target 위치**: `spec/2-navigation/2-trigger-list.md` §4.3 삭제 정책 (line 210)
- **충돌 대상**: `spec/data-flow/10-triggers.md` §1.4 구현 갭 블록 ("Trigger API 직접 삭제는 `removeJob` 누락 (구현 갭)")
- **상세**: `2-trigger-list.md` §4.3은 "Schedule 타입을 schedule 화면이 아닌 trigger 화면에서 삭제: 본 §4.3에 따라 schedule cascade와 함께 삭제. (Schedule 화면에서 삭제하는 경로도 동일 결과 — data-flow §1.4가 양방향 동기화 정의.)"라고 기술한다. 그러나 `data-flow/10-triggers.md` §1.4는 이 두 경로가 동일 결과가 **아님**을 새롭게 명시했다. Trigger API 직접 삭제는 BullMQ repeatable job(`schedule:<id>`)을 `removeJob`으로 해제하지 않아 Redis에 job scheduler 엔트리가 잔존하는 누수가 있다. `2-trigger-list.md` §4.3의 "동일 결과" 기술은 이 구현 갭을 덮어버리며 구현자가 잘못된 전제로 진행할 수 있다.
- **제안**: `spec/2-navigation/2-trigger-list.md` §4.3의 해당 문장에서 "동일 결과"를 "cascade 삭제 동작은 같으나, Trigger API 직접 삭제 경로는 BullMQ `removeJob` 을 호출하지 않아 Redis job scheduler 엔트리가 잔존한다는 구현 갭이 있음 — [data-flow §1.4](../data-flow/10-triggers.md#14-schedule--trigger-동기화) 참조" 로 교체하고, "양방향 동기화 정의" 링크 앵커도 현재 data-flow §1.4의 "구현 갭" 블록을 링크하도록 수정한다.

---

### [WARNING] `spec/2-navigation/2-trigger-list.md` §4.3에서 data-flow §1.4를 "양방향 동기화 정의"로 참조 — 내용 불일치

- **target 위치**: `spec/2-navigation/2-trigger-list.md` §4.3 (line 210): `[data-flow §1.4](../data-flow/10-triggers.md#14-schedule--trigger-동기화) 가 양방향 동기화 정의`
- **충돌 대상**: `spec/data-flow/10-triggers.md` §1.4 (이 브랜치에서 해당 섹션의 실제 내용은 "역방향 미구현 구현 갭" 설명)
- **상세**: 링크 텍스트("양방향 동기화 정의")가 링크 목적지의 실제 내용("정방향만 구현, 역방향 갭")과 정반대 의미를 전달한다. 독자가 링크 텍스트만 보고 양방향이 정의됐다고 오해할 수 있다.
- **제안**: 링크 텍스트를 "양방향 동기화 정의" → "Schedule↔Trigger 동기화 (구현 갭 포함)" 로 변경한다.

---

### [INFO] `spec/2-navigation/3-schedule.md` `pending_plans` 항목이 `plan/in-progress/spec-sync-schedule-gaps.md`를 참조하나 해당 plan 파일이 이 브랜치에 존재하지 않음

- **target 위치**: `spec/2-navigation/3-schedule.md` frontmatter `pending_plans`
- **충돌 대상**: 이 브랜치의 plan 파일 트리 (git diff에 `plan/in-progress/spec-sync-schedule-gaps.md` 변경 없음)
- **상세**: 데이터 모델과 data-flow spec이 Schedule↔Trigger 동기화 갭을 공식화했으므로, 갭 해소 작업을 추적하는 plan이 존재해야 한다. 현재 `3-schedule.md`는 plan을 참조하지만, 이 브랜치에서 해당 plan 파일이 신규 생성되거나 갱신된 기록이 없어 stale 참조 혹은 미생성 상태일 수 있다.
- **제안**: `plan/in-progress/spec-sync-schedule-gaps.md`의 존재 여부를 확인하고, Schedule↔Trigger 역방향 동기화 구현 갭(is_active + BullMQ removeJob)이 명시적으로 반영되어 있는지 검토한다.

---

## 요약

`spec/2-navigation/` 영역에서 이 브랜치가 갱신한 주요 cross-spec 충돌은 **Schedule↔Trigger 동기화 방향**에 집중된다. `spec/1-data-model.md`와 `spec/data-flow/10-triggers.md`(§1.4, §3.1)는 이 브랜치에서 "역방향(Trigger→Schedule) is_active 동기화는 미구현"이라는 구현 갭을 새로 공식화했으나, 동일 갭을 기술해야 하는 `spec/2-navigation/3-schedule.md`(§3.1)와 `spec/2-navigation/2-trigger-list.md`(§4.3)는 여전히 "역방향도 동일" / "양방향 동기화 정의"라는 이전 표현을 그대로 유지하고 있다. 이는 구현자가 spec 일부를 보고 잘못된 전제(양방향 완전 구현)로 착수하거나 BullMQ job 누수 갭을 놓칠 위험을 만드는 CRITICAL 수준의 직접 모순이다. 그 외 발견사항은 링크 텍스트 명확화와 plan 파일 정합성 확인 수준의 WARNING/INFO이다.

---

## 위험도

HIGH
