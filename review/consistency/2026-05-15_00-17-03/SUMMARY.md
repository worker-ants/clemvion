# Consistency Check 통합 보고서

**BLOCK: YES** — plan_coherence Critical 위배 2건 발견

---

## 전체 위험도
**HIGH** — spec이 plan에서 "결정 필요"로 미완 상태인 항목 2건을 plan 합의 없이 확정 반영했고, 현재 worktree를 추적하는 plan 문서가 없음

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| 1 | plan_coherence | 현재 worktree(`cafe24-data-model-strengthen-464de9`)를 추적하는 `plan/in-progress/` 문서가 없음 | — | CLAUDE.md worktree 운영 규칙 — "새 plan을 만들 때 frontmatter의 `worktree` 필드에 현재 worktree 이름을 기록한다" | `plan/in-progress/cafe24-data-model-strengthen.md` 를 `worktree: cafe24-data-model-strengthen-464de9` frontmatter와 함께 즉시 생성 |
| 2 | plan_coherence | plan에서 "결정 필요"로 미완인 항목(installTokenIssuedAt 컬럼, mall_id plain 컬럼)이 plan 업데이트 없이 `spec/1-data-model.md`에 확정 반영됨 | `spec/1-data-model.md` §2.10 V044/V045 필드 | `plan/in-progress/cafe24-pending-polish-followup.md` §그룹 B, `plan/in-progress/cafe24-pending-polish.md` §변경 3–4 (미체크 체크박스) | 두 plan 문서에서 해당 체크박스를 완료 처리하고, 선택한 접근법(installTokenIssuedAt 분리 컬럼 / mall_id plain 컬럼 + partial UNIQUE 인덱스)과 그 근거를 결정 기록란에 추가. 구현 착수 전 plan 갱신 선행 필수 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|------------|-----------|------|
| 1 | plan_coherence | PR #18 머지 여부 미확인 상태에서 followup plan Group B 작업 진행 중 — 미머지 시 코드 충돌 가능 | — | `cafe24-pending-polish-followup.md` frontmatter ("PR #18 머지 후 새 worktree에서 진행") | PR #18 머지 여부 확인. 미머지라면 base branch 설정 점검 또는 PR #18 브랜치를 base로 stacking |
| 2 | plan_coherence | mall_id / TTL 항목이 두 plan에 중복 등재 — 완료 시 양쪽 모두 갱신 필요하나 추적 plan 부재로 누락 위험 높음 | `spec/1-data-model.md` §2.10 | `cafe24-pending-polish.md` §변경 3–4 및 `cafe24-pending-polish-followup.md` §그룹 B | 신규 plan 생성 시 두 plan 중 어느 항목을 본 worktree가 흡수하는지 명시하고, 완료 시 양쪽 동시 갱신 |
| 3 | cross_spec | `spec/data-flow/integration.md` TTL 스캐너 쿼리가 여전히 `created_at < now - 24h` 사용 — `spec/1-data-model.md`의 V044 이후 `install_token_issued_at` 기준과 불일치. 구현자가 data-flow spec을 따르면 V044 목적이 무력화됨 | `spec/data-flow/integration.md` L101·135·165 | `spec/1-data-model.md` §2.10 `install_token_issued_at` 설명 | `spec/data-flow/integration.md`의 `pending-install-ttl` 스캐너 pseudocode를 `COALESCE(install_token_issued_at, created_at)` 기준으로 갱신 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | naming_collision | `Integration.mall_id`(top-level)와 `credentials.mall_id`(JSONB 경로)가 동일 엔티티에 공존 — 의도적 설계이나 ORM 코드에서 혼동 가능 | `spec/1-data-model.md` §2.10 `mall_id` | ORM entity 파일에 "credentials.mall_id의 plain projection" 주석 명시 |
| 2 | naming_collision | `pending-install-ttl` job 이름은 spec에서 참조되나, 분리된 3개 BullMQ job 전체 이름 목록이 spec에 없음 | `spec/1-data-model.md` §2.10, `spec/data-flow/integration.md` | 3개 job 이름을 spec 어느 한 곳에 열거 |
| 3 | cross_spec | `install_token_issued_at` TTL 만료 시 NULL 전이 여부 미기술 (`install_token`은 "callback 성공 또는 TTL 만료 시 NULL"로 기술) | `spec/1-data-model.md` §2.10 `install_token_issued_at` | 만료 시 보존 의도라면 "TTL 만료 시 유지(감사 보존)" 한 줄 추가; 정리 의도라면 "callback 성공 또는 TTL 만료 시 NULL"로 수정 |
| 4 | cross_spec | `mall_id` UNIQUE 인덱스에 내포된 "한 workspace 내 같은 mall_id의 cafe24 통합은 최대 1행(public·private 동시 보유 불가)" 비즈니스 규칙이 통합 화면 spec에 명시되어 있는지 미확인 | `spec/1-data-model.md` §3 인덱스 테이블 | `spec/2-navigation/4-integration.md` §5.8에 해당 규칙 명시 여부 확인 후 누락 시 보강 |
| 5 | rationale_continuity | Cafe24 Private 앱의 `connected → error(auth_failed)` 전이 근거가 Rationale에 없음 (`pending_install` 케이스만 기술) | `integration-oauth.service.ts` `markIntegrationCallbackError()` | `spec/2-navigation/4-integration.md` Rationale에 `connected` 케이스 전이 근거 한 문장 추가 |
| 6 | convention_compliance | §1 엔티티 관계 다이어그램에서 `IntegrationUsageLog`가 `Workspace` 직접 자식으로 잘못 표기 — `Integration` 자식이어야 함 | `spec/1-data-model.md` §1 L20–21 | `Integration` 하위로 이동, 잘못된 ASCII 트리 문법 수정 |
| 7 | convention_compliance | `last_error.code` / `IntegrationUsageLog.error.code` 필드 설명에 값의 대소문자 형식(UPPER_SNAKE_CASE) 미명시 | `spec/1-data-model.md` §2.10 `last_error`, §2.10.1 `error` | `code: UPPER_SNAKE_CASE (node-output.md Principle 3.2 준수)` 명시 추가 |
| 8 | convention_compliance | `spec/1-data-model.md`에 `## Overview` 섹션 없음 (권장 3섹션 구성 미충족) | `spec/1-data-model.md` 최상단 | 대규모 개정 시 추가 권장 (즉시 차단 아님) |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | CRITICAL 없음. 참조 spec 미포함으로 완전 검증 불가. data-flow TTL 기준 불일치 WARNING |
| Rationale Continuity | LOW | V044·V045 구현은 Rationale 결정과 완전 정합. `connected→error` 전이 근거 누락만 INFO |
| Convention Compliance | LOW | 정식 규약 직접 위반 없음. Migration 규약 완전 준수. data-flow TTL 불일치 별도 지적 |
| Plan Coherence | HIGH | **Critical 2건**: worktree-plan 결속 없음 + 미완 결정 항목의 plan 합의 없는 spec 반영 |
| Naming Collision | LOW | CRITICAL·WARNING 없음. mall_id 이중 사용은 의도적 설계로 문서화됨 |

---

## 권장 조치사항

1. **(BLOCK 해소 — 즉시 필수)** `plan/in-progress/cafe24-data-model-strengthen.md` 생성: `worktree: cafe24-data-model-strengthen-464de9` frontmatter, V044·V045 작업 범위 기술
2. **(BLOCK 해소 — 즉시 필수)** `cafe24-pending-polish-followup.md` §그룹 B 및 `cafe24-pending-polish.md` §변경 3–4의 해당 체크박스를 완료 처리하고 선택 근거(migration SQL 주석 내용) 기록
3. **(WARNING 해소)** PR #18 머지 여부 확인 후 base branch 설정 점검
4. **(WARNING 해소)** `spec/data-flow/integration.md` L101·135·165 TTL 쿼리를 `COALESCE(install_token_issued_at, created_at)` 기준으로 갱신
5. **(INFO — 구현 착수 전 권장)** `install_token_issued_at` TTL 만료 시 NULL 전이 여부를 spec에 명시
6. **(INFO — 구현 중 처리)** `spec/2-navigation/4-integration.md` §5.8에 public/private 동시 보유 불가 규칙 확인 및 보강
7. **(INFO — 낮은 우선순위)** 다이어그램 `IntegrationUsageLog` 계층 수정, `error.code` UPPER_SNAKE_CASE 명시