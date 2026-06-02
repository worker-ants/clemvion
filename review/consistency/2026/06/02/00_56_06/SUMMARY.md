# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능하나 아래 WARNING 사항의 사전 처리 권장.

## 전체 위험도
**MEDIUM** — Critical 위반 없음. WARNING 5건(주로 spec 미기재·에러코드 비일관)이 구현 착수 전 spec 조정 없이 방치되면 코드-spec 비대칭이 굳어질 위험.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | install endpoint Layer 1/2 throttle 정책이 spec 미기재 — 구현 착수 전 spec-코드 비대칭 | `plan/in-progress/cafe24-install-ratelimit.md` §설계 Layer 1/2 | `spec/4-nodes/4-integration/4-cafe24.md §9.8`, `spec/2-navigation/4-integration.md §9.2` | plan step 4 spec 갱신(§9.8에 Layer 1 Redis throttle + Layer 2 실패 페널티 상수 테이블 추가)을 구현(step 6) 전에 완료 |
| W2 | Cross-Spec | install endpoint 429/rate-limit 에러 코드가 spec 에러 코드 목록에 없음 | `spec/2-navigation/4-integration.md §10.3` 에러 코드 표 | `plan/in-progress/cafe24-install-ratelimit.md` §설계 Layer 2 차단 응답 | spec 갱신 시 Layer 2 차단의 HTTP 상태코드(429 vs 404)와 에러 코드(신설 or 재사용)를 확정하고 §10.3 에 추가 |
| W3 | Cross-Spec | Redis graceful degradation 정책이 nonce cache(skip)와 throttle(in-memory fallback)이 달라 운영자 혼선 우려 | `plan/in-progress/cafe24-install-ratelimit.md` §설계 Layer 1 degradation | `spec/4-nodes/4-integration/4-cafe24.md §9.8` nonce cache degradation 단락 | spec §9.8 갱신 시 두 컴포넌트의 degradation 경로를 병렬 기술하고 그 차이의 근거를 명시 |
| W4 | Convention Compliance | `send_email` 성공 포트 id `out` vs `node-output.md` Principle 5 `port: undefined` 예시 불일치 | `spec/4-nodes/4-integration/3-send-email.md §3.2, §5.1` | `spec/conventions/node-output.md` Principle 5 port 활성화 모델 표 | 둘 중 하나를 기준으로 통일(project-planner 위임): `node-output.md` Principle 5 예시에서 `send_email` 제거 또는 `3-send-email.md §5.1`에서 `"port": "out"` 제거 |
| W5 | Convention Compliance | `database_query` SSRF 차단 에러 코드가 `INTEGRATION_CALL_FAILED` fallback 사용 — `http_request(HTTP_BLOCKED)` / `send_email(EMAIL_HOST_BLOCKED)` 와 비일관 | `spec/4-nodes/4-integration/2-database-query.md §4` SSRF 가드 박스 | `spec/4-nodes/4-integration/0-common.md §4.2`, `1-http-request.md`, `3-send-email.md` 전용 에러 코드 | 구현 전 `DB_HOST_BLOCKED` (또는 `INTEGRATION_HOST_BLOCKED`) 전용 코드 신설 여부를 project-planner 협의, 혹은 공통 코드를 `0-common.md §4.2` 에 신설 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `spec/5-system/2-api-convention.md §7` Rate Limiting 표에 install endpoint 범주 없음 | `spec/5-system/2-api-convention.md §7` | spec 갱신 시 "3rd-party 수신 엔드포인트는 도메인별 spec에서 throttle 정의" 한 줄 추가 또는 install 30/min 표 항목 추가 |
| I2 | Cross-Spec | `meta.callLimit` 타입이 `string("5/40")`, 나머지 `meta.callUsage/callRemain` 은 `number` — 소비 측 파싱 필요 | `spec/4-nodes/4-integration/4-cafe24.md §5.1` | 현 구현 범위 밖. 차후 cafe24 spec 정비 시 `{ current, limit }` 분리 또는 현행 유지를 Rationale로 명시 |
| I3 | Rationale Continuity | 기존 pod별 in-memory throttle(`@Throttle({ limit: 30, ttl: 60_000 })`)이 spec §9.8에 기록된 바 없어 Rationale 공백 — "무에서 유로" 새 결정 등장 | `spec/4-nodes/4-integration/4-cafe24.md §9.8` | spec §9.8 갱신 시 기존 in-memory throttle 출발점, 멀티 인스턴스 문제, Redis 이전 근거를 Rationale에 포함 |
| I4 | Rationale Continuity | Layer 2 "성공 302 redirect는 카운트 안 함" 정책 근거가 plan에는 있으나 spec Rationale에 없음 | `plan/in-progress/cafe24-install-ratelimit.md` §설계 Layer 2 | spec §9.8 갱신 시 실패 페널티 "성공 제외" 정책과 그 근거(정상 사용자 무영향, enumeration 정조준)를 Rationale에 명시 |
| I5 | Convention Compliance | `4-cafe24.md` `status: partial`, `pending_plans` 2개가 동일 파일 수정 예정 — 섹션은 다름 | `spec/4-nodes/4-integration/4-cafe24.md` frontmatter | 구현 전 §6 에러 코드 표 전체 확인 — `CAFE24_INSTALL_RATELIMIT` 관련 코드 기 존재 여부 확인 |
| I6 | Convention Compliance | `0-common.md §3` 참조 표기 "Principle 7 / §3" 모호 — `node-output.md` 내 "§3" 이 section3인지 Principle 3인지 불명확 | `spec/4-nodes/4-integration/0-common.md §3` | 참조 표기를 "Principle 0 (5필드 invariant) · Principle 7 (config echo)" 으로 명확히 분리 |
| I7 | Convention Compliance | `0-common.md` `## Rationale` 섹션 없음 (권장 사항) | `spec/4-nodes/4-integration/0-common.md` | 향후 `## Rationale` 추가 — D4 결정, `meta.durationMs` 통일, Usage 로깅 의무화 배경 기술 |
| I8 | Convention Compliance | `scripttags_list` `paginated` 컬럼 비어 있으나 실제 API가 페이지네이션 지원 가능 | `spec/conventions/cafe24-api-catalog/application.md` | Cafe24 공식 docs 재확인 후 지원 시 `✓` 갱신 |
| I9 | Plan Coherence | `node-output-redesign` P2(4-cafe24.md §1 pagination) 미배정, 본 plan 변경 범위(§9.8)와 섹션 다름 — 충돌 없음 | `plan/in-progress/node-output-redesign/README.md` P2 | node-output-redesign 착수 시 본 plan §9.8 변경 내용 재확인 |
| I10 | Plan Coherence | `cafe24-backlog-residual.md` A-3 체크박스 미갱신 | `plan/in-progress/cafe24-backlog-residual.md §A-3` | plan complete 단계에서 A-3 체크박스 `[x]` 갱신 |
| I11 | Naming Collision | `INSTALL_FAIL_THRESHOLD` / `INSTALL_FAIL_WINDOW_SEC` 신규 상수 — 기존 어디에도 미사용, 충돌 없음 | `plan/in-progress/cafe24-install-ratelimit.md` §설계 Layer 2 | 변경 없음. spec §9.8 관련 코드 상수 테이블 행 추가로 자연스럽게 확장 |
| I12 | Naming Collision | Redis 키 `cafe24:install:fail:{ip}` — 기존 `cafe24:install:nonce:*` 와 세 번째 세그먼트로 분리, 충돌 없음 | `codebase/backend/src/modules/integrations/cafe24-install-nonce-cache.service.ts` | 변경 없음. spec §9.8 키 목록에 nonce 키와 인접 배치하면 가독성 향상 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | install throttle 정책 3건 WARNING — Layer 1/2 상수·에러코드·degradation 이 spec 미기재 |
| Rationale Continuity | LOW | 기존 in-memory throttle Rationale 공백, degradation 차이 근거 미기재 — 모두 INFO |
| Convention Compliance | MEDIUM | `send_email` 포트 id 불일치(W4), `database_query` SSRF 에러코드 비일관(W5) — 구현 전 spec 조정 필요 |
| Plan Coherence | LOW | spec 갱신 실행 주체 모호성(W6) — 체크박스 추가로 해소 가능, worktree 경합 없음 |
| Naming Collision | NONE | 신규 식별자 3개 모두 충돌 없음 |

## 권장 조치사항

1. (W1 · W2 · W3) **구현(step 6) 전에 plan step 4 spec 갱신을 완료**: `spec/4-nodes/4-integration/4-cafe24.md §9.8` 에 Layer 1(Redis throttle 30/min), Layer 2(실패 페널티 상수 테이블, 차단 응답 코드 결정), 두 컴포넌트 degradation 경로 병렬 기술 및 Rationale 추가. `spec/2-navigation/4-integration.md §9.2/§10.3` 에도 install endpoint throttle 항목 및 에러 코드 추가.
2. (W4) **`send_email` 포트 id 불일치 해소**: A-3 범위 밖(별 노드). 후속 처리 — 아래 §보류·후속.
3. (W5) **`database_query` SSRF 전용 에러 코드 신설 여부 결정**: A-3 범위 밖(별 노드). 후속 처리 — 아래 §보류·후속.
4. (W6) **`cafe24-install-ratelimit.md` spec 갱신 단계 주체 명시**: orchestrator 직접 갱신 (본 PR 안 §9.8 documentation phase).
5. (I3 · I4) spec §9.8 갱신 시 Rationale 섹션에 기존 in-memory throttle 출발점·멀티 인스턴스 문제·Redis 이전 근거, 실패 페널티 "성공 제외" 판단 근거를 함께 기술.
6. (I10) plan complete 단계에서 `cafe24-backlog-residual.md` A-3 체크박스 `[x]` 갱신.

## 보류·후속 (A-3 범위 밖, 별 처리)

- **W4** (`send_email` 포트 id) · **W5** (`database_query` SSRF 에러코드) 는 본 A-3(cafe24 install throttle) 와 무관한 **기존 노드 spec 의 컨벤션 불일치**다. A-3 PR 로 끌어들이면 scope 혼입이므로 별도 spec 정정으로 분리한다 → `plan/in-progress/cafe24-backlog-residual.md` 후속 또는 project-planner 별 작업.

---

*생성 일시: 2026-06-02 00:56:06*
*검토 모드: --impl-prep (구현 착수 전)*
*대상 scope: `spec/4-nodes/4-integration/` + `plan/in-progress/cafe24-install-ratelimit.md`*
