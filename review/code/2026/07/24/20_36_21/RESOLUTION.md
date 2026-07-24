# RESOLUTION — review/code/2026/07/24/20_36_21

대상: `claude/node-cancel-e2e-98b61f` (node-cancellation §3 다단계 cancel 전파 e2e)
리뷰 결과: **CRITICAL 1 · WARNING 5 · INFO 6** (forced 7/7 확보, `forced_missing=[]`)

## 조치 항목

| # | 카테고리 | 판정 | 조치 |
|---|---|---|---|
| C1 | Requirement | **반증 (실측)** | 아래 §C1 참고. 코드 변경 없음 — 예측된 실패가 재현되지 않음 |
| W1 | Scope | **타당 → 수정** | plan 이동이 남긴 dangling 링크 3곳(`plan/complete/node-cancellation-infrastructure.md:70,83,90`)을 same-dir 로 보정. `plan/**cancellation*` 링크 broken 0 확인 |
| W2 | Requirement/Consistency | **타당 → 사용자 결정 (A) 로 해소** | 아래 §W2 참고 |
| W3 | Maintainability | **타당 → 수정** | 중복 폴링 블록 2곳을 `waitForNodeRunning(executionId, nodeId)` 헬퍼로 추출 |
| W4 | Testing | **타당 → 수정** | 배제 단언(`not.toBe('completed')` ×2)을 **허용집합 양성 비교** `expect([null,'cancelled']).toContain(downstream)` 로 전환. 부수 효과로 C1 의 실측 프로브가 됐다(§C1) |
| W5 | Documentation | **타당 → 수정** | 인라인 주석 "창(8s)" → `INFLIGHT_WINDOW_MS` 직접 참조(향후 값 변경에 자동 추종) |
| I1~I6 | 각종 | 확인 | 조치 불요 판단(대부분 "조치 불요" 또는 우선순위 낮음). I2(3번째 테스트 범위) 는 §범위 메모 참고 |

## §C1 — CRITICAL 반증 (정적 분석 vs 실측)

**리뷰어 주장**: 선형(비-parallel) 디스패치에서 `ExecutionContext.abortSignal` 은 설정되지
않으므로(`parallel-executor.ts:245` 가 유일 할당 지점) `:6058` 의 `throwIfAborted()` 는 no-op
이고, `stop()` 은 DB 행만 갱신하므로 **하류 노드 B 가 dispatch 되어 `completed` 로 끝날 것**
→ `expect(downstream).not.toBe('completed')` 가 실패해야 한다.

**실측 결과 — 그 실패는 재현되지 않는다.**

| 실행 | 결과 |
|---|---|
| e2e 전체 (3회: 258/259/259) | 본 spec **PASS** 매회 |
| W4 로 단언을 **더 엄격하게** 바꾼 뒤 (`[null,'cancelled']` 허용집합) | **PASS** — B 는 `completed` 도 `failed` 도 아니다 |
| **대조군** (동일 워크플로, stop 만 생략) | B 가 **`completed`** — 즉 체인은 정상 동작하고, B 의 운명을 가르는 유일한 차이가 stop 이다 |

대조군이 결정적이다. "B 가 원래 안 도는 것 아니냐"(=vacuous) 가설을 배제하며, **취소가
실제로 B 의 실행을 막는다**는 것을 통제된 비교로 보인다.

**⚠ 기전 설명 정정 (2R 에서 반증됨 — 이 문단이 틀렸었다)**

원래 여기에 "노드 완료 영속이 guarded UPDATE 라 `affected=0` 으로 선점 감지된다
(`execution-engine.service.ts:313`)" 라고 적었다. **틀렸다.** 2차 ai-review 에서 독립 reviewer
**3명(requirement·testing·documentation)이 수렴 지적**했고 확인 결과 맞다:

- `:313` 의 `ResumeClaimExecTerminalError` 는 **§7.5 resume-claim 전용 sentinel** 이다.
  이 워크플로는 resume/waiting-for-input 을 타지 않으므로 그 경로를 지나가지 않는다.
- 이 경로가 실제로 지나는 노드 완료 저장(`:5645-5651`)은 Execution 상태와 무관한 무조건
  `.save()` 이고, dispatch 루프(`:4251-4454`)에도 노드 사이 Execution 재조회가 없다.

즉 나는 **주석 grep 한 줄로 기전을 단정**했다 — 이 세션 내내 경계해온 바로 그 실수를
"반증" 을 쓰는 문단에서 저질렀다.

**현재 상태 — 결과는 재현되나 기전은 미확인**

| 확립된 것 | 미확립인 것 |
|---|---|
| CRITICAL 이 예측한 실패가 **재현되지 않는다**(3회 + 더 엄격한 허용집합 단언에서도 PASS) | **어느 코드가** 하류 미도달을 보장하는지 |
| 취소가 하류의 운명을 **바꾼다**(대조군: stop 생략 시 B `completed`) | 타이밍 우연 가능성의 완전 배제 |

따라서 **CRITICAL 의 구체적 예측("B 가 completed 로 끝나 테스트가 실패한다")은 반증**됐지만,
그 반증이 "전파가 설계된 기전으로 보장된다" 를 뜻하지는 **않는다**. e2e 파일 JSDoc 과 본
문단 모두 이 구분을 명시하도록 정정했다.

**후속**: 엔진 단위 테스트(mock, ms 단위)로 "선형 두 노드 사이 Execution 이 외부에서
cancelled 로 바뀌면 다음 노드가 dispatch 되지 않는다" 를 결정적으로 고정할 것 →
`plan/in-progress/node-cancellation-residual-signal-propagation.md` 에 항목 추가.

**단언의 성격**: 본 e2e 는 내부 기전이 아니라 **spec §5 가 약속하는 관측 가능한 계약**
(실행이 `cancelled` 로 확정 + 하류 미실행)을 잠근다. 기전이 `abortSignal` 이든 guarded UPDATE
든 계약이 유지되는 한 테스트는 옳다 — 오히려 기전에 결합하지 않은 것이 설계 의도다.

## §W2 — spec `status: implemented` 승격 vs §6 잔여 항목 (사용자/planner 판단 필요)

3명(scope·side_effect·documentation)이 중복 지적한 실질 발견이다.

- 승격 자체는 규약 준수다 — `spec-status-lifecycle` 가드 (c) 가 "마지막 `pending_plans` 가
  `complete/` 로 이동하면 `implemented` 로 승격" 을 **강제**했고, 승격 없이는 빌드가 red 다.
- 그러나 본문 §6 표에 chat-channel/MakeShop/Cafe24 signal 전파, workflow-timeout abort 등
  **4개 항목이 "미구현(Planned)"** 으로 남아 있고, `pending_plans` 제거로 이를 추적하는 활성
  plan 이 **전무**해졌다. "implemented" 라벨과 본문이 어긋난다.

**해소 (사용자 결정 A)**: 두 갈래 — (a) 잔여를 추적할 새 plan 신설 + `status: partial` 복원,
(b) out-of-scope 근거를 본문에 명시하고 승격 정당화 — 중 **(a)** 를 사용자가 선택했다.

조치: `plan/in-progress/node-cancellation-residual-signal-propagation.md` 신설 →
`pending_plans` 재충전 → `status: partial` 복원. 가드 (b)(비어있지 않은 `pending_plans`)와
(c)(전부 완료 시에만 승격)를 함께 만족한다. **되돌림이 아니라 누락됐던 추적의 복원**이다.

### 부수 — stale 추적 포인터 4곳 (같은 결함 클래스, 함께 정정)

§6 표 2행 + legend + §2.1 이 추적 plan 으로 **이미 `complete/` 로 이동한**
`node-cancellation-infrastructure.md` 를 가리키고 있었다(2026-06-28 완료). 죽은 포인터는
"추적 중" 이라는 인상만 남기고 실제로는 아무도 안 본다 — **이번 불일치가 생긴 경로 그
자체다**. 전부 신규 plan 으로 재배선(잔존 0 확인).

§2.1 의 **IE multi-turn resume signal 미전파**는 리뷰어가 지목한 4항목 밖이지만 동일 클래스라
신규 plan 에 5번째 항목으로 담았다. 완화 있음(AI Agent app-level 타임아웃이 자체
`AbortController` 로 무기한 hang 을 상한) → 정합성 위험이 아니라 응답성 갭.

## 범위 메모 (I2)

3번째 테스트("취소된 실행은 재-stop 을 거부한다")는 plan §3 의 acceptance criteria(다단계 cancel
전파)를 다소 벗어난다. terminal 재진입 방지는 같은 stop 계약의 인접 표면이라 함께 잠갔으나,
plan 완료 서술에 범위 밖임을 명시한다.

## TEST 결과

- lint: **PASS**
- unit: **PASS** (14)
- build: **PASS**
- e2e: **PASS** — 259 tests. 본 spec `PASS test/node-cancellation-propagation.e2e-spec.ts`
  를 로그 ANSI 제거 후 직접 grep 으로 확인(wrapper 요약 숫자만 신뢰하지 않음). skipped 0.

## 보류·후속 항목

- **W2 파생** — 잔여 5항목(채널/커머스 signal 전파 3 · workflow-timeout 노드 abort ·
  IE resume signal)은 신규 plan
  `node-cancellation-residual-signal-propagation.md`(P3)가 추적한다. 본 PR 범위 밖.
- **C1 파생** — 선형 실행 경로의 `abortSignal` 배선 여부: 현행 계약 위반이 아니므로 본 PR 범위
  밖. 개선으로 다루려면 별건.
- 무관 발견: push 게이트 미발동 → `plan/in-progress/harness-push-gate-did-not-fire.md` (P1) 로
  별도 등록됨(본 리뷰 대상 아님).
