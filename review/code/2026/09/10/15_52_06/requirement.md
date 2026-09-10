# 요구사항(Requirement) 리뷰 — 2라운드 (`trigger-workflow-ref` 캐너리, R-CC-10 경고문 사실관계 재검증)

## ⚠️ 관측된 저장소 이상 상태 — 다른 reviewer 의 미원복 뮤테이션으로 추정

본 리뷰 세션 종료 시점에 `git status --short` 를 확인한 결과, **내가 만들지 않은** 미커밋 변경이
워킹트리에 남아 있다:

```
 M codebase/backend/src/shared/testing/trigger-workflow-ref.ts
```

`git diff` 내용은 아래와 같다 — `expect(typeof ref.id).toBe('string');` 한 줄이 삭제돼 있다:

```diff
   const ref = (workflow ?? {}) as { id?: unknown; name?: unknown };
   expect(Object.keys(ref).sort()).toEqual([...WORKFLOW_REF_KEYS].sort());
-  expect(typeof ref.id).toBe('string');
   // 손으로 적은 정규식 대신 정본을 실행한다 — `isUuidShaped` 가 "Postgres `uuid` 컬럼이 파싱할
   // 수 있는 형태인가" 를 이미 소유한다(`workflow.id` 가 바로 그 컬럼이다).
   expect(isUuidShaped(String(ref.id))).toBe(true);
```

이 삭제는 **내가 실행한 것이 아니다** — 나는 이 파일에 어떤 Write/Edit/Bash 편집도 수행하지 않았고
가설 검증은 프롬프트 지시대로 scratch 사본에서만 했다(아래 "검증 방법" 참조). 형태로 볼 때 1라운드
`testing.md` 가 남긴 "`id` 쪽 대조군(간접 방어 확인)" 뮤테이션 실험과 판박이라, **다른 reviewer 가
동일 워킹트리에서 진행 중인 뮤테이션 실험의 중간 상태**일 가능성이 매우 높다. 프롬프트 규약(§검증용
뮤테이션 규약)에 따라 나는 이 파일을 `git checkout`/`git restore` 로 되돌리지 않았다 — 그 명령은
다른 reviewer 의 미완료 작업을 파괴할 수 있다. **이 사실을 그대로 보고하니, 오케스트레이터가 전
reviewer 완료 후 이 잔여물의 원복 여부를 확인할 것을 권한다.**

---

## 이번 라운드의 검증 범위

1라운드(`review/code/2026/09/10/14_34_18`)에서 저자가 `assertMatchesContract` 서술을 *"못 잡는다"*에서
*"이 분기에 그 검증자를 거는 기존 호출이 0건"*으로 좁혔다. 그 뒤 `--impl-done`
(`review/consistency/2026/09/10/15_23_41` rationale_continuity W1)이 case E docstring 에
R-CC-10 위반 재현 경고를 요구해 13번째 수정으로 반영됐다(커밋 `c696ace07`). 이번 라운드는 그 **좁힌
서술**과 **새 경고문**이 사실과 line-level 로 일치하는지를 실측으로 확인하는 데 집중했다 — 저자가 이
세션에서 이미 세 번(`assertMatchesContract` 범위·`tsconfig` exclude·`User` 선례) 근거 문장을 틀렸기
때문이다.

## 검증 방법

Read/Grep/Bash(읽기 전용)만 사용했다. 저장소 파일에 대한 Write/Edit 는 하지 않았고, 뮤테이션 재현이
필요한 가설 검증은 이번 라운드에서는 수행하지 않았다(1라운드가 이미 두 종류의 뮤테이션 실험을 마쳤고,
이번 라운드의 초점은 "서술의 사실관계"라 소스 코드·spec 문서를 직접 열어 대조하는 것으로 충분했다).

## 검증한 것과 결과

| # | 검증 대상 | 방법 | 결과 |
|---|---|---|---|
| 1 | `assertMatchesContract` 범위 좁힘 — "optional-non-nullable 필드 `null` 은 잡는다" | `response-contract.ts` `visit()` 실제 코드 읽음 | **정확**. `!isRequired && !nullable && value===null` 조합이 `kind:'null'` 로 걸린다 (`response-contract.ts:259-268`) |
| 2 | `assertMatchesContract` 범위 좁힘 — "chatChannel 재조회 분기에 그 검증자를 거는 기존 호출 0건" | `grep -rn assertMatchesContract codebase/backend/test` 전수 확인 — `schedule-trigger.e2e-spec.ts` PATCH 호출(§G, line 372-379)은 `chatChannel` 없이 `isActive` 만 PATCH, `chat-channel-trigger-create.e2e-spec.ts` 는 POST/interaction-revoke 만 | **정확**. PATCH+`chatChannel` 조합에 `assertMatchesContract(…, TriggerDto)` 를 거는 기존 호출은 확인된 범위 내 0건 |
| 3 | `tsconfig.build.json` exclude 서술 — "root 후보만 거르고 import 하면 emit 된다" | `tsconfig.build.json` 실제 exclude 목록(`src/shared/testing/**` 포함) 확인 + 프로덕션(non-`*.spec.ts`) 파일 중 `shared/testing/**` import 0건 재확인(`grep -rln`) | **정확** — TS `exclude` 는 root-candidate 판별에만 관여하는 것이 표준 동작이고, 실측한 import 파일은 전부 `*.spec.ts`(자체가 별도 exclude 패턴에 걸림) |
| 4 | `User` 선례 인용 철회 → `CREATOR_PROJECTION` 선례로 교체 | `grep -rn CREATOR_PROJECTION codebase/backend/src` | **정확**. `workflow-versions.service.ts:92` 에 단일 상수로 export 돼 여러 지점에서 재사용됨 — "동일 리터럴 다중 복사 → 단일 상수 통합" 서술과 부합 |
| 5 | **R-CC-10 경고문(case E docstring, 13번째 수정)** — spec 문면과 line-level 일치 여부 | `spec/5-system/15-chat-channel.md:608-610` R-CC-10 원문과 `trigger-workflow-ref.e2e-spec.ts:224-241` 대조 | **불일치 발견** — 아래 발견사항 참조 |
| 6 | `setupChatChannel` 이 grace 백업·audit·`chatChannelRotatedAt` 을 건너뛴다는 서술 | `triggers.service.ts` `setupChatChannel`(915-1030행)과 `rotateBotToken`(1238행~) 대조 | **정확**. `setupChatChannel` 은 `secrets.rotate(botTokenRef, ws, botToken)` 을 무조건 실행할 뿐 v2 백업·`chatChannelRotatedAt`·전용 audit 이 없음. `rotateBotToken` 만 6단계(백업→교체→재설정→`chatChannelRotatedAt` 갱신)를 갖춤 |
| 7 | §3 "이 축에는 캐너리가 아직 없다" SPEC-DRIFT | `spec/2-navigation/2-trigger-list.md:182` 재확인 | 여전히 거짓 문장으로 남아 있으나 **이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:1806` 항목 1로 planner 이관됨** — 새 발견 아님, 명시만 함 |

## 발견사항

- **[WARNING]** R-CC-10 경고문이 인용하는 rotate 엔드포인트 경로에 `/api/` 가 빠져 spec 원문·코드베이스
  내 다른 모든 참조와 불일치한다.
  - 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts:227-228` (docstring 본문) 및
    `:254` (인라인 주석, "그 필수 요구가 R-CC-10 single-path 를 우회한다").
  - 상세: 코드가 인용하는 문구는 *"R-CC-10(Bot Token 변경은 `POST /triggers/:id/chat-channel/rotate-bot-token`
    single-path)"* 인데, spec 원문(`spec/5-system/15-chat-channel.md:608-610`, R-CC-10 절)은
    *"토큰 변경은 항상 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 이며"* 로 `/api/` 를
    포함한다. 실제 라우트도 `/api/` 접두어를 쓴다 — `triggers.controller.ts:238,247`
    (`@Post(':id/chat-channel/rotate-bot-token')`, 컨트롤러 자체가 `/api/triggers` 아래 마운트),
    `triggers.controller.spec.ts:9`, `triggers.service.ts:561,584`,
    `dto/chat-channel-config.dto.ts:191,206` 이 전부 `/api/` 를 포함해 일관되게 인용한다. **이 새
    docstring 만 접두어가 빠졌다.** `git show c696ace07 -- codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`
    로 이번 라운드(13번째 수정, `--impl-done` 요구분)에서 신규로 작성된 문장임을 확인했고, 그 직전
    커밋(`f71aa584e`)에는 `R-CC-10`/`rotate-bot-token`/`우회` 가 0건이었다는 저자의 주장도 grep 으로
    재확인했다(정확함).
  - 영향: 테스트 동작·단언에는 영향 없음(요청 URL 이 아니라 docstring/주석 문자열이므로 런타임 결함
    아님). 다만 이 문서 블록의 목적 자체가 *"이 요청 바디가 spec 규칙을 우회한다"* 는 것을 다음
    사람에게 정확히 알리는 것이므로, 경로 오타는 그 사람이 spec 을 찾아 대조하려 할 때 링크·경로
    문자열이 어긋나는 사소한 마찰을 만든다. 이 세션에서 근거 문장이 이미 세 번(범위 좁힘·exclude
    의미·선례 인용) 부정확했던 패턴의 네 번째 반복이라는 점에서 기록해 둔다.
  - 제안: `/api/` 를 추가해 spec 원문 및 코드베이스 내 다른 6개 인용과 일치시킬 것 (`POST
    /api/triggers/:id/chat-channel/rotate-bot-token`). 코드 동작을 바꾸는 수정이 아니므로 developer
    권한 안에서 바로 고칠 수 있는 사소한 수정이다.

- **[SPEC-DRIFT, 재확인만]** `spec/2-navigation/2-trigger-list.md:182` 의 *"자매 스케줄 축과 달리 이
  축에는 캐너리가 아직 없다"* 는 이 PR 로 캐너리가 생겨 거짓이 됐다.
  - 위치: `spec/2-navigation/2-trigger-list.md:182`.
  - 상세: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:1806` (항목 1)에 정정
    대상으로 등재돼 planner 후속으로 이관돼 있다. 1라운드 RESOLUTION.md 도 동일하게 처분했다
    (`requirement W3 SPEC-DRIFT` → "planner 후속 1번"). **새 발견이 아니며 재지적 목적이 아니라
    이번 라운드 검증 항목으로 확인했다는 사실만 기록한다.**
  - 제안: 없음(이미 이관됨). 반영 시 대상은 `spec/2-navigation/2-trigger-list.md §3` 해당 문장 취소선
    처리 + `spec-draft-nullable-notation-followups.md` 항목 1 종결.

- **[INFO]** case E 요청 바디의 인라인 주석(`chatChannel.botToken must be a string` 400 재현
  주장)은 이번 세션에서 e2e(Dockerized DB) 를 재실행할 수 없어 직접 재현 검증하지 못했다. DTO 상
  `botToken: string` 이 `@IsOptional()` 없이 `@IsString()` 만 붙어 있어(`dto/chat-channel-config.dto.ts:185-187`)
  값 생략 시 검증 실패가 발생한다는 정적 근거는 확인했으나, 실제 에러 메시지 문자열까지는 대조하지
  못했다. 위험도는 낮다 — 앞선 두 라운드가 이미 이 축을 "실측" 이라고 명시했고, 이번 라운드가 새로
  반증한 것은 아니다.

## 요약

이번 라운드의 핵심 질문 — "저자가 좁힌 서술과 새로 쓴 R-CC-10 경고문이 사실과 정확히 일치하는가" —
에 대해, `assertMatchesContract` 범위 좁힘·`tsconfig.build.json` exclude 의미·`CREATOR_PROJECTION`
선례 인용 세 건은 모두 소스 코드 직접 대조로 정확함을 재확인했다(3전 3승 — 이전 두 번의 실수가
이번엔 재발하지 않았다). 그러나 `--impl-done` 이 요구해 신규로 작성된 R-CC-10 경고문(case E
docstring)에서 rotate 엔드포인트 경로가 `/api/` 접두어를 빠뜨려 spec 원문 및 코드베이스 내 다른
6곳의 동일 인용과 불일치하는 것을 발견했다 — 기능적 결함은 아니지만 이 세션이 반복해서 노출한
"근거 문장의 사실 정확도" 문제의 네 번째 사례다. §3 "캐너리가 아직 없다" SPEC-DRIFT 는 이미 planner
백로그로 이관돼 있어 재지적하지 않고 확인만 했다. 그 외 기능 완전성·엣지 케이스·에러 시나리오·
반환값 관점에서 이 diff(테스트 인프라 전용, 프로덕션 코드 변경 0건)에 새로운 결함은 발견하지
못했다. 별도로, 리뷰 종료 시점에 이 리뷰와 무관한 미원복 워킹트리 뮤테이션 1건(다른 reviewer 것으로
추정)을 관측해 상단에 그대로 보고했다 — 직접 원복하지 않았다.

## 위험도

LOW — 발견된 유일한 코드/문서 결함은 주석/문서 인용 텍스트의 경로 오타(`/api/` 누락)로 테스트 동작에
영향이 없고, SPEC-DRIFT 는 이미 이관 처리돼 있다. 프로덕션 코드 변경이 없는 테스트 전용 diff. (단
상단의 워킹트리 이상 상태는 이 diff 자체의 위험도가 아니라 병렬 리뷰 인프라의 잔여물이다.)
