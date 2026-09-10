STATUS: success

# Cross-Spec 일관성 검토 — `trigger-workflow-ref-canary` (mode: --impl-prep)

대상 plan: `plan/in-progress/trigger-workflow-ref-canary.md`
대상 spec: `spec/2-navigation/2-trigger-list.md` (전문 포함 번들)
교차 대상: `codebase/backend/src/modules/triggers/triggers.controller.ts` · `triggers.service.ts` · `dto/responses/trigger-response.dto.ts` · `spec/5-system/2-api-convention.md §5.4` · `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts` · `codebase/backend/test/schedule-trigger.e2e-spec.ts` · `codebase/backend/src/modules/schedules/schedules.controller.ts`

## 0. 결론 먼저

**경로 열거는 완전하다.** `TriggerDto`-shape 응답을 내보내는 코드 경로는 정확히 네 개
(`create` / `findAll` / `findOneDetail` / `update`, `update` 는 `chatChannel` 유무로 다시
갈림) 이고, plan 이 잡은 다섯 개(`양성 4 + 음성 1`)와 정확히 일치한다. 여섯 번째 경로는
발견하지 못했다. spec 검증 두 항목(§5.4 키-생략 대 `null`, `TriggerWorkflowRefDto` shape)도
현재 코드·spec 과 정합한다. 다만 아래 두 가지는 **WARNING/INFO** 로 남긴다 — (1) 자매
스케줄 축의 `workflow` 참조 shape 가 `TriggerDto.workflow` 와 겹치는 서술을 갖고 있어 향후
drift 여지가 있고, (2) "외부 호출 배선 불필요" 라는 plan 문구가 "실제 네트워크 호출이 발생하지
않는다" 로 오독될 수 있다(실제로는 발생하고 실패가 삼켜질 뿐이다).

## 1. 경로 열거 — `TriggerDto`-shape 를 내보내는 모든 코드 경로

`triggers.controller.ts` 의 9개 엔드포인트를 전수 확인했다:

| # | 엔드포인트 | 반환 타입 | `TriggerDto` shape? | `workflow` 적재 |
|---|---|---|---|---|
| 1 | `POST /api/triggers` | `Trigger` → `sanitizeForResponse` | ✅ | **없음** — `create()` 는 `saved`(관계 미로드) 또는 `chatChannel` 분기의 `refreshed`(`relations` 옵션 없는 재조회) 중 하나를 반환하며 **둘 다 `workflow` 를 안 싣는다** |
| 2 | `GET /api/triggers` | `PaginatedResponseDto<TriggerDetail>` | ✅ (item shape) | `leftJoinAndSelect('t.workflow','w')` — 항상 있음 |
| 3 | `GET /api/triggers/:id` | `TriggerDetail` → `sanitizeForResponse` | ✅ | `findById` 의 `relations: ['workflow']` — 항상 있음 |
| 4 | `PATCH /api/triggers/:id` (chatChannel 없음) | `Trigger` → `sanitizeForResponse` | ✅ | `findById` 로 로드한 `trigger` 를 `save()` 한 `saved` 를 그대로 반환 — `workflow` 유지 |
| 5 | `PATCH /api/triggers/:id` (`chatChannel` 포함) | `Trigger` → `sanitizeForResponse` | ✅ | `setupChatChannel` 뒤 `relations: ['workflow']` 를 실은 재조회 — **W4 로 한 번 깨졌다가 지금은 있음** |
| 6 | `GET /:id/history` | `Array<{id,status,startedAt,durationMs}>` | ❌ | 해당 없음 |
| 7 | `DELETE /:id` | `void` (204) | ❌ | 해당 없음 |
| 8 | `POST /:id/notification/rotate-secret` | `{secret, rotatedAt}` | ❌ — trigger 본문 없음 | 해당 없음 |
| 9 | `POST /:id/interaction/revoke-token` | `{token}` | ❌ — trigger 본문 없음 | 해당 없음 |
| 10 | `POST /:id/chat-channel/rotate-bot-token` | `{rotatedAt, triggerId, chatChannelHealth, botIdentity}` | ❌ — trigger 본문 없음 (id·health·botIdentity 만, `name`/`config`/`workflow` 없음) | 해당 없음 |

**질문별 답**:

- **rotate/revoke 세 엔드포인트가 trigger 본문을 반환하는가** — 아니다. `rotateNotificationSecret`
  → `{secret, rotatedAt}` (`triggers.service.ts:1141-1175`), `revokePerTriggerToken` →
  `{token}` (`:1185-1220`), `rotateBotToken` → `{rotatedAt, triggerId, chatChannelHealth,
  botIdentity}` (`:1238-1367`). 셋 다 리터럴 객체를 직접 반환하고 `sanitizeForResponse` 를
  거치지 않는다 — 거칠 이유가 없다(트리거 엔티티를 감싼 shape 가 아니므로).
- **`POST /api/triggers` 변형·쓰기 후 trigger 를 반환하는 다른 자리** — `create()` 단
  하나뿐이고 이미 canary 대상(양성 4 + 음성 1 의 음성 1)이다.
- **`sanitizeForResponse` 가 단일 funnel 인가** — 그렇다. `TriggerDto`-shape 를 내보내는
  네 경로(1/2/3/4-5) 는 전부 `sanitizeForResponse` 를 거친다. 우회하는 자리는 없다 — 나머지
  다섯 엔드포인트는애초에 `TriggerDto` shape 가 아니라서 대상 밖이다.
- **`2-trigger-list.md §3` 문서화된 다른 module 의 trigger-shape 방출** — API 표(§3,
  `spec/2-navigation/2-trigger-list.md:157-165`)의 9개 행을 컨트롤러 10개 핸들러(`history`
  포함)와 1:1 대조했고 누락·초과가 없다. `workflows` 모듈은 `TriggersService`/`Trigger`
  repository 를 참조하지 않는다(grep 0건) — 역방향(workflow → trigger) 노출 경로 없음.
  `schedules.controller.ts` 는 `ScheduleDto.trigger` 를 갖지만 이것은 **다른 shape**
  (`{id, name, workflowId, workflow?: {name}}`, `type`/`config`/`isActive` 등 없음) 이라
  `TriggerDto` 가 아니다 — plan 의 "무엇을 하지 않나" 절이 이미 이 경계를 명시했고, 실측도
  그 경계를 뒷받침한다.
- **`ChatChannelController` 잔존 여부** — `codebase/backend/src/modules/chat-channel/`
  에 `*.controller.ts` 파일이 없다(find 0건). `rotate-bot-token` 은 컨트롤러 주석이 말하는
  대로 완전히 `TriggersController` 로 이전됐고 중복 엔드포인트가 남아있지 않다.

**결론**: 여섯 번째 경로 없음. plan 의 다섯 갈래가 `TriggerDto`-shape 응답의 전수다.

## 2. spec 대조 — §3 註의 "생성 응답에만" 이 코드와 일치하는가

`2-trigger-list.md:174-187` 의 註를 코드와 대조:

> "부재는 **생성 응답에만** 있고 목록·상세·**수정**(`update()` 가 `findById` 로 시작한다)에는
> 채워진다."

- `create()` (`triggers.service.ts:392-452`): `trigger = this.triggerRepository.create({...})`
  는 `workflow` 관계를 절대 설정하지 않는다. `chatChannel` 분기의 재조회(`:446-449`)도
  `relations` 옵션이 없다. **두 서브경로 모두 부재** — 註의 "생성 응답에만" 과 일치.
- `findAll`/`findOneDetail`/plain `update`: 전부 `relations: ['workflow']` 또는
  `leftJoinAndSelect` 를 탄다 — 註와 일치.
- `chatChannel` 포함 `update`: `:548-551` 이 명시적으로 `relations: ['workflow']` 를 실은
  재조회를 한다 — **지금은** 있음. 이 부분이 §3 註가 스스로 적은 "한 번 거짓이었다" 서술과
  정확히 대응한다(W4 회귀 → 수정 완료 → 캐너리 부재라는 현재 상태).

**정합**. §3 註는 현재 코드와 어긋나지 않는다. plan 의 T-4 가 정정하려는 문장("자매 스케줄
축과 달리 이 축에는 캐너리가 아직 없다")도 §1 재판정에서 확인한 실측(0건)과 일치한다 —
지금 시점에는 참인 문장이고, T-3 이 착지해야 거짓이 된다는 plan 의 논리 구조가 맞다.

## 3. `TriggerWorkflowRefDto` shape + §5.4 키-생략 계약

- `TriggerWorkflowRefDto` (`trigger-response.dto.ts:23-30`): `id`(`@ApiProperty({format:
  'uuid'})`) 와 `name`(`@ApiProperty()`) **두 필드만**. plan 의 "정확히 `{id, name}`" 주장과
  일치.
- `TriggerDto.workflow` 선언 (`:94-101`): `@ApiPropertyOptional({ type: () =>
  TriggerWorkflowRefDto }) workflow?: TriggerWorkflowRefDto;` — `| null` 이 아니다.
- `spec/5-system/2-api-convention.md §5.4` (`:221-252`) 의 두 표현 중 **키 생략**은 "(b)
  선택적 부가 컨텍스트라 소비자가 부재를 정상 경로로 다룰 때" 에 해당하고, 선언 규칙은
  "키를 생략하는 필드 → `@ApiPropertyOptional()` + `field?: T` (`| null` 금지)" 라고 못
  박는다. `TriggerDto.workflow` 의 실제 선언(`?: T`, `| null` 없음)이 이 규칙을 그대로
  따른다. **plan 의 "key-omission 단언이 맞는 계약" 주장은 §5.4 와 정합**하다 — `null` 을
  단언하면 오히려 선언과 어긋나는 값을 기대하는 테스트가 된다.

## 4. `chatChannel` PATCH 분기 진입 조건 + e2e 도달 가능성

- `update()` 의 재조회 분기는 정확히 `if (chatChannel) { ... }` (`triggers.service.ts:537`)
  이다 — plan 서술과 일치. `chatChannel` 은 `dto` 구조분해의 top-level 키이므로, PATCH
  바디에 `chatChannel` 객체가 (내용 무관, truthy 이기만 하면) 있으면 진입한다.
- `chat-channel-trigger-create.e2e-spec.ts:26-29` 의 파일 헤더 註가 이미 명시한다: **"외부
  API(auth.test / GET /applications/@me / Telegram setWebhook) 는 e2e mock 이 없으므로 호출
  시 chatChannelHealth=degraded 로 떨어지지만 trigger 생성 자체는 성공"**. 이는 telegram
  생성 케이스(`:142-171`)가 실제로 `TELEGRAM_API_BASE = 'https://api.telegram.org'`
  (`telegram-client.ts:14`) 로 나가는 실 네트워크 호출을 **시도**하고, 그 호출이 5초
  timeout + 3회 재시도(`telegram-client.ts:200-221`)를 거쳐 실패해도 `setupChatChannel`
  의 `try/catch` (`triggers.service.ts:981-1046`) 가 삼켜 `degraded` 로 기록할 뿐 트리거
  저장/응답 자체는 성공시킨다는 뜻이다.
  - `update()` 도 동일한 `setupChatChannel` 을 호출하므로(`:539`) **같은 catch 가 적용**된다
    — 네트워크 실패와 무관하게 재조회(`relations:['workflow']` 포함) 까지 도달하고 200 을
    반환한다. **plan 의 "reachable" 주장은 맞다.**
  - 다만 plan 의 "외부 호출 배선이 필요 없다" 는 **"e2e mock 인프라 신설 불필요"** 라는
    뜻이지 "네트워크 호출이 발생하지 않는다" 는 뜻이 아니다 — 실제로는 매 호출마다 최대
    ~18초(5s×3 + 1s + 2s backoff, 완전 무응답 시)까지 걸릴 수 있는 시도가 발생한다.
    기존 create 케이스가 이미 이 지연을 감수하고 있으므로 새 e2e #5 가 **같은 종류의
    지연을 한 번 더** 추가한다(생성 1회 + PATCH 1회) — 기능적으로는 통과하지만, 이 파일이
    jest 기본 timeout 을 넘길 가능성을 배제하려면 개별 `it()` 에 넉넉한 timeout 을 주는
    편이 안전하다(기존 create 계열 `it()` 들의 실제 timeout 설정과 동일 수준으로).
    **cross-spec 결함은 아니고 구현 세부사항**이지만, 이 항목 확인을 명시적으로 요청받아
    기록한다.

## 5. 발견사항

- **[INFO] "외부 호출 불필요"라는 plan 문구는 "네트워크 시도 없음"으로 오독될 여지**
  - target 위치: `plan/in-progress/trigger-workflow-ref-canary.md` T-3 절, "telegram
    chatChannel 을 가진 webhook 트리거를 만든 뒤 ... 외부 호출 배선이 필요 없다"
  - 충돌 대상: `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts:26-29` (파일
    헤더 註가 실제로는 "mock 없이 실 네트워크 호출을 시도하고 실패를 삼킨다"고 명시)
  - 상세: plan 문구와 실제 동작이 결론(테스트 통과)에서는 일치하지만, 문구만 읽으면
    "이 경로는 네트워크에 안 나간다" 로 오독되기 쉽다. `2-trigger-list.md` 자체와의
    직접 충돌은 아니며, e2e 스펙 파일의 기존 註와 plan 서술 사이의 **뉘앙스 차이**다.
  - 제안: T-3 구현 시 새 e2e 파일 상단 주석에 create 케이스와 동일하게 "실 네트워크 시도
    + best-effort 삼킴" 문구를 명시하면 다음 사람이 헷갈리지 않는다. spec 수정 불필요.

- **[INFO] 스케줄 sibling 축의 `workflow` 참조가 `TriggerDto.workflow` 와 다른 shape 를
  갖고, 그 근거 서술이 두 파일에 나뉘어 있음**
  - target 위치: `2-trigger-list.md:186-187` ("이 참조는 `id` 와 `name` 을 담는다 ... 한쪽을
    다른 쪽으로 갈아 끼우지 말 것")
  - 충돌 대상: `schedules.controller.ts:69-84` (`ScheduleDto.trigger.workflow` 는 `{name}`
    한 필드만), `trigger-response.dto.ts:15-21` (같은 경고를 반대 방향에서 서술)
  - 상세: 실제 충돌은 없다 — 두 shape 가 의도적으로 다르다는 서술이 **양쪽 파일에 각각**
    있고 서로 참조한다(`TriggerWorkflowRefDto` JSDoc ↔ `2-trigger-list.md` 註). 다만 이
    비대칭이 "왜 다른가" 를 설명하는 근거(소비처가 읽는 필드만 담는다)가 세 곳(spec,
    schedules 컨트롤러 주석, trigger-response.dto 주석)에 흩어져 있어 향후 한쪽만 바뀌면
    drift 가능성이 있다.
  - 제안: 지금 당장 조치 불필요(plan 범위 밖, "무엇을 하지 않나" 절이 이미 이 경계를
    존중한다). 향후 두 shape 중 하나가 바뀌는 PR 이 있으면 이 검토를 참조해 양쪽을 동시
    확인할 것.

발견된 CRITICAL/WARNING 등급 충돌 없음.

## 요약

`TriggerDto`-shape 를 반환하는 코드 경로는 `create`/`findAll`/`findOneDetail`/`update`(2
분기) 네 갈래뿐이며, plan 이 잡은 다섯 개의 e2e 케이스와 정확히 일치한다 — rotate-secret,
revoke-token, rotate-bot-token, history, delete 다섯 엔드포인트는 전부 `TriggerDto` shape
가 아니라서 대상 밖이고, `sanitizeForResponse` 가 네 갈래 모두의 단일 funnel 로 확인됐다.
`2-trigger-list.md §3` 의 "부재는 생성 응답에만" 註는 현재 코드와 정확히 일치하고, T-4 가
정정하려는 "캐너리가 아직 없다" 문장도 실측(0건)과 일치하는 참인 문장이다.
`TriggerWorkflowRefDto = {id, name}` 및 key-omission(“null” 아님) 단언 설계는 §5.4 규칙과
정합한다. `chatChannel` PATCH 분기(`if (chatChannel)`)와 telegram e2e 도달 가능성도 코드로
확인했다 — best-effort catch 덕분에 네트워크 결과와 무관하게 200 에 도달한다. 발견된 것은
INFO 두 건(문구 오독 여지, 근거 산재)뿐이며 둘 다 spec 수정을 요구하지 않는다.

## 위험도

NONE
