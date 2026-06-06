---
worktree: exec-park-b2a-followup-9fdefc
started: 2026-06-06
owner: developer
---

# Plan — PR-B2a 리뷰 follow-up (LLM_STUB_MODE 문서화 · EIA §8.3 검증 · durable 컬럼 doc-sync · e2e ENCRYPTION_KEY)

> PR-B2a(#494)·PR-B2b(#501) 머지 후 정리. 원 추적: exec-park-durable-resume.md "PR-B2a follow-up". 4개 self-contained 항목 — spec doc-sync 3 + e2e infra 1.

## 항목

### ① LLM_STUB_MODE spec 문서화
- 현황: `LlmService.createClient` (llm.service.ts:78) 가 `LLM_STUB_MODE==='true'` 시 `StubLlmClient` 반환(캐시보다 우선). `main.ts:56` 부팅 가드 — `NODE_ENV=production` + `LLM_STUB_MODE=true` 면 fail-closed throw. `OAUTH_STUB_MODE` 선례. dockerized e2e(멀티턴 AI park→재개)가 실 LLM 키/호출 없이 결정적 검증에 사용. **spec 미문서화.**
- 조치: `spec/5-system/7-llm-client.md` 에 LLM_STUB_MODE 섹션 추가 — env-gated 테스트 stub, 프로덕션 fail-closed, 캐시 우선순위, 용도(e2e). (project-planner 도메인 — spec write)

### ② EIA §8.3 토큰 검증 확인 (SPEC-DRIFT 가능)
- 현황: §8.3 "JWT HS256, secret 은 **trigger 별 분리**". 그러나 `InteractionTokenService` 의 `iext_*`(per_execution) 는 **단일 글로벌 secret**(`INTERACTION_JWT_SECRET` ?? `jwt.secret` ?? `JWT_SECRET` ?? fallback) 사용 — payload `{sub:executionId, aud:'interaction', jti}`, trigger 비분리.
- 판정: "trigger 별 분리 secret" 은 `itk_*`(trigger 발급 키)에 해당하고, `iext_*`(per-execution)는 글로벌 interaction secret 이 의도된 설계로 보임. §8.3 가 두 토큰 종류를 뭉뚱그려 drift 처럼 읽힘.
- 조치: 코드 read-only 검증 → §8.3 를 `itk_*`(per-trigger secret) vs `iext_*`(글로벌 `INTERACTION_JWT_SECRET`, execution-scoped) 로 명확화. 코드가 옳으면 spec 만 갱신(SPEC-DRIFT). (project-planner)
- **범위 경계 (--impl-prep W-4/I-7)**: 본 항목은 **§8.3 secret 출처 명확화에만** 한정한다. scope 검증(SCOPE_MISMATCH status/코드명)·terminal revoke 신뢰성은 `spec-fix-eia-token-error-codes.md §2/§3` 전담 → 미수정. §6.2/§6.5(SSE field map drift)는 `fix-webchat-sse-field-map.md` followup 전담 → 미수정. notification_secret_v2(W-1)·202 응답 봉투(W-3)는 본 PR 범위 밖(별도 정리) → 미수정.

### ③ durable 컬럼 doc-sync (data-flow/3-execution.md · 0-overview.md)
- 현황: `data-flow/3-execution.md` L51(park)·L112(rehydration) 에 `conversation_thread`/`user_variables`(V084/V085) 만 언급, **`resume_call_stack`(V087, B2b) 누락**. `0-overview.md` 는 execution durable 컬럼 미언급(확인 필요).
- 조치: 3-execution.md park/rehydration 시퀀스에 `resume_call_stack` 추가(중첩 park 시 commit, frame-by-frame rehydration). 0-overview.md 에 execution durable 영속 컬럼 개요가 있으면 동기. (project-planner)

### ④ e2e ENCRYPTION_KEY(64hex) + POST /api/llm-configs 경로 커버
- 현황: `docker-compose.e2e.yml:137` `ENCRYPTION_KEY: 0123456789abcdef0123456789abcdef`(32-char=16B). `crypto.util.ts`(aes-256-gcm, `Buffer.from(key,'hex')`)는 **64-hex(32B)** 기대 → 32-char 시 `POST /api/llm-configs` 500(Invalid key length). B2a e2e 는 llm_config 행을 DB 직접 insert 로 우회(execution-park-resume.e2e-spec.ts:565~). (secret-crypto 는 SHA-256 fallback 있어 영향 없음.)
- 조치: (a) `docker-compose.e2e.yml` ENCRYPTION_KEY → 64-hex(32B) 로 교정(INTEGRATION_ENCRYPTION_KEY 동반 검토 — 동일 포맷 기대 여부 확인). e2e DB 는 ephemeral 라 키 변경 안전. (b) AI 멀티턴 e2e 의 DB-insert 우회를 `POST /api/llm-configs` 정식 경로로 교체해 그 경로를 e2e 커버. (developer 도메인 — codebase/test + infra)

## 워크플로
- spec 변경(①②③) → consistency-check --impl-prep(EIA + 7-llm-client + data-flow) 의무. spec write 는 project-planner.
- e2e(④) → TEST WORKFLOW(lint/build/e2e). ENCRYPTION_KEY 교정이 기존 e2e(174+) 무회귀 확인 + POST /llm-configs 경로 신규 커버.
- 구현 후 /ai-review + --impl-done.

## 진행 메모
- 2026-06-06 착수. origin/main `9fb4cfa7`(PR-B2b #501 머지 포함) fresh worktree. exec-park-b2b·exec-park-pr-b2 worktree 정리 완료.
