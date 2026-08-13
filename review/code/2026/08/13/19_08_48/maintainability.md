# 유지보수성(Maintainability) 코드 리뷰

## 사전 확인 사항

이 changeset(`origin/main...HEAD`, 8개 소스 커밋)은 이미 동일 브랜치 내에서 4~5차례 (`14_01_46`→`17_15_21`→`18_00_11`→`18_19_33`→`18_38_10`) 유지보수성 리뷰를 거쳤고, 매 라운드 WARNING/INFO 는 다음 커밋에서 조치됐다. 이번 라운드(`19_08_48`)는 그 산출물 자체가 diff 에 포함돼 프롬프트가 매우 크므로, `git diff origin/main...HEAD --stat` 로 실질 코드 변경 파일(8개: `assert-row-array.ts`/`.spec.ts`, `execution-engine.service.ts`/`.spec.ts`, `executions.service.ts`/`.spec.ts`, `executions-rerun.service.spec.ts`, `chat-channel.dispatcher.spec.ts`)만 추려 현재 HEAD 상태를 직접 `Read`/`grep` 으로 재확인했다 — 과거 라운드가 지적했던 항목이 실제로 해소됐는지 독립 검증하는 방식으로 진행했다.

## 발견사항

없음 (CRITICAL/WARNING/INFO 모두 신규 항목 없음).

### 검증한 항목 (과거 라운드 지적 → 현재 상태)

- **`chat-channel.dispatcher.spec.ts` 캐스트 중복 (4곳)** — `18_38_10` maintainability INFO 로 재확인됐던 `dispatcher as unknown as { handle: ... }` 4곳 반복이, 최신 커밋(`ef4ff8d5d`)에서 `callHandle(dispatcher, event)` 헬퍼(`codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts` 함수 `callHandle`, 758행 부근)로 통합됐다. `grep -n "as unknown as { handle"` 결과 0건, `callHandle(` 호출 5곳으로 확인.
- **JSDoc 오배치** — `toChatChannelEvent` null 로그 레벨 분기를 설명하는 JSDoc 이 무관한 헬퍼 함수 앞에 있던 문제(`18_38_10` INFO)가 해당 `describe` 선언 바로 위로 이동됨을 확인.
- **`buildDispatcherForNull()` pass-through 래퍼** — 제거되고 호출부가 `buildDispatcherHarness()` 를 직접 사용하도록 정리됨을 확인.
- **네이밍 컨벤션 혼재 (`make*` vs `build*`)** — `makeDispatcherHarness` → `buildDispatcherHarness` 로 통일. 현재 파일 내 헬퍼 함수 4개(`buildDispatcherHarness`/`callHandle`/`buildNullEvent`/`buildDispatcher`) 모두 일관.
- **`assertRowArray` 4개 호출부** (`execution-engine.service.ts` admission/`lockNonTerminalExecutionRow`/`updateExecutionStatus`, `executions.service.ts` `computeChainDepth`) — `grep -c "assertRowArray("` 결과 정확히 4건, 테스트(`assert-row-array.spec.ts` 구조적 회귀 가드)의 기대치(3+1)와 일치. 각 호출부의 `detail` 문자열은 실패 시 실제 결과(트랜잭션 롤백/조용한 유실/이미 fail-closed/RR-PL-05 우회)를 지점별로 다르게 서술 — 겉보기 반복이지만 헬퍼 설계 의도("메시지는 호출부가 준다")를 따른 의도된 형태로, 코드 중복으로 보지 않음.
- **`SNAPSHOT_CACHE_MAX_ENTRIES` export 사유 주석 비대칭** — 자매 상수 `MAX_EXECUTION_PATH_ROWS`(43행, "테스트에서도 동일 상수를 참조하도록 export.")와 달리 `SNAPSHOT_CACHE_MAX_ENTRIES`(64행)에는 export 사유 한 줄이 없는 상태가 그대로 남아 있다 — 다만 이는 `14_01_46` documentation.md 가 이미 지적하고 RESOLUTION 에서 "무조치 — 자매 상수와 비대칭이나 소비처가 정의부·내부·테스트뿐" 로 의식적으로 유예된 항목이라, 뒤집을 새 근거 없이 재지적하지 않는다.
- **테스트 파일의 private-member 접근 캐스트 패턴** (`service as unknown as {...}`) — `execution-engine.service.spec.ts` 전체에 136건 존재하는 기존 파일 관례이며, 이번 diff 가 추가한 신규 테스트(admission/`updateExecutionStatus`/`lockNonTerminalExecutionRow` 가드 테스트, `admitStub` 의 `Error` 분기 지원)도 동일 패턴을 그대로 따랐을 뿐 새로운 표면을 만들지 않았다 — 이 파일 전역의 기존 컨벤션이라 이번 diff 범위의 지적 대상이 아니다.
- **신규 테스트의 spy 복원** — `18_00_11`/`14_01_46` 라운드가 지적했던 "emitSpy 가 finally 밖" 문제는, 새로 추가된 admission-throw 가드 테스트(`execution-engine.service.spec.ts`)에서 `const spy = emitSpy(); try { ... } finally { spy.mockRestore(); }` 형태로 감싸져 있음을 확인.

## 요약

이 changeset 은 이미 4~5라운드의 유지보수성 리뷰를 거쳐 동작(fail-open 자매 미적용) → 구조(fixture/캐스트 중복) → 문서(주석 오귀속) → 스타일(네이밍·pass-through wrapper·JSDoc 위치) 순으로 수렴한 결과물이며, 최신 HEAD 상태를 독립적으로 `Read`/`grep` 재검증한 결과 이전 라운드들이 지적했던 WARNING/INFO 항목이 모두 실제로 해소돼 있었다. 핵심 신규 코드(`assertRowArray` 헬퍼 + 4개 호출부, `SNAPSHOT_CACHE_MAX_ENTRIES` export, `chat-channel.dispatcher.spec.ts` 의 `buildDispatcherHarness`/`callHandle` 통합)는 함수 길이·중첩 깊이·네이밍·매직넘버·중복 어느 관점에서도 새로운 결함을 유발하지 않는다. 유일하게 남은 것은 `SNAPSHOT_CACHE_MAX_ENTRIES` docstring 비대칭 하나뿐이며, 이는 새 근거 없이 이미 의식적으로 유예된 항목이라 재지적하지 않았다. 이번 라운드에서 발견한 신규 유지보수성 결함은 없다.

## 위험도

NONE
