# Cross-Spec 일관성 검토 결과

대상 문서: `spec/7-channel-web-chat/3-auth-session.md`

---

## 발견사항

- **[INFO]** SSE 엔드포인트 토큰 전달 방식 — 표기 정합
  - target 위치: §3 세션 시퀀스 step 3 — `GET .../:id/stream?token=iext_*`
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §8.3, §5.2 SSE 엔드포인트 정의
  - 상세: target 이 `?token=iext_*` 쿼리 파라미터로 토큰을 전달하는 방식을 사용하는데, EIA §8.3 은 "토큰을 query parameter 로 받는 것은 SSE 한정(`?token=` ; EventSource 가 헤더 미지원)" 이라고 명시하고 있다. 표기 형식(`?token=iext_*`)이 EIA §5.2 의 실제 wire format(`?token=<jwt>`)과 세부적으로는 다르게 읽힐 수 있으나, 의미는 동일하다. 이는 표기상의 차이일 뿐 실질 충돌 아님.
  - 제안: 동기화 불필요 (의미 일치). 단 표기를 `?token=<iext_jwt>` 로 통일하면 EIA §5.2 형식과 일관성이 높아진다.

- **[INFO]** 세션 시퀀스 step 4 — `interactionType` 종류 나열
  - target 위치: §3 세션 시퀀스 step 4 — `ai_conversation → 입력창 / buttons·carousel → 선택지 / form → 폼`
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §5.3, §5.2 (`interactionType: "form" | "buttons" | "ai_conversation" | null`)
  - 상세: target 은 `buttons·carousel → 선택지` 라고 병기하고 있다. EIA §5.3 의 `currentNode.interactionType` 는 `"form" | "buttons" | "ai_conversation" | null` 이므로 `carousel` 은 `interactionType` 값으로 독립 열거되지 않는다 — carousel 은 `buttons` 인터랙션 타입 아래 포함된다. 실질 충돌보다는 산문 간략화 표현이나, 오해 소지가 있다.
  - 제안: 큰 문제 없음. 필요시 `buttons(carousel 포함) → 선택지` 로 명확화 가능.

- **[INFO]** §3.1 재로드 복원 — `401` 대응 위치 참조
  - target 위치: §3.1 step 2, `401` 분기 — `EIA §8.3` 참조
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §8.3 (Token 일반 규약)
  - 상세: target 은 재로드 시 `GET /api/external/executions/:id` 상태 조회에서 `401` 이 올 수 있다고 기술한다. EIA §5.3 의 GET 엔드포인트 에러 표는 `401 TOKEN_*` 를 공통 열로 다루며 (§5.1 표가 모든 EIA 엔드포인트에 공통으로 적용), 상태 조회 엔드포인트도 `InteractionGuard` 를 통과하므로 `401` 반환은 사실이다. `EIA §8.3` 참조는 (jti blacklist 관련) 맥락상 적절하다. 모순 없음.
  - 제안: 없음.

- **[INFO]** `ai_message` 이벤트 + `presentations?` 표기
  - target 위치: §3 세션 시퀀스 step 6 — `SSE: execution.ai_message (+ presentations?) → 말풍선 렌더`
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §6.5, EIA §6.5 `execution.ai_message` 정의
  - 상세: EIA §6.5 에서 `execution.ai_message` 는 `presentations?: PresentationPayload[]` 필드를 조건부로 포함함을 명시하고 있다. target 의 `(+ presentations?)` 표기는 EIA 정의와 정합한다. 모순 없음.
  - 제안: 없음.

- **[INFO]** §R5 언랩 폴백 — `interact` 명령 비대상 표기
  - target 위치: §R5 Rationale — "`interact` 명령 제출은 응답 body 를 소비하지 않으므로(void) 언랩 비대상"
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §5.1 — `202 Accepted` + `InteractAckDto { executionId, accepted, currentStatus }` 반환, `{ "data": { ... } }` 래핑 명시
  - 상세: EIA §5.1 및 §5.2 전송 봉투 주석은 `interact` 명령이 `202 Accepted` 응답에 `{ "data": { executionId, accepted, currentStatus } }` 형식의 body 를 반환함을 명시한다. target 의 "void" 기술은 실제 스펙과 다르다 — 위젯 구현이 `interact` 응답 body 를 소비하지 않는다는 구현 선택이지만, "응답 body 를 소비하지 않으므로(void) 언랩 비대상" 표현이 EIA spec 에서 body 가 없다는 의미로 오독될 수 있다.
  - 제안: "위젯 `eia-client` 는 `interact` 명령의 응답 body 를 소비하지 않으므로 언랩 처리를 하지 않는다(no-op)" 정도로 수정하면 EIA §5.1 과 표현 충돌이 없어진다.

---

## 요약

`spec/7-channel-web-chat/3-auth-session.md` 는 참조하는 핵심 cross-spec 영역(EIA §4·§5·§7·§8, Webhook §3.2, 보안 §3·§4, SDK §4, widget-app §R6)과 전반적으로 일관되게 기술되어 있다. 데이터 모델(`ExecutionToken`, `auth_config_id IS NULL` 모델, `iext_*`/`itk_*` 토큰 분리), API 계약(202 응답 shape, GET 상태 조회 `200 OK` + status enum, refresh-token 엔드포인트, 410 Gone 의미), 상태 전이(per_execution jti blacklist 즉시 invalidate, 낙관적 refresh 1회 정책), 권한 모델(per_execution 단일 지원, per_trigger 미노출), 계층 책임(iframe-origin sessionStorage 위젯 전담, EIA spec 이 서버 측 SoT) 모두 직접 모순이 없다. 유일하게 주의가 필요한 부분은 §R5 에서 `interact` 명령을 "void" 로 기술한 것으로, EIA §5.1 이 `202 Accepted` body(`InteractAckDto`)를 명시하므로 표현 정확도를 위해 수정이 권장된다.

---

## 위험도

LOW
