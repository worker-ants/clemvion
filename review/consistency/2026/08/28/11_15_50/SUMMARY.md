# Consistency Check 통합 보고서

**BLOCK: NO**

## 전체 위험도
**LOW** — Critical 없음. cross_spec·plan_coherence 가 각각 실제 코드/plan 대조로 잡아낸 문서 drift(WARNING) 4건이 있으나 모두 구현을 즉시 막을 사유가 아니라 다음 `project-planner` 턴에서 spec 정정으로 닫을 항목이다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 패스에 Critical 판정이 없어 인계 대상 자체가 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | JWT Access Token 예시의 `role` 클레임이 암시하는 신뢰 모델이 실제 인가 메커니즘과 다르다 — `RolesGuard`는 JWT `role`을 읽지 않고 매 요청 DB(`getMemberRole`)를 재조회하는데, §2.2 예시는 `role` 필드에 아무 설명도 없이 인가에 쓰이는 것처럼 보인다 | `spec/5-system/1-auth.md` §2.2 | `spec/data-flow/12-workspace.md` §Rationale("멤버십 검증은 가드 1곳에서"), `1-auth.md` §3.3, `codebase/backend/.../roles.guard.ts` | planner 턴에서 §2.2에 "`role`은 로그인 시점 스냅샷이며 인가에는 미사용(실제 인가는 §3.3/RolesGuard가 매 요청 DB 조회)" 각주 추가, 또는 필드 제거 |
| 2 | cross_spec | "동시 세션 기본 5개, 관리자 설정 가능"이 Workspace `settings` 키 레지스트리·설정 UI·API 어디에도 대응 표면이 없고 코드에도 구현이 없다(grep 0건). 알려진 갭 트래커에도 미등재 | `spec/5-system/1-auth.md` §2.3 세션 정책 표 | `spec/1-data-model.md` §2.2 Workspace `settings` known-keys(3개, 세션 한도 없음), `spec/2-navigation/{6-config,9-user-profile}.md`, `plan/in-progress/spec-sync-auth-gaps.md`(미등재) | planner 턴에서 (a) 실제 계획이면 known-keys에 키 추가 + gaps 트래커 등재, (b) 아니면 "관리자 설정 가능" 문구 제거/고정값으로 정정 |
| 3 | plan_coherence | `OAUTH_STATE_MISMATCH`가 중앙 에러 카탈로그 §1.2에 아직 등재되지 않음 — plan이 2026-08-14 실측·삽입 위치까지 확정해 뒀으나(§1.8→§1.2 정정 포함) 오늘 재확인해도 여전히 미등재, `error-codes.md`·`2-navigation/4-integration.md`에만 산재 | `spec/5-system/3-error-handling.md` §1.2 | `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임(2026-08-14 #12)" | planner 턴에서 §1.2에 표 1행 추가(로그인 OAuth/연동 OAuth 중 어느 표면을 덮는지 명시 포함). plan 자체는 정확해 plan 갱신 불요 |
| 4 | plan_coherence | `update-returning-tuple-shape.md`가 위임한 소급 caveat 5건 중, 이번 스코프(`spec/5-system/`) 안의 3건(admission gate·KB 재임베딩 CAS 락·KB 재추출 CAS 락)이 아직 target에 반영되지 않음 — `.query()` 튜플 오독 버그로 실제로는 해당 보장이 한때 실효되지 않았던 이력(e2e 4191ms→2242ms 실측)이 caveat 없이 누락 | `spec/5-system/4-execution-engine.md` §1.1, `spec/5-system/8-embedding-pipeline.md` §7.3, `spec/5-system/10-graph-rag.md` 동시 호출 표 | `plan/in-progress/update-returning-tuple-shape.md` `## 후속` `[planner 위임]` 2건 | planner 턴에서 3개 spec 파일에 소급 caveat 추가(나머지 2곳 `spec/data-flow/2-auth.md`·`spec/conventions/node-cancellation.md`은 이번 스코프 밖이나 동일 위임에 포함되어 있으니 함께 처리 권장). plan 갱신 불요, `node-cancellation.md` frontmatter `pending_plans:` 누락도 함께 정정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `WorkspaceInvitation` 엔티티가 `spec/1-data-model.md`에 정식 등재되어 있지 않음(필드는 `data-flow/12-workspace.md`·`2-navigation/9-user-profile.md`에 흩어져 있으나 상호 모순은 없음) | `spec/5-system/1-auth.md` §1.5.1 | planner 턴에서 `1-data-model.md`에 `WorkspaceInvitation` §2.x 신설, 세 문서가 이를 참조하도록 정리 |
| 2 | convention_compliance | `## Overview` 섹션 헤딩 부재 — `spec/5-system/` 18개 파일 중 7개(2-api-convention.md 포함)에 걸친 선재 패턴, 신규 이탈 아님 | `spec/5-system/2-api-convention.md` 최상단 | 개별 수정보다 `spec/5-system/` 문서 구조 일괄 정리를 별도 plan 항목으로 처리 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | JWT `role` 신뢰모델 불일치, 세션 한도 설정 갭(둘 다 WARNING) + WorkspaceInvitation 미등재(INFO). 그 외 RBAC/에러코드/invitation drift는 이미 정합 상태 확인 |
| rationale_continuity | NONE | 발견 없음 — 전체 로드된 3개 파일 모두 Rationale과 본문이 정합, 번복 시 "정합화" 사유 명시 관행 정착 확인. 단 예산 초과로 생략된 15개 파일은 미판정 |
| convention_compliance | NONE | 발견 없음 — 에러코드/감사액션/엔드포인트/응답 envelope 모두 conventions와 정합. Overview 헤딩 부재는 INFO로 낮춤(선재 패턴). 생략된 15개 파일은 미판정 |
| plan_coherence | LOW | 이미 plan이 스스로 확정해 둔 두 건의 후속 spec 반영(OAuth 에러코드 등재, 소급 caveat 5건 중 3건)이 아직 target에 착지하지 않음. 새로운 미해결 결정 충돌은 없음 |
| naming_collision | NONE | target(`spec/5-system/`)이 origin/main 대비 diff 0(이번 브랜치는 lint 툴체인 업그레이드, spec 변경 없음). 요구사항ID/엔티티/엔드포인트/이벤트명/env var/파일경로 6개 관점 재대조 결과 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소 사유 없음 — 진행 가능) 다음 `project-planner` 턴에서 WARNING 4건을 spec 정정으로 처리: ① `1-auth.md` §2.2 `role` 클레임 각주, ② §2.3 동시 세션 한도 표면 정리, ③ `3-error-handling.md` §1.2 `OAUTH_STATE_MISMATCH` 등재, ④ execution-engine/embedding-pipeline/graph-rag 소급 caveat 3건(+스코프 밖 2건).
2. INFO 2건(`WorkspaceInvitation` 데이터모델 등재, `spec/5-system/` Overview 헤딩 일괄 정리)은 급하지 않으므로 위 planner 턴에 묶어 처리하거나 별도 문서 정리 plan으로 이월.
3. 예산 초과로 생략된 `spec/5-system/` 15개 파일(특히 `4-execution-engine.md`·`6-websocket-protocol.md`·`14-external-interaction-api.md`)은 이번 패스에서 rationale_continuity·convention_compliance가 판정하지 못했다 — 그 파일들을 대상으로 하는 구현이라면 별도 파일 단위 패스 권장.
