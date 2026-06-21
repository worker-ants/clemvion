# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 5개 checker 모두 Critical/BLOCK 없음. 단 1건의 WARNING(convention_compliance: `10-graph-rag.md §7` REST API 에러 코드 명시 불명확)과 다수 INFO 항목 존재.

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | convention_compliance | `10-graph-rag.md §7` 에러 처리 표에서 일부 에러 상황("추출 LLM 호출 일시/영구 실패", "추출 응답 JSON 파싱 실패")의 REST API 에러 코드 미정의 — 내부 큐 처리 전용인지 API 응답으로도 노출되는지 불명확 | `spec/5-system/10-graph-rag.md` §7 에러 처리 표 (line ~1305–1313) | `spec/conventions/error-codes.md §1` (`UPPER_SNAKE_CASE`), `spec/conventions/node-output.md §3.2` | §7 표에 "REST 응답 노출 여부" 열 추가 또는 주석으로 명시. REST 노출 시 `UPPER_SNAKE_CASE` 에러 코드 정의 필요. 큐 내부 처리 전용이면 현행 유지 가능. |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | cross_spec | `7-llm-client.md` frontmatter `code:` 목록에 신규 파일 `shared/utils/retry-after.ts` 미등재 | `spec/5-system/7-llm-client.md` frontmatter | 비차단. 후속 nit으로 `codebase/backend/src/shared/utils/retry-after.ts` 추가 고려 (spec이 물리 위치 규정 없어 의무 아님) |
| I-2 | rationale_continuity | spec이 `extractRetryAfterMs`의 물리 파일 위치를 무언급 — `node-output.md §3.2.1`은 의미·invariant만 규정 | `spec/conventions/node-output.md §3.2.1`, `spec/5-system/7-llm-client.md` | 현행 유지. spec 변경 불필요 |
| I-3 | rationale_continuity | `sanitizeLastErrorMessage` 선례(shared/utils/ 이동)와 완전 일관 — Rationale 연속성 정합 | `spec/5-system/7-llm-client.md` Rationale, `plan/in-progress/refactor/02-architecture.md M-9` | 현행 유지 |
| I-4 | rationale_continuity | Retry-After 파싱 정책(RFC 7231, 상한 60s, 지수 백오프)은 `withRetry`에 그대로 유지 — 함수 이동만으로 정책 불변 | `spec/data-flow/7-llm-usage.md`, `spec/5-system/7-llm-client.md` | 현행 유지 |
| I-5 | convention_compliance | `1-auth.md §1.5.4` 초대 API 에러 코드 `lower_snake_case` — `error-codes.md §3` historical-artifact 레지스트리에 정식 등재된 예외 | `spec/5-system/1-auth.md` §1.5.4 | 현행 유지. 추가 조치 불필요 |
| I-6 | convention_compliance | `10-graph-rag.md` Overview 섹션 제목에 괄호 부가어(`## Overview (제품 정의)`) — conventions에 금지 규칙 없음 | `spec/5-system/10-graph-rag.md` | `## Overview`로 단순화 검토 (강제 아님) |
| I-7 | convention_compliance | `10-graph-rag.md` Overview/본문 경계 불분명 — Overview 내부에 본문 수준 상세 포함 | `spec/5-system/10-graph-rag.md` | 장기적으로 Overview를 목표·범위 요약(1~3단락)으로 압축하고 본문에 이관 검토 |
| I-8 | convention_compliance | `10-graph-rag.md` Rationale에 도메인 용어 정의 포함 — 권장 "왜 이 결정인가" 범위 초과 | `spec/5-system/10-graph-rag.md` Rationale | 장기적으로 도메인 용어를 본문 또는 Glossary 섹션으로 이관 고려 |
| I-9 | naming_collision | `retryAfterSec`(외부 필드, 초 단위)과 `extractRetryAfterMs`(내부 헬퍼, ms 단위) 의미 일치성 — 레이어·단위·용도가 달라 실질 충돌 없음 | `spec/4-nodes/3-ai/`, `codebase/backend/src/shared/utils/retry-after.ts` | 현행 유지. ms→sec 변환(`Math.floor(ms/1000)`)은 기존 핸들러에 유지 |
| I-10 | plan_coherence | M-9 plan 체크박스 `[~]` — impl-done 완료 후 `[x]` 갱신 필요 | `plan/in-progress/refactor/02-architecture.md §M-9` | impl-done 통과 후 `[x]`로 갱신하고 커밋에 포함 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 — 모두 충돌 없음 |
| rationale_continuity | NONE | spec이 물리 파일 위치 무언급, 의미·계약·재시도 정책 전부 보존 |
| convention_compliance | LOW | W-1: `10-graph-rag.md §7` 에러 코드 REST 노출 불명확 (INFO 다수, CRITICAL 없음) |
| plan_coherence | NONE | M-9 plan Option A 정확 이행, 미해소 결정 없음, 후속 누락 없음 |
| naming_collision | NONE | 신규 식별자 충돌 없음. 파일명·함수명 모두 기존 코드베이스와 비충돌 |

---

## 권장 조치사항

1. **(BLOCK 없음 — 즉시 진행 가능)** 현재 변경(M-9)은 모든 checker를 통과. 차단 사유 없음.
2. **(W-1 해소 — 후속 권장)** `spec/5-system/10-graph-rag.md §7` 에러 처리 표에 "REST API 노출 여부" 명시. 노출되는 에러에는 `UPPER_SNAKE_CASE` 에러 코드 추가. 이는 M-9와 무관한 10-graph-rag 자체 spec 개선 항목으로 별도 task에서 처리 가능.
3. **(I-10 — 완료 직후 필수)** impl-done 완료 후 `plan/in-progress/refactor/02-architecture.md §M-9` 체크박스를 `[~]` → `[x]`로 갱신하고 커밋에 포함 (CLAUDE.md memory 규칙).
4. **(I-1 — 선택적 nit)** `spec/5-system/7-llm-client.md` frontmatter `code:` 목록에 `codebase/backend/src/shared/utils/retry-after.ts` 추가 고려 (의무 아님).