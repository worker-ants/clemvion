---
worktree: TBD
started: 2026-05-18
owner: developer
---

# Backend cleanup follow-ups — cafe24-test-spec-guard ai-review 분리분

## 배경

본 plan 은 PR `cafe24-test-spec-guard` (commits `615000a7..5dca2a2c`) 의
`/ai-review` 세션에서 발견된 항목 중 본 PR 의 핵심 변경 (spec §5.8/§9.1 +
`pending_install` 가드) 과 무관한 **사전 결함** 그룹을 별도 cleanup
plan 으로 분리한 것이다. 본 PR 의 commit C (`chore(lint): npm run lint
--fix 부수 재포맷 + unused import cleanup`) 가 누적된 prettier line-wrap
drift 를 일괄 정리하면서 그 과정에서 reviewer 가 인접 코드의 사전
결함을 함께 surface 했다.

산출 위치: `review/code/2026/05/18/17_25_35/SUMMARY.md`.

본 plan 의 항목들은 각각 독립적이고 의존성이 약해 **여러 작은 PR 로
점진 처리** 하거나 한 PR 안에서 일괄 처리해도 무방하다. 분량이 큰 항목
은 별도 worktree 로 분리 권장.

## 처리 대상 (개별 체크박스)

각 항목은 ai-review SUMMARY 의 WARNING/INFO 번호와 위치를 그대로 보존한다.

### W-1 — `encrypt-auth-config.ts` skipped 카운터 고정

- [ ] `codebase/backend/src/scripts/encrypt-auth-config.ts:76` 의
  `const skipped = 0` 을 가변 카운터로 변경하고 실제 skip 분기에서
  증가시킨다. 또는 카운터 의미가 사라졌다면 로그 출력에서 해당 항목을
  제거.
- 영향: 1회성 운영 스크립트라 회귀 위험 낮음. unit 테스트 없으면
  최소한 `node --check` 또는 dry-run 로 syntax 검증.

### W-2 / W-10 — `http-safety.spec.ts` 타입 단언 복원

- [ ] `codebase/backend/src/nodes/integration/http-request/http-safety.spec.ts`
  의 `as { lookup: jest.Mock }` 타입 단언을 lint --fix 가 제거한 경로
  복원. 또는 `jest.mocked()` 패턴으로 교체.
- 회귀 검증: `npm test -- http-safety.spec`.

### W-4 — `ExecutionEventEmitter` 유닛 테스트 신규 작성

- [ ] `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
  의 `emitExecution` / `emitNode` 위임 동작 단위 테스트 추가.
- 파일 신규: `execution-event-emitter.service.spec.ts`.
- 분량: 중간. 별도 worktree 분리 권장.

### W-5 — `WebsocketGateway` 구독 상한 분기 테스트 보강

- [ ] `codebase/backend/src/modules/websocket/websocket.gateway.ts:926~933`
  의 `MAX_SUBSCRIPTIONS_PER_CONNECTION` 초과 분기에 대한 단위 테스트.
- 파일 갱신: `websocket.gateway.spec.ts`.

### W-6 — `cors-origins.spec.ts` 테스트 격리 통일

- [ ] `codebase/backend/src/common/utils/cors-origins.spec.ts:183` 의
  `afterAll`/`process.env = originalEnv` 패턴을 `afterEach` 명시 복원
  패턴으로 통일하거나, 각 키별 명시 reset.
- 회귀 검증: `npm test -- cors-origins`.

### W-7 — `websocket.service.spec.ts` magic number 상수화

- [ ] `codebase/backend/src/modules/websocket/websocket.service.spec.ts:1089`
  의 매직 넘버 `12` 를 `MAX_SANITIZE_DEPTH + 2` 형태로 변경. 상수
  변경 시 자동 추적 가능하도록.

### W-8 — `translation.ts` 경로 불일치 TODO 추적

- [ ] `codebase/backend/src/nodes/integration/cafe24/metadata/translation.ts:2565~2567`
  의 TODO (`translation/` vs `translations/`) 를 (a) 본 plan 의
  follow-up 으로 직접 해소하거나 (b) 별도 plan 으로 이어 trackable 화.
- spec 결정이 선행되어야 할 경우 project-planner 위임.

### INFO 그룹 — 검토 및 분류

- [ ] INFO-5: HMAC prefix 충돌 테스트가 prefix 길이 상수 직접 검증
  안 함 (`cafe24-install-nonce-cache.service.spec.ts:556~581`) — prefix
  길이 변경 시 회귀 노출 위해 assertion 추가.
- [ ] INFO-6: nonce 캐시 HMAC prefix 8자 설계가 코드·spec 양쪽에
  미명시 — 프로덕션 코드에 inline 주석 + spec convention 문서 보강.
- [ ] INFO-7: Redis 장애 시 `isReplay()=false` graceful degradation 의
  보안 수준이 미명시 — spec Rationale 또는 코드 주석 보강.
- [ ] INFO-8: `assertCorsOriginsConfigured()` 가 app bootstrap 시 반드시
  호출되는지 확인. 누락이면 bootstrap 코드 또는 smoke 테스트로 보장.
- [ ] INFO-10: `sanitizePayloadForWs` 패턴 검증이 `api_key` 만 커버 —
  `password`/`token`/`secret` 등 추가 패턴 테스트 보강.
- [ ] INFO-11: `Cafe24InstallNonceCache.close()` no-Redis no-op 동작
  단위 테스트 추가.
- [ ] INFO-12: mock `as never` 캐스팅 패턴 (`cafe24-install-nonce-cache.service.spec.ts:471`,
  `integration-action-required-notifier.service.spec.ts:678~682`) 을
  `jest.Mocked<ClassName>` 패턴으로 교체.
- [ ] INFO-16: `catalog-sync.spec.ts` `resolveRepoRoot` 의 `..` 7단계
  하드코딩 경로를 더 견고한 방식으로 (예: `git rev-parse --show-toplevel`
  실행 또는 monorepo marker 파일 search).

## 처리 후

본 노트의 모든 체크박스가 `[x]` 가 되고 follow-up 추가 항목이 없으면
`plan/complete/` 로 `git mv`.

## 분리 근거

- 본 PR (`cafe24-test-spec-guard`) 의 핵심 의도는 **spec §5.8 갱신 +
  `pending_install` 가드 도입** 두 가지. 위 항목들은 그 코드 경로와
  무관한 사전 결함이라 scope 분리.
- 사용자 결정 (2026-05-18): lint --fix 부수 변경은 본 PR 에 동봉
  유지하되, reviewer 가 발견한 인접 사전 결함은 별도 plan 으로 추적.
- `review/code/2026/05/18/17_25_35/SUMMARY.md` 의 "후속 plan 으로 분리
  권장" 섹션 참고.

## 우선순위 가이드

| 그룹 | 권장 처리 시점 | 분리 가능성 |
|-----|---------------|------------|
| W-1, W-2/10 | 빠르게 (작고 안전) | 한 PR 가능 |
| W-6, W-7 | 빠르게 (작고 안전) | 위 PR 에 동봉 |
| W-4, W-5 | 중간 (테스트 신규 작성) | 별 worktree 권장 |
| W-8 | spec 결정 선행 | project-planner 위임 후 |
| INFO 그룹 | 보안·문서화 정리 시점 | 묶음 PR 또는 점진 |
