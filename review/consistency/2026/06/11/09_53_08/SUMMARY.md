# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

## 전체 위험도
**MEDIUM** — fallback 유지 결정이 기존 권장안(옵션 A)과 문서 상 차이를 가지며, security-jwt-secret-fallback.md 중복 추적 위험이 있다. 보안 목표 자체는 달성되므로 구현 차단 사유 아님.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Rationale Continuity / Plan Coherence | `jwt.config.ts` `\|\| 'dev-jwt-secret'` fallback **유지** — refactor/04-security.md C-1 권장 옵션 A(fallback 제거)를 부분 번복하면서 추적 문서에 공식 기록 없음 | `prod-fail-closed-guards.md` 라인 26 | `plan/in-progress/refactor/04-security.md` §C-1 옵션 A 권장안; `plan/in-progress/security-jwt-secret-fallback.md` "사용자/운영 합의 필요" | `refactor/04-security.md` C-1 항목에 "fallback 유지 방식으로 구현 — 가드가 sentinel 거부하므로 보안 동등" 한 줄 추가, 또는 `spec/5-system/1-auth.md §2.1` Rationale 에 동일 내용 명문화 |
| 2 | Plan Coherence | `security-jwt-secret-fallback.md` (backlog, 미착수)가 사실상 본 PR 로 대체 완료되나 plan 상태 갱신 절차 미정의 → 머지 후 중복 추적 위험 | `prod-fail-closed-guards.md` 출처 메모 | `plan/in-progress/security-jwt-secret-fallback.md` (worktree: unstarted) | 체크리스트에 "security-jwt-secret-fallback.md → plan/complete/ 이동 (본 PR 이 C-1 대체 완료)" 항목 추가 |
| 3 | Plan Coherence | refactor README spec 갱신 필요 목록(`secret-store.md placeholder 정책 (04 M-4)`, `1-auth.md §2.1`)이 본 PR 에서 처리되나, 완료 후 목록 항목 소멸 절차 미정의 | `prod-fail-closed-guards.md` §Spec | `plan/in-progress/refactor/04-security.md` spec 갱신 필요 항목 목록 | PR 머지 후 refactor README 해당 목록 항목을 strike-through 또는 target plan 참조로 닫아야 함 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `INTERACTION_JWT_SECRET` fail-closed 가 `InteractionTokenService` 생성자 throw(EIA spec §8.3)로 구현되어 있어 `assertProductionConfig` 와 별도 경로임이 spec 상 불분명 | `spec/5-system/14-external-interaction-api.md §8.3` | spec §8.3 노트에 "이 생성자 throw 는 assertProductionConfig 범위 밖 — 별도 유지" 1행 추가 |
| 2 | Cross-Spec | `OAUTH_STUB_MODE` production fail-closed spec SoT 문서 부재 — `LLM_STUB_MODE` 는 `spec/5-system/7-llm-client.md §7.1` 이 SoT 이나 `OAUTH_STUB_MODE` 대응 섹션 없음 | `spec/5-system/1-auth.md §2.1` 또는 `spec/2-navigation/10-auth-flow.md §5.1` | 구현 완료 후 `spec/5-system/1-auth.md §2.1` 에 `OAUTH_STUB_MODE` production fail-closed 노트를 `LLM_STUB_MODE §7.1` 과 동형으로 추가 |
| 3 | Cross-Spec | `ALLOW_PRIVATE_HOST_TARGETS` warn 발생 위치(main.ts 단독 vs 각 노드 실행 시점) spec 에 미정의 | `spec/4-nodes/4-integration/1-http-request.md §4` 외 3곳 | 구현 시 warn 발생 위치를 코드 주석에 명확히 기록하는 것으로 충분 |
| 4 | Rationale Continuity | `assertProductionConfig` 가 `OAUTH_STUB`/`LLM_STUB` 기존 인라인 가드를 대체 시 동작 동등성 검증이 체크리스트에 미명시 | `prod-fail-closed-guards.md` 체크리스트 | 단위 테스트 항목에 "OAUTH_STUB/LLM_STUB 분기 — 기존 인라인 동작 동등" 명시 |
| 5 | Rationale Continuity | `production-guards.ts` 내 `ALLOW_PRIVATE_HOST_TARGETS` 처리 주석에 "M-7 분리 결정 — spec/5-system/11-mcp-client.md §132" 출처 미기재 | `production-guards.ts` (신규 파일) | 코드 주석에 spec 출처 1행 추가 |
| 6 | Convention Compliance | plan `## Spec` 섹션이 전체 경로 없이 basename 참조(`1-auth.md`, `secret-store.md`, `11-mcp-client.md`) | `prod-fail-closed-guards.md` §Spec | 전체 경로(`spec/5-system/1-auth.md` 등)로 교체 권장 (build 차단 없음) |
| 7 | Plan Coherence | `spec/5-system/1-auth.md` 병행 수정 worktree(`unified-model-mgmt-5af7ee`) 존재 — 대상 섹션 비중첩(§2.1 vs §RBAC/Model Config)이라 직접 충돌 낮으나 rebase 필요 가능성 | `prod-fail-closed-guards.md` §Spec — `1-auth.md §2.1` | PR 본문에 "unified-model-mgmt-5af7ee 선행 머지 권장" 주석 추가 |
| 8 | Naming Collision | 신규 식별자 `assertProductionConfig`, `production-guards.ts` — 기존 spec/코드베이스 어디에도 존재하지 않아 충돌 없음 (참고용 확인 결과) | `prod-fail-closed-guards.md` §변경 | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 세 건 INFO — `INTERACTION_JWT_SECRET` 가드 경로 분리 불명확, `OAUTH_STUB_MODE` SoT 부재, `ALLOW_PRIVATE_HOST_TARGETS` warn 위치 미정의. 직접 모순 없음 |
| Rationale Continuity | LOW | `jwt.config.ts` fallback 유지가 refactor C-1 옵션 A 번복이나, 기술 근거 존재. 추적 문서 미기록이 주 위험 |
| Convention Compliance | NONE | Frontmatter 3필드·sentinel·날짜 형식 모두 준수. INFO 2건은 형식 제안 수준 |
| Plan Coherence | MEDIUM | fallback 유지 결정 vs 권장 A, security-jwt-secret-fallback.md 중복 추적 위험, refactor README 항목 소멸 절차 미정의 (3건 WARNING) |
| Naming Collision | NONE | 신규 식별자 2종 모두 충돌 없음 |

## 권장 조치사항

1. **(WARNING 해소 — 우선)** `plan/in-progress/refactor/04-security.md` C-1 항목에 "fallback 유지 방식으로 구현 (prod 가드가 sentinel 거부 → 보안 동등)" 주석을 추가해 옵션 A 번복 근거를 추적 문서에 공식 기록한다.
2. **(WARNING 해소)** `prod-fail-closed-guards.md` 체크리스트에 "security-jwt-secret-fallback.md → plan/complete/ 이동" 항목을 추가해 PR 완료 시 중복 추적이 소멸되도록 한다.
3. **(WARNING 해소)** PR 머지 후 `plan/in-progress/refactor/04-security.md` spec 갱신 필요 목록에서 `secret-store.md placeholder 정책 (04 M-4)` 와 `1-auth.md §2.1` 항목을 strike-through 또는 target plan 참조로 닫는다.
4. **(INFO — 구현 중)** `production-guards.ts` 신규 파일에 `ALLOW_PRIVATE_HOST_TARGETS` warn 처리 주석에 "M-7 분리 결정 — spec/5-system/11-mcp-client.md §132" 출처를 기록한다.
5. **(INFO — 구현 완료 후)** `spec/5-system/1-auth.md §2.1` 에 `OAUTH_STUB_MODE` production fail-closed 노트를 추가해 SoT 공백을 해소한다.
6. **(INFO — 선택)** `spec/5-system/14-external-interaction-api.md §8.3` 노트에 "이 생성자 throw 는 assertProductionConfig 범위 밖" 1행을 추가해 두 경로 공존을 명확히 한다.
7. **(INFO — 선택)** PR 본문에 "unified-model-mgmt-5af7ee 선행 머지 권장 (1-auth.md 병행 수정)" 을 명시한다.