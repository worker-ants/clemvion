# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

## 전체 위험도
**HIGH** — `WORKSPACE_REQUIRED` 에러 코드가 기존 카탈로그 코드 `WORKSPACE_ID_REQUIRED` 와 의미·HTTP 상태 코드 이중 정의 충돌(CRITICAL 2건 중복 통합). 추가로 에러 코드 명명 역순·미등록 WARNING 3건과 INFO 다수.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance + Naming Collision (통합) | `WORKSPACE_REQUIRED`(401) — 공식 카탈로그 밖에서 신설. 기존 canonical `WORKSPACE_ID_REQUIRED`(400)과 동일 오류 조건을 이름·HTTP 상태 코드 모두 다르게 이중 정의. 클라이언트가 같은 조건에 두 코드를 별도 분기해야 하는 invariant 생성 | `spec/5-system/15-chat-channel.md` §5.4 응답 표; `codebase/backend/src/modules/chat-channel/chat-channel.controller.ts:58` | `spec/5-system/3-error-handling.md §1.3` `WORKSPACE_ID_REQUIRED`(400); `common/decorators/workspace.decorator.ts` | **(A, 권장)** controller 를 `WORKSPACE_ID_REQUIRED`(400)으로 통일하고 spec 표 동기화. 공용 `workspace.decorator` 가드가 경로 전역에서 처리하면 controller 중복 체크 제거 가능. **(B)** 두 발행 지점의 의미 차이가 실제로 있다면 spec 에 근거 명시 후 `error-codes.md §3` Historical-artifact 등재. 현재는 (A)가 단순·안전. |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance + Naming Collision (통합) | `INVALID_BOT_TOKEN` — 역순 명명(`CONDITION_DOMAIN`). 같은 표 내 `BOT_TOKEN_INVALID`(`DOMAIN_CONDITION`)와 동일 도메인 내 방향 불일치. codebase 이미 노출(`controller.ts:52`, 프론트엔드 i18n) — rename 은 breaking change | `spec/5-system/15-chat-channel.md` §5.4 응답 표 | `spec/conventions/error-codes.md §1` `<DOMAIN>_<CONDITION>` 권장 패턴; `spec/5-system/3-error-handling.md` | `error-codes.md §3 Historical-artifact` 레지스트리에 `INVALID_BOT_TOKEN` 등재 (rename 불가 사유 + 신규 코드 동일 패턴 금지 명시). 신규 코드는 `BOT_TOKEN_FORMAT_INVALID` 패턴으로 통일. |
| 2 | Naming Collision | `CHAT_CHANNEL_*` 에러 코드군 전체(`CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`, `CHAT_CHANNEL_SETUP_FAILED`) — 공식 카탈로그 완전 미등록. `CHAT_CHANNEL_SETUP_FAILED`(502)와 기존 `SERVICE_UNAVAILABLE` 관계 미정의 | `spec/5-system/15-chat-channel.md` §5.4 응답 표 | `spec/5-system/3-error-handling.md`; `spec/conventions/error-codes.md` | `3-error-handling.md §1` 에 `CHAT_CHANNEL_*` 코드군 항목 추가. 최소한 "Chat Channel 에러는 `spec/5-system/15-chat-channel.md §5.4` 참조" cross-link 추가. `CHAT_CHANNEL_SETUP_FAILED` vs `SERVICE_UNAVAILABLE` 관계 명시. |
| 3 | Naming Collision | `UNKNOWN_PLACEHOLDER` — `VALIDATION_ERROR.details[].code` 자리 정의, 공식 `details[].code` 카탈로그 미등록. 다른 도메인 sub-code 명명과 일관성 보장 불가 | `spec/5-system/15-chat-channel.md` Rationale R-CC-15 (c) | `spec/5-system/3-error-handling.md §2`; `spec/conventions/error-codes.md` | `3-error-handling.md §2` 의 `details[].code` 패턴 절에 `UNKNOWN_PLACEHOLDER` 를 예시로 등록. 또는 `UNKNOWN_PLACEHOLDER` 가 "client-facing 분기 코드가 아닌 debug-only"임을 spec R-CC-15 (c)에 명시하면 WARNING → INFO 로 완화 가능. |
| 4 | Rationale Continuity | §3.3 + R8 — SSE 어댑터 Redis pub/sub 이 현재 완료 사실로 기술됨. EIA R10 §(b) 는 "현재 in-memory(in-process) 직접 구독, Redis pub/sub 은 Planned"로 명시 — 사실 불일치 | `spec/5-system/15-chat-channel.md` §3.3; Rationale R8 listener #2 | `spec/5-system/14-external-interaction-api.md` Rationale R10 §(b) | §3.3 을 "SSE 어댑터는 v1 현재 in-process 직접 구독 (Redis pub/sub 은 Planned), Chat Channel 어댑터도 동일 단일 sink 직접 구독"으로 수정. R8 listener #2 를 "SseAdapter — 현재 in-process(in-memory) 직접 구독, Redis pub/sub fan-out 은 Planned (EIA R10 §b)"로 갱신. |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | §5.5 응답 본문의 `TransformInterceptor` 래핑 여부 미명시 | `spec/5-system/15-chat-channel.md` §5.5 "본문" 컬럼 | §5.5 각주에 "정상 202 응답은 전역 `TransformInterceptor` 에 의해 `{ data: { executionId } }` 래핑" 명시. provider-specific 200 OK 는 직접 JSON 응답(이미 §5.5.1에 설명됨)임을 비교 기준으로 유지. |
| 2 | Cross-Spec + Convention Compliance (통합) | `UNKNOWN_PLACEHOLDER` — `details[].code` 값이 API Convention `INVALID_FIELD` 고정과 표기 불일치 | `spec/5-system/15-chat-channel.md` R-CC-15 (c) | `spec/5-system/2-api-convention.md §5.3` 에 "도메인 전용 `details[].code` 는 `INVALID_FIELD` 우선, 의미 세분화 필요 시 명시적 확장 가능" 조항 추가 **(A)**. 또는 `UNKNOWN_PLACEHOLDER` → `INVALID_FIELD` 로 통일하고 `message` 로 의미 설명 **(B)**. |
| 3 | Cross-Spec | `spec/1-data-model.md §2.8` Trigger `config` 의 `botToken` strip 정책 교차 참조 부재 | `spec/1-data-model.md §2.8` `chatChannel` 참조 줄 | "`botToken`/`inboundSigningPlaintext` 는 입력 전용 — 응답·DB JSONB 미노출(strip), ref 만 보관 (CCH-SE-03)" 한 줄 추가 동기화. |
| 4 | Cross-Spec | `spec/conventions/chat-channel-adapter.md §1.3 ChatChannelInternalEvent` 이벤트 목록 vs CCH-AD-07 / EIA R10 동기화 확인 권장 | `spec/conventions/chat-channel-adapter.md §1.3` | 동기화 확인 후 이상 없으면 메모 제거. 충돌 발견 시 WARNING 격상. |
| 5 | Rationale Continuity | §6 EIA 관계 표 — `seq`/`X-Clemvion-Delivery` dedup 책임이 "어댑터 내장"으로 기술. EIA-NX-08/EIA-RL-01 은 외부 HTTP 클라이언트 귀속 | `spec/5-system/15-chat-channel.md` §6 EIA 관계 표 첫 행 | "어댑터가 in-process subscriber. HTTP POST+HMAC 단계 우회. `seq`/`X-Clemvion-Delivery` 는 HTTP 외부 표면 전용 — in-process 경로 미적용"으로 수정. |
| 6 | Rationale Continuity | CCH-MP-03 native modal — Convention R4 기각 대안 재도입 여부 self-contained 설명 부재 | `spec/5-system/15-chat-channel.md` §3.3 CCH-MP-03 | "본 native modal 은 R4 기각한 '전면 native UI 강제' 재도입이 아닌 R4 예고 '지원 provider + 5 fields 이하' 예외 경로를 R-CCA-8 로 실현한 것" 한 문장 인라인 추가. |
| 7 | Rationale Continuity | R2 — EIA HTTP self-call 기각 사유에서 EIA R10 기각 대안과의 연결 미명시 | `spec/5-system/15-chat-channel.md` Rationale R2 | "EIA §R10 기각 대안 — 어댑터가 엔진 내부 코드를 직접 호출하는 안도 동일 이유로 기각" cross-link 한 줄 추가. |
| 8 | Convention Compliance | frontmatter `id: chat-channel` — basename `15-chat-channel` 에서 숫자 prefix 제거, convention 명시적 예외 조항 없음 | `spec/5-system/15-chat-channel.md` frontmatter line 2 | `spec-impl-evidence.md §2.1` 에 "숫자 prefix(`N-`)는 `id:` 에서 제거 가능" 명시 추가. 현 상태 유지도 허용 범위 내. |
| 9 | Convention Compliance | Overview 내 `### 3.` 과 본문 `## 3. 처리 흐름` — 동일 문서 내 `§3` 두 위치 존재. anchor slug 는 달라 테스트 미실패이나 단일 단어 참조 모호성 | `spec/5-system/15-chat-channel.md` line 47, line 116 | Overview 내부 섹션 번호 제거(`### 요구사항 (CCH-* prefix)`) 또는 본문 섹션 번호를 `## 4.` 부터 시작. `project-planner/SKILL.md §Spec 문서 구조` 에 번호 충돌 회피 가이드 추가. |
| 10 | Plan Coherence | `auth-config-webhook-followups §2` "재검토 필요" — target spec §5.5 + R-CC-12(d)가 이미 202 silent skip 으로 확정 | `plan/in-progress/auth-config-webhook-followups.md` §2 | "spec 에서 202 silent skip 으로 이미 확정. 코드 구현은 `spec-sync-chat-channel-gaps.md §2` 에서 추적" 으로 갱신. |
| 11 | Plan Coherence | `spec-sync-chat-channel-gaps.md` frontmatter `worktree: spec-sync-audit` — branch/worktree 물리 디렉토리 모두 소멸 (stale sentinel) | `plan/in-progress/spec-sync-chat-channel-gaps.md` frontmatter | `worktree: (unstarted)` 로 정정. 미완료 체크박스 4건은 유효, 착수 시 worktree 재배정. |
| 12 | Naming Collision | `id: chat-channel` vs `id: chat-channel-adapter` — 실질 충돌 없음, 자동화 prefix match 시 혼동 가능성 낮음 | `spec/5-system/15-chat-channel.md` frontmatter; `spec/conventions/chat-channel-adapter.md` frontmatter | 현 상태 유지 가능. |
| 13 | Naming Collision | `R-CC-N` vs `R1~R9` Rationale ID 혼용 — 의도적 전략이며 target 문서 내 이유 명문화됨 | `spec/5-system/15-chat-channel.md` Rationale 섹션 | 향후 `R1~R9` → `R-CC-1~R-CC-9` 리넘버링 시 cross-link 업데이트 필요함을 plan 에 메모. |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 4건 모두 INFO. §5.5 래핑 미명시, `UNKNOWN_PLACEHOLDER` API Convention 불일치, `botToken` strip cross-link 부재, rotate Planned 필드 미정의 — 충돌 없음 |
| Rationale Continuity | LOW | WARNING 1건 (§3.3+R8 SSE Redis pub/sub 사실 오류). INFO 3건 (§6 dedup 귀속, R4 cross-link 부재, R2-R10 연결) |
| Convention Compliance | MEDIUM | CRITICAL 1건 (`WORKSPACE_REQUIRED` 미정의), WARNING 2건 (`INVALID_BOT_TOKEN` 역순, §3 번호 충돌), INFO 2건 |
| Plan Coherence | NONE | INFO 4건 전부 — 충돌 없음. worktree stale sentinel 정정 권장. |
| Naming Collision | HIGH | CRITICAL 1건 (`WORKSPACE_REQUIRED` ↔ `WORKSPACE_ID_REQUIRED` 이중 정의), WARNING 3건 (`INVALID_BOT_TOKEN` 역순, `CHAT_CHANNEL_*` 카탈로그 미등록, `UNKNOWN_PLACEHOLDER` 미등록), INFO 2건 |

> Convention Compliance 와 Naming Collision 의 CRITICAL 은 동일 `WORKSPACE_REQUIRED` 사안 — 통합 1건으로 계상.

---

## 권장 조치사항

1. **(BLOCK 해소 필수)** `WORKSPACE_REQUIRED` → `WORKSPACE_ID_REQUIRED`(400) 통일.
   - `codebase/backend/src/modules/chat-channel/chat-channel.controller.ts:58` 수정.
   - `spec/5-system/15-chat-channel.md` §5.4 응답 표 동기화.
   - 의미 차이가 실제로 있으면 spec 에 근거 명시 후 `error-codes.md §3` Historical-artifact 등재 (이 경우에도 spec 갱신 필요).

2. **(WARNING 해소 권장)** §3.3 + R8 SSE Redis pub/sub 서술 수정 — "현재 in-process 직접 구독 (Redis pub/sub Planned)" 로 EIA R10 §(b) 와 일치시킴.

3. **(WARNING 해소 권장)** `CHAT_CHANNEL_*` 에러 코드군 `3-error-handling.md §1` 등재 또는 cross-link 추가.

4. **(WARNING 해소 권장)** `INVALID_BOT_TOKEN` 을 `error-codes.md §3 Historical-artifact` 레지스트리에 등재하고 신규 코드 동일 패턴 금지 명시.

5. **(WARNING 해소 권장)** `UNKNOWN_PLACEHOLDER` 를 `3-error-handling.md §2` 의 `details[].code` 패턴 절에 등록하거나 R-CC-15 (c) 에 "debug-only" 임을 명시.

6. **(INFO 보완)** `spec/1-data-model.md §2.8` `chatChannel` 참조 줄에 `botToken` strip 정책 한 줄 추가.

7. **(INFO 보완)** `plan/in-progress/auth-config-webhook-followups.md §2` 와 `spec-sync-chat-channel-gaps.md` frontmatter `worktree` 값 정정.

8. **(INFO 보완)** §5.5 본문 컬럼 각주에 `TransformInterceptor` 래핑 여부 명시.