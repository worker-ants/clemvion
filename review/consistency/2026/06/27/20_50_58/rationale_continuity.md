### 발견사항

- **[WARNING]** G-2 "현행 유지" 번복 — 번복 Rationale 가 spec 문서에 미반영
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` (§5 Coverage Matrix 숫자 갱신 포함), `application.md`, `category.md`, `customer.md`, `promotion.md`, `store.md` (9 row 제거)
  - 과거 결정 출처: `plan/in-progress/cafe24-backlog-residual.md` §G-2 (2026-06-02) — "본 항목은 **현행 유지**한다 (production 검증 전이라 제거/문의 판단 보류)"; §G-3l (2026-06-20 재검증) — "제거 결정은 planner 트랙 미결 — G-3b~G-3j 와 달리 본 항목만 open"
  - 상세: G-2 는 9개 docs-부재 seed op 을 "production 검증 완료 전까지 현행 유지" 로 명시적 결정했다. G-3l(2026-06-20)에서도 "planner 트랙 미결" 로 유지됐다. 이번 변경이 이를 역전해 9 op 전부 제거했다. 역전 Rationale 는 plan 파일(`cafe24-backlog-residual.md` G-3l 체크박스 갱신)에만 기록되어 있고 — "HTML 이 최종 상태로 확정됐으므로 G-2 의 '`production 검증 전 보류`' 전제 해소", "현재도 비동작(404)", "사용자 결정 2026-06-27" — spec 문서(`_overview.md`) 끝의 `## Rationale` 에는 기록되지 않았다. CLAUDE.md 의 "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 규약 미충족.
  - 제안: `spec/conventions/cafe24-api-catalog/_overview.md` 에 `## Rationale` 섹션을 추가하고 다음 항목을 기록한다: (a) "docs-부재 확정 op 제거 정책 — G-2 결정 번복 근거" (HTML authoritative 확정, G-2 전제 해소, 현재 비동작 404, 사용자 결정 2026-06-27); (b) 제거 vs `deprecated` 경로 선택 이유(`deprecated` 는 Cafe24 공식 폐기 endpoint 용, 미문서화 seed 는 의미상 해당 없음).

- **[INFO]** `_overview.md` §3 `deprecated` 경로와 "미문서화 seed 제거" 경로의 구별이 spec 내 미명시
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` §3 (status enum)
  - 과거 결정 출처: `_overview.md` §3 — `deprecated` = "Cafe24 가 제거 또는 deprecate 했고 우리 노드에서도 더 이상 호출 안 함"
  - 상세: 제거된 9 op 은 Cafe24 가 공식으로 제공했다가 폐기한 endpoint 가 아니라, Cafe24 공식 docs 에 처음부터 등재된 적 없는 backwards-compat seed 다. 따라서 `deprecated` status 를 거치지 않고 직접 row 제거한 것은 §3 의미상 적합하다. 그러나 spec §3 은 "미문서화 seed 의 outright 제거 경로" 를 명시하지 않아, 이 선택이 합의된 관례인지 spec 독자가 판단하기 어렵다.
  - 제안: `_overview.md ## Rationale` 의 제거 정책 항에 "docs 에 한 번도 등재된 적 없는 seed op 은 `deprecated` 전환 없이 outright 제거가 적합함 — `deprecated` 는 Cafe24 공식 문서 기준 폐기된 endpoint 에만 적용(§3 정의)." 한 줄 명시.

- **[INFO]** `_overview.md` §6 "신규 endpoint 등재 절차" 에 상응하는 "제거 절차" 미정의
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md` §6
  - 과거 결정 출처: `_overview.md` §6 — 4단계 신규 등재 절차만 정의
  - 상세: §6 은 새 endpoint 를 `planned → supported` 로 승격하는 절차를 명시하지만, `supported → 제거` 경로(metadata row 삭제 + catalog row 삭제 + i18n 삭제 + coverage 갱신 + drift guard allowlist 갱신)는 정의되지 않았다. 이번 변경이 사실상 그 절차를 구현했으나 spec 에 반영되지 않았다. 향후 동일 유형 제거 작업 시 절차 편차 위험.
  - 제안: `_overview.md §6` 에 "endpoint 제거 절차" 소절 추가 또는 `_overview.md ## Rationale` 에 참조 기록.

### 요약

이번 변경(G-3l)은 Cafe24 공식 docs HTML 이 authoritative 로 확정된 근거 위에 G-2 의 "production 검증 전 유지" 결정을 역전해 9개 docs-부재 seed 조작을 제거했다. 역전의 논리적 근거(HTML 확정·비동작 404·사용자 결정)는 타당하며 `catalog-sync.spec.ts` 의 양방향 동기 invariant 및 §2 의 `docs` 필수 요건과의 정합도 오히려 개선됐다. 그러나 G-2 번복 Rationale 와 "미문서화 seed 직접 제거 vs deprecated" 경로 선택 근거, endpoint 제거 절차가 `_overview.md ## Rationale` 에 기록되지 않아 spec 문서 자체의 자기완결성이 부족하다. CRITICAL 수준의 합의 원칙 위반은 없으나 WARNING 한 건(Rationale 미반영 번복)이 존재한다.

### 위험도

LOW
