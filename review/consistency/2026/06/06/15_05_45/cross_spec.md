# Cross-Spec 일관성 검토 결과

**검토 대상**: `plan/in-progress/spec-update-execution-engine-pre-park-window.md`
**검토 시각**: 2026-06-06
**검토 모드**: spec draft (--spec)

---

## 발견사항

- **[INFO]** target 의 §1.1 삽입과 `exec-park-durable-resume` plan 의 §1.1 전이표 편집 간 순서 의존 — 이미 draft 자체에 명기됨
  - target 위치: 제안 변경 섹션 전체 + 상단 "삽입 순서 NOTE (impl-done consistency W-1)"
  - 충돌 대상: `plan/in-progress/exec-park-durable-resume.md`, `plan/in-progress/spec-draft-exec-park-b2-durable.md`
  - 상세: target draft 의 삽입 순서 NOTE 는 이미 "exec-park Phase-B spec 갱신이 main 에 먼저 랜딩되면 그 결과 뒤에 이어 붙인다"고 명시하고 있어 순서 의존이 self-documented 되어 있다. `spec/5-system/4-execution-engine.md` frontmatter 의 `pending_plans` 에 `exec-park-durable-resume.md` 가 이미 등록되어 있고, `spec-draft-exec-park-b2-durable.md` (C5 — spec 재서술)는 PR-B2 구현과 동시 반영으로 명시되어 있어 삽입 위치 충돌 가능성은 존재하지만, 이미 의존 관계가 인지되고 기록되어 있다.
  - 제안: 반영 시점에 main HEAD 기준 재확인 절차(draft 에 이미 기재)를 그대로 따를 것. 추가 조치 불필요.

- **[INFO]** backend normalization 의 소비자 범위 선언 — 다른 spec 과의 암묵적 의존
  - target 위치: 제안 변경 "Pre-park read-window 정규화" 신규 blockquote 항목 1 — "모든 snapshot 소비자(웹 앱·channel-web-chat·external-interaction-api)에 일관 적용된다"
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` (EIA getStatus — 현재 `currentNode`/`context`/`seq`는 `null` placeholder), `spec/7-channel-web-chat/_product-overview.md`
  - 상세: `reconcilePreParkWaitingStatus` 가 `findById` 에서만 호출된다면 EIA `getStatus()`/SSE 경로도 동일 service 를 경유해 일관 적용되겠지만, EIA spec(`14-external-interaction-api.md`) 에는 응답 shape `currentNode`/`context`/`seq`가 현재 미구현(`null` placeholder)임이 명시되어 있다. target 의 "모든 소비자에 일관 적용" 선언이 EIA 의 이 미구현 경로와 어긋나는지 여부는 `findById` 의 호출 범위에 달려 있으나 spec 레벨에서 명확한 충돌은 아니다. 단, channel-web-chat 과 EIA spec 에 `reconcilePreParkWaitingStatus` 소비 범위가 전혀 기술되지 않으므로 향후 "두 레이어가 의도적 중복 방어" 서술이 해당 spec 에 미기재 상태로 남는다.
  - 제안: 반영 시 EIA spec(`spec/5-system/14-external-interaction-api.md`) 과 channel-web-chat spec 에 "backend `findById` normalization 적용" 사실을 INFO 수준으로 교차 참조하거나, target 의 소비자 목록에 "EIA getStatus 경로의 미구현 필드(currentNode/context/seq)는 적용 범위 외" 조건을 명시하는 것을 고려.

- **[INFO]** `spec/5-system/4-execution-engine.md` §1.1 원자성 보장 blockquote 이후 삽입 위치 — exec-park B2 spec 재서술과의 텍스트 근접성
  - target 위치: "before/after" 블록 — 현행 §1.1 원자성 보장 blockquote 끝 이후에 신규 blockquote 삽입
  - 충돌 대상: `plan/in-progress/spec-draft-exec-park-b2-durable.md` C5 항목 — `spec/5-system/4-execution-engine.md §1.1` 전이표 관련 서술 재전환
  - 상세: spec-draft-exec-park-b2-durable 의 C5 는 §4.x banner·§7.4·§Rationale L1257 등 주로 §4 이후 섹션을 대상으로 하며 §1.1 원자성 보장 blockquote 자체를 수정하지는 않는다. 따라서 target 의 §1.1 blockquote 추가는 C5 와 텍스트 충돌이 없다. 단, exec-park B2 PR 이 먼저 머지되면 §1.1 하위에 B2 관련 내용이 추가될 수 있으므로 삽입 위치 재확인이 필요하다는 점은 draft 의 NOTE 에 이미 기재되어 있다.
  - 제안: 추가 조치 불필요. draft 의 삽입 순서 NOTE 가 이를 커버한다.

---

## 요약

target draft(`spec-update-execution-engine-pre-park-window.md`)는 `spec/5-system/4-execution-engine.md` §1.1 에 "pre-park read-window 정규화(intra-row inconsistency)" blockquote 를 추가하는 내용으로, 기존 spec 의 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 정의와 직접 모순되는 내용이 없다. 제안된 신규 blockquote 는 기존 §1.1 의 cross-entity 원자성 보장 blockquote 와 **직교하는 독립 방어 레이어**를 서술하고 있으며, 상태 전이 enum·엔티티 필드·API endpoint 정의 어디에도 충돌하지 않는다. 유의할 점은 (1) `exec-park-durable-resume` plan 의 §1.1 전이표 편집과 삽입 순서 의존이 있으나 draft 자체에 이미 명시되어 있고, (2) "모든 snapshot 소비자에 일관 적용" 선언이 EIA 의 일부 미구현 필드와 암묵적 전제를 공유하고 있어 향후 EIA spec 교차 참조 보강이 권장된다. 두 항목 모두 INFO 수준이며 채택 차단 사유가 아니다.

---

## 위험도

LOW
