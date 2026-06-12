# 정식 규약 준수 검토 결과

**Target**: `spec/5-system/1-auth.md`
**검토 모드**: spec draft (--spec)
**검토 일시**: 2026-06-12

---

## 발견사항

### [WARNING] Planned 감사 액션 동사 시제 불일치 — `member.*`, `workflow.*`, `trigger.*`, `schedule.*`
- **target 위치**: `spec/5-system/1-auth.md` §4.1 "Planned (미구현 — 목표 커버리지)" 표
- **위반 규약**: `spec/5-system/1-auth.md` §4.1 Action naming 규약 및 Rationale §4.1.A (본 문서 내 자기참조 일관성)
- **상세**: §4.1 Action naming 규약은 "audit 는 '일어난 일'의 기록이므로 integration 은 과거분사(`created`/`updated`/`deleted`)를 쓴다"고 명시하고 있다. Rationale §4.1.A도 "verb 시제는 과거분사 — `changed`/`enabled`/`disabled`"를 확정한다. 그러나 Planned 표에서 다음 액션들은 현재형 동사를 사용하고 있다:
  - `member.invite` → `member.invited` 여야 함
  - `member.role_change` → `member.role_changed` 여야 함
  - `member.remove` → `member.removed` 여야 함
  - `workflow.create` / `.update` / `.delete` / `.execute` → `created`/`updated`/`deleted`/`executed`
  - `trigger.create` / `.update` / `.delete` → `created`/`updated`/`deleted`
  - `schedule.create` / `.update` / `.delete` → `created`/`updated`/`deleted`
  
  `workspace.create`, `workspace.update`, `workspace.delete`도 동일하게 과거분사로 정정이 필요하다. `auth_config.*` (현재형 통일)는 §4.1이 명시적으로 예외로 선언했으므로 제외한다.
  
  Rationale §4.1.A는 `user.*` dot-prefix 정정을 기술하면서 "verb 시제는 과거분사 — integration 계열과 같이" 라고 확정했는데, 동일 Planned 표의 나머지 액션들이 이 규약을 따르지 않는다.

- **제안**: Planned 표의 `member.*`, `workflow.*`, `trigger.*`, `schedule.*`, `workspace.*` 의 현재형 동사를 과거분사로 정정한다. 단 `workspace.transfer_ownership`(구현된 액션, 이미 과거분사 아님)은 별도 검토 필요(아래 INFO 참조).

---

### [WARNING] `workspace.transfer_ownership` 동사 형식 불일치
- **target 위치**: `spec/5-system/1-auth.md` §4.1 "현재 구현된 액션" 표
- **위반 규약**: `spec/5-system/1-auth.md` §4.1 Action naming 규약 — "audit 는 '일어난 일'의 기록이므로 integration 은 과거분사를 쓴다"
- **상세**: 구현된 액션 `workspace.transfer_ownership`은 동사 원형(명사형)이다. `integration.*` 계열이 `created`/`updated`/`deleted` 과거분사를 사용하고, §4.1 규약이 audit 는 "일어난 일"의 기록임을 원칙으로 내세운 것과 대조된다. `transfer_ownership`은 과거분사로 만들면 `ownership_transferred`가 자연스럽다.
  
  다만 이 액션은 **이미 구현(implemented)된 코드가 `AUDIT_ACTIONS` union에 존재**하므로 rename은 `error-codes.md §2` rename 정책처럼 잠재적 breaking change(소비자가 `action` 값으로 필터링하는 경우)가 될 수 있다. 그러나 §4.1의 규약 자체가 이 예외를 문서화하지 않고 있으므로 규약 또는 historical-artifact 주석 추가가 필요하다.
- **제안**: (a) spec에 `workspace.transfer_ownership`을 historical-artifact 예외로 명시적으로 주석 달거나, (b) 신규 구현 전이라면 `workspace.ownership_transferred`로 정정하고 규약을 일관되게 적용한다.

---

### [INFO] Planned 표 `workspace.*` 액션의 백틱 누락
- **target 위치**: `spec/5-system/1-auth.md` §4.1 Planned 표
- **위반 규약**: 문서 구조 일관성 (동일 표 내 표기 형식)
- **상세**: 구현된 액션 표와 Planned 표를 비교하면, 구현된 표는 `\`integration.created\`` 처럼 모든 action 문자열에 backtick 이 적용돼 있다. Planned 표에서는 `workspace.create`, `workspace.update`, `workspace.delete`가 backtick 없이 나열되어 있어 형식이 불일치한다. (나머지 Planned 행은 backtick 미적용으로 일관적이긴 하나, 구현된 표 스타일과 다르다.)
- **제안**: Planned 표의 action 문자열에 backtick을 일관 적용한다.

---

### [INFO] §1.5.4 에러 응답 — `error-codes.md §3` 레지스트리 등재 cross-link가 올바른 방향임 확인
- **target 위치**: `spec/5-system/1-auth.md` §1.5.4 명명 — historical-artifact 예외 블록
- **위반 규약**: 없음 (정상 준수)
- **상세**: `invitation_not_found` 등 `lower_snake_case` 에러 코드가 `error-codes.md §3 historical-artifact 레지스트리`에 등재되어 있음을 명시하고 있다. `error-codes.md §3` 레지스트리를 직접 확인한 결과 해당 코드들이 등재되어 있어 규약과 일치한다. 이 부분은 정상.

---

### [INFO] `data: { message }` 응답 형태 — `swagger.md §2-5` 래퍼 형식 준수 확인 권고
- **target 위치**: `spec/5-system/1-auth.md` §1.1.A 설계 원칙 "응답 동일성" 항목
- **위반 규약**: 잠재적 — `spec/conventions/swagger.md §2-5` (응답 wrapping: `{ data: ... }`)
- **상세**: `200 { data: { message } }` 응답 형식이 기술되어 있는데, 이는 `TransformInterceptor`가 적용하는 `{ data: ... }` 봉투와 일치한다. spec 문서 수준에서는 정상이다. API endpoint 표(§5)에서 `forgot-password`의 성공 응답 형태가 명시적으로 기술되지 않은 점은 사소한 불완전이지만 규약 위반은 아니다.
- **제안**: INFO 수준으로 기록만.

---

## 요약

`spec/5-system/1-auth.md`는 문서 구조 규약(frontmatter `id`/`status`/`code`/`pending_plans` 의무 — spec-impl-evidence §1)을 올바르게 준수하고 있으며, 에러 코드 historical-artifact 예외(`invitation_*` lower_snake_case)를 `error-codes.md §3` 레지스트리와 정합하게 문서화하고 있다. 주된 문제는 §4.1 Action naming 규약이 "audit는 '일어난 일'의 기록이므로 과거분사를 쓴다"고 명시했음에도 Planned 표의 `member.*`, `workflow.*`, `trigger.*`, `schedule.*`, `workspace.*` 액션이 현재형 동사를 사용하고 있다는 점이다. 동일 섹션의 Rationale §4.1.A가 `user.*` 표기를 과거분사로 정정하는 이유를 명시하면서 일관성의 기대를 높인 만큼, 나머지 Planned 액션들도 동일 규약 적용이 필요하다. 구현된 액션인 `workspace.transfer_ownership`도 시제 예외를 명시적으로 문서화하거나 정정이 권고된다.

## 위험도

**MEDIUM** — Planned 액션 표기가 구현 시 `AUDIT_ACTIONS` union에 잘못된 시제로 추가될 경우 규약 위반이 코드로 굳어진다. 현재는 미구현 단계라 수정 비용이 낮지만, 방치 시 `re_run_initiated` 선례(cross-audit G-02에서 정정 필요했던 케이스)가 반복된다.
