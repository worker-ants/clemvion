# Code Review 통합 보고서

## 전체 위험도
**LOW** — spec 현실화(SPEC-DRIFT 해소) 중심 변경. 코드 구현 오류 없음. 두 가지 spec 서술 보강 권장사항 존재.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | spec 서술 불완전 | `TOKEN_INVALID` 설명이 "변조/형식 오류"만 남아 reuse 탐지 경로(revoke된 토큰 재사용 → family 전체 revoke) 누락. 코드 버그는 아님. | `spec/5-system/3-error-handling.md` §1.2 | `TOKEN_INVALID` 설명을 "변조/형식 오류 또는 토큰 미존재; 또는 revoke된 토큰 재사용(reuse 탐지, family 전체 revoke 후 반환)" 수준으로 보강. `project-planner` 위임 대상. |
| 2 | 관행 고립 | `id` 충돌 회피 규칙(`영역 prefix`) 설명 제거. 실제 적용된 패턴(`nav-agent-memory`)이 문서 없이 고립된 관행이 됨. 빌드 차단 없음. | `spec/conventions/spec-impl-evidence.md` §2.1 | 삭제 의도 확인. 규칙 유지라면 설명 복원 또는 `id` 중복 탐지 가드 추가 검토. 의도적 삭제라면 현재 상태 유지. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `re_run_initiated` → `execution.re_run` action 명 정정. `executions.service.ts` 422L `AUDIT_ACTIONS.EXECUTION_RE_RUN` 과 완전 일치. 과거 naming 규약 이탈 해소(cross-audit G-02). | `spec/5-system/13-replay-rerun.md` §11 | 코드 유지. spec 갱신 완료. |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] §4.1 감사 로그 액션 표 이분화. "현재 구현된 액션" vs "Planned" 분리. `audit-action.const.ts`의 `AUDIT_ACTIONS` 값과 정합. 구 `integration.create/update/delete` → `integration.created/updated/deleted`(코드 이름)으로 교정. | `spec/5-system/1-auth.md` §4.1 | 코드 유지. spec 갱신 완료. |
| 3 | SPEC-DRIFT | [SPEC-DRIFT] action 표기 규약 갱신. "action union 부재" 과거 서술 → "AuditAction union 으로 강제" 갱신. `re_run_initiated` → `execution.re_run` 반영. | `spec/data-flow/1-audit.md` §1.1 | 코드 유지. spec 갱신 완료. |
| 4 | SPEC-DRIFT | [SPEC-DRIFT] Refresh token 회전 원자성 Rationale 삭제. 구 spec의 "단일 트랜잭션 + 조건부 UPDATE" 설계는 코드(`auth.service.ts`)에 미구현; spec 삭제가 현실 부합. 트랜잭션 미구현으로 인한 세션 소실 위험은 미해결이나 본 diff 범위 밖. | `spec/data-flow/2-auth.md` §1.4, Rationale | spec 갱신 완료. 트랜잭션 미구현은 별도 plan 검토 권장. |
| 5 | 문서 정리 | Rationale 전체 삭제. backlog 상태 근거(`R-1`)와 "화면 구조·설치 플로우·API 표는 설계 스케치" 맥락 소실. 기능 완전성 영향 없음. | `spec/2-navigation/8-marketplace.md` diff `-38~-46` | 의도가 명확하면 현재 상태 유지. 의도 불명확하면 재확인 권장. |
| 6 | 분류 일관성 | `auth_config.regenerate` 가 Planned 표에 남아 있고 `AUDIT_ACTIONS` 에 없음 — 일관된 Planned 분류. `auth_config.create/update/delete` 도 동일하게 Planned 유지. | `spec/5-system/1-auth.md` Planned 표 | 현재 상태 유지. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | LOW | spec ↔ 코드 SPEC-DRIFT 해소 확인. WARNING 2건(TOKEN_INVALID 설명 불완전, id 충돌 규칙 삭제). 코드 구현 오류 없음. |
| documentation | N/A (출력 파일 없음) | output_file 부재 — 재시도 필요. |

## 발견 없는 에이전트

- documentation: 출력 파일을 읽을 수 없음 (재시도 필요).

## 권장 조치사항

1. **[project-planner 위임]** `spec/5-system/3-error-handling.md` §1.2 `TOKEN_INVALID` 설명을 reuse 탐지 경로까지 포함하도록 보강.
2. **[의도 확인]** `spec/conventions/spec-impl-evidence.md` §2.1 `id` 충돌 회피 규칙 삭제 의도 확인. 규칙 유지 의도라면 설명 복원 또는 가드 추가.
3. **[별도 plan]** `auth.service.ts` refresh() 트랜잭션 미구현(세션 소실 위험) — 본 diff 범위 밖이나 추적 필요.
4. documentation reviewer 재실행 (output_file 부재).

## 라우터 결정

라우터가 reviewer 선별 수행 (`routing=done`).

- **실행**: `requirement`, `documentation` (2명, 강제 포함)
- **강제 포함(router_safety)**: `documentation`, `requirement`
- **제외**: `security`, `performance`, `architecture`, `scope`, `side_effect`, `maintainability`, `testing`, `dependency`, `database`, `concurrency`, `api_contract`, `user_guide_sync` (12명)

| 제외된 reviewer | 이유 |
|-----------------|------|
| security | 라우터 선별 제외 |
| performance | 라우터 선별 제외 |
| architecture | 라우터 선별 제외 |
| scope | 라우터 선별 제외 |
| side_effect | 라우터 선별 제외 |
| maintainability | 라우터 선별 제외 |
| testing | 라우터 선별 제외 |
| dependency | 라우터 선별 제외 |
| database | 라우터 선별 제외 |
| concurrency | 라우터 선별 제외 |
| api_contract | 라우터 선별 제외 |
| user_guide_sync | 라우터 선별 제외 |