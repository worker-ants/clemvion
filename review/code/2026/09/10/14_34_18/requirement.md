# 요구사항(Requirement) 리뷰 — `trigger-workflow-ref-canary`

대상: `codebase/backend/src/shared/testing/trigger-workflow-ref.{ts,spec.ts}`,
`codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`,
`plan/in-progress/{spec-draft-nullable-notation-followups.md,trigger-workflow-ref-canary.md}`

검증 방법: 저장소 파일은 뮤테이션하지 않고 `Read`/`Grep` 으로 소스 직접 대조만 수행했다
(병렬 리뷰 오염 방지 규약 준수). `git status --short` 로 최종 상태를 확인했다 — 트리 변경 없음.

## 발견사항

### [INFO] 정확히 네 경로만 `TriggerDto` shape 를 반환한다 — 독립 재검증 완료

`triggers.controller.ts` 전체(9개 핸들러)와 `triggers.service.ts` 의 대응 메서드 시그니처를
직접 읽어 plan 의 "네 경로뿐" 주장을 재검증했다.

- `TriggerDto` shape 반환: `create`(POST) · `findAll`(GET 목록, `PaginatedResponseDto<TriggerDetail>`) ·
  `findOneDetail`(GET 단건) · `update`(PATCH). 이 넷은 컨트롤러의 `@ApiCreatedWrappedResponse(TriggerDto)` /
  `@ApiOkPaginatedResponse(TriggerDto)` / `@ApiOkWrappedResponse(TriggerDto)` (×2) 데코레이터로도
  독립적으로 확인된다 — 저장소 전체에서 `TriggerDto` 를 swagger 데코레이터에 넘기는 자리가 이 넷뿐이다
  (`grep -rn "TriggerDto"` 로 확인).
- `getHistory`(GET `/:id/history`): `Promise<Array<{id,status,startedAt,durationMs}>>` — `TriggerHistoryItemDto`
  shape, `workflow` 개념 자체가 없다. **대상 밖 — 타당.**
- `remove`(DELETE): `Promise<void>`, `204 No Content`. **대상 밖 — 타당.**
- `rotateNotificationSecret`: `Promise<{secret, rotatedAt}>`. **대상 밖 — 타당.**
- `revokePerTriggerToken`: `Promise<{token}>`. **대상 밖 — 타당.**
- `rotateBotToken`(`triggers.service.ts:1238`): `Promise<{rotatedAt, triggerId, chatChannelHealth, botIdentity}>` —
  `TriggerDto` 와 무관한 별도 좁은 shape. **대상 밖 — 타당.**

plan 의 표(`history·DELETE·rotate 3종은 트리거 shape 가 아니라 대상 밖이다`)는 정확하다 — 3종이 아니라
정확히는 rotate 계열 셋(`rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken`) +
`getHistory` + `DELETE` 다섯 핸들러가 대상 밖이며, 그 다섯 모두 실측으로 확인했다.

### [INFO] 캐너리가 실제로 W4 결함을 재현한다 — 코드 대조로 확인 (뮤테이션은 미실행)

`triggers.service.ts:537-553` (`update()` 의 `if (chatChannel)` 분기)을 직접 읽었다:

```
if (chatChannel) {
  await this.setupChatChannel(saved, chatChannel);
  const refreshed = await this.triggerRepository.findOne({
    where: { id: saved.id, workspaceId },
    relations: ['workflow'],   // ← W4 가 추가한 자리
  });
  if (refreshed) result = refreshed;
}
```

이 자리의 주석이 직접 `review/code/2026/09/06/01_13_50` W4 를 인용하며 "그 재조회가 한때 `relations`
를 빼고 읽어 그 응답에서만 `workflow` 가 사라졌다" 고 적고 있고, `review/code/2026/09/06/01_13_50/RESOLUTION.md`
의 W4 항목과 정확히 일치한다. `create()` 의 동등 재조회(`triggers.service.ts:446-449`)는 의도적으로
`relations` 를 안 싣는다 — §3 이 "부재는 생성 응답에만" 이라 명시하므로 이는 정당한 비대칭이다.

캐너리 case #5(PATCH + chatChannel)만 이 `if (chatChannel)` 분기를 타고, case #1~#4(생성 두 서브경로 ·
목록 · 단건 · 일반 PATCH)는 이 분기를 안 탄다 — 코드 구조상 이 분기의 `relations` 가 지워지면 **case #5
만** `Object.hasOwn(record,'workflow') === false` 가 되어 실패하고 나머지는 영향받지 않는다. 이는 plan 이
주장하는 "#5 만 RED" 뮤테이션 결과와 인과적으로 정합한다. (뮤테이션 자체는 병렬 리뷰 안전 규약에 따라
재실행하지 않았다 — 코드 판독으로 인과 경로만 확인.)

`TriggerWorkflowRefDto`(`id`,`name` 두 필드, `trigger-response.dto.ts:23-31`)와 헬퍼의
`WORKFLOW_REF_KEYS = ['id','name']`, `TRIGGER_RESPONSE_STRIP_COLUMNS`(`notificationSecretV2`,
`chatChannelTokenV2`, `triggers.service.ts:99-102`)와 헬퍼의 `TRIGGER_SECRET_COLUMNS` 가 각각 정확히
일치함을 확인했다. `sanitizeForResponse`(`triggers.service.ts:734-791`)가 `narrowWorkflowRef`
(`:195-200`)로 `{id,name}` 로 좁히는 것도 확인.

### [INFO] 엣지 케이스 세 가지 — 소스 대조로 판정 완료

1. **schedule 타입 `GET /:id`(`findOneDetail` 의 `Object.assign` 분기, `triggers.service.ts:350-366`)**:
   `Object.assign(trigger, {cronExpression, timezone, nextRunAt})` 은 `trigger` 위에 새 필드만
   더할 뿐 기존 `workflow` 키를 건드리지 않는다. `workflow` 유무는 오직 `findById()`(`:336-348`,
   `relations:['workflow']` 상시)에 의해 결정되며 이는 `type` 과 무관하다. 즉 schedule 타입 GET 단건은
   **`workflow` 적재 메커니즘이 webhook 타입 case #3 과 완전히 동일한 코드 경로**이고, 이 축(§3 이 규정한
   "생성 응답에만 부재")과 무관한 필드(`cronExpression` 등)만 추가된다. **별도 캐너리 없이도 타당** — 다만
   canary 파일 어디에도 이 근거가 명시되지 않아, 다음 사람이 "빠졌나?" 재확인해야 하는 비용은 남는다(INFO
   수준, 문서화 공백이지 결함은 아님).
2. **workflow 가 삭제된 트리거**: `trigger.entity.ts:43-48` — `workflow_id` 는 `NOT NULL` 이고
   `@ManyToOne(() => Workflow, { onDelete: 'CASCADE' })`. `Workflow` 엔티티에는 soft-delete 컬럼이 없다
   (`@DeleteDateColumn` 부재 확인). 즉 workflow 삭제 시 FK CASCADE 로 그 트리거 row 자체가 함께 삭제된다 —
   "workflow 가 삭제된 트리거" 는 현재 스키마에서 **존재할 수 없는 상태**다. 캐너리가 이 케이스를 다루지
   않는 것은 결함이 아니라 정확한 판단이다.
3. **schedule 타입에 `chatChannel` 포함 PATCH**: `update()`(`triggers.service.ts:465-480`)가
   `trigger.type === 'schedule'` 이고 `chatChannel !== undefined` 면 `disallowed` 목록에 추가해
   **400 `VALIDATION_ERROR`** 로 즉시 반려한다 — `TriggerDto` shape 응답 자체가 발생하지 않는 에러 경로다.
   `expectTriggerWorkflowRef` 가 다루는 대상(성공 응답의 `workflow` 유무)과 원리적으로 무관 — **대상 밖이
   타당**하다.

### [WARNING] (사전 존재 결함, 이 PR 범위 밖) chatChannel PATCH 가 bot-token single-path 정책을 우회하는 것으로 읽힌다

`triggers.service.ts` 의 `setupChatChannel`(`:915-` 부근, `:947-951`)은 `create()`/`update()` 양쪽에서
호출되며 `this.secrets.rotate(botTokenRef, workspaceId, chatChannelCfg.botToken ?? '')` 를 **매번** 실행한다
— `rotateBotToken()`(`:1238-`)이 쓰는 v2-ref 24h grace 백업 절차 없이 **동일 primary ref 를 그 자리에서
교체**한다. `assertChatChannelInputSafe`(`:575-604`)는 `botTokenRef`/`inboundSigningRef`/`inboundSigning`
**세 내부 필드**만 PATCH 입력에서 차단하고, **`botToken` 평문 자체는 차단하지 않는다.** 그런데
`ChatChannelConfigDto.botToken`(`chat-channel-config.dto.ts:187`)은 `@IsOptional()` 없이 선언된 **필수
문자열**이고, §3 은 `chatChannel` 을 PATCH 에 실을 경우 "해당 객체를 통째로 교체 — 부분 머지가 아니라 전체
객체를 다시 send 해야 한다" 고 규정한다. 즉 **`chatChannel` 을 포함하는 모든 PATCH 는 구조적으로 새
`botToken` 평문을 함께 보내야 하고, 그 값이 grace 없이 즉시 반영된다** — §3/§Chat Channel R-CC-10 이
규정한 "bot token 변경은 항상 `POST /:id/chat-channel/rotate-bot-token` 단일 경로(24h grace)" 계약과
충돌하는 것으로 읽힌다.

이 PR 의 diff(T-1~T-3)는 `triggers.service.ts` 를 전혀 건드리지 않으므로 **이 결함은 이 PR 이 만든
것이 아니라 캐너리 작성 중 발견된 사전 존재 상태**다. plan(`trigger-workflow-ref-canary.md` "구현 중
실측으로 갈린 것" 절)이 이를 실측대로 적고 "판정에 필요한 것"·"단정하지 않는다" 로 정확히 처리했으며,
`spec-draft-nullable-notation-followups.md` 에 planner+developer 판단이 필요한 질문 항목으로 이미
등재돼 있다 — **적절한 처리**다. 다만 캐너리 case #5(`trigger-workflow-ref.e2e-spec.ts:179-201`) 자체가
정확히 이 우회 경로를 실행하면서도(테스트 목적상 `botToken` 평문을 PATCH 로 보낸다) 그 사실에 대한
단언은 전혀 두지 않는다 — 의도된 스코프 밖이라는 판단은 타당하지만, 이 리뷰에서 별도로 짚어 후속 판정을
독촉할 가치가 있다고 본다.

### [WARNING] 헬퍼/self-spec 의 근거 서술이 `assertMatchesContract` 의 실제 판정 범위보다 넓게 주장한다

`trigger-workflow-ref.spec.ts:47-50` 및 `trigger-workflow-ref.e2e-spec.ts:21-26` 의 주석:

> §5.4 는 **키 생략**과 `null`(키 present)을 **다른 표현**으로 규정한다. 부재를 `null` 로 바꾸는 회귀는
> 계약 검증자가 안 잡으므로 여기서 갈라야 한다

`response-contract.ts:39-41`(문서화된 판정 규칙 표) 과 `:259-269`(`visit()` 구현)를 직접 읽으면, `workflow`
같은 "`required` 아님(키 생략형)" 필드에 실제로 `null` 값이 오면 `assertMatchesContract` 는 이를
`kind:'null'`, `detail: '키 생략형(required 아님)인데 null 이 왔다 — §5.4 는 이 조합을 금지한다'` 로 **명시적으로
잡는다.** 이 도구는 이미 `schedule-trigger.e2e-spec.ts:269,379` 와 `chat-channel-trigger-create.e2e-spec.ts:131,163`
에서 `assertMatchesContract(…, contractForDto(TriggerDto))` 로 **목록·단건·생성·(chatChannel 없는) 수정**
네 경로 모두에 이미 걸려 있다 — 즉 "부재→`null`" 회귀는 **일반적으로는** `assertMatchesContract` 의 판정
범위 안에 있다. 정확한 주장은 "**이 특정 chatChannel 재조회 분기**는 기존 `assertMatchesContract` 호출
어디에도 걸려 있지 않다"(사실 — 기존 4개 호출부 중 chatChannel 을 포함한 PATCH 를 거치는 것은 하나도
없다)이지, "계약 검증자가 [일반적으로] null-치환을 못 잡는다"가 아니다. 후자로 일반화한 서술은 다음
사람이 `response-contract.ts` 의 실제 방어 범위를 오판하게 할 수 있다.

이 결함은 **캐너리의 실제 판정 로직(코드)에는 영향이 없다** — `expectTriggerWorkflowRef` 의 `null` 배제
로직 자체는 옳고 유용하다(이 e2e 파일은 애초에 `assertMatchesContract` 를 전혀 호출하지 않으므로, 이
파일 내부에서는 "유일한 방어" 라는 서술이 사실이다). 문제는 그 근거를 **일반화**해 다른 도구의 능력을
실제보다 좁게 서술한 부분이다.

### [SPEC-DRIFT][WARNING] `spec/2-navigation/2-trigger-list.md §3` 의 "캐너리가 아직 없다" 문장이 이제 거짓이 됐다

§3(`spec/2-navigation/2-trigger-list.md:182-184`):

> 구현은 그 재조회에 `relations: ['workflow']` 를 실어 닫았지만, **자매 스케줄 축과 달리 이 축에는
> 캐너리가 아직 없다** — 그쪽은 네 응답 형태를 양성/음성으로 고정한다(`3-schedule.md §4`). 보장을
> 구현보다 넓게 적지 않기 위해 이 비대칭을 함께 적는다.

이 PR 이 `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` 를 신설한 이상 이 문장은 사실이 아니게
됐다 — 비대칭 자체가 소멸했고, 뒤따르는 근거절("보장을 구현보다 넓게 적지 않기 위해…")도 함께 낡는다.

**그런데도 이 상태로 shipping 하는 것이 이 PR 기준으로는 타당하다고 판단한다.** 근거:

- `--impl-prep` 3개 checker(`plan_coherence`·`rationale_continuity`·`convention_compliance`, `review/consistency/2026/09/10/13_48_39/`)가 독립적으로 CRITICAL 을 냈다 — 이 문장을 쓴 것은 developer 가
  아니라 project-planner(PR #1304, `dc77317cd4`)다. `git blame` 대신 diff 스코프(`codebase/` 0건) ·
  게이트 종류(`--spec`) · 소유 plan 의 `owner: planner` 세 신호로 실측 확인했다(`convention_compliance.md`
  가 이 세 신호를 직접 인용).
- 즉 `CLAUDE.md` §자기-반증형 소정정의 **조건 1**("developer 자신이 그 문서에 썼다")이 명백히 깨진다 —
  developer 가 이 문장을 직접 고치면, 예외 조항이 명시적으로 경계하는 "썼다는 이유로 아무나 고치는 만능
  통행증화" 를 재현하게 된다.
- plan(`trigger-workflow-ref-canary.md` §"T-4 는 이 PR 에서 빼낸다")이 이를 정확히 식별해 spec 문장 정정을
  이 PR 범위에서 제외하고, `spec-draft-nullable-notation-followups.md` 에 planner 턴 후속 항목(§3 문장
  정정 + `code:` frontmatter 등재 + `PROJECT.md` 규칙 보강, 세 항목을 한 턴으로 묶음)으로 명시 등재했다.
  이 PR 의 diff 에 `spec/**` 파일이 전혀 없는 것도 이와 일치한다(`spec_impact: none` 정확).

**따라서 이 항목은 이 developer PR 에 대한 결함이 아니라 SPEC-DRIFT 로 분류한다** — 코드(캐너리)가
옳고 spec 문장이 낡았으며, 정정은 이 PR 이 아니라 다음 project-planner 턴(`--spec` 게이트)이 담당해야
한다. planner 턴이 반영할 때: `2-trigger-list.md §3` 의 인용 문장을 취소선 처리 + "실측:
`codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` 로 다섯 형태(생성 두 서브경로 음성 + 목록·단건·
수정 양성)를 고정함" 으로 정정하고, frontmatter `code:` 목록에 그 e2e 파일 경로를 추가해야 한다(plan 이
이미 정확히 이렇게 명시함).

### [INFO] plan 체크리스트 하단이 본문 서술과 살짝 어긋난다 (코드 결함 아님)

`plan/in-progress/trigger-workflow-ref-canary.md` 상단 "완료의 기계적 증거" 절은 "4단계 전부
PASS(lint · build(ratchet 2개 baseline 일치) · unit 454스위트/9,517 · e2e 52스위트/305 + playwright 51)"
라고 서술하는데, 파일 하단 `## 체크리스트` 는 `- [ ] \`run-test.sh\` 4단계` 를 **미체크**로 남겨 뒀다.
개별 항목(타입체크 ratchet, backend e2e, unit 전체)은 각각 체크돼 있어 "4단계를 개별적으로 수행했으나
`run-test.sh` **래퍼 자체**로는 아직 안 돌렸다"는 구분일 가능성이 높지만, 문서만 보면 애매하다.
`feedback_stale_plan_claims_and_checklist_sync` 교훈과 같은 패턴이니 체크박스와 본문 서술을 동기화할
것을 권한다 — 기능적 결함은 아니다.

## 확인했으나 문제 없음 (참고)

- `expectTriggerWorkflowRef` 의 `null` 배제, 여분 키/누락 키, UUID 형식, 빈 문자열 `name`, 비밀 컬럼
  혼입 8개 self-spec 케이스 모두 헬퍼 구현(`trigger-workflow-ref.ts:66-94`)과 1:1 대응 확인.
- `create()` 두 서브경로(평범한 생성 / chatChannel 포함 생성) 모두 재조회에 `relations` 미포함 —
  §3 "부재는 생성 응답에만" 과 일치. e2e case #1 이 둘 다 개별로 문다.
- e2e 파일 신설·jest 배선(unit `rootDir:'src'` vs e2e `testRegex:'.e2e-spec.ts$'`) 근거를
  `test/jest-e2e.json`/`jest.config.ts` 원본으로 직접 재확인 — plan·convention_compliance 리뷰의
  실측과 일치.
- `ChatChannelConfigDto.botToken` 필수 필드 확인(`chat-channel-config.dto.ts:185-187`, `@IsOptional()`
  없음) — e2e 주석의 "생략 불가" 실측과 일치.
- TODO/FIXME/HACK/XXX 주석 없음 (3개 신규 파일 전수 grep).

## 요약

캐너리(T-1~T-3)는 요구사항을 정확하게 충족한다 — "TriggerDto shape 를 반환하는 경로는 정확히 넷"이라는
plan 의 핵심 전제를 컨트롤러 시그니처·서비스 반환 타입·swagger 데코레이터 세 방식으로 독립 재검증했고
모두 일치했다. 캐너리 case #5 가 실제 W4 결함이 존재했던 `update()` 의 `chatChannel` 재조회 분기를
정확히 겨냥하고 있음을 코드 인과관계로 확인했으며(뮤테이션 재실행은 병렬 리뷰 안전 규약상 생략),
plan 이 제시한 세 엣지 케이스(schedule GET 단건 / workflow 삭제 / schedule PATCH+chatChannel)는 모두
소스 대조로 "정확히 out-of-scope" 임을 확인했다 — 특히 "workflow 삭제" 는 FK CASCADE 로 인해 스키마
상 아예 발생 불가능한 상태임을 엔티티 정의로 확정했다. §3 의 "캐너리가 아직 없다" 문장이 이제 거짓이
된 것은 SPEC-DRIFT 이지 이 PR 의 결함이 아니다 — developer 가 자기-반증형 소정정 조건 1 미충족을
정확히 판별해 planner 턴으로 넘겼다(이미 별도 트래커에 등재됨). 다만 두 가지는 후속 주의가 필요하다:
(1) chatChannel PATCH 가 bot-token single-path/grace 정책을 우회하는 것으로 읽히는 사전 존재 결함이
plan 에 "질문"으로만 등재돼 있어 판정이 미뤄지고 있고, (2) 헬퍼/e2e 주석이 `assertMatchesContract` 의
null-치환 탐지 능력을 실제보다 좁게 일반화해 서술한다(기능적 영향은 없음, 서술 정확도 문제).

## 위험도

LOW — 리뷰 대상 diff(T-1~T-3) 자체에는 기능적 결함이 없다. WARNING 2건은 각각 (a) 이 PR 이 만들지 않은
사전 존재 비즈니스 로직 리스크(이미 질문으로 등재·판정 대기 중)와 (b) 코멘트 정확도 문제이고, SPEC-DRIFT
1건은 절차상 올바르게 planner 턴으로 이관됐다. 이 PR 자체를 막을 사유는 없다.
