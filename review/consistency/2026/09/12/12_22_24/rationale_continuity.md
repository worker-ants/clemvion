# Rationale 연속성 검토 — setupChannel 실패 분류

대상: `plan/in-progress/spec-draft-setup-error-classification.md` (`--spec` 3회차)

## 검증 방법

프롬프트 번들이 이 draft 의 핵심 대상 파일 3개(`spec/5-system/15-chat-channel.md` ·
`spec/data-flow/14-chat-channel.md` · `spec/5-system/4-execution-engine.md`)와
`spec/conventions/chat-channel-adapter.md` 를 예산 초과로 누락했다(번들 하단 "생략된 파일 77개"
목록 자체가 그렇게 명시한다). 이 checker 는 그 4개 + `spec/conventions/error-codes.md` 를
저장소에서 **직접 Read** 해 draft 가 인용하는 문장·표·Rationale ID 전부를 원문과 대조했다.

## 발견사항

- **[INFO]** §1.1.2 fallback 이 인용하는 근거가 가장 가까운 것을 놓쳤다
  - target 위치: 결정 (2) 의 `> **이 fallback 은 R-CCA-5 / CCH-ERR-02 의 「message 원문 배제」에
    대한 의도적·한시적 예외**다` 문단
  - 과거 결정 출처: `spec/conventions/error-codes.md §4.2`(인접) 가 아니라 실제로는
    `spec/5-system/3-error-handling.md` §1.3 `FILE_REQUIRED` 행의 주석 —
    *"확장자 불허(`INVALID_FILE_TYPE`)와 다른 코드다 … **규약이 메시지 문자열 파싱을 금지하므로
    코드로 갈라야 분기할 수 있다**"* (실측 확인, 원문 그대로)
  - 상세: draft 가 인용한 R-CCA-5·CCH-ERR-02 는 둘 다 **EIA `execution.failed` 알림의 분류
    입력**(다른 기능·다른 코드 경로)에 대한 결정이라 인용 자체는 유효하지만, "메시지 문자열
    파싱을 금지한다" 는 문장 그대로의 **일반 원칙**은 `3-error-handling.md` 의 이 한 줄이 더
    직접적으로 갖고 있다. draft 는 이미 자기 Rationale 논지 1 에서 *"축자 인용이 아니라 개별
    사례에서 일반화한 것"* 이라고 스스로 인정하는데, 그 개별 사례 중 정작 이 가장 근접한 선례를
    누락했다.
  - 제안: §1.1.2 의 예외 문단에 `3-error-handling.md §1.3 FILE_REQUIRED` 각주를 추가해 "메시지
    문자열 파싱 금지" 가 이 저장소의 세 번째(§7.5.2, R-CCA-5/R-CC-15, FILE_REQUIRED) 독립 선례임을
    명시. 인용이 촘촘해질수록 fallback 예외가 "일시적" 인지 판단하는 다음 사람의 근거가 넓어진다.

- **[INFO]** fallback 제거 조건이 "후보" 로만 적혀 추적 장치가 없다
  - target 위치: 결정 (2) 의 `> …세 adapter 가 모두 code 를 달면 이 분기는 삭제 후보다.`
  - 과거 결정 출처: 없음(신규 예외이므로 과거 결정과 충돌은 아님) — 프로젝트 관례 위험만 지적
  - 상세: 이 draft 자신이 §1.1.1 에서 "한시적 예외가 영구 예외가 된다" 는 위험을 스스로
    경고했는데(`> 조건을 안 적으면 한시적 예외가 영구 예외가 된다`), 그 조건 자체가 "삭제
    후보다" 라는 관찰 서술일 뿐 누가·언제 판정할지가 없다. 세 adapter 중 (telegram 은 fallback
    경로로 이미 동작, slack/discord 는 이번 턴에 `code` 부착 예정이므로) 이 구현이 끝나면 즉시
    조건이 충족되는데, 판정 트리거가 spec 문서 밖에 있으면 다음 세션이 "충족됐는지" 를 다시
    조사해야 한다.
  - 제안: "구현 위임" 섹션의 항목 2·3·4(adapter 3종에 `code` 부착)가 전부 끝나면 §1.1.2 fallback
    제거를 **같은 트래커의 후속 항목**으로 등재하도록 체크리스트에 한 줄 추가.

- **[INFO]** 502 카탈로그 신설이 §5.3 선례가 경고한 함정과 같은 모양이지만, draft 가 이미 방어책을
  갖고 있다 (기록만)
  - target 위치: 결정 (4), 구현 위임 1ⓔⓕ
  - 과거 결정 출처: `spec/5-system/2-api-convention.md` Rationale *"§5.3 에 `410` 기본 코드를
    만들지 않은 이유"* — *"그 목록은 우리가 바라는 규범이 아니라 `GlobalExceptionFilter` 의
    상태→코드 매핑을 옮긴 **서술**이다… 문서가 구현에 없는 동작을 약속하게 되고"*
  - 상세: 이 선례는 엄밀히는 §5.3(상태코드별 **기본 `code` 값**) 범위이고 draft 가 건드리는
    §6(상태 코드 자체의 카탈로그)은 아니라서 직접 충돌은 아니다. 다만 502 는 실측 0건(코드에도
    없음)인 채로 스펙에 먼저 등재되고, 구현(`BadGatewayException` 배선·필터가 502 를 표준
    envelope 로 감싸는지)은 "이 턴 밖" 으로 위임돼 있어 §5.3 선례가 경고한 "문서가 구현에 없는
    동작을 약속" 위험의 축소판이 실제로 존재한다. draft 는 이미 구현 위임 1ⓕ 에서
    *"`http-exception.filter` 가 502 를 표준 envelope 로 싸는지 실측 확인 — 한 번도 지나간 적
    없는 경로다"* 라고 스스로 그 위험을 적어 뒀다.
  - 제안: 조치 불요 — 이미 draft 가 자기 방어책을 뒀다. 향후 developer 턴이 1ⓕ 실측에서 필터가
    502 를 못 감싸는 것으로 나오면, 그 사실은 이 스펙 결정이 아니라 §5.3 Rationale 이 경고한
    클래스의 재발이므로 그때는 같은 문서에 각주로 교차 인용해 두면 다음 재발을 막는다.

## 정합성이 확인된 부분 (참고 — 재작업 불필요)

아래는 번들 누락으로 checker 가 직접 원문을 대조한 결과, draft 의 인용이 **정확했다**는
사실을 기록한다(향후 세션이 같은 파일을 다시 의심하지 않도록):

- `15-chat-channel.md` §5.4 표 두 행(400/502)·§4.1 botToken 주석·R-CC-10/§5.4.1/§5.4.1.2·
  R-CC-15(CCH-ERR-02 화이트리스트)·R-CC-22 까지의 ID 계열(R-CC-14 결번 포함) — draft 의 "편집
  대상 원문" 인용 및 ID 계열 주장과 **완전 일치**.
- `chat-channel-adapter.md` §1.1 표의 `setupChannel` 행·R-CCA-5(분류 helper 를 message 원문 없이
  둔 이유)·R-CCA-8 까지의 ID 계열 — **완전 일치**. draft 가 새로 붙이려는 `R-CCA-9` 는 실제로
  다음 빈 번호다.
- `4-execution-engine.md` §7.5.2 의 typed `{code, message, serverDetail}` 계약과 그 Rationale
  ("continuation ack 이 임의 plain Error 의 message 를 그대로 client 에 흘렸다") — draft 가
  "저장소가 이미 같은 문제에 반대 방향으로 결정해 뒀다" 는 근거로 인용한 것과 **정확히 일치**.
  이는 이 draft 의 핵심 설계(message 파싱 대신 typed `code`)가 **지어낸 선례가 아니라 실재하는
  두 개의 독립 선례의 일반화**임을 뒷받침한다.
- `2-api-convention.md` §6 상태 코드 표에 502 행이 없고 503 행이 "upstream 의존성(Redis 등)"
  으로 범위가 좁게 서술돼 있다는 draft 의 주장도 원문과 **일치** — 503 을 "외부 provider 실패"
  로 확장하는 것이 아니라 별도 축(외부 제3자)을 새로 여는 것이라는 draft 의 해석은 원문의 범위
  기술과 모순되지 않는다.
- `providers/discord.md` L56·L76 이 `verify_key` 불일치를 이미 `BOT_TOKEN_INVALID` 로만 던지고
  401/403 을 언급하지 않는다는 draft 의 "편집 불요" 판정도 원문과 **일치**.
- `error-codes.md` 에는 draft 가 일반화의 근거로 삼을 만한 명시적 "4xx/5xx 는 누가 고칠 수
  있는가로 가른다" 문장은 없지만, `3-error-handling.md` §1.3 `FILE_REQUIRED` 주석이 그 정신(코드로
  가르고 메시지로 안 가른다)을 담고 있어 draft 의 일반화가 근거 없는 창작은 아니다.

이 draft 의 새 Rationale(R-CC-23 / R-CCA-9)이 명시하는 "기각한 대안"(503 재사용, message 접두)은
**이 결정 자체가 새로 만드는 기각**이지 과거 이력을 소급 조작한 것이 아니므로, "지어낸 기각 이력"
문제도 없다.

## 요약

이 draft 는 Rationale 연속성 관점에서 이례적으로 견고하다 — 프롬프트 번들이 핵심 대상 파일
4개를 예산 초과로 누락했음에도, checker 가 직접 원문 대조한 결과 draft 의 모든 verbatim 인용·
Rationale ID 계열(R-CC-22 최대·R-CC-14 결번·R-CCA-8 최대)·정책 인용(§7.5.2, R-CCA-5, R-CC-15,
CCH-ERR-02, §6 상태 코드 표)이 실제 spec 원문과 정확히 일치했다. 핵심 설계 결정(message 문자열
파싱 대신 typed `code`)은 지어낸 선례가 아니라 이 저장소에 실재하는 세 개의 독립 선례(§7.5.2 ·
R-CCA-5/R-CC-15 · `FILE_REQUIRED` 주석)의 정당한 일반화다. 유일한 원칙 이탈(§1.1.2 의 401/403
substring fallback 유지)은 draft 스스로 "의도적·한시적 예외" 로 명시하고 제거 조건까지 적어 두어,
기각된 대안의 무단 재도입이 아니라 정직하게 문서화된 예외다. 발견된 사항은 모두 INFO 등급으로,
인용 보강·후속 추적 항목 추가 수준의 개선 제안이며 draft 를 막을 사유는 없다.

## 위험도

LOW
