---
id: "CLE-INT-STATUS"
title: "통합 상태와 만료 알림"
type: "feature"
version: 10
status: "approved"
requirements: ["REQ-INTSTAT-001", "REQ-INTSTAT-002", "REQ-INTSTAT-003", "REQ-INTSTAT-004", "REQ-INTSTAT-005", "REQ-INTSTAT-006", "REQ-INTSTAT-007", "REQ-INTSTAT-008", "REQ-INTSTAT-009", "REQ-INTSTAT-010", "REQ-INTSTAT-011", "REQ-INTSTAT-012", "REQ-INTSTAT-013", "REQ-INTSTAT-014", "REQ-INTSTAT-015", "REQ-INTSTAT-016", "REQ-INTSTAT-017", "REQ-INTSTAT-018", "REQ-INTSTAT-019", "REQ-INTSTAT-020", "REQ-INTSTAT-021", "REQ-INTSTAT-022", "REQ-INTSTAT-023", "REQ-INTSTAT-024", "REQ-INTSTAT-025", "REQ-INTSTAT-026", "REQ-INTSTAT-027", "REQ-INTSTAT-028", "REQ-INTSTAT-029", "REQ-INTSTAT-030", "REQ-INTSTAT-031", "REQ-INTSTAT-032", "REQ-INTSTAT-033", "REQ-INTSTAT-034", "REQ-INTSTAT-035", "REQ-INTSTAT-036", "REQ-INTSTAT-037", "REQ-INTSTAT-038", "REQ-INTSTAT-039", "REQ-INTSTAT-040"]
basis_superseded: false
parent: "CLE-INT"
ancestors: ["CLE-VISION", "CLE-INT"]
area: "CLE-INT"
content_hash: "95015b750ad588e7f052a3c5b77fdf15b4ec3ba7fc2529a47a9903a688bbb608"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: ["spec/2-navigation/4-integration.md", "spec/2-navigation/_product-overview.md", "spec/4-nodes/4-integration/_product-overview.md", "spec/data-flow/5-integration.md"]
mirror_sha256: "a0dc3a376fde477596dd3f89164a46699d457fa614e48684e1fad764800e5f35"
etag: "sha256-f7524dc30c40220daae06b0ebf676665b7e9d879e63fd528b49c95be4efeac30"
---
> 구현 상태: 부분 구현 · 원문: `spec/2-navigation/4-integration.md` (§2.2~§2.4 상태 표시·주의 필요, §6, §11, 관련 Rationale), `spec/data-flow/5-integration.md` (§1.4, §3), `spec/4-nodes/4-integration/_product-overview.md` (§2.3, INT-AU-07), `spec/2-navigation/_product-overview.md` (NAV-IN-05) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

이 문서는 통합(Integration, `integration`)의 상태가 어떻게 바뀌고, 화면에 어떻게 보이며, 만료를 누가 언제 점검해 어떤 인앱 알림을 보내는지를 정한다. 통합 상태(`Integration.status`)는 연결됨(`connected`)·만료됨(`expired`)·오류(`error`)·설치 대기(`pending_install`) 네 값이고, 상태 사유(`status_reason`)가 그 이유를 기계가 읽을 수 있는 코드로 남긴다.

다루는 것:

- 상태 값과 상태 사유, 상태 전이 규칙
- Cafe24 Private 재설치 대기 표시와 상태의 관계
- 목록·상세·사이드바의 상태 표시와 «주의 필요» 판정(가상 필터 `expiring`·`attention`)
- 만료 스캐너(`integration-expiry-scanner`)의 네 작업
- 만료 알림(`integration_expired`)과 조치 필요 알림(`integration_action_required`)

범위 밖(이 문서가 정하지 않는 것):

- 통합 화면 전체와 관리 API 는 [통합 관리](CLE-INT-MANAGE.md) 가 정한다.
- 토큰 갱신 경로(호출 직전 갱신, 401 뒤 갱신, 갱신 큐)와 OAuth 콜백 에러 매핑은 [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md) 이 정한다.
- 컬럼 정의와 테이블 흐름은 [통합 데이터와 흐름](CLE-INT-DATA.md) 이 정한다.
- 인앱 알림의 공통 저장·채널 계산·중복 방지 헬퍼, 알림 설정 화면은 [알림](../CLE-OBS/CLE-OBS-NOTIFY.md) 이 정한다.

## 요구사항

- REQ-INTSTAT-001 WHEN 통합을 저장하면 THE SYSTEM SHALL 통합 상태를 `connected`·`expired`·`error`·`pending_install` 네 값 중 하나로 둔다. (원본: INT-ST-01)
- REQ-INTSTAT-002 WHEN 통합 상태가 `error`·`expired`·`pending_install` 로 바뀌면 THE SYSTEM SHALL 이유를 snake_case 상태 사유로 함께 기록한다. (원본: INT-ST-01)
- REQ-INTSTAT-003 IF 기록하려는 상태 사유가 허용 union 밖의 값이면 THE SYSTEM SHALL 그 값을 `unknown_error` 로 바꿔 저장한다. (원본: INT-ST-01)
- REQ-INTSTAT-004 WHEN 설치 대기 통합의 설치 콜백이 성공하면 THE SYSTEM SHALL 상태를 `connected` 로 바꾸고 설치 토큰을 보존한다.
- REQ-INTSTAT-005 WHEN 설치 대기 통합이 설치 토큰 발급 뒤 24시간 안에 연결되지 않으면 THE SYSTEM SHALL 상태를 `expired`, 사유를 `install_timeout` 으로 바꾸고 설치 토큰을 지운다.
- REQ-INTSTAT-006 IF 설치 대기 통합의 OAuth 콜백 처리가 실패하면 THE SYSTEM SHALL 상태와 설치 토큰을 보존하고 `status_reason` 과 `last_error` 만 갱신한다.
- REQ-INTSTAT-007 WHEN refresh token 자체가 무효(`invalid_grant`)라 토큰 갱신이 실패하면 THE SYSTEM SHALL 상태를 `error`, 사유를 `auth_failed` 로 바꾼다.
- REQ-INTSTAT-008 WHEN 노드 실행이나 토큰 갱신 중 transport 실패가 3회 연속 나면 THE SYSTEM SHALL 상태를 `error`, 사유를 `network` 로 바꾸고 연속 실패 카운터를 0 으로 되돌린다.
- REQ-INTSTAT-009 WHEN 노드 실행 중 403 과 서비스별 권한 부족 신호를 받으면 THE SYSTEM SHALL 상태를 `error`, 사유를 `insufficient_scope` 로 바꾼다. (원본: INT-AU-07) (부분 구현)
- REQ-INTSTAT-010 WHEN 통합 사유가 `insufficient_scope` 이면 THE SYSTEM SHALL 상세 화면에 누락 권한 범위 배지와 추가 권한 요청 동작을 보인다. (원본: INT-AU-07)
- REQ-INTSTAT-011 WHEN 외부 MCP 서버 호출이 인증 실패로 끝나면 THE SYSTEM SHALL 상태를 `error`, 사유를 `auth_failed` 로 바꾼다.
- REQ-INTSTAT-012 WHEN 통합 재인증이나 자격 증명 교체가 성공하면 THE SYSTEM SHALL `expired`·`error` 통합을 `connected` 로 되돌린다.
- REQ-INTSTAT-013 WHEN OAuth 가 아닌 통합에 통합 재인증을 요청하면 THE SYSTEM SHALL OAuth 왕복 없이 바로 `connected` 로 되돌린다.
- REQ-INTSTAT-014 IF 사용자가 삭제 동작을 하지 않았으면 THE SYSTEM SHALL 통합을 자동으로 삭제하지 않는다. 개인 통합의 통합 소유자가 워크스페이스를 나가거나 제거될 때 그 개인 통합을 지우는 것(REQ-INTMGMT-065)은 예외다.
- REQ-INTSTAT-015 WHILE 통합이 `connected` 가 아닌 동안 THE SYSTEM SHALL 그 통합을 쓰는 통합 노드를 외부 호출 없이 `INTEGRATION_NOT_CONNECTED` 로 에러 포트에 보낸다.
- REQ-INTSTAT-016 WHILE 통합이 `connected` 가 아닌 동안 THE SYSTEM SHALL AI 에이전트에 그 통합의 MCP 도구를 노출하지 않는다.
- REQ-INTSTAT-017 WHEN 사용자가 통합 목록이나 상세를 보면 THE SYSTEM SHALL 연결됨·만료 임박·만료됨·오류·설치 대기 상태를 아이콘과 문구로 표시한다. (원본: NAV-IN-05)
- REQ-INTSTAT-018 WHILE 자동 갱신 표시(`autoRefresh`)가 true 인 통합이 `connected` 인 동안 THE SYSTEM SHALL 만료가 가까워도 `Connected` 를 유지하고 `Auto-renews` 보조 라벨을 보인다.
- REQ-INTSTAT-019 WHEN 주의 필요를 판정하면 THE SYSTEM SHALL 만료됨·오류와, 자동 갱신 표시가 false 이며 7일 안에 만료되는 연결됨 통합을 합치고 설치 대기는 뺀다.
- REQ-INTSTAT-020 WHEN 주의 필요 통합이 있으면 THE SYSTEM SHALL 사이드바 통합 메뉴에 개수 배지를 보이고 목록 카드와 상세 헤더에 상태 배지를 보인다. (원본: INT-ST-03)
- REQ-INTSTAT-021 WHEN 사용자가 주의 필요 배너를 누르면 THE SYSTEM SHALL 합계가 2건 이상이면 주의 필요 필터로, 1건이면 그 통합 상세로 이동한다.
- REQ-INTSTAT-022 WHEN 만료 스캐너 주기가 되면 THE SYSTEM SHALL `connected-expiry`·`pending-install-ttl`·`usage-log-prune`·`cafe24-background-refresh` 네 작업을 서로 독립된 BullMQ 작업으로 실행한다. (원본: INT-ST-02)
- REQ-INTSTAT-023 IF 만료 스캐너 작업 하나가 실패하면 THE SYSTEM SHALL 그 작업만 최대 3회 다시 시도하고 다른 작업 실행을 막지 않는다.
- REQ-INTSTAT-024 WHEN refresh token 이 없는 통합이 토큰 만료 7일·3일·당일 임계에 닿으면 THE SYSTEM SHALL 같은 만료 시각의 임계마다 한 번 만료 알림을 보낸다. (원본: INT-ST-02, INT-ST-04)
- REQ-INTSTAT-025 WHEN refresh token 이 없는 통합의 토큰 만료 시각이 지나면 THE SYSTEM SHALL 상태를 `expired`, 사유를 `token_expired` 로 바꾼다. (원본: INT-ST-02)
- REQ-INTSTAT-026 IF 통합이 갱신 가능 통합(`isRefreshCapable`)이면 THE SYSTEM SHALL 토큰 만료 임계에서 상태를 낮추지 않고 만료 알림도 보내지 않는다.
- REQ-INTSTAT-027 WHEN 갱신 가능한 Cafe24 통합이 토큰 만료 당일 임계에 닿으면 THE SYSTEM SHALL `cafe24-token-refresh` 큐에 갱신 작업을 넣는다.
- REQ-INTSTAT-028 WHEN `cafe24-background-refresh` 작업이 6시간마다 돌면 THE SYSTEM SHALL 마지막 갱신이 7일 넘었거나 없는 연결됨 Cafe24 통합을 `cafe24-token-refresh` 큐에 넣는다. (원본: INT-ST-02)
- REQ-INTSTAT-029 WHEN `usage-log-prune` 작업이 돌면 THE SYSTEM SHALL 90일이 지난 활동 로그를 지운다. (원본: INT-ST-02)
- REQ-INTSTAT-030 WHEN 통합이 `error` 로 바뀌면 THE SYSTEM SHALL 전이가 일어난 그 자리에서 조치 필요 알림을 보낸다.
- REQ-INTSTAT-031 WHEN 만료 알림이나 조치 필요 알림을 보내면 THE SYSTEM SHALL 개인 통합은 통합 소유자에게, 조직 통합은 관리자 전원에게 보낸다.
- REQ-INTSTAT-032 WHEN 수신자가 통합 이메일 알림(`integrationExpiryEmail`)을 켰으면 THE SYSTEM SHALL 만료 알림과 조치 필요 알림을 인앱과 이메일로 함께 보낸다. (원본: INT-ST-04)
- REQ-INTSTAT-033 IF 설치 대기 통합이 `install_timeout` 으로 만료되면 THE SYSTEM SHALL 인앱 알림을 보내지 않는다.
- REQ-INTSTAT-034 WHEN 통합 재인증이 실패하면 THE SYSTEM SHALL `Reauthorization failed` 알림을 보낸다. (원본: INT-ST-04) (미구현)
- REQ-INTSTAT-035 WHEN 통합 재인증이나 추가 권한 요청이 재설치 대기 표시를 남기면 THE SYSTEM SHALL 통합 상태와 상태 사유를 그대로 둔다.
- REQ-INTSTAT-036 WHILE 통합에 재설치 대기 표시가 있는 동안 THE SYSTEM SHALL 콜백 성공이나 통합 삭제 전에는 표시를 지우지 않는다.
- REQ-INTSTAT-037 WHEN 만료 스캐너·주의 필요 술어·알림이 통합을 판정하면 THE SYSTEM SHALL 재설치 대기 표시를 판정에 쓰지 않는다.
- REQ-INTSTAT-038 IF MakeShop 통합이 오류나 만료됨이 되면 THE SYSTEM SHALL 통합 재인증 없이 같은 상점을 새로 등록하는 것을 복구 경로로 안내한다. 설치 기한이 지나 만료된 행(`install_timeout`)은 상점 자리를 놓았으므로 지우지 않고 새로 등록하라고 안내하고 그 밖의 행은 삭제한 뒤 다시 등록하라고 안내한다.
- REQ-INTSTAT-039 WHEN 재설치 대기 표시를 남긴 시각부터 24시간이 지나면 THE SYSTEM SHALL 그 표시를 없는 것으로 판정한다.
- REQ-INTSTAT-040 WHEN 설치 대기 통합이 `install_timeout` 으로 만료되면 THE SYSTEM SHALL 같은 갱신에서 상점 식별자(`mall_id`)를 비운다. `credentials` 안의 상점 값은 그대로 둔다.

## 하위 문서

- [통합 상태와 만료 알림 — 상태 모델](CLE-INT-STATUS-MODEL.md): 상태 값과 상태 사유, 상태 전이, 재설치 대기 표시와 상태의 관계, 콜백 실패 기록 규칙. 요구사항 REQ-INTSTAT-001~016, 035~040. 상태 전이 표의 «모든 상태 → 삭제» 행은 REQ-INTMGMT-065 를 따른다. 「설치 대기는 24시간 뒤 만료된다」 의 설치 대기 행 재사용 근거는 REQ-INTOAUTH-012·058~061 이다.
- [통합 상태와 만료 알림 — 화면 표시와 주의 필요](CLE-INT-STATUS-DISPLAY.md): 목록 · 상세 상태 표시, 주의 필요 판정(`expiring`·`attention`), 주의 필요 배너, 사이드바 배지. 요구사항 REQ-INTSTAT-017~021. 주의 필요 술어가 재설치 대기 표시를 보지 않는 규칙(REQ-INTSTAT-037)은 상태 모델이 정하고 여기서 적용한다.
- [통합 상태와 만료 알림 — 만료 스캐너와 알림](CLE-INT-STATUS-SCAN.md): 만료 스캐너 네 작업, `connected-expiry` 흐름, 만료 알림 · 조치 필요 알림의 문구 · 수신자 · 채널. 요구사항 REQ-INTSTAT-022~034. 스캐너와 알림도 REQ-INTSTAT-037 을 적용한다. 「채널과 이메일」 의 «통합 소유자가 떠난 개인 통합은 노드에서 쓸 수 없다» 는 REQ-INTMGMT-058 이다.

## 상태 값과 상태 사유

→ [통합 상태와 만료 알림 — 상태 모델](CLE-INT-STATUS-MODEL.md#상태-값과-상태-사유)

## 상태 전이

→ [통합 상태와 만료 알림 — 상태 모델](CLE-INT-STATUS-MODEL.md#상태-전이)

## 재설치 대기 표시

→ [통합 상태와 만료 알림 — 상태 모델](CLE-INT-STATUS-MODEL.md#재설치-대기-표시)

## 목록과 상세의 상태 표시

→ [통합 상태와 만료 알림 — 화면 표시와 주의 필요](CLE-INT-STATUS-DISPLAY.md#목록과-상세의-상태-표시)

## 주의 필요 판정

→ [통합 상태와 만료 알림 — 화면 표시와 주의 필요](CLE-INT-STATUS-DISPLAY.md#주의-필요-판정)

## 주의 필요 배너

→ [통합 상태와 만료 알림 — 화면 표시와 주의 필요](CLE-INT-STATUS-DISPLAY.md#주의-필요-배너)

## 사이드바 배지

→ [통합 상태와 만료 알림 — 화면 표시와 주의 필요](CLE-INT-STATUS-DISPLAY.md#사이드바-배지)

## 만료 스캐너

→ [통합 상태와 만료 알림 — 만료 스캐너와 알림](CLE-INT-STATUS-SCAN.md#만료-스캐너)

## 알림

→ [통합 상태와 만료 알림 — 만료 스캐너와 알림](CLE-INT-STATUS-SCAN.md#알림)

## 미결 사항

- **새로 등록한 뒤에도 주의 필요에 남는 설치 기한 만료 행**: 2026-10-30(NERV Task `CLE-T-395HK2`)부터 화면은 설치 기한이 지나 만료된 행(`install_timeout`)을 지우지 않고 같은 상점을 새로 등록하라고 안내한다. 그래서 새 통합이 연결된 뒤에도 만료 행이 지울 때까지 주의 필요에 남는다. 지금은 사용자가 지우면 빠진다. 배경은 [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md#만료된-설치-대기-행은-상점-자리를-놓는다-2026-10-29) 의 2026-10-30 번복이다. 자동 삭제는 REQ-INTSTAT-014 의 예외와 [설치 대기는 24시간 뒤 만료된다](CLE-INT-STATUS-MODEL.md#설치-대기는-24시간-뒤-만료된다) 의 만료 행 보존 결정을 바꾸는 일이다. 같은 상점의 새 통합이 연결되면 만료 행을 주의 필요에서 뺄지 자동으로 지울지 결정이 필요하다.
- **노드 실행 중 401·403 이 통합 상태를 바꾸는 범위**: 통합 화면 정의는 노드 실행 중 401 을 받으면 Cafe24 는 토큰 갱신과 1회 재시도 뒤에도 401 일 때, 그 밖의 서비스는 즉시 `error(auth_failed)` 로 바꾸고, 403 은 즉시 바꾼다고 적는다. 같은 정의의 노드 실행 연동 절은 핸들러 실패 때 `Integration.status`·`last_error` 가 함께 갱신된다고 적는다. 데이터 흐름 정의는 `logUsage` 가 `last_error` 만 갱신하고 상태는 외부 MCP 서버 `AUTH_FAILED` 일 때만 바꾸며, Cafe24·MakeShop 은 각 클라이언트의 `markAuthFailed` 가 바꾼다고 적는다. [HTTP Request 노드](../CLE-NODE-INT/CLE-NODE-HTTP.md)·[Database Query 노드](../CLE-NODE-INT/CLE-NODE-DBQUERY.md)·[Send Email 노드](../CLE-NODE-INT/CLE-NODE-EMAIL.md) 는 상태 전이를 언급하지 않는다. 현재 구현(`integrations.service.ts`)은 데이터 흐름 정의와 같다. 화면 정의대로 구현하면 HTTP·Database·SMTP 노드의 401 한 번으로 통합이 오류가 되어 이후 모든 실행이 `INTEGRATION_NOT_CONNECTED` 로 막힌다. 일반 서비스의 401·403 격하를 제품 요구로 둘지 결정이 필요하다.
- **`expired` 가 된 Cafe24 통합의 자동 복구**: [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md) 는 AI 에이전트 도구 구성(`buildTools`)이 `expired` 이고 refresh token 이 있는 행에 큐 갱신을 걸면 워커가 갱신 뒤 `connected` 로 되돌린다고 적는다. 데이터 흐름 정의의 상태도도 «내부 MCP 브리지의 refresh token 자가 회복» 으로 `expired → connected` 를 그린다. 그런데 같은 정의의 주석은 갱신 워커가 source 와 상관없이 `status !== 'connected'` 행을 건너뛴다고 적는다. 현재 구현(`cafe24-token-refresh.processor.ts` 의 상태 가드)은 주석과 같다(MakeShop 도 `MakeshopMcpToolProvider` 가 `makeshop-token-refresh` 큐로 같은 자가 회복을 건다). 자동 복구를 없앨지, 워커 가드에 예외를 둘지 결정이 필요하다.
- **조치 필요 알림 중복 방지 규칙**: 통합 화면 정의는 `(integration_id, status_reason)` 으로 유니크를 판정해 같은 사유는 통합마다 최대 한 번 보내고, 사용자가 다시 연결해 `connected` 가 되면 키를 되돌린다고 적는다. 같은 절의 주석, 데이터 흐름 정의(같은 통합·사유 24시간), [알림](../CLE-OBS/CLE-OBS-NOTIFY.md) 정의(`(workspace, type, resourceId, title)` 24시간)는 `hasRecentByResource` 의 24시간 창으로 적는다. 현재 구현(`integration-action-required-notifier.service.ts`, `withinMs` 24시간)은 24시간 창이다. 두 규칙은 «24시간 뒤 같은 사유 재발» 과 «24시간 안에 회복 후 재발» 에서 발사 여부가 반대다. 장애가 24시간 넘게 이어질 때 다시 알릴지 결정이 필요하다.
- **Google 의 자동 갱신 표시와 스캐너 판정**: Google 은 서비스 레지스트리에서 `supportsTokenAutoRefresh=true` 라 화면에 `Auto-renews` 로 보이고 만료 임박·주의 필요에서 빠진다. 그런데 갱신 가능 통합 판정에는 없어 만료 스캐너가 7일·3일 알림을 보내고 당일에 `expired` 로 바꾼다. 갱신 경로도 구현돼 있지 않다([OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md)). 원문 통합 정의의 Google 서비스 요구사항은 «토큰 자동 갱신 지원» 이라 적었고 그 서비스 목록은 [통합 관리](CLE-INT-MANAGE.md) 의 REQ-INTMGMT-027 이 이어받았다. 화면 신호와 스캐너 동작이 반대다. Google 을 자동 갱신 표시에서 뺄지, 갱신 경로를 만들고 갱신 가능 통합에 넣을지 결정이 필요하다.
- **조치 필요 알림 문구의 Cafe24 고정**: [조치 필요 알림](CLE-INT-STATUS-SCAN.md#조치-필요-알림-integration_action_required) 표의 메시지에는 «Cafe24» 가 들어 있다. 데이터 흐름 정의는 MakeShop 클라이언트도 같은 알림 경로를 쓴다고 적고, 현재 구현도 MakeShop 실패에 같은 문구를 보낸다. 문구를 서비스 중립으로 바꿀지, 서비스 유형별 문구를 둘지 결정이 필요하다.

## 구현 위치

각 하위 문서의 `## 구현 위치` 에 있다.

## Rationale

### 주의 필요를 가상 필터 값 하나로 노출한다

→ [통합 상태와 만료 알림 — 화면 표시와 주의 필요](CLE-INT-STATUS-DISPLAY.md#주의-필요를-가상-필터-값-하나로-노출한다)

### 설치 대기의 콜백 실패는 상태를 보존한다

→ [통합 상태와 만료 알림 — 상태 모델](CLE-INT-STATUS-MODEL.md#설치-대기의-콜백-실패는-상태를-보존한다)

### 설치 대기는 24시간 뒤 만료된다

→ [통합 상태와 만료 알림 — 상태 모델](CLE-INT-STATUS-MODEL.md#설치-대기는-24시간-뒤-만료된다)

### 자동 갱신 통합을 주의 필요에서 뺀다

→ [통합 상태와 만료 알림 — 화면 표시와 주의 필요](CLE-INT-STATUS-DISPLAY.md#자동-갱신-통합을-주의-필요에서-뺀다)

### HMAC 검증 실패는 상태 사유로 남기지 않는다 (2026-11-13)

→ [통합 상태와 만료 알림 — 상태 모델](CLE-INT-STATUS-MODEL.md#hmac-검증-실패는-상태-사유로-남기지-않는다-2026-11-13)

### 개인 통합 소유자의 나가기·제거는 자동 삭제의 예외다 (2026-10-29)

2026-10-29 에 개인 통합의 통합 소유자가 워크스페이스를 나가거나 제거되면 그 개인 통합을 지우기로 했다([통합 관리](CLE-INT-MANAGE.md#나간-멤버의-개인-통합은-나갈-때-지운다-2026-10-29)). 상태 다이어그램에는 그 경로를 넣었지만 REQ-INTSTAT-014 와 상태 전이 표의 «모든 상태 → 삭제» 행은 «자동 삭제는 없다» 로 남아 서로 어긋나서 두 곳에 예외를 적었다. 이 삭제는 시간이나 상태가 아니라 멤버십이 끝난 결과라서 «시간이나 상태로 지우는 자동 삭제는 없다» 는 그대로다. 삭제는 2026-10-30 에 구현됐다.

### 통합 노드 차단은 에러 포트로 보낸다 (2026-11-13)

통합 노드 차단 요구사항(REQ-INTSTAT-015)은 연결되지 않은 통합을 쓰는 통합 노드 «실행을 `INTEGRATION_NOT_CONNECTED` 로 실패시킨다» 고 적었다. [통합 노드 공통](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md) 은 `execute()` 안의 실패를 에러 포트로 보낸다고 정했고 구현도 다섯 직결 노드(HTTP Request·Database Query·Send Email·Cafe24·MakeShop) 모두 `assertUsable` 이 던진 `INTEGRATION_NOT_CONNECTED` 를 잡아 에러 포트로 내보낸다. 2026-11-13 에 요구사항과 상태 모델의 서술을 구현과 공통 규칙에 맞췄다. 동작은 바꾸지 않았다. 요구사항 줄 끝의 «(원본: …)» 표지는 출처 표기라 그대로 둔다.
