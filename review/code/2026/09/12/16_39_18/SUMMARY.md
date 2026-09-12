# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 3건(모두 코드 동작이 아닌 문서 위치/문서 정합성/테스트 가독성). forced 화이트리스트(documentation·maintainability·requirement·scope·security·side_effect·testing) 7명 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | api_contract/requirement | 신규 `chat-channel-rotate-bot-token.dto.ts` 가 `spec/conventions/swagger.md §5-1` 응답 DTO 위치 규약(`dto/responses/*-response.dto.ts`)을 위반한다. 단 이는 R-CC-22 `code:` glob(`dto/chat-channel-*.dto.ts`, `*` 가 `/` 를 안 넘음)과의 실제 충돌을 피하려는 **의도적** 선택이며 파일 헤더 주석에 근거가 명시돼 있고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속 항목으로 이미 등재됨. | `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token.dto.ts:1` vs `spec/conventions/swagger.md:387`, 선례 `dto/responses/trigger-response.dto.ts` | 코드를 되돌리지 말 것(R-CC-22 위반이 더 큼). planner 축에서 (a) `code:` glob 을 `dto/**/chat-channel-*.dto.ts` 로 넓히거나 (b) chat-channel 응답 DTO 평평한 배치를 공식 예외로 명문화 — 둘 중 하나로 `swagger.md §5-1` 갱신 |
| 2 | documentation | `plan/in-progress/chat-channel-rules-cleanup.md` 내부에서 뮤테이션 개수가 "3종"(증거·체크리스트 섹션)과 "5종"(실측 기록 표 제목+5행)으로 서로 다르게 서술됨. 체크리스트만 보고 재현하면 §설계 판단 (3)의 핵심 증거인 5번째(네거티브 컨트롤: `incoming.provider &&` 제거 시 GREEN 이 정상) 뮤턴트를 놓칠 수 있음. | `plan/in-progress/chat-channel-rules-cleanup.md` "## 증거"/"## 체크리스트"(3종) vs "## 실측 기록 — 뮤테이션 5종" | 체크리스트의 `뮤테이션 3종`을 `5종`(네거티브 컨트롤 1건 포함)으로 정정하고 "증거" 섹션도 4·5번 추가 또는 "실측 기록" 표를 가리키도록 확장 |
| 3 | testing | 신규 삽입된 2개 `it.each` 블록이 기존 JSDoc 코멘트("대칭 필드도 막는다")와 그 코멘트가 원래 설명하던 테스트 사이를 갈라놓음(orphaned comment) — 동작 영향은 없으나 다음 편집자가 바로 아래 신규 테스트를 그 코멘트의 대상으로 오인하기 쉬움. | `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts:84-98`(JSDoc) vs `:132`(원래 설명 대상이던 테스트, 44줄 밀림) | `:84-88` JSDoc 을 `:132` 테스트 바로 위로 복원하거나, 신규 `it.each` 2블록을 `:132` 테스트 **뒤**로 이동 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security/api_contract | `rotateBotToken` 의 `:id` 파라미터에 `ParseUUIDPipe`/`@ApiParam(format: 'uuid')` 부재(형제 `revokePerTriggerToken`엔 있음). 이 diff 이전부터 있던 상태이고 이번 PR 스코프 밖. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재됨. | `codebase/backend/src/modules/triggers/triggers.controller.ts:286` | 후속 PR 에서 정렬. 이번 diff 를 막을 사유 아님 |
| 2 | security/testing | (긍정적 관찰, 실측 확인됨) 신규 `null`/`''` 2세트 테스트가 이전 라운드 WARNING("두-층 등가성의 서비스측 미검증")을 실제로 닫음 — `hasField` 의 `typeof … !== 'undefined'` 를 `!!value` 로 바꾸는 뮤턴트를 독립 재현해 4건 RED 확인(원복 완료). vacuous 아님. | `chat-channel-input-rules.spec.ts:99-130`(신규 케이스), 대상 `chat-channel-input-rules.ts:70`(`hasField`) | 조치 불요 — 회귀 방지 확인됨 |
| 3 | security | provider label 스왑 방지 단언(Slack 요청에 Discord 문구 안 나가게)이 이중 판별(`toContain(ownLabel)` + `not.toContain(otherVendor)`)로 구성돼 한쪽만 있었으면 vacuous 했을 자리를 제대로 판별함 | `chat-channel-input-rules.spec.ts` `assertInboundSigningPlaintextByProvider` provider 부재 `it.each` 블록(`:238-254`), 대상 `chat-channel-input-rules.ts:262` | 조치 불요 |
| 4 | requirement/documentation | `plan/in-progress/chat-channel-rules-cleanup.md` 체크리스트가 전부 미체크(`[ ]`) 상태인데 본문(작업 1~6, 실측 기록)은 이미 완료·검증됐음을 구체적으로 기록. 현재 리뷰 라운드 진행 중이라 낮은 우선순위. | `plan/in-progress/chat-channel-rules-cleanup.md:92-100` "## 체크리스트" | 이 세션이 수렴하는 시점에 완료 항목 체크 후 `plan/complete/` 이동 |
| 5 | requirement | `chat-channel-input-rules.ts` 헤더 주석이 여전히 "입력 검증·변환 순수 함수" 로만 서술하나 실제로는 출력측 함수(`translateSetupChannelError`)도 포함 — `spec/5-system/15-chat-channel.md:544` 와 어긋남. 이번 PR 이 새로 만든 drift 아니고, 이번 턴엔 주석만 넓히고 파일 분리는 planner 축으로 명시적으로 유보. 이미 등재됨. | `spec/5-system/15-chat-channel.md:544` vs `chat-channel-input-rules.ts:34-39`, `:329` | 조치 불요(이미 planner 항목으로 등재) |
| 6 | side_effect | `rotateBotToken` 컨트롤러 반환 타입이 `Promise<Awaited<ReturnType<...>>>` 에서 구체 DTO(`Promise<ChatChannelRotateBotTokenDto>`)로 좁혀짐 — 런타임 동작 무변화, 컴파일 타임 안전망 강화일 뿐(구조적 일치는 `tsc --noEmit` 무오류로 확인) | `codebase/backend/src/modules/triggers/triggers.controller.ts` `rotateBotToken` 시그니처 | 조치 불요 |
| 7 | maintainability | `throwInvalidField(field: string, ...)` 의 `field` 가 넓은 `string` 이라, `rejectBlockedField` 를 경유하지 않는 6개 직접 호출부는 `ChatChannelBlockedField` 유니언의 오타 방지 혜택을 못 받음(런타임 테스트가 오타를 즉시 잡아 위험은 낮음). 직전 라운드에서도 지적돼 보류된 항목. | `chat-channel-input-rules.ts:56`(선언), 호출부 `:205`·`:223`·`:270`·`:284`·`:294`·`:301` | 재발/호출부 증가 시 타입을 좁히는 것 고려. 즉시 조치 불요 |
| 8 | testing (이월) | 신규 `ChatChannelRotateBotTokenDto`/`ChatChannelRotateBotIdentityDto` 에 런타임 shape 계약 테스트(`contractForDto`/`assertMatchesContract`) 미배선 — "tsc 가 잡는다" 주장은 컴파일 타임에만 유효. 라운드 1 부터 이월된 low-priority 항목. | `dto/chat-channel-rotate-bot-token.dto.ts`(신규 전체), `triggers.controller.ts:281-293` | 다음 `response-contract` 확장 턴에서 다른 미배선 엔드포인트와 함께 처리 |
| 9 | testing (이월) | `assertChatChannelAlreadySetUp` 의 `incoming.provider &&` falsy-guard 가 이 파일(`chat-channel-input-rules.spec.ts`) 자체 테스트만으로는 미검증 — "도달 불가" 주장의 절반은 `trigger-dto-validation.spec.ts` 가 별도로 고정(설계상 의도적 defer). | `chat-channel-input-rules.ts:222` vs `chat-channel-input-rules.spec.ts:277-304` | 급하지 않음. 재발 방지 차원에서 단일 호출 케이스 추가 고려 |
| 10 | api_contract | POST 바디가 DTO 클래스가 아닌 인라인 타입(`{ newBotToken?: string }`)이라 swagger request body 스키마 미문서화(`@ApiBody()` 부재). 이번 PR 스코프 밖(응답 문서화만 대상), 기존 코드 그대로. | `triggers.controller.ts` `rotateBotToken` 시그니처 | 조치 불요. 필요 시 별도 후속 항목 등재 |

## 관측된 이상 상태 (결함 아님 — 기록용)

documentation·api_contract 두 reviewer 가 독립적으로, 리뷰 도중 `chat-channel-input-rules.ts` 의 `hasField` 가 `typeof … !== 'undefined'` → `!!value` 로 미커밋 변경된 상태를 관측했다고 보고함. 이는 `RESOLUTION.md`/`testing.md` 가 서술하는 W3 뮤테이션 검증 실험과 정확히 일치하는 형태로, **동시 실행 중인 다른 reviewer/검증 세션이 공유 워크트리에 남긴 일시적 산물**로 보인다. 두 reviewer 모두 `git checkout`/`restore` 를 실행하지 않고 committed 상태 기준으로 분석했다고 명시함 — 이 잔여물을 실결함으로 오인하지 말 것. `testing.md` 는 자체적으로 동일 뮤테이션을 스크립트로 재현·원복까지 마쳤음을 별도로 기록(정상 종료 확인).

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 5개 차단 필드 가드·에러 봉투 리팩터 전후 1:1 보존 확인. CRITICAL(클래스명 충돌) 해소 재확인. INFO 3건만 |
| requirement | LOW | 라운드1 CRITICAL 1·WARNING 3 전부 해소 확인(jest 110/tsc 무오류 실측). WARNING 1건 신규(DTO 파일 위치 규약 충돌, 이미 등재) |
| scope | NONE | 31개 변경 파일 전부 plan 작업 6건 + 라운드1 지적 4건에 1:1 대응, 스코프 이탈 없음 |
| side_effect | NONE | 전역상태/네트워크/파일 I/O 변경 없음. 컨트롤러 반환 타입 좁힘은 안전(INFO) |
| maintainability | NONE | 헬퍼 추출로 중복 제거·JSDoc 근거 양호. INFO 1건(타입 넓음, 트레이드오프 인지됨) |
| testing | LOW | 라운드1 WARNING 뮤테이션으로 실제 해소 검증(RED 4건 재현). WARNING 1건 신규(orphaned JSDoc), 이월 INFO 2건 |
| documentation | LOW | 라운드1 C1+W1~W3 전부 파일 전체 열람으로 해소 재확인. WARNING 1건 신규(plan 문서 내부 수치 불일치) |
| api_contract | LOW | 라운드1 CRITICAL+WARNING 해소를 256개 DTO 클래스 전수 grep 으로 재확인. INFO 3건(전부 스코프 밖 이월) |

## 발견 없는 에이전트

없음 (전원 최소 INFO 이상 보고, security/scope/side_effect/maintainability 는 Critical/Warning 없이 NONE 판정).

## 권장 조치사항

1. `plan/in-progress/chat-channel-rules-cleanup.md` 의 뮤테이션 개수 서술("3종"/"5종")을 "5종"으로 통일하고 4·5번째 뮤턴트를 "증거" 섹션에도 반영한다 (WARNING #2).
2. `chat-channel-input-rules.spec.ts` 의 orphaned JSDoc(:84-98)을 원래 대상 테스트(:132) 옆으로 재배치하거나 신규 `it.each` 를 그 뒤로 옮긴다 (WARNING #3).
3. `chat-channel-rotate-bot-token.dto.ts` 파일 위치 vs `swagger.md §5-1` 충돌은 코드를 되돌리지 말고, 이미 planner 트래커에 등재된 항목을 통해 spec 규약(R-CC-22 glob 또는 §5-1 예외 명문화) 정정으로 해소한다 (WARNING #1).
4. 이번 라운드가 수렴하면 `plan/in-progress/chat-channel-rules-cleanup.md` 체크리스트를 실제 완료 상태로 갱신하고 `plan/complete/` 로 이동한다 (INFO #4).
5. 나머지 이월 INFO(런타임 DTO 계약 테스트 미배선, ParseUUIDPipe 부재, falsy-guard 단일파일 미검증, POST body 미문서화)는 이번 PR 스코프 밖으로 확인됐으므로 별도 후속 티켓에서 처리한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (8명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 7명 전원 결과 확보됨 — 누락 없음)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(순수 리팩터+DTO 추가)에 성능 영향 없음 |
  | architecture | router 판단상 아키텍처 레벨 변경 없음(파일 내부 헬퍼 추출 수준) |
  | dependency | router 판단상 의존성 변경 없음 |
  | database | router 판단상 DB 스키마/쿼리 변경 없음 |
  | concurrency | router 판단상 동시성 관련 변경 없음 |
  | user_guide_sync | router 판단상 사용자 가이드 문서 영향 없음 |