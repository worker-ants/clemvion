## 발견사항

---

### [WARNING] DRAFT 3B — `status_reason` 값의 대소문자 컨벤션이 DRAFT 1C·2D와 불일치

- **target 위치**: DRAFT 3B — `spec/data-flow/integration.md §3.2` status_reason 매핑 표 교체분
- **관련 plan**: `cafe24-pending-polish.md` 변경 0 (markIntegrationCallbackError 호출) / Rationale 섹션 (DRAFT 2I)
- **상세**:

  | 드래프트 | 위치 | 표기 |
  |---------|------|------|
  | DRAFT 1C | `spec/1-data-model.md §2.10` status_reason 행 | `oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`, `resource_not_found` (snake_case) |
  | DRAFT 2D | `spec/2-navigation/4-integration.md §6` 전이 표 | 동일 snake_case + "모두 snake_case" 명시 |
  | DRAFT 3B | `spec/data-flow/integration.md §3.2` | **`OAUTH_TOKEN_EXCHANGE_FAILED`, `OAUTH_STATE_MISMATCH`, `OAUTH_STATE_EXPIRED`, `RESOURCE_NOT_FOUND` (UPPER_SNAKE_CASE)** |

  Rationale(DRAFT 2I)에서 "DB 저장값은 `snake_case`" 임을 명시하고 있으나 DRAFT 3B만 UPPER_SNAKE_CASE를 사용. 이 상태로 spec에 적용되면 `spec/1-data-model.md`와 `spec/data-flow/integration.md §3.2`가 동일 DB 컬럼 값을 다른 표기로 기술하는 충돌이 발생한다.

- **제안**: DRAFT 3B를 DRAFT 1C·2D와 동일한 snake_case로 교정. 참고로 DRAFT 2G(§10.4 에러 매핑)는 이미 snake_case 표기 (`status_reason='oauth_token_exchange_failed'` 등)를 사용 중이므로 DRAFT 3B만 수정하면 된다.

---

### [INFO] `cafe24-pending-polish.md` 변경 2 체크박스 — "410 Gone 또는 제거" 결정 반영 미완

- **target 위치**: DRAFT 2E·2C Rationale — 옛 경로를 `410 Gone`으로 처리하고, 영구 폐기 시점을 `plan/in-progress/cafe24-pending-polish.md`에 후속 항목으로 추가한다고 기술
- **관련 plan**: `cafe24-pending-polish.md` 변경 2 체크박스 `[ ] 기존 토큰 없는 /oauth/install/cafe24 라우트 410 Gone 또는 제거 (외부 등록 URL 영향 사전 확인)`
- **상세**: 본 spec draft가 "410 Gone + 운영 전환기 완충 → 영구 폐기는 별도 후속" 으로 결정을 완성했다. 그러나 `cafe24-pending-polish.md`에는 영구 폐기 시점을 추적하는 후속 체크박스가 없다. Rationale은 이를 추가한다고 언급하지만 spec draft 자체가 plan을 직접 갱신하지는 않는다.
- **제안**: spec patch 적용 후, `cafe24-pending-polish.md` 변경 2 영역에 `[ ] 410 Gone 경로 영구 폐기 시점 결정 (운영 데이터·외부 등록 URL 잔존 여부 확인 후)` 체크박스를 추가해 추적 관리.

---

### [INFO] `node-output-redesign` plan이 `spec/4-nodes/4-integration/4-cafe24.md`를 진단 대상으로 포함

- **target 위치**: DRAFT 2H·2J — `spec/4-nodes/4-integration/4-cafe24.md` §337·§9.4·§9.8·§10 수정
- **관련 plan**: `plan/in-progress/node-output-redesign/README.md` — Integration 노드 진단 대상에 cafe24.md 포함
- **상세**: node-output-redesign plan은 현재 "진단(analysis)" 단계이며 spec 본문 즉시 수정을 하지 않는다(`README.md` 명시). 직접 충돌은 없으나, 본 spec draft가 cafe24.md를 먼저 수정하면 추후 node-output-redesign의 `project-planner` 적용 시 기존 diff가 달라질 수 있다.
- **제안**: 현재 조치 불필요. node-output-redesign plan이 spec 반영 단계로 진입할 때 cafe24.md 영역의 선행 변경을 확인하도록 해당 plan에 메모를 남겨두면 충분하다.

---

## 요약

spec draft의 핵심 구조(status enum 추가, install_token 승격, callback 실패 시 status 보존, 24h TTL → expired 전이, 에러 코드 분리)는 `cafe24-pending-polish.md`·`spec-update-cafe24-pending-polish.md`의 요구와 정합하며 Critical 수준의 충돌은 없다. 단, **DRAFT 3B에서 `status_reason` 값이 유일하게 UPPER_SNAKE_CASE로 기술**되어 `spec/1-data-model.md`(DRAFT 1C)·`spec/2-navigation/4-integration.md`(DRAFT 2D)·Rationale과 직접 모순이 발생한다. 이 부분만 교정하면 spec patch를 진행해도 된다.

## 위험도

**LOW** (CRITICAL 0, WARNING 1 — DRAFT 3B case 교정으로 단순 해소 가능)