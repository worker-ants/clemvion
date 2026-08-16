# Rationale 연속성 검토 — `plan/in-progress/eia-internal-rest-error-masking.md`

## 검토 방법

- target 문서(`plan/in-progress/eia-internal-rest-error-masking.md`) 전문을 조립 payload 에서 확인.
- payload 내 `spec/5-system/14-external-interaction-api.md`·`spec/conventions/secret-store.md` 의
  `## Rationale` 은 컨텍스트 예산 초과로 절단돼 있었으므로, 두 파일을 저장소에서 직접 읽어
  R1~R19(EIA) 및 R1~R5(secret-store)를 실물로 대조했다.
- 관련 `spec/2-navigation/14-execution-history.md`(R-5), `spec/5-system/6-websocket-protocol.md`
  (llmCalls strip-only 등), `spec/data-flow/15-external-interaction.md` 도 대조.
- target 이 인용하는 "직전 세션의 `--spec` CRITICAL" 및 `16_03_57` 라운드의 checker 발견사항
  (naming_collision·rationale_continuity·convention_compliance·plan_coherence)을 실제 산출물
  파일(`review/consistency/2026/08/16/16_03_57/*.md`)에서 원문 대조해 target 의 인용이
  지어낸 것이 아닌지 검증했다.

## 발견사항

이번 라운드에서 CRITICAL/WARNING 급 Rationale 연속성 위반은 발견되지 않았다.

- **[INFO] 직전 라운드(`16_03_57`) WARNING — `interaction.triggerToken` 예외 근거 재사용 — 이번 target 에서 실제로 해소됨 (확인)**
  - target 위치: target `## D` 절 및 `### ② secret-store.md §1` 신설 블록
  - 과거 결정 출처: `secret-store.md` `## Rationale` R1("Application-side AES-256-GCM … 마스터키가
    app↔DB 경계를 절대 넘지 않음")과, 그 유일한 예외인 `secret-store.md §1` "비대상 —
    `AuthConfig.config`"("다른 메커니즘으로 **동등하게 암호화**된다"가 근거)
  - 상세: `16_03_57` 라운드의 rationale_continuity checker 는 "`interaction.triggerToken` 을
    `AuthConfig.config` 와 같은 '비대상' 범주로 같은 문구 재사용으로 묶으면, 암호화가 아예 없는
    필드가 '이미 선례가 있다'는 인상으로 원칙을 조용히 좁힌다"는 WARNING 을 냈고, "독립된 근거를
    적으라"(발급-1회-노출 설계, rotation 즉시 무효화 등)고 구체 제안했다. target 은 정확히 이
    권고를 반영해 `AuthConfig.config` 문구를 재사용하지 않고 (a) hot-path bearer 토큰의 매 요청
    복호화 비용, (b) revoke=rotation 즉시 무효화, (c) 값 공간이 서버 발급 랜덤이고 1회만 노출되는
    위험 프로파일이라는 독립 근거 3가지를 세웠으며, "이 블록을 평문 보관 일반의 선례로 인용하면
    안 된다"는 명시적 가드 문구까지 추가했다. `AuthConfig.config` 예외와 "종류가 다르다"는 서술도
    정확하다(그쪽은 암호화됨, 이쪽은 암호화 자체가 없음).
  - 제안: 없음 — 이미 반영됨. planner 턴에서 이 문구를 그대로 `secret-store.md` 에 옮길 때 (a)(b)(c)
    3가지를 축약하지 말 것(축약하면 다음 세 번째 평문 예외가 같은 방식으로 재발할 위험이 다시
    열린다 — 이는 checker 가 이미 지적한 실패 모드).

- **[INFO] R17 마지막 불릿 "내부 REST 와의 비대칭은 미결이다" — target 의 교체는 번복이 아니라 미결 해소**
  - target 위치: target `### ① 14-external-interaction-api.md §R17` 교체안
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` R17 마지막 불릿
    "**내부 REST 와의 비대칭은 미결이다**: … 어느 쪽이 옳은지는 아직 정하지 않았다"
  - 상세: 이 문구는 스스로 "미결"이라 선언한 open item 이지 기각된 대안이 아니다. target 은
    사용자가 2026-08-16 에 택일했다는 근거로 이를 "내부 경로에도 마스킹"으로 확정하며, 교체
    문구 자체에 근거(§R-5 원칙 원용 + 그 범위 한계 caveat, §R17 `ai_message` 선례, egress-only
    불변 보존, 범위 밖 항목 명시)를 온전히 새로 써서 동봉했다 — "결정의 무근거 번복" 에 해당하지
    않는다. `spec/2-navigation/14-execution-history.md` R-5 인용도 "이 필드를 이미 규정하고
    있지는 않다"는 caveat 을 스스로 달아 과대인용을 피했다(R-5 원문의 "롤 게이팅이 아니라 서버
    boundary masking parity" 문구와 정확히 일치).
  - 제안: 없음.

- **[INFO] `toTerminalErrorPayload` 미재사용 — R10 단일 sink 원칙 및 §R17 egress 초크포인트 원칙과 배치되지 않음**
  - target 위치: target `## 설계` 절 "`toTerminalErrorPayload` 를 재사용하지 않는다" 단락 (2회 중복 게재됨)
  - 과거 결정 출처: EIA R17 마지막 불릿("`toTerminalErrorPayload` 가 **egress 초크포인트**에서
    … 종결 emit 4곳과 chat-channel 재정규화 1곳이 모두 이 함수를 거치므로 …") / R10("엔진 레벨
    단일 sink 정책")
  - 상세: R17 의 초크포인트 원칙은 "종결 **emit** 경로"(엔진→WS/SSE/webhook fanout, wire 형태
    `{code,message,nodeId,details?}` 로 정규화)에 대한 것이고, target 이 다루는 것은 내부 REST
    **읽기** 응답(`Record<string,unknown>|null` 형태 보존)이라 호출 그래프와 계약이 다르다.
    target 은 같은 하위 primitive(`deepRedactSecrets`, `SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN`
    SoT)를 재사용하면서 형태만 다른 별도 chokepoint(`redactStoredErrorForResponse` →
    `toResponseExecution`/`stopInternal`)를 세운다 — 이는 R10 이 지키려는 "엔진은 단일 sink
    로만 발행"(engine emit-side)과 무관한 layer(controller/service response 조립)이고, R17 의
    "구조적으로 안 빠지게" 라는 취지를 오히려 새 call graph 에도 동일하게 적용한 것이라 원칙
    확장이지 이탈이 아니다. `16_03_57` convention_compliance 라운드도 같은 결론(§R17 원칙과
    동형)에 도달해 있었다.
  - 제안: 없음. 단, planner 턴에서 spec 반영 시 "왜 `toTerminalErrorPayload` 를 안 쓰는가"의
    근거(형태 보존 vs wire 정규화)를 R17 교체 불릿에도 그대로 남길 것 — target 초안엔 이미
    포함돼 있으므로 누락 없이 그대로 옮기면 된다.

- **[INFO] DB egress-only 불변식 — 그대로 준수**
  - target 위치: target `## 설계` "내부는 `deepRedactSecrets` 로 동일 … DB 는 **원문 보존**"
  - 과거 결정 출처: EIA R17 "**egress-only(§R17 원칙 준수)**: DB `Execution.error` 는 **원문을
    보존**한다" / "내부 소비처(LLM 컨텍스트 주입, durable park 스냅샷, Background body)는 faithful
    텍스트를 유지한다"
  - 상세: target 은 이 불변식을 DB write 경로에 손대지 않고 응답 조립 시점에만 마스킹을 삽입하는
    방식으로 정확히 지킨다. "잔여 갭(의도)" 프로브 결과(자격증명 없는 연결 문자열 무변화)도 R17
    이 이미 수용한 동일 트레이드오프를 그대로 상속한다 — 새로운 미문서 갭이 아니다.
  - 제안: 없음.

## 요약

target 문서는 `spec/5-system/14-external-interaction-api.md` R17("내부 REST 와의 비대칭은 미결이다")이
스스로 열어 둔 미결 항목을 사용자 택일로 닫는 작업이며, R-5(`14-execution-history.md`)를 과대인용하지
않도록 스스로 caveat 을 달았고, R10(단일 sink)·§R17(egress 초크포인트·egress-only 불변식)과 충돌하지
않는 별도 layer 의 chokepoint 를 세웠다. `secret-store.md` 의 SecretResolver 경유 원칙에 대한 새 예외
(`interaction.triggerToken`)도 직전 라운드(`16_03_57`)의 rationale_continuity WARNING("AuthConfig.config
문구를 재사용하지 말고 독립 근거를 세우라")을 정확히 반영해 (a)(b)(c) 독립 근거와 "선례로 인용 금지"
가드를 함께 작성했다. target 이 인용하는 과거 checker 발견·기각된 대안 후보 이름들은 실제
`review/consistency/2026/08/16/16_03_57/*.md` 산출물과 대조해 실사실임을 확인했으며, 지어낸 이력은
없었다. 결과적으로 기각된 대안의 무근거 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느
것도 발견되지 않았다 — 오히려 이전 라운드 WARNING 을 교과서적으로 해소한 사례에 가깝다.

## 위험도

NONE
