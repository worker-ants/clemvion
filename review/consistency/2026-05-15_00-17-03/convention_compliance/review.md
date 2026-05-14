---

## 검토 결과: `spec/1-data-model.md` Convention Compliance

### 발견사항

---

**[INFO] `## Overview` 섹션 누락**
- target 위치: `spec/1-data-model.md` 문서 최상단 (§1 바로 전)
- 위반 규약: CLAUDE.md §프로젝트 스펙 문서 — 권장 3섹션 구성 (Overview / 본문 / Rationale)
- 상세: 문서가 곧장 `## 1. 엔티티 관계 개요` 로 시작하며 제품 정의 레이어(사용자 가치·요구사항·목표)를 담는 `## Overview` 섹션이 없음. `## Rationale` 은 존재함 ✓
- 제안: 권장 사항이므로 차단 필요 없음. 향후 본 문서 대규모 개정 시 `## Overview` 섹션을 추가하여 "왜 이 데이터 모델이 이 구조인가"를 기술하면 완전 준수

---

**[INFO] `last_error.code` / `IntegrationUsageLog.error.code` 대소문자 형식 미명시**
- target 위치: `spec/1-data-model.md` §2.10 `last_error` 필드 설명, §2.10.1 `error` 필드 설명
- 위반 규약: `spec/conventions/node-output.md` Principle 3.2 — "`code` 는 `UPPER_SNAKE_CASE`"
- 상세: 두 필드 모두 `{ code, message, ... }` 형태만 나열하고 `code` 값의 케이스 형식을 명시하지 않음. 반면 `status_reason` 필드는 "모두 `snake_case`"·"DB 저장값은 `snake_case`" 를 명시적으로 기술하고 있음. 이 필드들은 노드 실행 실패에서 유래한 런타임 에러를 저장하므로 node-output 규약의 `UPPER_SNAKE_CASE` 가 적용되어야 하나, 구현자가 spec만 보면 판단 불가
- 제안: 두 필드 설명에 `code: UPPER_SNAKE_CASE (node-output.md Principle 3.2 준수)` 를 명시 추가. `status_reason` 의 "의도적 분리" 주석과 대비를 명확히 하면 혼동 방지

---

**[INFO] §1 엔티티 관계 다이어그램 — `IntegrationUsageLog` 계층 오류**
- target 위치: `spec/1-data-model.md` §1 (라인 20–21), §2.10.1
- 위반 규약: 정식 규약 직접 위반은 아님 — 스펙 내부 일관성 이슈
- 상세: 다이어그램이 `IntegrationUsageLog` 를 `Workspace` 의 직접 자식(`└──`)으로 표기하나, §2.10.1 의 `integration_id FK → Integration (CASCADE)` 정의에 따르면 `Integration` 의 자식임. 또한 `└──` 이후 `├──` 가 계속되어 ASCII 트리 문법도 위반
- 제안: `Integration` 항목 하위로 이동:
  ```
  │       ├── Integration (1:N)
  │       │       └── IntegrationUsageLog (1:N)
  ```
  `└── IntegrationUsageLog (1:N)` 라인과 그 이후 잘못된 `├──` 연속 제거

---

### Migration Convention 점검 (spec/conventions/migrations.md) — PASS

| 점검 항목 | 결과 |
|-----------|------|
| V043 → V044 → V045 단조 증가 | ✓ |
| V간 gap 없음 | ✓ |
| `V044__integration_install_token_issued_at.sql` 명명 | ✓ |
| `V045__integration_mall_id_plain.sql` 명명 | ✓ |
| `V045__integration_mall_id_plain.conf` base name 일치 | ✓ |
| V045 `.conf` 이유 적정 (`CONCURRENTLY` → `executeInTransaction=false`) | ✓ |
| 기존 migration append-only 원칙 (새 컬럼 nullable 추가) | ✓ |

---

### 범위 외 관찰 (consistency-checker 도메인)

> Convention Compliance 범위 밖이나 구현 착수 전 인지가 중요한 사항으로 별도 기록.

**`spec/data-flow/integration.md` ↔ `spec/1-data-model.md` TTL 기준 불일치**: `spec/data-flow/integration.md` 라인 101·135·165 의 `pending-install-ttl` 스캐너 쿼리가 아직 `created_at < now - 24h` 를 사용하는 반면, `spec/1-data-model.md` §2.10 `install_token_issued_at` 설명은 V044 이후 `install_token_issued_at` 을 TTL 기준으로 쓰고 `created_at` 은 NULL fallback 으로만 사용한다고 정의함. 구현자가 data-flow spec 의 SQL pseudocode 를 따르면 V044 추가의 목적이 무력화됨. **`/consistency-check --cross-spec` 실행 권장.**

---

### 요약

`spec/1-data-model.md` 는 정식 규약(`spec/conventions/`) 을 직접 위반하는 항목이 없음. Migration 명명·V번호 단조성 등 migration.md 규약은 완전 준수. 발견된 세 건 모두 INFO 등급으로, `## Overview` 누락(권장 사항), 에러 코드 대소문자 명시 부재(문서 품질), 다이어그램 계층 오류(기존 이슈)임. 단, 범위 외 관찰에서 지적한 data-flow spec과의 TTL 기준 불일치는 구현 전 교차 점검이 필요함.

### 위험도

**LOW**