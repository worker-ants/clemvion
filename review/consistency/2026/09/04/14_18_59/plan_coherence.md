# Plan 정합성 검토 — `plan/in-progress/spec-draft-scope-and-anchor-drift.md`

## 발견사항

- **[WARNING]** ①②③ 이 같은 worktree 의 자매 plan `spec-draft-nullable-notation-followups.md` 의
  열린 후속 항목 3건을 그대로 해소하는데, target 이 그 사실을 명시하거나 해당 체크박스를
  닫겠다고 선언하지 않는다
  - target 위치: `plan/in-progress/spec-draft-scope-and-anchor-drift.md` ①(§5.4 스코프 문단),
    ②(`3-schedule.md` §2.1 NULL 표시), ③(§2.2 자원 액션 패턴)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` `## 후속 (이 draft
    범위 밖 — 등재만)` 섹션의 unchecked 항목 3개, 그리고 `## 종결 조건` 이 이 5개(§5.4 drift
    배치·`idx_schedule_next_run`·**§2.2 단일 동사 패턴**·**§5.4 응답 바디 스코프 문구**·
    **`3-schedule.md` §2.1**)를 종결 조건으로 명시한 부분
  - 상세: 세 항목의 출처 표기가 **글자 그대로 일치**한다 —
    target ①의 `--impl-done 11_33_21 cross_spec` = 자매 plan `§5.4 응답 바디 스코프 문구`
    항목의 `(planner, --impl-done 11_33_21 cross_spec)`.
    target ②의 `--spec #1277 INFO#2` = 자매 plan `3-schedule.md §2.1` 항목의 `(--spec INFO#2)`.
    target ③의 `--spec #1277 W2` = 자매 plan `§2.2 단일 동사 action 패턴` 항목의
    `(--spec W2)`, 심지어 그 항목 자체가 "이쪽은 다른 영역의 경로 패턴이고 실측부터
    다시 해야 한다" 며 target 이 지금 하고 있는 바로 그 작업(185개 라우트 전수 실측)을
    예고해 두었다. 세 항목 모두 **같은 사실관계**를 다루므로 내용 충돌은 없지만, target 이
    자매 plan을 이름으로 인용하는 곳은 ①의 "왜 중요한가" 절(104곳 drift 배치 언급) 하나뿐이고
    거기서도 이 세 후속 체크박스는 언급하지 않는다. target 이 착지해 실제 spec 이 바뀌면
    자매 plan 의 체크박스·종결 조건은 stale 이 되어 (a) 이미 끝난 일을 다시 조사하거나
    (b) `complete/` 이동 판정 시 "왜 이 셋이 그대로 열려 있나" 를 다시 추적해야 하는
    비용이 생긴다. 참고로 target 자신의 ④는 같은 패턴(선행 plan
    `spec-conventions-engine-error-code-surface.md` 의 후속 항목을 이번 draft 가 해소함)에
    대해 "그 plan 의 후속 항목도 함께 고친다" 라고 명시적으로 적어 두어 대조된다 — ①②③에는
    이 문장이 빠져 있다.
  - 제안: target 문서에 (④가 이미 하듯) "이 변경이 착지하면
    `spec-draft-nullable-notation-followups.md` 의 §5.4 응답 바디 스코프 문구·§2.2 단일 동사
    패턴·`3-schedule.md` §2.1 세 체크박스도 함께 닫는다" 는 한 줄을 추가하거나, PR 커밋 시
    자매 plan 파일도 같은 턴에 갱신한다. 두 plan 이 같은 worktree 에서 동시에 진행 중이므로
    지금 시점에 조율하는 편이 `complete/` 이동 시점에 재조사하는 것보다 싸다.

- **[INFO]** ④ 는 자매 plan 후속 항목을 명시적으로 인용·해소하는 좋은 선례이나, 세 하위 항목
  중 두 개만 닫는다는 점을 재확인해 둘 만하다
  - target 위치: ④-a/④-c
  - 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` `## 할 일`
    셋째(미체크) 항목 — `1-data-model.md:474`·`error-codes.ts` JSDoc·`3-error-handling.md §1.4`
    세 하위 불릿을 하나의 체크박스로 묶어 둠
  - 상세: target 은 이 중 `1-data-model.md:474/:562` 와 `3-error-handling.md §1.4` 두 곳을
    고치고, `error-codes.ts` JSDoc 은 "spec 이 아니라 코드 주석이라 developer 트랙" 이라며
    명시적으로 넘긴다(`## 넘기는 것`). 자매 plan 의 체크박스 자체는 세 하위 항목을 하나로
    묶어 두었으므로, target 이 착지해도 그 체크박스는 (developer 트랙 잔여가 남아) 곧바로
    닫히지 않는다 — 이는 의도된 부분 해소이고 target 이 이미 그 경계를 명시하므로 충돌은
    아니다. 다만 자매 plan 쪽에서 "이 체크박스는 부분 해소됨(2/3), 잔여는 developer 트랙" 임을
    반영하지 않으면 그 plan만 보는 사람이 진행 상황을 오판할 수 있다.
  - 제안: target 의 변경이 착지할 때 `spec-conventions-engine-error-code-surface.md` 의 해당
    항목을 세 개의 하위 체크로 쪼개거나, 두 곳 완료·JSDoc 잔존을 문장으로 반영한다 (target 이
    이미 "그 plan 의 후속 항목도 함께 고친다" 라고 적어 두었으니 그 실행만 확인하면 됨 —
    낮은 위험).

- **[INFO]** ①③ 이 같은 파일(`spec/5-system/2-api-convention.md`)의 §5.4·§2.2 를 동시에
  건드리는데, target 문서에는 "나란히 가는 plan" 류의 동시-편집 경고가 없다
  - target 위치: 문서 전체 (①·③)
  - 관련 plan: 이 worktree 자체(`spec-draft-nullable-notation-followups.md`)가 이미 §5.4·§2.2
    양쪽을 앞서 편집해 실제 spec 에 반영해 두었음을 실측 확인함(`spec/5-system/2-api-convention.md`
    §5.4 세 갈래 DTO 규칙·§2.2 `/api/auth/*` 예외 행이 이미 존재) — 즉 target 의 ①③은 그
    바로 다음 레이어(스코프 문단 추가·자원 액션 예외 행 추가)를 쌓는 것이라 텍스트 충돌
    위험은 낮으나, 두 draft 가 같은 세션에서 같은 파일을 순차적으로 편집하고 있다는 사실
    자체는 `spec-conventions-engine-error-code-surface.md` 가 이미 쓴 "나란히 가는 plan"
    관례를 따라 명시해 둘 만하다.
  - 상세: 실측(2026-09-04) — `2-api-convention.md` §5.4 는 이미 "키 생략/`null`(상시 존재)"
    세 갈래 DTO 규칙을 담고 있고(자매 plan ③ 변경안 반영 완료), §2.2 는 이미 `/api/auth/*`
    세 번째 예외 행을 담고 있다(자매 plan ② 변경안 반영 완료). target 의 제안은 이 위에
    스코프 문단·네 번째 예외 행을 **추가**하는 것이라 내용 모순은 없다.
  - 제안: 낮은 우선순위. 착수 순서만 명확히 하면(자매 plan 이 먼저 반영됐다는 사실은 이미
    실측으로 확인됨) 충분하고, 별도 조치 없이도 통과 가능.

## 요약

target 은 스스로 실측(185개 라우트 전수 조사·AST 기반 재측정 등)에 기반해 새로운 결정을
일방적으로 내리는 곳은 없고, 오히려 §④에서는 선행 plan(`spec-conventions-engine-error-code-surface.md`)의
"삼분법" 전제를 실측으로 정정하면서 그 plan 의 후속 항목을 함께 고치겠다고 명시하는 등 plan
간 정합을 잘 관리하고 있다. 다만 같은 worktree 에서 동시에 진행 중인 자매 draft
`spec-draft-nullable-notation-followups.md` 의 `## 후속` 섹션에 있는 미체크 항목 3개
(§5.4 응답 바디 스코프 문구·§2.2 단일 동사 action 패턴·`3-schedule.md` §2.1)를 target 의
①②③ 이 출처 표기(`--impl-done 11_33_21`·`--spec #1277 INFO#2`·`--spec #1277 W2`)까지
일치하도록 그대로 해소하면서도, 그 사실을 명시적으로 연결하거나 자매 plan 의 체크박스를
함께 닫겠다고 선언하지 않는다. 내용 충돌은 없으므로 CRITICAL 은 아니지만, 두 plan 이 같은
세션에서 동시 진행 중이라는 점을 고려하면 착지 시점에 자매 plan 을 함께 갱신하도록 지금
연결해 두는 것이 값싸다.

## 위험도

LOW
