# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**MEDIUM** — Rationale 모순 1건(Critical)과 문서 간 에러 코드 불일치 다수(WARNING 6건)가 존재. 핵심 기능(SSRF 가드 전 인증 공통화)은 spec 과 정합하나, `code.md` Rationale 모순 해소 전 merge 차단.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| C-1 | Rationale Continuity | `spec/4-nodes/5-data/2-code.md` Rationale 에 `isolated-vm` 전환이 "2026-06-11 결정으로 종결"로 기록된 반면, 이번 diff 는 본문을 `node:vm` 으로 되돌리고 `CODE_MEMORY_LIMIT` 예시를 삭제함 — Rationale 의 "기각된 대안" 으로 명시된 `node:vm` 이 현재 구현으로 재채택되는 모순 | `spec/4-nodes/5-data/2-code.md` §4, §7.1, §7.2, §5.3.3 | `spec/4-nodes/5-data/2-code.md` `## Rationale` "격리 방식 `isolated-vm` 전환 (2026-06-11)" — "기각된 대안: 현상 유지 + `node:vm`" | **옵션 A**: Rationale "본 결정으로 종결한다" 를 "결정은 완료됐으나 코드 반영은 후속 PR 예정 (현재 구현: `node:vm` — Planned)" 으로 수정. **옵션 B**: `isolated-vm` 전환이 이미 구현됐다면 §7.1 본문을 복원하고 이번 diff 되돌림. |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | `ALLOW_PRIVATE_HOST_TARGETS` 가 `spec/5-system/11-mcp-client.md §3.2` 에서 "http-request §4 전용 플래그" 처럼 서술되나 target 은 DB/Email 전반 공통 플래그임을 명시 — 독자 혼동 | `spec/4-nodes/4-integration/1-http-request.md` §4 SSRF opt-out callout | `spec/5-system/11-mcp-client.md` §3.2 production fail-closed 박스 | `(http-request §4)` → `(http-request §4 — http/db/email 공통 플래그)` 로 보완하거나 `0-common.md` 로 링크 변경 |
| W-2 | Cross-Spec | Database Query SSRF 차단 코드가 전용 코드 없이 `INTEGRATION_CALL_FAILED` fallback 으로 흡수되는 비대칭이 `spec/5-system/3-error-handling.md` 에 미반영 | `spec/4-nodes/4-integration/2-database-query.md` §4 SSRF 가드 주석 | `spec/5-system/3-error-handling.md` §5 Database Query 카테고리 (HTTP의 `HTTP_BLOCKED`, Email의 `EMAIL_HOST_BLOCKED` 와 대칭 항목 없음) | `3-error-handling.md` DB Query 행에 `INTEGRATION_CALL_FAILED` (SSRF 차단 포함 fallback) 주석 추가. 장기적으로 `DB_HOST_BLOCKED` 등 전용 코드 도입 검토 |
| W-3 | Naming Collision | `HTTP_BLOCKED` 가 `spec/5-system/3-error-handling.md` HTTP 카테고리 목록에 미등재 | `spec/4-nodes/4-integration/1-http-request.md` §6 에러 코드 표 | `spec/5-system/3-error-handling.md` §1.4 HTTP 카테고리 (`HTTP_TIMEOUT` 은 있으나 `HTTP_BLOCKED` 없음) | `3-error-handling.md` §1.4 HTTP 카테고리에 `HTTP_BLOCKED` (SSRF 차단) 행 추가 |
| W-4 | Naming Collision | `HTTP_BLOCKED` 가 `spec/conventions/chat-channel-adapter.md` §3.1 분류 표에 미등재 — fallback 처리되어 SSRF 차단 시 적절한 사용자 안내 불가 | `spec/4-nodes/4-integration/1-http-request.md` §6 | `spec/conventions/chat-channel-adapter.md` §3.1 execution-failed 분류 알고리즘 표 (`HTTP_TIMEOUT` 행은 있으나 `HTTP_BLOCKED` 없음) | `chat-channel-adapter.md` §3.1 표에 `HTTP_BLOCKED` → `executionFailedNetwork` 또는 신규 `executionFailedBlocked` 매핑 행 추가 |
| W-5 | Naming Collision | `HTTP_TIMEOUT` 이 `3-error-handling.md`·`chat-channel-adapter.md` 에 등재되나 target `1-http-request.md` §6 에는 미정의 — timeout 이 `HTTP_TRANSPORT_FAILED` 로 통합된 것인지 독립 코드인지 불일치 | `spec/4-nodes/4-integration/1-http-request.md` §6 | `spec/5-system/3-error-handling.md` line 79, `spec/conventions/chat-channel-adapter.md` line 381 | `error-codes.ts` 기준으로 `HTTP_TIMEOUT` 실체 확인 후: 없으면 두 외부 spec 에서 `HTTP_TRANSPORT_FAILED` 로 통합, 있으면 target 에 누락 보완 |
| W-6 | Convention Compliance | `1-http-request.md` §4.2 Usage 로깅 매트릭스의 `error.code` 열이 `HTTP_{status}` 추상 표현으로 실제 enum(`HTTP_4XX`·`HTTP_5XX`·`HTTP_TRANSPORT_FAILED`)을 숨겨 §6 에러 코드 표와 불일치 | `spec/4-nodes/4-integration/1-http-request.md` §4.2 | `spec/4-nodes/4-integration/1-http-request.md` §6 에러 코드 표 | 표의 `error.code` 컬럼을 `HTTP_4XX` / `HTTP_5XX` / `HTTP_TRANSPORT_FAILED` 로 구체화하거나 3xx redirect 한도 초과 행을 분리 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `spec/conventions/node-output.md` D4 주석이 `HTTP_BLOCKED` 적용 인증 방식 범위를 미명시 (none/integration/custom 공통) | `spec/conventions/node-output.md` D4 | D4 설명에 "전 인증 방식 공통 (none/integration/custom)" 주석 추가 권장 |
| I-2 | Cross-Spec | `MODEL_CONFIG_INVALID`·`MODEL_CONFIG_NOT_FOUND` 두 코드를 `3-error-handling.md` 에서 삭제 — 코드베이스 실사용 여부 미확인 | `spec/5-system/3-error-handling.md` | 코드베이스에서 해당 문자열 grep 후 사용 중이면 spec 재등록 또는 코드도 rename |
| I-3 | Cross-Spec | `3-send-email.md` §3.2 출력 포트 `out` vs `0-common.md §7` 색인의 `success` 기재 — 브랜치 이전부터 존재한 비일관성 | `spec/4-nodes/4-integration/0-common.md` §7 | `0-common.md §7` send_email 행 "§5.1 (`success`)" → "§5.1 (`out`)" 수정 권장 |
| I-4 | Rationale Continuity | `CODE_MEMORY_LIMIT` 를 `3-error-handling.md` 에서 삭제했으나 `spec/4-nodes/5-data/2-code.md` §5.3·§7.2 에 참조 잔류(dangling) | `spec/5-system/3-error-handling.md`, `spec/4-nodes/5-data/2-code.md` §5.3·§7.2 | 완전 제거 의도라면 `2-code.md` 잔류 참조도 같이 삭제; 로드맵으로 유지 의도라면 "(미구현 Planned)" 명시 |
| I-5 | Rationale Continuity | `MODEL_CONFIG_INVALID`·`MODEL_CONFIG_NOT_FOUND` 삭제 후 `spec/5-system/9-rag-search.md` 주석에 코드 참조 잔류 | `spec/5-system/9-rag-search.md` 해당 주석 | 주석 유효성 확인 후 재작성 또는 `3-error-handling.md` 에 코드 유지 |
| I-6 | Convention Compliance | `1-http-request.md` §8.2 Rationale 에 `⚠️` emoji 사용 — 다른 Integration spec 문서는 emoji 미사용 | `spec/4-nodes/4-integration/1-http-request.md` §8.2 | `⚠️` → `> 운영 영향 (breaking):` 인용구로 대체 |
| I-7 | Convention Compliance | `3-send-email.md` §5.4 `status: 'requires_integration'` 가 Principle 0 흐름 제어 enum 에 없는 값 — 예외 케이스임을 비고에서 명확히 해소 미흡 | `spec/4-nodes/4-integration/3-send-email.md` §5.4 | §5.4 비고에 "Principle 0 enum 과 다른 DI 진단 신호" 설명 추가 또는 `meta.integrationStub` 으로 이동 검토 |
| I-8 | Convention Compliance | `0-common.md` frontmatter `id: common` — basename `0-common` 과 불일치 (`integration-common` 으로 구체화 권장) | `spec/4-nodes/4-integration/0-common.md` frontmatter | `id: integration-common` 으로 구체화 (규약 가드 차단 아님, 권장) |
| I-9 | Plan Coherence | `plan/in-progress/refactor/04-security.md` C-3 항목이 `- [ ] 미착수` 로 남아 있음 — 구현 완료 후 완료 표시 갱신 필요 | `plan/in-progress/refactor/04-security.md` §C-3 | C-1·C-2 와 동일 형식으로 완료 표시 + `(2026-06-11, worktree http-ssrf-all-auth)` 참조 추가 |
| I-10 | Plan Coherence | `node-output-redesign/http-request.md` P3 legacy 잔재 항목이 target 범위와 무관하게 여전히 미착수 | `plan/in-progress/node-output-redesign/http-request.md` §P3 | 추적 메모에 "target spec 에서 deprecation 의도 유지 확인 (2026-06-11)" 추가 권장 |
| I-11 | Plan Coherence | stale worktree 4건(`prod-fail-closed-guards`·`auth-refresh-rotation-atomic`·`unified-model-mgmt-pr4`·`code-node-isolated-vm`) 모두 MERGED — 정리 권장 | `.claude/worktrees/` 해당 4개 폴더 | `./cleanup-worktree-all.sh --yes --force` 실행 권장 |
| I-12 | Naming Collision | `id: common` frontmatter 가 전 카테고리 `0-common.md` 에서 중복 사용 — 전역 유일성 강제 계획 시 `integration-common` 으로 통일 검토 | `spec/4-nodes/4-integration/0-common.md` frontmatter | 즉각 조치 불필요, 도구 수준 전역 id 강제 시 재검토 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | SSRF 가드 확장 정합; DB SSRF 코드 비대칭(`3-error-handling.md` 미반영)·`11-mcp-client.md` 플래그 서술 협소 2건 WARNING |
| Rationale Continuity | **MEDIUM** | `code.md` Rationale 의 `isolated-vm` 전환 결정과 본문 `node:vm` 역행 — Critical 모순. `CODE_MEMORY_LIMIT`·에러 코드 dangling 참조 INFO 2건 추가 |
| Convention Compliance | LOW | SSRF 핵심 변경은 규약 준수; Usage 로깅 표 error.code 불완전·send_email `requires_integration` Principle 0 해명 미흡 2건 WARNING |
| Plan Coherence | NONE | active worktree 충돌 없음; `04-security.md` C-3 완료 표시·stale worktree 정리 INFO |
| Naming Collision | **MEDIUM** | `HTTP_BLOCKED` 3-error-handling·chat-channel-adapter 미등재, `HTTP_TIMEOUT` 역방향 불일치 3건 WARNING |

---

## 권장 조치사항

1. **[BLOCK 해소 필수] `spec/4-nodes/5-data/2-code.md` Rationale 동기화**: `isolated-vm` 전환이 이번 PR scope 외라면 Rationale "본 결정으로 종결한다" 를 "결정됨, 구현 미완료 — 현재 구현: `node:vm` (Planned)" 으로 수정. `isolated-vm` 이 실제 구현됐다면 §7.1 본문·`CODE_MEMORY_LIMIT` 예시를 복원하고 diff 를 재검토.
2. **[BLOCK 해소 후 권장] `spec/5-system/3-error-handling.md` §1.4**: `HTTP_BLOCKED` (SSRF 차단) 행 추가, `HTTP_TIMEOUT` 독립 코드 여부 확인 후 `HTTP_TRANSPORT_FAILED` 통합 또는 target spec 보완.
3. **[권장] `spec/conventions/chat-channel-adapter.md` §3.1**: `HTTP_BLOCKED` → execution-failed 분류 매핑 행 추가.
4. **[권장] `spec/5-system/11-mcp-client.md` §3.2**: `ALLOW_PRIVATE_HOST_TARGETS` 서술을 "http/db/email 공통 플래그" 로 보완.
5. **[권장] `spec/5-system/3-error-handling.md` Database Query 행**: `INTEGRATION_CALL_FAILED` (SSRF 차단 포함 fallback) 주석 추가, 장기 `DB_HOST_BLOCKED` 전용 코드 도입 백로그 등록.
6. **[권장] `spec/4-nodes/4-integration/1-http-request.md` §4.2**: Usage 로깅 매트릭스 `error.code` 열을 구체적 enum 값으로 교체.
7. **[추적] `plan/in-progress/refactor/04-security.md` C-3**: 완료 표시 갱신.
8. **[추적] stale worktree 4건 정리**: `./cleanup-worktree-all.sh --yes --force`.

---

*생성: consistency-check 통합 요약 에이전트, 2026-06-11*