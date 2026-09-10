# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-schedule-trigger-ref-nav.md`

검토 모드: spec draft 검토 (`--spec`)
Target: `plan/in-progress/spec-draft-schedule-trigger-ref-nav.md` (변경안 D-1/D-2/D-3, 대상 spec:
`spec/2-navigation/3-schedule.md` §4, `spec/2-navigation/2-trigger-list.md` §3/§2.1)

## 검증한 실증적 주장 (요청받은 5개) — 전부 참

| # | 주장 | 검증 방법 | 결과 |
|---|---|---|---|
| 1 | `ScheduleDto.trigger` 는 `findAll`/`findById`/`create`/`update` 네 경로 전부에서 상시 존재하고 `isActive` 와 무관 | `codebase/backend/src/modules/schedules/schedules.service.ts` 직접 읽음 | **참**. `findAll` 은 `leftJoinAndSelect('s.trigger','t')`, `findById` 는 `relations:['trigger','trigger.workflow']`, `create()` 는 `saved.trigger = savedTrigger` 가 `if (isActive)` 블록 **밖**에 있고, `update()` 는 `saved.trigger = trigger ?? schedule.trigger` 가 마찬가지로 무조건 실행된다. 코드 주석 자체가 "트리거는 `isActive` 와 무관하게 항상 생성·연결됐다" 고 명시하며 종전 결함(리뷰 `19_08_18` W1)의 수정 이력까지 남아 있어 이중으로 뒷받침된다 |
| 2 | `Schedule.trigger_id` NOT NULL 1:1 이 `spec/1-data-model.md` §2.9.1 에 있고, draft 의 앵커 `#291-trigger--schedule-동기화-규칙` 이 올바른 github-slugger 슬러그다 | `spec/1-data-model.md:276-291` 직접 읽음 + 저장소 내 기존 인용 grep | **참**. 헤딩은 `### 2.9.1 Trigger ↔ Schedule 동기화 규칙`(276행), NOT NULL 문장 "Schedule.trigger_id는 NOT NULL — 반드시 Trigger와 1:1 매핑"은 290행으로 **§2.9.1 안**(다음 헤딩 §2.10 은 295행). 슬러그도 정확 — `↔` 제거로 "Trigger"/"Schedule" 사이에 공백 2개가 남아 `--` 이중 하이픈이 되는 github-slugger 규칙과 일치하며, 이미 저장소 내 **4곳**(`2-trigger-list.md` ×2, `3-schedule.md` ×1, `5-system/12-webhook.md` ×1)이 동일 형태로 인용 중이다. draft 는 "기존 인용 2건" 이라 적어 실제(4건)보다 과소 집계했지만, 형태 자체의 정확성 판정에는 영향 없다 (사소한 INFO 사안, 아래 참조) |
| 3 | `triggersApi.create`/`schedulesApi.create` 가 `Promise<void>` 로 응답 바디를 버리고, 호출부가 queryKey 무효화로 재조회한다 | `codebase/frontend/src/lib/api/triggers.ts`, `schedules.ts`, `app/(main)/w/[slug]/{triggers,schedules}/page.tsx` 직접 읽음 | **참**. 둘 다 `create: async (...): Promise<void> => { await apiClient.post(...); }` 형태로 `res.data` 를 쓰지 않는다. `triggers/page.tsx:300` `triggersApi.create` 호출 → `:303` `invalidateQueries({queryKey:["triggers"]})`. `schedules/page.tsx:571` `schedulesApi.create` 호출 → `:580` `invalidateQueries({queryKey:["schedules"]})`. 단, draft 본문(§"사유 (b)")의 배경 서술이 두 wrapper 모두를 "`triggers/page.tsx:262·303`" 한 파일로만 인용해 실제로는 `schedules/page.tsx:571·580` 도 근거인데 누락돼 있다 — 이건 실제 spec 반영문(D-1/D-2)에는 안 들어가는 배경 설명이라 spec 본문에는 영향 없음 (아래 INFO 항목) |
| 4 | draft 가 인용하는 §5.4 기준 (b) 와 두 앵커가 `spec/5-system/2-api-convention.md` 에 실재 | `spec/5-system/2-api-convention.md:221-280` 직접 읽음 + 저장소 내 기존 인용 grep | **참**. 기준 (b) 원문: "선택적 부가 컨텍스트라 소비자가 부재를 정상 경로로 다룰 때"(230행) — draft 인용과 일치. 앵커 `#54-부재-표현--null-vs-키-생략`(221행 헤딩)과 `#검증-층--이-규칙을-무엇이-강제하는가`(254행 헤딩) 둘 다 실재하며, 이미 `1-data-model.md`·`14-external-interaction-api.md`·`conventions/swagger.md` 등에서 동일 형태로 광범위 인용 중이라 슬러그 형태가 검증된 선례다 |
| 5 | 비대칭 — 스케줄 쪽 워크플로우 참조는 `name` 만, 트리거 쪽은 `id`+`name` | `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts`, `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` 직접 읽음 | **참**. `ScheduleTriggerWorkflowRefDto` 는 `name: string` 필드 하나. `TriggerWorkflowRefDto` 는 `id`(uuid) + `name` 두 필드. 양쪽 DTO 의 JSDoc 자체가 "의도적으로 다르다 — 한쪽을 다른 쪽으로 갈아 끼우지 말 것" 이라고 상호 인용하며 동일 근거(소비처가 실제로 읽는 필드만 담음)를 명시해 draft 서술과 완전히 일치한다 |

## 추가로 대조한 것 (요청 목록 밖, cross-spec 충돌 여부 판정에 필요해 확인)

- `spec/2-navigation/2-trigger-list.md` §3 은 `## 3. API`(153행), `spec/2-navigation/3-schedule.md` §4 는 `## 4. API`(127행) — draft 가 D-1/D-2/D-3 에서 쓰는 `#3-api`/`#4-api` 상호 링크와 슬러그 일치.
- `2-trigger-list.md` §2.1 의 자매 행(AuthConfig, 62행)이 이미 "데이터 출처: 목록 응답의 `authConfigId` ([§3 GET /api/triggers](#3-api)) 와 …" 형태로 출처를 명시하고 있어, D-3 이 제안하는 "연결된 워크플로우" 행의 출처 표기가 기존 관례와 정확히 같은 패턴 — 새 관례를 만드는 게 아니라 기존 비대칭을 없애는 변경.
- `grep -rn "ScheduleDto\|ScheduleTriggerRefDto\|ScheduleTriggerWorkflowRefDto\|TriggerWorkflowRefDto" spec/` → 대상 두 nav 파일 외 다른 spec 파일에서 이 DTO 이름들을 언급하지 않음. 즉 draft 가 추가하는 서술과 모순될 수 있는 제3의 기존 서술이 없다.
- `TriggersService`/`SchedulesService` 의 `findAll`/`findById`/`update` 가 각각 join·relations·findById-선행 구조인지 코드로 직접 확인 — draft 의 "update() 가 findById 로 시작한다" 서술과 일치(`triggers.service.ts:460`, `schedules.service.ts` update 내부의 `findById(id, workspaceId)` 호출).
- e2e (`codebase/backend/test/schedule-trigger.e2e-spec.ts`) 가 생성/목록/상세 세 형태를 각각 검증하는 것을 확인 — draft 가 §4 註에 적으려는 "e2e 가 세 형태를 각각 고정한다" 주장도 근거가 있다(요청 범위 밖이지만 신뢰도를 더 높이는 방향으로만 작용).
- `spec_impact` 프런트매터가 `2-trigger-list.md`/`3-schedule.md` 두 파일만 나열하고 `1-data-model.md`·`5-system/2-api-convention.md` 는 제외 — draft 의 "무엇을 하지 않나" 절(§2.9.1 은 건드리지 않는다)과 일치하며 실제로 두 파일에 대한 편집 계획(D-1~D-3)도 spec_impact 범위를 벗어나지 않는다.

## 발견사항

- **[INFO]** "기존 인용 2건" 집계가 실제보다 과소
  - target 위치: `plan/in-progress/spec-draft-schedule-trigger-ref-nav.md` §"앵커를 한 번 잘못 짚었다" 각주
  - 충돌 대상: 저장소 전체 grep 결과 (`spec/2-navigation/2-trigger-list.md:170,198`, `spec/2-navigation/3-schedule.md:112`, `spec/5-system/12-webhook.md:514`)
  - 상세: draft 는 `#291-trigger--schedule-동기화-규칙` 형태를 쓰는 기존 인용이 "2건" 이라 적었으나 실측하면 4건이다. 앵커 형태 판정 자체는 옳고 이 계수 오차가 spec 본문(D-1/D-2/D-3)에 반영되는 것도 아니라 실질 영향은 없다.
  - 제안: 반영 시점에 굳이 고칠 필요는 없음(계획 문서의 각주일 뿐 spec 본문 아님). 정정하고 싶다면 "2건" → "4건" 으로.
- **[INFO]** "사유 (b)" 배경 서술의 파일 인용이 schedules 쪽 근거를 누락
  - target 위치: `plan/in-progress/spec-draft-schedule-trigger-ref-nav.md` §"사유 (b) 의 근거가 DTO 주석보다 강하다"
  - 충돌 대상: `codebase/frontend/src/app/(main)/w/[slug]/schedules/page.tsx:571,580`
  - 상세: 이 절은 "두 `create` 래퍼"(triggers + schedules)를 논하면서 line 인용은 `triggers/page.tsx:262·303` 만 단다. 실제로 확인하니 `triggers/page.tsx:262`는 트리거 **toggle**(update) 핸들러의 invalidate 이고, 트리거 create 의 invalidate 는 `:303`, 스케줄 create 의 invalidate 는 `schedules/page.tsx:580`(호출은 `:571`)이다. 결론(주장) 자체는 두 파일 모두에서 참으로 확인됐으나 인용이 한 파일에 쏠려 있다. 이 서술은 D-1/D-2 spec 반영문에는 나오지 않는 배경 설명이라 spec 본문 정확성에는 영향이 없다.
  - 제안: 계획 문서를 다듬고 싶다면 `schedules/page.tsx:571·580` 을 추가 인용. spec 반영(D-1/D-2) 자체는 파일명을 명시하지 않는 서술이라 수정 불필요.

CRITICAL/WARNING 등급 발견사항은 없음. 검토 대상 5개 실증 주장 전부가 코드·기존 spec 과 정확히 일치했고, D-1/D-2/D-3 가 제안하는 신규 서술은 (a) 다른 spec 파일이 이미 언급 중인 동일 DTO/엔드포인트에 대해 상충하는 값을 적지 않으며, (b) 새 앵커·상호 링크가 전부 저장소에 실재하는 형태이며, (c) `1-data-model.md §2.9.1`(DB 레벨 관계)과 `3-schedule.md §4`(wire 레벨 표현)의 책임 분리를 유지해 계층 책임 충돌도 없다.

## 요약

Target draft(§5.4 키-생략 사유를 nav-spec 문서화)의 다섯 가지 핵심 실증 주장 — `ScheduleDto.trigger` 상시 존재, `Schedule.trigger_id` NOT NULL 1:1 및 앵커 정확성, 두 `create` API 래퍼의 `Promise<void>`+queryKey 무효화, §5.4 기준 (b)와 두 앵커의 실재, 워크플로우 참조 필드의 비대칭(`name`-only vs `id`+`name`) — 을 코드와 기존 spec 원문을 직접 대조해 전부 사실로 확인했다. draft 가 제안하는 신규 서술(D-1/D-2/D-3)은 다른 spec 영역이 이미 정의한 동일 엔티티·DTO·엔드포인트와 모순되지 않고, 인용하는 모든 앵커(§2.9.1, §5.4 두 곳, `#3-api`, `#4-api`)가 저장소 내 슬러그 규칙과 기존 광범위 사용례에 정확히 부합한다. 발견된 것은 계획 문서 배경 설명 수준의 사소한 인용 부정확 2건(INFO)뿐이며 spec 본문 반영문 자체에는 영향이 없다.

## 위험도

NONE
