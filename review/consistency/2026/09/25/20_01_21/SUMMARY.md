# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 전문 확보(convention_compliance 는 status=no_status 였으나 인라인 전문이 있어 정상 반영, 디스크 파일이 없어 이번 turn 에 새로 영속화함). Critical 발견 없음.

## 전체 위험도
**LOW** — Critical 없음. 4건의 WARNING 은 모두 target(9-user-profile.md/1-auth.md/data-flow/12-workspace.md) 자체의 실제 결함이 아니라 (a) 검토 하니스의 컨텍스트 예산 절단으로 일부 SoT 문서를 이번 라운드에서 검증 못 한 프로세스 갭, (b) 문서 간 스코프/수치 표기 정밀도 이슈. 이번 작업(canary-readme-recheck-test, README·unit 테스트 전용, `spec_impact: none`)의 코드 스코프에는 저촉되지 않는다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 자체가 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 검토 근거 자체가 컨텍스트 예산으로 절단됨 — target 이 직접 인용하는 SoT 문서 112개가 "본문 생략" 상태로 미검증 | `_prompts/cross_spec.md` 전체(조립 결과) | `spec/1-data-model.md`, `5-system/2-api-convention.md`, `3-error-handling.md`, `conventions/error-codes.md`·`audit-actions.md`, `data-flow/1-audit.md`·`4-file-storage.md`·`8-notifications.md`·`9-observability.md`, `7-channel-web-chat/4-security.md`, `2-navigation/6-config.md` 등 | 이번 코드 스코프(README·테스트)엔 비차단. 다음에 `9-user-profile.md` 자체를 수정하는 작업에서는 파일 목록을 좁혀 타겟 재실행 필요 |
| 2 | cross_spec | `9-user-profile.md §4.2` 역할 매트릭스가 스코프 한정 문구 없이 `1-auth.md §3.2`·자기 `§6.1` 대비 더 좁은 접근(읽기 불가)으로 오독될 여지 | `spec/2-navigation/9-user-profile.md` §4.2 "역할 권한 매트릭스" | `spec/5-system/1-auth.md` §3.2 (Editor/Viewer=R), target §6.1 API 표 | §4.2 표 상단에 "본 표는 편집/관리 액션 기준, 읽기는 §6.1·1-auth §3.2 따름" 스코프 문구 추가 (또는 `data-flow/12-workspace.md §4` 방식의 disclaimer 이식) |
| 3 | rationale_continuity | 경로 파라미터 워크스페이스 가드의 "Owner 요구 라우트 수"가 같은 문서 안에서 2곳/2곳/1곳으로 산술 불일치 | `spec/data-flow/12-workspace.md` §Rationale `### 경로 파라미터 워크스페이스도 가드가 본다` + `### 가드 거부의 오류 코드` | 동일 문서 내 세 서술 상호(자기-모순) — "owner 2곳" 두 번 vs "admin 8·owner 1, 합 88" 각주 | `workspaces.controller.ts` 를 AST 로 재확인해 `remove`/`transferOwnership` 중 실제 `@Roles('owner')` 건수를 확정하고 세 서술 수치를 통일(합 88 또는 89 중 하나로 정정) |
| 4 | convention_compliance | `convention_compliance` 프롬프트 번들이 `spec/conventions/**` 본문 대부분(error-codes.md·node-output.md·swagger.md 등)을 컨텍스트 예산으로 절단 | `_prompts/convention_compliance.md` (조립 입력) | `spec/conventions/error-codes.md`·`node-output.md`·`swagger.md` 등 30여 건 | 하니스가 target spec 이 실제로 참조하는 conventions 파일을 절단 우선순위에서 보존하거나, 절단 시 "직접 파일을 읽어 보완" 지시를 프롬프트에 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `error-codes.md §3` 표의 자기-인용(§1)이 Overview 의 casing SoT 위임(`3-error-handling.md`/`node-output.md`)과 어긋나는 기존 관행을 target 각주가 답습 | `spec/5-system/1-auth.md` §1.5.4 각주 | target 수정 불요. `error-codes.md` 자체의 별도 정리 과제로 제안 |
| 2 | naming_collision | `ADMIN_REQUIRED`(UPPER, 가드/서비스) vs `admin_required`(lower, 초대 모듈 historical-artifact) 공존 | `spec/5-system/1-auth.md:287`, `spec/conventions/error-codes.md:78` | 이미 문서화된 의도적 분리. 조치 불요 |
| 3 | naming_collision | `FORBIDDEN` 코드의 범용 재사용(여러 모듈이 동일 문자열 공유) | `spec/data-flow/12-workspace.md:397,404`, `http-exception.filter.ts:139` | 의미 충돌 없는 전역 기본값. 조치 불요 |
| 4 | plan_coherence | 출처 트래커(`spec-draft-nullable-notation-followups.md` ~line 5004) 항목과 target 요구 1·2 문구까지 1:1 대응, 실측(README stale·재검사 분기 미포착)으로 근거 확인 | `plan/in-progress/canary-readme-recheck-test.md` §요구 1·2 | 갱신 불필요, target 그대로 진행 가능 |
| 5 | plan_coherence | 인접 plan(`auth-guard-reflection-hardening.md` §2, `nestjs-v12-coordinated-upgrade.md` §C)과 축·대상 파일 안 겹침 확인 | 없음(target 이 건드리지 않는 인접 영역) | 조치 불요 |
| 6 | plan_coherence | spec-link 게이트(`workspaces.service.spec.ts` → `9-user-profile.md` evidence) 인지가 이미 plan 체크리스트에 반영됨 | `plan/in-progress/canary-readme-recheck-test.md` 체크리스트 | 조치 불요, 이미 반영됨 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 검증 가능했던 4개 문서 범위(target+1-auth.md+data-flow/12-workspace.md+0-overview.md) 내에서 #1399/#1400 경로 파라미터 가드 변경과 target 서술·코드가 정합. 예산 절단(112개 파일 미검증) + §4.2 매트릭스 스코프 모호는 WARNING |
| rationale_continuity | LOW | 경로 파라미터 워크스페이스 가드 결정이 과거 Rationale(멤버십 단일 가드, opt-in 마커 재기각, URL slug 계층 분리)과 대부분 정합. Owner 요구 라우트 수 산술 불일치(2/2/1)만 WARNING |
| convention_compliance | LOW | 명명·출력 포맷·감사 액션·swagger 규약 모두 #1399/#1400 과 동기화됨(직접 파일 열람으로 예산 갭 보완). 프롬프트 번들의 conventions 절단 자체가 프로세스 WARNING |
| plan_coherence | NONE | target 의 두 요구(README 정정·transferOwnership 재검사 테스트) 모두 실측 근거 확인, 출처 트래커·인접 plan 과 완전 정합, `spec_impact: none` 유지 |
| naming_collision | NONE | 신규 식별자(`@WorkspaceParam`, 가드 거부 코드 4종)는 기존 상수 확장뿐이며 신규 엔드포인트/ENV/이벤트명 없음. 유일한 근접 명명(`ADMIN_REQUIRED`/`admin_required`)은 문서가 이미 의도적 분리로 명시. 직전 라운드가 지적한 `ADMIN_ROLES` 중복도 이번 target 커밋(#1400)에서 해소 확인 |

## 권장 조치사항

1. (BLOCK 해소 불필요 — Critical 없음) 이번 `canary-readme-recheck-test` 작업(README 정정 + `workspaces.service.spec.ts` unit 테스트, `spec_impact: none`)은 위 WARNING 4건 어디에도 저촉되지 않으므로 그대로 진행 가능.
2. 다음에 `spec/data-flow/12-workspace.md` 또는 `spec/2-navigation/9-user-profile.md` 를 직접 수정하는 작업(예: `spec-sync-user-profile-gaps.md` 계열)에서 반드시 해소:
   - `data-flow/12-workspace.md` §Rationale 의 Owner 요구 라우트 수(2곳/2곳/1곳) 를 `workspaces.controller.ts` AST 재확인으로 통일 (WARNING #3)
   - `9-user-profile.md §4.2` 표에 스코프 한정 문구 추가해 `1-auth.md §3.2`·자기 `§6.1` 과의 관계 명시 (WARNING #2)
3. 하니스 레벨 개선 과제로 트래킹: consistency-check 의 `--impl-prep`/`--spec` 컨텍스트 예산 조립이 target 이 직접 인용하는 `spec/conventions/**`·관련 spec 을 우선 보존하도록 개선 (WARNING #1, #4 — 기존 memory `feedback_consistency_spec_mode_budget` 재확인된 반복 갭).
