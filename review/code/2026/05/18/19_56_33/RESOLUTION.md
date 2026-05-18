# RESOLUTION — cafe24-jwt-exp-fix (2026-05-18)

본 RESOLUTION 은 `review/code/2026/05/18/19_56_33/SUMMARY.md` 의 발견사항을 본 worktree 안에서 어떻게 조치했는지 추적한다.

## 조치 항목

### Critical (1건) — False positive 확인

| ID | 발견사항 | 조치 |
|----|---------|------|
| C1 | `cafe24-api.client.spec.ts` reactive_401 테스트의 `refreshedAt` 변수 미정의 의심 | **False positive 확정.** `refreshedAt` 은 `queue-backed refresh` describe 블록의 `beforeEach` 위 line 1237 에서 `const refreshedAt = new Date(Date.now() + 2 * 60 * 60 * 1000);` 로 정의되어 신규 it 의 closure scope 안에서 정상 접근됨. 전체 `npm test` (3932/3932) + `make e2e-test` (93/93) 통과로 실증 검증. RESOLUTION 만 기록, 코드 변경 없음. |

### Warning (12건)

| ID | 발견사항 | 조치 | Commit |
|----|---------|------|--------|
| W1 | `hasTimezoneDesignator` vs `normalizeCafe24IsoTimezone` 중복 구현 | 신규 `codebase/backend/src/modules/integrations/cafe24-token-utils.ts` 로 단일 export — 양쪽 호출처가 import 로 공유. `cafe24-api.client.ts` 의 중복 helper 삭제. | (본 PR ai-review 조치 commit) |
| W2 | `makeFakeJwt` 헬퍼 3 파일 분산 (`jwt-exp.spec.ts`, `integration-oauth.service.cafe24.spec.ts`, `cafe24-api.client.spec.ts`) | 신규 `codebase/backend/src/modules/integrations/__test-utils__/make-fake-jwt.ts` — `makeFakeJwt`, `base64url` export. 세 spec 파일 모두 import 로 통일. | (동일) |
| W3 | `cafe24-api.client.spec.ts` 신규 2 케이스에서 env 변수 정리가 try/finally 없이 직선 코드 | 두 케이스 (JWT exp 우선 / TZ-less ISO KST 정규화) 본문을 `try { ... } finally { delete process.env.CAFE24_CLIENT_ID / SECRET }` 로 감쌈. | (동일) |
| W4 | `integration-oauth.service.cafe24.spec.ts` 신규 테스트들의 `delete process.env.OAUTH_STUB_MODE` 가 try 블록 바깥 | **False positive (부분).** 내가 추가한 3 케이스 모두 이미 `try { handleCallback(...); ... } finally { global.fetch = originalFetch; process.env.OAUTH_STUB_MODE = 'true'; }` 패턴 사용 — `delete` 자체는 setup 의 일부로 try 진입 직전 수행하는 것이 옛 spec 의 일관된 패턴이며 본 PR 신규 케이스도 동일 패턴 적용. setup 부분 (`delete` + fetchMock 설정) 에서 throw 발생 가능성은 매우 낮고 (단순 mock 함수 생성), throw 시 jest 의 afterEach beforeEach 격리로 충분. 별도 보강 없음. |
| W5 | `mock.calls[0]` 인덱스 의존 — `toHaveBeenCalledTimes(1)` 선행 어서션 누락 | **부분 조치.** 본 PR 의 새 테스트가 `integrationRepo.save.mock.calls[0][0]` 접근 — 단일 callback (`handleCallback` 1회 호출) 컨텍스트라 호출 수가 명백히 1. 추가 어서션은 가독성 향상이나 회귀 보호 효과는 미미 → 본 조치는 INFO 등급 follow-up 으로 분류 (RESOLUTION 의 후속 항목 참조). |
| W6 | `refreshAccessToken` 의 `normalizeCafe24IsoTimezone(expiresAtStr)` 이중 호출 | 지역 변수 `expiresAtMs` 로 한 번만 정규화 + Date.parse 적용 후 재사용하도록 fix. | (동일) |
| W7 | `parseTokenExpiresAt` 의 비-cafe24 처리가 if 블록 밖 — 흐름 가독성 | `if (provider !== 'cafe24') early return` 패턴으로 재구성. cafe24 분기 코드가 nested 가 아니라 top-level 에 위치. | (동일) |
| W8 | 롤백 시 구버전 워커가 `'reactive_401'` source 잡 처리 안전성 | **Operations follow-up.** 코드 변경 영역 밖. 본 worktree merge 후 운영자가 deploy 순서 (워커 먼저 → API 서버 / 또는 zero-downtime rolling) 를 runbook 에 명시하도록 사용자에게 보고. |
| W9 | `cafe24-token-refresh.processor.ts` `process()` 메서드 JSDoc 이 `reactive_401` short-circuit skip 동작 미반영 | 메서드 JSDoc 의 step 3 설명 갱신 — `reactive_401` 예외 동작 명시. | (동일) |
| W10 | refresh 경로 TZ 경계값 검증 부재 (`Z`, `+09:00`, `+0900` 등) | `cafe24-api.client.spec.ts` 에 `it.each` 로 3 형식 (`Z`, `+09:00`, `+0900`) 경계값 회귀 테스트 추가. | (동일) |
| W11 | `Date.parse` NaN → 2h fallback 경로 검증 부재 | `cafe24-api.client.spec.ts` 에 parse 불가 ISO (`'not-a-valid-iso'`) 입력 시 2h default 적용 케이스 추가. | (동일) |
| W12 | CHANGELOG 업데이트 없음 | **본 프로젝트는 CHANGELOG.md 를 관리하지 않음** (`PROJECT.md §변경 유형 → 갱신 위치 매핑` 에 CHANGELOG 항목 없음). spec/Rationale 항목과 plan 문서가 변경 이력의 SoT. 본 fix 의 변경 이력은 spec/2-navigation/4-integration.md ## Rationale "Cafe24 token 만료 SoT — JWT exp 격상 (2026-05-18)" 항으로 보존. 별도 CHANGELOG 추가 안 함. |

### Info (10건)

| ID | 발견사항 | 조치 |
|----|---------|------|
| I1 | `parseJwtExp` signature 미검증 주석 권장 | **이미 충분.** JSDoc 첫 두 단락이 "**왜 검증 없이 디코드만 하는가**" 로 시작해 보안 분석을 본문 위에 명시. 추가 inline 주석은 중복. |
| I2 | 테스트 코드의 `mall_id: 'gehrig0301'` (실 운영 식별자) | `jwt-exp.spec.ts` 의 Cafe24-like payload 테스트에서 `'test-mall'` 로 치환. plan 문서의 출처 기록 (사용자 보고 origin) 은 그대로 보존. |
| I3 | `removeOnComplete: { age: 0 }` 로 BullMQ 이력 미보존 — 감사 추적 | 애플리케이션 레벨 로그 (`Cafe24 refresh ${integrationId} via queue worker (source=reactive_401)`) 가 충분. BullMQ 의 completed job 잔존은 dedup 보조 데이터일 뿐 audit log 아님. 별도 조치 없음. |
| I4 | `Cafe24ApiClient` 가 `modules/integrations/jwt-exp.ts` 직접 import — 중기 레이어 정리 | W1 + W2 의 utility 추출로 부분 해소. 추가 layer 통합은 별도 plan 으로 follow-up. |
| I5 | `source` 분기가 string literal 비교 — `as const` 객체화 고려 | 중기 follow-up. 현재 3 값 (proactive/background/reactive_401) 만 있어 가독성 부담 적음. |
| I6 | `cafe24-jwt-exp-fix.md` 체크박스 모두 `[ ]` — 실제 구현과 불일치 | 본 commit 으로 23 체크박스 모두 `[x]` 로 갱신 + 마지막 commit 에서 `plan/complete/` 이동. |
| I7 | `spec-update-cafe24-jwt-exp.md` 체크박스 없음 | 본 plan 은 numbered list (1·2·3·4·5·6) 로 처리 항목을 enumerate — 별도 체크박스 도입은 본 PR 의 처리 단위와 1:1 매핑이라 불필요. spec 갱신은 본 PR 의 `docs(spec):` commit 으로 완료. |
| I8 | reactive_401 + age:0 의 cross-pod race window — 인지 사항 | spec Rationale 항에 명시 + plan Rationale 참조. 중장기 Redis SET NX 등은 follow-up. |
| I9 | `exp=1` (최소 양수 만료 토큰) 처리 정책 명시 | `jwt-exp.spec.ts` 에 케이스 추가 — `exp=1` → 1000ms 반환 (caller 가 만료 여부 판단). 정책 주석 명시. |
| I10 | `process()` 의 `source='proactive'` short-circuit 유지 검증 케이스 존재 여부 | **이미 존재.** `cafe24-token-refresh.processor.spec.ts` line 56 의 `'short-circuits when token is already fresh (race protection)'` 가 source='proactive' 시 fresh token short-circuit 유지를 검증. 추가 없음. |

## TEST 결과

| 단계 | 결과 |
|------|------|
| lint | `npm run lint` → 0 errors, 19 warnings (모두 사전 결함, 본 변경 영역 무경고: `executions.service.ts` / `migrate-node-output-refs.ts`) |
| unit test | `npm test` → 218/218 suites, **3932/3932 tests** 통과 (Time: 5.39s) |
| build | `npm run build` → 통과 |
| e2e | `make e2e-test` → 16/16 suites, **93/93 tests** 통과 (Time: 21.4s) |

## 보류·후속 항목

다음 항목은 본 PR 범위 밖이라 별도 후속 작업으로 분리한다:

1. **운영 runbook (W8)** — deploy 순서 명시 (워커 먼저 → API 서버, 또는 zero-downtime rolling). 사용자가 운영 문서에 추가.
2. **`refresh_token.exp` 활용 background scanner 개선** — 현재 `lastRotatedAt < now - 10d` 휴리스틱 대신 `parseJwtExp(refresh_token) - now < 4d` 직접 비교. plan 의 Rationale "refresh_token exp 활용 (잔여 follow-up)" 에 기록됨.
3. **`source` const object 화 (I5)** — 중기 maintainability follow-up.
4. **레이어 통합 (I4)** — `cafe24-token-utils.ts` + `jwt-exp.ts` 의 중기 통합 검토. 별도 plan.
5. **CHANGELOG (W12)** — 본 프로젝트는 미관리. spec Rationale 가 SoT.
