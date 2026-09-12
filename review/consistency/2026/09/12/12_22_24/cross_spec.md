# Cross-Spec 일관성 검토 — setupChannel 실패 분류 draft

> 검토 방법 비고: 조립된 `_prompts/cross_spec.md` 번들은 `spec_impact` 에 열거된 대상 파일 전부
> (`15-chat-channel.md`·`2-api-convention.md`·`2-trigger-list.md`·`data-flow/14-chat-channel.md`·
> `providers/{discord,slack}.md`) 가 "본문 생략됨 — 컨텍스트 예산 초과" 로 절단돼 있었고,
> `conventions/chat-channel-adapter.md`·`conventions/swagger.md` 는 번들에 아예 포함되지 않았다
> (기존 교훈 `feedback_consistency_spec_mode_budget` 재현). 번들 대신 **worktree 의 실제 파일**을
> 직접 읽어 대조했다 — 아래 발견사항은 draft 의 인용문이 아니라 저장소 현재 상태 실측 기준.

## 발견사항

- **[WARNING]** `4-execution-engine.md` 의 기존 502-거부 문장이 범위 한정 없이 절대적으로 읽힌다
  - target 위치: 결정 (4) — `2-api-convention.md §6` 502 행 신설, "기존 축과 충돌하지 않는다" 단락
  - 충돌 대상: `spec/5-system/4-execution-engine.md` C-1 (§7.4 근방) — *"HTTP 코드는 **503** 으로
    정한다 — Redis 의존성 장애 = upstream 불가용이므로 **502(잘못된 게이트웨이 응답)가 아니라**
    503(일시 불가·재시도)이 맞고, 이미 `SERVER_SHUTTING_DOWN`(SIGTERM 후 새 실행 거부)이 같은 503
    선례를 확립했다"*
  - 상세: target 은 이 문장의 판정 대상이 "우리 인프라(Redis)" 한정이고 새 결정은 "외부 제3자
    provider" 축이라 직교한다고 논증했으며, 그 논증 자체는 사용처 3곳(`SERVER_SHUTTING_DOWN`·
    `WEBAUTHN_DISABLED`·`EXECUTION_ENQUEUE_FAILED` — 전부 "우리 쪽" 주어)을 실측으로 확인해 근거가
    맞다. 문제는 **인용된 원문 자체가 그 스코프를 명시하지 않는다**는 것 — "502(잘못된 게이트웨이
    응답)가 아니라 503" 이라는 문장만 놓고 보면 *"이 저장소는 502 를 쓰지 않는다"* 는 저장소 전역
    규칙으로 읽힌다. target 의 인용 방향은 **새 결정 → execution-engine.md** 단방향
    (`R-CC-23 에 그 정합을 명시 인용한다`) 뿐이고, execution-engine.md C-1 자신에게는 *"이 502 배제는
    우리-인프라 한정이고 외부 provider 실패의 502 사용은 R-CC-23 참조"* 같은 역방향 각주가 없다.
    다음에 execution-engine.md 만 보고 "502 는 이 시스템에서 안 쓴다" 로 오판할 위험이 남는다
    (`grep 502 spec/` 로 두 결정을 한 화면에서 못 보면 특히 그렇다).
  - 제안: `4-execution-engine.md` C-1 문단 끝(또는 각주)에 *"이 축(우리 인프라 vs 외부 provider)의
    반대편 — 외부 provider 호출 실패의 502 사용 — 은 [15-chat-channel.md R-CC-23] 참조"* 한 줄을
    함께 추가. target 의 `spec_impact` 리스트에 `4-execution-engine.md` 를 추가하거나, 최소한
    체크리스트에 이 역방향 각주 항목을 넣을 것.

- **[INFO]** `swagger.md §2-4` 의 기존 표는 상태 코드별 1행 1데코레이터 패턴인데 신규 행은 "5xx" 로 뭉뚱그려졌다
  - target 위치: 체크리스트 `(4-b) conventions/swagger.md §2-4 에 5xx 행 신설`
  - 충돌 대상: `spec/conventions/swagger.md §2-4` 기존 표 (`200`·`201`·`204`·`400`·`401`·`403`·`404`·`409` — 전부 구체 상태 코드 1행 1코드)
  - 상세: 기존 표 문법은 상태 코드 하나당 데코레이터 하나(`@ApiBadRequestResponse` 등)를 매핑하는
    구체적 1:1 행이다. 반면 draft 결정 (4) 본문이 `2-api-convention.md §6` 에 추가하는 행은 `502` 
    단독(구체적)인데, swagger.md 체크리스트 항목만 "5xx 행" 이라는 포괄 표현을 쓴다. 실측하면
    `@ApiServiceUnavailableResponse`(503) 는 이미 `health.controller.ts` 에서 쓰이고 있는데도
    swagger.md 표에는 503 행조차 없다 — 즉 502 만의 문제가 아니라 기존 503 갭까지 걸려 있다.
    "5xx 행" 하나로 502·503 을 함께 문서화할지, 기존 패턴대로 `502`·`503` 을 각각 구체 행으로
    추가할지가 draft 문면에서 결정돼 있지 않다.
  - 제안: swagger.md 편집 시 기존 표 문법(구체 코드별 1행)을 따를지 명시. 따른다면 `502 서버
    게이트웨이 실패 | @ApiBadGatewayResponse` 와 `503 일시 불가 | @ApiServiceUnavailableResponse`
    두 행으로 분리(후자는 이번 draft 범위 밖이라도 최소한 존재를 인지해 별도 트래커에 남길 것).

- **[INFO]** `15-chat-channel.md` §7 디렉터리 트리 주석이 `translateSetupChannelError` 의 실제 책임과 어긋난다 (draft 가 이미 인지·유예)
  - target 위치: "안 하는 것" — *"`translateSetupChannelError` 의 파일 위치"*
  - 충돌 대상: `spec/5-system/15-chat-channel.md` §7 구현 파일 트리 — `chat-channel-input-rules.ts` 를
    *"입력 검증·변환 순수 함수 (R-CC-21 정본)"* 로 서술
  - 상세: 실측(`codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:310`)하면 이
    파일이 담고 있는 `translateSetupChannelError` 는 **출력측**(에러 응답 변환) 함수라 "입력
    검증·변환" 설명과 결이 다르다. 이는 target 이 스스로 "안 하는 것" 에 이미 적어 이번 턴 범위
    밖으로 명시 유예했으므로 CRITICAL/WARNING 은 아니다 — 다만 이 turn 이 `§1.1.2`/`§5.4`/adapter
    3종을 편집하면서 정작 이 계층-책임 서술 불일치는 그대로 남는다는 점을 재확인 차 기록한다.
  - 제안: 없음(이미 별 트래커 항목으로 유예된 것을 확인). 후속 세션에서 파일 위치 이슈를 처리할
    때 §7 트리 주석도 함께 갱신.

## 정합성이 확인된 주요 항목 (근거: 실제 파일 실측)

- `R-CC-` 최대 `22`, `R-CCA-` 최대 `8` — draft 가 예고한 `R-CC-23`/`R-CCA-9` 번호 충돌 없음.
- "401/403 에서 드러난다" 복제는 정확히 draft 가 지목한 3곳(`15-chat-channel.md:203`·
  `2-navigation/2-trigger-list.md:120`·`data-flow/14-chat-channel.md:161`) 뿐 — repo 전체
  `401/403` grep 결과 나머지는 전부 무관 도메인(Integration OAuth·AI Agent LLM·MCP·embedding
  pipeline·error-handling 인증 코드). 누락된 4번째 복제처는 없다.
- `2-api-convention.md §6` 에 `502` 행 없음(`429`→`500`→`503` 바로 이어짐), `swagger.md §2-4` 에
  5xx 행 없음, 코드에 `BadGatewayException`/`HttpStatus.BAD_GATEWAY`/`ApiBadGatewayResponse`
  사용 **0건** — draft 의 "저장소 최초 502" 주장과 정합.
- `providers/discord.md` §3.1(L56·L76)은 이미 `BOT_TOKEN_INVALID` 만 서술하고 401/403 을 주장하지
  않음 — draft 의 "편집 불요" 판단과 일치.
- `providers/slack.md` §3.1 은 성공 응답만 서술 — draft 의 "실패 형태 spec 부재" 판단과 일치.
- `chat-channel-adapter.md §1.1.2` 슬롯은 비어 있음(§1.1.1 다음이 §1.2) — 앵커 충돌 없음.
- `chat-channel-adapter.md §3.1`(`event.error.code`)과 신설 `§1.1.2`(`code: 'BOT_TOKEN_INVALID'`)는
  실제로 같은 파일 안의 별개 "code" 네임스페이스 — draft 의 명시적 구분 필요성 주장이 근거 있음.
  또한 `R-CCA-5`(Execution Failed 분류 helper)와 draft 가 인용한 문맥은 *같은 SoT 를 재정의*하는
  것이 아니라 *"원문 미노출"* 근거를 유비로 차용하는 것으로 읽혀 실제 충돌은 아니다.
- `error-handling.md §1` / `conventions/error-codes.md` 중앙 카탈로그에 `BOT_TOKEN_INVALID`·
  `CHAT_CHANNEL_SETUP_FAILED` 미등재 확인 — draft 가 "기존 갭, 이 턴 동기 아님" 으로 유예한 판단과
  일치(INFO 1, 별도 트래커).
- `4-integration.md`·`3-error-handling.md` 의 기존 "502" 등장 2곳은 전부 **HTTP Request 노드가
  관측한 제3자 응답의 `statusCode`**(워크플로우 노드 출력)이지 우리 API 의 응답 상태가 아님 —
  draft 의 "노드 출력 statusCode 와 무관하다" 각주가 실제로 필요하고 정확함을 뒷받침.
- `plan-in-progress-items-b0c80b` worktree 는 `git worktree list` 기준 실측상 부재 — draft 의
  "대신 처리" 판단과 일치. `spec-draft-nullable-notation-followups.md` 의 정정 대상 텍스트("(b) 가
  근본이다" 등)도 실제로 존재.

## 요약

Cross-spec 번들 자체가 대상 파일 전부를 절단했지만, 실제 저장소 파일을 직접 대조한 결과 draft 가
`--spec` 1·2회차에서 다룬 CRITICAL/WARNING 은 모두 실측 근거가 맞고 3회차 신규 대상
(`providers/slack.md`·`conventions/swagger.md`)에서도 새로운 CRITICAL 급 모순은 발견되지 않았다.
유일한 실질 리스크는 `4-execution-engine.md` 의 기존 "502 아니라 503" 문구가 스코프 한정 없이
쓰여 있어, 이번 draft 가 그 문장을 (정확하게) 우리-인프라 전용으로 재해석하고도 원문 쪽에는
역참조를 남기지 않는다는 점 — 편도 인용이라 향후 독자가 `4-execution-engine.md` 만 읽고 "502 금지"
로 오독할 여지가 남는다(WARNING). 나머지는 표 문법 세부(swagger.md 5xx 행 granularity)와 이미
스스로 유예를 선언한 계층-책임 서술 불일치(INFO) 뿐이다.

## 위험도

LOW
