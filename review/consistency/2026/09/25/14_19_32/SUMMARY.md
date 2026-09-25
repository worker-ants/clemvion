# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 1건 발견 (cross_spec)

## 전체 위험도
**HIGH** — `RolesGuard` 전역 코드 부여 결정이 기존 spec(`2-navigation/6-config.md`)의 명시적 API 계약과 충돌하는 상태로 남아 있어 draft 를 그대로 채택하면 spec 간 자기모순이 즉시 발생한다. 그 외 발견은 전부 WARNING/INFO 수준의 정합·표기 보완이다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `RolesGuard` 는 앱 전역 `APP_GUARD` 이므로 "가드의 모든 멤버십·역할 거부에 코드를 붙인다"(C-1(e))는 결정이 기존 `@Roles('admin')` 라우트(예: `auth-configs.controller.ts` 5개 라우트)에도 그대로 적용되는데, 그 계약을 명시한 `2-navigation/6-config.md` §A.4 의 "403 `FORBIDDEN`" 서술이 draft `spec_impact`·C 섹션 어디에도 갱신 대상으로 없음 | draft C-1(e) Rationale (122~141행), `spec_impact` frontmatter | `spec/2-navigation/6-config.md` §A.4 "권한" — "Editor/Viewer … API 직접 호출 시 403 `FORBIDDEN`" | (1) draft 에 `spec/2-navigation/6-config.md` §A.4 패치 절 추가(`FORBIDDEN`→`ADMIN_REQUIRED`) (2) `spec_impact` 목록에 해당 파일 추가 (3) `@Roles(` 게이트 + 구체적 wire code 를 명시한 다른 spec 문서 전수 재확인 |

## planner 인계 (권한 밖 Critical)

(없음) — 위 Critical 은 이 작업 자체가 `project-planner` 의 `--spec` 검토 턴이며, 원인(spec draft 의 갱신 대상 누락)이 지금 이 draft 를 수정할 권한 안에 있다. 호출자가 draft 의 C 섹션과 `spec_impact` 를 직접 보완하면 해소된다 — 별도 인계 불필요.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `error-codes.md §3` historical-artifact 레지스트리가 `invitation_*`/`forbidden`/`rate_limited` 6개 코드의 근거로 `1-auth.md §1.5.4` 를 인용하는데, C-3 이 그 절의 `forbidden` 을 `ADMIN_REQUIRED` 로 바꾸면 근거 문서에 더는 `forbidden` 이 없어 레지스트리 자기모순 발생 | draft C-3 (`1-auth.md §1.5.4`) | `spec/conventions/error-codes.md §3` — `forbidden` 근거 행 | C-4 에 §3 레지스트리의 `forbidden` 열거 제거 또는 "§1.5.4 권한-부족 케이스는 이제 제외" 각주 추가 |
| 2 | cross_spec | "URL slug = FE 라우팅 SoT" Rationale 의 "인가는 여전히 header-first→토큰 모델이 결정" 이라는 무조건 서술이, draft C-1(a)/(c) 가 도입하는 "경로 파라미터 워크스페이스는 경로 값이 인가 대상" 이라는 새 불변식의 반례가 됨(형제 절 (d)는 이미 같은 패턴으로 캐벗을 받았음) | `spec/data-flow/12-workspace.md` "URL slug = FE 라우팅 SoT" 절 (draft 미패치) | draft C-1(a)/(c) 신설 불변식 | 같은 파일의 (d) 캐벗과 동일 패턴으로 "경로 파라미터 워크스페이스 라우트는 이 모델의 예외" 캐벗 추가 |
| 3 | rationale_continuity | `error-codes.md §3` 이 `admin_required`(소문자)·`ADMIN_REQUIRED`(대문자)를 "의도적 분리"로 명문화했는데, C-3 이 초대 발송/재발송/취소를 `RolesGuard` 로 선점시켜 HTTP 응답 코드가 사실상 `ADMIN_REQUIRED` 로 수렴함에도, C-4 註는 "HTTP 로 안 나간다"는 발행 여부만 언급하고 레지스트리의 "의도적 분리" 문구 자체는 정정하지 않음 | draft C-3 + C-4 | `spec/conventions/error-codes.md §3` "의도적 분리" 근거 문장 | C-4 註를 확장해 "이 분리는 HTTP 응답에는 더 이상 적용되지 않는다" 같은 한정어 추가 |
| 4 | convention_compliance | C-5 의 swagger.md §5-4 체크리스트 패치가 조건절에는 `@WorkspaceParam()` 을 추가하면서, 같은 bullet 의 근거 설명문("RolesGuard 는 …")은 여전히 `@WorkspaceId()` 만 지목해 조건절-근거문 불일치가 문서 안에 남음 | draft `### C-5. spec/conventions/swagger.md` | `spec/conventions/swagger.md §5-4` 체크리스트 근거 설명문 | C-5 patch 지시에 근거 설명문의 `@WorkspaceParam()` 병기 추가 |
| 5 | convention_compliance | C-4 가 error-codes.md §3(유지되는 *active* 코드 전용)에 `admin_required` 를 "HTTP 밖 호출자 방어선으로 남는다" 고 등재하려는데, 실측(grep) 상 `admin_required` 를 던지는 `assertAdmin()` 의 유일한 호출 경로 4곳이 전부 `workspaces.controller.ts`(HTTP)뿐이라 RolesGuard 게이팅 후 그 분기는 도달 불가능한 죽은 코드가 됨 | draft `### C-4. spec/conventions/error-codes.md` + C-1(e) "서비스 계층 검사는 남는다" | `spec/conventions/error-codes.md §3` 머리말 "active 코드 예외 등록부" 전제 | 나머지 14개 라우트의 비-HTTP 호출자 유무 전수 확인 후 일반 서술 범위를 좁히거나, `admin_required` 에 한해 "구현 시 도달 불가 잔존 분기 — 정리 여부 별도 판단"으로 정정하고 D절에 cleanup 항목 추가 |
| 6 | plan_coherence | 이 draft 가 `plan/in-progress/spec-draft-nullable-notation-followups.md:4946` 항목의 결정 턴임에도, 그 트래커 항목에는 이 draft 를 가리키는 역참조가 없어(같은 트래커의 기존 관례와 불일치) 트래커만 보는 사람에게 미착수로 보임 | 문서 전체 서두 | `plan/in-progress/spec-draft-nullable-notation-followups.md:4946` | 트래커 항목 4946 에 "2026-09-25 — 결정 턴: `spec-draft-workspace-path-guard.md`(옵션 3 채택)" 각주 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | D-1 구현 요구("경로 소비자도 센다")가 반영되면 `1-auth.md` 부트 캐너리 Rationale 의 "`@WorkspaceId()` 를 소비하는 라우트를 전부 센다" 집합 정의 문장이 stale 해질 수 있음 | draft D-1 / `spec/5-system/1-auth.md` 부트 캐너리 Rationale | D 섹션 또는 C-1/C-3 에 캐너리 Rationale 집합 정의 문장 갱신 항목 명시 |
| 2 | plan_coherence | C-1(c)/C-3 이 신설하는 cross-reference 링크가 이미 알려진 doclink-guard 사각지대 파일(`1-auth.md`/`12-workspace.md`, 멀티라인 링크가 앵커 검증 우회)에 들어감 | draft C-1(c), C-3 | 새 링크를 한 줄로 작성하도록 developer PR 체크리스트에 명시 |
| 3 | plan_coherence | `spec/conventions/error-codes.md` 를 이 draft(C-4) 외 2개 in-progress plan(`spec-conventions-engine-error-code-surface.md`, `spec-update-node-cancellation-shutdown-classification.md §3`)이 동시 편집 중 | draft C-4 | 반영 시 `error-codes.md` 최신본 기준 diff 재확인 |
| 4 | naming_collision | `@WorkspaceParam(name)`(C-1(c)/D-1/D-2)과 `@WorkspaceParam()`(C-5)이 인자 유무가 섞여 표기됨 | draft C-5 swagger 체크리스트 문구 | `@WorkspaceParam('id')` 또는 `@WorkspaceParam(...)` 형태로 통일 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | `RolesGuard` 전역 범위 vs `2-navigation/6-config.md` 403 계약 누락(Critical) + WARNING 2건(error-codes §3 registry, URL slug Rationale) |
| rationale_continuity | LOW | `admin_required`/`ADMIN_REQUIRED` "의도적 분리" 근거 미갱신(WARNING) + 부트 캐너리 stale 가능성(INFO) |
| convention_compliance | LOW | swagger 체크리스트 근거문 불일치(WARNING) + error-codes §3 "active" 전제와 dead-code 실측 불일치(WARNING) |
| plan_coherence | LOW | 트래커 항목 역참조 누락(WARNING) + doclink-guard 사각지대·동시 편집(INFO ×2) |
| naming_collision | NONE | 신규 식별자(`@WorkspaceParam`, `EDITOR_REQUIRED`) 충돌 없음, 표기 일관성 INFO 1건 |

## 권장 조치사항
1. **(BLOCK 해소)** draft C 섹션에 `spec/2-navigation/6-config.md` §A.4 패치(`FORBIDDEN`→`ADMIN_REQUIRED`) 추가 + `spec_impact` 에 파일 등재 + `@Roles(` 게이트 spec 문서 전수 재확인.
2. C-4 註를 확장해 `error-codes.md §3` 의 `forbidden` 근거 행과 `admin_required` "의도적 분리" 서술을 draft 결정에 맞게 정정.
3. `spec/data-flow/12-workspace.md` "URL slug = FE 라우팅 SoT" 절에 경로 파라미터 워크스페이스 예외 캐벗 추가.
4. C-5 swagger 체크리스트의 근거 설명문에도 `@WorkspaceParam()` 병기.
5. `admin_required` 의 "HTTP 밖 호출자 방어선" 서술을 실측(호출 그래프)에 맞춰 재검토, 필요 시 dead-code 정리 항목을 D 섹션에 추가.
6. `plan/in-progress/spec-draft-nullable-notation-followups.md:4946` 에 이 draft 로의 역참조 각주 추가.
7. (경미) `@WorkspaceParam()` 표기 통일, 부트 캐너리 Rationale 갱신 항목 D 섹션 명시, 신설 링크 단일 라인 작성 지침 developer PR 체크리스트에 반영.
