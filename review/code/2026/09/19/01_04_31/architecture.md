# 아키텍처 리뷰 — 웹훅 `endpoint_path` 전역 유일화 (V131/V132)

## 발견사항

- **[INFO]** 불변식 집행 지점을 세 호출부 대신 DB 제약 하나로 모은 것은 올바른 레이어 선택
  - 위치: `codebase/backend/migrations/V132__trigger_endpoint_path_global_unique.sql:21-25`, `codebase/backend/src/modules/hooks/hooks.service.ts:115`, `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts:70`, `codebase/backend/src/modules/hooks/embed-config.service.ts:44`
  - 상세: 세 호출부(`hooks.service`·`public-webhook-throttle.guard`·`embed-config.service`) 모두 `WHERE endpointPath = ?`(workspace 무관)로 `trigger` 를 조회한다. 이 전제가 성립하려면 `endpoint_path` 유일성이 전역이어야 하는데, 이번 변경 전에는 그 유일성이 `(workspace_id, endpoint_path)` 로만 걸려 있어 조회부의 암묵적 전제와 DB 제약이 어긋나 있었다. 이번 수정은 그 어긋남을 세 호출부 각각에 방어 로직을 추가(중복 검사·재조회)하는 방식이 아니라, 유일성 자체를 전역 DB 제약(`idx_trigger_endpoint_path`)으로 끌어올려 한 곳에서 집행한다. 세 소비처가 늘어도(예: 다른 신규 조회부) 새 제약이 그대로 보호하므로 응집도가 높고 향후 확장에도 유리하다.
  - 제안: 없음 — 참고로 기록.

- **[INFO]** 마이그레이션(SQL)과 애플리케이션(TypeScript)이 "채팅 채널 트리거" 판정 로직을 각각 독립적으로 인코딩
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:35`(`(config ? 'chatChannel') AS is_chat`) vs `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:366-369`(`(trigger.config as { chatChannel?: ChatChannelConfig }).chatChannel`)
  - 상세: 두 곳 모두 "trigger 가 채팅 채널 트리거인가"라는 같은 도메인 판정을 각자 리터럴 키(`'chatChannel'`)로 인코딩한다. SQL 쪽은 SoT 가 없어 애플리케이션 쪽이 이 키를 바꾸면 (이미 지나간) 마이그레이션 파일은 당연히 추적하지 못한다. 다만 (a) 이 파일은 Flyway 원칙상 이미 적용된 뒤 다시 수정되지 않는 이력 파일이라 드리프트가 발생할 미래 시점이 사실상 없고, (b) 같은 JSONB 키 존재 검사 패턴이 `V066__trigger_config_strip_inline_auth.sql` 에도 선례가 있어 이 저장소의 마이그레이션 관례이며, (c) 오분류의 결과도 NOTICE 로그 + 운영 절차(소유자가 채널 재저장)로 낮게 완화되어 있다. 신규 결함이라기보다 "SQL-only 마이그레이션은 런타임 도메인 모델을 재사용할 수 없다"는 이 아키텍처의 근본 제약에서 오는 구조적 트레이드오프다.
  - 제안: 없음(수정 불요) — 다음에 같은 유형(JSONB config 키로 트리거 하위타입을 판별하는 일회성 마이그레이션)을 또 작성할 때는 이번처럼 "판정 키가 바뀌면 조용히 놓친다"는 사실을 헤더 주석에 남기는 관례를 유지할 것.

- **[INFO]** `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 상수가 SQL 마이그레이션의 인덱스 리터럴 이름과 문자열로 결합
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:228`
  - 상세: 이번 diff 는 이 상수의 **값**만 `'idx_trigger_workspace_endpoint'` → `'idx_trigger_endpoint_path'` 로 바꿨을 뿐, 애플리케이션 계층이 DB 인덱스 이름 문자열에 결합되는 기존 설계 자체는 그대로다. 이 결합은 이미 문서화돼 있고(228행 위 주석), 이름이 어긋나면 조용히 `false` 로 fail-safe 하도록 설계했으며, 두 방향(일치→좁힘, 불일치→통과) 모두 단위 테스트(`triggers.service.spec.ts`)로 고정돼 있다. 새로 도입된 결함이 아니라 기존에 검증된 패턴을 값만 재배선한 것이라 이번 diff 범위에서는 문제가 없다.
  - 제안: 없음.

- **[INFO]** Swagger 설명 문자열 SoT 추출은 기존 선례(`OAUTH_BEGIN_RESULT_DESCRIPTION`)와 일관된 패턴
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:50`, 사용처 `:108`, `:144`
  - 상세: `create`/`update` 두 엔드포인트에 중복돼 있던 409 설명 문자열을 모듈 레벨 상수로 뽑아 SoT 를 하나로 만들었다. 프레젠테이션 레이어(Swagger 데코레이터) 안에서 끝나는 변경이라 레이어 경계를 넘지 않고, 저장소의 기존 관례를 그대로 따른다.
  - 제안: 없음.

## 요약

이번 변경의 핵심 설계 결정 — 웹훅 수신 조회 3곳(`hooks.service`·`public-webhook-throttle.guard`·`embed-config.service`)이 공유하는 "workspace 무관 조회" 전제를 각 호출부 방어 로직이 아니라 단일 DB UNIQUE 제약(V132)으로 끌어올려 집행한 것 — 은 결합도를 낮추고 확장성을 높이는 올바른 레이어 선택이다. 일회성 정리 마이그레이션(V131)이 SQL 안에서 "채팅 채널 트리거" 판정을 애플리케이션 코드와 별도로 인코딩하는 지점이 있으나, SQL-only 마이그레이션의 근본적 제약에서 기인한 구조적 트레이드오프이고 이미 저장소 선례(V066)·NOTICE 로그·운영 절차로 완화돼 있어 새 결함으로 보지 않는다. 컨트롤러·서비스 레이어의 나머지 변경(Swagger 설명 SoT화, 인덱스 이름 상수 값 재배선)은 기존에 검증된 패턴을 그대로 따르는 국소적 수정이라 SOLID·레이어 책임·순환 의존성 관점에서 새로운 위반을 찾지 못했다.

## 위험도

NONE
