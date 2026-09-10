# 신규 식별자 충돌 검토 — `plan/in-progress/spec-draft-schedule-trigger-ref-nav.md`

**번들 갭 안내**: 이 checker 에게 전달된 프롬프트 번들의 spec 서브코퍼스는 예산 절단으로
`spec/1-data-model.md` 한 파일만 남아 있었다. target 이 실제로 편집·인용하는 세 파일은
번들에 없었으므로, 아래 세 파일을 디스크에서 직접 읽어 검토했다:

- `spec/2-navigation/2-trigger-list.md` (target 이 §2.1·§3 에 註/행을 추가)
- `spec/2-navigation/3-schedule.md` (target 이 §4 에 註를 추가)
- `spec/5-system/2-api-convention.md` (§5.4 — target 이 적용하는 규약 본문)

추가로 target 이 서술하는 실제 DTO 구현(`schedule-response.dto.ts`, `trigger-response.dto.ts`)도
코드 실측을 위해 열었다.

## 개요

target 은 새 엔티티·endpoint·이벤트·ENV var·요구사항 ID 를 도입하지 않는다 — 기존
`ScheduleDto`/`TriggerDto` 의 `workflow` 참조 필드가 §5.4(키 생략 규칙)에 따라 요구하는
"문서화된 사유"를 nav-spec 산문으로 옮기고, 기존 API 표 아래에 blockquote 註 2개(D-1·D-2)와
기존 테이블 행 1개 확장(D-3)을 추가하는 순수 문서 보강이다. 따라서 충돌 표면은 앵커 슬러그
정확성과, "비슷한 이름의 기존 식별자를 다른 의미로 재사용하는가" 로 좁혀진다.

## 발견사항

### [INFO] 앵커 5개 전부 유일하게 해석됨 — 충돌 없음

target 이 신규로 도입하거나 재사용하는 앵커를 모두 대상 파일에서 실측했다.

| 앵커 | 대상 파일 | heading 텍스트 | 파일 내 occurrence | 상태 |
|---|---|---|---|---|
| `#291-trigger--schedule-동기화-규칙` | `1-data-model.md` | `### 2.9.1 Trigger ↔ Schedule 동기화 규칙` | 1건 | 기존 앵커 재사용. `2-trigger-list.md`(2곳)·`3-schedule.md`(1곳)·`12-webhook.md`(1곳)가 이미 동일 형태로 인용 중 — target 의 새 인용(D-1)은 검증된 패턴을 그대로 씀 |
| `#54-부재-표현--null-vs-키-생략` | `2-api-convention.md` | `### 5.4 부재 표현 — \`null\` vs 키 생략` | 1건 | 기존 앵커, `14-external-interaction-api.md`·`swagger.md`가 이미 인용 |
| `#검증-층--이-규칙을-무엇이-강제하는가` | `2-api-convention.md` | `#### 검증 층 — 이 규칙을 무엇이 강제하는가` | 1건 | 기존 앵커, `1-data-model.md`·`swagger.md`가 이미 인용 |
| `#3-api` | `2-trigger-list.md` | `## 3. API` | 1건 | 기존 앵커(파일 내부 자기참조 §2.1 행에서도 이미 사용 중). D-3 가 재사용, D-1(스케줄 쪽)이 처음으로 **타 파일에서** 교차 인용 — 형식(`./2-trigger-list.md#3-api`)은 기존 `error-handling.md`/`chat-channel.md` 교차 인용과 동일 규약 |
| `#4-api` | `3-schedule.md` | `## 4. API` | 1건 | **target 이 도입하는 유일한 신규 anchor 참조**(D-2 가 `./3-schedule.md#4-api` 로 처음 교차 인용). heading 은 파일 내 유일하고, 슬러그 생성 규칙(`## N. API` → `#n-api`)은 `2-trigger-list.md` 의 `#3-api` 로 이미 검증된 동일 패턴이라 오생성 위험 없음 |

5개 앵커 모두 대상 heading 텍스트가 파일 내에서 **정확히 1건**이라 github-slugger 가 `-1`
접미사를 붙일 중복 조건이 없다. 충돌 없음.

### [INFO] `workflow` 필드명은 이미 3곳에서 다른 shape 로 존재 — target 범위 밖 재확인

리포지토리 전체에서 응답 DTO 의 `workflow` 필드는 세 군데 다른 shape 로 선언돼 있다:

| DTO | `workflow` 필드 타입 | 담는 값 |
|---|---|---|
| `ScheduleTriggerRefDto.workflow` (`schedule-response.dto.ts:55`) | `ScheduleTriggerWorkflowRefDto` | `name` 하나만 |
| `TriggerDto.workflow` (`trigger-response.dto.ts:102`) | `TriggerWorkflowRefDto` | `id` + `name` |
| `CanvasSaveResultDto.workflow` (`workflow-response.dto.ts:72`) | `WorkflowDto` | 워크플로우 엔티티 전체 |

세 번째(`CanvasSaveResultDto`, 워크플로우 에디터 캔버스 저장 응답)는 target 이 건드리는
trigger/schedule nav-spec 과 무관한 도메인이고, nav-spec 어디에서도 인용되지 않는다
(`spec/2-navigation/2-trigger-list.md`·`3-schedule.md` 에 `WorkflowDto`/`CanvasSaveResultDto`
언급 0건 — grep 확인). target 은 이 세 번째 shape 를 언급하지 않으므로 **target 이 새로
만드는 혼선은 아니다.** 다만 "`workflow` 라는 이름이 응답 계약에서 최소 세 가지 다른 shape
를 가리킨다"는 사실 자체는 기존 상태이며, 앞의 두 shape(스케줄/트리거) 간 혼동은 아래 항목에서
target 이 실제로 어떻게 다루는지를 본다.

### [INFO] 스케줄측/트리거측 `workflow` 참조 — 의도된 상이한 shape, target 은 기존 경고를 그대로 계승

프롬프트가 지목한 "스케줄측 ref 와 트리거측 ref 가 의도적으로 다른 shape 인데 서술이
헷갈릴 수 있는가" 질문에 대한 실측:

- `ScheduleTriggerRefDto`(스케줄 응답에 실리는 트리거 참조, `id`+`name`+`workflowId`+`workflow`)
  안에 중첩된 `workflow` 필드는 `ScheduleTriggerWorkflowRefDto`(`name` 만) 타입이다.
- `TriggerDto`(트리거 응답 자체) 의 `workflow` 필드는 `TriggerWorkflowRefDto`(`id`+`name`) 타입이다.
- 두 클래스 이름은 `Schedule` 접두어 하나만 다르고(`ScheduleTriggerWorkflowRefDto` vs
  `TriggerWorkflowRefDto`), **코드 JSDoc 이 이미 이 위험을 명시적으로 경고**한다 — 두 파일
  모두에 "이름이 접두어 하나만 다르므로 한쪽을 다른 쪽으로 갈아 끼우지 말 것" 문구가 있다
  (`schedule-response.dto.ts:14-18`, `trigger-response.dto.ts:17-21`).
- target 의 D-1(`3-schedule.md §4` 註)과 D-2(`2-trigger-list.md §3` 註)는 이 코드-레벨 경고를
  **동일한 문구·동일한 상호 교차링크**(`./2-trigger-list.md#3-api` ↔ `./3-schedule.md#4-api`)로
  nav-spec 양쪽에 이식한다 — "`trigger.workflow` 는 `name` 하나만 담는다 … 트리거 응답의 자매
  참조는 `id` 도 싣는데 의도적으로 다르다 … 한쪽을 다른 쪽으로 갈아 끼우지 말 것"(D-1) /
  "이 참조는 `id` 와 `name` 을 담는다 — 스케줄 응답의 자매 참조는 `name` 하나만 담고 의도적으로
  다르다 … 한쪽을 다른 쪽으로 갈아 끼우지 말 것"(D-2).

즉 target 은 새 이름을 만들지 않고, **이미 존재하는 "이름 유사 → 혼동 위험" 을 코드가 이미
인지·경고한 대로 nav-spec 에 대칭적으로 이식**한다. 실제로 두 절을 나란히 읽는 독자가 헷갈릴
여지는 최소화돼 있다 — 각 註가 "반대쪽은 다르다"를 explicit 하게 언급하고 상호 링크한다.
따라서 이는 새 충돌이 아니라 기존의 (이미 잘 관리되는) 구분을 문서화 레이어로 확장한 것으로
판단한다. WARNING 으로 올릴 근거(미고지·비대칭 누락)는 실측상 없다.

### [INFO] `ScheduleDto` 명시 vs `TriggerDto` 미명시 — 註 도입부 표기 비대칭 (사소)

D-1 은 도입부에서 `> **응답 형태 — \`ScheduleDto\` 의 참조 필드.**` 로 DTO 클래스명을 명시하는
반면, D-2 는 `> **응답 형태 — \`workflow\` 참조는 키 생략형이다**` 로 `TriggerDto` 클래스명을
언급하지 않는다. 다만 nav-spec 전반의 기존 관례 자체가 DTO 클래스명을 거의 인용하지 않고
필드명(`authConfigId`, `workflow.name` 등)만 쓰므로(`2-trigger-list.md`·`3-schedule.md` 전체에서
`Dto` 언급은 기존 `PaginationQueryDto` 1건뿐), D-2 가 오히려 기존 관례에 더 가깝고 D-1 이
예외적으로 클래스명을 노출한 쪽이다. 충돌·혼동 소지는 없고 스타일 일관성 차원의 INFO.

## 요약

target 은 신규 엔티티·endpoint·이벤트·ENV var·요구사항 ID 를 전혀 도입하지 않으며, 도입하는
5개 앵커 참조(`#291-trigger--schedule-동기화-규칙`·`#54-부재-표현--null-vs-키-생략`·
`#검증-층--이-규칙을-무엇이-강제하는가`·`#3-api`·`#4-api`)는 전부 대상 파일에서 유일한
heading 에 정확히 대응해 슬러그 충돌(github-slugger 의 `-1` 접미사 위험) 없음을 실측으로
확인했다. `#4-api` 만이 실질적으로 새로 만들어지는 교차-파일 인용이지만, 같은 슬러그 생성
패턴이 자매 파일의 `#3-api` 로 이미 검증돼 있어 안전하다. `workflow` 필드명이 리포지토리
전체에 세 가지 다른 shape 로 존재하는 것은 사실이나 세 번째(워크플로우 에디터 캔버스)는
target 범위 밖이라 무관하고, target 이 실제로 다루는 두 shape(`ScheduleTriggerWorkflowRefDto`
vs `TriggerWorkflowRefDto`)간의 이름 유사성은 이미 코드 JSDoc 이 명시적으로 경고해 온
기존 리스크를 target 이 동일한 상호 참조 문구로 nav-spec 에 대칭 이식한 것이며, 새로운
미고지 충돌을 만들지 않는다. 신규 식별자 충돌 관점에서 이 target 은 안전하다.

## 위험도

NONE
