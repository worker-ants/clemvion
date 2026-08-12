# 테스트(Testing) 리뷰 — `origin/main...HEAD` (backend lint `no-unsafe-*` 처분 + `--max-warnings 0`, 누적 4라운드)

## 검증 방법 (독립 재실행 — 이전 라운드 주장을 그대로 믿지 않음)

이 델타는 이미 3라운드(`11_06_12`, `12_05_39`, `12_24_14`)의 `/ai-review` 를 거쳐 testing/requirement
WARNING 4건이 전부 조치된 상태다. 새로 발견할 것이 남았는지 확인하기 위해 핵심 뮤테이션 주장을
**직접 재현**했다(코드 수정 → 테스트 실행 → 원복, 전부 이 워크트리 안에서 `git checkout --` 로
정리, `git status` 로 잔여 오염 없음 확인):

| 검증 | 방법 | 결과 |
|---|---|---|
| `idempotency.interceptor.spec.ts` 그린 | `npx jest idempotency.interceptor.spec.ts` | **11 passed** |
| 캐너리 뮤턴트 `statusCode >= 400` → `=== 400` | 소스 1줄 교체 후 재실행 | **1 failed / 10 passed** — 실패한 테스트는 정확히 `409 도 캐시되지 않는다 — R8 위반 상태를 고정하는 캐너리`. 주장과 일치 |
| 캐너리 뮤턴트 손상 JSON catch → `return of(null)` | 소스 교체 후 재실행 | **1 failed / 10 passed** — 실패한 테스트는 정확히 `손상된 캐시 JSON → 무시하고 신규 처리 + 정상 적재`. 주장과 일치 |
| `migrate-node-output-refs.spec.ts` | `npx jest migrate-node-output-refs.spec.ts` | **45 passed** |
| `eslint --max-warnings 0` | `npx eslint "{src,apps,libs,test}/**/*.ts" --max-warnings 0` | **exit 0** |
| 관련 모듈 광역 회귀 | `jest --testPathPatterns="(triggers|execution-engine|executions|chat-channel|idempotency|ai-agent|render-tool-provider|workspace-reflection-canary|migrate-node-output-refs)"` | **99 suites / 2554 passed / 1 skipped** |

두 뮤테이션 모두 RESOLUTION.md/커밋 메시지가 주장한 정확한 실패 개수(1 failed/10 passed)와
**실패한 테스트 이름까지** 일치했다 — 판별력 주장이 사실이다.

## 발견사항

- **[INFO]** `idempotency.interceptor.spec.ts` 의 "손상된 캐시 JSON" 테스트는 재적재된 값의
  **내용**을 단언하지 않는다 — 호출 횟수만 확인
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
    (`it('손상된 캐시 JSON → 무시하고 신규 처리 + 정상 적재', ...)`)
  - 상세: `expect(redis.set).toHaveBeenCalledTimes(1)` 까지만 확인하고, 같은 파일의 바로 아래
    테스트(`status`/`statusCode` 없는 응답 케이스)처럼 `JSON.parse(redis.set.mock.calls[0][1])`
    로 실제 저장된 `statusCode`/`bodyHash` 값을 대조하지 않는다. `cacheTapped` 가 손상 캐시
    fallback 경로에서도 정상 경로와 동일한 `bodyHash`/`statusCode` 를 담아 재적재하는지는
    현재 테스트 스위트로는 검증되지 않는다(예: `bodyHash` 인자가 실수로 빈 문자열로 바뀌어도
    이 테스트는 여전히 GREEN).
  - 제안: `const stored = JSON.parse(redis.set.mock.calls[0][1] as string); expect(stored.bodyHash).toBe(bodyHashOf({ a: 1 }));` 한 줄을 추가하면 이 갭이 닫힌다. 강제 수정 사유는 아니다 —
    현재도 "downstream 실행됨 + 정상 응답 반환됨 + 재적재 호출됨"이라는 핵심 계약은 고정하고 있다.

- **[INFO]** 캐리-오버 커버리지 갭 2건(`chat-channel.dispatcher.ts` 의 `logFn` 분기,
  `executions.service.ts` 의 `snapshotCache` evict) — 재확인 결과 plan 유예 판단이 여전히 유효
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts`(`logFn` 삼항식,
    `isSubFilterNull` 분기), `codebase/backend/src/modules/executions/executions.service.ts:192-199`
    (`SNAPSHOT_CACHE_MAX_ENTRIES` 도달 시 evict)
  - 상세: `grep -n "isSubFilterNull\|snapshotCache" **/*.spec.ts` 로 직접 재확인한 결과, 이번
    라운드까지도 두 자리 모두 `.handle()`/서비스 경유 테스트가 없다(`chat-channel.dispatcher.spec.ts`
    에 `execution.node.completed` standalone 함수 테스트는 있으나 `logFn` 삼항식이 실제 실행되는
    경로는 없음, `executions.service.spec.ts` 에 `snapshotCache`/`SNAPSHOT_CACHE_MAX_ENTRIES`
    문자열 매치 0건). 다만 이번 diff 는 이 두 자리에서 **타입 단언만** 추가했고(emit 바이트
    동일이 side_effect 리뷰로 실증됨) 조건·분기·evict 로직 자체는 건드리지 않았다 — 즉 이 갭은
    이 델타가 만든 것이 아니라 선재 갭이며, `plan/in-progress/backend-lint-gate-broken-on-main.md`
    §후속에 이미 등재돼 있다. 새 WARNING 사유 아님.
  - 판정: 조치 불요(이미 추적 중, 성격이 "방어 신설" 이 아니라 "타입 표기"라 이번 델타 책임 범위 밖).

- **[INFO]** `migrate-node-output-refs.spec.ts` 의 Pass 2 신규 테스트 — 직접 재실행으로 재확인,
  이전 라운드 판정과 일치
  - 위치: `codebase/backend/src/scripts/migrate-node-output-refs.spec.ts`
    (`it('rewrites single-nested output.meta.<field> → meta.<field> (Pass 2)', ...)`)
  - 상세: 45 passed 로 그린이고, "이 테스트가 없으면 어떤 pass 도 이 입력을 실행하지 않았다"는
    RESOLUTION 의 주장을 별도로 재검증하지는 않았지만(이전 라운드가 이미 뮤테이션으로 확인),
    현재 스위트 재실행으로 회귀는 없음을 확인했다.

- CRITICAL/WARNING 급 테스트 결함은 발견되지 않았다. 3라운드에 걸쳐 이미 처분된 WARNING
  4건(`HttpResponseLike` 미검증, README 오독, 잘못된 spec 인용 테스트명, 손상 JSON 미검증)의
  조치 내용을 코드 레벨에서 직접 대조한 결과 전부 정확히 반영돼 있었다.

## 격리·가독성·Mock 적절성 (참고, 발견 아님)

- 신규 테스트 7건(`캐시 히트 · 응답 형태 방어` describe) 모두 `beforeEach` 공유 상태 없이 각
  테스트 안에서 `makeRedis()`/`new IdempotencyInterceptor(...)` 를 새로 생성한다 — 테스트 간
  의존성 없음, 실행 순서 무관하게 독립 실행 가능.
- `RedisStub`(`get`/`set` 만 노출)과 `HttpResponseLike` 호환 mock(`status?`/`statusCode?`)은
  실제 인터페이스의 필요한 부분만 딱 맞게 스텁하고 있고, `responseOverride: {}` 로 "필드가 아예
  없는 응답"까지 실제로 흘려 넣어 `typeof` 방어의 실제 동작을 검증한다 — 과도한 mock 이나 실제
  동작과의 괴리 없음.
- 테스트명이 이번 라운드에서 스스로 정정한 이력(`4xx 응답은...` → `400 VALIDATION_ERROR 는...`)이
  남아 있어 spec 인용 정확도가 이름 수준까지 지켜지고 있다.

## 요약

이 델타는 3라운드에 걸쳐 이미 testing 관점 WARNING 4건이 전부 발견·조치된 상태이며, 이번
라운드에서 핵심 뮤테이션 주장(캐너리 2건) 을 코드를 직접 고쳐 재현한 결과 실패 개수·실패한
테스트 이름까지 정확히 일치했다 — 판별력 주장이 사실로 확인된다. `eslint --max-warnings 0` 은
0/0 이고, 영향받는 모듈 99개 스위트 2554건이 전부 그린이다. 새로 남은 것은 INFO 수준 둘뿐이다:
(1) 손상 캐시 JSON 재적재 테스트가 호출 횟수만 확인하고 저장된 값 내용은 단언하지 않는 얕은
지점, (2) `chat-channel.dispatcher.ts`/`executions.service.ts` 의 두 커버리지 갭이 여전히
비어 있으나 이번 델타가 만든 것이 아니라 plan 에 이미 추적 중인 선재 갭임을 재확인. 둘 다
강제 수정 사유가 아니다.

## 위험도

LOW
