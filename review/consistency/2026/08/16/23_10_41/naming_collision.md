# 신규 식별자 충돌 검토 — spec-draft-eia-fanout-masking.md

## 조사 방법
target 이 새로 "도입"한다고 주장하는 식별자(함수명·클래스명·이벤트명·용어)를 전수로 뽑아
`spec/` 및 `codebase/backend/src` 에서 grep 대조했다. 결과: target 이 언급하는 코드 식별자
(`toFanoutEnvelope` · `deepRedactSecretsPreserving` · `redactStoredDataForResponse` ·
`ExecutionChannelAuthorizer` · `FANOUT_EVENTS` 등)는 **전부 이미 머지된 구현**
(`1b8fd5cc7`·`fe6a54c80`, `git log --all` 로 존재 확인)을 가리키는 것이고, target 자신이
새로 만드는 이름은 **없다** — 이 draft 는 순수하게 기존 구현을 spec 에 등재하는 문서 변경이다.
요구사항 ID(신규 `R-`/`EIA-NX-` 번호)·신규 API endpoint·신규 ENV var·신규 spec 파일 경로도
전부 0건이었다.

## 발견사항

- **[WARNING]** `execution.node.*` emit 마스킹 상태에 대한 동일 파일 내 자기모순 (신규 식별자 자체 충돌은 아니나, target 변경이 기존 서술과 정면으로 부딪힌다)
  - target 신규 서술: `spec/5-system/6-websocket-protocol.md` §4.1 표 직후에 새로 붙이는 캐비엇
    (target "변경 2-b") — *"위 execution/node 이벤트의 payload 는 emit 시점에 자격증명
    값-패턴이 마스킹된다"* + EIA §R17 "변경 1-b" 가 **잔여 ①**(`WS execution.node.* emit 의
    error`)을 *"~~잔여 ①~~ 해소(2026-08-16)"* 로 flip.
  - 기존 사용처: 같은 파일 `spec/5-system/6-websocket-protocol.md:184` (§4.1 표, `execution.snapshot`
    행 안의 인라인 각주) — *"같은 소켓의 `execution.node.*` **emit** 은 이 관문을 지나지 않아
    **아직 원문이다**"* (이 문장 자체가 2026-08-16 결정을 인용하며 붙어 있음).
  - 상세: target 이 새로 넣는 §4.1 캐비엇과, 그 바로 위 §4.1 표 안 기존 각주가 **같은 이벤트
    패밀리**(`execution.node.*` emit)의 마스킹 여부를 정반대로 서술하게 된다 — 하나는
    "값-패턴이 마스킹된다"(2026-08-16 신설), 다른 하나는 "이 관문을 지나지 않아 아직
    원문이다"(기존, 같은 날짜 2026-08-16 을 인용). target 의 세 변경 목록(EIA §R17 / WS §4.1
    nodeLabel+caveat / webhook §5.3) 어디에도 이 `:184` 각주를 갱신하는 항목이 없다.
    독자가 §4.1 표를 훑다가 이 각주만 보면 "node emit 은 여전히 원문" 이라는 stale 결론에
    도달하는데, 바로 몇 줄 아래(같은 §4.1 캐비엇)는 반대를 말하는 self-contradiction 이 된다.
    (`grep -rn "이 관문을 지나지 않아" spec/` 결과 이 각주가 유일한 잔존 사례임을 확인했다 —
    EIA §R17 쪽의 "잔여 ①" 원문은 target 자신이 이미 flip 대상으로 잡아 두었다.)
  - 제안: target 의 "변경 2" 체크리스트에 `:184` 각주 정정을 추가한다 — 예:
    *"nest 된 `execution.error`/`execution.node.*` emit 모두 값-패턴 마스킹을 받는다
    (2026-08-16, [EIA §R17](./14-external-interaction-api.md))"* 로 바꾸거나, 최소한 새 §4.1
    캐비엇을 **가리키는 참조**로 교체한다. 이 항목을 놓치면 이 PR 이 direct 로 편집하는
    파일 안에서, 이 PR 이 만든 새 사실과 기존 문장이 즉시 어긋난다.

## 그 외 점검한 관점 (충돌 없음 확인)

1. **요구사항 ID** — target 은 신규 `R-`/`EIA-NX-` 번호를 발급하지 않는다. 기존 §R17(`14-external-interaction-api.md`) 안에 불릿만 추가/flip 한다. 충돌 없음.
2. **엔티티/타입명** — `redactStoredDataForResponse` 는 이미 `shared/utils/redact-stored-error.ts` 에 자매 `redactStoredErrorForResponse` 와 함께 구현돼 있다(grep 확인). `toFanoutEnvelope`(private method, `websocket.service.ts:401`)·`deepRedactSecretsPreserving`(`sanitize-error-message.ts:197`)·`ExecutionChannelAuthorizer`(`execution-channel-authorizer.ts`)도 전부 기존 코드를 정확히 가리킨다 — target 이 새로 이름 짓는 것이 아니다. 다른 의미로 이미 쓰이는 동명 식별자 없음.
3. **API endpoint** — target 은 신규 endpoint 를 정의하지 않는다(기존 emit·읽기 표면의 마스킹 규정 추가일 뿐).
4. **이벤트/메시지명** — 새 이벤트 이름 도입 없음. `execution.node.*` · `execution.ai_message` 등은 기존 패밀리를 그대로 재참조. 유일한 관련 발견은 위 WARNING(이름이 아니라 "상태 서술"의 모순).
5. **환경변수·설정키** — target 텍스트 전체에 신규 ENV var/config key 없음 (`FANOUT_EVENTS` 는 기존 whitelist 를 가리키는 참조).
6. **파일 경로** — target 은 새 spec 파일을 만들지 않는다. 기존 3개 파일(`14-external-interaction-api.md` §R17, `6-websocket-protocol.md`, `12-webhook.md` §5.3)만 수정한다. `### 4.4` 절 번호가 이미 두 번 중복된 상태(`394행`·`763행`)를 인지하고, target 은 **의도적으로 새 §4.4 를 만들지 않고** §4.1 표 직후 무번호 캐비엇으로 붙인다 — 세 번째 중복을 피하는 올바른 선택이다.

## 요약
target 이 실제로 새로 도입하는 식별자(함수명·클래스명·엔티티명·API·ENV·파일 경로)는 없다 — 전부 이미 머지된 구현(`1b8fd5cc7`·`fe6a54c80`)을 문서화하는 편집이며, 코드 식별자 대조 결과 기존 사용처와 다른 의미로 충돌하는 사례는 발견되지 않았다. `### 4.4` 중복 섹션 번호를 피해 무번호 캐비엇을 택한 판단도 적절하다. 유일한 실질 발견은 순수 "신규 식별자 충돌"의 범주를 살짝 벗어나지만, target 이 직접 편집하는 `6-websocket-protocol.md` §4.1 표 안에 남아 있는 기존 각주(`:184`)가 target 이 새로 서술하는 `execution.node.*` emit 마스킹 상태와 정반대를 말해 같은 파일 안에서 self-contradiction 을 만든다 — target 의 편집 범위에 이 각주 정정을 포함시킬 것을 권고한다.

## 위험도
LOW
