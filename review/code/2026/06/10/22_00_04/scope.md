# 변경 범위(Scope) 리뷰 결과

## 발견사항

### [INFO] 파일 1·2 — `toEiaEvent` → `toChatChannelEvent` 명칭 업데이트가 테스트 전체에 반영됨
- **위치**: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts` 전체, `chat-channel.dispatcher.ts` diff
- **상세**: `toEiaEvent` deprecated alias 를 실제로 제거(파일 2)하면서, 해당 alias 를 사용하던 spec 테스트(파일 1) 전체가 `toChatChannelEvent` 로 일괄 교체됐다. 이는 범위 내 m-2(alias 제거) 작업의 직접적인 연쇄 수정이다. 변경 라인 수가 많아 보이지만 실질 내용은 함수 호출명 rename 한 종류이며, 대응하는 구현 제거(파일 2)와 1:1 연결된다. 불필요한 부수 변경 없음.
- **제안**: 해당 없음.

### [INFO] 파일 5·6 — `ContinuationBusService.on()` + 테스트 블록 동반 삭제
- **위치**: `continuation-bus.service.ts` diff (라인 145–218 제거), `continuation-bus.service.spec.ts` diff (라인 228–900 구간 일부 삭제)
- **상세**: 구현(`on()` 메서드)과 그 테스트(`on() — Phase 2 부터 no-op` describe 블록)가 함께 제거됐다. 이는 plan 03 M-6 범위("on() 제거, spec 테스트 훅 3곳 동반")에 부합하는 정확한 쌍 삭제다. 제거 후 파일에 남은 테스트는 모두 살아있는 기능(publish, acquireLock 등)에 대한 것으로 무관한 정리가 없다.
- **제안**: 해당 없음.

### [INFO] 파일 7·8 — `registerContinuationHandlers` 관련 코드·테스트 훅 제거
- **위치**: `execution-engine.service.ts` diff (라인 886–551 범위 축소), `execution-engine.service.spec.ts` diff (라인 517·14433 구간 두 곳)
- **상세**: `execution-engine.service.ts` 에서 no-op stub `registerContinuationHandlers()` private 메서드와 `onModuleInit` 내 호출이 제거됐다. 댓글이 "full B3 완전 제거" 의미로 업데이트됐다. 테스트 파일에서는 해당 메서드를 명시적으로 호출하던 두 곳의 훅이 동반 삭제됐다. plan M-6 의 "spec 테스트 훅 3곳 동반" 기술(`:524`, `:14214` 두 위치)과 일치한다. `resumeExecution` JSDoc 의 in-memory 잔재 설명도 BullMQ Worker 기술로 정확히 업데이트됐다. 범위 내 수정만 존재한다.
- **제안**: 해당 없음.

### [INFO] 파일 9 — `system-status.constants.ts` deprecated 상수 2건 제거
- **위치**: `codebase/backend/src/modules/system-status/system-status.constants.ts` (라인 113–119 제거)
- **상세**: `FAILED_DEGRADED_THRESHOLD`와 `DELAYED_DEGRADED_THRESHOLD` 두 상수가 `@deprecated` 태그와 함께 제거됐다. plan m-2 범위에 포함된 "system-status 상수 2건" 에 정확히 대응한다. 이 상수들은 이미 getter 함수(`getFailedDegradedThreshold()`, `getDelayedDegradedThreshold()`)로 대체됐으며, 제거된 상수가 `MONITORED_QUEUES` 나 큐 레지스트리와 무관함이 파일 컨텍스트에서 확인된다(상수가 파일 끝에 독립적으로 존재). 범위 정확.
- **제안**: 해당 없음.

### [INFO] 파일 10·11 — 주석의 `toEiaEvent` → `toChatChannelEvent` 단순 텍스트 교체
- **위치**: `websocket.service.spec.ts` 라인 370, `websocket.service.ts` 라인 49
- **상세**: 소스 코드 내 JSDoc 주석과 테스트 인라인 주석에서 구 함수명(`toEiaEvent`) 참조가 새 이름(`toChatChannelEvent`)으로 업데이트됐다. 이는 alias 제거(m-2)의 직접적 파급인 텍스트 정합 수정이며, 공백·포맷팅 변경 없이 정확한 식별자 수정만 포함된다.
- **제안**: 해당 없음.

### [INFO] 파일 3·4 — M-5: `deepFreeze`/`freezeSharedCacheValues` 신규 추가 및 테스트
- **위치**: `parallel-executor.ts` (라인 7 이후 35줄 신규 추가, 207줄 근방 분기 변경), `parallel-executor.spec.ts` (라인 73 이후 61줄 신규 테스트)
- **상세**: plan 06 M-5 범위에 해당하는 dev/test deep freeze 구현이다. `deepFreeze`와 `freezeSharedCacheValues` 두 함수가 추가되고, branch clone 직후(`nodeOutputCache`, `structuredOutputCache` 두 필드)에만 한정 적용됐다. production(`NODE_ENV === 'production'`)에서는 noop이다. 승인 범위(단기 1안 — dev/test deep freeze, spec 불변)와 정확히 일치하며 `structuredClone` 전환(기각된 C안)이 포함되지 않았다. 회귀 가드 테스트 2건(내부 mutate → TypeError, top-level 키 추가 → 격리)이 구현과 함께 추가됐다. 범위 내 최소 변경.
- **제안**: 해당 없음.

### [INFO] 파일 12–14 — Plan 상태 업데이트
- **위치**: `plan/in-progress/refactor/03-maintainability.md` (M-6 항목), `plan/in-progress/refactor/04-security.md` (m-4 항목), `plan/in-progress/refactor/06-concurrency.md` (M-1·M-5 항목)
- **상세**: 완료된 작업(M-6, M-5)은 `[x]` 로 체크·완료 상태 업데이트됐고, planner 선행이 필요하다고 분리된 항목(M-1, m-4)은 "⏭️ planner 선행 후 별도 PR" 로 상태 변경됐다. impl-prep consistency check 결과를 반영한 정확한 plan 업데이트다. 한 줄씩 상태만 갱신했고 계획 본문은 건드리지 않았다.
- **제안**: 해당 없음.

### [INFO] 파일 15–22 — Consistency review 산출물 신규 생성
- **위치**: `review/consistency/2026/06/10/21_36_50/` 하위 7개 파일 (SUMMARY.md, cross_spec.md, convention_compliance.md, rationale_continuity.md, plan_coherence.md, naming_collision.md, meta.json, _retry_state.json)
- **상세**: 구현 착수 전 의무 `consistency-check --impl-prep` 산출물이다. CLAUDE.md 규약상 developer 는 구현 착수 직전 `consistency-check --impl-prep` 을 수행할 의무가 있으며, 산출물 위치(`review/consistency/<YYYY>/<MM>/<DD>/`) 도 규약에 부합한다. 이 파일들은 review 디렉터리에 생성되는 정상 산출물이며 코드 변경이 아닌 검토 기록이다.
- **제안**: 해당 없음.

---

## 요약

이번 PR의 변경 범위는 plan 에서 사전 승인된 3개 실행 항목(03 M-6, 03 m-2, 06 M-5)에 정확히 대응한다. `toEiaEvent` alias 제거(m-2)에 따른 테스트 전체 rename, `on()` 제거에 따른 테스트 블록 삭제, `registerContinuationHandlers` 제거에 따른 테스트 훅 2곳 동반 삭제 모두 plan M-6/m-2 에 명기된 범위다. `parallel-executor.ts` 의 deep freeze 추가(M-5)는 승인 범위(단기 1안, dev/test 한정, production 무변경)를 벗어나지 않는다. plan 상태 업데이트와 consistency review 산출물 생성도 workflow 규약에 의한 정상 산출물이다. 의도 이상의 리팩토링, 무관한 기능 확장, 불필요한 포맷팅·주석 변경, 무관 파일 수정은 발견되지 않았다.

---

## 위험도

NONE

STATUS: OK
