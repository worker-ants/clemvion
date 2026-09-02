# Rationale 연속성 검토 — `spec-draft-ws-socket-lifetime-binds-token.md`

## 검토 범위

target: `plan/in-progress/spec-draft-ws-socket-lifetime-binds-token.md` (spec_impact:
`spec/5-system/6-websocket-protocol.md`).

대조한 과거 Rationale:
- `spec/5-system/6-websocket-protocol.md` §Rationale 전체 — 특히 `R-wontdo-rawws-rest`
  (2026-07-08), `R-wontdo-maintenance-appping`(2026-09-02), "전송 계층 정정", "재연결 복구"
  항목
- `spec/5-system/6-websocket-protocol.md` §1.2·§1.3·§4.6·§6.1·§9.2·§8 본문 (실제 현재 텍스트,
  target 이 인용하는 라인 좌표와 대조)
- `spec/5-system/14-external-interaction-api.md` R10·R15·R19 (target 의 "구현 메모" 가 자기
  설계를 이들과 다른 클래스라 구분하는 근거를 실측 대조)

## 발견사항

- **[WARNING] `auth.refreshed.expiresAt` 를 "활성 표기 선례" 로 인용 — 실제로는 won't-do 참고 예시 안의 죽은 필드**
  - target 위치: "### payload 를 `{ message }` → `{ message, expiresAt }` 로" 문단 —
    "형식은 **ISO 8601 문자열**(`expiresAt: string`)로 고정한다 — 이 문서의 다른 시각 필드
    (`auth.refreshed.expiresAt` 등)와 같은 표기다."
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` §1.3(line 56-66) + §Rationale
    `R-wontdo-rawws-rest`(2026-07-08). §1.3 은 in-band `auth.refresh`/`auth.refreshed` 메시지
    프로토콜을 **명시적으로 "비채택 (won't-do)"** 로 종결했고, `auth.refreshed.expiresAt` 는
    그 직후 "**아래 in-band 갱신 프로토콜(참고용, 미채택)**" blockquote 안의 JSON 예시에만
    존재한다 — "현재는 위 메시지 핸들러/emit 이 backend 에 없다" 고 스스로 명시하는 **죽은
    참고 텍스트**다.
  - 상세: target 은 이 필드를 "이 문서의 다른 시각 필드" 라며 마치 이미 채택·구현된 표기
    컨벤션의 사례처럼 인용한다. 그러나 실제로 이 문서에서 **구현된** ISO8601 `expiresAt` 필드
    선례는 §4.2 `_retryState.expiresAt`(line 448, `AI_RETRY_STATE_TTL_MINUTES` 로 실동작)이다.
    `auth.refreshed.expiresAt` 를 근거로 드는 것은 기각된 메커니즘(in-band 토큰 갱신 프로토콜)
    자체를 재도입하는 것은 아니지만, **기각된 설계의 잔존 텍스트를 살아있는 컨벤션인 양
    인용**하는 결이라 "선례에 없는 근거를 소급 부여" 하는 패턴과 인접하다. `R-wontdo-rawws-rest`
    가 그 프로토콜 전체를 폐기하며 남긴 이유(재도입 대비 payload 형태 보존)와도 무관한 용도로
    재사용된 셈이다.
  - 제안: 인용 대상을 §4.2 `_retryState.expiresAt`(구현됨) 로 교체하거나, `auth.refreshed.expiresAt`
    를 계속 인용하려면 "won't-do 참고 예시의 필드명일 뿐 구현된 선례가 아니다" 라는 caveat 을
    한 줄 추가한다. 기능적 영향은 없다(어느 쪽이든 결정된 포맷은 ISO 8601 문자열로 동일) —
    근거 인용의 정확도 문제다.

- **[INFO] 구현 메모의 "R10/R15/R19 와 다른 클래스" 논증이 최종 spec Rationale 항목에 포함되도록 명시**
  - target 위치: "## 구현 메모 (developer 트랙 — 본 draft 범위 밖)" — "분산·재시작 내성은 이 타이머의
    관심사가 아니다... 이웃 spec 의 R10/R15/R19 가 다루는 '다중 인스턴스 간 상태 불일치' 클래스가
    아니다" 단락. vs "## 변경안" 표 #8 "Rationale 신설 `R-ws-socket-lifetime-binds-token`"
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` R15("Terminal token revoke
    at-least-once — durable `execution_token` reconciliation")·R19("공개 위젯 idle-wait
    execution 회수 — 토큰-만료 신호 + sweep")와 `spec/5-system/4-execution-engine.md` §7.4
    ("in-process resolver 소실 → 항상 durable BullMQ enqueue" 원칙, §Rationale "Durable
    Continuation").
  - 상세: 이 저장소는 "in-flight 상태를 특정 프로세스의 메모리에만 두면 재시작 시 소실된다" 는
    원칙을 여러 곳(Continuation Bus, terminal token revoke, idle-wait reap)에서 반복 채택해
    **durable state + 주기 reconciliation** 패턴으로 수렴시켜 왔다. target 의 설계(소켓별
    in-memory `setTimeout`, 프로세스 로컬, 재시작 시 재구성 없음)는 이 패턴을 따르지 않는데,
    "구현 메모" 가 실측 검증된 타당한 이유(소켓 자체가 프로세스에 종속돼 있어 별도 durable
    자원이 없다)로 이를 반박한다 — 논증 자체는 타당하다. 다만 이 반박은 현재 **plan 문서의
    "본 draft 범위 밖" 라벨이 붙은 구현 메모에만** 있고, 신설 예정 spec Rationale
    `R-ws-socket-lifetime-binds-token` 항목에 포함될지는 명시돼 있지 않다. 누락되면 향후
    "왜 이 기능만 R15/R19 의 durable sweep 패턴을 안 따르는가" 를 묻는 독자가 spec 안에서
    답을 못 찾는다.
  - 제안: spec Rationale 신설 시 이 구분 논증(소켓=프로세스 종속 자원이라 별도 재구성 대상이
    없음, R15/R19 는 프로세스 독립적으로 지속되는 자원을 다룸)을 한 문단으로 옮겨 싣는다.

## 요약

target 이 인용하는 4건의 과거 Rationale(`R-wontdo-rawws-rest`, `R-wontdo-maintenance-appping`,
"전송 계층 정정", "재연결 복구")은 모두 실제 spec 본문과 대조해 정확히 일치했고, target 의 결정은
그 이력이 열어 둔 "잔여 1종(`auth.token_expired`)은 제품 결정 선행" 궤적을 그대로 잇는다 —
기각된 raw-WS 표면(서브프로토콜 인증·raw close code)이나 REST 대체로 이미 종결된 in-band
`auth.refresh`/`auth.refreshed` **메커니즘**을 재도입하지 않으며, §6.1("재연결은 Socket.IO
내장 위임")에 대한 수정은 새 예외 서술 + 신규 Rationale 항목(#8)을 동반해 "무근거 번복" 을
피한다. 유일한 흠은 payload 포맷 근거로 든 `auth.refreshed.expiresAt` 가 실은 그 won't-do
프로토콜의 참고용 죽은 텍스트라는 점 — 결정 자체(ISO 8601 문자열)에는 영향이 없는 인용
정확도 문제다. R10/R15/R19 대비 자기 설계를 구분하는 논증은 타당하지만 현재 plan 문서에만
있고 spec Rationale 초안 항목에 반영될지 불명확하다.

## 위험도
LOW
