# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec/rationale_continuity/convention_compliance/plan_coherence/naming_collision) 전원 성공, CRITICAL 발견 없음. 착수(auth-guard-reflection-hardening, `spec_impact: none`)를 차단할 사유 없음.

## 전체 위험도
**MEDIUM** — CRITICAL 은 없으나, 구현 방식(에러 코드 선택·Reflector 확장점 전환 방식)이 착수 전 미확정 상태로 남아 있어 잘못 고르면 재작업/spec drift 로 이어질 수 있는 예방적 WARNING 이 다수(6건, 그중 2건은 rationale_continuity 가 MEDIUM 으로 별도 등재).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — CRITICAL 자체가 없으므로 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity, plan_coherence | W4(비-UUID `X-Workspace-Id` → 400) 시 사용할 에러 코드가 미확정인 채 plan 이 `spec_impact: none` 을 선언 — `WORKSPACE_ID_REQUIRED` 재사용 시 그 코드의 좁은 정의("헤더·클레임 둘 다 없음")와 실제 트리거 조건(헤더 present-but-malformed)이 어긋나고, 신규 코드 신설 시엔 `3-error-handling.md` 갱신이 필요해 `spec_impact: none` 과 모순 | `spec/5-system/3-error-handling.md` §1.3 `WORKSPACE_ID_REQUIRED` 행 / `plan/in-progress/auth-guard-reflection-hardening.md` §3 (W4) | `2-api-convention.md` §5.3 기본값 표(`VALIDATION_ERROR`), `2-api-convention.md ## Rationale` "일반 신규 코드는 전역 코드 재사용" 원칙 | 착수 전 W4 체크박스에 (c) 제네릭 `VALIDATION_ERROR` 재사용(코드 미지정, spec 변경 불요)으로 명시 확정. `WORKSPACE_ID_REQUIRED` 를 재사용/확장하고 싶다면 `spec_impact` 를 `3-error-handling.md` 로 갱신하고 planner 턴 선행 |
| 2 | rationale_continuity | plan §1 "공식 확장점 전환"(`SetMetadata`+`Reflector`) 옵션이 문면 그대로면 `@WorkspaceId()` 사용처마다 별도 마커 부착이 필요 — `data-flow/12-workspace.md` 가 2026-08-08 에 명시 기각한 "라우트별 opt-in 마커 부착"(이미 2회 재발) 패턴의 3번째 재현 위험 | `plan/in-progress/auth-guard-reflection-hardening.md` §1 두 번째 체크박스 | `spec/data-flow/12-workspace.md ## Rationale` → "멤버십 검증은 가드 1곳에서" 절의 "기각된 대안 — 73개 라우트에 `@Roles('viewer')` 부착" | 이 옵션을 택할 경우 `SetMetadata` 호출을 `WorkspaceId()` 데코레이터 팩토리 자체에 합성해 호출부 추가 마커 없이 자동 적용되게 구현. 별도 마커가 정말 필요하면 `data-flow/12-workspace.md` 기각 근거를 재검토하는 새 Rationale 항목 필요(없이 진행 시 "결정의 무근거 번복"). 캐너리(W1-a) 단독 채택이 가장 안전 |
| 3 | convention_compliance | `2-api-convention.md §2.2` "중첩 2단계까지" 규칙(+유일 예외조항, `{id}` 필수)이 `1-auth.md §5` 의 실제 구현된 `auth/2fa/webauthn/*` 4~5단계 경로(자원 인스턴스 없음)를 문언상 커버하지 못함 | `spec/5-system/2-api-convention.md §2.2` / `1-auth.md §5` API 표 | §2.2 예외 조항(`/api/{resource}/{id}/{channel}/{action}`) | 이미 구현·고정된 API 표면이므로 엔드포인트 변경 대신 §2.2 에 "자원 인스턴스 없는 도메인 네임스페이스 하위 다단계 action" 패턴을 별도 허용 예외로 명시 |
| 4 | convention_compliance | `3-error-handling.md` frontmatter `status: implemented` 인데 본문 §2.1/§3.3/§7.2 에 "계획(Planned)·미구현" 명시 항목 3건이 `pending_plans:` 없이 존재 — `spec-impl-evidence.md` R-5 가 막으려는 "추적되지 않는 빈 약속" 패턴 | `spec/5-system/3-error-handling.md` frontmatter, §2.1·§3.3·§7.2 | `spec/conventions/spec-impl-evidence.md` §3 status 라이프사이클(`implemented`=모든 약속 구현 완료 요구) | (a) 3건을 책임질 plan 신설·지정 후 `status: partial`+`pending_plans:` 로 하향, 또는 (b) 3건이 로드맵성 비-약속이면 "Planned" 문구를 격하하거나 범위 밖임을 Rationale 에 명시 |
| 5 | cross_spec | §2.3 "동시 세션 | 기본 5개(관리자 설정 가능)" / "초과 시 자동 종료" 정책이 데이터 모델에 대응 필드가 없고 코드 흔적도 없음(grep 0건) — 인접 미구현 항목들과 달리 "(Planned)" 마킹 없이 이미 동작하는 것처럼 서술됨 | `spec/5-system/1-auth.md` §2.3 세션 정책 표 | `spec/1-data-model.md` §2.2 Workspace.settings 알려진 키 목록(해당 키 없음), §2.18.1 RefreshToken | (a) 미구현이면 "(Planned·미구현)" 마킹 + 추적 plan 연결, 또는 (b) 구현 대상이면 `Workspace.settings`(또는 신규 필드)에 상한 키 추가 후 `1-data-model.md` 동기화. 본 worktree 작업과 무관 — 별도 후속으로 분리 권장 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `WORKSPACE_ID_REQUIRED` 설명이 `activeWorkspaceId` rename 이전 "JWT `workspaceId`" 표현을 그대로 사용 | `spec/5-system/3-error-handling.md` §1.3 | "JWT `activeWorkspaceId`(dual-read 레거시 `workspaceId` 포함)" 로 §2.2/§2.3 표기와 동기화 |
| 2 | rationale_continuity | 부트타임 캐너리(W1-a)가 boot-fail-closed 라면 기존 "Production fail-closed 가드" 문서화 관행(JWT_SECRET 등 5개 항목)과의 정합 여부를 명시 결정할 것 | `spec/5-system/1-auth.md` §2.1 note + Rationale / `plan` §1 첫 번째 체크박스 | `assertProductionConfig` 단일 블록에 합치지 말 것(별도 부트 단계 유지). 프로덕션 부팅 실패 가능성이 있다면 PR 설명에 명시하고 spec 반영 여부 판단 |
| 3 | rationale_continuity | 실제 SoT Rationale(`spec/data-flow/12-workspace.md`)이 `spec/5-system/` scope 의 --impl-prep 번들에서 구조적으로 누락됨 | 번들 전체 | guard/reflection 관련 --impl-prep 요청 시 `spec/data-flow/12-workspace.md` 를 번들에 포함하도록 orchestrator 번들링 규칙 보강 검토 |
| 4 | convention_compliance | `2-api-convention.md` 에 `## Overview` 섹션 부재(CLAUDE.md 3섹션 구성 권장과 거리) — 다만 영역 내 6개 파일이 같은 패턴이라 신규 결함 아님 | `spec/5-system/2-api-convention.md` 상단 | 레퍼런스형 문서의 Overview 생략을 CLAUDE.md/SKILL.md 에 명시적 예외로 남기거나, 다음 정리 라운드에서 일괄 보완 |
| 5 | convention_compliance | `1-auth.md` §3.2 권한 매트릭스 표가 각주 blockquote 로 두 조각나 GFM 렌더링 파손 위험 | `spec/5-system/1-auth.md` L372~L379 | 각주(`†`) blockquote 를 표 전체 종료 후로 이동 |
| 6 | plan_coherence | 관련 spec draft plan 2건(`spec-draft-workspace-header-membership-invariant.md`, `spec-fix-swagger-forbidden-response.md`)이 target 에 전량 반영 완료됐는데도 `plan/in-progress/` 에 `status: in-progress` 로 잔류 | 두 plan 파일 (worktree `auth-workspace-membership-guard-2b94db`) | 해당 worktree 쪽에서 잔여 체크리스트 확인 후 `plan/complete/` 로 이동(본 worktree 권한 밖) |
| 7 | plan_coherence | `1-auth.md` §3.3 이 "멤버십 검증은 `@Roles()` 무관 항상" 불변식을 아직 명문화하지 않음 — 사촌 plan 이 "판정 필요"로 열어둔 채 완료 처리될 위험 | `spec/5-system/1-auth.md` §3.3 | 위 plan 정리 시 함께 close(§3.3 에 cross-reference 추가 또는 "불요" 명문화) |
| 8 | naming_collision | 근접 명명 쌍(`PASSWORD_INVALID`/`INVALID_PASSWORD`/`PASSWORD_REQUIRED`/`REAUTH_REQUIRED`, lowercase vs UPPER_SNAKE 초대/직접-추가 코드)은 이미 문서 자신이 각주로 구분 완료 — 조치 불요 | `3-error-handling.md` §1.2.1/§1.9, `1-auth.md` §1.5.4 | 향후 신규 감사 액션·에러 코드 도입 시 같은 "근접 명명 주의" 각주 패턴 유지 권고 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | §2.3 동시 세션 정책 data-model 미비(WARNING), `WORKSPACE_ID_REQUIRED` 표기 drift(INFO) |
| rationale_continuity | MEDIUM | Reflector 확장점 전환 시 기각된 opt-in 패턴 재도입 위험(WARNING), `WORKSPACE_ID_REQUIRED` 재사용 시 정의 불일치 위험(WARNING) — 둘 다 착수 전 구현 방식 선택으로 회피 가능 |
| convention_compliance | LOW | URL 중첩 규칙 미커버(WARNING), status/pending_plans 3중 불일치(WARNING) |
| plan_coherence | LOW | W4 에러 코드 미확정 + spec_impact:none 리스크(WARNING), plan lifecycle 정리 필요(INFO 2건) |
| naming_collision | NONE | 신규 CRITICAL/WARNING 없음, 근접 명명은 이미 문서화됨 |

## 권장 조치사항
1. (BLOCK 해소 우선) — 해당 없음(BLOCK:NO). 아래는 착수 전/구현 중 반영 권장 순서.
2. plan §3 (W4) 체크박스에 에러 코드 선택을 명시 확정 — 기본값 `VALIDATION_ERROR` 재사용(spec 변경 불요) 권장, 아니면 `spec_impact` 갱신 후 planner 턴 선행 (WARNING #1).
3. plan §1 "공식 확장점 전환" 옵션을 실제 선택하게 되면 `SetMetadata` 를 `WorkspaceId()` 데코레이터 팩토리에 합성해 opt-in 마커 재도입을 피하거나, 캐너리(W1-a) 단독 채택 (WARNING #2).
4. `2-api-convention.md §2.2` 에 auth/2FA/WebAuthn 다단계 action 경로용 허용 예외 문구 추가 (WARNING #3, 본 작업과 별도 후속 가능).
5. `3-error-handling.md` 의 status/pending_plans/본문 3중 불일치 해소 — plan 신설 또는 문구 격하 (WARNING #4, 별도 후속).
6. §2.3 동시 세션 정책에 "(Planned)" 마킹 또는 데이터 모델 필드 추가 (WARNING #5, 별도 후속).
7. INFO 8건은 우선순위 낮음 — 특히 #6·#7(plan lifecycle 이동)은 소유 worktree(`auth-workspace-membership-guard-2b94db`) 쪽 조치 필요.