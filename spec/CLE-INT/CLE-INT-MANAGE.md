---
id: "CLE-INT-MANAGE"
title: "통합 관리"
type: "feature"
version: 22
status: "approved"
requirements: ["REQ-INTMGMT-001", "REQ-INTMGMT-002", "REQ-INTMGMT-003", "REQ-INTMGMT-004", "REQ-INTMGMT-005", "REQ-INTMGMT-006", "REQ-INTMGMT-007", "REQ-INTMGMT-008", "REQ-INTMGMT-009", "REQ-INTMGMT-010", "REQ-INTMGMT-011", "REQ-INTMGMT-012", "REQ-INTMGMT-013", "REQ-INTMGMT-014", "REQ-INTMGMT-015", "REQ-INTMGMT-016", "REQ-INTMGMT-017", "REQ-INTMGMT-018", "REQ-INTMGMT-019", "REQ-INTMGMT-020", "REQ-INTMGMT-021", "REQ-INTMGMT-022", "REQ-INTMGMT-023", "REQ-INTMGMT-024", "REQ-INTMGMT-025", "REQ-INTMGMT-026", "REQ-INTMGMT-027", "REQ-INTMGMT-028", "REQ-INTMGMT-029", "REQ-INTMGMT-030", "REQ-INTMGMT-031", "REQ-INTMGMT-032", "REQ-INTMGMT-033", "REQ-INTMGMT-034", "REQ-INTMGMT-035", "REQ-INTMGMT-036", "REQ-INTMGMT-037", "REQ-INTMGMT-038", "REQ-INTMGMT-039", "REQ-INTMGMT-040", "REQ-INTMGMT-041", "REQ-INTMGMT-042", "REQ-INTMGMT-043", "REQ-INTMGMT-044", "REQ-INTMGMT-045", "REQ-INTMGMT-046", "REQ-INTMGMT-047", "REQ-INTMGMT-048", "REQ-INTMGMT-049", "REQ-INTMGMT-050", "REQ-INTMGMT-051", "REQ-INTMGMT-052", "REQ-INTMGMT-053", "REQ-INTMGMT-054", "REQ-INTMGMT-055", "REQ-INTMGMT-056", "REQ-INTMGMT-057", "REQ-INTMGMT-058", "REQ-INTMGMT-059", "REQ-INTMGMT-060", "REQ-INTMGMT-061", "REQ-INTMGMT-062", "REQ-INTMGMT-063", "REQ-INTMGMT-064", "REQ-INTMGMT-065", "REQ-INTMGMT-066", "REQ-INTMGMT-067", "REQ-INTMGMT-068"]
basis_superseded: false
parent: "CLE-INT"
ancestors: ["CLE-VISION", "CLE-INT"]
area: "CLE-INT"
content_hash: "c82657aa3dac9da4c9a69514d820f5cf56e3eabec9f6aa0edfa1bc86ec065c78"
read_as: "approved_fallback"
task: "CLE-T-RW69WZ"
source_paths: ["spec/2-navigation/4-integration.md", "spec/2-navigation/_product-overview.md", "spec/4-nodes/4-integration/_product-overview.md"]
mirror_sha256: "833ed3e7176d954bf8d95c89a6e313ae2cd893a6c87335ab543f59e10658b471"
etag: "sha256-92f5bda52f3bdf8e0a96930760f68283545bfe8d4fba4cbafe7a2f1fd95c9e01"
---
> 구현 상태: 부분 구현 · 원문: `spec/2-navigation/4-integration.md` (§1~§4, §7, §8, §9, §12, §14, 관련 Rationale), `spec/4-nodes/4-integration/_product-overview.md` (§1, §2 의 INT-MG·INT-AU·INT-US·INT-WH·INT-SV·INT-OG), `spec/2-navigation/_product-overview.md` (§3.4 NAV-IN) · 용어: [용어 사전](../CLE-GLOSSARY.md)

## 개요

통합(Integration, `integration`)은 외부 서비스 자격 증명(credentials)과 연결 상태를 워크스페이스에 저장한 것이다. 통합 노드와 AI 에이전트가 통합을 참조해 외부 서비스를 부른다. 이 문서는 사용자가 통합을 만들고 보고, 바꾸고 지우는 기능을 정한다. 목록·추가·상세 화면, 사용처(usages) 추적과 삭제 차단, 권한, 연결 테스트(test connection), 관리 API 와 에러 코드, 노드 실행·에디터·감사 로그와의 연동이 여기에 있다.

하나의 서비스에 계정이나 인스턴스별로 통합을 여러 개 둘 수 있고 별칭으로 구분한다. 공개 범위(`Integration.scope`)가 개인(`personal`)이면 통합 소유자(`created_by`)만 보고 바꾼다. 노드에서는 통합 소유자가 작성한 워크플로우에서만 쓸 수 있다. 조직(`organization`)이면 워크스페이스 멤버 전원이 쓴다.

범위 밖:

- 서비스별 자격 증명 필드와 연결 테스트가 서비스마다 무엇을 확인하는지는 [서비스별 인증 방식과 자격 증명](CLE-INT-AUTH.md) 이 정한다.
- OAuth 연결·설치 흐름, 권한 탭, 통합 재인증(reauthorize)과 추가 권한 요청(request scopes), 토큰 자동 갱신은 [OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md) 이 정한다.
- 상태 전이, 상태 표시, 주의 필요 판정, 재설치 대기 표시와 상태의 관계, 만료 스캐너와 알림은 [통합 상태와 만료 알림](CLE-INT-STATUS.md) 이 정한다.
- 엔티티 컬럼, 활동 로그(activity log) 채우기 규칙, 암호화는 [통합 데이터와 흐름](CLE-INT-DATA.md) 이 정한다. 삭제와 멤버 퇴장이 남기는 자격 증명 캐시 무효화의 채널과 실패 처리도 [통합 데이터와 흐름 「자격 증명 캐시 무효화」](CLE-INT-DATA.md#자격-증명-캐시-무효화) 가 정한다. 이 문서는 무효화가 일어나는 순서(REQ-INTMGMT-060·065)만 정한다.
- 통합 노드의 핸들러 계약과 노드 에러 코드는 [통합 노드 공통](../CLE-NODE-INT/CLE-NODE-INT-COMMON.md), MCP 서버 통합의 도구 노출은 [MCP 클라이언트](CLE-INT-MCP.md) 가 정한다.
- 같은 제품 요구사항 문서의 지식 저장소와 마켓플레이스 요구사항은 [지식 저장소 관리](../CLE-KB/CLE-KB-MANAGE.md) 와 [마켓플레이스 (구상)](../CLE-UI/CLE-UI-MARKET.md) 에 있다.

## 요구사항

- REQ-INTMGMT-001 WHEN 사용자가 통합 메뉴를 열면 THE SYSTEM SHALL 워크스페이스의 외부 서비스 통합을 한 목록에서 관리하게 한다. (원본: INT-MG-01, NAV-IN-01)
- REQ-INTMGMT-002 WHEN 사용자가 통합을 추가하면 THE SYSTEM SHALL 목록 모달에서 서비스 유형을 고르게 한 뒤 `/integrations/new?service=<type>&step=auth` 페이지에서 자격 증명을 입력받는다. (원본: INT-MG-02, INT-MG-08, NAV-IN-02)
- REQ-INTMGMT-003 WHEN 사용자가 같은 서비스 유형의 통합을 여러 개 만들면 THE SYSTEM SHALL 계정이나 인스턴스마다 별도 통합으로 저장한다. (원본: INT-MG-03)
- REQ-INTMGMT-004 WHEN 사용자가 통합을 만들면 THE SYSTEM SHALL 워크스페이스 안에서 유일한 별칭을 받는다. (원본: INT-MG-04)
- REQ-INTMGMT-005 IF 같은 워크스페이스에 같은 별칭의 통합이 이미 있으면 THE SYSTEM SHALL 생성과 별칭 수정을 409 `INTEGRATION_NAME_TAKEN` 으로 거절한다. Cafe24 Private·MakeShop 의 `oauth/begin` 이 설치 대기 행을 만드는 것도 생성이다.
- REQ-INTMGMT-006 WHEN 사용자가 통합을 열면 THE SYSTEM SHALL 개요·보안·권한·사용·활동·위험 영역 탭이 있는 상세 페이지를 보인다. 위험 영역 탭은 공개 범위 전환이나 삭제를 할 수 있는 사람에게만 보인다(REQ-INTMGMT-063). (원본: INT-MG-05)
- REQ-INTMGMT-007 WHEN 사용자가 OAuth 가 아닌 통합의 자격 증명 교체를 제출하면 THE SYSTEM SHALL 새 값으로 연결 테스트를 하고 성공할 때만 저장한다. (원본: INT-MG-06)
- REQ-INTMGMT-008 IF 자격 증명 교체의 연결 테스트가 실패하면 THE SYSTEM SHALL 기존 자격 증명을 그대로 둔다. (원본: INT-MG-06)
- REQ-INTMGMT-009 WHEN 자격 증명이 바뀌면 THE SYSTEM SHALL 보안 탭에 마지막 교체 시각을 상대 시간과 절대 시간으로 보인다. (원본: INT-MG-06)
- REQ-INTMGMT-010 WHEN 관리자 이상이 공개 범위 전환을 확인하면 THE SYSTEM SHALL 개인과 조직 사이를 바꾸고 기존 자격 증명을 승계하며 감사 로그를 남긴다. 조직에서 개인으로 바꿀 때 통합을 만든 사람이 멤버가 아니면 바꾸지 않는다(REQ-INTMGMT-067). (원본: INT-MG-07)
- REQ-INTMGMT-011 WHEN 사용자가 통합을 만들면 THE SYSTEM SHALL 서비스에 맞게 OAuth 2.0·API Key·Bearer Token·Basic·Connection String·SMTP 인증을 받는다. (원본: INT-AU-02, INT-AU-03, INT-AU-08, INT-AU-09, INT-AU-10, NAV-IN-04)
- REQ-INTMGMT-012 WHEN 통합을 저장하면 THE SYSTEM SHALL 자격 증명을 암호화해 저장하고 응답에서는 가린 미리보기만 보인다. 암호화는 운영 환경(`NODE_ENV=production`) 기준이다. 예외는 [통합 데이터와 흐름 「암호화」](CLE-INT-DATA.md#암호화) 에 있다. (원본: INT-AU-05)
- REQ-INTMGMT-013 WHEN 사용자가 연결 테스트를 누르면 THE SYSTEM SHALL 저장된 자격 증명으로 외부 서비스 연결을 확인하고 결과를 보인다. (원본: NAV-IN-06)
- REQ-INTMGMT-014 WHEN 추가 위저드가 연결 테스트 단계에 들어가면 THE SYSTEM SHALL 저장하지 않은 자격 증명으로 저장 전 연결 테스트를 자동으로 부르고 성공해야 저장 버튼을 활성화한다.
- REQ-INTMGMT-015 IF 설치 대기 통합에 연결 테스트를 요청하면 THE SYSTEM SHALL 외부를 부르지 않고 200 과 `{ success:false, code:'INTEGRATION_INCOMPLETE' }` 를 돌려준다.
- REQ-INTMGMT-016 WHEN 연결 테스트가 실패하면 THE SYSTEM SHALL 그 실패를 연속 네트워크 실패 카운터에 합산하지 않는다.
- REQ-INTMGMT-017 WHEN 사용처를 조회하면 THE SYSTEM SHALL 노드 `config.integrationId` 직접 참조와 AI 에이전트 `config.mcpServers[].integrationId` MCP 참조의 합집합을 워크플로우 활성 여부와 상관없이 돌려준다. (원본: INT-US-01)
- REQ-INTMGMT-018 WHEN 사용처를 돌려주면 THE SYSTEM SHALL 노드마다 `usageKind`(`direct`·`mcp`)를 표시하고 두 경로에 모두 해당하면 `direct` 로 둔다. (원본: INT-US-01)
- REQ-INTMGMT-019 IF 사용처가 남은 통합을 삭제하려 하면 THE SYSTEM SHALL 409 `INTEGRATION_IN_USE` 와 사용처 목록으로 거절하고 노드를 먼저 바꾸거나 지우라고 안내한다. 멤버가 나가거나 제거될 때의 삭제(REQ-INTMGMT-065)는 이 거절을 거치지 않는다. (원본: INT-US-02)
- REQ-INTMGMT-020 WHEN 통합이 만료됨이나 오류가 되면 THE SYSTEM SHALL 그 통합을 참조하는 노드에 에디터 경고 배지와 상세 바로가기를 보인다. (원본: INT-US-03)
- REQ-INTMGMT-021 WHEN 통합 노드나 내부 MCP 브리지가 통합을 부르면 THE SYSTEM SHALL 호출마다 활동 로그를 한 행 남기고 상세 활동 탭에 최근 7일 호출 수 차트를 보인다. 통합을 얻기 전에 끝난 실패는 REQ-INTMGMT-053 을 따르고, dry-run 이 모의 출력 · 응답으로 대신한 호출은 REQ-RERUN-053 을 따른다. (원본: INT-US-04)
- REQ-INTMGMT-022 WHEN 활동 로그를 남기면 THE SYSTEM SHALL 호출 API 식별 정보(`api_label`·`api_method`·`api_path`)를 함께 저장한다. (원본: INT-US-05)
- REQ-INTMGMT-023 WHEN 활동 탭이 Cafe24·MakeShop 카탈로그 키를 보이면 THE SYSTEM SHALL `services/:type/catalog` 의 `labelKey` 와 프런트엔드 i18n 으로 사람이 읽는 문구를 보인다.
- REQ-INTMGMT-024 WHILE 통합이 연결됨이 아닌 동안 THE SYSTEM SHALL 활동 탭 위에 «연결 안 됨» 인라인 안내를 보인다.
- REQ-INTMGMT-025 WHEN 사용자가 Webhook 통합을 만들면 THE SYSTEM SHALL URL·메서드·기본 헤더·서명 시크릿으로 밖으로 보내는 호출 대상만 정의하게 한다. (원본: INT-WH-01, INT-SV-04)
- REQ-INTMGMT-026 WHEN 들어오는 웹훅 URL 이 필요하면 THE SYSTEM SHALL 트리거에서만 발급하고 Webhook 통합과 서로 참조하거나 공유하지 않는다. (원본: INT-WH-02)
- REQ-INTMGMT-027 WHEN 사용자가 서비스를 고르면 THE SYSTEM SHALL HTTP/REST·Database·Email(SMTP)·Webhook·Cafe24·Google·GitHub·MCP 서버·MakeShop 을 제공한다. (원본: INT-SV-01~INT-SV-09)
- REQ-INTMGMT-028 WHEN Cafe24·MakeShop 통합을 만들면 THE SYSTEM SHALL 같은 통합을 워크플로우 노드와 AI 에이전트 MCP 도구 양쪽에서 쓰게 한다. (원본: INT-SV-05, INT-SV-09)
- REQ-INTMGMT-029 WHEN 팀 워크스페이스의 관리자 이상이 통합을 만들면 THE SYSTEM SHALL 조직 공개 범위를 고를 수 있게 한다. (원본: INT-OG-01, NAV-IN-07)
- REQ-INTMGMT-030 WHEN 조직 통합이 있으면 THE SYSTEM SHALL 워크스페이스 멤버 전원이 워크플로우에서 쓰게 한다. (원본: INT-OG-02)
- REQ-INTMGMT-031 IF 관리자 미만이 조직 통합을 생성·별칭 수정·삭제·통합 재인증·자격 증명 교체·추가 권한 요청·공개 범위 전환하려 하면 THE SYSTEM SHALL 403 으로 거절한다. 코드는 `ADMIN_REQUIRED` 다. 라우트 가드가 편집자 이상으로 먼저 막는 뷰어의 요청만 `EDITOR_REQUIRED` 다. 공개 범위 전환은 라우트 가드가 관리자 이상으로 막으므로 뷰어도 `ADMIN_REQUIRED` 다. 삭제는 라우트 가드가 뷰어를 막지 않으므로(REQ-INTMGMT-051) 뷰어의 조직 통합 삭제도 `ADMIN_REQUIRED` 다. (원본: INT-OG-03, NAV-IN-07)
- REQ-INTMGMT-032 WHEN 목록을 보이면 THE SYSTEM SHALL 조직 통합과 개인 통합을 섹션으로 나눠 보인다. (원본: INT-OG-04)
- REQ-INTMGMT-033 IF 요청자가 통합 소유자가 아닌 개인 통합에 접근하면 THE SYSTEM SHALL 목록에서 빼고 그 `:id` 경로 전부를 404 `RESOURCE_NOT_FOUND` 로 응답한다. 라우트 가드가 있는 경로는 가드의 역할 거부 코드가 먼저 나간다.
- REQ-INTMGMT-034 WHILE 개인 통합을 다루는 동안 THE SYSTEM SHALL 소유자·관리자 역할이라도 통합 소유자가 아니면 보거나 바꾸지 못하게 한다.
- REQ-INTMGMT-035 IF 뷰어가 개인 통합을 생성·별칭 수정·자격 증명 교체·통합 재인증·추가 권한 요청하려 하면 THE SYSTEM SHALL 403 `EDITOR_REQUIRED` 로 거절한다.
- REQ-INTMGMT-036 WHEN 노드가 실행 중에 개인 통합을 참조하면 THE SYSTEM SHALL 그 노드가 속한 워크플로우의 작성자(`workflow.created_by`)가 통합 소유자일 때만 그 통합을 쓴다.
- REQ-INTMGMT-037 WHEN 사용자가 목록을 검색하거나 거르면 THE SYSTEM SHALL 별칭 부분 일치, 공개 범위, 서비스 유형(다중 선택), 상태(단일 선택) 필터를 URL 쿼리 `q`·`scope`·`serviceType`·`status` 와 맞춰 둔다.
- REQ-INTMGMT-038 WHEN 사용자가 추가 페이지를 새로고침하면 THE SYSTEM SHALL `service`·`step` 을 복원하되 입력한 자격 증명은 복원하지 않고 인증 단계로 되돌린다.
- REQ-INTMGMT-039 WHILE 추가 페이지에 입력 중인 자격 증명이 있는 동안 THE SYSTEM SHALL 페이지를 떠나려 하면 경고한다.
- REQ-INTMGMT-040 WHEN 통합 조회 응답을 만들면 THE SYSTEM SHALL 자격 증명을 가리고 파생 값 `autoRefresh`·`appUrl` 을 싣는다.
- REQ-INTMGMT-041 WHEN 사용자가 Cafe24 상점 식별자를 입력하면 THE SYSTEM SHALL 같은 상점의 Cafe24 통합이 이미 있는지 중복 사전 감지로 미리 알린다.
- REQ-INTMGMT-042 IF 중복 사전 감지의 충돌 행이 요청자가 볼 수 없는 개인 통합이면 THE SYSTEM SHALL 통합 ID 와 이름을 빼고 충돌 여부와 상태만 돌려준다.
- REQ-INTMGMT-043 WHEN 통합의 생성·수정·삭제·자격 증명 교체·비OAuth 재인증·공개 범위 전환이 일어나면 THE SYSTEM SHALL `resource_type='integration'` 감사 로그를 남긴다.
- REQ-INTMGMT-044 WHEN OAuth 통합 재인증이 콜백으로 끝나면 THE SYSTEM SHALL `integration.reauthorized` 감사 로그를 남긴다. (미구현)
- REQ-INTMGMT-045 WHEN 노드 설정 패널에서 통합을 고르면 THE SYSTEM SHALL 서비스 유형으로 거른 통합 선택기를 보이고 해당 유형 통합이 없으면 만들기 링크를 보인다.
- REQ-INTMGMT-046 IF 노드에 저장된 통합이 삭제됐으면 THE SYSTEM SHALL `{id앞8자}… (missing)` 옵션을 더해 값을 보존한다.
- REQ-INTMGMT-047 WHEN 통합 조회 응답을 만들면 THE SYSTEM SHALL 재설치 대기 표시를 `reinstallRequestedAt`(ISO 8601 시각 또는 `null`)으로 싣고 남긴 지 24시간이 지난 표시는 `null` 로 싣는다.
- REQ-INTMGMT-048 WHILE 통합 조회 응답의 `reinstallRequestedAt` 이 `null` 이 아닌 동안 THE SYSTEM SHALL 상세 화면 머리 아래에 «테스트 실행» 을 누르라는 안내와 요청 시각을 info 톤으로 보인다.
- REQ-INTMGMT-049 WHEN 보안 탭이 통합 재인증 버튼을 막으면 THE SYSTEM SHALL 설치 대기, 설치 기한 만료, App URL 없음, MakeShop 가운데 해당하는 이유의 안내 문구를 버튼 아래에 보인다.
- REQ-INTMGMT-050 WHEN 통합 재인증 응답이 `cafe24_private_pending` 이면 THE SYSTEM SHALL 팝업을 열지 않고 info 토스트를 보인 뒤 통합을 다시 조회한다.
- REQ-INTMGMT-051 WHEN 뷰어가 자기 개인 통합을 삭제하면 THE SYSTEM SHALL 다른 역할과 같은 사용처 검사를 거쳐 허용한다.
- REQ-INTMGMT-052 IF 실행 중인 노드가 워크플로우 작성자가 통합 소유자가 아닌 개인 통합을 참조하면 THE SYSTEM SHALL 없는 통합을 참조할 때와 똑같이 통합 노드는 같은 노드 에러 코드로 실패시키고 AI 에이전트의 MCP 서버 항목은 그 서버만 건너뛴다.
- REQ-INTMGMT-053 IF 통합 노드나 MCP 서버 항목이 통합을 얻기 전에 실패하면 THE SYSTEM SHALL 설정의 통합 ID 로 활동 로그를 남기지 않고 그 통합의 `last_used_at`·`last_error` 도 쓰지 않는다.
- REQ-INTMGMT-054 IF 노드 생성·노드 설정 수정·캔버스 저장 요청이 새로 넣거나 바꾼 통합 참조가 워크스페이스에 없는 통합이나 저장자 또는 워크플로우 작성자가 통합 소유자가 아닌 개인 통합을 가리키면 THE SYSTEM SHALL 거절 이유를 구분하지 않고 400 `VALIDATION_ERROR`(`details[].code`=`INVALID_FIELD`)로 거절한다. 복제·가져오기·버전 복원은 거절하지 않고 참조를 비운다(REQ-WFLIST-054·055, REQ-WFVER-026). 참조 값이 표현식이면 거절하지도 비우지도 않고 실행 시점 판정에 맡긴다(REQ-INTMGMT-059).
- REQ-INTMGMT-055 IF 실행 중 노드가 속한 워크플로우의 작성자를 알 수 없으면 THE SYSTEM SHALL 그 노드의 개인 통합 참조를 워크플로우 작성자가 통합 소유자가 아닐 때와 같이 처리한다.
- REQ-INTMGMT-056 IF 지금 사용자가 워크플로우 작성자가 아니면 THE SYSTEM SHALL 통합 선택기에서 자기 개인 통합을 고를 수 없는 항목으로 보이고 그 이유를 함께 보인다.
- REQ-INTMGMT-057 WHEN 관리자가 조직 통합을 개인으로 전환하려 하고 통합 소유자가 아닌 사람이 작성한 워크플로우가 그 통합을 쓰면 THE SYSTEM SHALL 전환 확인 다이얼로그에 실행이 실패하게 될 워크플로우 목록을 보인다. 전환을 막지는 않는다.
- REQ-INTMGMT-058 IF 실행 중 노드나 버전 복원이 참조하는 개인 통합의 통합 소유자가 지금 워크스페이스 멤버가 아니면 THE SYSTEM SHALL 그 참조를 워크플로우 작성자가 통합 소유자가 아닐 때와 같이 처리한다.
- REQ-INTMGMT-059 IF 실행 중 노드의 통합 참조 값이 표현식으로 정해지고 그 값이 개인 통합을 가리키면 THE SYSTEM SHALL 그 참조를 워크플로우 작성자가 통합 소유자가 아닐 때와 같이 처리한다. 평가 전 원본 값을 확인하지 못한 참조도 표현식으로 정한 참조로 본다.
- REQ-INTMGMT-060 WHEN 통합 삭제 요청을 받으면 THE SYSTEM SHALL 존재와 조회 권한(404), 역할(403), 사용처(409) 순으로 판정하고 셋을 모두 통과한 뒤에만 캐시 무효화와 감사 로그를 남긴다.
- REQ-INTMGMT-061 IF 뷰어가 저장 전 연결 테스트를 부르면 THE SYSTEM SHALL 403 `EDITOR_REQUIRED` 로 거절한다.
- REQ-INTMGMT-062 WHEN 활동 로그를 기록하면 THE SYSTEM SHALL 실행 중에 조회해 얻은 통합에만 활동 로그와 그 통합의 `last_used_at`·`last_error` 를 쓴다.
- REQ-INTMGMT-063 WHEN 통합 목록이나 상세 화면을 보이면 THE SYSTEM SHALL 지금 사용자가 역할이나 통합 소유 때문에 할 수 없는 변경 동작(목록 헤더와 빈 상태의 통합 추가, 별칭 수정, 통합 재인증, 자격 증명 교체, 추가 권한 요청, 공개 범위 전환, 삭제)의 버튼을 보이지 않고 공개 범위 전환과 삭제를 둘 다 할 수 없으면 위험 영역 탭도 보이지 않는다. 통합 추가를 할 수 없으면 `N` 키로도 추가 모달이 열리지 않는다. 연결 테스트처럼 조회성 동작의 버튼은 보인다.
- REQ-INTMGMT-064 IF 뷰어가 통합 추가 화면 주소(`/integrations/new`)로 들어오면 THE SYSTEM SHALL 추가 단계 대신 편집자 이상만 통합을 추가할 수 있다는 안내와 목록으로 돌아가는 링크를 보인다.
- REQ-INTMGMT-065 WHEN 멤버가 워크스페이스를 나가거나 제거되면 THE SYSTEM SHALL 멤버십을 지우는 트랜잭션 안에서 그 멤버가 통합 소유자인 그 워크스페이스의 개인 통합을 상태와 사용처에 관계없이 모두 지운다. 커밋 뒤 지운 통합마다 캐시를 무효화하고 `details.mode` 와 `details.memberUserId` 를 실은 `integration.deleted` 감사 로그를 남긴다.
- REQ-INTMGMT-066 WHEN 개인 통합 행을 만들거나(통합 생성) Cafe24 Private·MakeShop `oauth/begin` 이 개인 공개 범위 요청으로 설치 대기 행을 만들거나 다시 쓰면 THE SYSTEM SHALL 같은 트랜잭션에서 워크스페이스, 멤버십, 통합 순으로 잠그고 통합 소유자의 멤버십을 다시 읽어 없으면 403 `NOT_A_MEMBER` 로 거절한다. 멤버십이 있는지만 보고 역할은 보지 않는다. 잠금 순서는 [나간 멤버의 개인 통합은 나갈 때 지운다](#나간-멤버의-개인-통합은-나갈-때-지운다-2026-10-29) 가 정한다.
- REQ-INTMGMT-067 IF 관리자가 조직 통합을 개인으로 전환하려는데 통합을 만든 사람(`created_by`)이 그 워크스페이스 멤버가 아니면 THE SYSTEM SHALL 409 `INTEGRATION_OWNER_NOT_MEMBER` 로 거절하고 통합을 바꾸지 않는다. 판정은 전환 트랜잭션 안에서 REQ-INTMGMT-066 과 같은 순서로 잠근 멤버십으로 한다.
- REQ-INTMGMT-068 WHEN 조직 공개 범위로 통합 행을 만들거나(통합 생성) Cafe24 Private·MakeShop `oauth/begin` 이 조직 공개 범위 요청으로 설치 대기 행을 만들거나 다시 쓰면 THE SYSTEM SHALL 같은 트랜잭션에서 통합 행보다 먼저 워크스페이스 행을 잠그고 워크스페이스가 그 사이 지워졌으면 403 `NOT_A_MEMBER` 로 거절한다. 멤버십은 잠그지 않는다. 잠금 순서는 [나간 멤버의 개인 통합은 나갈 때 지운다](#나간-멤버의-개인-통합은-나갈-때-지운다-2026-10-29) 가 정한다.

통합 참조가 놓이는 자리와 저장 검사가 거절할 값 모양(문자열이 아닌 값, 표현식이 아니면서 UUID 모양이 아닌 문자열)은 [플랫폼 데이터 모델 「참조의 소속」](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속) 의 「통합 참조」 가 정한다. 위 054 의 거절 대상도 이 규칙을 따른다.

## 하위 문서

| 문서 | 내용 | 요구사항 |
| --- | --- | --- |
| [통합 관리 — 목록과 추가 화면](CLE-INT-MANAGE-LIST.md) | 라우트, 목록 페이지, 추가 페이지, 중복 사전 감지 | 001 · 002 · 003 · 004 · 025~028 · 037 · 038 · 039 · 041 · 042 · 064 |
| [통합 관리 — 상세 화면](CLE-INT-MANAGE-DETAIL.md) | 상세 페이지의 탭과 재설치 대기 안내 | 006 · 009 · 023 · 024 · 048 · 049 · 050 · 057 · 063 |
| [통합 관리 — 권한과 멤버 퇴장](CLE-INT-MANAGE-PERM.md) | 권한 표, 멤버 퇴장 때의 개인 통합 삭제, 잠금 순서 | 010 · 029~035 · 051 · 060 · 061 · 065~068 |
| [통합 관리 — 개인 통합 사용 판정](CLE-INT-MANAGE-USE.md) | 노드가 개인 통합을 쓸 수 있는지의 판정 | 036 · 052 · 054 · 055 · 056 · 058 · 059 |
| [통합 관리 — API 와 에러 코드](CLE-INT-MANAGE-API.md) | 관리 API, 응답 마스킹, 에러 코드 표 | 005 · 011 · 012 · 022 · 040 · 047 |
| [통합 관리 — 사용처 · 연결 테스트 · 실행 연동](CLE-INT-MANAGE-RUN.md) | 사용처와 삭제 차단, 연결 테스트, 노드 실행, 에디터, 감사 로그 | 007 · 008 · 013~021 · 043 · 044 · 045 · 046 · 053 · 062 |

요구사항 번호는 REQ-INTMGMT-<nnn> 의 nnn 이다. 요구사항 줄은 이 문서에만 있고 하위 문서는 그 요구를 어떻게 지키는지 정한다.

## 미결 사항

- **노드 실행 중 403 의 에러 코드**: [Cafe24 노드](../CLE-NODE-INT/CLE-NODE-CAFE24.md) 는 403 을 `output.error.code=CAFE24_AUTH_FAILED` 로 내고 상태를 `auth_failed` 또는 `insufficient_scope` 로 바꾼다고 적는다. 이 문서의 에러 코드 표와 [Cafe24 별도 승인 scope](CLE-C24-SCOPES) 는 노드 실행 중 403 이 `INSUFFICIENT_SCOPE` 와 `details.missingScopes`·`requiresCafe24Approval` 을 낸다고 적는다. 워크플로우 작성자가 분기할 코드가 문서마다 다르다. 현재 구현에서 `CAFE24_INSUFFICIENT_SCOPE` 는 연결 테스트용으로 보인다(미확인). 노드 출력 코드와 `requiresCafe24Approval` 이 실리는 자리(`last_error.details` 로 보인다)를 확정해야 한다.
- **MCP 서버 통합의 개인 공개 범위**: [MCP 클라이언트](CLE-INT-MCP.md) 는 MCP 통합의 기본값이 조직이고 개인 등록을 지원하지 않는다고 적는다. 이 문서의 추가 화면·권한 규칙과 [서비스별 인증 방식과 자격 증명](CLE-INT-AUTH.md) 에는 MCP 예외가 없어 모든 서비스가 개인을 고를 수 있다. MCP 전용 제한은 코드에서 찾지 못했다(미확인). MCP 개인 등록을 막을지 결정이 필요하다.
- **삭제 차단 409 의 사용처 목록**: 이 문서는 `DELETE` 의 409 `INTEGRATION_IN_USE` 가 에러 봉투의 `details.usages` 에 사용처 목록을 싣는다고 정한다(REQ-INTMGMT-019). 현재 구현(`integrations.service.ts` 의 삭제 경로)은 목록을 예외 객체 최상위의 `usages` 에 담는다. 전역 예외 필터(`http-exception.filter.ts`)는 `code`·`message`·`details` 만 봉투로 옮기므로 목록이 응답에서 빠진다. 화면(`danger-tab.tsx`)도 응답 본문 최상위의 `usages` 를 읽어 경합으로 409 가 오면 늘 토스트로 끝난다. 삭제 전 `usages` 조회로 차단 다이얼로그를 띄우는 정상 흐름은 영향이 없다. 서버는 `details.usages` 로 싣고 화면은 `error.details.usages` 를 읽도록 함께 고쳐야 한다.

## 옮긴 절

다른 문서가 링크하던 절이다. 본문은 하위 문서에 있다.

### 권한

→ [하위 문서](CLE-INT-MANAGE-PERM.md#권한)

### 개인 통합 사용 판정

→ [하위 문서](CLE-INT-MANAGE-USE.md#개인-통합-사용-판정)

### 상세 페이지

→ [하위 문서](CLE-INT-MANAGE-DETAIL.md#상세-페이지)

### 활동 탭

→ [하위 문서](CLE-INT-MANAGE-DETAIL.md#활동-탭)

### 위험 영역 탭

→ [하위 문서](CLE-INT-MANAGE-DETAIL.md#위험-영역-탭)

### 권한 탭

→ [하위 문서](CLE-INT-MANAGE-DETAIL.md#권한-탭)

### 사용처 추적과 삭제 차단

→ [하위 문서](CLE-INT-MANAGE-RUN.md#사용처-추적과-삭제-차단)

### 연결 테스트

→ [하위 문서](CLE-INT-MANAGE-RUN.md#연결-테스트)

### 워크플로우 에디터

→ [하위 문서](CLE-INT-MANAGE-RUN.md#워크플로우-에디터)

### 감사 로그

→ [하위 문서](CLE-INT-MANAGE-RUN.md#감사-로그)

### 에러 코드

→ [하위 문서](CLE-INT-MANAGE-API.md#에러-코드)

## Rationale

다른 문서가 링크하던 결정 제목은 같은 제목으로 남기고 본문이 있는 하위 문서로 잇는다.

### 나간 멤버의 개인 통합은 나갈 때 지운다 (2026-10-29)

→ [하위 문서](CLE-INT-MANAGE-PERM.md#나간-멤버의-개인-통합은-나갈-때-지운다-2026-10-29). 잠금 순서는 [통합 쓰기의 잠금 순서](CLE-INT-MANAGE-PERM.md#통합-쓰기의-잠금-순서) 가 정한다.

### 나간 멤버의 개인 통합으로 바꾸는 전환은 거절한다 (2026-10-29)

→ [하위 문서](CLE-INT-MANAGE-PERM.md#나간-멤버의-개인-통합으로-바꾸는-전환은-거절한다-2026-10-29)

### 개인 통합의 역할 하한과 노드 사용 기준을 정한다 (2026-10-24)

→ [하위 문서](CLE-INT-MANAGE-USE.md#개인-통합의-역할-하한과-노드-사용-기준을-정한다-2026-10-24)

#### 실행 시점 거절도 없는 통합과 같은 노드 에러다

→ [하위 문서](CLE-INT-MANAGE-USE.md#실행-시점-거절도-없는-통합과-같은-노드-에러다)

#### 공개 범위 전환에는 관리자 이상 라우트 가드를 붙인다

→ [하위 문서](CLE-INT-MANAGE-USE.md#공개-범위-전환에는-관리자-이상-라우트-가드를-붙인다)

#### 뷰어도 자기 개인 통합을 보고 지울 수 있다

→ [하위 문서](CLE-INT-MANAGE-USE.md#뷰어도-자기-개인-통합을-보고-지울-수-있다)

#### 활동 로그는 얻은 통합에만 쓴다

→ [하위 문서](CLE-INT-MANAGE-USE.md#활동-로그는-얻은-통합에만-쓴다)

### 통합 화면은 할 수 없는 변경 동작을 숨긴다 (2026-10-29)

→ [하위 문서](CLE-INT-MANAGE-DETAIL.md#통합-화면은-할-수-없는-변경-동작을-숨긴다-2026-10-29)

### 자격 증명 교체의 연결 테스트 실패는 400 이다 (2026-11-12)

→ [하위 문서](CLE-INT-MANAGE-RUN.md#자격-증명-교체의-연결-테스트-실패는-400-이다-2026-11-12)

### 설치 대기 연결 테스트는 200 과 `success:false` 로 거절한다

→ [하위 문서](CLE-INT-MANAGE-RUN.md#설치-대기-연결-테스트는-200-과-successfalse-로-거절한다)

### 요구사항 변경 이력

번호는 그대로 두고 뜻을 바꾼 요구사항과 그 이유다.

2026-10-29, Task CLE-T-TGZGM9. 새 요구사항은 065 · 066 이다.

- REQ-INTMGMT-005: Cafe24 Private·MakeShop 의 `oauth/begin` 이 설치 대기 행을 만드는 것도 생성이라고 더했다. 이 경로는 이름 UNIQUE 에 걸리면 `RESOURCE_CONFLICT` 를 냈다. 만료된 설치 대기 행이 상점 자리를 놓게 되면서([OAuth 연결과 토큰 갱신](CLE-INT-OAUTH.md#만료된-설치-대기-행은-상점-자리를-놓는다-2026-10-29)) 같은 상점을 다시 등록하는 begin 이 만료 행의 이름과 겹치는 일이 생긴다. Cafe24 Private 의 기본 이름은 상점 식별자로 만들어서 같은 상점이면 이름도 같다. 사용자가 이름을 바꿔 다시 시도할 수 있게 이름 칸에 에러로 표시되는 코드를 낸다.
- REQ-INTMGMT-019: 멤버가 나가거나 제거될 때의 삭제는 이 거절을 거치지 않는다고 더했다. 나간 멤버의 개인 통합은 사용처와 관계없이 지운다([나간 멤버의 개인 통합은 나갈 때 지운다](#나간-멤버의-개인-통합은-나갈-때-지운다-2026-10-29)).

2026-10-29, Task CLE-T-G56XCH. 새 요구사항은 067 이다.

- REQ-INTMGMT-066: 잠금 순서를 워크스페이스(`FOR KEY SHARE`), 멤버십(`FOR SHARE`) 순으로 고치고 멤버십이 있는지만 본다고 더했다. 멤버십만 먼저 잠그면 워크스페이스 삭제·소유자 이양과 교착할 수 있었다.
- REQ-INTMGMT-010: 조직에서 개인으로 바꿀 때 통합을 만든 사람이 멤버가 아니면 바꾸지 않는다는 예외(REQ-INTMGMT-067)를 더했다.
- REQ-INTMGMT-005: 지금 동작 문장(«아직 `RESOURCE_CONFLICT` 를 낸다»)을 빼고 [권한](#권한) 절의 «정했지만 아직 코드에 없는 것» 목록으로 옮겼다. 요구는 그대로다.

2026-10-30, Task CLE-T-PS7JQY · CLE-T-395HK2. 068 은 잠금 절 · 에러 표에만 있던 조직 행 잠금 규칙을 요구사항 줄로 올린 것이다. 다른 문서가 개인 통합만 다루는 066 으로 이 규칙을 인용하고 있었다.

- REQ-INTMGMT-066: 잠금 모드(`FOR KEY SHARE`·`FOR SHARE`)를 요구사항 줄에서 빼고 [나간 멤버의 개인 통합은 나갈 때 지운다](#나간-멤버의-개인-통합은-나갈-때-지운다-2026-10-29) 의 잠금 절로 옮겼다. 요구사항 줄에는 «워크스페이스, 멤버십, 통합 순» 과 멤버십 재확인만 남겼다. 잠금 순서를 그 절 한 곳에서 정하려는 것이다(NERV Task `CLE-T-G56XCH` 리뷰 후속). 요구는 그대로다.
- REQ-INTMGMT-005·065·066·067: 구현돼 미구현 표시를 걷었다. [권한](#권한) 의 «정했지만 아직 코드에 없는 것» 에서 이 항목을 지웠다.

2026-10-31, Task CLE-T-KQ37NJ.

- REQ-INTMGMT-012: 자격 증명 암호화에 운영 환경(`NODE_ENV=production`) 한정을 달고 예외를 [통합 데이터와 흐름 「암호화」](CLE-INT-DATA.md#암호화) 로 링크했다. 요구는 조건 없이 적혀 있었지만 실제로 보장하는 것은 운영 환경에서 새로 쓰는 값뿐이다. 운영 환경 가드(`assertProductionConfig`)는 통합 암호화 키(`INTEGRATION_ENCRYPTION_KEY`)가 없으면 서버를 기동하지 않는다. 이 결정의 근거는 [시크릿 저장소 「R13. 통합 암호화 키를 마스터키와 따로 둔다」](CLE-INT-SECRET.md#r13-통합-암호화-키-integration_encryption_key-를-마스터키와-따로-두고-production-에서-키-없이-기동하지-않는다-2026-10-10) 이다. 운영 환경 밖에서는 키가 없으면 경고를 남기고 평문으로 저장한다. 이미 평문으로 저장된 행은 키가 있는 환경에서 그 컬럼을 다음에 쓸 때까지 평문으로 남는다. 이 둘은 보장 밖이다. 옛 평문 행을 다시 암호화하는 수단은 아직 정하지 않았다(2026-10-31, NERV Task `CLE-T-KQ37NJ`).

2026-10-24, Task CLE-T-MG0EQZ. 새 요구사항은 051 부터다. 058~062 는 승인한 초안을 다시 리뷰한 뒤, 063 · 064 는 2026-10-29 에 화면의 역할 게이트를 정하며 더했다.

- REQ-INTMGMT-035: 뷰어의 개인 통합 생성·별칭 수정·자격 증명 교체·삭제를 «허용한다» 던 것을 뒤집었다. 생성·별칭 수정·자격 증명 교체·통합 재인증·추가 권한 요청은 `403 EDITOR_REQUIRED` 로 거절한다. 삭제는 REQ-INTMGMT-051 로 옮겨 계속 허용한다.
- REQ-INTMGMT-036: «통합 소유자의 노드만 쓰게 한다» 를 «노드가 속한 워크플로우의 작성자가 통합 소유자일 때만 쓴다» 로 바꿨다. 노드에는 소유자가 없어 뜻이 정해지지 않았던 문장이다.
- REQ-INTMGMT-031: 라우트 가드가 먼저 막는 뷰어의 요청은 `EDITOR_REQUIRED` 라고 적었다. 라우트 가드는 2026-09-25(`#1399`)부터 그 코드를 냈는데 요구사항 문장은 관리자 미만을 한 코드로 묶어 적었다.
- REQ-INTMGMT-021: 통합을 얻기 전에 끝난 실패는 REQ-INTMGMT-053 을, dry-run 으로 대신한 호출은 REQ-RERUN-053 을 따른다는 문장을 더했다.
- REQ-INTMGMT-031: 공개 범위 전환은 라우트 가드가 관리자 이상으로 막아 뷰어도 `ADMIN_REQUIRED` 라고 더했다([「공개 범위 전환에는 관리자 이상 라우트 가드를 붙인다」](#공개-범위-전환에는-관리자-이상-라우트-가드를-붙인다)).
- REQ-INTMGMT-033: 라우트 가드가 있는 경로는 가드의 역할 거부 코드가 404 보다 먼저 나간다고 더했다. 편집자 이상 가드는 2026-09-25(`#1399`)부터 뷰어에게 그 코드를 냈다. 공개 범위 전환의 관리자 이상 가드는 이 결정으로 붙였다([「공개 범위 전환에는 관리자 이상 라우트 가드를 붙인다」](#공개-범위-전환에는-관리자-이상-라우트-가드를-붙인다)).
- REQ-INTMGMT-054: 적용 범위를 노드 생성·노드 설정 수정·캔버스 저장으로 좁히고 복제·가져오기·버전 복원은 참조를 비운다고 적었다. 앞 문장은 «노드 설정 저장» 이 복원과 가져오기까지 덮는 것처럼 읽혔다(finding 01a16e27-1952-71cf-9885-a781e86095fa).
- REQ-INTMGMT-031(2026-10-25): 뷰어의 조직 통합 삭제도 `ADMIN_REQUIRED` 라고 더했다. [「뷰어도 자기 개인 통합을 보고 지울 수 있다」](#뷰어도-자기-개인-통합을-보고-지울-수-있다) 로 삭제 라우트가 뷰어를 막지 않게 되면서 따라온 변경인데 요구사항 문장에 없었다. 그때 삭제 라우트는 편집자 이상이라 뷰어가 `EDITOR_REQUIRED` 를 받았으므로 클라이언트에 보이는 코드가 바뀐다(finding 01a17058-f45e-72bb-a5aa-610ce260c2e2).
- REQ-INTMGMT-054(2026-10-25): 참조 값이 표현식이면 거절하지도 비우지도 않는다고 더했다. [플랫폼 데이터 모델 「참조의 소속」](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속) 에는 있고 요구사항 줄에는 없었다(finding 01a1705c-cb6b-76e0-a4b7-5e9b0348e9a4).
- REQ-INTMGMT-062(2026-10-25): «통합의 워크스페이스가 실행의 워크스페이스와 같을 때만» 을 «실행 중에 조회해 얻은 통합에만» 으로 바꿨다. 얻은 통합은 워크스페이스 검사를 이미 통과했으므로 앞 조건을 포함한다([「활동 로그는 얻은 통합에만 쓴다」](#활동-로그는-얻은-통합에만-쓴다)).
- REQ-INTMGMT-006(2026-10-29): 위험 영역 탭은 공개 범위 전환이나 삭제를 할 수 있는 사람에게만 보인다고 더했다(REQ-INTMGMT-063, [통합 화면은 할 수 없는 변경 동작을 숨긴다](#통합-화면은-할-수-없는-변경-동작을-숨긴다-2026-10-29)).
