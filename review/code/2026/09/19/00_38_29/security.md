# 보안(Security) 코드 리뷰 — 웹훅 `endpoint_path` 전역 UNIQUE 전환

## 컨텍스트

이 변경은 그 자체가 보안 결함(웹훅 가로채기 / 크로스-테넌트 라우팅 충돌) 수정이다. `trigger.endpoint_path`
는 `/api/hooks/:endpointPath` 라는 워크스페이스 무관 전역 라우팅 키인데, 기존 유일성 제약이
`(workspace_id, endpoint_path)` 워크스페이스 단위였다. 경로 값(UUID)을 알고 있는 제3의 워크스페이스가
같은 값으로 자기 트리거를 등록하면 워크스페이스 필터 없이 조회하는 수신 경로(`hooks.service` ·
`public-webhook-throttle.guard` · `embed-config.service`)가 둘 중 하나를 골라, 원 소유자에게 가야 할
수신 웹훅이 복사한 쪽 워크플로로 갈 수 있었다 — 사실상 크로스-테넌트 IDOR/가로채기다. V131(중복 정리)
+ V132(전역 UNIQUE 인덱스 교체)로 DB 레벨에서 이를 막는다.

## 발견사항

- **[INFO]** 마이그레이션 SQL 자체에는 인젝션 벡터 없음 — 확인만
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:40` (`UPDATE trigger SET endpoint_path = gen_random_uuid()::text ... WHERE id = r.id;`), `:41` (`RAISE NOTICE 'V131: trigger % (workspace %, chat_channel=%) ...', r.id, r.workspace_id, r.is_chat;`)
  - 상세: `DO $$ ... $$` 블록 안의 `UPDATE`/`RAISE NOTICE` 는 문자열 concatenation 이 아니라 PL/pgSQL 바인딩(`%`/컬럼 참조)만 사용해 동적 SQL 조립이 없다. `r.id`/`r.workspace_id` 는 `trigger` 테이블에서 읽은 값이고 사용자 요청 경로로 직접 주입되지 않는다. 새 `endpoint_path` 는 `gen_random_uuid()`(CSPRNG, 서버 생성)로만 만들어지며, 기존 DB `CHECK` 제약(`chk_trigger_endpoint_path_uuid`, `V102`/`V103` — v4 UUID 정규식)을 그대로 통과한다. 인젝션·제약 위반 우려 없음.
  - 제안: 없음(확인용).

- **[INFO]** 409 충돌 응답에 상대측 식별 정보(트리거 id·워크스페이스 id)가 없음 — 확인만
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `rethrowEndpointPathConflict` 메서드(게이트 1656~1663줄, 특히 메시지 문자열은 1660줄 · `details` 객체는 1656~1663줄 범위) — `TRIGGER_ENDPOINT_PATH_CONFLICT`
  - 상세: 유일성이 전역이 되면서 충돌 상대가 다른 워크스페이스일 수 있게 됐는데, 에러 메시지("그 엔드포인트 경로는 이미 다른 트리거가 쓰고 있어요")와 `details`(`{field:'endpoint_path', code:'TRIGGER_ENDPOINT_PATH_CONFLICT'}`)는 상대 트리거의 id·워크스페이스 id·이름을 담지 않는다. "동일 워크스페이스" 라고 잘못 단정하던 옛 문구도 제거됐다(`triggers.service.spec.ts` 게이트 3074~3075줄, `webhook-trigger.e2e-spec.ts` 게이트 244·388~389줄에 해당하는 부정 단언 `not.toContain('워크스페이스')` 로 검증됨). 정보 노출 회귀 없음.
  - 제안: 없음(확인용).

- **[INFO]** `idx_trigger_workspace_endpoint`(구 인덱스) 이름 재등장 시 안전한 방향으로 열려 있음 — 확인만
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:228` (`const TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX = 'idx_trigger_endpoint_path';`), 테스트는 `triggers.service.spec.ts` 게이트 3135~3139줄
  - 상세: 인덱스 이름으로 `endpoint_path` 충돌만 좁혀서 409 로 바꾸는 구조라, 상수 값이 실제 DB 인덱스 이름과 어긋나면 "조용히" 이 판별이 `false` 가 되어 전역 `RESOURCE_CONFLICT`(일반 500 아님)로 흘러간다 — fail-open 이 아니라 fail-safe 방향. 옛 이름(`idx_trigger_workspace_endpoint`)이 다시 인덱스명으로 쓰여도 오판정으로 좁혀지지 않도록 새 테스트가 명시적으로 문다. 인가·인증 우회로 이어지는 실패 모드 아님.
  - 제안: 없음(확인용).

- **[INFO]** V131→V132 사이의 배포 경합 창구는 이미 문서화되고 안전한 방향으로 닫혀 있음
  - 위치: `codebase/backend/migrations/V132__trigger_endpoint_path_global_unique.sql:21~25`(0) DROP → CREATE UNIQUE CONCURRENTLY → 옛 인덱스 DROP 순서), 서술은 V131 파일 헤더(운영 절차 서술 부분, `V131__trigger_endpoint_path_dedupe.sql` 헤더 주석)와 V132 헤더의 "운영 절차 ①"
  - 상세: V131(트랜잭션 dedupe)과 V132(비-트랜잭션 CONCURRENTLY 인덱스 교체) 사이에 다른 워크스페이스가 같은 경로를 복사 등록하면 `CREATE UNIQUE INDEX CONCURRENTLY` 가 중복 키로 실패해 새 인덱스가 invalid 로 남는다 — 이 경우 옛 워크스페이스 단위 인덱스(`idx_trigger_workspace_endpoint`)는 DROP 되지 않은 채 valid 로 남아 보호 수준이 이전보다 낮아지지 않는다(파일이 3개 statement 를 순차 실행하고, 두 번째 statement 실패 시 Flyway 가 세 번째 DROP 을 실행하지 않는 구조와 일치). 실패를 감지한 뒤 수동 절차(V131 DO 블록 재실행 → repair → migrate)를 밟아야 완전히 닫히므로, 그 사이에는 "전역 유일" 보장이 아직 아니고 여전히 워크스페이스 단위 보호만 있는 상태다 — 배포 런북 준수에 의존하는 잔여 리스크이며, 코드 결함은 아니다.
  - 제안: 배포 절차(runbook)에 V132 실행 직후 `indisvalid` 확인(이미 e2e B6 이 이를 검증)을 CI/CD 배포 스크립트에도 자동화해 사람이 놓치는 경우를 줄이면 좋다.

- **[INFO]** V131 dedupe 가 chat-channel 트리거를 건드리면 provider(Telegram/Slack/Discord) 쪽 콜백 URL 과 DB 의 `endpoint_path` 가 어긋나는 기간이 생길 수 있음 — 이미 인지·완화됨, 재확인만
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql` 헤더 주석(채팅 채널 관련 서술 — "채팅 채널 트리거(config ? 'chatChannel')가 새 경로를 받으면 provider 에 등록된 URL 은 옛 경로 그대로다" 문단) 및 `:41`(RAISE NOTICE 의 `chat_channel=%`)
  - 상세: 만약 "중복이 생긴(=복사 공격의 흔적) 두 트리거 중 나중에 만든 쪽"이 채팅 채널이었다면, dedupe 는 그 행의 `endpoint_path` 만 새 UUID 로 바꾸고 provider 에 등록된 webhook URL 은 옛(=원 소유자가 유지하는) 경로를 그대로 가리킨다. `SQL` 계층은 provider API 를 호출할 수 없으므로, 이 좁은 경우엔 마이그레이션 이후에도 provider 가 여전히 원 소유자의 경로로 콜백을 보내는 상태가 (owner 가 채널 설정을 다시 저장하기 전까지) 남을 수 있다 — 이는 이 PR 이 고치는 것과 같은 종류의 크로스-테넌트 라우팅 위험이 이 좁은 edge case 에 한해 운영 절차 완료 시점까지 잔존함을 뜻한다. 이미 `review/consistency/2026/09/18/23_39_46/cross_spec.md` WARNING 으로 지적됐고, NOTICE 로그 + "소유자가 채널 설정을 다시 저장해야 한다"는 운영 절차로 완화하기로 결정된 항목이다(재-flag 아님, 상태 확인 차원). DB 데이터 자체는 dedupe 직후부터 전역 유일하므로 신규 복사 등록은 더 이상 불가능하다 — 잔존 위험은 "이미 존재했던" 극히 드문 chat-channel 중복 건에 한정된다.
  - 제안: 배포 시 V131 NOTICE 로그에서 `chat_channel=true` 항목이 하나라도 있으면, 해당 트리거 소유자에게 알림을 보내는 절차(현재는 수동 "운영 절차 ②")를 트리거 자동화(예: 알림 큐 발행)로 승격하는 것을 후속 검토할 것 — 사람이 로그를 놓치면 그 트리거는 무기한 방치될 수 있다.

## 요약

이 PR 은 실질적인 크로스-테넌트 웹훅 하이재킹(다른 워크스페이스가 알고 있는 `endpoint_path` 를 복사
등록해 수신 트래픽을 가로채는 문제)을 DB 레벨 전역 `UNIQUE` 인덱스로 닫는 보안 수정이며, 새로 도입된
코드에서 인젝션·시크릿 하드코딩·인가 우회·정보 노출 회귀는 발견되지 않았다. 에러 메시지는 "동일
워크스페이스" 라는 이제는 거짓인 단정을 제거했고 상대측 식별 정보를 노출하지 않으며, 인덱스 이름
상수 교체는 실패 시에도 fail-safe(전역 `RESOURCE_CONFLICT` 로 흘려보냄) 방향을 유지한다. 마이그레이션은
`CONCURRENTLY` 교체 순서(신규 DROP→CREATE→구 DROP)로 어느 시점에도 보호 수준이 0 이 되지 않도록
설계됐고, e2e(B5·B6)가 크로스-워크스페이스 충돌·인덱스 유효성을 직접 검증한다. 유일하게 남는 것은
운영 절차(런북) 준수에 의존하는 두 잔여 창구 — (1) V131·V132 사이의 배포 경합, (2) chat-channel
중복 건에 대한 provider 재등록 — 로, 코드 결함이 아니라 이미 문서·트래커에 등재되고 완화 절차가
마련된 항목이다.

## 위험도

NONE
