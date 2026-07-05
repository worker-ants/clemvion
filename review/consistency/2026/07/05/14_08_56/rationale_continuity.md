# Rationale 연속성 검토 — spec/2-navigation/ (folder-depth-cycle-guard, --impl-prep)

## 검토 범위 및 방법

- 검토 모드: 구현 착수 전 검토 (--impl-prep)
- target: `spec/2-navigation/` (payload 로 전달된 8개 spec 문서 + cross-check 용으로 번들된 `0-overview.md`/`1-data-model.md`/`3-workflow-editor/*` 의 Rationale)
- 작업명(`folder-depth-cycle-guard`)으로 미루어 구현 대상은 `spec/2-navigation/1-workflow-list.md` §3.1 "폴더 관리 API" 및 `spec/1-data-model.md` §2.5 Folder 의 "중첩 깊이 제한: 최대 5단계" 제약을 실제 코드(`folders.service.ts`/`folders.controller.ts`)에서 depth·cycle 양쪽 다 가드하는 작업으로 판단했다.
- 코드 확인 결과: `FoldersService.create()` 는 `getDepth()` 로 depth 5 를 검사하지만, `FoldersService.update()`(PATCH, `parentId` 변경 가능)는 depth 재검사도, cycle(자기 자신 또는 자신의 하위 폴더를 새 부모로 지정) 검사도 전혀 하지 않는다. 이 갭이 이번 작업의 대상으로 보인다.
- `spec/2-navigation/` 전체 Rationale 절(8개 문서)과 번들된 관련 spec(`0-overview.md`, `1-data-model.md`, `3-workflow-editor/*`)의 Rationale 을 모두 확인했으며, **폴더 depth/cycle 가드에 관해 과거에 대안을 검토·기각했거나 원칙을 정한 Rationale 항목은 존재하지 않는다** (`grep` 으로 "폴더/Folder/cycle/순환/CYCLE" 전수 확인, 매치는 무관한 Cafe24 TTL sweep cycle과 Node `container_id` CYCLE 뿐).

## 발견사항

- **[INFO]** 폴더 PATCH(이동) 시 depth·cycle 가드 부재는 기존 spec 문서가 이미 약속한 범위이지 새로운 설계가 아님 — Rationale 신설 불필요, 본문 보강만 필요
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.1 "폴더 관리 API" 표의 `PATCH /api/folders/:id` 행("이름·부모·정렬 순서 부분 수정")과, `spec/1-data-model.md` §2.5 Folder "중첩 깊이 제한: 최대 5단계" 제약
  - 과거 결정 출처: 해당 없음 (두 문서 모두 PATCH 의 depth/cycle 예외를 명시한 적이 없다 — 즉 "생성 시에만 depth 를 본다"는 취지의 기존 결정이 없다)
  - 상세: 현재 spec 문서는 depth 제약(§2.5)을 Folder 엔티티 전역 불변식으로 서술하고, PATCH 로 "부모"를 변경할 수 있다고만 적었을 뿐 depth 재검증·cycle 방지를 명시적으로 언급하지 않는다. 코드(`FoldersService.update()`)는 이 불변식을 PATCH 경로에서 지키지 않고 있어 spec 과 실제 결과(엔티티 불변식 위반 가능)가 어긋난 상태다. 이는 "기각된 대안의 재도입" 이 아니라 **spec 이 원래 요구한 불변식을 코드가 아직 충족하지 못한 gap**이다 — Rationale 관점에서는 번복할 결정 자체가 없으므로 문제 없음. 다만 구현 시 "PATCH 에서 depth/cycle 을 검사한다"는 동작이 spec 본문에 암묵적으로만 존재하므로, 명시적으로 §3.1 표 또는 §2.5 제약 옆에 "생성·이동(PATCH parentId 변경) 모두에 적용" 문구를 추가해 두면 향후 회귀 방지에 좋다.
  - 제안: `spec/1-data-model.md` §2.5 제약 조건 항목에 "생성·이동(부모 변경) 모두에 적용되며, 이동으로 인한 cycle(자기 자신 또는 하위 폴더를 부모로 지정)도 거부한다" 를 추가. 구현 완료 후 `spec/2-navigation/1-workflow-list.md` §3.1 `PATCH /api/folders/:id` 행에 "깊이 5 초과 또는 cycle 발생 시 400 VALIDATION_ERROR" 를 명시(POST 행과 대칭).

- **[INFO]** Node `container_id` cycle 거부 선례와의 정합 — 새 가드는 기존 설계 원칙과 일치
  - target 위치: 구현 예정 `folders.service.ts` update()/cycle 검사 로직
  - 과거 결정 출처: `spec/1-data-model.md` §2.6 Node "제약 조건" — "`container_id` 체인은 순환하지 않아야 함 — 실행 시 `CONTAINER_CYCLE` 에러로 거부"
  - 상세: 이는 충돌이 아니라 **긍정적 선례**다. Node 엔티티에서 이미 self-referencing FK 체인의 순환을 명시적으로 거부하는 정책이 spec 에 존재하며, 이번 Folder(`parent_id` 도 self-referencing FK) 의 cycle 가드는 동일한 설계 원칙(자기참조 계층 구조는 항상 acyclic 이어야 한다)의 일관된 적용이다. 원칙 위반이 아니라 원칙의 재확인으로 볼 수 있다.
  - 제안: 구현 시 에러 코드 네이밍을 `CONTAINER_CYCLE` 선례와 일관되게(`FOLDER_CYCLE` 또는 동일 계열 명명) 가되, folders 도메인은 이미 `VALIDATION_ERROR`(400) 계열로 depth 초과를 표현하고 있으므로(§3.1), cycle 도 별도 신규 에러 코드보다는 동일한 `400 VALIDATION_ERROR` 로 흡수하는 편이 §3.1 기존 표와의 스타일 일관성 면에서 자연스럽다 (Node 의 `CONTAINER_CYCLE` 은 "실행 시" 런타임 에러라 write-time 검증인 Folder PATCH 와 발생 시점이 다르다는 점도 고려).

- **[INFO]** `settings` strict validation 선례(2026-07-04 Rationale) 와의 원칙적 정합성 참고
  - target 위치: 구현 예정 folder depth/cycle 검증 로직의 실패 처리 방식
  - 과거 결정 출처: `spec/2-navigation/1-workflow-list.md` `## Rationale` §2 "Import 의 permissive config 정책" 마지막 단락 — "잘못된 값이 조용히 무시되면 cap 정책이 어긋나므로 ... write 경계에서 strict ... hard-fail 한다"
  - 상세: 이 Rationale 은 "구조적 불변식(admission-gate 파라미터 등)은 write 경계에서 절대 조용히 무시하지 말고 hard-fail 해야 한다"는 원칙을 명문화했다. Folder 의 depth 5 / cycle 금지도 동일 성격의 구조적 불변식이므로, PATCH 구현 시 이 원칙을 그대로 계승해 depth 초과·cycle 발생을 조용히 무시(예: silently clamp 하거나 parentId 를 무시)하지 않고 400 으로 명시 거부해야 한다. 현재 계획된 방향(가드 추가)은 이 원칙과 부합한다 — 검토 시점에 이 정합성을 재확인해 두는 차원의 INFO.
  - 제안: 구현 시 "depth 초과/cycle 발생 시 parentId 변경분만 무시하고 나머지 필드(name 등)는 반영"과 같은 partial-silent-ignore 방식을 택하지 말고, 전체 PATCH 요청을 400 으로 거부하는 hard-fail 방식을 유지할 것.

## 요약

`spec/2-navigation/` 및 관련 번들 spec(`0-overview.md`, `1-data-model.md`, `3-workflow-editor/*`)의 `## Rationale` 전체를 확인한 결과, 폴더 depth/cycle 가드 작업과 직접 충돌하는 기각된 대안이나 번복 대상 결정은 존재하지 않는다. 오히려 Node `container_id` cycle 거부(§2.6) 와 workflow `settings` strict write-time validation(2026-07-04 Rationale) 두 개의 기존 원칙이 이번 작업이 따라야 할 방향(자기참조 계층의 acyclic 불변식을 write 경계에서 hard-fail로 강제)을 이미 지지하고 있어, 계획된 구현 방향은 기존 설계 원칙과 정합적이다. 다만 PATCH 경로의 depth/cycle 재검증이 spec 본문에 명시적으로 문서화돼 있지 않아 향후 동일 갭 재발을 막기 위한 문구 보강을 제안한다(비차단, INFO).

## 위험도

NONE
