# 테스트(Testing) 리뷰

## 컨텍스트

본 세션(`01_40_43`)의 diff 는 이전 리뷰 세션(`01_10_15`)의 산출물(`SUMMARY.md`/`RESOLUTION.md`/각 리뷰어 `.md`/`meta.json`/`_retry_state.json`)이 커밋되어 diff base 에 포함된 상태에서 재실행된 fresh review 다. 실제 코드 검토 대상은 파일 1~4(`widget-state.test.ts`, `widget-state.ts`, `use-widget-eager-start.test.ts`, plan md)뿐이고, 파일 5~15 는 이전 리뷰가 생성한 리포트 그 자체(메타/기록물)라 테스트 관점 코드 리뷰 대상이 아니다.

이전 세션에서 testing 리뷰어가 낸 **WARNING**("`threadMessages` undefined 케이스가 프로덕션 미도달 분기를 실사용 시나리오처럼 서술 + 실제 흔한 '빈 배열 스냅샷' 케이스 미커버")이 이번 diff 에 이미 반영·해소되어 있음을 코드로 직접 확인했다:
- `widget-state.test.ts` 신규 `it("빈 배열 스냅샷(threadMessages=[])...")` 케이스 추가됨(local 비면 빈 유지 / local 있으면 보존 두 하위 케이스 모두 포함) — 지적된 커버리지 갭 해소.
- `it("threadMessages 부재(undefined) WAITING...")` 코멘트가 "타입 레벨 방어 분기(프로덕션 미도달)"로 정정되어 실제 도달 가능성에 대한 오해 소지 제거.
- `mergeMessages` JSDoc(`widget-state.ts`)도 "합치기/dedup" 오기술 → 실제 length-기반 select 정책 서술로 정정됨(Documentation WARNING 해소).
- `use-widget.ts:152-154`, `:233-241` 두 프로덕션 dispatch 호출부를 직접 Read 하여 `threadToMessages(...)` 가 항상 배열(빈 배열 포함)을 반환함을 재확인 — 테스트 코멘트의 "프로덕션 미도달" 주장이 정확함을 검증.

## 발견사항

- **[INFO]** `seedWaitingFromStatus` 의 실패(soft-fail) 경로가 복원 통합 문맥에서 미검증
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:225-251` (`seedWaitingFromStatus`, `catch` 블록 `console.warn` 후 진행) — 대응 테스트는 `use-widget-eager-start.test.ts` 전체에서 미발견(grep 결과 "getStatus seed failed" 관련 테스트 없음).
  - 상세: 새로 추가된 "복원 통합" 테스트는 `getStatus` 가 200 + `waiting_for_input` + 정상 `conversationThread` 를 반환하는 happy path만 다룬다. 저장 세션은 있으나 `getStatus` 가 네트워크 오류·5xx 를 반환하는 경우 `seedWaitingFromStatus` 는 `console.warn` 후 조용히 진행하고(soft-fail 정책, §의도된 설계) SSE replay 가 1차 복구 경로로 남는데, 이 폴백 흐름 자체는 본 PR 이전부터 존재하던 미검증 구간이라 이번 diff 가 새로 만든 갭은 아니다.
  - 제안: blocking 아님. 후속으로 "getStatus 실패 시 SSE replay 만으로 표면이 복구되는지"를 별도 케이스로 추가하면 restore 경로 커버리지가 더 완결된다(선택).

- **[INFO]** `buttons`/`form` interactionType 복원 시 `threadMessages` 시드는 여전히 미검증 — 단, plan 에 명시적 carve-out 처리됨(선행 WARNING/INFO 대응 확인)
  - 위치: `plan/in-progress/webchat-multiturn-restore-test.md` "명시적 out-of-scope(carve-out)" 절, `use-widget-eager-start.test.ts` (기존 "race fix: getStatus 가 buttons waiting 표면을 주면…" 테스트는 `pending.type` 만 단언, messages 미검증인 채 유지)
  - 상세: 이전 리뷰 라운드에서 testing/requirement 리뷰어가 지적한 "buttons/form 복원 시 히스토리 시드 미검증"이 이번엔 plan 배경 섹션에 "필요 시 후속 백로그"로 명시적으로 문서화되어 암묵적 갭에서 추적 가능한 의도적 스코프 축소로 전환됐다. `mergeMessages`/`threadToMessages` 는 `interactionType` 과 무관하게 동작하는 순수 함수이므로 회귀 위험 자체는 낮다는 plan 의 근거도 소스(`widget-state.ts`, `conversation.ts`)와 대조해 타당함을 확인.
  - 제안: 조치 불요(이미 처리됨, 참고용 재확인).

- **[INFO]** `fetchMock` 인라인 골격 재복제(4개 이상 테스트가 유사 ~30줄 mock 반복) — 유지보수성 리뷰와 동일 관측을 테스트 가독성 관점에서 재확인
  - 위치: `use-widget-eager-start.test.ts:645-687`(신규 "복원 통합") vs 기존 "race fix" 테스트(약 `:600` 대) 등
  - 상세: 신규 테스트는 파일에 이미 존재하는 `installFetch()`/`installControllableSse()` 공용 빌더를 쓰지 않고 GET status 분기가 필요하다는 이유로 또 하나의 인라인 `vi.fn` 을 작성했다. 개별 테스트는 읽기 쉽지만(각 mock 이 그 테스트의 전체 fetch 계약을 한눈에 보여줌), 파일 전체로 보면 GET status mock 로직이 반복돼 향후 wire 형식이 바뀌면 여러 곳을 동시에 고쳐야 하는 산개 위험이 있다.
  - 제안: RESOLUTION.md 에 이미 기록된 대로 후속 리팩터(`installFetchWithStatusContext(...)` 류 헬퍼)로 defer — 이번 diff 단독 조치는 불요.

## 테스트 품질 평가(요약 확인)

- **mergeMessages 5케이스**: `snapshot.length >= local.length` 의 4개 분기(빈 로컬+snapshot / snapshot>local / snapshot==local 경계 / snapshot<local) + 빈 배열 스냅샷 하위 2케이스를 참조 동일성(`toBe`)까지 포함해 정확히 고정. `>=` 를 `>` 로 뒤집는 mutation 은 경계 테스트(snapshot==local)가 즉시 잡아낸다 — mutation-testing 관점에서 촘촘함.
- **통합 테스트("복원 통합")**: 저장 세션 pre-seed → `boot()` → `applyConfig`(`RESTORED`) → `seedWaitingFromStatus` → `WAITING` dispatch → `mergeMessages` → `state.messages` 전체 파이프라인을 실제 wire 계약(`ConversationTurn.source`, `roleOf` 매핑, `[user-input]` 마커 strip)과 정확히 일치하는 mock 으로 검증. `webhookPosts(...).length===0` 단언으로 "복원 경로는 신규 execution 을 시작하지 않는다"는 회귀도 함께 고정 — 단일 테스트가 여러 회귀 축(히스토리 유실·순서역전·role 오분류·마커 잔존·중복 시작)을 동시에 커버해 효율적이다.
- **Mock 적절성**: `roleOf`/`ConversationTurn` 타입, `getStatus` 엔드포인트 매칭(`u.endsWith(".../executions/e1")` + GET 메서드 판별)이 `eia-client.ts`/`eia-types.ts` 실제 구현과 대조해 정확 — 실제 동작과의 괴리 없음.
- **테스트 격리**: 파일 전역 `beforeEach`(`sessionStorage.clear()`, `EventSource` stub)·`afterEach`(`vi.unstubAllGlobals()`)가 모든 `it` 에 적용되어 신규 테스트도 동일하게 격리됨. 신규 테스트가 독자적인 `fetchMock`/`sessionStorage` 상태를 스스로 설정하고 다른 테스트의 상태에 의존하지 않음 — 순서 무관 독립 실행 가능.
- **가독성**: describe/it 제목과 인라인 주석이 "왜 이 케이스가 필요한지"·"어떤 소스 라인/spec 절이 SoT 인지"를 각 케이스마다 명시(예: ">= — durable 이 권위", "타입 레벨 방어 분기(프로덕션 미도달)") — 의도가 코드만으로 충분히 전달됨.
- **회귀 안전성**: 두 테스트 파일 모두 기존 `describe` 블록 뒤에 순수 append(+161줄 상당, 삭제 0) — 기존 62개 테스트의 assertion·헬퍼(`boot()`, `installFetch()`, `ENDPOINTS`, `webhookPosts()`)를 그대로 재사용하며 수정하지 않아 기존 테스트 유효성에 영향 없음.
- **테스트 용이성**: `mergeMessages` 가 비공개 함수라 직접 단위 테스트가 불가능해 유일한 공개 진입점(`widgetReducer` 의 `WAITING` 액션)을 통해 간접 검증하는데, reducer 자체가 순수 함수(의존성 없음)라 이 간접 경로로도 5개 분기를 정확·결정적으로 고정할 수 있었다 — 설계상 문제 없음.

## 요약

이전 리뷰 라운드(`01_10_15`)에서 testing/documentation 리뷰어가 지적한 WARNING 2건(프로덕션 미도달 분기를 실사용처럼 서술 + 실제 흔한 "빈 배열 스냅샷" 케이스 누락, `mergeMessages` JSDoc 과 실제 동작 불일치)이 이번 diff 에 정확히 반영되어 해소됨을 소스 대조로 확인했다. `mergeMessages` 의 length-기반 select 정책 4분기 + 빈 배열 경계는 참조 동일성까지 포함해 촘촘히 고정됐고, 신규 통합 테스트는 저장 세션 복원부터 다중 turn 히스토리 시드까지 전체 파이프라인을 실제 wire 계약과 정합하는 mock 으로 e2e-lite 검증해 여러 회귀 축을 동시에 방지한다. 남은 갭(`buttons`/`form` 복원 시드 미검증, `seedWaitingFromStatus` 실패 경로 미검증, fetchMock 골격 재복제)은 모두 이번 PR 스코프 밖이거나 이미 plan/RESOLUTION 에 후속 항목으로 명시적으로 defer 되어 있어 blocking 사유가 아니다. 테스트 격리·가독성·회귀 안전성 모두 우수한 수준이다.

## 위험도

NONE
