# 부작용(Side Effect) 리뷰 — 웹훅 `endpoint_path` 전역 유일 (V131/V132)

## 발견사항

- **[WARNING]** V131 dedupe 마이그레이션이 chat-channel 트리거의 `endpointPath` 를 애플리케이션 계층 없이 직접 변경해, provider(Telegram/Slack/Discord)에 등록된 콜백 URL 과 DB 상태가 어긋난다
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:40` (`UPDATE trigger SET endpoint_path = gen_random_uuid()::text, ...`), 관련 서술 게이트 16~18
  - 상세: 정상 애플리케이션 경로에서 `endpointPath` 가 바뀔 때는 `TriggersService.update()` → chat-channel 트리거면 `setupChannel()`/`rotateBotToken()` 을 통해 provider 쪽 콜백 URL 도 함께 재등록된다(`spec/5-system/15-chat-channel.md` 의 불변식). 그런데 V131 은 순수 SQL `DO $$ ... $$` 블록으로 중복 묶음 중 "나중에 생긴" 행의 `endpoint_path` 를 직접 재발급한다 — 이 갱신은 `TriggersService`/`setupChannel` 경로를 전혀 거치지 않는다. 대상 트리거가 `config ? 'chatChannel'` 이면(마이그레이션 자신이 `is_chat` 으로 식별), provider 에 등록된 webhook URL 은 옛 경로를 계속 가리키므로 그 채널은 마이그레이션 직후 **조용히 끊긴다**. 마이그레이션은 이를 인지하고 `RAISE NOTICE` 로 `chat_channel=true` 개수만 남기며, 복구는 "소유자가 채널 설정을 다시 저장"하는 수동 절차에 전적으로 의존한다(자동 알림·백그라운드 잡 없음). 이는 이미 이번 PR 의 consistency-check 라운드(`review/consistency/2026/09/18/23_39_46/cross_spec.md` WARNING)에서 지적됐고, 이후 라운드에서 "SQL 이 `chat_channel_health` 컬럼을 건드리지 않는다"는 형태로 스펙과의 정합은 맞춰졌다(BLOCK:NO). 하지만 그 정합은 "설계가 스펙과 모순되지 않는다"는 확인일 뿐, "애플리케이션 불변식(엔드포인트 경로 변경 시 provider 재등록 동반)을 SQL 레이어가 우회한다"는 부작용 자체를 없애지는 않는다.
  - 제안: 이미 문서화된 의도적 트레이드오프이므로 코드 변경을 요구하지는 않되, 배포 절차 문서(V132 헤더 "운영 절차 ②")에 "NOTICE 의 chat_channel=true 대상에게 실제로 알림을 보냈는지"를 배포 체크리스트 항목으로 명시하는 것을 권장.

- **[INFO]** 같은 UPDATE 가 애플리케이션 감사 로그(`audit_log`)를 거치지 않아, 영향받은 워크스페이스 소유자의 감사 로그 UI 에는 이 변경이 남지 않는다
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:40-47`
  - 상세: `TriggersService` 의 정상 편집 경로는 `AuditLogsService` 를 통해 `trigger.*` 액션을 기록하지만(`triggers.service.ts` 생성자 주입 확인), V131 은 raw SQL 이라 이 경로를 타지 않는다. 결과값은 Postgres 서버 로그의 `RAISE NOTICE` (트리거 id·워크스페이스 id·chat_channel 여부만, 경로는 의도적으로 미기록)로만 남고, 해당 워크스페이스 사용자가 제품 내 감사 로그 화면에서 "왜 경로가 바뀌었는지" 확인할 방법이 없다. SQL-only 마이그레이션이라는 형식의 구조적 한계이며 우회 방법이 마땅치 않지만, 리뷰 관점에서 "사용자에게 보이는 상태 변경 이력의 공백"으로 기록한다.
  - 제안: 코드 변경 불요. 배포 후 영향받은 워크스페이스 소유자에게 별도 채널(이메일 등)로 통지하는 운영 절차를 V132 헤더 또는 배포 런북에 명시하면 이 공백을 메울 수 있다.

- **[INFO]** V131 이 `updated_at = now()` 를 명시적으로 세팅하지만 이미 `trg_trigger_updated_at` BEFORE UPDATE 트리거(V001)가 모든 UPDATE 에 대해 동일하게 덮어쓴다 — 중복이나 무해
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:40`
  - 상세: `codebase/backend/migrations/V001__initial_schema.sql` 의 `CREATE TRIGGER trg_trigger_updated_at BEFORE UPDATE ON trigger FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();` 가 이미 모든 UPDATE 에서 `updated_at` 을 `NOW()` 로 갱신한다. V131 의 `SET ... updated_at = now()` 는 결과적으로 같은 값을 다시 쓰는 것이라 관측 가능한 부작용은 없다.
  - 제안: 없음 — 정보 제공용.

- **[INFO]** 409 에러 응답의 `message` 텍스트가 변경됐지만("동일 워크스페이스에..." → "그 엔드포인트 경로는 이미 다른 트리거가...") 계약은 `code`/`details.code` 로 명세돼 있어 하위 호환 영향 없음을 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`rethrowEndpointPathConflict` 내부, `message:` 대입부)
  - 상세: `codebase/frontend/src` 전체에서 `TRIGGER_ENDPOINT_PATH_CONFLICT` 문자열 매칭이나 옛 한국어 메시지 문자열("같은 워크스페이스에 그 엔드포인트 경로를")을 참조하는 코드를 찾지 못했다(전수 grep 0건) — 프론트는 `details.field`/`details.code` 로 분기하는 것으로 보인다. 메시지 텍스트 자체는 사용자에게 노출되는 자유 텍스트이며 API 계약 문서(`spec/5-system/3-error-handling.md`)도 `message` 를 계약 대상으로 못박지 않는다.
  - 제안: 없음 — 정보 제공용, 회귀 위험 없음.

- **[INFO]** `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 상수 값 재배선(`idx_trigger_workspace_endpoint` → `idx_trigger_endpoint_path`)은 V132 의 인덱스명 교체와 정확히 짝을 이루고, 이 상수의 유일한 사용처(`isEndpointPathUniqueViolation`)도 같은 파일 안에 있어 다른 호출자로의 파급이 없음을 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:228`
  - 상세: `grep -rn "idx_trigger_workspace_endpoint|idx_trigger_endpoint_path"` 결과 이 상수 정의부·테스트(`triggers.service.spec.ts`, `webhook-trigger.e2e-spec.ts`)·마이그레이션(`V002`, `V132`) 외 참조가 없다. 함수 시그니처(`rethrowEndpointPathConflict(err: unknown): never`, `isEndpointPathUniqueViolation`)도 변경되지 않아 외부 호출자 영향 없음.
  - 제안: 없음.

## 요약

핵심 side effect 는 V131 마이그레이션이 애플리케이션 계층(`TriggersService`/`setupChannel`)을 우회해 chat-channel 트리거의 `endpoint_path` 를 SQL 로 직접 재발급한다는 점이다 — provider 쪽 콜백 URL 이 갱신되지 않아 해당 채널이 마이그레이션 직후 조용히 끊기고, 애플리케이션 감사 로그에도 남지 않는다. 이는 이미 이번 PR 의 consistency-check 라운드에서 검토·인지된 뒤 "NOTICE + 소유자 수동 재저장" 이라는 운영 절차로 명시적으로 수용된 트레이드오프이며, SQL-only 마이그레이션이라는 형식상 자동화하기 어렵다는 점도 타당하다. 그 외 인덱스 교체(V132), 에러 메시지 텍스트 변경, 상수 재배선은 모두 호출자·계약 영향이 없음을 grep 으로 확인했고, 공개 시그니처·인터페이스·전역 변수·환경 변수·네트워크 호출·이벤트/콜백 발생 방식에는 의도치 않은 변경이 없다.

## 위험도

LOW
