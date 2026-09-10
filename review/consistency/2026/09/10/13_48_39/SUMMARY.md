# Consistency Check 통합 보고서 — `--impl-prep spec/2-navigation/`

**BLOCK: YES → 해소** (Critical 3건, 전부 **동일 사안**. T-4 를 이 PR 에서 분리해 해소)

> 이 파일은 호출자(main)가 썼다 — `SUMMARY.md` basename 은 sub-agent Write 가 훅으로 차단된다.
>
> **이 SUMMARY 는 늦게 작성됐다.** 구현·검증을 마친 뒤 `/ai-review` 의 `documentation` reviewer 가
> *"이 세션에 필수 `SUMMARY.md` 가 없다"* 고 지적해서야 알았다. `--spec` 세션 두 개는 썼는데 이
> `--impl-prep` 세션만 빠뜨렸다 — 빈/부분 세션이 게이트를 거짓 통과시키는 형태라, 지적이 없었으면
> 그대로 넘어갔을 자리다.

**대상**: `plan/in-progress/trigger-workflow-ref-canary.md` (developer 턴, `TriggerDto.workflow` 캐너리)
**스코프**: `spec/2-navigation/` · 예산 `CONSISTENCY_MAX_CONTEXT_SIZE=900000`

## 집계 (5개 리포트 원문을 파싱해 산출)

| Checker | 위험도 | Critical | Warning | INFO |
|---|---|---|---|---|
| `convention_compliance` | HIGH | **1** | 1 | 1 |
| `plan_coherence` | CRITICAL | **1** | 1 | 0 |
| `rationale_continuity` | CRITICAL | **1** | 1 | 1 |
| `naming_collision` | LOW | 0 | 1 | 6 |
| `cross_spec` | NONE | 0 | 0 | 2 |
| **합계** | — | **3** | **4** | **10** |

> 계획서에 처음 "Warning 2" 라 적었다 — **틀렸다, 4건이다.** `documentation` reviewer 가 잡았다.
> 이 세션에서 개수를 틀린 것이 이것으로 네 번째다(앵커 116→96 · 헤딩 8/2→9/3 · 길이 표 2회 · 여기).

## Critical — 세 checker 가 독립적으로 같은 조항을 짚었다

**자기-반증형 소정정(`CLAUDE.md`) 조건 1 오판정.** 계획서 T-4 는 `spec/2-navigation/2-trigger-list.md §3`
의 *"이 축에는 캐너리가 아직 없다"* 를 developer 턴에서 직접 고치려 했고, 조건 1(*"대상 문장을
developer 자신이 그 문서에 썼다"*)을 *"✅ #1304, `git blame` 으로 확인 가능"* 이라 판정했다.

**세 신호가 전부 planner 를 가리킨다** (세 checker 가 각각 독립 실측):

| 신호 | 실측 |
|---|---|
| `dc77317cd` 의 diff 스코프 | `codebase/` **0건** — 순수 spec |
| 그 커밋이 인용한 게이트 | **`--spec`** = planner 의무 게이트 (developer 경로는 `--impl-done`) |
| 그 작업 plan 의 `owner:` | `spec-draft-schedule-trigger-ref-nav.md` → **`owner: planner`** |

그리고 **`git blame` 은 이 판별에 쓸 수 없다** — 이 저장소는 모든 역할의 커밋이 같은 git
author(`worker-ants`)다. 계획서가 조건 1 의 검증 방법으로 든 것이 **구조적으로 성립하지 않는
방법**이었다. `CLAUDE.md` 는 다섯 조건 **전부** 충족을 요구하므로 예외 전체가 무효다.

`rationale_continuity` 가 결정적 선례를 찾아냈다 — **`#1292` 가 같은 패턴을 올바르게 처리했다**:
*"자기-반증형 소정정 예외는 쓸 수 없다 … 그 문장은 planner 턴이 등재한 것이라 조건 1이 깨진다.
우회하지 않고 planner 턴을 열었다."* 같은 세션이 맞게 한 판단을 몇 시간 뒤 뒤집었다.

**해소**: T-4 를 이 PR 에서 빼내 planner 후속 한 턴(§3 문장 정정 + `code:` 등재 + `PROJECT.md` 한 줄)
으로 분리했다. `spec_impact` 를 `none` 으로 내리고 diff 에서 `spec/` 을 0건으로 만들었다.
`convention_compliance` 는 *"코드 자체(T-1~T-3)에는 구조적 결함이 없어 착수를 전면 차단할 사안은
아니다"* 라고 명시했다.

## Warning 4건 — 전부 반영

| Checker | 지적 | 처분 |
|---|---|---|
| `rationale_continuity` | 조건 1 이 해소돼도 **조건 2 가 애매**하다 — 그 문장이 §5.4 판정 근거·`id`/`name` 비대칭 **계약 설명**과 한 문단에 섞여 있어 "예고 vs 계약" 경계가 불명확 | planner 후속에 "그 경계를 한 줄로 판정해 기록" 을 명시 |
| `convention_compliance` | `PROJECT.md` 문면은 e2e 헬퍼를 `test/helpers/` 로 보내는데, **그 자리에 두면 self-spec 이 어느 러너에도 안 걸려 죽은 테스트가 된다**(unit jest `rootDir:'src'` · e2e jest `.e2e-spec.ts$`) | `src/shared/testing/` 선택 근거를 헬퍼 docstring 에 명시. `PROJECT.md` 한 줄 보강을 planner 후속에 등재 |
| `naming_collision` | `expectTriggerWorkflowRef` 는 지금 안전하나, 장래 `expectScheduleTriggerWorkflowRef` 가 생기면 **접두어 하나 차이** — 두 DTO 가 경고하는 그 패턴이 함수명으로 전이 | docstring 에 장래 명명 규칙(`Narrowed` 유지)을 미리 못박음 |
| `plan_coherence` | 계획서가 *"등재 항목은 두 번째 불릿만 지적했다"* 고 **과대주장** — 항목은 이미 blockquote 축까지 지적하고 처방까지 달았고, 계획서가 두 문단 뒤에서 스스로 인정하고 있었다(자기 문서 내 모순) | 정정. 실측 신규 발견은 백오프 수치 한 곳뿐 |

## INFO 중 실제로 설계를 바꾼 것

- **`cross_spec`**: `TriggerDto` 반환 경로를 독립 열거해 **정확히 넷**임을 확인(rotate 3종·history·DELETE 는
  대상 밖). 그리고 **생성의 chatChannel 서브경로도 `relations` 없이 재조회**한다는 것을 짚어 —
  음성 단언이 하나 늘었다(생성 두 서브경로를 각각 문다).
- **`cross_spec`**: *"외부 호출 배선 불필요"* 가 *"네트워크 시도 없음"* 으로 오독될 수 있다 — 실제로는
  때리고 실패가 삼켜진다. 이 지적으로 타임아웃 설계를 다시 했고, **실측 271~302ms**(DNS 즉시 실패)로
  추정(~36초)이 100배 과대였음이 드러났다.
- **`naming_collision`**: `2-trigger-list.md` `code:` 에 신규 e2e 미등재 — `3-schedule.md` 가 세운
  선례("註에 'e2e 가 고정한다' 고 적으면서 그 파일을 등재하지 않으면 보장의 근거가 추적 불가")를
  따르지 않을 위험. planner 후속에 등재.

## 검증 절차 기록

번들은 5개 프롬프트 전부 `2-trigger-list.md`·`3-schedule.md` 를 전문 적재했다(각 ~1MB).
이 브랜치는 **트래커를 게이트 준비 뒤에 편집**했다 — 앞선 세션들에서 큰 트래커를 먼저 건드려
tier 1 이 폭증해 대상이 밀려났던 결함의 회피다.
