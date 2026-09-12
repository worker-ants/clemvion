# 신규 식별자 충돌 검토 — setupChannel 실패 분류 (transport → 원인)

## 검증한 신규 식별자와 결과 (충돌 없음)

target 이 실제로 새로 부여하는 식별자는 다음 세 가지뿐이며, 전부 `origin/main` 대비 diff 없는
현재 worktree 기준으로 grep 전수 검색했다. 셋 다 **충돌 없음**을 확인했다.

| 신규 식별자 | 검증 방법 | 결과 |
|---|---|---|
| Rationale ID `R-CC-23` | `spec/5-system/15-chat-channel.md` 의 `^### R-CC-` 전수 나열 → 최댓값 `R-CC-22`, `R-CC-14` 는 실제로 결번(재사용 안 됨을 target 이 명시). `grep -rn "R-CC-23" spec/ plan/` → target 자기 자신 외 0건 | 충돌 없음 |
| Rationale ID `R-CCA-9` | `spec/conventions/chat-channel-adapter.md` 의 `^### R-CCA-` 전수 나열 → 최댓값 `R-CCA-8`. `grep -rn "R-CCA-9" spec/ plan/` → target 자기 자신 외 0건 | 충돌 없음 |
| 신규 섹션 앵커 `chat-channel-adapter.md §1.1.2` | 문서 전체 헤딩 나열(`^## \|^### \|^#### `) → `§1.1.1` 은 이미 존재(`#### 1.1.1 setupChannel 멱등의 뜻…`), `§1.1.2` 는 미존재. `§1.1.2` 는 그 형제 항목으로 자연스럽게 들어갈 자리(둘 다 `#### N.N.N` 레벨, `§1.1`의 하위) — 기존 `§1.2 EiaEvent 입력` 등 top-level 3자리 섹션과도 겹치지 않음 | 충돌 없음 |

부수 확인: target 의 "구현 위임" §5 가 언급하는 `providers/{slack,discord,telegram}.md §3.1` 은 세 파일
모두 실제로 `### 3.1 setupChannel 구체` 섹션이 이미 존재해 자연스러운 추가 대상이다(신규 번호 채번
아님, 충돌 대상 아님).

target 은 그 외에 새 엔티티/DTO/인터페이스명, 새 API endpoint, 새 webhook/queue/SSE 이벤트명, 새
ENV var·config key, 새 spec 파일 경로를 **전혀 도입하지 않는다** — 기존 두 파일(`15-chat-channel.md`
§5.4 표 두 행, `chat-channel-adapter.md` §1.1 표 한 행 + 신설 §1.1.2)의 **본문만 교체/추가**한다.
따라서 관점 2·3·4·5·6 은 target 범위 밖(신규 도입 없음)이라 충돌 대상이 없다.

## 발견사항

- **[WARNING]** 기존 식별자 `BOT_TOKEN_INVALID` / `CHAT_CHANNEL_SETUP_FAILED` 의 판별 기준 변경이
  두 미러 문서에 전파되지 않는다 (신규 식별자는 아니지만, 같은 식별자가 문서마다 다른 판별 기준을
  갖게 되는 위험)
  - target 신규 식별자: 없음 — 대신 target 이 **기존 코드**(`BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED`)의
    **의미(분류 기준)를 transport(401/403) 에서 원인(자격 증명 거부)으로 바꾼다**
  - 기존 사용처:
    - `spec/2-navigation/2-trigger-list.md:120` — *"잘못된 토큰은 `setupChannel` 의 외부 provider API
      **401/403** 에서 400 `BOT_TOKEN_INVALID` 로 드러난다"*
    - `spec/data-flow/14-chat-channel.md:161-162` — *"`setupChannel` 의 외부 API **401/403** 은
      `BOT_TOKEN_INVALID` 400, 그 외는 `CHAT_CHANNEL_SETUP_FAILED` 로 변환"*
  - 상세: target 의 실측(§"실측" 절)에 따르면 Slack·Discord 는 401/403 을 아예 안 준다(Slack 은
    HTTP 200 + `{ok:false}`, Discord 는 status 자체가 없음) — 즉 이 두 미러 문서가 서술하는
    "401/403 이 분류 신호" 라는 문장은 target 착지 후 **거짓**이 된다. target 의 편집 대상(체크리스트)은
    `15-chat-channel.md §5.4` 표 두 행 + `chat-channel-adapter.md §1.1/§1.1.2` 뿐이고, 이 두 미러
    문서는 target 의 "편집 대상" 목록에도 "안 하는 것" 목록에도 없다 — 누락으로 보인다. 이 결함은
    엄밀히는 "신규 식별자 충돌"이 아니라 "기존 식별자의 의미가 문서 간 분기"하는 문제라 이 checker의
    본래 스코프(신규 ID 충돌)에는 borderline 이지만, 관점 1("기존에 **다른 의미**로 이미 사용되고
    있는가")의 정신에 부합해 등재한다.
  - 제안: 두 파일의 "401/403" 서술을 target 의 새 분류 문구(*"자격 증명 거부로 실패 — provider 가
    그것을 401/403 · `{ok:false, error:'invalid_auth'}` · `verify_key` 불일치 중 무엇으로 알리든
    같은 분류"*)로 동기화하거나, 최소한 `15-chat-channel.md §5.4` 를 SoT 로 가리키는 링크로 축약할
    것. target 의 체크리스트에 이 두 파일을 추가하는 것을 권고.

## 요약

target 이 실제로 새로 부여하는 세 식별자(Rationale `R-CC-23`·`R-CCA-9`, 섹션 앵커
`chat-channel-adapter.md §1.1.2`)는 전수 grep 으로 기존 사용처와 충돌하지 않음을 확인했고, 새
엔티티·API endpoint·이벤트명·환경변수·spec 파일 경로는 아예 도입되지 않아 해당 관점들은 적용 대상이
없다. 다만 target 이 **기존 식별자**(`BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED`)의 판별 기준을
바꾸면서, 같은 식별자를 옛 기준("401/403")으로 서술하는 두 미러 문서(`2-trigger-list.md:120`,
`data-flow/14-chat-channel.md:161-162`)가 target 의 편집 대상 목록에서 빠져 있어 착지 후 SoT 내부에
식별자 의미 불일치가 남을 위험이 있다. 신규 식별자 충돌 자체는 없으므로 이 결함 하나로 착수를 막을
정도는 아니다.

## 위험도
LOW
