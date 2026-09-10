# Code Review 통합 보고서 — `TriggerDto.workflow` 캐너리 (`trigger-workflow-ref-canary-96ae33`)

> 이 파일은 호출자(main)가 썼다 — `SUMMARY.md` basename 은 sub-agent Write 가 훅으로 차단된다.

**대상 diff**: 신규 3파일뿐이고 **프로덕션 코드 변경 0건**이다.
`codebase/backend/src/shared/testing/trigger-workflow-ref.ts`(헬퍼) ·
`.../trigger-workflow-ref.spec.ts`(self-spec) · `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts`(e2e).

## 전체 위험도

**HIGH** — 단, **이 changeset 자체는 LOW** 다. 등급이 HIGH 인 이유는 하나다: `api_contract` 가
라우터에게서 받은 심층 대조 과제를 수행하다 **이미 배포된 프로덕션 코드의 CRITICAL 2건**을
찾아냈고, 그중 하나는 spec 이 명시한 보안 불변식(bot token rotation 의 24h grace + audit 단일성)이
대체 경로로 무력화된다는 것이다. **두 건 모두 이 diff 밖**이며(이 diff 는 그 코드를 한 줄도
건드리지 않는다) 이 PR 을 차단할 사유가 아니다 — 그래서 `api_contract` 자신도 *"이 PR 을 차단할
사유는 아니지만 … 전체 위험도를 HIGH 로 표기하고 별도 후속 작업으로 즉시 등재할 것을 권고한다"*
로 적었다. 그 권고대로 **둘 다 트래커에 등재했고**, 처분과 근거는 `RESOLUTION.md` 에 있다.

나머지 7명은 scope **NONE** · 6명 **LOW** 다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 처분 |
|---|----------|----------|------|------|
| 1 | api_contract ④ / security W2 / requirement W1 (3명 독립) | **chatChannel PATCH 가 bot-token single-path 정책을 실질적으로 우회한다.** `assertChatChannelInputSafe` 는 `botTokenRef`·`inboundSigningRef`·`inboundSigning` 세 **필드명**만 400 으로 막는데, 실제 토큰 **값**을 나르는 `botToken` 은 `ChatChannelConfigDto` 에서 **필수**(`@IsOptional()` 없음)이고 PATCH·POST 가 같은 DTO 를 쓴다. `update()` 는 `chatChannel` 이 오면 무조건 `setupChatChannel` 을 부르고, 거기서 기존 값과 비교 없이 `secrets.rotate(botTokenRef, ws, cfg.botToken ?? '')` 로 같은 ref 의 plaintext 를 덮는다. 최종 효과가 `rotateBotToken` 과 동일한데 **① 24h grace 백업 ② 전용 audit action `TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED` ③ `chatChannelRotatedAt` 갱신** 셋을 건너뛴다. §5.4.1 이 PATCH 차단의 이유 (c) 로 든 *"audit 이 mixed 된다"* 가 **지금도 재현된다** | `triggers.service.ts`(`assertChatChannelInputSafe` · `update()` · `setupChatChannel` · 대조군 `rotateBotToken`) · `dto/chat-channel-config.dto.ts`(`botToken`) · 정책 `spec/5-system/15-chat-channel.md` §5.4.1 / R-CC-10 | **사전 존재 · 이 diff 밖.** 저자가 질문으로 등재했던 항목을 **CRITICAL 판정**으로 승급해 트래커에 기록. 처방은 PATCH 전용 DTO 분리(`botToken` 제외) |
| 2 | api_contract ⑤ (①의 조사 중 부수 발견) | **`ChatChannelCard` 편집-저장이 항상 400 이다.** 그 카드는 uiMapping·rateLimitPerMinute·languageLocale·languageHints 만 편집하는 UI 인데 PATCH 바디에서 `botToken` 을 **의도적으로 생략**한다(코드 주석이 *"single-path 정책상 PATCH 로 토큰 변경 불가"* 라고 그 가정을 적고 있다). 그러나 서버 DTO 는 `botToken` 을 필수로 받으므로 저장 시 **항상** `400 chatChannel.botToken must be a string` 이고 `onError` 의 "저장 실패" 토스트만 뜬다. 정적 근거(DTO 선언) + 이 PR 의 e2e 작성 중 실측(런타임, 같은 필드)이 서로 다른 방향에서 같은 결론을 가리킨다. 이 컴포넌트에는 단위 테스트가 없고 "uiMapping 만 PATCH" 경로의 통합 테스트도 없어 감지되지 않았다 | `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx`(`saveMutation`) · `dto/chat-channel-config.dto.ts` · `dto/update-trigger.dto.ts` | **사전 존재 · 이 diff 밖.** 신규 버그로 트래커 등재. **①의 DTO 분리와 한 수정으로 닫힌다** — 서버가 `botToken` 을 응답에서 strip 하므로 프런트가 재전송할 값을 가질 수 없어 프런트 수정 방향은 원리적으로 막혀 있다 |

## 경고 (WARNING)

16건. **코드 수정 12건은 이 턴에 적용**했고, 나머지는 트래커·planner 후속으로 이관했다 (`RESOLUTION.md`).

> **표의 16행은 reviewer 태그 16건과 1:1 이 아니다.** 행 13 은 `maintainability` 가 INFO 로 낸 것을
> 내가 적용했으므로 승격해 실었고, 행 16 은 같은 사안을 두 reviewer 가 낸 것을 한 행으로 합쳤다.
> 두 조정이 +1/−1 로 상쇄돼 총계가 우연히 16 과 같아진다 — 재구성하려는 다음 사람을 위해 적어 둔다
> (`review/code/2026/09/10/15_52_06` documentation INFO).

| # | 카테고리 | 발견사항 | 위치 | 처분 |
|---|----------|----------|------|------|
| 1 | testing W3 | **단언 하나가 vacuous 였다 — reviewer 가 뮤테이션으로 실증.** 헬퍼의 `expect(typeof ref.name).toBe('string')` 을 지워도 self-spec 이 **8/8 GREEN** 을 유지했다. 뒤따르는 `String(ref.name).length` 검사가 `String(42)`→`"42"` 로 통과시키기 때문이다. `id` 는 `isUuidShaped` 가 간접 방어하지만 `name` 에는 그런 이차 방어가 없다 — **비대칭적 취약점** | `trigger-workflow-ref.ts`(`name` 타입 단언) · `trigger-workflow-ref.spec.ts` | **수정.** 비-문자열 `name` 4값 + 비-문자열 `id` 케이스 추가. 신규 단언 3개를 각각 지우는 뮤턴트에서 **정확히 1건씩 RED** 확인 |
| 2 | testing W1 | **`present: true` 분기가 identity 를 안 문다.** 키셋·타입·UUID 형태만 보므로 **엉뚱한 relation 에서 채워진 그럴듯한 UUID+이름이 통과**한다 — "wrong relation" 회귀가 새는 자리 | `trigger-workflow-ref.ts` · e2e 양성 3곳 | **수정.** `expectedWorkflowId` 인자 추가, 양성 케이스가 아는 값을 넘긴다 |
| 3 | testing W2 | **`toBeDefined()` 는 `null` 을 거르지 않는다.** 최상위 `dto` 가 `null` 인 채로 `present: false` 판정을 통과할 수 있었다 | `trigger-workflow-ref.ts` 진입부 | **수정.** `expect(dto).not.toBeNull()` 선행 + self-spec 케이스 |
| 4 | maintainability W2 | **손으로 짠 UUID 정규식이 정본과 중복.** `common/utils/uuid.ts` 의 `isUuidShaped` 가 바이트 단위로 같은 패턴을 이미 소유한다 | `trigger-workflow-ref.ts` | **수정.** 정본 import 로 교체. 내 최초 grep 이 `shared/`·`test/helpers/` 만 봐서 `common/utils/` 를 못 봤다 — **측정 범위가 결론보다 좁았다** |
| 5 | requirement W2 | **내 근거 서술이 `assertMatchesContract` 의 실제 판정 범위보다 넓다.** *"부재가 §5.4 키 생략형이라 그 검증자는 이 자리를 물지 못한다"* 고 적었는데, 그 검증자는 optional-non-nullable 필드에 온 `null` 을 **잡는다**(`response-contract.ts` 의 `visit()`, `kind:'null'`) | 헬퍼·e2e 헤더 docstring · plan | **수정.** *"이 분기에 그 검증자를 거는 기존 호출이 0건"* 으로 좁혔다 — 무능이 아니라 **미배선**이 참인 사실 |
| 6 | side_effect W1 | **`tsconfig.build.json` exclude 가 dist 유출을 막는다는 내 단정이 틀렸다.** reviewer 가 scratch 에서 실제 `tsc --listFiles` + `dist/` 산출로 재현: `exclude` 는 **root 파일 후보만** 거르고, exclude 되지 않은 프로덕션 파일이 그 경로를 `import` 하면 프로그램에 편입돼 **emit 된다**. 게다가 `@types/jest` 가 ambient 라 **컴파일 에러도 나지 않고** 호출 시점에 `ReferenceError` 가 난다. `production-build-devdep-guard` 도 이 형태를 못 본다(`parseJsonConfigFileContent` 는 import 그래프를 안 본다) | `trigger-workflow-ref.ts` docstring · `tsconfig.build.json` · `repo-guards/__tests__/production-build-devdep-guard.ts` | **수정**(docstring 을 실측으로 좁힘: 현재 import 0건이라 안전하며 그 회귀를 감지할 가드는 **없다**) + **가드 하드닝은 트래커 등재** |
| 7 | maintainability W1 | **비밀 컬럼 목록이 3중 독립 사본**이 됐다 — 정본 `TRIGGER_RESPONSE_STRIP_COLUMNS`(비-export) + 자매 헬퍼 + 신규 헬퍼. 값·순서가 완전히 같은데 **결속 장치가 없다.** 덧붙여 내가 이 자리에 인용한 *"`User` 투영 상수 선례"* 는 reviewer 가 grep + `git log` 로 추적해 **문면 일치 커밋을 찾지 못했다** | `trigger-workflow-ref.ts` · `schedule-trigger-ref.ts` · `triggers.service.ts` | **선례 인용 철회**(소급 부여였다) + docstring 에 드리프트 위험 명시 + **repo-guard 처방을 트래커 등재**(`CREATOR_PROJECTION` 이 실제 선례) |
| 8 | security W1 | 위 7번과 **같은 자리를 보안 축에서 독립 지적** — 시크릿 컬럼 리스트가 세 곳에 하드코딩돼 정본이 늘어도 두 헬퍼가 조용히 통과한다("정의를 한 칸 좁게 잡는다" 와 같은 형태) | 동일 | 동일(트래커 등재) |
| 9 | side_effect W2 | **e2e `afterAll` 이 `secret_store` 고아 row 를 남긴다.** `chatChannel` 트리거는 `setupChatChannel` 이 외부 호출 **이전에** `secrets.rotate()` 로 row 를 쓴다 — 호출이 실패해도 남는다. 정리는 `TriggersService.remove()` 의 `deleteByPrefix` 만 하고 `secret_store` 는 FK 가 없어 raw `DELETE FROM trigger` 로는 안 지워진다. 자매 파일도 동일해 신규 회귀는 아니다 | `trigger-workflow-ref.e2e-spec.ts`(`afterAll`) · `chat-channel-trigger-create.e2e-spec.ts` | **주석으로 경계 명시**(*"'row 정리 불필요' 를 `secret_store` 까지 검증한 것으로 오인하지 말 것"*) + **관례 정비를 트래커 등재.** `--impl-prep` 의 "ephemeral schema 라 불필요" 추론이 이 테이블을 안 덮었다 |
| 10 | documentation W1 | **컨벤션이 "반드시" 요구하는 `SUMMARY.md` 가 `--impl-prep` 세션 디렉터리에 없다.** `--spec` 두 세션은 썼는데 이 하나만 빠뜨렸다 — 빈/부분 세션이 게이트를 거짓 통과시키는 형태다 | `review/consistency/2026/09/10/13_48_39/` | **수정.** 5개 리포트 원문을 파싱해 작성(Critical 3 / Warning 4 / INFO 10) |
| 11 | documentation W2 | 커밋된 `_retry_state.json` 이 **prepare 시점 스냅샷**이라 plan 의 "5/5 성공" 과 모순 | 같은 세션 | **수정.** 실제 종료 상태로 갱신 |
| 12 | documentation W3 | 트래커의 **"Warning 2" 집계가 실제 4건과 불일치** | `spec-draft-nullable-notation-followups.md` | **수정.** 4건으로 정정 + 개수를 틀린 것이 이 세션 네 번째임을 기록 |
| 13 | maintainability INFO→적용 | `it()` 라벨을 `1.`~`5.` 로 썼는데, 실측 결과 `origin/main` 의 e2e 는 **20파일 / 132개 라벨**이 전부 문자(`A.`·`B-1.`)고 숫자 라벨은 내 파일 하나(5개)뿐이었다 | `trigger-workflow-ref.e2e-spec.ts` | **수정.** `A.`~`E.` 로 통일(문서 4곳의 지칭도 함께) |
| 14 | api_contract ② | **캐너리가 고정하는 것이 계약인지 구현인지 spec 이 말하지 않는다.** *"생성 응답에만 `workflow` 가 없다"* 는 §5.4 가 요구하는 계약이 아니라 **현재 구현의 반영**이고, 생성 응답도 싣게 강화하는 것은 additive 개선인데 지금 캐너리가 그것을 RED 로 막는다. SDD 프로세스 게이트로는 바람직하나 **spec 이 계약처럼 읽히게 두면 안 된다** | `spec/2-navigation/2-trigger-list.md §3` | **planner 후속에 4번 항목으로 등재**(spec 은 developer 권한 밖) |
| 15 | requirement W3 (SPEC-DRIFT) | `2-trigger-list.md §3` 의 *"이 축에는 캐너리가 아직 없다"* 가 **이제 거짓**이다 | 같은 곳 | **planner 후속 1번**(이미 등재). 자기-반증형 소정정 조건 1 불성립 — 그 문장은 planner 가 썼다 |
| 16 | requirement W1 / security W2 | Critical 1과 같은 사안을 요구사항·보안 축에서 각각 재확인(총 3명 독립) | 위 Critical 1 | 위 Critical 1 처분에 포함 |

## 참고 (INFO)

22건. 대부분 저자 주장의 **독립 재검증**이며, 설계를 바꾼 것만 적는다.

| # | 카테고리 | 발견사항 | 처분 |
|---|----------|----------|------|
| 1 | testing | **`type: 'schedule'` 트리거의 `workflow` 양성 커버리지가 저장소 전체에 0건.** 지금은 schedule enrichment 가 **제자리 mutate** 라 동작이 webhook 과 동일함을 소스로 확인했으나, 장래 **새 plain object 를 spread** 로 만드는 리팩터가 오면 이 캐너리도 `schedule-trigger.e2e-spec.ts` 도 못 잡는다(`assertMatchesContract` 는 §5.4 키 생략형이라 부재를 위반으로 안 본다) | **트래커 등재** — 헬퍼가 있으니 비용은 두 줄 |
| 2 | api_contract ① | §5.4 판정 재검증: `TriggerDto.workflow` 는 `@ApiPropertyOptional` + `workflow?: T`(`nullable:true`·`\| null` 없음) → **키 생략형**이고 `null` 은 선언되지 않은 표현. **캐너리의 읽기가 정확하다** | 확인만 |
| 3 | requirement / api_contract ③ | `TriggerDto` shape 반환 경로가 **정확히 넷**임을 컨트롤러 9핸들러 + swagger 데코레이터로 독립 재검증. 정확 키셋 단언도 저장소의 "좁힌 참조, 갈아 끼우지 말 것" 설계와 정렬 | 확인만 |
| 4 | testing | **순서 의존성 없음 — 프롬프트 우려 반증.** D 의 rename 이 B/C 가 읽는 트리거를 건드리지만 B/C 는 `name` 을 단언하지 않는다 | 확인만 |
| 5 | scope | `git diff --stat origin/main...HEAD` · 서비스 파일 `origin/main` diff(뮤테이션 잔존 0) · backend 핀 prettier 3.9.6 `--check` 전부 통과. **루트 워크스페이스에는 prettier 가 없어** drive-by 리포맷 위험도 없음 | 확인만 |
| 6 | security | 가짜 bot token 리터럴(`'111:e2eWfRefBotToken'`)은 기존 선례와 일치 — 실제 시크릿 아님 | 확인만 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | Critical / Warning / INFO | 핵심 |
|----------|--------|---|------|
| `api_contract` | **HIGH** | 2 / 1 / 2 | **이 diff 는 LOW** 라고 명시. HIGH 는 사전 존재 프로덕션 CRITICAL 2건 때문 — bot-token single-path 우회 판정(**예**) + `ChatChannelCard` 저장 400 |
| `testing` | LOW | 0 / 3 / 2 | **주장 A·B 를 직접 뮤테이션으로 재현**하고, 그 위에서 **내 단언 하나가 vacuous** 함을 실증했다(8/8 GREEN 생존). identity·최상위 `null` 두 구멍도 이 리포트가 찾았다 |
| `side_effect` | LOW | 0 / 2 / 3 | **내 build-안전 단정을 실제 `tsc` 로 반증**. `secret_store` 고아 row |
| `maintainability` | LOW | 0 / 2 / 5 | 비밀 컬럼 3중 복사 · UUID 정규식 중복 · **내 선례 인용이 추적 불가**함을 확인 |
| `requirement` | LOW | 0 / 3 / 4 | `assertMatchesContract` 범위 과대 주장 · SPEC-DRIFT 1건이 절차대로 planner 로 이관됐음을 확인 |
| `security` | LOW | 0 / 2 / 4 | 테스트 전용이라 신규 취약점 0. bot-token 우회는 **MEDIUM 으로 별도 트래킹 필요**라 명시 |
| `documentation` | LOW | 0 / 3 / 0 | 코드·테스트 문서화는 문제 없음. 3건 전부 **동봉된 consistency 산출물**의 정합성(SUMMARY 누락 · stale retry_state · 집계 오류) |
| `scope` | **NONE** | 0 / 0 / 2 | 3파일 외 변경 0 · 뮤테이션 잔존 0 · 포맷 노이즈 0 |

## 발견 없는 에이전트

`scope` 만 Critical/Warning 0 이다(INFO 2건은 확인 기록).

## 라우터 결정

- `routing_status=done`. **실행 8명** — `security`·`requirement`·`scope`·`side_effect`·`maintainability`·`testing`·`documentation`(7명은 `agents_forced` 강제) + `api_contract`(라우터 선별: *"E2E 가 API 응답 계약을 검증"*).
- **skip 6명** — `performance`(알고리즘 관심사 없음) · `architecture`(모듈 경계 변경 없음) · `dependency`(package.json 무변경) · `database`(마이그레이션·ORM 무변경) · `concurrency`(표준 테스트 인프라 패턴) · `user_guide_sync`(테스트 파일은 doc-sync-matrix trigger 미매칭).
- 강제 화이트리스트 7명 전원 리포트가 디스크에 있다 — 커버리지 충족.

## 권장 조치사항

1. **[즉시, 별도 작업] Critical 1 — PATCH 전용 `ChatChannelConfigDto`(`botToken` 제외) 분리.**
   R-CC-10 의 의도와 정확히 일치하고 **Critical 2 도 같은 수정으로 닫힌다.** 대안(기존 plaintext 와
   비교해 차단)은 resolve 비용이 든다.
2. **[즉시, 별도 작업] Critical 2 — 착수 전 브라우저에서 재현할 것.** reviewer 와 나 둘 다
   정적 대조 + 인접 실측까지만 했다. *재현 실패는 부재의 증거가 아니지만, 재현 없이 "항상 400"
   을 확정으로 적는 것도 한 칸 넓다.*
3. **[이 턴 완료] 코드 수정 12건** — `RESOLUTION.md` 참조. 세 신규 단언은 각각 뮤턴트로 판별력을
   확인했고, 캐너리 자신의 판별 속성(E 만 RED)도 **갱신된 헬퍼로 다시 증명**했다.
4. **[등재 완료] 후속 6건 + planner 4건** — 비밀 컬럼 repo-guard · schedule 축 양성 커버리지 ·
   `production-build-devdep-guard` 도달 검사 · e2e teardown 관례 · 위 Critical 2건.
5. **[관찰] 이 세션의 반복 결함은 "내가 쓴 근거 문장"이다.** 반증된 3건이 전부 근거절이었고
   (`assertMatchesContract` 범위 · `tsconfig` exclude · `User` 선례), 그중 둘은 **단정형**이었다.
   거짓 근거는 다음 사람의 판단 기준을 바꾼다 — 단정 전에 반증 가능한 형태로 적었는지 볼 것.

**push 차단 사유**: 없음. Critical 2건은 **둘 다 이 diff 밖의 사전 존재 프로덕션 결함**이고,
이 changeset 은 프로덕션 코드를 한 줄도 바꾸지 않는다. Warning 은 코드 수정 12건 적용 + 잔여
전량 트래커/planner 이관으로 처분됐다(`RESOLUTION.md`).
