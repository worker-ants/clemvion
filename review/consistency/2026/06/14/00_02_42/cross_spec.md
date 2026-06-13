# Cross-Spec 일관성 검토 결과

**Target**: `spec/conventions/audit-actions.md`
**검토 일시**: 2026-06-14

---

## 발견사항

- **[INFO]** 책임 경계 위임 선언 — target 은 정확히 소유 범위를 명시하고 있으며 다른 spec 의 SoT 와 모순 없음
  - target 위치: `## Overview` 책임 경계 bullet
  - 충돌 대상: `spec/5-system/1-auth.md §4.1`, `spec/data-flow/1-audit.md §1.1`
  - 상세: target 이 선언하는 "액션 카탈로그·workspace 귀속·읽기측 계약은 1-auth §4.1 이 SoT" / "적재·조회·커버리지는 data-flow/1-audit §1.1 이 SoT" 와 해당 문서들의 자기 기술이 일치한다. `1-auth.md §4.1` 은 "Action naming 규약은 conventions/audit-actions.md 가 SoT" 라고 명시적으로 위임하고 있어 순환이 아닌 명확한 분업이다.
  - 제안: 현행 유지. 별도 조치 불필요.

- **[INFO]** `§3 도메인별 분류 레지스트리` ↔ `1-auth §4.1 Planned 표` 내용 동기화 확인
  - target 위치: `§3` 표 전체
  - 충돌 대상: `spec/5-system/1-auth.md §4.1` Planned 표, `spec/data-flow/1-audit.md §1.1` 표
  - 상세: 세 개 문서가 나열하는 액션 목록이 일치한다. target §3 의 구현/Planned 분류, `1-auth §4.1` 의 구현/Planned 분류, `data-flow §1.1` 의 Writer 표가 모두 동일한 18개 액션을 같은 상태로 기록하고 있다. 불일치 없음.
  - 제안: 현행 유지.

- **[INFO]** `model_config` Planned 액션의 verb 목록 동기화 확인
  - target 위치: `§3` 표 — `model_config | 현재형 (§2.2) | create, update, delete, set-default | Planned`
  - 충돌 대상: `spec/5-system/1-auth.md §4.1` Planned 표 — `model_config.*` (create/update/delete/set-default)
  - 상세: 표기가 동일(`create`, `update`, `delete`, `set-default`)하고 현재형 패턴 선택 근거(set-default 가 과거분사로 부자연스러워 resource 단위 현재형 통일)도 양쪽이 일치한다. 충돌 없음.
  - 제안: 현행 유지.

- **[INFO]** `workspace` 두 패턴 혼용 — 설명 일관성
  - target 위치: `§3` 표 및 각주 "workspace 가 두 패턴에 걸치는 이유"
  - 충돌 대상: `spec/5-system/1-auth.md §4.1` Planned 표 (`workspace.created`, `workspace.updated`, `workspace.deleted`) 및 구현 표 (`workspace.transfer_ownership`)
  - 상세: target 의 분류(transfer_ownership = 도메인 동사 §2.3, created/updated/deleted = 과거분사 §2.1)와 auth spec 의 분류가 일치한다. 혼용 사유를 각주로 명확히 설명하고 있어 충돌 없음.
  - 제안: 현행 유지.

- **[INFO]** `data-flow/1-audit.md §1.1` 이 target 을 참조하지 않음 (단방향)
  - target 위치: `## Overview` — "감사 로그 적재·조회 파이프라인·커버리지 추적: data-flow/1-audit.md §1.1 (SoT)"
  - 충돌 대상: `spec/data-flow/1-audit.md` — 표기 규약을 언급하나 `conventions/audit-actions.md` 를 명시적으로 링크하지 않음
  - 상세: `data-flow/1-audit.md §1.1` 은 "표기 규약은 dot-prefix 기준" 이라 서술하되 conventions 파일을 직접 링크하지 않는다. 모순은 아니나 상호 참조 일관성이 낮다.
  - 제안: `data-flow/1-audit.md §1.1` 에 `[conventions/audit-actions.md](../conventions/audit-actions.md)` 링크 추가 권장 (동기화 편의).

---

## 요약

`spec/conventions/audit-actions.md` (target) 는 다른 spec 영역과 직접 모순되는 정의를 포함하지 않는다. 책임 경계 분할(`1-auth §4.1` = 카탈로그 SoT, `data-flow/1-audit §1.1` = 적재·커버리지 SoT, `conventions/audit-actions.md` = 명명 규약 SoT)이 세 문서 모두에서 일관되게 선언되어 있으며, 액션 목록·verb 표기·상태(구현/Planned) 분류가 전 문서에 걸쳐 동기화되어 있다. 유일한 개선점은 `data-flow/1-audit.md` 가 `conventions/audit-actions.md` 를 명시적으로 역참조하지 않는 단방향 링크 누락(INFO 등급)이며, 이는 정합성에 영향을 주지 않는다.

---

## 위험도

NONE
