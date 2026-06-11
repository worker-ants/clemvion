# Requirement Review

## 발견사항

### 파일 1: spec/2-navigation/8-marketplace.md — Rationale 섹션 삭제

- **[INFO]** Rationale 전체 삭제 — 기능 완전성 관점
  - 위치: diff `-38~-46` (## Rationale 이하 전체)
  - 상세: `status: backlog` 유지 이유(R-1)와 "화면 구조·설치 플로우·API 표는 구현 약속이 아닌 설계 스케치" 맥락이 제거됐다. 삭제 자체는 문서 정리 범위이며 spec 본문(기능 명세)이 아니라 Rationale 이라 기능 완전성 영향 없다. 그러나 backlog 상태의 근거가 doc 에서 소실돼 향후 기여자가 `code: []` 의 의미를 파악하기 어려워진다.
  - 제안: 삭제 의도가 "Rationale 불필요"라면 현재 변경 그대로 유지. 의도가 불명확하면 재확인 권장.

---

### 파일 2: spec/5-system/1-auth.md — §4.1 감사 로그 액션 테이블 재구성

- **[INFO] [SPEC-DRIFT]** 구현된 액션 목록이 별도 표로 명시됐으나, 구 "기록 대상 액션" 단일 표는 "Planned" 로 전환
  - 위치: §4.1 전체 개편 (lines 214–238 diff)
  - 상세: 변경 전 단일 표에 모든 action 이 혼재했고 `integration.create/update/delete` 라는 구 이름이 살아 있었다. 변경 후 "현재 구현된 액션" 표와 "Planned" 표로 이분된 구조는 코드와 정합한다(`audit-action.const.ts` 의 `AUDIT_ACTIONS` 값 — `integration.created`, `integration.updated`, `integration.deleted`, `integration.rotated`, `integration.scope_changed`, `integration.reauthorized`, `workspace.transfer_ownership`, `execution.re_run`, `auth_config.reveal`). 이 분리는 의도적 개선이다.
  - 이전 표의 `auth_config.reveal` 이 Planned 표의 "설정" 행에 `auth_config.regenerate` 와 함께 있었는데, 변경 후 구현 표에 `auth_config.reveal` 이 등재되고 Planned 표의 설정 행에서 제거됐다 — 코드와 일치.
  - 제안: 코드 유지. spec 이 구현 현황을 정확히 반영하는 SPEC-DRIFT(갱신 완료) 로 처리. 해결 대상 없음.

- **[INFO]** `auth_config.reveal` 이 Planned 표 "설정" 행에서 제거됐으나 `auth_config.regenerate` 는 여전히 Planned 표에 있음
  - 위치: Planned 표 "설정" 행 (line 238)
  - 상세: 구 표에 `auth_config.regenerate` 가 Planned 로 분류됐으나 `AUDIT_ACTIONS` 에는 없다 — 일관된 분류. `auth_config.create/update/delete` 도 Planned 유지로 정합.
  - 제안: 현재 상태 유지.

---

### 파일 3: spec/5-system/13-replay-rerun.md — action 명 `re_run_initiated` → `execution.re_run`

- **[INFO] [SPEC-DRIFT]** action 문자열 변경
  - 위치: §11 (lines 793–810 diff)
  - 상세: `re_run_initiated` → `execution.re_run` 으로 정정. `executions.service.ts` 422 라인에서 `AUDIT_ACTIONS.EXECUTION_RE_RUN` (`execution.re_run`)을 사용 중 — 구현과 완전 일치. 과거 `re_run_initiated` 는 dot-prefix 없이 naming 규약을 이탈했으므로 코드가 옳고 spec 이 낡았던 사례(cross-audit G-02).
  - `AuditLogsService.record` 의 `action` 파라미터가 `AuditAction` union 으로 강제되어 인라인 문자열 금지 문구 추가 — 코드와 일치(`audit-logs.service.ts` line 75: `action: AuditAction`).
  - 제안: 코드 유지. spec 갱신 완료.

---

### 파일 4: spec/5-system/3-error-handling.md — `TOKEN_INVALID` 설명 단축

- **[WARNING]** `TOKEN_INVALID` 설명에서 refresh 회전 경합 시나리오 제거 — 정보 손실 여부 검토 필요
  - 위치: §1.2 인증/인가 에러 표, `TOKEN_INVALID` 행
  - 상세: 변경 전 설명: "변조/형식 오류, refresh 토큰 미존재/소유자 부재, 또는 refresh 회전 시 조건부 revoke 매칭 0건(동시 회전 경합)" → 변경 후: "변조/형식 오류"만 남음. 실제 `auth.service.ts` `refresh()` 메서드를 확인하면 회전 경로에 **조건부 UPDATE(`is_revoked=false AND expires_at>now`) 와 단일 트랜잭션이 구현되어 있지 않다** — 현재 코드는 단순 `update(stored.id, { isRevoked: true })` 로 비조건부다. `TOKEN_INVALID` 가 실제로 발생하는 경로는 (1) 토큰 미존재(stored=null), (2) `stored.isRevoked=true`(reuse 탐지) 두 가지다. 따라서 "동시 회전 경합 → TOKEN_INVALID" 경로는 **코드에 존재하지 않으며**, 삭제는 사실 반영이다.
  - 그러나 삭제 후 남은 설명 "변조/형식 오류"는 (1)(2) 중 (2)번(reuse 탐지)을 포함하지 않아 여전히 불완전하다. `TOKEN_INVALID` 가 발행되는 두 경로를 모두 서술하는 것이 스펙 정확성상 권장된다.
  - 제안: 설명을 "변조/형식 오류 또는 토큰 미존재; 또는 revoke된 토큰 재사용(reuse 탐지, family 전체 revoke 후 반환)" 수준으로 보강 검토. 단, 이는 코드 버그가 아닌 spec 서술 개선이므로 `project-planner` 위임 대상.

  - **부가 관찰** (코드 vs 구 spec 불일치 해소 확인): `data-flow/2-auth.md` 의 Rationale "Refresh token 회전 원자성" 섹션 전체가 삭제됐고(파일 7), 다이어그램에서도 트랜잭션 블록과 조건부 UPDATE 가 제거됐다. 실제 코드(`auth.service.ts` 574~578)가 조건부 UPDATE 없는 단순 update 임을 확인 — spec/data-flow 갱신이 코드와 정합.

---

### 파일 5: spec/conventions/spec-impl-evidence.md — `id` 필드 정의에서 충돌 회피 규칙 삭제

- **[WARNING]** `id` 충돌 회피 규칙(`영역 prefix`) 설명 제거
  - 위치: §2.1 필드 정의 표, `id` 행
  - 상세: 삭제된 문구: "같은 basename 이 영역을 달리해 중복될 때는 후발 문서가 영역 prefix 로 충돌을 회피한다 (예: `spec/5-system/17-agent-memory.md` 가 `agent-memory` 를 점유 → `spec/2-navigation/16-agent-memory.md` 는 `nav-agent-memory`)". 실제로 `spec/2-navigation/16-agent-memory.md` 는 `id: nav-agent-memory` 를 사용 중이므로 이 규칙이 실제 적용된 패턴이다. 가드(`spec-frontmatter.test.ts`)는 `id` 비어 있으면 실패하나 id 고유성은 강제하지 않는다 — 즉 충돌 시 규칙을 따르지 않아도 빌드는 통과한다. 규칙 삭제로 신규 기여자가 이 패턴을 알 수 없게 된다.
  - 의도가 "id 고유성을 가드로 강제하지 않으므로 규칙 문서도 불필요"라면 그 근거를 spec 에 남기는 것이 권장된다. 의도가 "규칙은 여전히 존재하나 설명 불필요"라면 삭제 후 실제 예시(`nav-agent-memory`)가 고립된 관행이 된다.
  - 제안: 삭제 의도 확인. 만약 규칙을 유지한다면 설명 복원 또는 가드 추가(`id` 중복 탐지) 검토. 의도적 삭제라면 현재 상태 유지.

---

### 파일 6: spec/data-flow/1-audit.md — action 표기 규약 갱신, 과거 비일관 서술 교체

- **[INFO] [SPEC-DRIFT]** §1.1 표 및 Rationale 서술이 코드 현황과 정합하도록 갱신됨
  - 위치: §1.1 Writer action 표, Rationale "Action 은 자유 문자열" 섹션
  - 상세: `re_run_initiated` → `execution.re_run` 반영, "action union 부재" 과거 서술 → "AuditAction union 으로 강제" 갱신. 구현(`audit-action.const.ts`)과 일치. 코드가 옳고 spec 이 낡았던 상태가 해소됐다.
  - 제안: 코드 유지. spec 갱신 완료.

---

### 파일 7: spec/data-flow/2-auth.md — Refresh token 회전 원자성 Rationale 삭제

- **[INFO] [SPEC-DRIFT]** 조건부 UPDATE + 트랜잭션 설계 근거 전체 삭제
  - 위치: §1.4 다이어그램 블록, Rationale "Refresh token 회전 원자성" 섹션
  - 상세: 구 spec 은 "단일 트랜잭션 + 조건부 UPDATE(`is_revoked=false AND expires_at>now`) + affected=0 시 TOKEN_INVALID" 를 설계 근거로 명문화했으나, 실제 `auth.service.ts`의 `refresh()` 는 그 구조가 없다 — `dataSource.transaction` 없이 단순 `update(stored.id, ...)`. spec 이 구현되지 않은 설계를 서술한 것이므로, 삭제가 코드 현황에 부합한다. 트랜잭션 미적용 → 크래시 시 구 토큰만 revoke되고 신규 토큰 없는 세션 소실 위험은 여전히 미해결 상태이나, 이는 본 diff 의 범위 밖(구현 개선 필요 여부는 별도 판단).
  - 제안: spec 갱신 완료. 트랜잭션 미구현은 코드 품질 이슈지만 본 spec 변경(문서 현실화)과 직교하므로 별도 plan 검토 권장.

---

## 요약

7개 파일 변경은 audit log action 명(`re_run_initiated` → `execution.re_run`)과 `AuditAction` union 타입 강제, 그리고 refresh token 회전 spec 현실화(미구현 트랜잭션/조건부 UPDATE 서술 제거)를 중심으로 spec 을 코드 현황과 정합시킨다. 코드 구현(`audit-action.const.ts`, `executions.service.ts`, `auth.service.ts`)과 대조한 결과 대부분의 변경은 SPEC-DRIFT 해소(spec 갱신)에 해당하며 코드를 되돌릴 이유가 없다. 주의 사항은 두 가지다: (1) `TOKEN_INVALID` 설명이 reuse 탐지 경로를 누락한 불완전 상태이며 보강이 권장되고, (2) spec-impl-evidence 의 `id` 충돌 회피 규칙 삭제가 실제 적용된 패턴(`nav-agent-memory`)을 고립시키므로 의도 확인이 필요하다. 기능 누락이나 구현 오류는 발견되지 않았다.

## 위험도

LOW
