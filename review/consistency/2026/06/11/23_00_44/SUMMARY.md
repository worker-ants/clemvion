# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**MEDIUM** — Cross-Spec Critical 1건(D4 결정과 인접 spec 직접 모순), Warning 5건(에러 코드 카탈로그 누락·명명 비일관·INTEGRATION_NOT_FOUND 잔존·SSRF 분류 충돌·DB 코드 불일치), Info 다수.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `spec/2-navigation/4-integration.md §14.1` 이 `INTEGRATION_NOT_FOUND`를 "노드 실패(throw)" 로 기술 — D4 결정(모든 IntegrationError → `port:'error'` 라우팅)과 직접 모순. 핸들러 실패도 여전히 "throw" 로 묘사 | `spec/4-nodes/4-integration/0-common.md §4.2` (D4 결정) | `spec/2-navigation/4-integration.md §14.1` line 1073 에러 코드 vocabulary 표 및 세 번째 불릿 | `4-integration.md §14.1` `INTEGRATION_NOT_FOUND` 행 영향 컬럼을 "→ `INTEGRATION_CALL_FAILED`로 흡수 — `error` 포트 라우팅 (D4)"로 수정. 세 번째 불릿을 "port:'error' + logUsage({ status:'failed' }), throw 없음 (D4 결정)"으로 교체 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `HTTP_BLOCKED` 에러 코드가 공식 에러 카탈로그에 미등재 (`EMAIL_HOST_BLOCKED`는 등재, 비대칭) | `spec/4-nodes/4-integration/1-http-request.md §6` | `spec/5-system/3-error-handling.md §1.4` HTTP 카테고리 | `3-error-handling.md §1.4` HTTP 카테고리 행에 `HTTP_BLOCKED` (SSRF 차단 — 전 인증 방식 공통, `ALLOW_PRIVATE_HOST_TARGETS` opt-out) 추가 |
| 2 | Cross-Spec + Rationale + Naming (통합) | `2-database-query.md §5.8·§6.2` 가 `INTEGRATION_NOT_FOUND`를 surface 가능 코드로 열거 — `0-common.md §4.2` SoT("해당 코드 미존재")와 직접 모순. 세 checker가 동일 위배를 독립 지적 | `spec/4-nodes/4-integration/2-database-query.md §5.8, §6.2` | `spec/4-nodes/4-integration/0-common.md §4.2` | `2-database-query.md §5.8` `INTEGRATION_NOT_FOUND` 열거 제거, §6.2 표도 교정. "integrationId 부재 → `INTEGRATION_CALL_FAILED` 흡수 (별도 코드 없음)" 비고로 통일 (1-http-request.md §5.8 준용) |
| 3 | Cross-Spec | Database Query SSRF 차단 에러 코드만 generic `INTEGRATION_CALL_FAILED` — HTTP→`HTTP_BLOCKED`, Email→`EMAIL_HOST_BLOCKED`와 비대칭. 사용자 워크플로 분기 혼란 | `spec/4-nodes/4-integration/2-database-query.md §4` SSRF callout | `1-http-request.md §4`, `3-send-email.md §6`, `3-error-handling.md §1.4` | `DB_HOST_BLOCKED` 신설 검토 (기획 결정 필요). 신설 전까지 `2-database-query.md §4`에 "향후 통일 후보 — Planned" 명시. 신설 시 `§4·§6.2` + `3-error-handling.md §1.4` 동기 갱신 |
| 4 | Convention | D4 결정이 `spec/conventions/node-output.md Principle 3.1` 의 "SSRF 차단 → Pre-flight throw" 분류 예시와 충돌 — conventions 문서 자체 미갱신. 새 노드 구현 시 잘못된 선례 참조 위험 | `spec/4-nodes/4-integration/0-common.md §4.2 D4`, `1-http-request.md §5.8` | `spec/conventions/node-output.md Principle 3.1` | `node-output.md Principle 3.1` "SSRF 차단" 예시 제거 또는 "D4 이후 Integration 노드 내 execute() SSRF 차단은 Runtime error 포트 라우팅 예외" 각주 추가 |
| 5 | Naming | `Principle 7 D1` 레이블이 `spec/conventions/node-output.md`에 anchor 없음 — dead link 가능 | `spec/4-nodes/4-integration/1-http-request.md §4 step 2` | `spec/conventions/node-output.md` | `node-output.md`에 `### Principle 7 D1` (또는 `#### D1: 명시 열거`) anchor 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/2-navigation/4-integration.md §14.1` vocabulary 표에 `HTTP_BLOCKED` 미등재 | `4-integration.md §14.1` (line 1083-1084) | vocabulary 표에 `HTTP_BLOCKED` 항목 추가 (WARNING #1과 연계) |
| 2 | Cross-Spec | `spec/5-system/4-execution-engine.md §10` Integration Handler 계약에서 `meta.duration` 폐지 / `meta.durationMs` 통일 동기화 확인 필요 | `0-common.md §6.1` (Breaking) | `4-execution-engine.md §10`에 `meta.duration` 폐지 명시 동기화 |
| 3 | Rationale | `4-integration.md §(에러 코드 표)` `INTEGRATION_NOT_FOUND` — Critical #1 조치와 함께 일괄 정정 대상 | `spec/2-navigation/4-integration.md` line 1073 | Critical #1 조치 시 병행 처리 |
| 4 | Rationale | D4 결정 — 0-common·각 노드 문서 간 일관성 양호 (DB WARNING #2 별도 처리) | `0-common.md §4.2`, 각 노드 §5.8 | 조치 불요 |
| 5 | Rationale | `1-http-request.md §8.2` 기각 대안 (B)·(C) Rationale 명문화 충분 | `1-http-request.md §8.2` | 조치 불요 |
| 6 | Rationale | `3-send-email.md §8.0` SSRF 가드 — `4-integration.md §Rationale` 상호 참조 정합 | `3-send-email.md §8.0` | 조치 불요 |
| 7 | Convention | `0-common.md §3` — "CONVENTIONS Principle 7 / §3" 표기 모호 (`§3` 이 자신의 절로 오독 가능) | `0-common.md §3` 첫 문장 | "CONVENTIONS Principle 0 · Principle 7" 로 수정 |
| 8 | Convention | `0-common.md` — `## Rationale` 섹션 미존재 (D4·meta.durationMs 결정 근거 inline 비고로만 기술) | `0-common.md` 전체 | 끝에 `## Rationale` 절 추가, §6.1·D4 결정 근거 이전 |
| 9 | Convention | `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` — wrapper `order` 행 설명이 "정렬 순서"로 잘못 채워짐 | `appstore-orders.md` 응답 표 `order` wrapper 행 | "(응답 객체)"로 정정 |
| 10 | Plan | `refactor/04-security.md` C-3: worktree 완료 표기, main 미반영 — PR 머지 시 자동 해소 | `plan/in-progress/refactor/04-security.md` C-3 | 조치 불요 |
| 11 | Plan | `spec-sync-integration-common-gaps.md` 미해소 잔여 항목(`⚠ Missing integration 배지`) — 본 PR 변경과 직교 | `0-common.md` frontmatter `pending_plans` | 조치 불요 |
| 12 | Plan | stale worktree 6건 확인 (모두 PR MERGED) | `.claude/worktrees/` | `./cleanup-worktree-all.sh --yes --force` 실행 권장 |
| 13 | Naming | `INTEGRATION_SERVICE_UNAVAILABLE` — 0-common.md 신규 추가, 모든 기존 사용처와 의미 일관 | `0-common.md §4.2` | 조치 불요 |
| 14 | Naming | `HTTP_BLOCKED` 적용 범위 확장 (전 인증 방식 공통) — 코드명 동일, 의미 확장, 충돌 없음 | `1-http-request.md §4 step 8` | 조치 불요 |
| 15 | Naming | `assertSafeOutboundUrl` / `assertSafeOutboundHostResolved` — 기존 함수명 재사용, none/custom 경로 확장 기술, 충돌 없음 | `1-http-request.md §4` | 조치 불요 |
| 16 | Naming | `CODE_MEMORY_LIMIT` — `3-error-handling.md`에서 제거, `2-code.md`와 정합은 범위 밖 | `3-error-handling.md` | Code 노드 checker 별도 확인 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | D4 결정 미반영(`4-integration.md §14.1`) CRITICAL + `HTTP_BLOCKED` 카탈로그 누락·DB SSRF 코드 비일관 WARNING 2건 |
| Rationale Continuity | LOW | `2-database-query.md §5.8·§6.2` `INTEGRATION_NOT_FOUND` 잔존 WARNING 1건 (cross-spec WARNING #2와 동일 위배, 통합) |
| Convention Compliance | LOW | `node-output.md Principle 3.1` SSRF 분류 conventions 미갱신 WARNING 1건 + INFO 3건 |
| Plan Coherence | NONE | 활성 worktree 충돌 없음. stale worktree 6건 skip |
| Naming Collision | LOW | `INTEGRATION_NOT_FOUND` 잔존 WARNING (cross-spec 통합), `Principle 7 D1` dead link 가능 WARNING |

## 권장 조치사항

1. **(BLOCK 해소 필수)** `spec/2-navigation/4-integration.md §14.1` 갱신:
   - `INTEGRATION_NOT_FOUND` 행 영향 컬럼 → "→ `INTEGRATION_CALL_FAILED`로 흡수, `error` 포트 라우팅 (D4)"
   - 세 번째 불릿("핸들러가 `IntegrationError` throw") → "port:'error' + logUsage({ status:'failed' }), throw 없음 (D4 결정)"
   - 에러 코드 표 전체에서 "노드 실패(throw)" 경로 기술 재검토

2. **(WARNING 고우선)** `spec/4-nodes/4-integration/2-database-query.md §5.8·§6.2` 수정:
   - `INTEGRATION_NOT_FOUND` 열거 제거 → "integrationId 부재 → `INTEGRATION_CALL_FAILED` 흡수 (별도 코드 없음)" 비고로 교체

3. **(WARNING)** `spec/conventions/node-output.md Principle 3.1` 갱신:
   - "SSRF 차단" 예시 제거 또는 D4 예외 각주 추가

4. **(WARNING)** `spec/conventions/node-output.md`에 `Principle 7 D1` anchor 추가 (dead link 방지)

5. **(WARNING — 기획 결정 필요)** Database Query SSRF 전용 에러 코드(`DB_HOST_BLOCKED`) 신설 여부 결정. 신설 전까지 `2-database-query.md §4`에 "향후 통일 후보 — Planned" 명시

6. **(INFO)** `spec/5-system/4-execution-engine.md §10`에 `meta.duration` 폐지 / `meta.durationMs` 통일 동기화 명시

7. **(INFO)** `spec/2-navigation/4-integration.md §14.1` vocabulary 표에 `HTTP_BLOCKED` 항목 추가 (조치 #1과 함께 처리)

8. **(INFO)** stale worktree 6건 정리: `./cleanup-worktree-all.sh --yes --force`

---

*검토 일시: 2026-06-11 | 검토 모드: --impl-done | diff-base: origin/main | scope: spec/4-nodes/4-integration/*