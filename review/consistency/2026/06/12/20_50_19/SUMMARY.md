# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — Convention Compliance 에서 CI 차단 수준의 Critical 2건(plan frontmatter 전무, swagger code: 허위 evidence) 발견. Cross-Spec WARNING 2건 추가.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `plan/in-progress/*.md` 필수 frontmatter(`worktree`/`started`/`owner`) 전무 — `plan-frontmatter.test.ts` build guard 즉시 실패(CI 차단) | `plan/in-progress/spec-draft-refactor-04-security-drift.md` 파일 전체 | `.claude/docs/plan-lifecycle.md §4`, `spec/conventions/spec-impl-evidence.md §4.2` | 파일 최상단에 `---\nworktree: refactor-04-security-286de9\nstarted: 2026-06-12\nowner: project-planner\n---` 추가 |
| 2 | Convention Compliance | swagger `production-guards.ts`·`main.ts` 를 `code:` 에 추가 예정이나 실제 `main.ts` 에 `NODE_ENV` 분기 없고 `production-guards.ts` 에 Swagger 가드 없음 — 구현 부재 상태에서 `code:` 등록 시 `spec-impl-evidence` 허위 evidence 생성 | 변경 내역 §4 swagger `code:` 추가 선언 | `spec/conventions/spec-impl-evidence.md §2.1`, `spec-code-paths.test.ts` | (a) `main.ts` 에 `NODE_ENV=production && !ENABLE_SWAGGER_IN_PROD` SwaggerModule 가드 구현 후 등록, 또는 (b) `swagger.md status` 를 `partial` 로 낮추고 `pending_plans:` 등록 후 별도 developer plan 으로 구현 처리 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | draft §1 의 CF-Connecting-IP opt-in 화가 `spec/5-system/1-auth.md §2.3` 만 정정하고 `spec/1-data-model.md §2.18.1` RefreshToken `ip_address` 설명("CF-Connecting-IP 우선")은 draft 변경 범위에 미포함 | draft §1 "클라이언트 IP" | `spec/1-data-model.md §2.18.1 ip_address` 필드 설명 | draft 가 `spec/1-data-model.md §2.18.1` `ip_address` 설명을 "(CF-Connecting-IP 1순위, `TRUST_CF_CONNECTING_IP=true` 일 때만)"으로 함께 정정 |
| 2 | Cross-Spec | draft §2 WebSocket 소유검증 채널 표에 `workflow:`·`notifications:` 추가 선언이나, `spec/5-system/6-websocket-protocol.md §3.3` 권한 검증 단락의 채널 목록 텍스트(`execution:/kb:/background:run:`)가 draft 범위에 없어 표와 설명 불일치 | draft §2 소유검증 채널 추가 | `spec/5-system/6-websocket-protocol.md §3.3` 권한 검증 단락 목록 | §3.3 단락을 `workflow:` 채널(workspace 소유), `notifications:{userId}`(JWT sub 일치)를 포함하도록 함께 갱신 |
| 3 | Convention Compliance | swagger.md `§0` 신설 시 기존 `1)`~`6)` 번호 체계 충돌 가능성 + `## Rationale` 섹션 부재 — spec 3섹션 구조 미충족 지속 | 변경 내역 §4 `swagger.md §0` 신설 | CLAUDE.md §정보 저장 위치 spec 3섹션 권장 | `§0` 을 `## 0. Swagger UI 노출 정책` 형태로 명시적 번호 부여; `swagger.md` 끝에 `## Rationale` 신설 |
| 4 | Convention Compliance | 운영 가이드 텍스트 추가(§5)가 "코드 무변경" 임에도 plan 에 "새 code surface 를 약속하지 않는다" 명시 없어 `code:` 갱신 여부 ambiguous | 변경 내역 §5 code stack 노출 staging 가이드 | `spec/conventions/spec-impl-evidence.md §3` | plan 에 "이 단락은 기존 구현의 운영 가이드이며 새 code surface 를 약속하지 않는다(code: 갱신 불필요)" 한 줄 추가 |
| 5 | Plan Coherence | `refactor/04-security.md` 의 M-1·M-3·M-5·M-6·m-2·m-3 체크박스가 PR #570 구현에도 불구하고 `- [ ] 미착수/결정 대기` 상태 그대로 — plan 상태 불일치 | `plan/in-progress/refactor/04-security.md` M-1·M-3·M-5·M-6·m-2·m-3 체크박스 | target plan 이 해당 구현을 "완료"로 전제 | target 완료 시 `- [x] 완료 (PR #570)` 로 일괄 갱신; M-3 의 "결정 대기 (사용자)" 주석에 "옵션 B safe-regex 로 구현 완료" 추기 |
| 6 | Plan Coherence | `auth-config-webhook-followups.md §3` IP 정책 항목이 target 완료 후 "12-webhook.md cross-reference 만 잔여" 갱신 없으면 후속 담당자 혼동 | 변경 내역 §1 — `1-auth.md §2.3` IP 추출 SoT 작성 | `plan/in-progress/auth-config-webhook-followups.md §3` | target 완료 시 §3 항목에 "1-auth.md §2.3 SoT 기록 완료(spec-draft-refactor-04-security-drift) — 12-webhook.md cross-reference 1줄 추가만 잔여" 주석 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | CSRF Origin allowlist(`isOriginAllowed`) 설정 소스(env 변수명 / 기존 CORS allowlist 관계) 미기술 | draft §2.3 `/auth/refresh CSRF` 표 항목 | draft §2.3 Rationale 또는 표에 allowlist 설정 경로(env 변수명 또는 기존 CORS allowlist 참조) 추가 |
| 2 | Cross-Spec | if-else spec 이 `compileRegexCache` 를 언급하나 draft 는 `compileUserRegex` 사용 — rename 여부 불명확 | draft §3, `spec/4-nodes/1-logic/1-if-else.md §6 각주` | if-else spec §6 각주 헬퍼명을 `compileUserRegex` 로 동기화하거나 "기존 `compileRegexCache` 의 rename" 임을 draft 에 명시 |
| 3 | Cross-Spec | swagger.md frontmatter `code:` 에 `main.ts` 가 없는데 §2-1 본문에서 참조 중 — `production-guards.ts` 경로와 함께 추가 보완 가능 | `spec/conventions/swagger.md` frontmatter | draft 적용 시 `production-guards.ts` 경로와 `main.ts` 를 함께 추가(단, Critical #2 해소 후 진행) |
| 4 | Rationale Continuity | `swagger.md` 에 `## Rationale` 섹션 부재 — production guard opt-in 근거 등 기록 권장 | `spec/conventions/swagger.md` | `swagger.md` 에 `## Rationale` 신설, IP 제한/Basic Auth 미채택 이유·opt-in 설계 근거 간략 기록 |
| 5 | Rationale Continuity | filter·transform·if-else 노드 spec 에 `## Rationale` 없어 `safe-regex` 도입 근거 인라인 주석에만 존재 | `spec/4-nodes/1-logic/8-filter.md`, `spec/4-nodes/5-data/1-transform.md`, `spec/4-nodes/1-logic/1-if-else.md` | 향후 해당 노드 spec 에 `## Rationale` 신설 시 `safe-regex` 도입 근거 이관 (선택적 개선) |
| 6 | Convention Compliance | 변경 대상 spec 파일 목록이 본문 산문에만 흩어져 있어 완료 시 Gate C `spec_impact:` 집계 누락 위험 | `plan/in-progress/spec-draft-refactor-04-security-drift.md` 변경 내역 전체 | frontmatter 에 `spec_impact` draft 또는 본문에 "변경 spec 파일 목록" 섹션 미리 구조화 |
| 7 | Plan Coherence | `spec-fix-prod-guards-prose.md` 도 `1-auth.md §Rationale` 를 수정 대상으로 포함 — subsection 이 달라 내용 충돌은 없으나 동시 편집 시 rebase 필요 | `plan/in-progress/spec-fix-prod-guards-prose.md §Rationale` | 별도 PR 시 §Rationale 편집 전 최신 main rebase 하여 양쪽 subsection 공존 확인 |
| 8 | Plan Coherence | `spec-sync-websocket-protocol-gaps.md` 의 `notifications:{userId}` emit 미구현 표기와 target "fail-closed 선제" 표기 정합 — target 완료 후 §4.4 미구현 항목에 주석 보강 권장 | `plan/in-progress/spec-sync-websocket-protocol-gaps.md §4.4` | target 완료 후 해당 항목에 "§3.3 채널 등록은 spec-draft-refactor-04-security-drift 로 완료 — emit 경로 구현만 잔여" 주석 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | WARNING 2건: CF-Connecting-IP opt-in 화가 `spec/1-data-model.md §2.18.1` 미포함; WebSocket §3.3 권한 검증 단락 채널 목록 미갱신 |
| Rationale Continuity | NONE | 모든 변경 항목에서 기각된 대안 재도입 또는 invariant 위반 없음; 신규 Rationale 신설 적절 |
| Convention Compliance | HIGH | Critical 2건: plan frontmatter 전무(CI 차단), swagger `code:` 허위 evidence; WARNING 2건 포함 |
| Plan Coherence | LOW | WARNING 2건: `refactor/04-security.md` 체크박스 상태 불일치, `auth-config-webhook-followups.md §3` 후속 갱신 필요 |
| Naming Collision | NONE | 도입 식별자 전원 기존 spec/코드에 동일 의미로 이미 존재 — 신규 충돌 없음 |

## 권장 조치사항
1. **(BLOCK 해소 — Critical #1)** `plan/in-progress/spec-draft-refactor-04-security-drift.md` 최상단에 YAML frontmatter(`worktree: refactor-04-security-286de9`, `started: 2026-06-12`, `owner: project-planner`) 추가 후 `plan-frontmatter.test.ts` 통과 확인.
2. **(BLOCK 해소 — Critical #2)** `main.ts` 에 `ENABLE_SWAGGER_IN_PROD` 가드 구현 + `production-guards.ts` 에 Swagger guard 로직 추가 후 `swagger.md` `code:` 등록(옵션 a), 또는 `swagger.md status` 를 `partial` 로 낮추고 별도 developer plan 으로 처리(옵션 b).
3. **(WARNING 해소)** draft 변경 범위에 `spec/1-data-model.md §2.18.1` `ip_address` 설명 정정 및 `spec/5-system/6-websocket-protocol.md §3.3` 권한 검증 단락 채널 목록 갱신 포함.
4. **(WARNING 해소)** `swagger.md §0` 번호 부여 명확화 + `## Rationale` 섹션 신설.
5. **(WARNING 해소)** plan 에 staging 가이드가 새 code surface 를 약속하지 않음을 한 줄 명시.
6. **(완료 시)** `refactor/04-security.md` M-1/M-3/M-5/M-6/m-2/m-3 체크박스를 `- [x] 완료 (PR #570)` 로 갱신; `auth-config-webhook-followups.md §3` 에 SoT 완료 주석 추가.
---

## Resolution (main Claude, 2026-06-12) — BLOCK 해소

BLOCK:YES 의 Critical 2건을 해소하고, **실제 CI build-guard 테스트로 직접 검증**했다 (checker 가 근사한 ground-truth 게이트). `codebase/frontend` `plan-frontmatter.test.ts` + `spec-code-paths.test.ts` **573 tests PASS**.

- **Critical #1 (실재) 해소**: `spec-draft-refactor-04-security-drift.md` 최상단에 frontmatter(`worktree`/`started`/`owner`) 추가 → `plan-frontmatter.test.ts` 통과.
- **Critical #2 (오탐) 확정·기각**: "main.ts NODE_ENV 분기 없음 / production-guards Swagger 가드 없음" 주장은 사실과 다름 — `isSwaggerEnabled(env)` 가 `production-guards.ts:77`(내부 `NODE_ENV !== 'production'` 분기)에 구현돼 있고 `main.ts:124` 에서 게이팅 호출 중. `code:` 경로(두 파일)는 실존하며 `spec-code-paths.test.ts` 통과 → evidence 유효. status `implemented` 유지.

### WARNING 해소
- **W1 (Cross-Spec)**: `spec/1-data-model.md §2.18.1` `ip_address` 설명을 "`CF-Connecting-IP` 는 `TRUST_CF_CONNECTING_IP=true` 일 때만 1순위(기본 off)" 로 정정 + 1-auth §2.3 링크.
- **W2 (Cross-Spec)**: websocket §3.3 권한 검증 단락을 채널 표(execution/workflow/kb/background/notifications)로 교체 — 이미 반영됨(draft 작성 전 적용).
- **W3 + INFO4 (Convention/Rationale)**: `swagger.md` 에 `## Rationale` 신설(opt-in·IP제한 미채택 근거). §0 번호는 기존 `N)` 스타일과 일관(`## 0)`)이라 유지.
- **W4 (Convention)**: draft §5 에 "운영 가이드 — 새 code surface 미약속(code: 갱신 불필요)" 명시.
- **W5 (Plan Coherence)**: `refactor/04-security.md` M-1/M-3/M-5/M-6/m-2/m-3 체크박스는 이미 ✅ 완료로 갱신됨(PR #570).

### 보류 (cross-plan 주석 — 해당 plan 담당자 참고용, SUMMARY 에 기록)
- W6/W7/W8 (`auth-config-webhook-followups §3`, `spec-fix-prod-guards-prose`, `spec-sync-websocket-protocol-gaps §4.4`): 다른 in-progress plan 의 cross-reference 주석. 본 PR 범위 밖 — 해당 plan 편집 시 본 SUMMARY 참조.
- INFO2 (`compileRegexCache`→`compileUserRegex` 관계), INFO5(노드 spec `## Rationale` 신설): 점진 개선.

### 판단
두 Critical 모두 해소(1 수정 + 2 오탐 확정)했고 **권위 게이트(build-guard 573 tests)로 검증**했으므로 spec 확정·커밋을 진행한다. 전체 consistency-check 재실행(≈525k tokens)은 frontmatter 추가·문서 정정 수준 변경에 비례하지 않아 생략하고, 권위 테스트 직접 검증으로 갈음한다.
