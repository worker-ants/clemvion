# Cross-Spec 일관성 검토 — `spec/7-channel-web-chat/3-auth-session.md`

## 검토 방법 메모

번들(`_prompts/cross_spec.md`)의 `related_specs` 첨부는 컨텍스트 예산 초과로 target 문서·`2-sdk.md`·`0-overview.md` 를
제외한 대부분이 절단돼 있었다(`spec/1-data-model.md`, `spec/2-navigation/**`, `spec/5-system/**` 등 전량 "본문 생략됨"
placeholder). 이를 보완하기 위해 target 이 실제로 인용하는 다른 영역 spec 원본을 로컬 파일시스템에서 직접 Read 했다 —
`spec/5-system/14-external-interaction-api.md`(EIA, 전체) · `spec/5-system/12-webhook.md`(WH-SC-01/§3.1/§3.2 부분) ·
`spec/7-channel-web-chat/1-widget-app.md`(전체) · `spec/7-channel-web-chat/4-security.md`(전체) ·
`spec/7-channel-web-chat/5-admin-console.md`(locale 관련 발췌) · `spec/5-system/15-chat-channel.md`(languageLocale 발췌) ·
`spec/1-data-model.md`(Workspace.settings.interactionAllowedOrigins 발췌). 아래 결과는 이 실측 대조에 기반한다.

## 발견사항

없음 — target 문서가 인용하는 다른 영역 spec 과의 직접 모순을 찾지 못했다. 확인한 교차 지점은 다음과 같다(전부 정합):

- **EIA §4.1 webhook 202 응답**: target §2·§3(2단계) 의 `interaction.token`(`iext_*`) 동봉 서술이
  `spec/5-system/14-external-interaction-api.md` §4.1 의 실제 응답 shape·조건(`interaction.enabled=true` && `tokenStrategy=per_execution`)과 일치.
- **EIA-AU-04/AU-05/§8.3 jti blacklist**: target §3.1-2(`401` 분기)·R4 의 "만료 vs blacklist 구분 불가 → 낙관적 refresh 1회" 서술이
  EIA-AU-04(종료 시 즉시 invalidate)·EIA-AU-05(만료 30분 이내 + alive 시 refresh 가능)·§8.3(jti Redis blacklist) 과 정합.
- **EIA §5.3 단발 상태 조회**: target §3.1-2 의 "종료된 execution 도 `200 OK` + `status` 로 응답" · `context.conversationThread`
  durable 스냅샷 동봉 서술이 EIA §5.3 본문·R17 과 일치. `seq` 항상 `0` placeholder 서술도 일치.
- **EIA-IN-12 / 410 Gone 은 명령 전용**: target §3.1-2 의 "EIA-IN-12 의 `410 Gone` 은 *명령*(interact)에 대한 응답 전용이라
  상태 조회에는 나타나지 않는다" 는 EIA §3.2 EIA-IN-12(종료된 execution 에 대한 **명령**은 410) 표기와 정확히 일치 — `GET` 단발
  조회(§5.3)에는 410 분기가 없음을 재확인.
- **R5 (`{ data }` 언랩)**: target 의 전역 `TransformInterceptor` 봉투·SSE 프레임 예외 서술이 EIA §4.1·§5 전송 봉투 콜아웃 및
  `spec/5-system/12-webhook.md` §3.1(`202 Accepted` 응답의 동일 `TransformInterceptor` 래핑) 과 일치. `interact`(`202`)의
  ack body(`InteractAckDto {executionId, accepted, currentStatus}`) — target 이 "위젯은 그 ack body 를 소비하지 않는다"고
  명시한 부분도 EIA §5.1/§5.4/R16 의 DTO 정의와 모순 없음(단지 소비 여부의 차이이며 EIA 계약을 어기지 않음).
- **§1 webhook 인증 없음(`auth_config_id IS NULL`)**: target 의 WH-SC-01 인용이 `spec/5-system/12-webhook.md` §3.2/§6/Rationale
  의 실제 서술(비밀은 `endpointPath` UUID, 남용 방어는 rate-limit)과 일치.
- **§R6 sessionStorage / §R8 apiBase 바인딩**: `spec/7-channel-web-chat/4-security.md` §1("저장 세션의 발급-origin 바인딩")과
  §1("토큰 노출" 행)이 target §R6·§R8 을 그대로 인용·재확인하며 반대 방향 서술이 없음(양방향 참조 정합).
- **§3 step 0 embed-config**: target 의 `GET /api/hooks/:path/embed-config` + fail-open 서술이
  `spec/7-channel-web-chat/4-security.md` §3-① 의 절차(soft 검증·enforce=false 시 통과·host origin 미탐지 시 fail-open)와
  필드명(`allowlist`, `enforce`)까지 일치.
- **1-widget-app.md와의 상태 전이 정합**: target §3.1 표(토큰 만료/새로고침 분기)가 `1-widget-app.md` §3.1 표의 대응 행("토큰
  만료/서버 타임아웃", "페이지 새로고침/이동")과 동일한 EIA 참조·귀결 상태(`[ended]`)로 일치. R7(표면 되감기 방어)의 "세션
  확립 여부" 축도 `1-widget-app.md` R9(single-flight coalesce·B-1 cancel)의 서술과 상충 없음(같은 영역 내 R7/R9 는 서로
  다른 결함 축 — 스트림 소유권 vs 서버측 execution 잔존 — 을 다뤄 중복이 아님).
- **`locale` 필드의 이중 소유권 없음**: target 은 `locale` 을 직접 정의하지 않고 `2-sdk.md`/`1-widget-app.md` 로 위임한다.
  `2-sdk.md §4` 의 `locale`(위젯 UI 렌더 언어)과 `spec/5-system/15-chat-channel.md §4.1` 의 `languageLocale`(서버 발신
  메시지 언어)은 이름이 유사하지만 target·SDK 양쪽 모두 "별개" 라고 명시적으로 구분해 명명 충돌 소지를 이미 차단해 뒀다(INFO
  수준 잠재 혼동이나 이미 문서화된 안전장치가 있어 별도 발견사항으로 올리지 않음).
- **요구사항 ID 네임스페이스**: target 문서는 자체 요구사항 ID 를 신설하지 않고(§R3~§R8 은 Rationale 섹션 번호이지 전역
  요구사항 ID 가 아님) EIA(`EIA-*`)·Webhook(`WH-*`) 의 기존 ID 를 참조만 한다 — ID 충돌 위험 없음.
- **RBAC/권한 모델**: target 은 공개(무인증) 위젯 세션에 대한 문서라 워크스페이스 RBAC(Editor/Admin 등)를 다루지 않으며,
  참조하는 유일한 권한 지점(`4-security.md` 의 워크스페이스 설정 편집 Admin+)도 자체 재정의 없이 위임만 하므로 모순 없음.
- **계층 책임**: 위젯(client) ↔ backend(EIA) 책임 분할 — 위젯은 토큰 보관/복원/refresh 트리거만 하고 서버측 revoke·jti
  blacklist·idle-wait reaper 는 EIA/backend 책임으로 명확히 위임되어 있어 기존 결정(EIA §3.3.1 in-process trusted caller
  분리, EIA-RL-06/07)과 층위 혼동이 없다.

## 요약

target 문서(`3-auth-session.md`)가 인용하는 EIA(`14-external-interaction-api.md`)·Webhook(`12-webhook.md`)·같은 영역의
`1-widget-app.md`·`2-sdk.md`·`4-security.md`·`5-admin-console.md`·`15-chat-channel.md` 원본을 직접 대조한 결과, API
계약(엔드포인트 shape·에러 코드·봉투 언랩)·상태 전이(토큰 만료/재로드/종료 분기)·데이터 모델(Workspace.settings 키)·
요구사항 ID 네임스페이스·권한 모델·계층 책임 분할 어느 관점에서도 직접적 모순을 찾지 못했다. target 은 인용 대상 spec 의
최신 상태(예: EIA §5.4 `cancel` ack shape 정정, `4-security.md` R6 완화 버킷 정책)를 정확히 반영하고 있으며, 상호 참조가
양방향으로 일관된다. 다만 이번 검토는 예산 절단으로 `related_specs` 번들이 사실상 무효했던 부분을 로컬 파일 직접 조회로
보완한 것이라, 번들 자체의 예산 정책(대량 spec 트리에서 자주 발생하는 절단)은 별도 harness 이슈로 남을 수 있다(본 검토
범위 밖).

## 위험도

NONE
