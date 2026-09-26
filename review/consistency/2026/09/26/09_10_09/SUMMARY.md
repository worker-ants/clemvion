# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 CRITICAL 0건, 모두 전문 확보 완료. 5개 checker 파일은 모두 디스크에 이미 존재해 별도 영속화 불요)

## 전체 위험도
**MEDIUM** — Critical 은 없으나 (1) target 의 정당화 서술이 `oauthBegin` 생성 분기를 놓쳐 사실과 다르고, (2) 신설 정적 가드의 SoT `code:` 미등재가 cross_spec/rationale_continuity/convention_compliance 3개 checker에서 독립적으로 반복 지적됨.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음 — Critical 자체가 없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec / Rationale Continuity / Convention Compliance (3건 통합) | 신설 정적 가드 `http-status-advertised{-guard.ts,.spec.ts}` 가 `swagger.md §2-4`·`api-convention.md §6` 의 "광고=실제" 불변식을 시행하는데도 두 문서 `code:` frontmatter 에 등재 계획 없음 (`spec_impact: none`) | `plan/in-progress/post-status-openapi.md` §요구 1 | `spec/conventions/swagger.md` frontmatter `code:` (기존 `swagger-dto-contract*`·`param-uuid-pipe*` 등 등재 관례 + §5-1 Rationale 자체 경고), `spec/5-system/2-api-convention.md` frontmatter `code:`, `spec/conventions/spec-impl-evidence.md` §2.1 | (a) `spec_impact` 를 두 파일 frontmatter 갱신으로 재정의 후 짧은 planner 턴으로 `code:` 에 가드 경로 2개 추가, 또는 (b) 생략 사유와 후속 항목을 plan 에 명시 |
| 2 | Cross-Spec | `oauthBegin` 은 Cafe24 Private/MakeShop 분기에서 실제로 Integration `pending_install` 행을 **생성**함 — "14곳 전부 자원을 만들지 않는 액션" 이라는 target 의 전칭 근거가 이 분기에서 사실과 다름 (§6 은 201=생성 성립) | `plan/in-progress/post-status-openapi.md` "방향" 절 근거 문장 | `spec/2-navigation/4-integration.md` §9 (`pending_install` 생성 명시), `spec/5-system/2-api-convention.md` §6 | 근거 문장을 "12곳은 순수 액션, `oauthBegin` 은 일부 분기에서 생성하지만 기존 200 광고를 다투지 않는다" 로 좁히기. spec 본문 수정은 불요 |
| 3 | Cross-Spec | `acceptInvitation` 은 WorkspaceMember 행을 생성함 — "액션=200" 분류가 §6 201 정의와 경계선(트래커 위임에 따라 진행은 타당하나 근거 미기록) | `plan/in-progress/post-status-openapi.md` 14곳 목록 | `spec/2-navigation/9-user-profile.md` §6.1, `spec/5-system/2-api-convention.md` §6 | `--impl-done` 리뷰에서 "1차 자원=Invitation, 멤버십 생성=부수효과" 판단 근거를 한 줄 기록 |
| 4 | Convention Compliance | `swagger.md §2-4` / `api-convention.md §6` 상태 코드 표가 "액션성 POST(자원 미생성)" 범주를 명문화하지 않아, 이번 정정이 표 문면이 아닌 교차 문서 추론(§3 문장 + 코드 실측)에 의존 | `spec/conventions/swagger.md` §2-4, `spec/5-system/2-api-convention.md` §6 | 두 문서 자신의 표 정의(조회/수정=200 만 명시) | 표에 "액션성 POST(자원 미생성)는 200" 한 줄을 명문화하는 후속 규약 결정을 트래커에 등재 (착수는 이 PR 불요) |
| 5 | Plan Coherence | `revokeInvitation` 광고 정정으로 target 이 직접 확인한 세 번째 §6 위반 DELETE 라우트가, 이미 등재된 pending planner 항목("위반 라우트 2곳")의 실측 카운트에 반영 안 됨 | `plan/in-progress/post-status-openapi.md` "방향" `revokeInvitation` 항목, 요구 6 | `plan/in-progress/spec-draft-nullable-notation-followups.md:4861-4869` (위반 라우트 2곳으로 실측, `workspaces.controller.ts:560` 이미 5곳 `ok:true` 목록엔 있었으나 "위반 라우트" 서술엔 누락) | `followups.md:4861` 항목의 실측 문구를 세 번째 라우트(`DELETE .../invitations/:invitationId`) 포함하도록 갱신 — 같은 턴 발견이라 반영 비용 최소 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | `revokeInvitation` 광고 정정은 아직 미결인 "204 전환" 트래커 항목을 선점하지 않음 — plan 이 명시적으로 경계를 그음 | `plan/in-progress/post-status-openapi.md` 방향 절, `followups.md:4861` | 커밋/CHANGELOG 에 "204 채택 여부는 별도 트래커 미결" 한 줄 남기기 |
| 2 | Rationale Continuity | 14곳 "액션→200" 분류는 §2.2 자원액션 예시·`restoreVersion` 기 구현·`:id/test` pending_install Rationale 세 선례와 정합, 기각된 대안 재도입 아님 | plan 전체 | 없음 — CHANGELOG/plan 에 세 선례 인용하면 다음 검토자 재조사 비용 감소 |
| 3 | Convention Compliance | 8/10 대상 spec 파일에 명시적 `## Overview` 섹션 없음 — 기존 상태, 이번 변경과 무관 | `4-integration.md`·`5-knowledge-base.md`·`9-user-profile.md`·`3-schedule.md`·`3-execution.md`·`4-ai-assistant.md`·`11-mcp-client.md` | 이번 PR 조치 불요, project-planner 참고용 |
| 4 | Plan Coherence | 신규 repo-guard 가 별도의 미결 "guard `code:` 등재 관례" 항목(모집단 14/5/9)을 1개만큼 stale 하게 만듦 | 요구 1 신설 가드, `followups.md:4006-4038` | 트래커 갱신 시 "http-status-advertised-guard 도 미등재 목록에 포함" 한 줄 추가 |
| 5 | Naming Collision | 신규 식별자는 가드 파일 경로 1쌍뿐(`http-status-advertised{-guard.ts,.spec.ts}`), `find` 전수 확인 결과 기존 파일·명명 컨벤션과 충돌 없음. 새 API/이벤트/ENV/요구ID 발급 없음 | 전체 | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | `oauthBegin` 생성 분기로 전제 부정확 + 가드 미등재 |
| Rationale Continuity | LOW | 가드 미등재 외엔 기존 rationale(§2.2·`restoreVersion`·`:id/test`)과 정합 |
| Convention Compliance | LOW | 가드 미등재 + 상태코드 표의 "액션성 POST" 범주 공백 |
| Plan Coherence | LOW | `revokeInvitation` 관련 pending tracker 위반 라우트 카운트(2→3) 미갱신 |
| Naming Collision | NONE | 신규 식별자 충돌 없음 (find 전수 확인) |

## 권장 조치사항

1. `oauthBegin` 서술 정정 — "14곳 전부 자원 미생성" 전칭을 "12곳 순수 액션 + `oauthBegin` 은 기존 200 광고 유지(생성 분기 존재)"로 좁힌다 (WARNING #2).
2. 신설 가드 2개 경로를 `swagger.md`/`api-convention.md` `code:` frontmatter 에 등재 — 짧은 planner 턴 또는 `spec_impact` 명시적 재정의로 처리 (WARNING #1).
3. `plan/in-progress/spec-draft-nullable-notation-followups.md:4861` 의 위반 라우트 수를 2→3(`revokeInvitation` 포함)으로 갱신 — 이번 PR 이 직접 발견했으므로 반영 비용 최소 (WARNING #5).
4. `acceptInvitation` 판단 근거("1차 자원=Invitation, 멤버십=부수효과")를 `--impl-done` 리뷰 시점에 한 줄 기록 (WARNING #3).
5. (비차단 후속) `swagger.md §2-4`/`api-convention.md §6` 표에 "액션성 POST(자원 미생성)=200" 명문화를 트래커에 등재 (WARNING #4).
6. 트래커 갱신(요구 6) 시 `followups.md:4006-4038` 의 guard `code:` 등재 관례 항목에도 신규 가드 1개를 반영 (INFO #4).
