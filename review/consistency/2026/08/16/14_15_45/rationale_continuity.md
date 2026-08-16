# Rationale 연속성 검토 — spec-draft-eia-error-masking-catalog.md

## 발견사항

- **[INFO]** "위 conversationThread 불릿이 기각한 것과 같은 이유" 인용이 근사 유비(analogy)이지 동일 사유는 아님
  - target 위치: `## 변경안` ① 신설 불릿의 `**egress-only(§R17 원칙 준수)**` 서브 불릿
    ("write-time redaction 은 위 `conversationThread` 불릿이 기각한 것과 같은 이유로 채택하지 않았다")
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` `## Rationale` R17 "표면 제약(보안)" `conversationThread` 불릿의
    `**egress-only(의도)**` 서브 불릿 — "내부 소비처(LLM 컨텍스트 주입, durable park 스냅샷 `Execution.conversation_thread`,
    Background body)는 faithful 텍스트를 유지한다. 저장 시점(append) redaction 은 **LLM 주입 thread 까지 변형**하고,
    보수적 공유 패턴이 평문 대화에 false-positive 하면 **컨텍스트를 조용히 손상**시키므로 채택하지 않았다."
  - 상세: 원 Rationale 이 write-time redaction 을 기각한 핵심 근거는 "LLM 컨텍스트 주입 손상" 이라는 `conversationThread`
    특유의 위험이다. `Execution.error` 원문의 내부 소비처는 target 이 스스로 적었듯 "서버 로그·사후 디버깅"이지 LLM
    컨텍스트가 아니므로, 근거의 **범주**(내부 소비처 faithful 텍스트 보존이 우선)는 같지만 **구체 메커니즘**(LLM 오염 위험)은
    이 필드에 적용되지 않는다. 결론(egress-only 유지)은 타당해 보이나, "같은 이유" 라는 표현은 근거를 한 단계 넓게
    끌어다 쓴 것이라 다음 독자가 두 결정을 문자 그대로 동일 사유로 오인할 수 있다. 이는 기각된 대안의 재도입도, 원칙
    위반도 아니며 — 결론 자체는 R17 의 "egress-only" 큰 틀과 정합적이다.
  - 제안: 인용 문구를 "같은 이유" 대신 "같은 원칙(내부 소비처는 faithful 텍스트 보존) — 다만 이 필드의 구체 근거는
    LLM 컨텍스트 오염이 아니라 서버 로그·사후 디버깅 가치 보존" 정도로 한 단계 구체화하면 향후 세 번째 필드가
    추가될 때도 "같은 이유" 체인이 부정확하게 길어지는 것을 막을 수 있다. 필수 수정은 아님(INFO).

## 검토 근거 요약 (판단에 사용한 대조)

- **기각된 대안의 재도입 여부**: target 신설 불릿의 `egress-only` 서브 불릿은 write-time(저장 시점) redaction 을
  다시 채택하지 않는다고 명시 — R17 이 이미 기각한 대안(저장 시점 redaction)을 도입하지 않았다. 문제 없음.
- **합의된 원칙 위반 여부**: R17 의 핵심 원칙("egress 초크포인트에서 값 마스킹, DB 는 원문 보존", "표면별 코드명·
  cross-ref 동치" 류의 표면 분리 원칙)과 target 의 `toTerminalErrorPayload`→`deepRedactSecrets` egress 초크포인트
  설계가 정합한다. `code`·`nodeId` 를 대상에서 제외한 것도 R14 의 "토큰 family 는 이미 노출된 값이라 안전" 논리와
  같은 결의 판단(닫힌 값 공간은 마스킹 불요)이라 원칙과 어긋나지 않는다.
- **결정의 무근거 번복 여부**: target 자신의 `## Rationale` 이 이전 draft(`14_04_55` 라운드)가 "내부 REST 는
  마스킹하지 않는다(비대칭 — 의도)"를 **근거 없이** 확정하려 했던 CRITICAL 을 명시적으로 인용하고, 그 근거 인용이
  실제로는 R17 `execution.ai_message` 불릿의 "participant-vs-observer 분리는 **후속 개선 여지**"(미확정)를 확정된
  판단처럼 끌어 쓴 오독이었음을 정확히 지목한다. 최종본은 그 결정을 다시 내리지 않고 "사실만 기록, 결정은 열어둠"으로
  물러섰다 — 이는 무근거 번복이 아니라 **번복을 인지하고 되돌린** 사례다. `2-navigation/14-execution-history.md` R-5
  ("안전성은 롤 게이팅이 아니라 서버 boundary masking parity 에 의존")를 인용해 "내부라서 원문이어도 된다"는 결론이
  성립하지 않음을 짚은 것도 R-5 원문과 정확히 일치한다.
  자체 self-correction 이 이후 미결 항목을 `spec-sync-external-interaction-api-gaps.md` I1 로 열어 두겠다고
  체크리스트에 명시한 것도 일관적이다.
- **암묵적 가정 충돌 여부**: R10(엔진 단일 sink) 원칙, R17 의 "종결 이벤트 4곳 + chat-channel 1곳이 모두 egress
  헬퍼를 거친다"는 구조, R8/R15 류 다른 invariant 와 target 변경 사이에 충돌 없음. `## Rationale` 배치도 프로젝트
  규약("결정의 배경·근거는 spec 문서 끝의 `## Rationale`")과 정합 — R17 5번째 불릿은 `## Rationale` 절 내부에,
  §6.4 캐비엇은 본문에 캐비엇만 두고 근거는 R17 로 cross-ref 하는 방식으로 분리했다.

## 요약

target 은 §R17 마스킹 카탈로그에 종결 `Execution.error` egress 마스킹을 새 불릿으로 등재하고 §6.4 에 캐비엇을 추가하는
spec draft 로, 기존 `spec/5-system/14-external-interaction-api.md` `## Rationale`(R17 의 egress-only 원칙, DB 원문
보존 원칙, `getStatus`/`Execution.error` 컬럼 분리)과 `spec/2-navigation/14-execution-history.md` R-5(boundary masking
parity 원칙)를 정확히 재인용하며 어느 것도 근거 없이 뒤집지 않는다. 특히 문서 자신의 `## Rationale` 이 직전 draft
라운드(`14_04_55`)에서 발생한 실제 CRITICAL(미결 비대칭을 근거 오인용으로 조용히 확정하려던 시도)을 스스로 지목하고
"사실만 기록, 결정은 트래커에 열어 둠"으로 정정한 이력을 명시적으로 남긴 점은 Rationale 연속성 관점에서 모범적이다.
발견된 유일한 이슈는 "같은 이유로 채택하지 않았다"는 인용이 결론은 맞지만 근거를 한 단계 넓게 끌어 쓴 INFO 수준의
정밀화 여지뿐이며, 기각된 대안 재도입·원칙 위반·무근거 번복·invariant 우회는 발견되지 않았다.

## 위험도

LOW
