# 테스트(Testing) 리뷰 — 웹훅 `endpoint_path` 전역 유일 (V131·V132)

## 발견사항

- **[INFO]** V131 dedupe 마이그레이션의 chat-channel 재등록 갭이 테스트로 고정돼 있지 않다
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql` (DO 블록 전체)
  - 상세: e2e 프로브(`codebase/backend/test/trigger-endpoint-path-dedupe.e2e-spec.ts`)는 dedupe 로직 자체(가장 먼저 만든 행 유지·타이브레이크·NOTICE·멱등)를 정확히 검증하지만, 채팅 채널 트리거(`pChatCopy`)가 경로를 재발급받은 뒤 provider(Telegram/Slack/Discord)에 등록된 콜백 URL 이 옛 경로를 계속 가리키는 상태(외부와의 불일치)는 어떤 테스트도 관측하지 않는다. `cross_spec.md` 컨시스턴시 체크가 같은 지점을 WARNING(“chat-channel `setupChannel` 재등록 불변식 우회”)으로 이미 지목했다 — 이는 운영 절차(NOTICE + 소유자 재저장)로 의도적으로 SQL 밖에 남긴 결정이므로 코드 결함은 아니지만, 그 “재등록이 필요하다”는 사실 자체를 검증하는 자동 테스트(예: dedupe 후 `chat_channel_health` 를 degraded 로 표시하거나 별도 알림을 발행해야 한다는 계약)가 없어 회귀를 잡을 안전망이 비어 있다.
  - 제안: 최소한 “V131 이 chat-channel 트리거의 경로를 바꿀 때 애플리케이션 계층 재등록 훅을 타지 않는다”는 사실 자체를 캐너리 테스트(예: `n_chat` NOTICE 개수만 확인하는 현재 테스트에 “재등록 필요 트리거는 트래커에 등재돼 있어야 한다”는 주석 이상의 자동 신호)로 남기거나, 운영 절차가 실제로 실행됐는지 사후 검증하는 관측 포인트를 추가.

- **[INFO]** Swagger 설명 SoT 상수(`TRIGGER_ENDPOINT_PATH_CONFLICT_DESCRIPTION`)가 `create`/`update` 두 데코레이터에서 정말 같은 문자열을 참조하는지 검증하는 테스트가 없다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:50` (상수 선언), `:108`·`:144` (사용처)
  - 상세: 주석이 명시적으로 “한쪽만 고치면 문서가 조용히 어긋난다”는 과거 결함(`OAUTH_BEGIN_RESULT_DESCRIPTION`)을 근거로 상수화했는데, 정작 두 사용처가 상수를 실제로 참조하는지(리터럴로 되돌아가는 회귀) 확인하는 단위 테스트나 swagger 스냅샷 비교가 없다. 다만 이 패턴은 기존 `OAUTH_BEGIN_RESULT_DESCRIPTION` 도 동일하게 테스트가 없어(grep 확인), 이번 PR 이 새로 만든 갭은 아니다.
  - 제안: 우선순위 낮음 — `triggers.controller.spec.ts` 에 `Reflect.getMetadata`(또는 swagger document 생성) 로 두 엔드포인트의 409 설명이 동일 상수 값인지 확인하는 스모크 테스트 1개 추가를 고려.

- **[INFO]** e2e 마이그레이션 프로브가 이전 실행이 남긴 `v131_probe` 스키마 잔존에 대해 방어적이지 않다
  - 위치: `codebase/backend/test/trigger-endpoint-path-dedupe.e2e-spec.ts:60-64` (`CREATE SCHEMA v131_probe`)
  - 상세: `BEGIN` 뒤 `try { CREATE SCHEMA … } finally { ROLLBACK }` 구조라 정상 종료·assertion 실패 시엔 항상 롤백되어 스키마가 남지 않는다. 다만 프로세스가 트랜잭션 도중 강제 종료(SIGKILL/커넥션 강제 종료)되면 `v131_probe` 스키마가 커밋 안 된 상태로 세션에만 존재해 다음 실행에서 `CREATE SCHEMA` 가 충돌할 가능성은 이론상 남는다(실제로는 세션이 끊기면 PostgreSQL 이 자동 롤백하므로 위험은 낮음).
  - 제안: `CREATE SCHEMA v131_probe` 대신 `CREATE SCHEMA IF NOT EXISTS` + 앞단 `DROP SCHEMA IF EXISTS v131_probe CASCADE` 로 한 단계 더 방어해도 좋음 — 필수는 아님.

## 확인된 강점 (참고)

- `trigger-endpoint-path-dedupe.e2e-spec.ts`: Flyway 가 빈 테이블에 적용해 `rn > 1` 분기를 절대 타지 않는다는 갭을 정확히 짚고, 임시 스키마 + `search_path` 치환으로 **마이그레이션 파일 그대로**(사본이나 재작성 없이) 실행해 로직·NOTICE 형식·경로 비노출·타이브레이크(`created_at` 동률 시 `id` 순)·멱등성까지 한 테스트에서 판별 가능한 fixture(그룹 P=3행, Q=2행 동시각, R=중복없음, path 없음)로 문는다. 이는 메모리에 기록된 “판별 fixture는 두 경로가 다르게 판정하는 값이어야 한다” 원칙을 잘 지킨 사례.
- `triggers.service.spec.ts`: 인덱스명 상수 교체(`idx_trigger_workspace_endpoint` → `idx_trigger_endpoint_path`)에 대해 (a) 새 이름으로 좁혀지는 긍정 케이스, (b) 다른 인덱스는 그대로 흘려보내는 부정 케이스, (c) **삭제된 옛 인덱스 이름이 다시 나타나도 더 이상 좁히지 않는다**는 회귀 케이스까지 세 방향을 모두 테스트해, “이름이 바뀌면 조용히 false 를 반환한다”는 JSDoc 상의 설계 근거를 뮤테이션 검증 없이도 이미 코드로 고정해 두었다.
- `webhook-trigger.e2e-spec.ts` B5/B6: 애플리케이션 계층(생성 409·PATCH 409·PATCH 거부 시 DB 값 불변·수신 웹훅이 원래 주인에게 감)과 스키마 계층(`indisvalid`·`indisunique`·`pg_get_indexdef` 로 옛 인덱스 부재·새 인덱스 정의까지)을 모두 실 DB로 검증 — mock 이 흉내 못 내는 실제 unique 위반 형태를 잡는다는 주석의 주장이 실제로 성립한다.
- 두 계층(unit `triggers.service.spec.ts` / e2e `webhook-trigger.e2e-spec.ts`)이 대칭으로 “워크스페이스”라는 단어가 에러 응답에 없어야 한다는 부정 단언(negative assertion)을 공유해, 메시지 문구 회귀를 놓치지 않는다.
- 테스트 격리: 마이그레이션 프로브는 자체 트랜잭션+임시 스키마로 다른 스위트를 락하지 않고, e2e B5 는 매 테스트 `uniqueName`/`uniqueEmail`/`crypto.randomUUID()` 로 새 워크스페이스·경로를 만들어 기존 스위트와 충돌하지 않는다.

## 요약

전반적으로 이 변경(V131/V132 + 서비스/컨트롤러/문서)은 테스트 관점에서 이례적으로 촘촘하다 — 술어 변경의 양방향(좁힘/통과/구-인덱스-이제-통과), 애플리케이션 계층(생성·수정 409, PATCH 거부 시 미반영)과 DB 계층(실 unique violation 형태, 인덱스 유효성·정의) 양쪽, 그리고 SQL 마이그레이션 자체의 로직(타이브레이크·NOTICE·경로 비노출·멱등)까지 각각 전용 테스트로 커버된다. Critical/Warning 급 커버리지 갭은 발견되지 않았고, 남은 항목은 모두 INFO 수준(운영 절차로 의도적으로 자동화 밖에 둔 chat-channel 재등록 갭의 관측 부재, 기존에도 없던 swagger 상수 동일성 테스트, 극히 낮은 확률의 프로브 스키마 잔존 방어)이다.

## 위험도

LOW
