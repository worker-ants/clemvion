# RESOLUTION — PR-B2a LLM-stub fix-pass /ai-review (11_36_39)

**리뷰**: LOW, Critical 0 / Warning 7 / Info 18. 대상: 직전 리뷰(11_22_25) 의 fix-pass(main.ts 가드·stub 분기·테스트·devDep). 신규 Critical 없음 — 프로덕션 동작 영향 결함 0.

## 처리 (lint 게이트 동반 수정 포함)
fix-pass 자체의 lint 위반(CI 게이트)을 함께 수정:
- `stub.client.ts`: async 메서드 4개 `require-await` 위반 → non-async `Promise.resolve` 로 전환. `embed` `Array().fill` `no-unsafe-return` → `Array.from({length}, () => 0)` typed. 매직넘버 `STUB_ECHO_MAX_CHARS`/`STUB_EMBEDDING_DIMS` 추출(I6).
- `main.ts`·`stub.client.spec.ts`: Prettier 멀티라인(I8) auto-fix.

## Warning

| # | 처리 |
|---|------|
| W1 (SPEC-DRIFT: LLM_STUB_MODE spec 미반영) | **이월(project-planner follow-up)** — OAUTH_STUB_MODE 가 `spec/2-navigation/10-auth-flow.md` 에 기록된 것과 동형으로, `spec/5-system/` 에 e2e stub 인프라 1줄 추가가 적절. test-infra 문서라 저우선. 본 PR 의 spec(§4.x/§Rationale)은 turn-park 동작 정합(이미 완료); stub 은 테스트 전용이라 product spec 영향 없음. 추가 spec 편집은 --impl-done 루프 재유발이라 별도 처리. |
| W2 (EIA §8.3 trigger-secret 해석 모호) | **pre-existing, 본 PR 무관** — e2e 가 `InteractionTokenService.issuePerExecution` 동형 유효 토큰을 mint(테스트 정당, 서버가 전역 JWT_SECRET 검증함을 e2e 통과가 런타임 확인). spec §8.3 문구 정합은 EIA 영역 후속(project-planner). |
| W3 (process.env hot-read) | **prod-safe, minor** — main.ts 부팅 가드가 프로덕션 차단. OAUTH_STUB_MODE 선례 동일. 생성자 1회 평가 리팩토링은 후속(저위험). |
| W4 (clientCache 공유 Map stub 오염) | **prod-safe** — 프로덕션은 모드 전환 없음(부팅 고정). stub 분기를 캐시 체크 앞으로 두고 `instanceof StubLlmClient` 재사용(W5/I7 fix)으로 완화. 별도 stubCache 분리는 과설계. |
| W5 (createClient 책임 과다) | **minor, 이월** — stub 판별/캐시 분리(`resolveStubClient`)는 후속 정리. 현재 주석으로 의도 명시. |
| W6 (main.ts 가드 단위테스트 부재) | **이월** — `void bootstrap()` 즉시실행 구조라 Jest 직접 테스트 곤란(OAUTH_STUB_MODE 가드 동일 선례). `validateBootstrapEnv()` 순수함수 추출은 별도 후속(현 PR 범위 초과). |
| W7 (@types/jsonwebtoken `^9.0.0` vs 설치 9.0.10) | **무영향** — caret `^9.0.0` 이 9.0.10 을 만족(범위 내). 실 mismatch 아님. exact pin 은 선택. |

## Info (선별)
- I8(Prettier)·I6(매직넘버): **fix** (위 lint 동반 수정).
- I1/I2(e2e JWT mint·EIA jti 검증): pre-existing EIA security 확인 — W2 와 동일, 후속.
- I3/I4(compose 평문 시크릿·JWT_SECRET 중복): e2e 격리 전용. gitleaks 예외/helper 상수화 후속.
- I9(describe "— review W3" 라벨)·I10(`as never`)·I15(chat JSDoc)·I16(.env.example)·I11/I12(추가 test 케이스): minor polish, 후속.
- I13/I14(e2e race·poll 중복): 이전 리뷰 이월 follow-up.

## 빌드/테스트
- eslint clean(changed files), `nest build` 통과, `stub.client.spec`·`llm.service.spec` 통과.

## 결론
Critical 0. fix-pass 의 lint 게이트 위반 수정 완료, 잔여 warning 은 prod-safe/minor/pre-existing/test-infra-doc 로 disposition(이월·note). PR-B2a 머지 준비 완료 — 추가 코드 변경 없음.
