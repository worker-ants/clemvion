# 유지보수성(Maintainability) Review

## 중점 확인: W12(취소 종결 8줄 블록 2중 복제) 및 신규 스로틀(Map + 상수 + 옵션 인자)

### W12 — `finalizeCancelledExecution` 헬퍼 추출로 완전 해소 (확인됨)

`codebase/backend/src/modules/execution-engine/execution-engine.service.ts`:

- 헬퍼 정의: `finalizeCancelledExecution(savedExecution, logContext)` (4568~4581줄). `finishedAt`/`durationMs` 방어적 채움 → `updateExecutionStatus`(guarded UPDATE) → `emitCancellationEvent` 3단계로, 이전에 두 catch 블록에 손으로 복제됐던 8줄이 단일 지점으로 수렴했다.
- 호출부 1 — `runExecution` catch (4530줄): `await this.finalizeCancelledExecution(savedExecution, 'runExecution');`
- 호출부 2 — `finalizeResumedExecutionOutcome` (2646~2649줄): `await this.finalizeCancelledExecution(savedExecution, 'finalizeResumedExecutionOutcome');`
- 두 호출부 모두 유일한 차이(`logContext` 로그 태그)만 인자로 넘기고 나머지 로직은 완전히 공유 — 복제가 남아있지 않음.
- 네이밍·구조가 이미 같은 파일에 존재하는 자매 헬퍼 `finalizeFailedExecution`(4593~4637줄, `finalize<Status>Execution` 패턴)과 일관되어 컨벤션 준수도 좋다. JSDoc(4548~4567줄)이 "헬퍼 추출 전에는 이 한 값 차이 때문에 8줄 블록이 손으로 복제됐다"고 배경까지 명시해 재발 방지 근거도 남겼다.

**결론**: W12 는 재발 여지 없이 해소됨. 추가 조치 불필요.

### 신규 스로틀 — `assertExecutionNotCancelled` 복잡도에 미친 영향 (허용 가능한 수준)

`execution-engine.service.ts`:

- 상수 `CONTAINER_CANCEL_CHECK_THROTTLE_MS = 250`(550줄, `private static readonly`) — 매직 넘버를 즉시 이름 있는 상수로 승격했고, 네이밍(`_MS` suffix, SCREAMING_SNAKE)도 같은 클래스의 기존 상수(`STUCK_RECOVERY_STALE_MS`, `MAX_MESSAGE_LENGTH` 등, 649/2939/4897줄)와 일관된다.
- Map `containerCancelCheckedAtMs`(540줄) — 기존에 이미 존재하던 동일 패턴(`segmentStartMs`, 525줄: executionId → 시각 Map, in-memory-only, 종료 지점에서 delete)을 그대로 재사용한 설계라 코드베이스 관용구에서 벗어나지 않는다.
- `assertExecutionNotCancelled(executionId, opts?: { throttle: boolean })`(7904~7932줄) 본문은 약 25줄, 분기는 `if (opts?.throttle)`(스킵 판정) → DB 조회 → `if (opts?.throttle)`(캐시 갱신) → `if (row?.status !== CANCELLED)`(취소 판정) 4개로, 순환 복잡도가 눈에 띄게 높아지지 않았다. 옵션이 boolean 리터럴 포지셔널 인자가 아니라 named object property(`{ throttle: true }`)라 호출부에서 의도가 명확히 드러나 "boolean trap" 스멜은 회피했다.
- 호출부는 컨테이너 아이템 경계(`executeContainerBody`, 6515줄)만 `{ throttle: true }` 를 넘기고, 노드 경계 4곳(1663/3752/4284/7155줄 — `runExecution`/`executeInline`/`runNodeDispatchLoop`/`executeParallelBranchBody`)은 옵션 없이 기존과 동일하게 매번 조회한다 — JSDoc(7895~7902줄)의 주장과 실제 호출부가 정확히 일치.
- Map 정리는 `finalizeRehydrationCleanup`(2670줄)과 `runExecution` finally(4544줄) 두 지점에서 이뤄지며, 이 역시 `segmentStartMs` 가 이미 따르던 정리 패턴을 그대로 답습한다.
- 테스트: 스로틀 창을 실제로 넘겨 취소가 관측되는지(C3, `execution-engine.service.spec.ts:10006` 부근)와, 짧은 간격 내 반복 호출이 실제 DB 조회 1회로 스로틀되는지(W10, `:10224` 부근)를 `Date.now` 스파이로 검증 — 스로틀 도입이 회귀 테스트 커버리지 없이 들어온 게 아니다.

**결론**: 스로틀 도입이 `assertExecutionNotCancelled` 를 과도하게 복잡하게 만들었다고 보지 않는다. 기존 클래스 관용구(Map 기반 in-memory 캐시 + JSDoc 명시 + 종료 지점 cleanup)를 그대로 재사용했고, 옵션 인자도 named-property 형태로 스멜을 회피했다.

## 발견사항

- **[INFO]** `opts?.throttle` 조건이 함수 내에서 두 번 반복 평가됨(스킵 판정용 1회, 캐시 타임스탬프 갱신 여부 판단용 1회)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7908`, `:7922` (`assertExecutionNotCancelled`)
  - 상세: `if (opts?.throttle)` 블록이 함수 시작부(스킵 여부 판정)와 DB 조회 직후(캐시 갱신 여부 판정) 두 곳에 나타난다. 버그는 아니며 두 지점이 15줄 이내로 가까워 drift 위험은 낮지만, 같은 조건식을 두 번 쓰는 것은 약간의 가독성 비용이다.
  - 제안: 함수 시작부에서 `const useThrottle = opts?.throttle === true;` 로 한 번만 평가해 재사용하면 조건이 하나로 통합돼 약간 더 읽기 쉬워진다. 필수 개선은 아님.

- **[INFO]** `opts?: { throttle: boolean }` 는 사실상 boolean flag parameter로, 함수가 "항상 실제 체크" 와 "스로틀 적용 체크" 두 변형된 동작을 겸한다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7904~7907` (`assertExecutionNotCancelled` 시그니처)
  - 상세: 다만 (a) named object property 형태라 호출부(`{ throttle: true }`, 6515줄)에서 의도가 명시적으로 드러나고, (b) 로그·throw·DB select 로직이 스로틀 여부와 무관하게 완전히 동일해 별도 함수로 쪼개면 그 부분이 오히려 중복된다. 현재 "단일 함수 + opt-in 옵션" 구조가 합리적 트레이드오프로 판단되며, 강제 개선 사항은 아니다.
  - 제안: 없음(현행 유지 권장).

- **[INFO]** `containerCancelCheckedAtMs` Map 은 두 개의 독립된 종료 경로(`finalizeRehydrationCleanup` 2670줄, `runExecution` finally 4544줄)에서 각각 `delete` 되어야 정리된다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2670`, `:4544`
  - 상세: 향후 세 번째 종료 경로가 추가되면 정리 누락 시 executionId 당 완료 후에도 Map 항목이 잔존하는 슬로우 릭 가능성이 있다. 다만 이는 이번 변경이 새로 만든 위험이 아니라, 같은 클래스에 이미 존재하던 `segmentStartMs` Map(525줄)이 따르던 정리 패턴을 그대로 답습한 것 — 일관성 측면에서는 오히려 기존 관용구를 잘 따른 것으로 평가한다.
  - 제안: 없음(참고용 기록). 추후 세 번째 종료 경로를 추가하는 PR 이 있다면 두 Map(`segmentStartMs`, `containerCancelCheckedAtMs`) 정리를 함께 챙기도록 상기.

## 요약

이번 라운드의 두 핵심 확인 대상은 모두 양호하다. W12(취소 종결 8줄 블록 2중 복제)는 `finalizeCancelledExecution` 헬퍼로 완전히 해소됐고, 기존 자매 헬퍼 `finalizeFailedExecution` 과 네이밍·구조가 일관돼 재발 여지가 없다. 신규 스로틀(상수 + Map + `opts.throttle`)은 매직 넘버를 즉시 이름 있는 상수로 승격하고 기존 `segmentStartMs` Map 관용구를 그대로 재사용했으며, 옵션 인자도 named-property 형태로 boolean trap 을 회피해 `assertExecutionNotCancelled` 의 복잡도를 과도하게 높이지 않았다. 회귀 테스트도 스로틀 스킵/갱신 양쪽 경로를 `Date.now` 제어로 검증하고 있어 커버리지 공백이 없다. 위에서 지적한 3건은 모두 INFO 수준의 사소한 개선 여지이며 블로킹 사유가 아니다.

## 위험도

LOW
