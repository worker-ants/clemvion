# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-scope-and-anchor-drift.md`

## 검토 방법

target draft 는 4항목(① `api-convention.md §5.4` 스코프 명시, ② `3-schedule.md §2.1` NULL 표시,
③ `api-convention.md §2.2` 자원 액션 패턴 성문화, ④ `1-data-model.md`/`3-error-handling.md`
에러 코드 소속 표기) 모두 **기존 텍스트에 스코프·근거·앵커를 덧붙이는 문서 정정**이며 새
엔티티·API·요구사항 ID 를 만들지 않는다. 이에 맞춰, 번들에 실린 관련 spec 본문뿐 아니라
실제 저장소(`spec/**`, `codebase/backend/src/**`)를 직접 열어 각 항목의 실측 인용이 다른
영역의 서술과 **모순되는지**, 그리고 target 이 손대는 절의 **이웃 절과 충돌하는지**를
확인했다.

## 발견사항

- **[WARNING]** §2.2 신설 "자원 액션" 규칙이 §12.1 "상태 토글 패턴" 과의 경계를 안 그음
  - target 위치: `plan/in-progress/spec-draft-scope-and-anchor-drift.md` "③ §2.2 — 자원 액션 패턴 성문화" · 변경안 (A)
  - 충돌 대상: `spec/5-system/2-api-convention.md` §12.1 "상태 토글 패턴" (현재 파일 기준 line 403-417)
  - 상세: §12.1 은 *"리소스의 상태 필드를 토글(활성/비활성 등)할 때는 전용 엔드포인트를
    만들지 않고 PATCH 본문에 포함"* 하라며 `POST /:id/activate`, `POST /:id/deactivate` 류의
    verb 엔드포인트를 **명시적으로 금지**한다. target 이 §2.2 에 추가하려는 새 행은
    *"`/api/{resource}/{id}/{action}` 의 마지막 세그먼트는 자원이 아니라 **동사(구)**"* 라고만
    적어, boolean 토글 필드에 대한 verb 액션도 이 새 규칙으로 정당화될 수 있는 것처럼 읽힌다.
    현재 §2.2 의 기존 RPC-style 예외 문구조차 `disable-*` 를 합법 패턴 예시로 들고 있어
    (`/api/{resource}/{id}/{channel}/{action}`, e.g. `rotate-*`·`revoke-*`·`disable-*`) 이미
    같은 결의 잠재적 긴장이 있었으나, target 이 §2.2 에 4번째(비-예외, "규칙") 행을 추가하며
    그 긴장을 다시 노출한다. 실제 코드에 `activate`/`deactivate`/`enable`/`disable` 형태의
    action 엔드포인트는 없어(grep 확인, 33개 동사 목록에도 없음) **지금 당장 깨지는 계약은
    없다** — 다음 사람이 boolean 필드에 대해 verb 엔드포인트를 새로 만들 때 이 새 규칙을
    §12.1 대신 인용할 潜재 위험이다.
  - 제안: 변경안 (A) 의 새 행 말미에 한 문장 추가 — 예: *"boolean 상태 필드의 단순 토글에는
    적용하지 않는다 — 그건 §12.1 PATCH 패턴을 따른다. 본 패턴은 필드 하나로 표현되지 않는
    부작용 동작(재시도, 되돌릴 수 없는 전이 등)에 한한다."* 두 절을 서로 참조시키면 향후
    §2.2 인용만으로 §12.1 을 우회하는 오독을 막을 수 있다.

- **[INFO]** 자매 plan `spec-draft-nullable-notation-followups.md` 의 후속 체크리스트 3건과
  target 대상이 사실상 동일 — 반영 후 동기화 누락 위험
  - target 위치: `plan/in-progress/spec-draft-scope-and-anchor-drift.md` 전체(①②③)
  - 충돌 대상: `plan/in-progress/spec-draft-nullable-notation-followups.md` `## 후속` 섹션의
    열린 체크박스 — *"§2.2 단일 동사 action 패턴"*, *"§5.4 에 '응답 바디 한정' 스코프 문구"*,
    *"`3-schedule.md` §2.1 에 `next_run_at` NULL 표시 규칙"*
  - 상세: 확인해 보니 이 세 항목은 그 plan 이 *"별 턴을 요구한다"* 며 명시적으로 이월해 둔
    것이고, target draft 가 정확히 그 세 턴을 수행한다 — 내용 충돌이 아니라 **의도된
    연속**이다(target 도 `spec-draft-nullable-notation-followups.md` 를 §① Rationale 에서
    인용해 계보를 인지하고 있다). 다만 target 자신은 그 plan 의 체크박스를 닫는 절차를
    본문에 적지 않았다 — 이대로 반영하면 같은 작업이 두 plan 파일에 "열림"/"닫힘"으로
    불일치 상태가 된다. `spec-draft-nullable-notation-followups.md` 종결 조건도 이 세
    체크박스가 닫히는 것을 요구하므로 방치 시 그쪽 plan 이 영구히 완결되지 못한다.
  - 제안: target 반영 커밋(또는 후속 커밋)에서 `spec-draft-nullable-notation-followups.md`
    의 해당 세 체크박스를 `[x]` 로 닫고 target 문서를 근거로 교차 링크한다. 이 정정은
    cross-spec 이 아니라 plan lifecycle 영역이라 `--plan-coherence` 류 점검이 이미 잡을 수
    있으니 중복 조치 여부만 확인.

- **[INFO]** ② `3-schedule.md §2.1` 변경안이 인용하는 `1-data-model.md §2.9` 는 NULL 원인
  중 절반만 문서화 — 더 정밀한 링크 대상이 존재
  - target 위치: `plan/in-progress/spec-draft-scope-and-anchor-drift.md` "② `3-schedule.md` §2.1" 변경안
  - 충돌 대상: `spec/1-data-model.md:260` (`next_run_at` 행) vs `spec/data-flow/10-triggers.md §3.2`
  - 상세: target 변경안 문구는 *"cron 파싱 실패나 다음 발화 시각 부재로 `next_run_at` 이
    NULL 인 경우다"* 라고 두 원인을 함께 적고 `([데이터 모델 §2.9])` 를 링크한다. 그런데
    실측하니 `1-data-model.md:260` 자신은 *"cron 파싱 실패 시 NULL"* 한 가지 원인만 적고
    있고, 두 원인(파서 예외·`computeNextRuns` 빈 결과) 모두를 갖춘 문서는
    `data-flow/10-triggers.md §3.2` 다(이미 두 경로를 정확히 서술 중). 링크가 틀린 것은
    아니지만(§2.9 도 필드 타입 표기로서 유효한 참조), 독자가 §2.9 를 따라가면 두 번째 원인의
    근거를 못 찾는다.
  - 제안: 변경안의 링크를 `[데이터 모델 §2.9](../1-data-model.md)` 대신(또는 병기로)
    `[data-flow §3.2](../data-flow/10-triggers.md#32-schedulenext_run_at-계산)` 로 잡거나,
    그대로 두려면 `2-trigger-list.md:100` 이 이미 쓰고 있는 정확히 같은 표현(§3.2 링크 +
    "비어 있을 수 있다(`-` 표시)")을 선례로 명시해 두 문서의 표기를 맞추는 편이 낫다.

## 항목별 검증 요약 (충돌 없음 확인)

- **① §5.4 스코프**: `api-convention.md §5.4` 를 인용하는 다른 4개 spec 파일 위치
  (`14-external-interaction-api.md` 3곳, `conventions/swagger.md` 1곳)를 전수 확인 — 전부
  **응답 필드** 문맥이었다. 스코프를 "응답 바디 전용"으로 좁혀도 기존 인용 중 깨지는 곳이
  없다.
- **② NULL 표시**: `2-trigger-list.md:100` 이 이미 동일한 문구("cron 파싱 실패 시 비어 있을
  수 있다 — `-` 표시")로 같은 필드(`nextRunAt`)를 문서화하고 있어 target 의 추가가 **기존
  spec 과 정합**임을 확인(중복 발명이 아니라 자매 화면 간 표기 정합).
  `data-flow/10-triggers.md §3.2` 도 동일 사실을 이미 서술 중.
- **③ §2.2 자원 액션**: 저장소 전체에서 "§2.2 의 단일 동사 action 패턴" 을 인용하는 곳은
  `3-workflow-editor/3-execution.md:757` 유일함을 grep 으로 확인 — 다른 문서가 이 문구를
  다른 의미로 쓰고 있지 않다. §2.2 현재 표에 "자원 액션" 규칙이 실제로 없음도 확인(기존
  3개 행은 전부 "예외" 이지 이 규칙이 아니다).
- **④ 에러 코드 앵커**: `error-codes.ts` 실제 소스로 6개 코드의 소속을 재확인 —
  `EXECUTION_TIME_LIMIT_EXCEEDED` → `ErrorCode` const(L14-117), `WORKER_HEARTBEAT_TIMEOUT`/
  `SERVER_INTERRUPTED` → `EngineErrorCode` const(L153-177), `RESUME_FAILED`/
  `RESUME_CHECKPOINT_MISSING`/`RESUME_INCOMPATIBLE_STATE` → `markExecutionCancelled` 파라미터
  유니온(`execution-engine.service.ts:2797-2801`). 전부 target 표와 일치. `ERROR_PORT_FALLBACK`
  의 "에러 클래스 readonly code" 앵커도 `execution-engine.service.ts:315` 에서 확인.
  `CYCLE_DETECTED`/`INVALID_EXPRESSION` 이 `shadow-workflow.ts`·
  `execution-failure-classifier.ts` 에 동명으로 나타나되 **소비자 쪽 어휘**라는 target 의
  주의도 grep 으로 확인(엔진 발행측 아님). 더 나아가 `spec/conventions/error-codes.md` 의
  기존 "적용 범위" 단락이 이미 *"§1 카탈로그의 '엔진 수준 에러' 분류와 1:1 대응하지 않는다
  — 어느 const 에 속하는지를 그 분류로 추론하지 말 것"* 이라고 명시하고 있어, target 이
  `3-error-handling.md §1.4` 10종 중 7종을 "앵커 없음(맨 문자열)" 으로 정정하려는 방향은
  이 기존 규약과 **정확히 부합**한다(모순 없음, 오히려 그 경고를 실증하는 사례).
  `markQueueWaitTimeout` 경로가 `Execution.error` 를 직접 채우고 `cancelled` 로 종결한다는
  ④-b 의 주장도 `4-execution-engine.md`·`3-error-handling.md §1.5`·`data-flow/3-execution.md`
  세 곳 모두와 일치 — 이 draft 가 새로 도입하는 사실이 아니라 이미 다른 영역에 서술된
  사실을 `1-data-model.md` 에도 반영하는 것.
- **선행 plan 전제 정정(`spec-conventions-engine-error-code-surface.md` "삼분법" 주장)**:
  그 plan 의 열린 후속 체크박스 원문을 직접 대조 — target 의 "이 6종에는 raw literal 이 하나도
  없고, 세 번째 앵커 종류(파라미터 유니온)가 있다" 는 정정이 실제로 그 체크박스가 남긴
  "삼분법" 서술을 좁히는 것으로 확인. `spec-conventions-engine-error-code-surface.md` 의
  "적용 범위" 본문과는 상충하지 않는다(그 문서는 코드 소속을 총칭으로만 말하지 특정 6종의
  구성비를 주장하지 않는다).

## 요약

target draft 는 4개 항목 모두 실제 코드(`execution-engine.service.ts`, `error-codes.ts`,
`schedule-runner.service.ts`, `schedules.service.ts`)와 다른 5개 이상 spec 위치
(`2-trigger-list.md`, `data-flow/10-triggers.md`, `14-external-interaction-api.md`,
`conventions/error-codes.md`, `conventions/swagger.md`, `4-execution-engine.md`,
`3-error-handling.md §1.5`, `data-flow/3-execution.md`)를 대조해도 직접 모순이 발견되지
않았다 — 오히려 여러 곳에서 이미 확립된 사실·문구와 강하게 정합했다(②는 `trigger-list.md`
가 같은 문구를 이미 쓰고 있었고, ④는 `error-codes.md` 의 기존 경고 문장을 실증하는 사례임이
확인됐다). ①③ 도 인용 대상(§5.4/§2.2)의 현재 본문과 정확히 일치하는 상태 서술 위에서
작업하고 있다. 유일하게 명시적 결정이 필요한 지점은 ③ 이 §2.2 에 추가하는 신규 "자원 액션"
규칙과 기존 §12.1 "상태 토글 패턴" 사이의 경계 미기술(WARNING) 이며, 그 외 2건은 plan
동기화·링크 정밀도 수준의 INFO 다.

## 위험도

LOW
