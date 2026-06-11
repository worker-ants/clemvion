# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 함

## 전체 위험도
**MEDIUM** — `spec/conventions/node-output.md` Principle 3.1 SSRF 분류 미갱신(CRITICAL 1건) + 식별자 불일치 WARNING 2건 + 규약 참조 오류 WARNING 1건

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `node-output.md` Principle 3.1 표가 "SSRF 차단"을 pre-flight throw 로 분류한 채 미갱신 — D4 결정(SSRF 포함 모든 실패를 `port:'error'` 라우팅)과 conventions SoT 간 invariant 충돌 | `spec/4-nodes/4-integration/1-http-request.md §4 step 8`, `§5.3`, `§5.8`, `§6`; `0-common.md §4.2`; `2-database-query.md §4 SSRF 가드 callout` | `spec/conventions/node-output.md` Principle 3.1 표 — "SSRF 차단 등 → throw → 엔진이 실행 실패로 마킹" | `spec/conventions/node-output.md` Principle 3.1 표에서 "SSRF 차단 등" 문구 제거 또는 "D4 이후 `port:'error'` 라우팅 참조" 주석 추가 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Naming Collision | `HTTP_TIMEOUT` vs `HTTP_TRANSPORT_FAILED` 불일치 — error-handling spec·chat-channel-adapter spec 이 `HTTP_TIMEOUT` 을 독립 코드로 열거, `HTTP_TIMEOUT → executionFailedTimeout` 분기가 dead branch 화 위험 | `spec/4-nodes/4-integration/1-http-request.md §5.3.2`, `§6` (`HTTP_TRANSPORT_FAILED` 통합) | `spec/5-system/3-error-handling.md` 79/222행; `spec/conventions/chat-channel-adapter.md` 381행 | 3-error-handling.md 및 chat-channel-adapter.md 의 `HTTP_TIMEOUT` 참조를 `HTTP_TRANSPORT_FAILED` 로 갱신하거나, 타임아웃을 별도 코드로 유지할 의도라면 http-request §5.3.2 에 `HTTP_TIMEOUT` 분기 명시 분리 |
| 2 | Naming Collision | `INTEGRATION_AUTH_UNSUPPORTED` 가 공통 에러 코드 표에 미등재 — `INTEGRATION_*` prefix 패밀리 목록 불완전 | `spec/4-nodes/4-integration/1-http-request.md §4.1`, `§5.8`, `§6` | `spec/4-nodes/4-integration/0-common.md §4.2` 공통 에러 코드 표 (5개만 열거) | 0-common.md §4.2 에 `INTEGRATION_AUTH_UNSUPPORTED` 를 "HTTP Request 전용" 주석과 함께 추가하거나 forward-reference 추가 |
| 3 | Convention Compliance | `0-common.md §3` 의 "Principle 7 / §3" — 존재하지 않는 `§3` anchor 인용, 실제 정의는 Principle 0 | `spec/4-nodes/4-integration/0-common.md` 라인 47 | `spec/conventions/node-output.md` 섹션 구조 (Principle 0·7 존재, `§3` anchor 없음) | "CONVENTIONS Principle 7 / §3" → Principle 0 · Principle 7 정확한 anchor 링크로 교체 |
| 4 | Convention Compliance | `1-http-request.md` `status: implemented` 유지 — `followRedirects`/`verifySsl`/`binary` 미구현 항목 존재 시 `partial` 요건 미충족 가능 | `spec/4-nodes/4-integration/1-http-request.md` frontmatter | `spec/conventions/spec-impl-evidence.md §3` — `partial`: 일부 구현됨, `pending_plans:` 의무 | 미구현 항목 plan 등재 후 `status: partial` + `pending_plans:` 전환, 또는 해당 항목이 "향후 계획 메모"임을 명확화하고 `implemented` 유지 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | origin/main 의 `1-http-request.md` step 8 (인증='integration' 전용) vs `ALLOW_PRIVATE_HOST_TARGETS` callout 간 내부 모순 — target 이 전 인증 방식 공통 적용으로 해소 | `spec/4-nodes/4-integration/1-http-request.md §4 step 8` | 추가 조치 불필요 (target 이 해소) |
| 2 | Cross-Spec | Database Query SSRF 차단 에러 코드 비대칭 (`HTTP_BLOCKED`/`EMAIL_HOST_BLOCKED` vs `INTEGRATION_CALL_FAILED` fallback) — target 이 "향후 통일 후보"로 명문화 | `spec/4-nodes/4-integration/2-database-query.md §4 SSRF 가드 주석` | 별도 plan 으로 `DB_HOST_BLOCKED` 신설 또는 통일 작업 진행 |
| 3 | Cross-Spec | `spec/5-system/11-mcp-client.md` §3.2 production 가드 분류 (throw vs warn) — target 과 정합 | `spec/4-nodes/4-integration/1-http-request.md §4 ALLOW_PRIVATE_HOST_TARGETS callout` | 추가 조치 불필요 |
| 4 | Cross-Spec | `spec/5-system/_product-overview.md` NF-SC-05 SSRF 명시 부재 — target 변경이 규정 준수 강화, 범위 모호성 잔존 | `spec/4-nodes/4-integration/1-http-request.md §8.2 Rationale` | 별도 plan 발생 시 NF-SC-05 설명에 "SSRF 포함" 추가 |
| 5 | Cross-Spec | `spec/2-navigation/4-integration.md` SMTP SSRF Rationale — target 과 정합 | `spec/4-nodes/4-integration/3-send-email.md §8.0 Rationale` | 추가 조치 불필요 |
| 6 | Rationale Continuity | `EMAIL_NO_RECIPIENTS` 가 D4 합의와의 관계에서 명문화 부족 — try 밖 throw 유지가 의도된 예외임을 Rationale 에 미기록 | `spec/4-nodes/4-integration/3-send-email.md §5.8`, `§3.2`, `§8 Rationale` | send-email §8 Rationale 에 "D4 이후에도 try 밖 throw 유지하는 의도된 예외" 항목 추가 |
| 7 | Rationale Continuity | SSRF 차단 코드 비대칭 — DB Query 의 `INTEGRATION_CALL_FAILED` fallback 이 "향후 통일 후보"로만 남겨져 로드맵 불명확 | `spec/4-nodes/4-integration/2-database-query.md §4 SSRF 가드 callout` | DB Query Rationale 에 통일 방향 의도 명시 또는 0-common §4.2 에 각주 추가 |
| 8 | Rationale Continuity | `meta.duration` → `meta.durationMs` breaking change — 이전 결정 근거 서술 부재 | `spec/4-nodes/4-integration/0-common.md §6.1` | §6.1 에 기존 `meta.duration` 채택 배경 및 rename 이유 한 문장 추가 |
| 9 | Rationale Continuity | `output.response.error` legacy 잔재 — 폐지 계획 미명문화 | `spec/4-nodes/4-integration/1-http-request.md §5.3.2` | http-request §8 Rationale 에 "향후 minor version 에서 제거 예정" 항목 추가 |
| 10 | Convention Compliance | transport 실패 케이스 `output.response: { error: ... }` — Principle 1.1/3.2 비표준 에러 필드 공존 (legacy 잔재 인지됨) | `spec/4-nodes/4-integration/1-http-request.md §5.3.2` | 제거 plan 을 `pending_plans:` 에 등재 또는 node-output.md 에 단계적 호환 패턴 명시 |
| 11 | Convention Compliance | `0-common.md §3` nested envelope 예시의 `port` 기본값 설명 — "생략 시 success 계열 기본 포트" 가 Principle 5 와 경미한 표현 차이 | `spec/4-nodes/4-integration/0-common.md §3 JSON 예시` | "명시 반환 권장 (Integration 노드는 `success`/`error` 명시)" 으로 정확화 또는 현행 유지 |
| 12 | Plan Coherence | `spec-sync-integration-common-gaps.md` Missing Integration 배지 — 티어3 보류 중, target 이 결정 강제 않음 | `spec/4-nodes/4-integration/0-common.md §5` | 이슈 없음, spec-sync-audit worktree 에서 처리 |
| 13 | Plan Coherence | `node-output-redesign` Phase 3 transport-failed legacy 잔재 — plan 과 일치(deprecation 의도 명시 + 미제거) | `spec/4-nodes/4-integration/1-http-request.md §5.3.2` | node-output-redesign Phase 3 착수 시 함께 처리 |
| 14 | Plan Coherence | `prod-fail-closed-guards` worktree — PR MERGED 로 stale 판정, cleanup 권장 | `plan/in-progress/prod-fail-closed-guards.md` | `./cleanup-worktree-all.sh --yes --force` 실행 권장 |
| 15 | Plan Coherence | `refactor/04-security.md §C-3` — target plan 완료 후 체크박스 갱신 필요 | `plan/in-progress/refactor/04-security.md §C-3` | ai-review + consistency-check --impl-done 완료 후 C-3 를 `- [x] 완료` 로 갱신, http-ssrf-all-auth.md 를 plan/complete/ 로 이동 |
| 16 | Naming Collision | 전체 spec 트리의 old field name `meta.duration` 잔재 여부 미확인 | `spec/4-nodes/4-integration/0-common.md §6.1` | 전체 spec 트리에서 `meta\.duration[^M]` grep 수행 |
| 17 | Naming Collision | `ALLOW_PRIVATE_HOST_TARGETS` 적용 범위 확대 — 1-auth.md §생산 가드 섹션이 "http-request §4" 만 참조하는지 확인 필요 | `spec/4-nodes/4-integration/1-http-request.md §8.2 Rationale` | 1-auth.md 의 `ALLOW_PRIVATE_HOST_TARGETS` 참조가 확대 범위(DB/Email/HTTP none/custom)를 반영하는지 확인 |
| 18 | Naming Collision | `integration:cache:invalidate` Redis 채널명 — 기존 SoT 와 일치, 충돌 없음 | `spec/4-nodes/4-integration/2-database-query.md §4` | 해당 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | target 이 origin/main 의 내부 모순을 해소, 외부 spec 과 충돌 없음 |
| Rationale Continuity | LOW | Critical/Warning 없음; D4 예외·SSRF 코드 비대칭·breaking change 배경 등 Rationale 보완 사항 4건 (INFO) |
| Convention Compliance | MEDIUM | Principle 3.1 SSRF 분류 미갱신(CRITICAL) + anchor 오류·status 필드·legacy 잔재 WARNING/INFO |
| Plan Coherence | NONE | 진행 중 plan 과 정합; stale worktree 1건 cleanup 권장, C-3 완료 갱신 후속 필요 |
| Naming Collision | MEDIUM | `HTTP_TIMEOUT` vs `HTTP_TRANSPORT_FAILED` 불일치(WARNING) + `INTEGRATION_AUTH_UNSUPPORTED` 공통 표 누락(WARNING) |

## 권장 조치사항

1. **(BLOCK 해소 필수)** `spec/conventions/node-output.md` Principle 3.1 표에서 "SSRF 차단 등" → pre-flight throw 분류 문구 제거 또는 "D4 이후 `port:'error'` 라우팅으로 변경됨 — `0-common.md §4.2` 참조" 주석 추가. 이 단일 수정으로 BLOCK 해소 가능.
2. **(WARNING 해소 권장)** `spec/5-system/3-error-handling.md` 및 `spec/conventions/chat-channel-adapter.md` 의 `HTTP_TIMEOUT` 참조를 `HTTP_TRANSPORT_FAILED` 로 갱신하거나, `HTTP_TIMEOUT` 유지 의도 확정 후 http-request §5.3.2 에 분기 명시.
3. **(WARNING 해소 권장)** `spec/4-nodes/4-integration/0-common.md §4.2` 에 `INTEGRATION_AUTH_UNSUPPORTED` ("HTTP Request 전용") 추가 또는 forward-reference 추가.
4. **(WARNING 해소 권장)** `0-common.md §3` 의 "Principle 7 / §3" → Principle 0 · Principle 7 정확한 anchor 링크로 교체.
5. **(WARNING 검토)** `1-http-request.md` frontmatter `status: implemented` — `followRedirects`/`verifySsl`/`binary` 미구현 항목 plan 등재 여부 결정 후 `partial` 전환 또는 메모/약속 구분 명확화.
6. **(후속 정리)** `plan/in-progress/refactor/04-security.md §C-3` 완료 표시 갱신 + `http-ssrf-all-auth.md` → `plan/complete/` 이동. `prod-fail-closed-guards` stale worktree cleanup.
7. **(선택)** 전체 spec 트리 `meta\.duration[^M]` grep 으로 old field name 잔재 확인.