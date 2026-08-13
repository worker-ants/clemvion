# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. `admitExecutionOrDefer` 의 신규 `Array.isArray` fail-closed 가드가 스스로
제시한 방어 근거를 같은 파일/인접 서비스의 구조적으로 동일한 sibling 3곳에는 적용하지 않았고,
그 가드가 throw 할 때 admission 이전에 이미 등록된 `registerExecutionRouting` 이 release 되지
않는 경로가 어떤 테스트로도 검증되지 않는다 — 둘 다 실제 발생 확률은 낮은 defense-in-depth
성격이라 WARNING 수준. forced reviewer 7명 전원 전문 확보(누락 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `admitExecutionOrDefer` 의 `Array.isArray(rows)` fail-closed 가드가 스스로 명시한 위험 클래스(`.query()` 결과에 대한 제네릭 타입 단언 + `.length` 접근이 `Promise<any>` 라 검증되지 않는다)를 같은 파일 내 구조적으로 동일한 sibling 2곳과 인접 서비스 1곳에는 적용하지 않았다 | `execution-engine.service.ts:8179`(`lockNonTerminalExecutionRow`), `:8465-8492`(`updateExecutionStatus` else 분기 — terminal 전이 choke point 라 파급이 더 큼, 애플리케이션 트랜잭션 밖의 단일 raw UPDATE 라 "throw⇒rollback" 방어 논리도 적용 안 됨), `executions.service.ts:303-319`(`computeChainDepth`) | 세 자리에도 동일한 `Array.isArray` 가드를 적용하거나, 위험도가 admission 보다 낮다는 근거를 남기고 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 후속 항목으로 등재 |
| 2 | testing | 신규 admission `Array.isArray` 가드가 **throw** 할 때 `runExecutionFromQueue` 호출부 레벨 영향(특히 admission 이전에 이미 등록된 `registerExecutionRouting` 이 release 안 됨)이 어떤 테스트로도 검증되지 않는다 — 구조적으로 대칭인 형제 시나리오(`runExecution` reject)는 명시적으로 테스트되는데 이쪽만 비어 있다 | `execution-engine.service.ts:3659`(`registerExecutionRouting`, admission 이전), `:3669`(admission 호출, try/catch 밖), `:3683-3696`(`runExecution` 만 try/catch 로 감쌈); 테스트 갭: `execution-engine.service.spec.ts` `admitStub` 헬퍼(~4819-4835행, reject 미지원)와 `runExecutionFromQueue` describe(4837-4919행) | `admitStub` 에 `mockRejectedValueOnce` 지원 추가 후, admission throw 시 `releaseExecutionRouting` 호출 여부(현재는 안 됨)를 명시적으로 고정하는 테스트 추가. 의도된 설계(boot-time backstop 이 최종 회수)라면 그 사실을 테스트로 문서화 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement / side_effect | admission 가드 throw 시 `registerExecutionRouting` 미해제 경로 자체는 이번 diff 이전에도 (가드 없이 `TypeError` 로) 동일하게 존재했던 propagation — 신규 회귀 아님, 메시지만 명확해짐 | `execution-engine.service.ts:3654-3670` | 조치 불요(문서화 목적 참고). testing WARNING #2 로 커버 |
| 2 | side_effect | `TypeError` → 명시적 `Error` 로 예외 타입/메시지 변경 — 로그 문자열 매칭 기반 외부 모니터링이 있다면 조용히 끊길 가능성 | `execution-engine.service.ts:2931-2936` | 조치 불요(의도된 진단 개선). 운영 알림 규칙 존재 시 문구 갱신 검토 |
| 3 | side_effect | `SNAPSHOT_CACHE_MAX_ENTRIES` 가시성 확대(`const`→`export const`) — 값 불변, 소비처는 정의부·테스트뿐 | `executions.service.ts:63` | 조치 불요 |
| 4 | side_effect | 신규 테스트 2건이 `Logger.prototype.debug`/`warn` 전역 스파이 패치 — `try/finally` 로 복원 보장됨 | `chat-channel.dispatcher.spec.ts:790-838` | 조치 불요. `it.concurrent` 전환 시 패턴 주의 |
| 5 | maintainability | 신규 JSDoc 블록이 설명 대상(`describe`)이 아닌 55줄 뒤에 배치돼, 다음 헬퍼(`makeDispatcherHarness`) 설명으로 오인되기 쉬움 | `chat-channel.dispatcher.spec.ts:703-714` | JSDoc 을 실제 대상 `describe` 선언(769행) 바로 위로 이동 |
| 6 | maintainability | `buildDispatcherForNull()` 이 인자 없이 `makeDispatcherHarness()` 를 그대로 호출만 하는 1줄 pass-through 래퍼 | `chat-channel.dispatcher.spec.ts:765-767` | 제거하고 두 호출부에서 `makeDispatcherHarness()` 직접 호출 |
| 7 | maintainability | 파일 내 fixture 빌더 네이밍 컨벤션이 `make*` 1개 vs 기존 `build*` 3개로 갈림 | `chat-channel.dispatcher.spec.ts:723,765,770,843` | `makeDispatcherHarness` → `buildDispatcherHarness` 리네임(선택) |
| 8 | maintainability | `dispatcher as unknown as { handle: ... }` 인라인 캐스트가 이번 diff 로 2곳 늘어 총 4곳(기존 반복 지적 표면 확대) | `chat-channel.dispatcher.spec.ts:794-798,822-826` (신규), `:888-892,906-910` (기존) | 로컬 타입 별칭 도입해 4곳 재사용(선택, 심각도 낮음) |
| 9 | documentation | `admitExecutionOrDefer` 최상단 docstring 이 반환값 3가지만 열거, 신규 throw 경로를 계약에 미반영 | `execution-engine.service.ts:2852-2869`(docstring, 미변경) / 가드 `2931-2935` | docstring 에 "shape 이상 시 throw, 트랜잭션 롤백, 호출자 미포착·그대로 전파" 한 줄 추가 |
| 10 | documentation | `SNAPSHOT_CACHE_MAX_ENTRIES` export 사유 주석 없음 — 자매 상수 `MAX_EXECUTION_PATH_ROWS` 는 있음. 이전 라운드(`14_01_46`)가 이미 지적·의식적 유예한 항목 재확인 | `executions.service.ts:63` | (선택) JSDoc 에 export 사유 한 줄 추가 |
| 11 | documentation | plan 문서 "완료" 기록 서식이 무관 단락 뒤 빈 줄 2개 뒤에 삽입 — 이전 라운드가 이미 지적·의식적 유예 | `plan/in-progress/backend-lint-gate-broken-on-main.md:1147-1149` | (선택) 관련 체크박스(1121행) 바로 아래로 이동 |
| 12 | scope | plan 문서에 이번 작업과 무관한 "EIA outbound notification payload" CRITICAL 결정 이력(~50줄)이 함께 기록됨 — 코드 변경 미수반, 이미 별도 PR(#1166)로 처리 완료, 의도적으로 이번 PR 스코프에 끌어오지 않음 | `plan/in-progress/backend-lint-gate-broken-on-main.md:743-791` | 조치 불요(정책상 정당한 감사 기록) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·시크릿·인증/인가·암호화·의존성 관점 신규 결함 없음. `Array.isArray` 가드는 오히려 드라이버 반환값 검증 강화 |
| requirement | LOW | admission 가드 하드닝을 sibling `.query()` 지점 3곳에 미적용(WARNING). 핵심 3건 테스트는 spec/실코드와 line-level 정확 일치 |
| scope | NONE | plan 백로그 항목과 1:1 대응, 프로덕션 변경 최소(2파일·~16줄). 무관 CRITICAL 이력 기록은 의도적·비침습(INFO) |
| side_effect | LOW | admission 가드 throw 가 트랜잭션 롤백 불변식 보존함을 호출 체인 끝까지 추적 확인. 예외 타입/메시지 변경·export 확대·전역 spy patch 모두 INFO 수준 |
| maintainability | LOW | 이전 라운드 WARNING(fixture 중복) 해소 확인. JSDoc 배치·pass-through 래퍼·네이밍 컨벤션·캐스트 중복 확대는 전부 INFO |
| testing | LOW | 핵심 3세트 테스트 line-level 정확·전량 GREEN(441/66 passed). admission throw 의 caller-level(routing release) 영향 미검증(WARNING) |
| documentation | LOW | 신규 주석/JSDoc 전부 실코드와 정확 일치. throw 경로의 함수 계약 미반영·export 주석 비대칭·plan 서식은 INFO(뒤 둘은 이전 라운드 재확인) |

## 발견 없는 에이전트

없음 (security 는 위험도 NONE 이나 확인 사항 서술 있음).

## 권장 조치사항

1. `execution-engine.service.ts` 의 `updateExecutionStatus`(8465-8492행, terminal 전이 choke point) 와
   `lockNonTerminalExecutionRow`(8179행), `executions.service.ts` 의 `computeChainDepth`(303-319행)에
   동일한 `Array.isArray` 런타임 가드를 적용하거나, 적용하지 않는 근거를 명시해 후속 백로그 항목으로
   등재한다 (requirement WARNING #1).
2. `execution-engine.service.spec.ts` 의 `admitStub` 에 reject 시나리오를 추가해, admission throw 시
   `registerExecutionRouting` release 여부를 명시적으로 고정한다 — 의도된 설계라면 그 자체를
   테스트로 문서화한다 (testing WARNING #2).
3. (선택, 낮은 우선순위) `chat-channel.dispatcher.spec.ts` 의 JSDoc 배치 정정, pass-through 래퍼
   제거, 네이밍 컨벤션 통일, 타입 캐스트 중복 해소 — INFO 항목 5-8.
4. (선택) `admitExecutionOrDefer` docstring 에 신규 throw 계약을 반영 — INFO 항목 9.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 표 (아래, 7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (forced 전원 결과 확보됨 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 범위(테스트 보강 + 소규모 방어 가드/export)에 해당 없음 |
  | architecture | router 판단상 이번 diff 범위에 해당 없음 |
  | dependency | 신규/변경 의존성 없음 |
  | database | 신규 스키마/마이그레이션 변경 없음 |
  | concurrency | router 판단상 이번 diff 범위에 해당 없음 |
  | api_contract | 공개 API·엔드포인트 변경 없음 |
  | user_guide_sync | 사용자 대면 문서/가이드 변경 없음 |
