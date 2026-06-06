# RESOLUTION — review/code/2026/06/06/17_27_54 (PR-B2a follow-up)

ai-review RISK=LOW, Critical 0, Warning 4. 코드 변경은 e2e 테스트 + docker-compose.e2e.yml(인프라) + spec 문서뿐. 아래 disposition.

## 조치 항목

| SUMMARY # | 분류 | 판정 | 근거/조치 |
|---|---|---|---|
| W1 | Security | **부분 조치 + 검증** | spec §8.3 의 `'interaction-fallback'` 리터럴 노출 제거 — fallback 체인 서술만 남기고 "프로덕션은 반드시 INTERACTION_JWT_SECRET 또는 JWT_SECRET 설정" 명시(commit). **prod fail-closed 검증**: `interaction-token.service.ts` 는 명시적 prod throw 가드는 없으나 fallback 체인이 `INTERACTION_JWT_SECRET ?? jwt.secret ?? JWT_SECRET ?? placeholder` 라, 앱 부팅에 `JWT_SECRET` 가 필수(인증)인 프로덕션에서는 placeholder 도달 불가 — 사실상 fail-safe. 명시적 interaction-secret prod 가드 추가는 기존 동작 변경(코드)이라 본 doc/e2e PR 범위 밖 → 후속 hardening 항목. |
| W2 | Security | **수용(설계)** | docker-compose.e2e.yml ENCRYPTION_KEY 의 정적 순차 hex 패턴은 **e2e 전용·repo 공개 테스트 시크릿**(주석 "운영 절대 사용 금지"). 기존 JWT_SECRET/32-char 와 동일 패턴 — 프로덕션 시크릿 아님. 길이 교정(32→64hex)만 본 PR 목적. 랜덤/CI 인젝션은 과한 조치(미적용). |
| W3 | Documentation | **조치 완료** | spec §7.1 에 StubLlmClient 응답 계약(`[stub] received: <msg>`, no tool call→재-park, embed zero벡터, listModels stub-model) + `stub.client.ts` 링크 추가(commit). |
| W4 | Testing | **이미 충족** | "타 e2e suite 무회귀 증거 미제공" — `.claude/tools/run-test.sh e2e` 는 **전체 e2e suite 를 docker 이미지로 빌드·실행**한다. 본 PR 의 e2e 실행이 **176 pass**(park-resume 단독 아닌 전 suite) → ENCRYPTION_KEY 64-hex 교정이 AES-256 경로 포함 전 suite 무회귀임을 이미 증명. |

## impl-done(17_27_55) WARNING/INFO disposition
- impl-done W1 (impl-exec-concurrency-cap rebase): 타 worktree — plan 착수조건에 이미 명기, 본 PR 무관(리마인드만).
- impl-done W2 (pending_plans fix-webchat-sse-field-map): 본 PR 이 해당 plan 미완료 → 둘 다 in-progress, `status: partial` 적절 — 가드 통과(무조치).
- INFO I1/I2 (`.env.example` 에 INTERACTION_JWT_SECRET·LLM_STUB_MODE 추가): 운영자 가시성 개선이나 codebase 변경이라 리뷰-게이트 재무장 회피 위해 본 PR 미적용 → 후속.
- INFO I7 (MERGED stale worktree 3건 정리: harden-review-hooks #493·plan-complete-p6 #495·rag-dynamic-cut #500): 타 PR worktree — 사용자 보고.

## TEST 결과
- lint  : 통과 (eslint 0 error — e2e spec + 변경 파일)
- unit  : 무변경 (src 변경 없음 — e2e test + compose + spec 만)
- build : 통과 (nest build, 0 TS error)
- e2e   : 통과 (dockerized 전 suite 176 pass — POST /api/llm-configs 정식 경로 신규 커버 포함)

## 보류·후속 항목
- W1 후속(선택): `InteractionTokenService` 에 명시적 interaction-secret prod fail-closed 가드(LLM_STUB_MODE 패턴) 추가 검토.
- INFO I1/I2: `.env.example` 에 `INTERACTION_JWT_SECRET`·`# LLM_STUB_MODE=false` 등재.
- INFO I7: MERGED stale worktree 3건 정리(사용자 판단).
