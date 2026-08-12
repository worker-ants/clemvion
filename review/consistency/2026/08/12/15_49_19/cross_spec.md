# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-eia-r8-alignment.md`

## 검토 방법
prompt 번들은 컨텍스트 예산 초과로 대부분 파일(`5-system/4-execution-engine.md`,
`5-system/12-webhook.md`, `5-system/3-error-handling.md`, `5-system/6-websocket-protocol.md`,
`conventions/*` 등)이 절단돼 있어, 실제 worktree 파일시스템(`spec/**`, 실제 커밋된
`spec/data-flow/15-external-interaction.md` · `spec/5-system/14-external-interaction-api.md`
전문)을 직접 읽어 대조했다. target 의 diff 4건(변경 1~4)이 앵커로 삼는 현재 텍스트가
실제 파일과 문자 단위로 일치함을 확인했다.

## 발견사항

관련된 다른 spec 영역(§5.1 에러 표·§R13/§R14 코드 매핑·실행 엔진 §7.5.1/§7.5.2·
`3-error-handling.md`·`15-chat-channel.md` CCH-SE-02·`data-flow/3-execution.md` 등)을
전수 대조했으나 아래 관점에서 **직접 모순은 발견되지 않았다**.

- **데이터 모델·API 계약**: `spec/5-system/14-external-interaction-api.md` §5.1 에러 표(400
  `VALIDATION_ERROR`/`INVALID_COMMAND`/`MESSAGE_TOO_LONG`, 401 `TOKEN_*`, 403
  `TOKEN_REFRESH_FORBIDDEN`, 404 `EXECUTION_NOT_FOUND`, 409 `STATE_MISMATCH`/`IDEMPOTENCY_KEY_CONFLICT`,
  410 `EXECUTION_TERMINATED`, 429 `RATE_LIMITED`)와 §R13/§R14 매핑 원칙은 target 이 정합시키려는
  "2xx·409·410 캐시, `400 VALIDATION_ERROR` 만 제외"라는 §R8 서술과 어긋나지 않는다.
  `spec/5-system/3-error-handling.md` L165(`STATE_MISMATCH`↔`INVALID_STATE`/422↔`INVALID_EXECUTION_STATE`
  동형 서술)·L166(`IDEMPOTENCY_KEY_CONFLICT`/409)도 동일 값으로 정합.
- **요구사항 ID**: target 은 신규 ID 를 부여하지 않는다(기존 §R8/§R7 문단에 문장만 추가).
  `spec/7-channel-web-chat/3-auth-session.md` §R8("발급-origin 바인딩")과 로컬 앵커명이
  우연히 같지만, 각 문서 파일 스코프의 지역 번호라 전역 ID 충돌이 아니다(사전 존재, 본
  draft 무관).
- **다른 위치의 동일 서술 누락 여부**: `grep -rn "4xx" spec/**` 로 전수 확인한 결과, EIA
  idempotency 캐시 요약이 "2xx 캐시/4xx 제외" 식으로 반복되는 자리는 target 이 지목한
  정확히 두 곳(`data-flow/15-external-interaction.md` L98 시퀀스 다이어그램, L258 외부 의존
  표)뿐이었다 — 세 번째 미수정 자리는 없다.
- **계층 책임**: `spec/data-flow/15-external-interaction.md` Overview 가 스스로 "API 필드
  계약·페이로드 shape 의 단일 진실은 `spec/5-system/14-external-interaction-api.md`... 본
  문서는 '데이터가 어디서 생겨 어디로 흐르는가'만 다룬다"고 명시해, target 의 "SoT=5-system,
  data-flow=운영 카탈로그" 구분과 정확히 일치한다. 변경 2 에서 구현 갭 각주를 data-flow
  표에만 적는 target 의 선택은 이 기존 역할 분리와 합치한다.
- **RBAC/상태 전이**: target 은 권한 모델이나 execution 상태 머신을 건드리지 않는다
  (§R8 은 idempotency 캐시 대상 목록만 다룸). `4-execution-engine.md` §1.3(재검토 대상은
  실제로 절단돼 원문 미확인이나, §7.5.2/§R13 cross-ref 로 간접 확인한 "검증 실패 →
  waiting_for_input 유지" 컨벤션과 배치되지 않는다.

### [INFO] "닫힌 목록" 명시가 5-system 에만 추가되고 data-flow 표에는 반영되지 않음
- target 위치: 변경 2 (`spec/data-flow/15-external-interaction.md` §외부 의존 표, 현 L258) vs
  변경 4 (`spec/5-system/14-external-interaction-api.md` §R8 Rationale 보강)
- 충돌 대상: 같은 draft 내 두 변경 사이의 정보 비대칭 (엄밀히는 cross-spec 이 아니라
  intra-draft 이나, 두 파일이 서로 다른 spec 영역이라 여기 기록한다)
- 상세: 변경 4 는 "2xx·409·410 으로 열거한 것은 **닫힌 목록**"이라는 명시적 문장을
  `5-system/14` §R8 Rationale 에만 추가한다. 변경 2 이후의 data-flow 표 셀은 "`400
  VALIDATION_ERROR` 만 캐시 제외"라고만 쓰여 있어, 이 문구만 읽으면 (VALIDATION_ERROR 외
  나머지 4xx·401·403·404·429·5xx 는 전부 캐시된다는) 반대 해석이 여전히 가능하다 — 정확히
  target 의 "왜 지금 하나" 절이 `statusCode === 400` 오독의 위험으로 지목한 그 모호함과 같은
  종류다. data-flow 는 "SoT 아님·상호링크로 5-system 참조"가 전제이므로 실질 위험은 낮지만,
  data-flow 표 셀은 이미 매우 길어(변경 2 diff 참고) 닫힌 목록 문구를 그대로 옮기기엔
  부담이 있다는 점도 이해된다.
- 제안: 필수는 아님. 원한다면 data-flow 표 셀 끝에 "(닫힌 목록 — §R8 Rationale 참조)" 정도의
  6~8자 각주만 추가해 두 자리의 모호성 해소 수준을 맞출 수 있다. 없어도 CRITICAL/WARNING
  급 위험은 아니다 — data-flow 문서 자체가 "SoT 아님, 5-system 참조"를 Overview 에서 이미
  선언했으므로.

## 요약
target 은 `spec/data-flow/15-external-interaction.md` 두 자리(§1.2 시퀀스·§외부 의존 표)를
기존 SoT `spec/5-system/14-external-interaction-api.md` §R8 의 실제 텍스트("2xx·409·410
캐시, `400 VALIDATION_ERROR` 만 제외")에 맞추는 좁은 범위의 수정이며, §R8 자체에는 5xx
명확화 문장과 "닫힌 목록" 근거만 보강한다. 두 파일의 diff 앵커는 실제 파일 내용과 문자
단위로 일치했고, §5.1 에러 표·§R13/§R14 코드 매핑·`3-error-handling.md`·실행 엔진
§7.5.1/§7.5.2 등 관련된 다른 spec 영역과 대조한 결과 데이터 모델·API 계약·요구사항 ID·
상태 전이·RBAC·계층 책임 어느 관점에서도 새로운 모순은 발견되지 않았다. 유일한 관찰은
"닫힌 목록" 명시가 5-system 에만 추가돼 data-flow 표는 여전히 오독 여지를 조금 남긴다는
INFO 수준 지적뿐이다.

## 위험도
NONE
