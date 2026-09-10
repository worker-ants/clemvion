# Cross-Spec 일관성 검토 — `trigger-workflow-ref-canary`

## 검토 개요

- 모드: `--impl-done`, scope=`spec/2-navigation/`, diff-base=`origin/main`
- **scope(`spec/2-navigation`) 델타: 0개 파일.** 이 브랜치는 spec 을 바꾸지 않는 **코드(테스트) 전용 PR** 이다.
- 구현 diff: 3개 신규 파일 (`codebase/backend/src/shared/testing/trigger-workflow-ref.ts` + 그 self-spec + `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`) — `TriggerDto.workflow` 가 생성/목록/단건/PATCH(일반)/PATCH(chatChannel 포함) 다섯 응답 경로에서 present/absent 규약대로 실리는지, 그리고 트리거 비밀 컬럼 2종이 섞여 들어오지 않는지를 고정하는 캐너리다.
- target 문서 자체(`spec/2-navigation/**`)가 바뀌지 않았으므로, 이번 Cross-Spec 검토의 실질 대상은 "새 코드(테스트)가 담고 있는 계약 주장이 `spec/**` 다른 영역의 기존 서술과 충돌하는가" 이다.

## 확인한 대조 항목 (충돌 없음 — 근거 포함)

다음은 새 코드의 하드코딩된 계약 주장을 실제 spec/코드와 대조해 **모두 일치**함을 확인한 것들이다.

| 새 코드의 주장 | 대조 spec/코드 | 결과 |
|---|---|---|
| `WORKFLOW_REF_KEYS = ['id', 'name']` (`TriggerDto.workflow` 의 shape) | `spec/2-navigation/2-trigger-list.md` §3 "이 참조는 `id` 와 `name` 을 담는다" + `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` 의 `TriggerWorkflowRefDto` (`id`, `name`) | 일치 |
| "스케줄 쪽 자매 참조는 `name` 하나만 담는다, 의도적으로 다르다" | `spec/2-navigation/3-schedule.md` §4 "`trigger.workflow` 는 `name` 하나만 담는다 … 의도적으로 다르다" | 일치 |
| `TRIGGER_SECRET_COLUMNS = ['notificationSecretV2', 'chatChannelTokenV2']` | `spec/1-data-model.md` §2.8 Trigger 엔티티의 `notification_secret_v2` / `chat_channel_token_v2` 두 컬럼과 정확히 대응. 프로덕션 코드 `triggers.service.ts` 의 `TRIGGER_RESPONSE_STRIP_COLUMNS` 상수와도 동일 | 일치 |
| "부재는 §5.4 키 생략형이라 `null` 도 실패시켜야 한다" | `spec/5-system/2-api-convention.md` §5.4 (null vs 키 생략 판정 기준) | 일치 |
| `endpointPath` 는 서버가 v4 UUID 형식을 강제한다 (W1) | `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts` "endpointPath — v4 UUID 강제 (W1 보안)" (기존 코드) + spec §2.5 "클라이언트가 `crypto.randomUUID()` 로 생성" | 일치 |
| `chatChannelHealth=degraded` on 외부 호출 실패 (CCH-SE-01), 자동 비활성화 없음 | `spec/5-system/15-chat-channel.md` CCH-SE-01 (5초 timeout + 3회 지수 백오프, 자동 비활성화 금지) | 일치 |

RBAC/권한 축은 이 diff 가 새로 건드리지 않는다(테스트가 workspace owner 로만 동작하며 새 권한 분기를 도입하지 않음) — §5 관점(권한·RBAC 모델 충돌)에서 신규 충돌 없음. §6(계층 책임) 관점에서 `codebase/backend/src/shared/testing/**` 배치는 `PROJECT.md` 의 일반 규약(`test/helpers/`)과 다르지만, 이는 `spec/**` 소관이 아니라 harness 거버넌스 문서 소관이라 본 체커의 "spec 간 충돌" 범위 밖이다 — 다만 아래 항목에서 이미 추적 중임을 확인했다.

## 발견사항

- **[WARNING]** `spec/2-navigation/2-trigger-list.md` §3 의 "이 축엔 캐너리가 아직 없다" 서술이 이 PR 이 추가한 캐너리로 인해 **사실이 아니게 됐다**
  - target 위치: 이번 diff 는 `spec/2-navigation/**` 를 건드리지 않았으므로 정확히는 "target 영역의 기존(불변) 본문" — `spec/2-navigation/2-trigger-list.md` §3, `> 를 실어 닫았지만, **자매 스케줄 축과 달리 이 축에는 캐너리가 아직 없다** — 그쪽은 네 응답 형태를 양성/음성으로 고정한다(`3-schedule.md §4`). 보장을 구현보다 넓게 적지 않기 위해 이 비대칭을 함께 적는다.` (git blame: 커밋 `dc77317cd4`, 2026-09-10 11:51, 즉 이 PR 착수 불과 몇 시간 전에 planner 턴이 등재)
  - 충돌 대상: 같은 커밋 다이제스트가 스케줄 쪽과 비교하는 대상 `spec/2-navigation/3-schedule.md` §4 ("그쪽은 네 응답 형태를 양성/음성으로 고정한다") — 두 파일 간 "커버리지 비대칭"을 명시적으로 서술한 cross-file 비교 문장인데, 이 PR 의 diff(`codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` 5건 + self-spec 12건)가 정확히 그 비대칭을 없앴다.
  - 상세: 스펙 문장은 "트리거 축엔 캐너리가 없다"는 사실 진술이며 그 사실 위에 "보장을 구현보다 넓게 적지 않기 위해 이 비대칭을 함께 적는다"는 근거절까지 얹혀 있다. 지금 diff 가 바로 그 캐너리(`trigger-workflow-ref.e2e-spec.ts` A~E, 5개 응답 경로 고정)를 신설했으므로, 전제("아직 없다")가 무너지고 그 위에 얹힌 근거절까지 함께 낡는다. 이 상태로 남으면 다음 독자가 "이 축은 아직 회귀 방어가 없다"고 오판해 중복 작업을 벌이거나, 반대로 이미 존재하는 캐너리의 근거를 이 서술에서 찾지 못한다.
  - 제안: 이미 `plan/complete/trigger-workflow-ref-canary.md`(§"후속으로 넘기는 것" 1번) 및 `plan/in-progress/spec-draft-nullable-notation-followups.md`(1805행)에 후속 planner 턴 항목으로 등재돼 있음을 확인했다 — `spec/2-navigation/2-trigger-list.md §3` 문장을 취소선 + 실측으로 정정하는 작업이다. **자기-반증형 소정정 조건 1(대상 문장을 developer 자신이 썼는가)이 성립하지 않는다고 이미 판정됐다** — 그 문장은 이전 planner 턴(`#1304`, `--spec` 게이트)이 등재한 것이라, 이 developer PR 이 직접 고치지 않고 별도 planner 턴으로 분리한 처분이 맞다. 새로 발견된 이슈가 아니라 **이미 올바르게 처리 중인 tracked item** 임을 재확인.

- **[INFO]** 같은 planner 후속 턴에 이미 등재된 인접 항목 2건 — 참고용 교차 확인
  - target 위치: `spec/2-navigation/2-trigger-list.md` frontmatter `code:` 목록 (신규 `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` 미등재)
  - 충돌 대상: `spec/2-navigation/3-schedule.md` 가 세운 선례 — "註에 'e2e 가 고정한다' 고 적으면서 그 파일을 등재하지 않으면 보장의 근거가 추적 불가"라는 자체 관례
  - 상세: 새 e2e 파일이 `2-trigger-list.md` 의 `code:` frontmatter 에 아직 없다. 이 역시 `plan/in-progress/spec-draft-nullable-notation-followups.md` 1806행에 planner 후속 항목 2번으로 이미 등재돼 있다.
  - 제안: 위 WARNING 항목과 같은 planner 턴에서 함께 처리 예정 — 추가 조치 불필요, tracked 확인만.

- **[INFO]** `spec/5-system/14-external-interaction-api.md` §7.1 의 "스케줄 조인 축은 `schedule-trigger-ref.ts` 가 단언한다" 서술이 이제 트리거 직접 축에도 대칭 캐너리(`trigger-workflow-ref.ts`)가 생겼다는 사실을 반영하지 않음
  - target 위치: N/A (target 영역 아님, `spec/5-system/` 관련 spec)
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §7.1 (2026-09-08 정정 문단) — "`#1291` 이 응답 경계 스트립(`TRIGGER_RESPONSE_STRIP_COLUMNS`)을 세웠고, 스케줄 조인 축은 `schedule-trigger-ref.ts` 가 같은 목록으로 단언한다"고만 적혀 있어, 직접 트리거 축은 코드 레벨 스트립만 있고 런타임 캐너리는 없는 것처럼 읽힌다.
  - 상세: 이번 PR 의 `trigger-workflow-ref.ts` 는 `TRIGGER_SECRET_COLUMNS`(동일한 두 컬럼)의 부재를 트리거 직접 응답(create/list/detail/patch)에서도 단언한다 — 사실상 EIA §7.1 이 언급하지 않은 두 번째 캐너리가 생겼다. 모순은 아니지만(그 문단이 "런타임 캐너리는 없다"고 명시적으로 단언한 것은 아님), 인벤토리가 최신이 아니다.
  - 제안: 낮은 우선순위 — `spec/2-navigation/2-trigger-list.md §3` 정정 시점에 곁들여 한 줄 추가를 고려할 수 있으나, 이 PR 이나 이번 검토를 막을 사유는 아니다.

## 요약

이 PR 은 `spec/2-navigation/**` 를 전혀 변경하지 않는 테스트 전용(캐너리) diff 이며, 새로 도입한 단언(응답 shape `{id,name}`, 비밀 컬럼 2종, 부재 판정 방식)은 `spec/1-data-model.md`·`spec/2-navigation/2-trigger-list.md`·`spec/2-navigation/3-schedule.md`·`spec/5-system/2-api-convention.md`·`spec/5-system/15-chat-channel.md` 등 관련 영역과 대조했을 때 전부 일치해 새로운 데이터 모델/API 계약/RBAC/상태 전이 충돌은 발견되지 않았다. 유일한 실질 발견은 `spec/2-navigation/2-trigger-list.md §3` 의 "이 축엔 캐너리가 아직 없다"는 서술이 바로 이 PR 로 인해 사실이 아니게 된 것인데, 이는 이미 `plan/complete/trigger-workflow-ref-canary.md` 와 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 후속 planner 턴 항목으로 정확히 등재·추적되고 있어 새로운 미검출 리스크가 아니다.

## 위험도

LOW
