# 변경 범위(Scope) 리뷰

**작업**: workflow-resumable-execution Phase 1.1 + Phase 1.2  
**리뷰 일자**: 2026-05-25  
**대상 파일 수**: 27개 (코드 8, 테스트 3, plan/review 문서 16)

---

## 발견사항

### [INFO] `ShutdownStateService.fromConfig` 정적 팩토리 — 현재 호출처 없음
- 위치: `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts` (`fromConfig` 정적 메서드)
- 상세: `ShutdownStateService` 구현에 `static fromConfig(config: ConfigService, ...)` 팩토리 메서드가 포함되어 있으나, 현재 모듈 등록(`execution-engine.module.ts`)은 `useFactory: () => Number(process.env.SIGTERM_GRACE_MS ?? 30_000)` 패턴을 직접 사용하고 있어 이 팩토리는 실제로 호출되지 않는다. Phase 1.2 범위 내에서 필요하지 않은 코드가 추가된 것으로 볼 수 있다.
- 제안: 이 팩토리가 Phase 2 이후 시나리오를 위한 사전 준비라면 주석으로 의도를 명시하거나, 현재 PR 범위에서 사용되지 않으면 제거 후 필요 시 재도입하는 것이 범위 절제 측면에서 바람직하다.

---

### [INFO] `@Optional() @Inject('SHUTDOWN_POLL_MS')` 테스트 전용 파라미터 — production 코드에 노출
- 위치: `shutdown-state.service.ts` constructor, `@Optional() @Inject('SHUTDOWN_POLL_MS') pollMs?: number`
- 상세: `SHUTDOWN_POLL_MS` 토큰은 단위 테스트에서 polling 간격을 단축하기 위한 목적으로 `buildService(graceMs, pollMs)` 헬퍼에서만 사용된다. 프로덕션 모듈(`execution-engine.module.ts`)에는 이 토큰을 제공하는 provider가 없다. 테스트 편의를 위한 `@Optional` 패라미터가 production 서비스 생성자에 노출되는 패턴은 범위 외 코드다.
- 제안: 테스트에서는 생성자를 직접 호출하는 방식으로 충분하므로, `SHUTDOWN_POLL_MS` DI 토큰을 제거하고 생성자 파라미터를 `pollMs = 200`과 같이 기본값 있는 일반 파라미터로 변경하거나, 해당 파라미터를 생성자가 아닌 내부 상수로 처리하는 것이 적절하다.

---

### [INFO] `execution-engine.service.ts` 주석 수정 — 범위 내 변경의 자연스러운 동반
- 위치: `execution-engine.service.ts` 라인 2176~2299 구간, `_resumeState` 관련 주석 두 곳
- 상세: Phase 1.1에서 `recoverStuckExecutions` 의 동작이 바뀌었으므로 "server restart triggers `recoverStuckExecutions` → FAILED" 를 설명하는 기존 주석 두 곳이 부정확해진다. 이를 Phase 1.1 결과와 일치하도록 갱신한 것은 의미 있는 수정이며 범위 이탈로 보기 어렵다. 다만 영어/한국어 혼용 주석 업데이트가 포함되어 있어 스타일 불일치가 발생하나, 이미 해당 파일이 혼용 패턴을 가지고 있으므로 문제가 되지 않는다.
- 제안: 없음.

---

### [INFO] `retry-handler-followup.md` — 본 PR 범위 내 연동 갱신
- 위치: `plan/in-progress/retry-handler-followup.md`
- 상세: WARNING #2 의 채널명 `execution:continuation` 표기를 BullMQ 기반으로 갱신한 것은 Phase 0 spec 결정의 파급 효과를 plan 문서에 반영한 정당한 수정이다. 단, `retry-handler-followup.md` 가 본 PR의 구현 범위와 직접 연결된 것은 아니며 planner 영역(`plan/**`) 변경이다. developer 역할이 해당 파일을 수정하는 것은 규약상 `codebase/**` 와 `plan/**` 쓰기 허용 범위 내에 있어 문제없다.
- 제안: 없음.

---

### [INFO] consistency review 세션 파일 (파일 13–27) — review 아카이브 추가
- 위치: `review/consistency/2026/05/24/23_26_13/`, `review/consistency/2026/05/24/23_39_12/` 전체
- 상세: 이 파일들은 spec draft에 대해 사전 수행된 consistency check 세션의 산출물이다. CLAUDE.md 에 정의된 저장 위치(`review/consistency/<ISO>/<session>/`)에 부합하며 이 PR에서 진행된 workflow의 정상 산출물이다. 범위 이탈이 아니다.
- 제안: 없음.

---

### [INFO] `self-hosting-deployment.md` — 연동 TODO 추가
- 위치: `plan/in-progress/self-hosting-deployment.md`
- 상세: `terminationGracePeriodSeconds` 설정 TODO 를 Helm chart 체크리스트에 추가했다. Phase 1.2의 `SIGTERM_GRACE_MS` 구현과 직접 연동되는 인프라 요건이므로 범위 내 변경으로 적절하다.
- 제안: 없음.

---

## 요약

전체 27개 파일에 걸친 변경은 `workflow-resumable-execution` Phase 1.1(recovery 정책 수정) 및 Phase 1.2(Graceful Shutdown) 라는 명확한 의도 범위 내에 집중되어 있다. 코드 변경(Phase 1.1 recovery WHERE 절 수정, Phase 1.2 ShutdownStateService 신규 도입 및 연동)은 spec 의도와 일치하며 무관한 리팩토링이나 기능 확장은 발견되지 않는다. 포맷팅 변경이나 불필요한 임포트 정리도 없다. 지적 사항은 두 가지 INFO 수준으로, `ShutdownStateService.fromConfig` 정적 팩토리가 현재 사용처 없이 포함된 것과 `SHUTDOWN_POLL_MS` DI 토큰이 테스트 편의를 위해 production 생성자에 노출된 것이다. 두 항목 모두 기능 동작에 영향을 주지 않으나 범위 절제 관점에서 가벼운 over-engineering에 해당한다. 나머지 주석·plan·review 파일 변경은 해당 작업의 정당한 동반 변경이다.

---

## 위험도

LOW
