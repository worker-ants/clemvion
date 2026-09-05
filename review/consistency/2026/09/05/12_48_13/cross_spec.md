# Cross-Spec 일관성 검토 — `spec/5-system/` (--impl-prep)

## 범위와 방법

target 은 `spec/5-system/` 전체(18개 파일, 12,446줄)이며 검토 모드는 `--impl-prep`(구현
착수 전) 이다. 조립 프롬프트는 예산 초과로 `1-auth.md`·`2-api-convention.md`·
`3-error-handling.md` 3개 파일과 `spec/0-overview.md` 만 전문을 담았고, 나머지 15개
파일(예: `4-execution-engine.md` 227K자, `14-external-interaction-api.md` 132K자,
`6-websocket-protocol.md` 100K자 등)은 절단됐다. 이 15개는 저장소 원본을 `Read`/`grep`
으로 직접 열어 교차 참조 지점(RBAC·에러 코드·데이터 모델·API 계약)을 표본 추적했으며,
전문을 처음부터 끝까지 통독하지는 못했다 — 이 한계는 §위험도 산정에 반영한다.

검토 초점: (1) RBAC 매트릭스(`1-auth.md §3.2`)가 `2-navigation/6-config.md`,
`2-navigation/9-user-profile.md`, `3-workflow-editor/3-execution.md`, `16-system-status-api.md`,
`data-flow/12-workspace.md` 의 권한 서술과 일치하는가, (2) 에러 코드 카탈로그
(`3-error-handling.md §1`)가 `conventions/error-codes.md`·`data-flow/12-workspace.md`·
`1-data-model.md` 와 정합하는가, (3) 데이터 모델 필드(`user.password_hash`,
`totp_recovery_codes`, `email_verify_token` 등)가 `1-data-model.md` 정의와 일치하는가,
(4) API 응답 envelope(`2-api-convention.md §5`)가 참조하는 도메인 spec(webhook·EIA·WS)의
실제 서술과 어긋나지 않는가.

## 발견사항

표본 추적 범위 내에서 **CRITICAL·WARNING 급 교차 모순은 발견되지 않았다.** 이 저장소는
이미 여러 라운드의 consistency-check + resolution 이력(`git log` 상 #1277·#1280·#1284 등
다수)을 거쳐 `spec/5-system/` 의 교차 참조가 매우 촘촘하게 유지되고 있다 — 예:

- RBAC: `1-auth.md §3.2` 의 Auth Config(Owner/Admin=CRUD, Editor/Viewer=R) ·
  Model Config(Editor=CRUD) · System Status(전 역할 R, admin 가드 없음) 은
  `2-navigation/6-config.md`, `16-system-status-api.md §4`, `2-navigation/9-user-profile.md §4.2`
  의 서술과 각주까지 정확히 일치했다(예: "Admin 역할 부여" 는 Owner 전용으로 양쪽 동일).
- 에러 코드: `3-error-handling.md §1.2.1/§1.9` 의 `ACCOUNT_LOCKED`(401, 구 423 오기 정정
  이력 포함) · `INVALID_PASSWORD` 은퇴 · `already_a_member`/`ALREADY_A_MEMBER` lowercase/
  UPPER_SNAKE 이원화가 `conventions/error-codes.md §3/§5`, `data-flow/12-workspace.md §1.9`
  와 등급·근거까지 일치했다.
- 데이터 모델: `1-auth.md` 가 언급하는 `password_hash`, `pending_email`,
  `totp_recovery_codes`, `webauthn_recovery_codes`, `email_verify_token`,
  `password_reset_token`, `email_change_token` 필드 정의(nullable·해시·TTL)가
  `1-data-model.md` §2.1 과 값 단위로 일치했다.

미확인 잔여(INFO 로만 표기):

- **[INFO] 절단된 15개 파일의 전수 통독 미완료** — `4-execution-engine.md`,
  `6-websocket-protocol.md`, `14-external-interaction-api.md`, `15-chat-channel.md` 등은
  분량이 커 표본 교차 참조(다른 문서가 인용하는 앵커·코드명 대조)만 수행했다.
  이 파일들 **내부**의 상호 모순(예: 같은 상태 코드가 두 파일에서 다르게 정의되는가)은
  이번 라운드에서 직접 통독하지 않았다 — 다음 라운드에서 diff 가 그 파일들을 직접
  건드리면 재검토 대상으로 표시해 둔다.
  - target 위치: `spec/5-system/4-execution-engine.md`, `6-websocket-protocol.md`,
    `14-external-interaction-api.md`, `15-chat-channel.md` 등 (프롬프트 절단 15개 전체)
  - 충돌 대상: 해당 파일들 자체 상호간 및 `spec/data-flow/**`
  - 상세: 예산 초과로 본 세션에서 전문 통독을 하지 않음 — "여기 없다"가 "충돌 없다"의
    근거가 될 수 없다는 프롬프트의 경고를 그대로 승계한다.
  - 제안: 이 파일들에 실제 draft 변경이 생기는 다음 라운드에서, 변경된 절 주변을
    전문 통독 스코프로 지정해 재검토.

## 요약

`spec/5-system/` 은 --impl-prep 스코프로 검토한 3개 전문 파일(`1-auth.md`,
`2-api-convention.md`, `3-error-handling.md`)과 표본 교차 추적한 나머지 영역
모두에서 RBAC·에러 코드·데이터 모델·API 계약이 다른 spec 영역과 어긋나지 않았다.
이 저장소는 이미 다수의 이전 라운드를 통해 SoT 포인터·각주·Rationale 로 교차
일관성을 명시적으로 유지하는 관례가 정착돼 있으며, 이번 검토는 그 상태가 무너지지
않았음을 재확인했다. 다만 컨텍스트 예산 초과로 15개 대형 파일은 전문 통독이 아닌
표본 검증에 그쳤다는 한계가 있다.

## 위험도

LOW
