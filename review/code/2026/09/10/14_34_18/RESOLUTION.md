# RESOLUTION — `review/code/2026/09/10/14_34_18`

`SUMMARY.md` 의 Critical 2 · Warning 16 에 대한 처분. 작성자는 호출자(main)다.

## 왜 RESOLUTION 이 필요한가

전체 위험도가 **HIGH** 이고 Critical 표에 행이 있다 — `review_guard._summary_is_resolved()` 는
그 형태를 "미처분" 으로 본다. 등급을 낮춰 게이트를 통과시키는 것이 아니라, **HIGH 를 그대로 두고
처분을 여기 적는다.** HIGH 의 사유가 이 diff 가 아니라 저장소의 사전 상태라는 것이 이 문서의 요지다.

## Critical 2건 — 수정하지 않았다. 그 이유를 적는다

| # | 사안 | 왜 이 PR 에서 안 고치나 | 어디로 갔나 |
|---|---|---|---|
| 1 | chatChannel PATCH 가 bot-token single-path 를 우회 | **이 diff 는 프로덕션 코드를 한 줄도 바꾸지 않는다**(테스트 3파일 신규). 수정은 `ChatChannelConfigDto` 를 PATCH/POST 로 갈라 API 계약을 바꾸는 일이고, spec §5.4.1/R-CC-10 의 재해석이 따라온다 — 캐너리 PR 에 얹으면 **두 관심사가 한 diff 에 섞이고** 되돌리기 어려워진다. `api_contract` 자신도 *"이 PR 을 차단할 사유는 아니다"* 라고 판정했다 | `plan/in-progress/spec-draft-nullable-notation-followups.md` — 기존 "질문" 항목을 **CRITICAL 판정 완료**로 승급하고, 건너뛰는 세 단계(grace 백업 · 전용 audit action · `chatChannelRotatedAt`)를 표로 기록. 처방 두 안 비교까지 |
| 2 | `ChatChannelCard` 편집-저장이 항상 400 | 위와 **같은 수정으로 닫힌다**(서버 DTO 분리). 프런트만 고치는 길은 원리적으로 막혀 있다 — 서버가 `botToken` 을 응답에서 strip 하므로 재전송할 값을 가질 수 없다. 또한 **나도 브라우저 재현을 하지 않았다** — 정적 대조 + 인접 실측(내 e2e 가 같은 필드로 400 을 받았다)까지다 | 같은 트래커 — **신규 버그 항목**으로 등재. *"착수 시 먼저 재현할 것"* 을 명시했다 |

> **판정 자체는 내가 미룬 것을 리뷰가 대신했다.** 나는 이 사안을 *"두 갈래 다 가능하다"* 로
> 등재했는데(정책이 ref 금지만 뜻하는가 vs 실제 갭인가), **실제 답은 그 이분법 밖**이었다 —
> 정책이 강제되는 층(필드명)과 정책이 보호하려는 대상(값 교체)이 **다른 층에 있다**. 스코프를
> 넓히지 않고 질문으로 등재한 판단 자체는 reviewer 도 *"적절하다"* 고 확인했다.

## Warning — 코드 수정 12건 (이 턴에 적용)

전부 `codebase/backend/**` 안이다.

| # | 파일 | 수정 |
|---|---|---|
| 1 | `shared/testing/trigger-workflow-ref.ts` | `expectedWorkflowId?: string` 인자 추가 — `present:true` 일 때 identity 고정 (testing W1) |
| 2 | 같음 | `expect(dto).not.toBeNull()` 을 `toBeDefined()` 앞에 — 최상위 `null` 이 부재 판정을 통과하던 구멍 (testing W2) |
| 3 | 같음 | 손으로 짠 UUID 정규식 → `common/utils/uuid` 의 `isUuidShaped` import (maintainability W2) |
| 4 | 같음 | `assertMatchesContract` 서술을 *"못 잡는다"* → *"이 분기에 그 검증자를 거는 호출이 0건"* 으로 좁힘 (requirement W2) |
| 5 | 같음 | `tsconfig.build.json` exclude 단정을 실측으로 좁힘 — exclude 는 root 후보만 거르고 import 하면 emit 된다, ambient `@types/jest` 라 컴파일 에러도 안 난다, 현재 import 0건, **감지 가드 없음** (side_effect W1) |
| 6 | 같음 | 비밀 컬럼 목록에 **3중 사본 드리프트 경고** + repo-guard 처방 + `CREATOR_PROJECTION` 선례. **`User` 선례 인용은 철회** (maintainability W1 · security W1) |
| 7 | 같음 | 자매 헬퍼와의 차이에 **오용 방향 비대칭**을 추가 — 자매를 `TriggerDto` 에 쓰면 시끄럽게 실패하지만 이 헬퍼를 좁힌 참조에 쓰면 **조용히 통과**한다 |
| 8 | `shared/testing/trigger-workflow-ref.spec.ts` | 비-문자열 `name` 4값 · 비-문자열 `id` · 최상위 `null` 양방향 · `expectedWorkflowId` 불일치 — **4 케이스 추가**(8 → 12) (testing W3) |
| 9 | 같음 | 헤더에 *"비밀 컬럼 이름을 여기 다시 적는 것은 일부러다"* 를 명시 — 헬퍼 상수를 import 해 순회하면 목록이 줄어도 통과해 **대조군이 사라진다**. 스펙↔헬퍼 중복은 DRY 대상이 아니다 |
| 10 | `test/trigger-workflow-ref.e2e-spec.ts` | `it()` 라벨 `1.`~`5.` → `A.`~`E.`(실측 — `origin/main` 의 e2e 순번 라벨은 20파일/132개가 전부 문자, 숫자는 내 파일 하나뿐) + 문서 지칭 4곳 동기 (maintainability INFO) |
| 11 | 같음 | 타임아웃 상수를 **측정값 vs 최악값**으로 문서화하고 `SETUP_TIMEOUT_MS = CHAT_CHANNEL_TIMEOUT_MS * 2` 로 파생 — 두 숫자가 같은 근거를 공유함이 코드에 드러난다 |
| 12 | 같음 | `afterAll` 에 `secret_store` 고아 row 경계 명시 — *"'row 정리 불필요' 를 `secret_store` 까지 검증한 것으로 오인하지 말 것"* (side_effect W2) |

### 수정이 실제로 무는지 확인했다

세 신규 단언(`name` 타입 · identity · 최상위 `null`)을 **각각 지우는 뮤턴트**를 넣어
`Tests: 1 failed, 11 passed, 12 total` — **하나씩 정확히 1건만 RED**. 원복 후 `12 passed`.
GREEN 은 증거가 아니므로 이 확인 없이는 W3 를 "고쳤다" 고 말할 수 없다.

**캐너리 자신의 판별 속성도 다시 증명했다.** 헬퍼를 바꿨으니 원래 측정(옛 헬퍼)이 현재 코드에
대한 증거가 아니게 된다 — 뮤턴트 재주입 → `make e2e-up` → 재실행: **`Tests: 1 failed, 4 passed`**
(E 만 RED) → 원복·재빌드 후 **5/5 GREEN**.

### 4단계 재실행 (수정 후)

| 단계 | 결과 |
|---|---|
| `lint` | PASS (56s) |
| `build` | PASS (163s) — `backend 197건/36파일` · `frontend 52건/15파일` 둘 다 **baseline 일치** |
| `unit` | PASS (82s) — backend `454 suites / 9,521 tests`(신규 4건 반영, 전 9,517) · frontend·webchat `48 tests` |
| `e2e` | PASS (235s) — `tests=305` + playwright |

> 두 타입체크 ratchet 은 **직접 실행**했다. `run-test.sh` 4단계 GREEN 은 그 축에 대해 아무 말도
> 하지 않는다 — `build` 는 테스트 경로를 exclude 한 `tsconfig.build.json` 을 쓰고 jest 는 타입을
> strip 한다.

## Warning — 코드 밖으로 이관 4건

| # | 사안 | 어디로 | 왜 여기서 안 하나 |
|---|---|---|---|
| 1 | 비밀 컬럼 3중 복사 → repo-guard (maintainability W1 · security W1) | 트래커 신규 항목 | 정본이 `export` 되지 않아 import 불가. 서비스 모듈을 테스트 헬퍼로 끌어오는 것은 의존 그래프상 과하다 → **정적 가드**가 답이고 그 자체가 별 작업이다 |
| 2 | `production-build-devdep-guard` 가 import 도달을 못 본다 (side_effect W1) | 트래커 신규 항목 | 가드를 "exclude 목록에 없다" 에서 **"emit 된 `dist/` 에 없다"** 로 바꾸는 일 — **존재 검사 → 도달 검사**. harness 변경이고 현재 import 0건이라 이론 단계 |
| 3 | e2e teardown `secret_store` 관례 (side_effect W2 · testing INFO) | 트래커 신규 항목 | 처방 (a)(raw DELETE → `DELETE /api/triggers/:id`)는 **두 파일의 관례 변경**이고, 캐너리의 음성 케이스가 삭제 순서에 민감해 실측이 선행돼야 한다 |
| 4 | schedule 타입 `workflow` 양성 커버리지 0건 (testing INFO) | 트래커 신규 항목 | `schedule-trigger.e2e-spec.ts` 는 이 PR 의 대상 파일이 아니다. 헬퍼가 생겼으니 다음 턴에 두 줄이다 |

## Warning — planner 권한 2건

`spec/` 는 developer 권한 밖이다(`CLAUDE.md`). 자기-반증형 소정정 예외는 **조건 1 불성립**으로
`--impl-prep` 세 checker 가 독립 CRITICAL 을 올렸다 — 그 문장은 planner 가 썼다.

| # | 사안 | 처분 |
|---|---|---|
| 1 | `2-trigger-list.md §3` 의 *"이 축에는 캐너리가 아직 없다"* 가 거짓이 됐다 (requirement W3 SPEC-DRIFT) | planner 후속 **1번**(기존 등재) |
| 2 | 캐너리가 고정하는 것이 **계약인지 구현인지** spec 이 말하지 않는다 (api_contract W2) | planner 후속 **4번**(이 라운드에서 신규 추가) |

## 이 리뷰 뒤에 코드가 한 번 더 바뀌었다 — `--impl-done` 이 13번째 수정을 요구했다

이 SUMMARY/RESOLUTION 을 쓴 **뒤에** `--impl-done`(`review/consistency/2026/09/10/15_23_41`)의
`rationale_continuity` W1 이 코드 수정 한 건을 더 요구했고 반영했다. 이 문서를 그 사실 없이
남기면 *"리뷰 시점 코드 = 머지되는 코드"* 가 거짓이 되므로 여기 적는다.

| # | 파일 | 수정 |
|---|---|---|
| 13 | `test/trigger-workflow-ref.e2e-spec.ts` | case E docstring 에 **R-CC-10 위반 재현 경고** 블록 + 인라인 주석 한 줄. `grep` 실측으로 그 파일에 `R-CC-10`·`rotate-bot-token`·`우회` 가 **0건**이었다 — 즉 위 Critical 1 의 맥락이 plan 문서에만 있고 코드에는 없었다 |

**왜 주석이 실질인가.** 참조가 없으면 ① 다음 사람이 case E 의 `200` 을 *"PATCH + `botToken` 은 정상
계약"* 으로 읽고, ② 후속 처방(PATCH 전용 DTO 로 `botToken` 제외)이 들어올 때 이 요청이 400 이 되는데
**왜 바디를 바꿔야 하는지** 코드만 보고 추적할 수 없다. 한 문장으로 줄이면 — 참조가 없으면
**캐너리가 고쳐야 할 동작을 지키는 쪽으로 작동한다.**

**8 reviewer 가 이 13번째 수정을 본 것은 아니다.** 주석 전용 변경이고 단언·요청 바디·기대값을 한 글자도
바꾸지 않았다(`git diff` 로 확인 가능). 그래도 **4단계를 다시 돌렸다** — 이 저장소의 e2e 면제 규칙은
화이트리스트 부분집합 판정이고 *"주석-only 라 영향 없다"* 는 면제 사유가 아니다.

## 처분 요약

- Critical 2 → **전량 트래커 등재**(둘 다 사전 존재 프로덕션 결함, 이 diff 밖, 한 수정으로 닫힘)
- Warning 16 → **코드 수정 12** + **트래커 4** + **planner 2** (일부 항목이 복수 reviewer 에 걸쳐
  중복 계상되므로 12+4+2 ≠ 16 — 사안 단위로는 전량 처분)
- 신규 코드 결함 **0건.** 반증된 것 3건은 전부 **내가 쓴 근거 문장**이었다.
- 이 리뷰 뒤 `--impl-done` 이 요구한 수정 **1건**(위 절) — 누적 코드 수정 **13건**.
