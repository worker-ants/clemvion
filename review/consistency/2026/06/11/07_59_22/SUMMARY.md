# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — 아키텍처·계약 수준 충돌 없음. WARNING 5건은 모두 spec 문서 내 표현 불일치이며 코드 변경 없이 문서 수정만으로 해소 가능.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | `INTEGRATION_NOT_FOUND` 코드 — 공통 규약(흡수됨)과 노드별 spec(surface 됨) 상반 기술 | `spec/4-nodes/4-integration/1-http-request.md §5.8·§6`, `2-database-query.md §5.8·§6.2` | `spec/4-nodes/4-integration/0-common.md §4.2` | 노드별 spec 에서 `INTEGRATION_NOT_FOUND` 항목을 공통 §4.2 기술("코드 미존재, `INTEGRATION_CALL_FAILED` 로 흡수")에 일치시키거나, 공통 §4.2 에 코드를 추가 정의해 일관성 확보 |
| W-2 | Cross-Spec | DB Query SSRF 차단 경로(`INTEGRATION_CALL_FAILED` 흡수)가 §6.2 에러 코드 표에 미기재 | `spec/4-nodes/4-integration/2-database-query.md §4·§6.2` | `spec/4-nodes/4-integration/0-common.md §4.2`; `1-http-request.md §6`(`HTTP_BLOCKED`); `3-send-email.md §5.3`(`EMAIL_HOST_BLOCKED`) | `§6.2` 표에 `INTEGRATION_CALL_FAILED` 행 추가 후 "(SSRF 가드 차단 포함)" 조건 명시. 또는 `DB_HOST_BLOCKED` 전용 코드 신설로 HTTP·Email 과 대칭 |
| W-3 | Convention Compliance | `Rationale` 소제목에 날짜·태스크 코드(`refactor 04 m-4`) 포함 — 규약 외 commit 메타 혼입 | `spec/4-nodes/4-integration/2-database-query.md ## Rationale` 내 소제목 | `CLAUDE.md` "결정의 배경·근거는 해당 spec 문서 끝 `## Rationale`"; `spec/conventions/spec-impl-evidence.md` | 소제목을 `### Redis pub/sub 멀티 인스턴스 풀 캐시 무효화 채택 근거` 형태로 변경; 날짜·태스크 코드는 본문 첫 줄 맥락 주석으로 이동 |
| W-4 | Convention Compliance | `meta.rowCount` 중복 허용 여부 — `0-common.md §6`(허용)과 `2-database-query.md §5.1`("복제하지 않는다") 상충 | `spec/4-nodes/4-integration/0-common.md §6`; `2-database-query.md §5.1` | `spec/conventions/node-output.md` Principle 2 | `0-common.md §6` DB 행에서 `meta.rowCount (output.rowCount 와 중복 가능)` 괄호 문구 제거; `2-database-query.md` 의 "meta 에 복제하지 않는다" 정책을 단일 진실로 유지 |
| W-5 | Convention Compliance | `send_email` 정상 출력 포트가 `out` — 다른 Integration 노드(`success`)와 포트 네이밍 비일관 + `node-output.md` Principle 5 표기와 불일치 | `spec/4-nodes/4-integration/3-send-email.md §3.2·§5.1` | `spec/conventions/node-output.md` Principle 5(port: undefined 케이스로 분류), Principle 6(예약어 `out`) | `send_email` 정상 출력 포트를 `success` 로 통일하거나, `out` 유지 시 Principle 5 표에서 `send_email` 을 `port: 'out'` 예시로 명확히 수정하고 Principle 6 예약어 충돌 여부 검토 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | Redis pub/sub `integration:cache:invalidate` — `spec/0-overview.md §2.6` 에서 `remove` 경로 미언급으로 불완전 | `spec/0-overview.md §2.6` | "integration 자격증명 회전(rotate)·통합 삭제(remove) 시 멀티 인스턴스 캐시 무효화" 로 정밀화 |
| I-2 | Cross-Spec | Send Email transport 캐시의 `integration:cache:invalidate` 구독 여부 — `3-send-email.md` 미기술 | `spec/4-nodes/4-integration/3-send-email.md`; `2-database-query.md §4` | 구현했다면 `3-send-email.md §4` 에 pub/sub 구독 명시; 미구현이면 `2-database-query.md §4` 표현을 "향후 확장 가능" 으로 명확화 |
| I-3 | Cross-Spec | `0-common.md §4.2` 의 `INTEGRATION_CALL_FAILED` 코드 표에 NotFoundException 흡수 조건 미기재 | `spec/4-nodes/4-integration/0-common.md §4.2` | `INTEGRATION_CALL_FAILED` 행에 "integrationId 미존재/타 워크스페이스 소속 NotFoundException 흡수 포함" 조건 인라인 추가 |
| I-4 | Rationale Continuity | Rationale 에 `execution:continuation` 기각과의 도메인 구분 미명시 — 독자 혼동 소지 | `spec/4-nodes/4-integration/2-database-query.md ## Rationale` | "execution-continuation 채널 기각은 내구성 필요 사용처, 본 채널은 fail-safe best-effort invalidation 으로 목적·허용 의미론이 다르다" 취지 한 문장 추가 |
| I-5 | Rationale Continuity | cafe24 `isRefreshCapable` 제거로 "refresh_token 보유 행 격하 제외" invariant 가 spec 에서 사라질 가능성 | `spec/4-nodes/4-integration/4-cafe24.md §11.2` | `spec/2-navigation/4-integration.md` 또는 cafe24 spec §11.1 에 해당 원칙 잔존 여부 확인; 사라졌다면 현행 scanner 동작의 SoT 복원 |
| I-6 | Convention Compliance | `1-http-request.md §5` 에는 `§5.2 의도적 공백` 주석 있으나 `2-database-query.md §5` 에는 동일 주석 부재 | `spec/4-nodes/4-integration/2-database-query.md §5` | `§5.2 는 의도적으로 비어 있다` 주석 추가 (또는 양쪽 모두 제거해 일관성 통일) |
| I-7 | Convention Compliance | `cafe24-api-catalog/application/appstore-orders.md` 응답 표의 `order` wrapper 행 설명이 정렬 파라미터 설명으로 오기재 | `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` | 두 operation 의 `order` wrapper 행 설명을 `(응답 객체)` 로 수정 |
| I-8 | Convention Compliance | `2-database-query.md` frontmatter — `status: implemented` + `integration-cache-bus.service.ts` `code:` 추가 정합 확인 | `spec/4-nodes/4-integration/2-database-query.md` frontmatter | 조치 불필요. 규약과 정합 확인 완료 |
| I-9 | Plan Coherence | `3-send-email.md` 후속 bus 배선 시 frontmatter `code:` 갱신 및 plan 등재 필요 | `spec/4-nodes/4-integration/3-send-email.md`; `plan/in-progress/db-pool-creds-pubsub.md` | 현 시점 조치 불요. 후속 PR 착수 시 별도 in-progress plan 으로 격상 |
| I-10 | Naming Collision | `POOL_MAX_CONNECTIONS=5` / `POOL_IDLE_TIMEOUT_MS=30000` spec 표기가 ENV var 형식과 동일 — 하드코딩 상수임에도 혼동 가능 | `spec/4-nodes/4-integration/2-database-query.md §4` | 표기를 `POOL_MAX_CONNECTIONS(=5, 하드코딩)` 또는 "pool 크기 5, idle timeout 30s (코드 상수)" 형태로 변경. 또는 환경변수로 승격 후 `.env.example` 추가 |
| I-11 | Naming Collision | `id: system-status-api` 와 기존 `id: system-status` 유사명 — 실질 충돌 없음 | `spec/5-system/16-system-status-api.md` | 현 수준 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `INTEGRATION_NOT_FOUND` 공통·노드별 기술 상충(W-1), SSRF 차단 에러 코드 표 누락(W-2). Redis pub/sub 구조는 타 spec 과 일관됨 |
| Rationale Continuity | LOW | execution:continuation 기각과의 도메인 구분 미명시(I-4). cafe24 isRefreshCapable 제거로 invariant 소실 가능성(I-5). Critical/Warning 없음 |
| Convention Compliance | LOW | Rationale 소제목 commit 메타 혼입(W-3), meta.rowCount 정책 상충(W-4), send_email 포트 네이밍 비일관(W-5). 핵심 신규 내용은 규약 정합 |
| Plan Coherence | NONE | target 변경이 진행 중 plan 과 완전 정합. 활성 worktree 파일 경합 없음. 선행 조건 모두 해소 |
| Naming Collision | NONE | 신규 식별자(`integration:cache:invalidate`, `IntegrationCacheBus`, `IntegrationCacheInvalidator`) 충돌 없음. ENV var 혼동 표기 INFO 수준 |

## 권장 조치사항

1. **(W-1) 우선 해소** — `1-http-request.md §5.8·§6`, `2-database-query.md §5.8·§6.2` 의 `INTEGRATION_NOT_FOUND` 기술을 `0-common.md §4.2` 기준("코드 미존재, `INTEGRATION_CALL_FAILED` 로 흡수")으로 통일. 소비자 에러 처리 계약의 정확성 직결.
2. **(W-2) 우선 해소** — `2-database-query.md §6.2` 표에 `INTEGRATION_CALL_FAILED` + "(SSRF 가드 차단 포함)" 행 추가. 실제 발생 가능 에러 코드 누락 해소.
3. **(W-4) 함께 해소** — `0-common.md §6` 에서 `meta.rowCount` 중복 허용 문구 제거해 `2-database-query.md` 의 "복제하지 않는다" 정책을 단일 진실로 확립.
4. **(W-5) 검토 후 해소** — `send_email` 포트를 `success` 로 통일하거나 `node-output.md` Principle 5 표기를 현실에 맞게 수정.
5. **(W-3) 부수 해소** — `2-database-query.md ## Rationale` 소제목에서 날짜·태스크 코드 제거.
6. **(I-4 권고)** — `2-database-query.md ## Rationale` 에 execution:continuation 채널과의 도메인 구분 한 문장 추가(미래 검토자 혼동 예방).
7. **(I-5 권고)** — `4-cafe24.md §11.1` 또는 `spec/2-navigation/4-integration.md` 에서 "refresh_token 보유 행 격하 제외" 원칙 잔존 여부 확인 후 필요 시 복원.