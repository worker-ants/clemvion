# Plan 정합성 검토 결과

> target: `plan/in-progress/spec-draft-triggers-edit-delete.md`
> worktree: `triggers-edit-delete-suite-a1548c`
> 검토일: 2026-05-22

---

## 발견사항

### [WARNING] plan B 의 `PATCH /api/triggers/:id` 확장이 `eia-trigger-edit-ui.md` 와 동일 엔드포인트를 손댐

- **target 위치**: plan B (`trigger-detail-edit-meta.md`) §1 Backend — `PATCH /api/triggers/:id` 확장, `config.authType / hmacHeader / hmacSecret / bearerToken` deep-merge, Schedule 타입 거부(400), UNIQUE 충돌 409
- **관련 plan**: `plan/in-progress/eia-trigger-edit-ui.md` §1 UI 컴포넌트 — "Save 버튼 → `PATCH /api/triggers/:id` 호출"
- **상세**: `eia-trigger-edit-ui.md` 는 EIA Notification / Interaction 카드의 Save 경로로 `PATCH /api/triggers/:id` 를 이미 명시하고 있다. plan B 도 동일 엔드포인트에 `config.authType / hmacHeader / hmacSecret / bearerToken` 등 config 서브키 deep-merge 와 Schedule 타입 거부(400) 검증을 새로 추가하는 백엔드 작업을 담고 있다. 두 plan 이 동시 진행되면 같은 핸들러를 병행 수정하다 충돌하거나 한쪽의 400 거부 조건이 다른 쪽 EIA config 갱신을 막을 수 있다. 다만 target 문서의 "의존·side-effect 메모" 는 `eia-trigger-edit-ui.md` 와의 공존 가능성을 언급하고 있어 충돌 인지는 했으나 구체적인 작업 직렬화(순서) 또는 병합 전략이 명시되어 있지 않다.
- **제안**: plan B 의 §1 Backend 항목에 "eia-trigger-edit-ui plan 이 동일 엔드포인트를 사용하므로, 두 plan 중 하나가 먼저 핸들러 확장을 완료한 뒤 다른 plan 이 그 위에 추가하는 순서로 직렬 진행하거나, 단일 PR 로 병합" 이라는 직렬화 제약을 명시. 또는 target plan 의 "의존·side-effect 메모" 행에 해당 순서 의존성을 구체적으로 추가.

---

### [WARNING] `eia-secret-rotation-revoke-api.md` 의 미해결 결정이 target Change 4 에서 일방적으로 결론을 내리고 있음

- **target 위치**: Change 4 — §3 API 표 갱신, `POST /api/triggers/:id/auth/rotate-secret` 행 ("v1.1 후속 Webhook HMAC secret rotate"). 및 Change 3 §2.3.1 매트릭스 `hmacSecret` 행 — "rotate 액션은 후속 spec PR". Rationale R-2.
- **관련 plan**: `plan/in-progress/eia-secret-rotation-revoke-api.md` §결정 사항 — 미해결 항목 3건:
  1. rotation grace 기간 (24h 고정 vs. trigger 별 조정 가능 vs. 1h)
  2. rotate 응답 shape (새 secret 평문 반환 1회 vs. 미반환)
  3. itk revoke 후 grace (즉시 invalidate vs. N 초 grace)
- **상세**: `eia-secret-rotation-revoke-api.md` 는 rotate API 의 기본 동작(grace 기간, 응답 shape)을 아직 "사용자 합의 필요"로 명시한 채 열려 있다. target spec draft 는 Change 4 에서 `POST /api/triggers/:id/auth/rotate-secret` 의 패턴을 "Spec EIA §7 과 동일 패턴" 으로 약속하고, Rationale R-2 에서 "v1 은 secret 을 모르는 채로 분실·재발급 시나리오만" 이라고 v1 동작을 확정 기술한다. 이는 eia-secret-rotation-revoke-api plan 이 열어 놓은 "rotate 응답 shape" 결정을 우회해 spec 에 선행 결론을 넣는 것이다. 두 문서가 실제 구현 시 충돌할 수 있다.
- **제안**: target 의 Change 4 API 표 해당 행과 Rationale R-2 에 "응답 shape 및 grace 기간은 `eia-secret-rotation-revoke-api` plan 의 결정 사항 합의 후 확정" 이라는 TBD 한정 문구를 추가. 또는 `eia-secret-rotation-revoke-api.md` 의 결정 사항을 먼저 확정하고 그 결과를 target spec draft 에 반영.

---

### [WARNING] plan A 가 생성하는 `TriggerDeleteDialog` 컴포넌트가 `eia-trigger-edit-ui.md` 의 동일 드로어 영역을 동시 수정할 가능성

- **target 위치**: plan A (`trigger-list-row-actions.md`) §2 Frontend — "삭제 모달 (`TriggerDeleteDialog` 신규 컴포넌트)", 드롭다운 항목 "① 상세 보기 (드로어 오픈)"
- **관련 plan**: `plan/in-progress/eia-trigger-edit-ui.md` §1 — "Trigger 상세 드로어 수정 UI" 전체 (동일 드로어 파일 `trigger-detail-drawer.tsx` 또는 동등 컴포넌트)
- **상세**: plan A 의 드롭다운 "상세 보기" 항목은 드로어를 열고, 동일 드로어 안에 삭제 진입점 흐름이 연결된다. eia-trigger-edit-ui 는 동일 드로어에 Notification / Interaction 카드 edit 모드를 추가하는 작업이다. 별도 worktree 에서 동시에 진행될 경우 같은 파일 또는 연관 컴포넌트에서 merge conflict 가 발생할 수 있다. 다만 plan A 가 드로어 내부를 직접 편집하는지(오픈 트리거만 추가하는지) target plan 상에서 명확하지 않아 실제 충돌 범위는 구현 착수 시 결정된다.
- **제안**: target plan 의 "의존·side-effect 메모" 에 plan A 가 `eia-trigger-edit-ui` 의 동일 드로어 파일을 접촉하는지 여부를 명시하고, 필요 시 plan A → eia-trigger-edit-ui 순 직렬화 또는 단일 PR 병합 전략을 기재.

---

### [INFO] `spec-overview-followups-2026-05-18.md` 의 완료 상태 갱신 필요

- **target 위치**: (target plan 과 직접 관련 없으나 인접 영역)
- **관련 plan**: `plan/in-progress/spec-overview-followups-2026-05-18.md` — frontmatter 에 `completed: 2026-05-21` 이 명시되어 있고 §1~§4 모든 작업이 `[x]` 상태이나 "PR + merge" 체크박스들이 `[ ]` 로 남아 있음. 본 plan 이 `plan/in-progress/` 에 잔류 중.
- **상세**: target plan 과 직접 충돌은 없으나 이 plan 이 완료 표기임에도 in-progress 에 남아 있어 0-unimplemented-overview 인덱스와 불일치 발생 가능. target plan 의 범위와는 독립적.
- **제안**: `spec-overview-followups-2026-05-18.md` 를 `plan/complete/` 로 `git mv` 처리. target plan 과 관계없으므로 별도 chore commit 으로 처리.

---

### [INFO] `eia-secret-rotation-revoke-api.md` endpoint 경로가 target Change 4 와 다름

- **target 위치**: Change 4 — `POST /api/triggers/:id/auth/rotate-secret`
- **관련 plan**: `plan/in-progress/eia-secret-rotation-revoke-api.md` §2 Backend — `POST /api/triggers/:id/notification/rotate-secret` (notification 전용) 및 `POST /api/triggers/:id/interaction/revoke-token`
- **상세**: target spec draft 는 HMAC secret rotate 경로를 `/auth/rotate-secret` 으로, `eia-secret-rotation-revoke-api` plan 은 `/notification/rotate-secret` 으로 표기한다. 두 경로가 다르다. target 의 Rationale R-2 는 "EIA notification secret 은 외부 수신자가 보유한 키의 grace 기간이 필요" 라고 설명하며 EIA §7 패턴을 인용하므로, 실제로 동일 기능을 가리키는지 별개 기능인지 추적 필요. 만약 동일 기능이라면 경로 이름이 spec 에서 두 가지로 존재하게 된다.
- **제안**: target Change 4 의 해당 API 행 주석에 "경로명은 `eia-secret-rotation-revoke-api` plan 과 합의 후 확정" 이라는 TBD 표기 추가. 또는 두 경로가 다른 기능임을 명확히 구별하는 주석 보완.

---

### [INFO] worktree 충돌 없음 확인

- `triggers-edit-delete-suite-a1548c` 는 target plan 의 전용 worktree. 다른 in-progress plan 중 `spec/2-navigation/2-trigger-list.md` 또는 `spec/2-navigation/_product-overview.md` 를 동시 수정 중인 worktree는 현재 확인되지 않음. spec-overview-followups-bundle 은 `spec/0-overview.md` 와 `spec/1-data-model.md` 영역을 다루며 target 파일과 중복 없음.

---

## 요약

target `spec-draft-triggers-edit-delete.md` 는 `spec/2-navigation/2-trigger-list.md` 및 `_product-overview.md` 에 대한 신규 spec 보강 draft 로서 in-progress plan 목록 중 직접 worktree 충돌은 없다. 그러나 두 가지 실질적 경합 위험이 있다. 첫째, plan B 가 확장하는 `PATCH /api/triggers/:id` 핸들러를 `eia-trigger-edit-ui.md` 가 동일하게 사용하고 있어 백엔드 직렬화 순서가 plan 에 명시되어 있지 않다. 둘째, `eia-secret-rotation-revoke-api.md` 가 "사용자 합의 필요"로 열어 둔 rotate 응답 shape 결정을 target Change 4 / Rationale R-2 가 v1 동작으로 미리 확정 기술하고 있어 미해결 결정 우회에 해당한다. 추가로 rotate endpoint 경로명이 두 문서에서 다르게 표기되어 있어 추적 메모가 필요하다. 전체적으로 spec 보강 내용 자체의 일관성은 양호하나, 연관 plan 들과의 순서 의존성 명시와 rotate API 결정 선행이 이루어지기 전까지는 plan B 착수를 보류하는 것이 안전하다.

---

## 위험도

MEDIUM
