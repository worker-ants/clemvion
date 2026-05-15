# RESOLUTION — ContinuationBusService 부팅 race fix 리뷰 조치

대상 commit: `3220fc25 fix(engine): ContinuationBusService 부팅 race — recovery 를 onApplicationBootstrap 으로 이동`
리뷰 세션: `review/2026-05-09_14-51-54/`

## Critical
없음.

## Warning 조치 결과

| # | 항목 | 조치 | 위치 |
|---|------|------|------|
| 1 | `publisher!` 타입과 런타임 가드 모순 | `private publisher?: Redis` / `private subscriber?: Redis` 로 변경. `onModuleInit` 도 로컬 변수로 setup 한 뒤 마지막에 this 에 할당하도록 정리 — subscribe 완료 전에는 외부에 노출되지 않음 | `continuation-bus.service.ts:62-86` |
| 2 | `releaseLock` 가드 로그 레벨 불일치 (`warn`) | `acquireLock`/`publish` 와 동일하게 `logger.error` 로 통일. 기존 catch 블록의 `warn` 은 best-effort 의도로 유지하고 메서드 doc 에 명시 | `continuation-bus.service.ts:227-235` |
| 3 | 가드 로그 인젝션 위험 | `private static sanitizeForLog(value, maxLength=200)` 헬퍼 신설. `publish`/`acquireLock`/`releaseLock` 의 가드·catch 로그, `dispatch` 의 잘못된 메시지·핸들러 에러 로그까지 일관 적용 (DRY) | `continuation-bus.service.ts:223-233`, `dispatch` 호출처 |
| 4 | Plan 문서 체크박스 미갱신 | 본 RESOLUTION 작성 후 `plan/in-progress/fix-continuation-bus-bootstrap-race.md` 의 작업 항목을 모두 `[x]` 로 갱신, 모든 항목 완료 시 `git mv` 로 `plan/complete/` 이동 | `plan/in-progress/fix-continuation-bus-bootstrap-race.md` |
| 5 | Plan 문서 절대경로 참조 (`/Users/gehrig/.claude/plans/...`) | 절대경로 참조 줄 제거, 동일 내용을 plan 문서 내부에 자체적으로 요약 (배경 섹션 보강) | 동일 |
| 6 | `onApplicationBootstrap` 테스트 `releaseLock` 호출 미검증 | 기존 `onApplicationBootstrap 이 recovery 를 트리거한다` 테스트에 `expect(mockBus.releaseLock).toHaveBeenCalledWith('exec:recover:lock')` 추가. 이름도 `…lock 을 해제한다` 로 보강 | `execution-engine.service.spec.ts` `recoverStuckExecutions` describe |
| 7 | DB 오류 시 lock 누수 / 전파 동작 미테스트 | 신규 케이스 `DB 오류가 발생해도 lock 을 해제하고 오류를 전파한다` 추가. `updateExecuted.mockRejectedValueOnce` 후 `rejects.toThrow` + `releaseLock` 호출 검증 | 동일 |
| 8 | `acquireLock` JSDoc `@returns` 신규 경로 누락 | `@returns 획득 성공 시 true. 다른 인스턴스가 이미 보유 / Redis 오류 / publisher 미초기화 (라이프사이클 race) 시 false.` 로 보완. `releaseLock` 도 동일 패턴으로 `@returns` 추가 | `continuation-bus.service.ts:170-172`, `:201-204` |

## Info 조치 결과 (선택 권장 항목)

| # | 항목 | 조치 |
|---|------|------|
| 1 | publisher 비활성화 패턴 3중 반복 | `withUninitializedPublisher(fn)` 헬퍼 추출 — describe 그룹 내 cleanup 보장 일원화 |
| 4 | `onModuleInit` 핸들러 등록 회귀 가드 부재 | 기존 PR-B describe (`continuation entry points → bus.publish (PR-B)`) 가 5 타입 핸들러 동작을 이미 검증 중이라 회귀 차단됨 — 별도 카운트 단언은 불필요 판단, 추가하지 않음 |
| 5 | `mockBus.acquireLock.mockResolvedValue(true)` 중복 | 신규 `onApplicationBootstrap` 테스트에서 중복 set 제거. `beforeEach` 에서 1회 설정만 유지 |
| 6 | subscriber 가드 부재 의도 불명확 | 클래스 레벨 JSDoc 에 가드 정책 한 단락 추가 — publisher 만 가드, subscriber 는 `onModuleInit` 내부 전용임을 명시 |
| 8 | `publish` JSDoc 미초기화 경로 미언급 | "publisher 가 미초기화 (`onModuleInit` 이전 호출) 인 경우에도 throw 대신 `null` 반환 + `logger.error` 로 기록한다" 한 단락 추가 |
| 9 | `releaseLock` JSDoc `@returns` 부재 | Warning #8 조치와 함께 신설 |
| 10 | `releaseLock` 가드 `warn` 사용 이유 불명 | Warning #2 조치로 `error` 통일 — 사유 불일치 자체가 사라짐. 메서드 doc 에 best-effort 동작·publisher 미초기화는 동일 severity 로 기록한다는 정책 명시 |

## Info — 의도적으로 조치하지 않은 항목 (사유)

| # | 항목 | 사유 |
|---|------|------|
| 2 | `(status, started_at)` 복합 인덱스 | 본 PR scope 밖 (DB 마이그레이션). 별도 plan 으로 분리 검토 — 매 부팅 시 1회 실행되므로 row 수가 많아지기 전엔 즉시 영향 없음 |
| 3 | 복구 row `durationMs` NULL | 본 PR scope 밖 (recovery 로직 자체 변경 아님). PR-B 시점부터 누적된 동작이며 분석 레이어에서 처리 가능 |
| 7 | logger spy 기반 호출 검증 | publisher 가드 동작은 반환값 (false / null) 으로 충분 검증됨. 로그 spy 는 테스트 fragility 만 키움 |
| 11 | `onModuleDestroy` 후 publisher 미초기화 | shutdown 후 호출은 NestJS lifecycle 상 정상 경로 아님. 가드의 `catch` 가 closed connection 오류를 흡수해 안전 |
| 12 | `Promise.allSettled(this.inflight)` 스냅샷 타이밍 | 현재 graceful shutdown 수준에서 허용. 완전 drain 은 별도 trade-off 검토 필요 |
| 13 | Plan 문서 라인 번호 참조 구식 | Warning #4 조치에서 라인 번호 → 메서드명 단위로 모두 갱신 (별도 항목 아님) |

## TEST WORKFLOW 재수행 결과

- `npm run lint` — clean (0 warnings).
- `npm test` — 173 suites / 2903 tests pass (이번 라운드에서 `recoverStuckExecutions` describe +1, `publisher 미초기화 가드` describe +0 (헬퍼 추출만)).
- `npm run build` — clean.

## 후속

- 본 commit 와 동일 작업 plan (`plan/in-progress/fix-continuation-bus-bootstrap-race.md`) 의 모든 체크박스 갱신 + 본 RESOLUTION 작성 + TEST WORKFLOW 재통과 까지 완료한 뒤, `plan/in-progress/` → `plan/complete/` 로 `git mv`.
- DB 인덱스 / `durationMs` 누수는 별도 plan 으로 분리 (이번 fix 의 연관 이슈는 아님).
