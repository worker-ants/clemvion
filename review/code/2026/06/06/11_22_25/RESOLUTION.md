# RESOLUTION — PR-B2a LLM-stub + e2e /ai-review (11_22_25)

**리뷰**: MEDIUM, Critical 0 / Warning 9 / Info 11. 대상: env-gated LLM_STUB_MODE stub + 멀티턴 AI e2e.
**처리**: 안전(W1)·테스트 rigor(W2/W3)·의존성(W9)·정합(W4/W5)은 즉시 fix, e2e 가독성 polish(W6~W8)는 follow-up 이월, pre-existing/minor 는 note.

## Warning

| # | 처리 |
|---|------|
| W1 (LLM_STUB_MODE 프로덕션 가드 부재) | **fix** — `main.ts` 부팅에 `NODE_ENV==='production' && LLM_STUB_MODE==='true' → throw` 가드 추가(OAUTH_STUB_MODE 동일 패턴). 운영 오설정 시 부팅 거부. |
| W2 (StubLlmClient 단위 테스트 부재) | **fix** — `stub.client.spec.ts` 신설: echo·200자 슬라이싱·빈 user·model fallback·embed·listModels·testConnection 커버. |
| W3 (LLM_STUB_MODE 분기 미검증) | **fix** — `llm.service.spec.ts` 에 `describe('LLM_STUB_MODE (createClient)')`: stub 반환+실경로 미진입, 미설정 정상경로, stub 캐시 일관성 3케이스. |
| W4 (`process.env` 직접 vs ConfigService) | **wontfix(정합)** — `OAUTH_STUB_MODE` 선례가 `main.ts`·서비스에서 `process.env` 직접 비교다. stub-mode 류는 부팅-고정 env 라 ConfigService DI 불요 — 선례와 일관 유지. |
| W5 / I7 (stub 분기가 캐시 체크 뒤 → 오염 위험) | **fix** — `createClient` 의 LLM_STUB_MODE 분기를 **캐시 체크 앞**으로 이동, stub 캐시 hit 시 재사용(`instanceof StubLlmClient`). stub 이 항상 우선. |
| W9 (`jsonwebtoken` 직접 선언 누락) | **fix** — `package.json devDependencies` 에 `jsonwebtoken: 9.0.3` + `@types/jsonwebtoken: ^9.0.0` 명시(설치본 9.0.3 일치). |
| W6 (e2e 헬퍼 4개 B1/B2a 중복) | **이월(follow-up)** — e2e 가독성 polish. 두 describe 가 동작상 독립이고 green+rigorous. 공통 헬퍼 모듈 추출은 후속 e2e 정리. |
| W7 (PR-B2a 215라인 단일 it) | **이월** — 한 멀티턴 대화 흐름(execute→park→turn×2→end)을 한 it 으로 표현. 단계별 it 분리는 후속 가독성 개선. 현재 각 단계 assert 메시지로 실패 단계 식별 가능. |
| W8 (JWT_SECRET 리터럴 2곳 중복) | **이월/note** — compose 가 SoT. 테스트가 env(JWT_SECRET) 우선 읽고 미설정 시에만 리터럴 fallback. helper 상수화는 후속. |

## Info
- I1 (e2e JWT 직접 mint → 위조 가능성): **pre-existing EIA 설계 확인 사항** — e2e 는 `InteractionTokenService.issuePerExecution` 동형의 유효 토큰을 mint(테스트 정당). 프로덕션 토큰 검증의 jti/revoke 강도는 EIA 기존 설계이며 PR-B2a 도입 아님. EIA security 후속으로 분리.
- I3 (env `=== 'true'` 만): **정합** — OAUTH_STUB_MODE 동일. note.
- I4 (stub usage log 기록): e2e 가 usage 미검증이라 허용. note.
- I5 (embed 3차원 고정): stub 주석에 "embedding e2e 추가 시 차원 조정" 명시함.
- I6 (assistant turn race window): e2e 가 durable thread 의 user turn 반영을 동기점으로 사용 + stub 즉시 반환이라 실패율 낮음. note.
- I8/I9/I10 (매직넘버·캐스팅·타입 중복): minor polish, 후속.

## 빌드/테스트
- `nest build` 통과. `stub.client.spec`·`llm.service.spec`(LLM_STUB_MODE 분기)·`execution-engine.service.spec`(회귀) 통과. 멀티턴 AI e2e dockerized 2 passed(11_22_25 대상 변경 후 e2e 영향 없음 — stub 동작 동일).

## 결론
Critical 0. PR-B2a 직접 관련 안전/테스트/의존성 warning(W1/W2/W3/W5/W9) fix, W4 선례정합 유지, e2e 가독성(W6~W8)·pre-existing(I1)·minor 는 follow-up/note. PR-B2a 머지 준비 완료.
