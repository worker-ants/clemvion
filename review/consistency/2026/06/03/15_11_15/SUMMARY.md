# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 작업 진행 가능.

## 전체 위험도
**LOW** — 5개 checker 모두 LOW. Critical 위배 0건. WARNING 5건(중복 통합 후 3건), INFO 다수.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec / Rationale Continuity / Convention Compliance / Naming Collision | `ADMIN_REQUIRED` (403) 에러 코드 — spec 카탈로그 미등재 상태로 `FORBIDDEN` 과 의미 관계 불명확 | `plan/in-progress/spec-draft-workspace-settings-api.md` "Phase: Spec 갱신" > `spec/5-system/3-error-handling.md §1.2` | `spec/5-system/3-error-handling.md §1.2` (`FORBIDDEN` 단일 등재), `spec/5-system/2-api-convention.md §4` | `§1.2` 등재 시 `FORBIDDEN`(generic 권한 부족) vs `ADMIN_REQUIRED`(워크스페이스 admin 역할 특화) 구분 비고를 inline 명시. `2-api-convention.md §4` 에 도메인별 override 코드 가능 문구 추가 |
| W-2 | Convention Compliance | `ADMIN_REQUIRED` 등재 계획이 `spec/conventions/error-codes.md §1` "의미 중복 시 기존 코드 재사용" 원칙과 충돌 가능성 | 동상 | `spec/conventions/error-codes.md §1·§3` | 의미 분기(컨텍스트 특화) 근거를 spec 에 명시하거나, 실제 `assertAdmin()` 코드가 `ADMIN_REQUIRED` 를 발행하는지 확인 후 historical-artifact 레지스트리(`§3`) 처리 여부 결정 |
| W-3 | Plan Coherence | 구현 plan 부재 — spec draft 완료 후 개발자가 착수할 `impl-workspace-settings-api.md` 가 없어 구현이 orphan 상태가 될 위험 | `plan/in-progress/spec-draft-workspace-settings-api.md` 전체 | `plan/in-progress/` (대응 구현 plan 없음) | spec draft 완료 직후 `plan/in-progress/impl-workspace-settings-api.md` 신설하거나 본 plan 에 "## Phase: 구현 (착수 전 spec 확정 선행)" 섹션 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `spec/data-flow/12-workspace.md §2.1` Schema 매핑 테이블 갱신이 Phase 목록에 누락 | target "Phase: Spec 갱신" | §1.7 신설 시 §2.1 에 `workspace | settings 변경 | UPDATE settings = merge({...settings, interactionAllowedOrigins})` 행 추가 필요 — Phase 목록에 명시 보완 |
| I-2 | Cross-Spec | 빈 배열 시 임베드 soft 검증 `enforce=false(allow-all)` 동작이 `spec/7-channel-web-chat/4-security.md §3` 에 미반영 | target "★ 빈 배열 의미" 절 | `4-security.md §3` 빈 배열 케이스 동작(enforce=false → allow-all soft) 명시를 Phase 목록에 포함 |
| I-3 | Rationale Continuity | 전용 settings 엔드포인트 분리가 신규 결정임을 Rationale 에서 명확히 표현하지 않음 | target "## Rationale" | "신규 endpoint 분리 결정 (기존 spec 에 prior art 없음)" 또는 기존 `PATCH /:id` 흡수 안 기각 이유를 한 줄 추가 |
| I-4 | Rationale Continuity | 빈 배열 시 임베드 soft 검증 Rationale cross-ref 누락 | target Rationale "빈 배열" 항 | `spec/7-channel-web-chat/4-security.md §3` enforce=false 정의를 cross-ref 로 추가 |
| I-5 | Convention Compliance | `spec/5-system/14 §8.5` 참조에서 파일명 생략 | target "Phase: Spec 갱신" | `spec/5-system/14-embed-interaction-api.md §8.5` 전체 경로로 명시 |
| I-6 | Convention Compliance | plan 내 spec cross-reference 링크가 worktree 상대경로(`../../spec/...`) | 문서 전체 링크 | 레포 루트 기준 경로(`spec/...`) 사용 권장 (선택적 개선) |
| I-7 | Convention Compliance | 신규 endpoint 구현 시 swagger.md §5-4 체크리스트 적용 추적 필요 | "결정" 섹션 및 sequenceDiagram | 구현 phase plan 에 `swagger.md §5-4` 체크리스트(`@ApiForbiddenResponse`, `@ApiParam({ format: 'uuid' })`, `ApiOkWrappedResponse`) 명시 |
| I-8 | Naming Collision | `PATCH /api/workspaces/:id/settings` 와 기존 `PATCH /api/workspaces/:id` 의 body 스키마가 §6.1 에 미병기 | `spec/2-navigation/9-user-profile.md §6.1` | 두 엔드포인트를 병기할 때 기존 행에 `body: { name: string }`, 신규 행에 `body: { interactionAllowedOrigins: string[] }` 를 표 수준에서 명시 |
| I-9 | Naming Collision | `spec/data-flow/12-workspace.md §1.7` 신설 시 §1.6 이후 논리 순서 배치 확인 | target "Phase: Spec 갱신" | 번호 충돌 없음. 배치 순서 확인만 필요 |
| I-10 | Plan Coherence | stale worktree 9건이 `git worktree list` 에 잔존 가능 | `.claude/worktrees/` | `./cleanup-worktree-all.sh --yes --force` 실행 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `ADMIN_REQUIRED` 미등재(W), `4-security.md §3` 빈 배열 케이스 미반영(I), `§2.1` Schema 매핑 Phase 누락(I) |
| Rationale Continuity | LOW | `ADMIN_REQUIRED` vs `FORBIDDEN` 관계 설명 부재(W), 빈 배열 cross-ref 누락(I), 신규 결정 명시 부재(I) |
| Convention Compliance | LOW | `error-codes.md §1` 의미 중복 원칙 충돌 가능성(W), Swagger 체크리스트 추적 필요(구현단계), plan frontmatter 정상(I) |
| Plan Coherence | LOW | 구현 plan 부재(W), stale worktree 9건(I), 타 plan 내용 비충돌(I) |
| Naming Collision | LOW | `ADMIN_REQUIRED`-`FORBIDDEN` 의미 구분 미명시(W), 신규 endpoint 경로 의미 분리 표 수준 미완성(I), 기존 식별자 충돌 없음 |

## 권장 조치사항

1. **(W-1 핵심)** `spec/5-system/3-error-handling.md §1.2` 에 `ADMIN_REQUIRED` 등재 시, `FORBIDDEN` 과의 관계(generic vs 워크스페이스 admin 역할 특화)를 inline 비고로 명시하고 `spec/5-system/2-api-convention.md §4` 에 도메인별 override 코드 가능 문구를 추가한다.
2. **(W-2)** `spec/conventions/error-codes.md §1` 의미 분기 요건 충족 여부를 확인한다. `assertAdmin()` 이 실제로 `ADMIN_REQUIRED` 를 발행하는 코드 증거가 있으면 "기존 코드 정식 등재"로 처리하고, Rationale 에 재사용 대신 신설을 택한 이유를 명시한다.
3. **(W-3)** spec draft plan 완료 직후 `plan/in-progress/impl-workspace-settings-api.md` 를 신설하거나, 현재 plan 에 "## Phase: 구현" 섹션을 추가해 구현 위임 경로를 명시한다.
4. **(I-1)** target Phase 목록에 `spec/data-flow/12-workspace.md §2.1` Schema 매핑 갱신 항목을 추가한다.
5. **(I-2)** `spec/7-channel-web-chat/4-security.md §3` 에 빈 배열 케이스(enforce=false → allow-all soft) 동작을 명시하는 항목을 Phase 목록에 포함한다.
6. **(I-7, 구현단계)** 구현 착수 시 `swagger.md §5-4` 체크리스트(`@ApiForbiddenResponse`, `@ApiParam({ format: 'uuid' })`, `ApiOkWrappedResponse`) 전체 적용을 구현 plan 에 명시한다.