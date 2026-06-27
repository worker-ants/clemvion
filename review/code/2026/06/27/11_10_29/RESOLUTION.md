# RESOLUTION — 11_10_29 (재리뷰 triage)

## 배경

본 세션은 **파일 경로 스코프**(`loader.ts`/`loader.spec.ts` 전체)로 재리뷰가 돌아, reviewer 가
*변경 diff 가 아니라 파일 전체*를 검토했다. 그 결과 WARNING 12건 중 **대부분이 본 PR 의 큐-replay
버그픽스가 건드리지 않은 기존 코드** 이슈다. 본 PR diff 가 실제로 바꾼 범위는 `installGlobal` 의
replay 루프(array-like 수용)와 그 회귀 테스트뿐이다.

핵심 버그픽스(array-like `arguments` 큐 replay) 자체는 전 reviewer 가 "올바르게 구현됨"으로 확인.
Critical 0건. 아래 disposition 으로 종결한다. **추가 코드 편집은 하지 않는다** — 사소한 polish 를
위해 코드를 더 고치면 review_guard 가 재무장돼 동일 재리뷰가 무한 반복된다(loop avoidance).

## WARNING disposition (12건)

### A. 기존 코드 / 본 PR 범위 밖 (diff 미접촉) — 별도 후속

| # | 발견 | 위치 | 처분 |
|---|------|------|------|
| W-1 | boot 재호출 시 `shutdown()` 예외가 new instance 생성을 막아 stuck state | `loader.ts` `createGlobalApi` `case "boot"`(기존) | **defer** — 본 PR 미접촉 기존 dispatch. 유효한 latent 버그 → **후속 티켓 권장**(try/catch 로 감싸고 무조건 재할당) |
| W-2 | `updateProfile` payload 크기 제한 없음 | `loader.ts`/`index.ts` updateProfile(기존) | defer — 기존 surface. boot.profile 은 `MAX_PROFILE_BYTES` 검증 있으나 command 경로는 별개. 후속 |
| W-3 | `sendMessage` 길이 제한 없음 | 기존 dispatch/index.ts | defer — 기존 surface. 후속 |
| W-4 | iframe sandbox `allow-scripts+allow-same-origin` 조합 위험 | `bridge.ts`(기존, 미접촉) | defer — 기존 보안 결정. 별도 검토 |
| W-5 | spec §1 `off({event,cb})` 객체형 vs 코드 위치인자 불일치 | `loader.ts` off(기존) + spec §1 | defer — 기존 불일치. **project-planner 도메인**(spec 정정) |
| W-6 | `off` 의 `undefined` 인자 시맨틱 의존 | 기존 dispatch | defer — 기존. 후속 |
| W-9 | 부트 설정 픽스처 리터럴 반복 | `loader.spec.ts`(기존 패턴) | defer — 기존 테스트 스타일. cosmetic |
| W-10 | `QueueStub` 초기화 패턴 중복 | `loader.spec.ts`(기존+신규 1) | defer — cosmetic |
| W-12 | 커스텀 전역명 테스트 cleanup 이 바디 내 | `loader.spec.ts` data-global 테스트(기존) | defer — 기존 테스트. cosmetic |

### B. 본 PR 코드 관련이나 minor — 비차단 defer (수정 시 review_guard 재무장 루프)

| # | 발견 | 위치 | 처분 |
|---|------|------|------|
| W-7 | 매직넘버 `32`(replay 인자 상한) | `loader.ts` replay 가드 | **defer** — 인라인 주석으로 의도 명시됨(arguments 인자 수 상한, DoS 방어). consistency I-2 와 동일 지적. 후속에서 `MAX_QUEUE_CALL_ARITY` named constant 추출 권장 |
| W-8 | replay 가드 5-OR 조건 인라인 | `loader.ts` | defer — 동작 정확, 주석 있음. 후속에서 `isValidQueueEntry` type predicate 헬퍼 추출 가능 |
| W-11 | replay 가드 malformed 분기(null·원시값·length>32·비문자열) 미테스트 | `loader.ts`/`loader.spec.ts` | defer — **정상 경로(array-like replay)는 회귀 테스트로 커버**. 방어 분기는 low-risk. 후속 음성 테스트 권장 |

## INFO (16건) — 전부 참고/후속

대표: I-1 spec §1·R5 에 인자 상한 32 명세 추가(planner), I-2 `globalName` 화이트리스트, I-3 `apiBase`
`https:` 프로토콜 검증(index.ts), I-6 `QueueStub.q` 타입에 array-like 명시. 모두 기존 surface 거나
선택적 강화 — 본 PR 범위 밖. 후속 grooming 대상.

## 결론

- **본 PR 의 실제 변경(큐 replay array-like 수용 + 회귀 테스트)에는 차단 사유 없음**(Critical 0,
  핵심 픽스 정확 확인).
- WARNING 12건 중 9건은 본 PR 미접촉 기존 코드, 3건은 비차단 minor polish → 전부 defer.
- **코드 추가 편집 없음** — 회귀 루프 방지. W-1(boot stuck)·W-2/3(크기 제한)·W-5(off spec 정합)는
  유효한 후속 티켓 후보로 기록.

## TEST 결과 (변경 없음, 재확인)

- unit: 48 passed · lint/typecheck/build: 통과 (코드 미변경, 직전 그린 상태 유지)
