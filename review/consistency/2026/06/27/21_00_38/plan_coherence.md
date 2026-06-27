# Plan 정합성 검토 결과

검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`

## 발견사항

- **[INFO]** `application.md` 내 docs-부재 seed 참조가 G-2 → G-3l 로 갱신 필요
  - target 위치: `spec/conventions/cafe24-api-catalog/application.md` 하단 ⚠ 노트 ("운영 검증 / 제거 결정 트랙: `plan/in-progress/cafe24-backlog-residual.md §G-2`")
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md §G-3l` ("⏸ 미결 유지 2026-06-20 재검증" — KNOWN_G2 9개 ops 제거 결정은 planner 트랙 open)
  - 상세: `§G-2` 는 "현행 유지" 결정이 2026-06-02 에 내려져 그 자체로는 종결됐고, 실질적인 개방 결정 추적은 `§G-3l` 이 담당하고 있다. target 의 링크가 `§G-2` 를 가리키는 것은 오래된 참조다.
  - 제안: `application.md` 의 ⚠ 노트 링크를 `§G-2` → `§G-3l` 로 갱신. plan 쪽은 변경 불요.

- **[INFO]** `cafe24-api-catalog` field-level 문서 일부가 G-4 generator 재생성 잔여 대상
  - target 위치: `spec/conventions/cafe24-api-catalog/application/*.md`, `spec/conventions/cafe24-api-catalog/category/*.md` 포함 field-level 파일 전반
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md §G-4` ("잔여 (재생성 시 자동 정정): `links` 등 다른 충돌명을 공유하는 field-level 파일들")
  - 상세: 응답 래퍼 ↔ 요청 파라미터 이름 충돌 설명 오염 버그(G-4)는 수동 hand-fix 4건 외에 나머지 파일은 generator 전체 재생성 시 일괄 정정 예정이다. 대상 field-level 파일들이 재생성 전까지 오염 잔존 가능성이 있다. `_overview.md §7.3` 의 수동 회귀 검증 레시피로 추적됨.
  - 제안: 추적은 이미 `_overview.md §7.3` + plan `§G-4` 에 충분히 기록됨. 별도 조치 불요, 재생성 PR 에서 일괄 반영.

- **[INFO]** `audit-actions.md §3` 의 `model_config` 미구현 항목에 대응 plan 참조 없음
  - target 위치: `spec/conventions/audit-actions.md §3 도메인별 분류 레지스트리` — `model_config | 현재형 (§2.2) | create/update/delete/set_default | 미구현`
  - 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md §G-01` ("전 도메인 audit 기록 확대는 별도 기능 plan 으로 이월(Planned)")
  - 상세: cross-audit G-01 완료 시점에 "전 도메인 audit 확대는 별 plan 이월"로 명시됐으나, `model_config` audit action 구현을 추적하는 in-progress plan 이 현재 없다. target 이 미구현 항목을 명시적으로 "미구현" 으로 등재한 것은 적절하나, 향후 구현 시 plan 작성이 필요하다.
  - 제안: 현재 조치 불요. 구현 착수 시 developer plan 을 신설하거나 `spec-code-cross-audit` 잔여 항목에 등록.

## 요약

`spec/conventions/` 변경(audit-actions.md 신설 + cafe24-api-catalog field-level 카탈로그)은 진행 중 plan 의 미해결 결정을 일방적으로 우회하거나 선행 plan 을 미해소 상태에서 넘어가는 사례가 없다. `audit-actions.md` 는 `spec-code-cross-audit` G-01/G-02 의 **결과물을 conventions 문서로 성문화**한 것이며 taxonomy 구조 자체는 동 plan 에서 이미 합의된 사항이다. cafe24-api-catalog field-level 파일들은 `cafe24-backlog-residual §G-1-remaining` 의 docs-side SoT 역할을 하도록 설계된 것으로 해당 plan 과 정합하다. 지적 사항은 모두 INFO 급(plan 내 stale 링크 1건, generator 재생성 잔여 트래킹 1건, plan 미신설 1건)으로 즉각적 차단 요인 없음.

## 위험도

LOW
