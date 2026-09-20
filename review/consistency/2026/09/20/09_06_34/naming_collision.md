# 신규 식별자 충돌 검토 — `spec/4-nodes/4-integration/`

## 검토 범위 메모

target 은 `spec/4-nodes/4-integration/{0-common,1-http-request,2-database-query,3-send-email,4-cafe24,5-makeshop}.md` (전부 `status: implemented`, 이미 main 에 병합된 기존 spec). 이번 워크플로의 실제 작업은 `plan/in-progress/ssrf-catch-instanceof.md` (`spec_impact: none`, 코드 레벨 catch-경로 정리)이며 spec 을 직접 변경하지 않는다. 따라서 여기서 "신규 식별자"란 문자 그대로 이번에 새로 추가되는 텍스트가 아니라, impl-prep 스코프로 잡힌 이 spec 영역 전체가 도입한 식별자 집합이다 — 이를 `spec/` 나머지 전체와 대조했다.

## 발견사항

- **[INFO]** Rationale 결정 ID `D4` 가 문서마다 다른 결정을 가리키는 로컬 넘버링
  - target 신규 식별자: `D4` (`spec/4-nodes/4-integration/0-common.md` §4.2 — "IntegrationError 는 pre-flight throw 대신 runtime `port:'error'` 로 라우팅" 결정, 2026-05-17)
  - 기존 사용처: `spec/5-system/4-execution-engine.md:786,1695,1698` 의 `D4`("멀티턴 turn-단위 park" 결정) · `spec/conventions/conversation-thread.md` §8.1 의 `D4`("Preview 1차 소스 = conversationThread snapshot" 결정)
  - 상세: 세 문서 모두 `D4` 를 "그 문서 § Rationale 안에서 몇 번째 결정인가"를 가리키는 로컬 카운터로 쓴다. 프로젝트 전반에 A1/A2a/A2b, B1/B2a/B2b, D1~D6, C-6, W-6, m-4 같은 짧은 결정 라벨이 문서마다 독립적으로 매겨지는 기존 관례이고, 모든 참조가 항상 링크 또는 문맥과 함께 등장해 실제 혼선 사례는 확인되지 않았다(각 언급이 자기 문서 안에서만 재참조됨). 다만 이 라벨을 별도 문맥 없이 (예: 커밋 메시지·plan·리뷰 코멘트에서) "D4 결정" 이라고만 인용하면 어느 문서의 D4 인지 모호해질 수 있다.
  - 제안: 조치 불요(관례가 이미 프로젝트 전역에 정착). 향후 문서 간 결정 라벨을 인용할 때는 파일명을 함께 적는 관행을 유지할 것.

## 검증한 항목 (충돌 없음 확인)

아래 항목들은 target 이 새로 정의/재사용하는 식별자이며, `spec/` 전역 grep 으로 대조한 결과 **의미가 어긋나는 중복 정의는 발견되지 않았다** — 오히려 상호 링크로 명시적으로 동기화되어 있다.

- 에러 코드: `HTTP_BLOCKED` / `DB_HOST_BLOCKED` / `EMAIL_HOST_BLOCKED` / `INTEGRATION_NOT_FOUND`(부재를 명시) — `spec/2-navigation/4-integration.md` §10.4 표, `spec/5-system/3-error-handling.md`, `spec/conventions/chat-channel-adapter.md`(`DB_*` 와일드카드로 `DB_HOST_BLOCKED` 포함) 와 전부 동일 의미로 교차 참조됨.
- 환경변수 `ALLOW_PRIVATE_HOST_TARGETS` — HTTP/DB/Email 세 노드와 `spec/5-system/11-mcp-client.md`(별개 플래그 `MCP_ALLOW_INSECURE_URL` 과 명시적으로 구분), `spec/5-system/1-auth.md` 전부 동일 의미(secure-by-default opt-out) 로 일관.
- Redis 키 `integration:cache:invalidate` / `cafe24:install:nonce:*` / `cafe24:install:fail:*` — `spec/conventions/redis-keys.md` 인벤토리, `spec/5-system/4-execution-engine.md`, `spec/data-flow/5-integration.md` 와 동일 용도로 일치. normative 정의(target §4.4) ↔ 인벤토리(§5 컨벤션)가 서로를 가리키는 단방향 SoT 구조로 중복 정의 없음.
- DB 인덱스명 `idx_integration_workspace_service_mall` (V072), `mall_id` 컬럼의 cafe24/makeshop 이중 투영 — `spec/1-data-model.md` §2.10/§3, `spec/2-navigation/4-integration.md`, `spec/data-flow/5-integration.md` 모두 동일 마이그레이션 번호·의미로 정합.
- API endpoint — `GET /api/integrations/services/:type/catalog` (`OperationCatalogDto`) 는 문서 자체가 기존 `GET /api/integrations/services` (`ServiceCatalogDto`) 와 "명확히 구분" 함을 명시해 신규 도입 시점에 이미 충돌을 인지하고 이름을 분리한 상태. `GET /api/3rd-party/cafe24/install/:installToken` / `GET /api/3rd-party/makeshop/install/:installToken` 은 provider-그룹 path 로 서로 겹치지 않음.
- 파일 경로 — `spec/4-nodes/4-integration/{0-common,1-http-request,2-database-query,3-send-email,4-cafe24,5-makeshop}.md` 넘버링은 다른 노드 카테고리(`4-nodes/1-logic/0-common.md` 등)와 동일한 `0-common + N-<node>` 컨벤션을 따름. `cafe24`/`makeshop` 관련 다른 파일(`spec/conventions/cafe24-*`, `spec/conventions/makeshop-*`)과 이름 중복 없음.
- 요구사항/결정 ID `INT-US-05`, `B-3-7`, `C-6` 등 네임스페이스형 라벨은 grep 결과 각각 정의 문서 + 참조 문서에서만 등장하고 다른 의미로 재사용된 사례 없음. `INT-AU-07`(cafe24 전용 `insufficient_scope` 세분화 참조 ID)은 makeshop 문서(§6/§6.1)에서 "makeshop 은 미구현" 이라는 부재 확인용으로만 인용되며 재정의는 없음.

## 요약

target 스코프(`spec/4-nodes/4-integration/`)는 이미 병합되어 있고 이번 워크플로의 실제 변경 대상(`ssrf-catch-instanceof` 플랜, `spec_impact: none`)과 직접 겹치지 않는 순수 impl-prep 대조 검토다. 에러 코드·환경변수·Redis 키·DB 인덱스·API endpoint·파일 경로 등 신규 식별자로 볼 수 있는 항목들을 `spec/` 전역과 대조한 결과, 의미가 어긋나는 재사용(진짜 충돌)은 발견되지 않았고, 오히려 다수의 항목이 "동일 코드명 재사용 여부"·"명확히 구분" 같은 문구로 충돌 가능성을 이미 스스로 검토·해소한 흔적을 보인다. 유일하게 눈에 띈 것은 `D4` 같은 짧은 결정 라벨이 여러 독립 문서에서 각자 다른 결정을 가리키는 기존 프로젝트 관례이며, 이는 실질적 혼선 사례가 없어 INFO 수준으로만 기록한다.

## 위험도

NONE
