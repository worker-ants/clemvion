# Code Review 통합 보고서

## 전체 위험도
**LOW** — 이번 변경(`codebase/channel-web-chat` 위젯 새로고침 multi-turn 히스토리 복원에 대한 테스트 전용 추가, 제품 코드 무변경)은 Critical 없음·경미한 WARNING 2건(테스트 커버리지 갭·오래된 JSDoc)뿐이다. 단, **`side_effect` 리뷰어는 manifest 상 `status=success` 로 보고됐으나 출력 파일(`side_effect.md`)이 디스크에 존재하지 않아 내용을 통합할 수 없었다** — 알려진 "disk-write gap" 실패 모드(PR #901 선례, journal 백업도 부재)로, side-effect 관점 검토는 사실상 **커버리지 결측**이다. 아래 위험도 판정은 이 결측을 반영하지 못하므로 재실행 전까지는 잠정치로 간주할 것.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `widget-state.test.ts` 의 "threadMessages 없는 WAITING → 기존 messages 불변" 케이스는 실제 두 프로덕션 dispatch 호출부(`use-widget.ts:148-154`, `:225-241`)에서 도달 불가능한 분기(`threadToMessages`는 항상 배열을 반환, `undefined` 없음)를 검증한다. 반대로 실제 흔한 케이스인 "빈 배열 스냅샷"(`threadMessages=[]`, 신규 대화 초입 등)은 이 describe 블록에 커버되지 않는다. requirement 리뷰어도 동일 분기를 확인했으나 "타입 계약 커버리지"로 보아 INFO 로 판단; testing 리뷰어는 실제 커버리지 공백까지 지적해 WARNING 으로 통합. | `codebase/channel-web-chat/src/lib/widget-state.test.ts:358-363` (reducer 원본: `widget-state.ts:134-136`, `threadToMessages`: `conversation.ts:50-51`) | 테스트 코멘트를 "타입 레벨 방어 코드(현재 호출부에서는 도달 불가)"로 정정하고, 실제 도달 가능한 `waiting([])`(빈 배열, local 빈/비어있지 않음 두 하위 케이스) 테스트를 추가 |
| 2 | Documentation | `mergeMessages` 의 기존 JSDoc(`widget-state.ts:181-182`, diff 밖)이 "합치기(merge)·중복 회피(dedup)"를 수행한다고 서술하나, 실제 구현은 `snapshot.length >= local.length ? snapshot : local` 로 두 배열 중 하나를 통째로 **선택**할 뿐 인터리빙·중복 제거는 없다. 이번에 추가된 신규 테스트들이 실제 동작을 정밀 고정하면서 기존 JSDoc 과의 괴리가 드러남. | `codebase/channel-web-chat/src/lib/widget-state.ts:181-182` | 다음에 이 파일을 건드릴 때(또는 소소한 후속 커밋) JSDoc 을 실제 정책("durable snapshot 이 로컬과 같거나 길면 snapshot, 짧으면 local 을 그대로 채택 — interleave/dedup 없음")으로 교정. 이번 diff(test-only) 의 필수 수정 사항은 아님 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability | 신규 "복원 통합" 테스트가 인접 "race fix" 테스트와 거의 동일한 `fetchMock` 골격(embed-config reject → GET status 분기 → webhook POST 폴백)을 재복제. 파일 전반의 기존 관례(테스트별 독립 mock)를 답습한 것으로 이번 diff 가 새로 만든 문제는 아님. | `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:1108-1144` (비교: `:1050-1087`) | `installFetchWithStatusContext(...)` 류 공용 헬퍼 추출을 후속 리팩터로 고려(이번 diff 단독 변경은 과도) |
| 2 | Testing | `buttons`/`form` interactionType 복원 시 `threadMessages` 시드 여부는 여전히 미검증. plan 문서가 `ai_conversation` 다중 turn 으로 스코프를 의도적으로 좁혔으나(carve-out), 현재는 암묵적 out-of-scope. | `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` | 후속 plan 백로그에 "buttons/form + 기존 threadMessages 시드" 케이스 등록하거나 plan 배경 섹션에 명시적 out-of-scope 기재 |
| 3 | Documentation | `plan/in-progress/webchat-multiturn-restore-test.md` 내 동일 e2e 실행 결과의 소요 시간이 두 곳에서 다르게 기재(`216s` vs `229s`, 테스트 개수 253 은 일치) | `plan/in-progress/webchat-multiturn-restore-test.md:26, :39` | 동일 회차면 시간 통일, 다른 회차면 "1차/2차 실행" 등으로 구분 표기(blocking 아님) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 공격 표면 없음(제품 코드 무변경). mock 토큰·마커 strip·에러 일반화 회귀 테스트 모두 긍정적 확인 |
| requirement | NONE | `mergeMessages`/`threadToMessages`/복원 흐름 모두 spec·소스와 line-level 정합. 62/62 테스트 PASS 실행 확인 |
| scope | NONE | 순수 추가(+161/-0), 3파일 모두 diff 대상과 일치. 리팩터링·무관한 수정·설정 변경 없음 |
| side_effect | **확인불가** | STATUS=success 로 보고되었으나 `side_effect.md` 가 디스크에 없음(disk-write gap). 재실행 필요 |
| maintainability | LOW | fetchMock 골격 경미한 재복제(기존 관례 답습), 로컬 헬퍼 스코프는 양호 |
| testing | LOW | `mergeMessages` 5케이스는 촘촘하나, `threadMessages=undefined` 분기가 도달 불가능한 반면 실제 흔한 "빈 배열" 케이스 미커버(WARNING 참조) |
| documentation | LOW | `mergeMessages` JSDoc 이 신규 테스트가 드러낸 실제 동작과 불일치(WARNING 참조). e2e 소요시간 표기 사소한 불일치 |

## 발견 없는 에이전트

- security — 조치 필요 사항 없음(INFO 전부 "조치 불필요" 확인성 기술)
- requirement — 조치 필요 사항 없음
- scope — 발견 없음

## 권장 조치사항
1. **`side_effect` 리뷰어 재실행** — manifest 상 success 이나 출력 파일 결측으로 side-effect 관점(전역 상태·스토리지·부수효과) 검토가 이번 통합 보고서에서 완전히 누락되었다. 재실행 전까지 이 diff 를 "side-effect 검토 완료"로 간주하지 말 것.
2. (선택, blocking 아님) `widget-state.test.ts:358-363` 테스트 코멘트를 "타입 레벨 방어 코드" 로 정정하고 실제 도달 가능한 `waiting([])` 케이스 추가.
3. (선택, blocking 아님) `widget-state.ts:181-182` 의 `mergeMessages` JSDoc 을 실제 select 정책으로 교정(이번 PR 스코프 밖, 후속 커밋 권장).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명) — 전원 router_safety 에 의해 강제 포함(순수 router 자체 선택은 0명; 소스 코드 변경 2파일 + 문서 파일 1개로 인해 전 카테고리 강제 트리거)
  - **제외**: 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, = 실행 전원)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(test-only, 런타임 코드 무변경)와 무관 |
  | architecture | router 판단상 이번 diff 와 무관 |
  | dependency | router 판단상 이번 diff 와 무관(의존성 변경 없음) |
  | database | router 판단상 이번 diff 와 무관(DB 접근 없음) |
  | concurrency | router 판단상 이번 diff 와 무관(동시성 로직 변경 없음) |
  | api_contract | router 판단상 이번 diff 와 무관(API 계약 변경 없음) |
  | user_guide_sync | router 판단상 이번 diff 와 무관(사용자 가이드 영향 없음) |
---

## 재실행/해소 갱신 (main 추가)

- **side_effect 재실행 완료** (disk-write gap 해소): `side-effect-reviewer` 를 단독 재호출 →
  `side_effect.md` 디스크 기록됨. 결과 **RISK=NONE, Critical 0, Warning 0** (INFO 4건 전부 "조치 불필요":
  immutable reducer 라 공유 `initialState` spread 무오염, `vi.stubGlobal`/`sessionStorage` 는
  파일 전역 `beforeEach`/`afterEach` 가드로 격리, `renderHook` unmount 미명시는 파일 전체 기존 관례,
  `import type` 런타임 무부작용). → 상단 "잠정치" 단서 해소, 최종 위험도 **LOW** 확정.
- **WARNING#1 (Testing)** 조치: `widget-state.test.ts` — undefined 분기 테스트 코멘트를 "타입 레벨 방어(프로덕션 미도달)"로 정정 + 실제 도달 가능한 `waiting([])` 빈-배열 스냅샷 케이스 추가.
- **WARNING#2 (Documentation)** 조치: `widget-state.ts` `mergeMessages` JSDoc 을 실제 length-기반 select 정책으로 정정.
- **INFO** 조치: plan e2e 소요시간 2회 구분 표기, buttons/form 복원 out-of-scope carve-out 명시. (fetchMock 헬퍼 dedup 은 reviewer 권고대로 후속 리팩터로 defer.)
