# 신규 식별자 충돌 검토 — spec-draft-setup-error-classification

## 발견사항

- **[INFO]** Rationale ID `R-CC-23` / `R-CCA-9` — 충돌 없음, 실측으로 확인
  - target 신규 식별자: `R-CC-23` (`15-chat-channel.md`), `R-CCA-9` (`chat-channel-adapter.md`)
  - 기존 사용처: `spec/5-system/15-chat-channel.md` 의 `### R-CC-*` 헤딩 전수 grep 결과 최대값은
    `R-CC-22`(`# spec/5-system/15-chat-channel.md:858`)이고 `R-CC-14` 는 결번(재사용 안 됨,
    draft 본문이 이미 명시). `spec/conventions/chat-channel-adapter.md` 의 `### R-CCA-*` 최대값은
    `R-CCA-8`(`:613`). 두 값 다음 번호(`R-CC-23`/`R-CCA-9`)를 가리키는 기존 cross-file 인용도
    grep 0건 — 앞서 예약된 dangling 참조가 없다.
  - 상세: draft 의 Rationale 절 실측 서술("`R-CC-` 최대 22 · `R-CCA-` 최대 8")이 저장소 실측과
    정확히 일치한다. 충돌 없음.
  - 제안: 없음 (검증 완료).

- **[INFO]** `chat-channel-adapter.md` 신규 `§1.1.2` — 충돌 없음
  - target 신규 식별자: `#### 1.1.2 (타이틀 미정 — "판별을 typed code 로")`
  - 기존 사용처: 현재 파일은 `§1.1` 표 → `#### 1.1.1 setupChannel 멱등의 뜻 …`(`:138`) →
    바로 `### 1.2 EiaEvent 입력`(`:153`)로 이어진다. `§1.1.2` 슬롯은 비어 있고, 저장소 전체에
    `chat-channel-adapter.md#112-...` 형태의 기존 anchor 참조도 없다(grep 0건).
  - 상세: `§1.1.1`(멱등의 "등록 vs 시크릿 값" 구분)과 신설 예정 `§1.1.2`(에러 판별을 `code` 로)는
    같은 함수(`setupChannel`)를 다루지만 **다른 축**(멱등성 대 실패 분류)이라 제목 중복 위험도
    낮다. 다만 실제 삽입 시 `§1.1` 표의 `setupChannel` 행이 `§1.1.1`(멱등)과 `§1.1.2`(에러 판별)
    **두 각주 링크**를 모두 갖게 되므로, 두 앵커 텍스트가 헤딩만 보고 구분되도록 제목에
    "멱등" 대 "에러 분류" 같은 명확한 대조어를 넣을 것을 권한다(경미).
  - 제안: `§1.1.2` 헤딩 제목에 "실패 판별"류 표현을 넣어 `§1.1.1`(멱등)과 시각적으로 갈리게
    할 것 — CRITICAL 아님, 표기 명확화 수준.

- **[INFO]** `502` 상태 코드 신설 (`2-api-convention.md §6`) — 카탈로그 내 충돌 없음, 인접
  문서의 예시값과는 계층이 달라 충돌 아님
  - target 신규 식별자: `2-api-convention.md §6` 상태 코드 표의 `502` 행
  - 기존 사용처 (1): `spec/5-system/2-api-convention.md §6` 자체에는 `429/500/503`만 있고
    `502` 행이 없음(실측 확인 — draft 서술과 일치).
  - 기존 사용처 (2, 다른 계층): `spec/5-system/3-error-handling.md:374-378` (`§3.2 Route to
    Error Port` 의 예시 JSON)과 `spec/2-navigation/4-integration.md:364` 가 이미 `502`/`HTTP 502
    Bad Gateway` 를 **예시값**으로 쓰고 있다. 그러나 이것은 **노드 핸들러 출력**의
    `output.error.details.statusCode` / `meta.statusCode` — HTTP Request 노드가 **임의의
    외부 URL**에서 관측한 상태 코드를 담는 필드이며, `2-api-convention.md §6` 이 정의하는
    **우리 백엔드 자신의 REST 응답 상태 코드 카탈로그**와는 다른 네임스페이스다. 값(502)은
    같지만 대상 계층(노드 output 필드 vs 우리 API 자체 응답 status)이 달라 진짜 충돌은 아니다.
  - 기존 사용처 (3, 정합 확인): `spec/5-system/4-execution-engine.md:1410` 의 Rationale 이 이미
    *"Redis 의존성 장애는 502(잘못된 게이트웨이 응답)가 아니라 503(일시 불가·재시도)이 맞다"*
    라고 502/503 의 의미를 **"외부 제3자 vs 우리 인프라"** 축으로 구분해 두었다 — target 의
    결정 (4) 가 세우는 `502=외부 provider / 503=우리 인프라` 구분과 **정확히 같은 축**이다.
    새 카탈로그 행은 기존 선례를 재확인하는 것이지 반대 방향으로 튀지 않는다.
  - 상세: 값 재사용 자체는 위험하지 않으나(HTTP status 는 여러 도메인에서 자연히 재사용됨),
    `502` 을 spec 안에서 grep 하면 서로 다른 세 문서가 걸리므로 신규 §6 행 서술에 "본 502 는
    우리 API 자신의 응답 status 이며, 노드 output 의 `details.statusCode`(임의 외부 URL 관측값,
    §3.2 예시)와는 별개"라는 한 줄을 넣으면 향후 독자의 혼동을 예방할 수 있다.
  - 제안: 신설하는 `502` 행에 "노드 output 의 `HTTP_5XX`/`statusCode` 예시와는 다른 계층"
    이라는 각주 1줄 권장 — WARNING 아님, 예방적 INFO.

- **[INFO]** `BOT_TOKEN_INVALID` / `CHAT_CHANNEL_SETUP_FAILED` — 신규 식별자 아님, 재사용
  확인
  - target 신규 식별자: 없음 (기존 `error.code` 값의 HTTP status/판별 로직만 정정)
  - 기존 사용처: `spec/5-system/15-chat-channel.md:365-366`(현재도 같은 이름), `spec/4-nodes/
    7-trigger/providers/discord.md:56,76`(`verify_key` 불일치 시 이미 `BOT_TOKEN_INVALID` 로
    문서화됨 — target 의 discord 서술과 정합), `codebase/backend/.../chat-channel-input-
    rules.ts:296-320`(구현 정본). `spec/5-system/3-error-handling.md §1.11` 이 별도로 갖는
    `AUTH_CONFIG_NOT_FOUND` 는 **다른 코드**이며 `2-trigger-list.md:120` 의 "§1.11 은 별
    코드다 — 혼동 말 것" 각주가 이미 그 구분을 명시하고 있어 `BOT_TOKEN_INVALID` 와 이름
    충돌은 없다(사전 경고 문구 자체가 기존 문서에 있음, target 도입분 아님).
  - 상세: 이름 재사용이 아니라 **같은 이름의 의미 정정**(HTTP status 400 vs 기존 오기 502,
    판별 술어를 message-regex → typed `code`)이므로 "신규 식별자 충돌" 범주에 해당하지 않는다.
  - 제안: 없음.

- **[INFO]** 파일 경로 — `plan/in-progress/spec-draft-setup-error-classification.md` 및
  `spec_impact` 5개 파일 모두 기존 경로 재사용(신규 파일 생성 없음), `plan/in-progress` 안의
  다른 `spec-draft-*` 3개(`eia-62-waiting-payload` / `eia-notification-payload-contract` /
  `nullable-notation-followups`)와 이름이 겹치지 않는다. 명명 컨벤션(`spec-draft-<주제>.md`)도
  일관되게 따른다.

## 요약

target 문서가 새로 도입하는 식별자(`R-CC-23`, `R-CCA-9`, `chat-channel-adapter.md §1.1.2`,
`2-api-convention.md §6` 의 `502` 행)를 저장소 실측과 대조한 결과 **CRITICAL/WARNING 급 충돌은
발견되지 않았다**. Rationale 번호는 draft 자신이 적은 실측("R-CC- 최대 22 · R-CCA- 최대 8")이
grep 으로 정확히 확인됐고, `§1.1.2` 슬롯은 비어 있으며 dangling 참조도 없다. `502` 상태 코드는
`2-api-convention.md §6` 카탈로그에는 없던 값이라 신설에 문제가 없고, 다른 두 문서(`3-error-
handling.md` §3.2 예시, `4-integration.md` 다이어그램)의 `502` 언급은 노드 output 필드라는
다른 네임스페이스라 실질 충돌이 아니다. 오히려 `4-execution-engine.md:1410` 의 기존 Rationale
이 "502=외부 제3자 / 503=우리 인프라" 축을 이미 세워 뒀고 target 의 결정 (4) 는 그 축을
그대로 따르므로 설계 일관성 관점에서도 긍정적이다. `BOT_TOKEN_INVALID`/
`CHAT_CHANNEL_SETUP_FAILED` 는 신규 식별자가 아니라 기존 이름의 의미(HTTP status·판별
로직) 정정이며, 이름 충돌 위험이 있던 인접 코드(`AUTH_CONFIG_NOT_FOUND`, §1.11)는 이미 기존
문서가 사전 경고 각주로 구분해 두었다. 유일하게 남는 것은 실행 편의 수준의 표기 명확화
제안(§1.1.2 제목에 "실패 판별" 류 대조어 포함, 신설 502 행에 노드-output 계층과의 구분 각주
1줄) 뿐이다.

## 위험도

NONE
