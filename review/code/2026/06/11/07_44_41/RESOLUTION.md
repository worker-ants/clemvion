# RESOLUTION — 04 m-4 DB Pool credential pub/sub 무효화

리뷰 세션: `review/code/2026/06/11/07_44_41/` · 전체 위험도 **LOW** · Critical 0 · Warning 8 · INFO 18.
fix 커밋: `9414ba59` (refactor(integrations): ai-review WARNING/INFO 반영).

## 조치 항목

| SUMMARY # | 카테고리 | 조치 | commit |
| --- | --- | --- | --- |
| W1 | SPEC-DRIFT | `2-database-query §4 step2` broadcast 트리거 목록을 코드와 일치하게 **rotate+remove** 로 축소 + 제외 사유 명시(`update`=name만, OAuth/`reauthorize`=풀-캐시 소비자가 OAuth 자격증명 미사용) | `9414ba59` |
| W2 | Side Effect/Arch | `DatabaseQueryHandler` invalidator 를 인스턴스 프로퍼티(`invalidatePoolOnBroadcast`)로 고정 — `Set` 동일 참조 idempotency 보장, 비싱글톤 시 중복 누적 차단 | `9414ba59` |
| W5 | Side Effect | `duplicate()` 가 `lazyConnect` 상속 → subscribe 가 connect 트리거 + error 핸들러 선등록 주석 명시 | `9414ba59` |
| W6 | Maintainability | `onModuleDestroy` 임시변수 `s` → `sub` | `9414ba59` |
| W7 | Maintainability | e2e `waitForBroadcast` 를 `while(!cond && Date.now()<deadline)` 로 — `eslint-disable no-constant-condition` 제거 | `9414ba59` |
| W8 | Maintainability | 단위 `makeProvider` 가 `provider` 만 반환(미사용 `base` 필드 제거) + 호출부 정리 | `9414ba59` |
| INFO 5 | Testing | e2e `received` 를 `beforeEach` 에서 리셋(테스트 격리 명확화) | `9414ba59` |
| INFO 6 | Testing | bus `register` idempotency(동일 참조 1회 호출) 테스트 추가 | `9414ba59` |
| INFO 7 | Testing | bus `subscribe` reject fail-safe 테스트 추가 | `9414ba59` |
| INFO 8 | Testing | bus subscriber `error` 이벤트 비크래시 테스트 추가(`emitError` helper) | `9414ba59` |
| INFO 9 | Testing | bus 빈 integrationId 메시지 무시 경계값 테스트 추가 | `9414ba59` |
| INFO 10 | Testing | e2e 단언을 `expect(received).toContain(id)` 로 — 실패 시 수신 배열+기대 id 출력 | `9414ba59` |
| INFO 13 | Documentation | `onModuleInit` JSDoc(전용 subscriber 연결·degrade·race window) 추가 | `9414ba59` |
| INFO 14 | Documentation | e2e `CHANNEL` 리터럴에 SoT(상수 위치) 주석 명시 | `9414ba59` |

## 수용(현행 유지) — 근거와 함께 처리하지 않은 항목

| SUMMARY # | 판단 | 근거 |
| --- | --- | --- |
| W3 | 유지 | `broadcastCredentialChange` 는 thin wrapper 지만 JSDoc 이 "rotate/remove 만 broadcast" 결정·제외 사유를 담는 단일 지점 — 직접 인라인하면 그 문서가 흩어진다. 의도적 유지 |
| W4 | 미적용 | `integrationCacheBus` 는 `@Global RedisModule` 제공이라 실 DI 에서 **항상 존재**. `@Optional` 은 엔진 wiring 없이 핸들러를 만드는 레거시 테스트 fixture 전용 — 프로덕션 null degrade 가 발생하지 않으므로 build() null warn 불요 |
| INFO 1·2 | 운영 | Redis 채널 평문 integrationId·UUID 미검증은 가용성(pool flush) 위험뿐 — 기밀/무결성 영향 없음. Redis 인증/내부망 격리(운영)로 차단. spec §Rationale 이 채널 payload 평문을 명시 |
| INFO 3 | scope 밖 | `invalidatePool` 의 `pool.end()` await 는 본 PR 이 추가한 게 아닌 기존 메서드. 타임아웃 래핑은 별 항목 |
| INFO 4 | 안전 | `instanceof Promise` — 코드베이스가 native Promise 만 반환. thenable 미사용 |
| INFO 11 | 설계 의도 | subscribe race window 는 fail-safe(best-effort) 설계의 일부 — `onModuleInit` JSDoc 에 명시(INFO 13 으로 반영) |
| INFO 12 | 후속 | 공용 pub/sub infra spec 추출은 **2번째 소비 핸들러(예: send-email)** 시점에 — plan `db-pool-creds-pubsub.md` §후속 메모에 추적 |
| INFO 15 | 검토 후 미적용 | `code:` 에 `integrations.service.ts` 추가는 보류 — 본 spec 은 node(database-query) 문서라 node 핸들러+bus 를 가리키는 게 정합적. publish 호출자는 `data-flow/5-integration.md` 가 커버 |
| INFO 16 | 후속 | `pools` Map 비원자성은 단일 이벤트 루프 원자성으로 현재 안전 — Worker Threads 도입 시 재검토(주석 신호는 기존 패턴 유지) |
| INFO 17·18 | 경미 | fixture 중복·remove 후 broadcast JSDoc — 현 주석(remove 호출부 "entity.id unset 가능" + broadcastCredentialChange JSDoc)으로 충분 |

## TEST 결과

- **lint**: 통과 (eslint --fix, 변경 파일 전체)
- **unit**: 통과 (backend 332 suites / 6473+ tests; bus·handler·service 신규 분기 포함 231 재확인)
- **build**: 통과 (`nest build`)
- **e2e**: 통과 (dockerized, 186 tests — `integration-cache-invalidate` A.rotate / B.remove 가 실 Redis 채널 수신 확인)

## 보류·후속 항목

- **Send Email transport invalidation** — 동일 bus 에 `invalidateTransport` register 시 SMTP 자격증명 회전도 즉시 전파. 본 PR scope 외(별 항목). `3-send-email.md` frontmatter `code:` 갱신 동반. plan 메모에 추적.
- **공용 Redis pub/sub infra spec 추출**(INFO 12) — 2번째 소비 핸들러 시점.
