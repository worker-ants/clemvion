# Convention Compliance Review — Phase 5a: Cafe24 Order Coverage 확장

대상 파일 (5개):
- `backend/src/nodes/integration/cafe24/metadata/order.ts` (3 row 추가)
- `backend/src/nodes/integration/cafe24/metadata/planned.ts` (3 id 제거)
- `spec/conventions/cafe24-api-catalog/order.md` (3 row planned → supported)
- `spec/conventions/cafe24-api-catalog/_overview.md` (matrix + CHANGELOG)
- `plan/in-progress/cafe24-coverage-order-phase5a.md` (신규)

---

## 발견사항

### [WARNING] `cafe24-api-metadata.md §4 step 3` 의 id 형식 예시와 실제 구현 패턴 불일치

- **target 위치**: `backend/src/nodes/integration/cafe24/metadata/order.ts` — id `order_status_update`, `order_status_update_multiple`
- **위반 규약**: `spec/conventions/cafe24-api-metadata.md` §4 step 3 — "id 는 `<resource>_<verb>` 형식 (예: `product_list`, `order_update_status`)"
- **상세**: 컨벤션 문서 예시는 `order_update_status` 를 보여주나 (`<resource>_<verb>_<object>` 순서), 실제 구현된 id 는 `order_status_update` (`<resource>_<object>_<verb>` 순서)다. 그러나 기존 모든 order.ts 항목 (`order_buyer_update`, `order_shipments_create`, `order_memos_create`, `order_items_list`) 도 동일하게 `<resource>_<sub/object>_<verb>` 순서를 따르고 있어, 실질적으로 컨벤션 예시(`order_update_status`)가 실제 코드베이스 패턴과 역순으로 작성된 오기로 보인다. 신규 id 는 기존 코드베이스 패턴과 일치하므로 구현 자체에는 문제가 없으나, 컨벤션 문서의 예시가 오해를 유발할 수 있는 상태다.
- **제안**: `spec/conventions/cafe24-api-metadata.md §4 step 3` 의 예시를 `order_update_status` → `order_status_update` 로 정정하거나, 혹은 `order_shipments_create` 와 같이 실제 코드베이스에 존재하는 id 로 교체할 것을 권고한다. 신규 id 는 수정 불필요.

---

### [INFO] CHANGELOG 날짜 컬럼 값에 부가 설명 문자열 포함

- **target 위치**: `spec/conventions/cafe24-api-catalog/_overview.md` §7 CHANGELOG — `2026-05-16 (coverage Phase 5a)` 행
- **위반 규약**: `spec/conventions/cafe24-api-catalog/_overview.md` 자체 §7 — 기존 행들이 `2026-05-16` 단순 날짜만 사용
- **상세**: 초기 행은 날짜 컬럼에 `2026-05-16` 만 기재했으나, 신규 행은 `2026-05-16 (coverage Phase 5a)` 로 부가 설명을 날짜 컬럼에 포함했다. 강제 규약은 아니나 테이블 파싱 도구(catalog-sync.spec.ts 등)가 날짜 컬럼을 파싱할 경우 깨질 수 있다.
- **제안**: 날짜 컬럼은 `2026-05-16` 으로, 설명은 "변경" 컬럼으로 이동. 예: `| 2026-05-16 | (Phase 5a) Order resource — ...`

---

### [INFO] 카탈로그 표 내 신규 supported 행 삽입 순서가 plan 범위 표와 상이

- **target 위치**: `spec/conventions/cafe24-api-catalog/order.md` 행 17–19
- **위반 규약**: 명시적 정렬 순서 규약 없음
- **상세**: plan 문서(`plan/in-progress/cafe24-coverage-order-phase5a.md`) 범위 표는 `order_count → order_status_update → order_status_update_multiple` 순으로 나열하나, 카탈로그 표는 `order_count → order_status_update_multiple → order_status_update` 순으로 삽입됐다. 규약상 강제 순서는 없으므로 기능적 문제는 없다.
- **제안**: 가독성·일관성을 위해 plan 과 동일 순서(`order_count → order_status_update → order_status_update_multiple`)로 맞추는 것을 고려. 필수는 아님.

---

## 적합성 확인 항목 (pass)

| 항목 | 결과 |
|------|------|
| Plan frontmatter `worktree` 필드 — `cafe24-coverage-order-b7d4f9` | pass |
| Plan frontmatter `started` — `2026-05-16` (ISO 날짜) | pass |
| Plan frontmatter `owner` — `developer` | pass |
| Plan 위치 — `plan/in-progress/` (미완료 체크박스 3개 잔존) | pass |
| Worktree 명명 — `cafe24-coverage-order-b7d4f9` (`<task_name>-<slug>` 패턴) | pass |
| id 형식 — `order_count`, `order_status_update`, `order_status_update_multiple` — snake_case, resource 접두, resource 내 unique | pass |
| `scopeType` 값 — `order_count: read`, `order_status_update: write`, `order_status_update_multiple: write` | pass |
| `label` 필드 — 한국어 (`주문 개수 조회`, `주문 상태 변경`, `주문 상태 일괄 변경`) | pass |
| 카탈로그 `status` 값 — 3행 모두 `supported` (enum: supported/planned/deprecated) | pass |
| 카탈로그 `method`/`path`/`scope` — metadata 와 동일 (catalog-sync 기준 충족) | pass |
| `paginated` 컬럼 일치 — 3건 모두 paginated 없음, 카탈로그 공백 | pass |
| coverage matrix — order 9 (6+3), 합계 56 (53+3) | pass |
| `planned.ts order[]` — 3 id 제거 확인 | pass |
| `spec/4-nodes/4-integration/4-cafe24.md` 미수정 (§4 step 8) | pass |
| TypeScript import — `.js` extension, 기존 object literal 에 row 추가 (신규 import 없음) | pass |
| 옛 경로(`prd/`, `memory/`, `user_memo/`) 신규 사용 없음 | pass |
| review 산출물 경로 — `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` nested ISO | pass |

---

## 요약

정식 규약(`spec/conventions/cafe24-api-metadata.md` §4, `spec/conventions/cafe24-api-catalog/_overview.md`) 준수 관점에서 Phase 5a 변경은 전반적으로 적합하다. CRITICAL 위반은 없다. 주요 지적 사항은 컨벤션 문서 자체의 예시 오기 가능성(id 형식 예시 `order_update_status` vs 실제 코드베이스 패턴 `order_status_update`)으로, 신규 구현이 아닌 규약 예시가 수정돼야 할 항목이다. 나머지 두 건은 INFO 수준의 형식 일관성 제안이며 기능적·동기적 영향 없음.

---

## 위험도

LOW
