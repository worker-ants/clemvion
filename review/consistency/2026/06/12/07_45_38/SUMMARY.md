# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. WARNING 4건은 spec 문서 동기화 작업이 필요하나 차단 사유에 해당하지 않음.

## 전체 위험도
**MEDIUM** — 런타임 동작에는 이상 없으나, conventions 문서와 spec 카탈로그 간 동기화 누락 2건이 있어 향후 구현·테스트 작성 시 혼선을 유발할 수 있음.

## Critical 위배 (BLOCK 사유)

_없음._

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Convention Compliance | `send_email` 성공 포트 id `'out'` 이 Principle 5 `port: undefined` 정의와 불일치 | `spec/4-nodes/4-integration/3-send-email.md` §3.2, §5.1, §5.5 | `spec/conventions/node-output.md` Principle 5 표 (`send_email` = 단일 출력, `port: undefined`) | (a) conventions Principle 5 표에서 `send_email` 을 `port: undefined` 열 제거 후 `port: 'out'`/`port: 'error'` 이중 포트로 갱신하거나, (b) `send-email.md` 포트 id 를 `success` 로 변경해 http/db 와 통일하고 Principle 5 조정. 규약 갱신 방향이 적절. |
| W-2 | Convention Compliance / Cross-Spec (중복 통합) | `EMAIL_HOST_BLOCKED` 가 `chat-channel-adapter.md` 매핑 표에 미등재 — chat-channel 경로 분류가 spec 수준에서 불명확 | `spec/4-nodes/4-integration/3-send-email.md` §5.3, §6, §8.0 Rationale | `spec/conventions/chat-channel-adapter.md` §3.1 에러 코드 매핑 표 | `chat-channel-adapter.md` §3.1 표에 `EMAIL_HOST_BLOCKED → executionFailedInternal` 행 명시 추가. `HTTP_BLOCKED` 와 `DB_HOST_BLOCKED`(DB_* wildcard) 와 대칭 확보. |
| W-3 | Cross-Spec | `spec/5-system/3-error-handling.md` §3.2 대표 에러 코드 표의 Email 행에 `EMAIL_HOST_BLOCKED` 누락 | `spec/4-nodes/4-integration/3-send-email.md` §6, `0-common.md` §4.2 | `spec/5-system/3-error-handling.md` §3.2 Email 행 (`EMAIL_SEND_FAILED` 만 등재) | §3.2 Email 행을 `EMAIL_SEND_FAILED · EMAIL_HOST_BLOCKED` 로 갱신. §1.4 와 대칭 유지. |
| W-4 | Plan Coherence | `DB_HOST_BLOCKED` 신설이 plan 의 "(기획 결정)" 미결 항목을 합의 없이 선행 해소했으나 plan 항목이 `[ ]` 미완료 상태로 잔존 | `spec/4-nodes/4-integration/2-database-query.md` §4, §6.2, Rationale | `plan/in-progress/http-ssrf-all-auth-followups.md` `DB_HOST_BLOCKED` 신설 항목 | (1) plan 항목을 `[x]` 완료 처리하고 결정 근거 주석 추가. (2) `spec/5-system/3-error-handling.md` §1.4 Database 열에 `DB_HOST_BLOCKED` 추가(plan 조건 이행). |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `spec/5-system/3-error-handling.md` §3.2 Database 행에 `DB_HOST_BLOCKED` 이미 정상 등재 — 추가 조치 불필요 | `spec/4-nodes/4-integration/2-database-query.md` §6.2 | 확인 기록. 현 상태 유지. |
| I-2 | Cross-Spec | DB SSRF 가드가 `assertSafeOutboundHostResolved` 만 적용(URL 파싱 단계 없음) — http-request 이중 검사와 의도적 비대칭이나 미문서화 | `spec/4-nodes/4-integration/2-database-query.md` §4 | §4 SSRF callout 에 "DB 자격증명은 host 분리형이라 URL 파싱(`assertSafeOutboundUrl`) 건너뜀" 한 줄 추가. |
| I-3 | Rationale Continuity | `DB_HOST_BLOCKED` Rationale 이 chat-channel 분류 경로를 EMAIL_HOST_BLOCKED Rationale 과 상이한 방식으로 서술 — 격상 경로 가정 불일치 우려 | `spec/4-nodes/4-integration/2-database-query.md` Rationale | Rationale 에 "노드 레벨 → execution 레벨 격상 경로" 명시 또는 DB_* wildcard 직접 커버 근거 인용 추가. |
| I-4 | Rationale Continuity | `DB_HOST_BLOCKED` Rationale 에 `error-handling.md §1.4` enum 확장 검토 의무 이행 기록 누락 | `spec/4-nodes/4-integration/2-database-query.md` Rationale | "error-handling §1.4 검토 의무 이행: DB_* wildcard 가 분류표 line 388 에 존재해 신규 행 불필요" 문장 추가. |
| I-5 | Rationale Continuity | `0-common.md §7` database_query 에러 케이스 설명에 SSRF 차단(`DB_HOST_BLOCKED`) 경로 누락 — HTTP 행과 비대칭 | `spec/4-nodes/4-integration/0-common.md` §7 database_query 행 | 에러 케이스 설명에 "+ SSRF 차단(DB_HOST_BLOCKED)" 추가. |
| I-6 | Convention Compliance | `0-common.md` 에 `## Rationale` 섹션 없음 — 공통 결정 근거가 하위 문서에 분산 | `spec/4-nodes/4-integration/0-common.md` 전체 | `## Rationale` 절 추가 후 D4 에러 라우팅·`meta.durationMs` 통일·5필드 invariant 근거 정리. |
| I-7 | Convention Compliance | `2-database-query.md` 의 `## Rationale` 헤딩에 번호 없음 — 동 폴더 문서 스타일 불일치 | `spec/4-nodes/4-integration/2-database-query.md` 최하단 | `## Rationale` → `## 8. Rationale` 로 변경. |
| I-8 | Plan Coherence | `spec/5-system/3-error-handling.md` §1.4 Database 코드 카탈로그에 `DB_HOST_BLOCKED` 미등재 — plan 조건(`3-error-handling §1.4 동기`) 미이행 | `spec/4-nodes/4-integration/2-database-query.md` §6.2 | 본 worktree 에서 §1.4 Database 표에 `DB_HOST_BLOCKED` 추가 (W-4 와 연계). |
| I-9 | Naming Collision | `HTTP_TIMEOUT` 이 `error-codes.ts`·`3-error-handling.md` 에 등재되나 `1-http-request.md` §6 에러 코드표에 누락 | `spec/4-nodes/4-integration/1-http-request.md` §6 | §6 표에 `HTTP_TIMEOUT` 행 추가하거나, `HTTP_TRANSPORT_FAILED` 주석에 타임아웃 포함 명시. |
| I-10 | Naming Collision | `DB_HOST_BLOCKED` 신규 식별자 — main 브랜치 충돌 없음, `HTTP_BLOCKED`/`EMAIL_HOST_BLOCKED` 동형 패턴 준수 확인 | `spec/4-nodes/4-integration/2-database-query.md` 전체 | 현 상태 유지. |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `EMAIL_HOST_BLOCKED` 가 `error-handling.md §3.2` Email 행에 누락(W-3). DB 행·overview 정합성 유지. |
| Rationale Continuity | LOW | `DB_HOST_BLOCKED` chat-channel 격상 경로 서술이 `EMAIL_HOST_BLOCKED` 방식과 상이(I-3). enum 확장 의무 이행 기록 누락(I-4). |
| Convention Compliance | MEDIUM | `send_email` 포트 id `'out'` vs Principle 5 `port: undefined` 불일치(W-1). `EMAIL_HOST_BLOCKED` chat-channel-adapter 표 미등재(W-2). |
| Plan Coherence | LOW | `DB_HOST_BLOCKED` plan 항목 미완료 잔존(W-4). `error-handling §1.4` 조건 이행 미기록(I-8). |
| Naming Collision | LOW | 신규 식별자 충돌 없음. `HTTP_TIMEOUT` 기존 누락 발견(I-9). |

## 권장 조치사항

1. **(W-4 + I-8 PLAN 해소)** `plan/in-progress/http-ssrf-all-auth-followups.md` 의 `DB_HOST_BLOCKED` 항목을 `[x]` 완료 처리하고, `spec/5-system/3-error-handling.md` §1.4 Database 표에 `DB_HOST_BLOCKED` 추가해 plan 조건 이행.
2. **(W-2 + W-3 spec 동기화)** `spec/conventions/chat-channel-adapter.md` §3.1 에 `EMAIL_HOST_BLOCKED → executionFailedInternal` 행 추가. `spec/5-system/3-error-handling.md` §3.2 Email 행에 `EMAIL_HOST_BLOCKED` 추가.
3. **(W-1 규약 정합)** `spec/conventions/node-output.md` Principle 5 표의 `send_email` 항목을 현실 포트 구조(`'out'`/`'error'` 이중 포트)에 맞게 갱신하거나, `send-email.md` 포트 id 를 `success` 로 변경해 http/db 와 통일.
4. **(I-5 문서 보완)** `spec/4-nodes/4-integration/0-common.md` §7 database_query 에러 케이스 설명에 "+ SSRF 차단(DB_HOST_BLOCKED)" 추가.
5. **(I-3 + I-4 Rationale 보완)** `2-database-query.md` Rationale 에 chat-channel 격상 경로 및 enum 확장 의무 이행 기록 추가.
6. **(I-9 문서 보완)** `1-http-request.md` §6 에러 코드표에 `HTTP_TIMEOUT` 추가 또는 `HTTP_TRANSPORT_FAILED` 포함 주석 명시.
7. **(I-2 문서 보완)** `2-database-query.md` §4 SSRF callout 에 URL 파싱 단계 생략 이유 한 줄 추가.
8. **(I-6 + I-7 형식)** `0-common.md` 에 `## Rationale` 절 추가. `2-database-query.md` Rationale 헤딩을 `## 8. Rationale` 로 변경.