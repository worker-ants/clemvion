# Cross-Spec 일관성 검토 — setupChannel 실패 분류 draft

대상: `plan/in-progress/spec-draft-setup-error-classification.md`
검토 모드: `--spec` (spec draft)

`_prompts/cross_spec.md` 번들에서 이 draft가 실제로 개정하는 6개 핵심 파일
(`15-chat-channel.md`·`chat-channel-adapter.md`·`2-api-convention.md`·`3-error-handling.md`·
`4-execution-engine.md`·`2-trigger-list.md`·`data-flow/14-chat-channel.md`)이 컨텍스트 예산
초과로 전부 생략되어 있었다. 판정에 필수적이라 `Read`/`grep`으로 실제 저장소 파일을 직접 열어
대조했다 (아래 발견사항은 전부 실물 대조 기반).

## 발견사항

- **[WARNING]** 502 ↔ 503 판별 축이 두 문서에서 서로 다른 근거로 정의된다 — 상호 참조 없음
  - target 위치: 결정 (4) — `2-api-convention.md §6`에 502 행 신설. 근거 문구: *"502 는
    외부 제3자, 503 은 우리 인프라다"*
  - 충돌 대상: `spec/5-system/4-execution-engine.md` Rationale
    "continuation publish 실패 동기 surface 통일 (C-1·M-7)" — 원문: *"HTTP 코드는 **503**
    으로 정한다 — Redis 의존성 장애 = upstream 불가용이므로 **502(잘못된 게이트웨이 응답)**
    가 아니라 **503(일시 불가·재시도)**이 맞고, 이미 `SERVER_SHUTTING_DOWN`이 같은 503
    선례를 확립했다."*
  - 상세: 두 문서가 502/503을 가르는 **축 자체**가 다르다. execution-engine.md는 "응답의
    유효성"(잘못된 응답을 받았는가 vs 일시적으로 이용 불가한가) 축을 쓰고, draft가 신설하는
    `2-api-convention.md §6` 행은 "호출 대상의 소유"(외부 provider vs 우리 인프라) 축을
    쓴다. 지금까지의 사례(Redis=내부=503, provider API 호출 실패=외부=502)에서는 두 축이
    같은 결론에 도달하지만, 이는 두 축이 논리적으로 같기 때문이 아니라 우연이다 —
    예컨대 "외부 provider가 완전히 응답 없이 연결이 끊긴 경우"(`ECONNRESET`, draft 표 1행)
    처럼 "응답의 유효성" 축에서는 "잘못된 응답을 받은 것"이 아니라 "응답 자체가 없는 것"에
    가까운 사례가, "소유" 축에서는 명확히 외부이므로 502로 떨어진다. 두 문서가 서로를
    인용하지 않으므로, 한쪽 axis가 나중에 개정되면(예: execution-engine의 axis를 §6에 일반
    원칙으로 승격) 조용히 어긋날 수 있다.
  - 제안: 신설되는 502 행 또는 그 결정의 Rationale(`R-CC-23`)에 execution-engine.md
    의 C-1 rationale을 상호 링크하고, "현재 사례들에서는 두 축이 일치하는 결론을 낸다"는
    점을 한 줄 명시. 또는 두 문서가 공유할 단일 문장(예: "502=우리가 프록시하는 외부
    게이트웨이의 실패, 503=우리 자신의 인프라 의존성의 일시 불가")을 하나 정해 양쪽에서
    인용하는 형태로 정리.

- **[WARNING]** 이 결정의 "실질 동기"(Slack `invalid_auth`)가 provider-level spec 어디에도
  문서화돼 있지 않다
  - target 위치: 결함① 표 (Slack 행), "구현 위임" 항목 6
  - 충돌 대상: `spec/4-nodes/7-trigger/providers/slack.md §3.1` — `auth.test` 호출의
    **성공** 응답 shape만 문서화(`{ ok: true, team_id, ... }`), 실패 시 `{ok:false,
    error:'invalid_auth'}` (HTTP 200) 케이스는 한 줄도 없음. `discord.md §3.1`도
    verify_key **cross-check 성공 후 불일치 시 throw**만 서술하고 `telegram.md`는
    실패 형태 자체가 없음.
  - 상세: draft는 스스로 "discord 한 건보다 크다 — Slack이 실질 동기"라고 명시하는데, 정작
    그 근거(Slack의 200+`{ok:false}` 스타일)의 SoT여야 할 provider spec(`slack.md §3.1`)에는
    그 사실이 없다. 이 draft(`plan/in-progress/*.md`)는 완료 후 `plan/complete/`로 이동하므로,
    이 사건의 provider-level 근거는 결국 코드 주석(`slack-client.ts`)에만 남고 spec
    트리에는 남지 않는다. "구현 위임 6"이 이 문서화를 "§5.4가 '무엇으로 알리든'이라 적으므로
    필수는 아니다"로 미뤘지만, 그 결과 이번 재설계의 핵심 실측 사실이 provider spec에서
    검증 불가능해진다.
  - 제안: 최소한 `slack.md §3.1`에 실패 응답 형태(`{ok:false, error}` + HTTP 200) 한 줄과
    "자격 증명 거부 신호"라는 라벨을 `chat-channel-adapter.md §1.1.2`로 링크. "필수 아님"
    판단을 유지한다면 트래커에 "provider spec 실패-형태 문서화 갭"으로 명시 등재해 판단
    근거를 남길 것.

- **[INFO]** `spec_impact`에 `providers/discord.md`가 빠져 있다 — 같은 메커니즘을 서술하는
  4번째 파일
  - target 위치: frontmatter `spec_impact`, 결함③ "복제 3곳" 목록
  - 충돌 대상: `spec/4-nodes/7-trigger/providers/discord.md:56,76` — *"응답 `verify_key`
    와 사용자 입력 public key(`inboundSigningRef`) cross-verify, 불일치 시
    `BOT_TOKEN_INVALID`"*
  - 상세: 이 파일은 "401/403" 문구를 쓰지 않아 결함③의 정규식(복제 3곳 탐지)에는 걸리지
    않지만, 정확히 이번 턴이 재설계하는 그 메커니즘(discord verify_key mismatch →
    `BOT_TOKEN_INVALID`)을 서술하는 유일한 provider-level 문서다. 현재 문구는 이미
    "throw `BOT_TOKEN_INVALID`" 식으로 읽혀 이번 typed-code 결정과 축자로 어긋나지는
    않으므로 편집이 필요하지는 않아 보이지만, `spec_impact` 미등재로 검토 매트릭스에서
    완전히 누락돼 있었다.
  - 제안: `spec_impact`에 추가하거나(변경이 없다면), draft에 "확인함 — 편집 불요"
    한 줄을 남겨 다음 사람이 같은 grep을 반복하지 않게 할 것.

- **[INFO]** 신설 `code` 프로퍼티(§1.1.2)와 기존 `event.error.code`(§3.1)가 같은 파일 안에서
  이름이 같은 별개 네임스페이스를 이룬다
  - target 위치: 결정 (2), `chat-channel-adapter.md` 신규 §1.1.2
  - 충돌 대상: `spec/conventions/chat-channel-adapter.md §3.1` `ExecutionFailureClass` —
    `event.error.code` (`HTTP_4XX`/`HTTP_5XX`/`LLM_RATE_LIMIT`/... enum, EIA
    `execution.failed` 페이로드 소속)
    실측: 값 충돌은 없다 — `BOT_TOKEN_INVALID`는 §3.1의 카테고리 매핑 표에 없다.
  - 상세: 같은 convention 파일 안에 "`code`로 판별한다"는 동일 패턴이 서로 다른 두 파이프라인
    (EIA 실행-실패 알림 분류 vs `setupChannel` 자격증명-거부 분류)에 적용된다. 값은 겹치지
    않지만, 두 `code`는 서로 다른 객체(`EiaEvent.error.code` vs adapter가 throw하는
    `Error.code`)에 속한 완전히 별개의 네임스페이스다. §3.1의 화이트리스트 철학
    ("`error.message` 원문은 배제")을 인용하는 §1.1.2 옆에 나란히 있으면, 향후 §3.1 표를
    확장하는 사람이 실수로 `BOT_TOKEN_INVALID`를 그 표에 넣거나, 반대로 §1.1.2가 §3.1의
    화이트리스트를 절대 규칙(모든 chat-channel 에러 분류가 `error.code`+`details.statusCode`
    2필드만 써야 한다)으로 오인할 위험이 있다.
  - 제안: §1.1.2 서두에 "이 `code`는 §3.1의 `event.error.code`와 무관한 별개 네임스페이스
    (다른 함수의 다른 객체에 속한 프로퍼티)"라는 한 줄 명시.

- **[INFO]** fallback으로 남기는 메시지 401/403 정규식이, 인용한 R-CCA-5의 원칙과 정신적으로
  긴장한다
  - target 위치: 결정 (2) "fallback은 남긴다" 문단
  - 충돌 대상: `chat-channel-adapter.md` R-CCA-5 — *"`error.message`를 그대로 redact 해
    전달하지 않는 이유는 노드 핸들러가 `error.message`에 URL·query·DB 컬럼명·stack·API key
    일부를 흘릴 가능성 때문"*, CCH-ERR-02 — *"분류 입력 화이트리스트... `error.message`
    원문... 은 분류 입력으로 사용 금지"*
  - 상세: R-CCA-5/CCH-ERR-02는 문자 그대로 `setupChannel` 에러를 규율하지 않으므로 규칙
    위반은 아니다. 다만 draft 자신이 이 두 항목을 "이미 두 번 반대 방향으로 결정해 뒀다"고
    인용해 typed `code`를 정당화한 바로 그 문단에서, 정확히 그 반대(메시지 파싱)를
    fallback으로 유지하기로 한 것은 향후 R-CCA-5/CCH-ERR-02 준수 여부를 감사하는 사람이
    `translateSetupChannelError`의 fallback을 오탐(위반)으로 플래그할 가능성을 남긴다.
    draft는 이를 "transitional fail-safe"로 명시했지만 그 caveat이 §1.1.2 신설 문구 자체에는
    아직 없다(체크리스트 항목일 뿐).
  - 제안: §1.1.2에 "이 fallback은 R-CCA-5/CCH-ERR-02의 화이트리스트 원칙에 대한 의도적·
    한시적 예외(3개 adapter 모두 `code`를 달면 제거)"라는 문구를 명시적으로 포함.

## 요약

target draft가 실제로 개정하는 6개 핵심 spec 파일은 컨텍스트 예산 초과로 번들에서
전부 생략돼 있어 원본을 직접 열어 대조했다. 대조 결과 draft가 인용하는 verbatim 발췌
(§5.4 에러 표 두 행·§4.1 중복 3곳·§6 상태 코드 카탈로그·`chat-channel-adapter.md §1.1`
표·R-CC/R-CCA rationale ID 최대값)는 전부 실물과 정확히 일치했고, 요구사항 ID(R-CC-23·
R-CCA-9)·RBAC·데이터 모델·상태 전이 축에서 직접적인 CRITICAL 충돌은 발견되지 않았다.
다만 (1) 신설되는 502/503 판별 기준이 `execution-engine.md`의 기존 502/503 판별
rationale과 서로 다른 축으로 설명되어 있어 상호 참조가 필요하고, (2) 이 변경의 핵심 실측
근거(Slack `invalid_auth`)가 provider-level spec(`slack.md`)에는 문서화되지 않아 draft가
`plan/complete/`로 이동한 뒤 근거가 spec 트리에서 사라지는 위험이 있으며, (3) `spec_impact`
목록이 관련 메커니즘을 서술하는 `providers/discord.md`를 누락했다. 이 셋은 채택을 막을
정도는 아니지만 반영 전 정리를 권한다.

## 위험도
MEDIUM
