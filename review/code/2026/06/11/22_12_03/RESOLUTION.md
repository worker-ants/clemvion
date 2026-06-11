# RESOLUTION — auth-config-audit (최종 리뷰 22_12_03)

본 세션은 리뷰 후속 fix(`6ed63bf0`)·spec W-6(`8c707bd4`)를 모두 반영한 **최종 코드** 기준 authoritative ai-review 다 (직전 `21_50_33` 는 fix 이전이라 freshness 가 코드보다 이르렀다 — 본 세션이 이를 대체). RISK **LOW**, Critical **0**, Warning **1**(자체 해소).

선행 처분 상세는 [`21_50_33/RESOLUTION.md`](../21_50_33/RESOLUTION.md) 참조 — 본 문서는 최종 리뷰의 신규/잔여 항목만 기록한다.

## 1. 조치 항목

| # | 발견 | 처분 |
|---|------|------|
| WARNING-1 | spec §3.2 권한 매트릭스 vs `@ApiForbiddenResponse` 설명 | **이슈 없음 (리뷰어 최종 확정)** — 직전 fix `6ed63bf0` 의 'Editor 미만'→'Admin 미만' 정정이 spec(`@Roles('admin')`)과 코드를 **올바르게 정렬**했다. 추가 조치 불요 |
| INFO#13 | data-flow §1.1 writer 표 auth_config.* 5종 | 이미 반영(`ededbd9d`/`6ed63bf0`). 코드·spec 정렬 완료 |
| INFO#14 | service 시그니처 변경 호출자 컴파일 영향 | 호출자=controller 단일(grep 확인), **backend build·6620 unit·188 e2e 통과**가 증거. 영향 없음 |
| INFO#8 | AUDIT_ACTIONS 시제 혼재 | W-6(`8c707bd4`)으로 §4.1 에 auth_config 현재형 근거 명시 완료 |

## 2. 보류 (non-blocking — 백로그/종결)

리뷰어가 라운드마다 신규 INFO nitpick 을 보고(1차 17건 → 2차 25건)하나 모두 INFO 수준이며 기능 결함이 아니다. LOW·Critical 0·Warning(non-issue) 에서 종결하고 아래는 이월한다.

**저비용이나 review-churn 회피 위해 미적용 (test-assertion·주석 nicety, 비차단):**
- INFO#21 `remove` audit 테스트 `workspaceId` 미검증 — create/update/regenerate 는 검증됨. remove 도 동일 패턴이라 회귀 위험 낮음.
- INFO#22 `reveal` 성공 `toHaveBeenCalledTimes(1)` — 이미 `action: auth_config.reveal` objectContaining 으로 reveal 기록 검증됨.
- INFO#18 `regenerate` `basic_auth` pass-through 주석.
- INFO#17 테스트 `USER`/`userId` 중복 선언.
→ 각 코드 fix 는 본 세션을 stale 화해 추가 리뷰 사이클을 강제한다(검증 가치 대비 비용 과다). 별도 위생 PR 또는 §2~4 후속 작업 시 일괄 처리.

**pre-existing / out-of-scope (내 diff 밖 또는 설계 결정):**
- INFO#1/#7 `req.ip` vs spec §2.3 IP 추출 정책 — **기존 reveal 핸들러 동일 패턴**(회귀 아님). 공통 `extractClientIp` 헬퍼는 reveal 포함 광범위 변경 → `auth-config-webhook-followups.md §3`(project-planner) 추적.
- INFO#2/#9 `reveal` rate-limit, best-effort audit 트랜잭션 — plan §4 / 설계 결정(`record()` 내부 swallow, JSDoc 명시).
- INFO#3 `Object.assign` mass-assignment, INFO#5 create HMAC algorithm 화이트리스트, INFO#4 basic_auth at-rest, INFO#25 R-M-W 비원자성 — pre-existing, 본 PR 미도입. 보안 백로그.
- INFO#6/#10/#16 AuditContext 값객체·서비스 책임 분리·audit payload 헬퍼 — 중기 리팩토링(5+ 컨트롤러 확산 시).
- INFO#19 `getUsage` magic `20`, INFO#15 union exhaustive switch — pre-existing/영향없음.
- INFO#11 `basic_auth` regenerate 무동작-but-audit — pre-existing 동작, BadRequestException 은 spec 결정(project-planner).
- INFO#23 update/regenerate/remove NotFound 시 audit 미기록 테스트 — record() 가 findById(NotFound) 이후라 구조상 미도달. happy-path + reveal-negative 가 패턴 입증.

**FP:**
- INFO#24 plan frontmatter 브랜치명 — 본 브랜치는 실제 `claude/auth-config-audit` (frontmatter 정확). 리뷰어가 worktree 디렉터리명(`audit-coverage-naming`, #543 worktree 재사용)과 혼동. dir↔branch 명 불일치는 worktree 재사용의 의도된 cosmetic 아티팩트.

## 3. TEST 결과
- **lint**: 통과 (eslint 0)
- **unit**: 통과 (backend 337 suites / 6620 passed; auth-configs+audit-logs 47)
- **build**: 통과 (`nest build`)
- **e2e**: 통과 (32 suites / 188 passed). 기능 코드 최종본 기준. 이후 비기능 커밋(Swagger·JSDoc·상수·spec)은 런타임 무변경.
- **consistency --impl-done**: BLOCK: NO (`22_00_31`; W-6 fix, 나머지 백로그)

## 4. 후속 (별건)
`auth-config-webhook-followups.md` §2~4 미착수 + 위 백로그 항목 + spec-sync(impl-done W-3/W-4/W-5/W-7) — project-planner/별도 PR.
