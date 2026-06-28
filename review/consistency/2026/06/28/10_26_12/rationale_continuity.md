# Rationale 연속성 검토 결과

대상: `spec/7-channel-web-chat/3-auth-session.md`
모드: spec draft 검토 (--spec)

---

## 발견사항

### [WARNING] `interact` 응답 body 를 "void" 로 기술 — EIA R16 번복
- **target 위치**: `spec/7-channel-web-chat/3-auth-session.md` §R5 마지막 문장 (line 101–102)
  > "`interact` 명령 제출은 응답 body 를 소비하지 않으므로(void) 언랩 비대상이다."
- **과거 결정 출처**: `spec/5-system/14-external-interaction-api.md` `## Rationale` §R16 "interact/cancel 의 202 Accepted + ack body (no-content 아님)"
  > "과거 spec 은 §5 서두에서 '예외 2: §5.1(interact)는 성공 시 202 Accepted + body 없음(no-content path)' 으로 기술했으나 이는 구현과 어긋난 표기였다. … 채택: §5.1 interact·§5.4 cancel 는 비동기 처리라 202 Accepted 로 응답하되 빈 body(no-content)가 아니라 ack body 를 반환한다 (InteractAckDto { executionId, accepted, currentStatus })."
  > 또한 EIA §5 전송 봉투 주석: "interact·cancel 는 다른 엔드포인트와 동일하게 { data: ... } 봉투로 래핑된다."
- **상세**: EIA R16 은 옛 "no-content" 전제를 명시적으로 기각하고, `interact` 가 `InteractAckDto` 를 `{ data }` 봉투에 실어 반환함을 확정했다. target §R5 는 이 결정 이후에도 "응답 body 를 소비하지 않으므로(void) 언랩 비대상"이라 기술함으로써 EIA R16 이 제거한 "no-content" 가정을 암묵적으로 재도입하고 있다. `interact` 응답은 현재 `{ data: { executionId, accepted, currentStatus } }` 형태이므로 "언랩 비대상"은 사실 부합하지 않는다. `interact` 클라이언트가 ack body 를 소비하지 않는 _현재 구현_ 을 정당화하기 위한 설명으로 추정되나, EIA R16 의 결정과 정면 모순된다.
- **제안**: §R5 의 해당 문장을 EIA R16 과 정합하도록 수정한다. 옵션 A: "interact 응답은 `InteractAckDto` `{ executionId, accepted, currentStatus }` 를 `{ data }` 봉투로 반환하나(EIA §R16), 위젯 현재 구현은 ack body 를 소비하지 않는다 — SSE 를 통해 상태를 별도 수신하므로. 언랩 유틸 적용 여부는 구현 선택이며 봉투 없는 픽스처로 unit test 격리는 그대로 유효하다." 옵션 B: EIA R16 을 cross-reference 로만 표기하고 "언랩 비대상(void)" 단정 문구를 제거한다.

---

### [INFO] §3 시퀀스 주석 "firstMessage 미동봉" 참조 위치 정합
- **target 위치**: `spec/7-channel-web-chat/3-auth-session.md` §3 step 1 (line 46)
  > `(인증 없음. firstMessage 미동봉 — [1-widget-app §R6](./1-widget-app.md))`
- **과거 결정 출처**: `spec/7-channel-web-chat/1-widget-app.md` `## Rationale` §R6 "워크플로우 시작 — 패널 open 시(eager) (vs 첫 입력 시 lazy)"
- **상세**: §R6 는 lazy 모델(firstMessage 동봉 패턴)을 기각하고 eager 모델로 전환하며 firstMessage 메커니즘을 폐기한 결정이다. target 이 이를 cross-reference 로 올바르게 참조하고 있어 충돌은 없다. 다만 "미동봉" 이유로 §R6 링크만 달고 있어, 독자가 링크를 따라가지 않으면 "왜 미동봉인지" 를 target 문서 안에서 알 수 없다. 보완 정도의 제안: "firstMessage 미동봉 — eager-start(§R6) 전환 시 폐기된 메커니즘" 처럼 1-2어 설명을 inline 으로 추가하면 자기완결성이 높아진다.

---

## 요약

`spec/7-channel-web-chat/3-auth-session.md` 의 Rationale 연속성은 전반적으로 양호하다. per_execution 단일 지원(§R3), 낙관적 refresh(§R4), sessionStorage 채택(§R6) 결정은 각각 EIA R4 / EIA §8.3 / 보안 원칙과 정합하며 기각된 대안(per_trigger, localStorage)도 명시적으로 배제 이유를 기술하고 있다. 다만 §R5 의 "`interact` 는 응답 body 를 소비하지 않으므로 언랩 비대상" 문장은 EIA R16 이 명시적으로 폐기한 "no-content path" 가정을 암묵적으로 재도입하는 구절이다. EIA R16 은 `interact` 가 `InteractAckDto` 를 `{ data }` 봉투에 실어 반환함을 확정했으므로, target 문장은 기각된 전제와 정합하지 않는다. 이 점을 수정하거나 EIA R16 을 명시 참조해 "위젯이 현재 ack body 를 소비하지 않는 이유" 를 별도로 기록할 필요가 있다. 그 외 INFO 수준으로 firstMessage 미동봉 인라인 설명 보완을 권장한다.

## 위험도

LOW
