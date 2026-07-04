# 정식 규약 준수 검토 — priority 3-tier (`ExecuteOptions.triggerType` vs `Trigger.type` 어휘)

## 검토 모드
구현 착수 전 검토 (--impl-prep). 점검 대상은 payload 의 광범위 scope(`spec/5-system/`) 중 실제
작업 항목인 **priority 3-tier**(`plan/in-progress/exec-intake-followups.md` "PR2b 후속" 1번 항목,
`ExecuteOptions.triggerType` 필드 신설 + `Trigger.type`(`manual`/`webhook`/`schedule`) 어휘 threading)로
좁혀 분석했다. payload 로 전달된 `convention_compliance.md` 는 실제로는 `spec/5-system/1-auth.md` 등
인증 스펙 번들이며 본 작업 대상(`4-execution-engine.md` priority 3-tier)을 포함하지 않아, target 문서는
`spec/5-system/4-execution-engine.md`(§4.2 PR1 메모, §4.3, §6.1.1, §9.2 admission gate 주석, §Rationale),
`spec/data-flow/3-execution.md §1.1`, `spec/data-flow/10-triggers.md §2.2`, `spec/1-data-model.md §2.8`,
`spec/2-navigation/14-execution-history.md §2.4`, 및 이미 구현된
`codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts` 를 직접 대조했다.

## 발견사항

- **[INFO]** 신설 예정 `ExecuteOptions.triggerType` 필드가 이미 존재하는 `triggerSource` DTO 어휘와
  이름 유사도가 높아 리더 혼동 가능성
  - target 위치: `plan/in-progress/exec-intake-followups.md` "priority 3-tier" 항목,
    `spec/5-system/4-execution-engine.md` §4.2 PR1 메모("triggerType 은 payload 에 싣지 않는다"),
    §4.3 우선순위 행, §9.2 admission gate 주석
  - 위반 규약: 명시적 규약 위반은 아님 — `spec/conventions/` 에 TS 필드 camelCase 명명이나
    "type"-접미 필드 중복 방지에 대한 SoT 문서가 없음 (일반 명명 규약 문서 부재 확인:
    `spec/conventions/` 디렉터리 내 naming.md 류 부재)
  - 상세: `spec/2-navigation/14-execution-history.md §2.4`(`Trigger 출처 분류`)는 이미
    `triggerSource`(5-way enum: `subworkflow`/`manual`/`schedule`/`webhook`/`unknown`, 표시·조회용
    파생 필드, `deriveExecutionTrigger` 가 산출)를 정의하고 있다. 신설 예정 `triggerType`(3-way:
    `manual`/`webhook`/`schedule`, priority 계산 입력용, `execute()` 호출측이 능동 전달)은 값 집합도
    다르고 방향(입력 vs 파생-출력)도 다른 별개 개념이지만, `-Type`/`-Source` 접미만으로 구분되어
    미래 유지보수자가 둘을 혼동하거나 재사용을 시도할 위험이 있다. 두 필드 모두 궁극적으로
    `Trigger.type`(`spec/1-data-model.md §2.8`)에서 파생되므로 상호 참조가 자연스러워 보이지만
    실제로는 층위가 다르다(priority 계산 vs UI 표시 라벨).
  - 제안: PR2 구현 시 `ExecuteOptions.triggerType` JSDoc/spec 본문에 "`triggerSource`(§14 실행 이력
    표시용 5-way 파생 필드)와는 별개— priority 계산 전용 3-way 입력값" 이라는 명시적 구분 주석을
    한 줄 추가할 것을 권고(신규 규약 신설까지는 불요, INFO 수준 문서 보강).

- **[INFO]** `Trigger.type` 어휘 재사용 근거가 이미 코드 주석에 존재 — spec 본문에도 동일 근거를
  명시적으로 옮겨적을 것을 권고
  - target 위치: `spec/5-system/4-execution-engine.md` §4.2 PR1 메모 두 번째 항목
    ("`Trigger.type`(`webhook`/`manual`/`schedule` …) 어휘 기반 3-tier … 예정")
  - 위반 규약: 없음 (권장 사항)
  - 상세: 이미 구현된 `codebase/.../execution-run.queue.ts:23-25` 주석은 "값은 `Trigger.type` enum
    어휘를 그대로 사용한다 (naming collision 회피)" 라고 **의도적 어휘 재사용**임을 명시한다. spec
    쪽(`4-execution-engine.md` §4.2/§4.3)은 같은 결론(3-tier 매핑표)을 보여주지만 "어휘를 그대로
    재사용해 collision 을 피한다"는 설계 의도 자체는 코드 주석에만 있고 spec 본문에는 없다. PR2
    구현 시 이 근거가 spec Rationale 에 반영되지 않으면 향후 checker(naming_collision 등)가 반복
    재질의할 수 있다.
  - 제안: PR2 spec 갱신(§4.3 인접 또는 §Rationale)에 "`ExecuteOptions.triggerType` 의 값 어휘는
    `Trigger.type`(§2.8)과 동일한 문자열(`manual`/`webhook`/`schedule`)을 그대로 채택한다 — 별도
    enum 신설 시 두 어휘가 분기(drift)할 위험을 피하기 위함"이라는 한 문장을 명시적으로 추가.

- **[INFO]** 열거값 순서 표기 불일치 (문서 간 사소한 순서 차이, 값 집합 자체는 일치)
  - target 위치: `spec/1-data-model.md §2.8`("webhook / schedule / manual") vs
    `spec/5-system/4-execution-engine.md` §4.2/§4.3("webhook`/`manual`/`schedule`", "manual` >
    `webhook` > `schedule`") vs `execution-run.queue.ts`(`manual: 1, webhook: 2, schedule: 3`)
  - 위반 규약: 없음 — 값 집합(3개 문자열)은 완전히 일치하며 표기 순서만 문서마다 다름(데이터모델은
    알파벳/자유 순서, 엔진 spec 은 priority 순서, 코드는 priority 순서)
  - 상세: 실질적 위험은 낮음(순서가 의미를 갖는 곳은 priority 표뿐이고 그 표는 이미 코드와 일치).
    다만 `1-data-model.md §2.8` 의 "webhook / schedule / manual" 나열 순서가 `4-execution-engine.md`
    의 priority 순서(`manual > webhook > schedule`)와 달라, 빠르게 훑는 독자가 순서를 priority 로
    오인할 여지가 있다.
  - 제안: 우선순위와 무관한 단순 표기이므로 수정 불요. 원한다면 `1-data-model.md §2.8` 표기를
    priority 순(`manual / webhook / schedule`)으로 맞춰 일관성을 높일 수 있으나 이는 스타일
    선호이지 규약 위반이 아니다.

- **[INFO]** `EXECUTION_RUN_PRIORITY` 상수명은 `error-codes.md` 류의 "의미 기반 명명" 철학과 정합
  - target 위치: `execution-run.queue.ts:20-31`, `spec/data-flow/3-execution.md §1.1`
    ("`EXECUTION_RUN_PRIORITY`")
  - 위반 규약: 없음(참고용 긍정 확인)
  - 상세: `spec/conventions/error-codes.md §1` 의 "이름이 의미를 기술해야 한다"는 원칙은 에러 코드
    한정 규약이지만, 동일 철학이 `EXECUTION_RUN_PRIORITY`/`ExecutionRunTriggerType`/
    `resolveExecutionRunPriority` 명명에도 부합한다 — 구현 세부(PR 번호 등)를 이름에 박지 않고
    의미(우선순위 매핑)만 드러낸다. PR2 신규 필드 `ExecuteOptions.triggerType` 도 같은 패턴을
    유지하면 된다(신규 규약 불요).

## 요약

이번 우선순위 3-tier(`ExecuteOptions.triggerType` 신설, `Trigger.type` 어휘(`manual`/`webhook`/
`schedule`) 재사용) 작업은 `spec/conventions/**` 에 명시된 **직접 위반 규약이 없다**. 대상 필드는
공개 API DTO 가 아닌 내부 서비스 계층 옵션 타입이라 `swagger.md` 의 DTO 데코레이터 규약이 적용되지
않으며, `error-codes.md`/`audit-actions.md` 류의 명명 규약도 이 필드에는 직접 해당하지 않는다(에러
코드·감사 액션이 아님). 이미 구현된 `execution-run.queue.ts` 코드 주석이 "`Trigger.type` 어휘를
그대로 재사용해 naming collision 을 회피한다"는 설계 의도를 명시하고 있어 이번 PR2 threading 은 그
결정을 코드에서 spec 으로 확장하는 성격이며 새로운 위반을 도입하지 않는다. 유일한 관찰 포인트는
이미 존재하는 표시용 파생 필드 `triggerSource`(§14, 5-way)와 신설 예정 입력값 필드 `triggerType`
(3-way)이 이름이 유사해 향후 혼동 여지가 있다는 점과, `Trigger.type` 어휘 재사용의 설계 근거를
spec Rationale 에도 명시적으로 옮겨두면 좋겠다는 점으로, 모두 INFO 수준이다.

## 위험도
NONE

BLOCK: NO
Critical: 0
Warning: 0

STATUS: SUCCESS
