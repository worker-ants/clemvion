# 부작용(Side Effect) 리뷰 — 웹훅 `endpoint_path` 전역 유일 (V131/V132)

## 발견사항

- **[WARNING]** V131 dedupe 마이그레이션이 애플리케이션 레이어의 콜백(채팅 채널 provider 재등록)을 우회한 채 `endpoint_path` 를 직접 변경한다
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql` (DO 블록, `UPDATE trigger SET endpoint_path = gen_random_uuid()::text ... WHERE id = r.id`)
  - 상세: 정상적인 애플리케이션 경로(`TriggersService.update()` → `setupChannel`/`rotateBotToken`)에서 `endpointPath` 가 바뀌면 Telegram/Slack/Discord provider 에 등록된 콜백 URL 을 함께 재등록하는 것이 불변식이다(`spec/5-system/15-chat-channel.md` §5.4.1 인근, "endpointPath 변경 PATCH 의 webhook 재등록 경로를 끊지 않는다"). 이 마이그레이션은 순수 SQL `UPDATE` 로 중복 묶음 중 "나중에 만든" 행의 `endpoint_path` 를 조용히 바꾸는데, 그 대상이 `config ? 'chatChannel'` 인 트리거라면 DB 값은 바뀌지만 provider 쪽 콜백 URL 은 옛 경로 그대로 남아 **그 채널의 수신이 마이그레이션 직후 조용히 끊긴다**. 이벤트/콜백(관점 8)이 발생하지 않는 상태 변경(관점 1)이다.
  - 참고: 이 리스크는 마이그레이션 헤더 주석(18~20행)과 V132 헤더의 "운영 절차 ②"에 이미 문서화되어 있고, `RAISE NOTICE` 로 `chat_channel=true` 대상을 남겨 소유자가 수동으로 채널 설정을 다시 저장하도록 안내한다(자동화된 강제는 없음 — SQL 이 provider API 를 부를 수 없다는 제약 때문). 즉 완전히 미인지된 부작용은 아니지만, **실행 강제 수단이 NOTICE 로그 확인이라는 사람 개입 하나뿐**이라 운영자가 그 NOTICE 를 놓치면 감지되지 않고 남는다. e2e(`trigger-endpoint-path-dedupe.e2e-spec.ts`)는 NOTICE 문구·건수만 검증하고, 재등록 누락 자체를 감지하는 후속 알림·모니터링은 없다.
  - 제안: (a) NOTICE 목록을 로그 확인에만 의존하지 말고 별도 테이블/트래커에 영속 기록해 운영 체크리스트로 강제하거나, (b) 배포 직후 `config ? 'chatChannel'` 이면서 `updated_at` 이 이 마이그레이션 시각과 일치하는 트리거를 질의하는 후속 점검 스크립트를 README §6 절차에 명시. (이미 consistency checker `cross_spec.md` 가 WARNING 으로 같은 지점을 지적했음 — side-effect 관점에서도 동일 결론.)

- **[INFO]** V131 이 만드는 새 `endpoint_path` 는 원래 등록돼 있던 외부 서비스(GitHub/Stripe 등)의 웹훅 URL 을 조용히 무효화한다 (의도된 보안 수정의 부작용)
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql` 42행 `UPDATE trigger SET endpoint_path = gen_random_uuid()::text ...`
  - 상세: 이 UPDATE 는 "나중에 등록된 쪽"(복사 흔적으로 간주되는 쪽)의 URL 을 되돌릴 수 없게 바꾼다(파일 끝 "DOWN: 되돌릴 수 없다"). 정책상 정상 경로로는 워크스페이스 간 중복이 생기지 않는다는 전제(복제·가져오기는 트리거를 옮기지 않음)에 근거해 "복사=공격"으로 간주하지만, 이 전제가 100% 는 아닐 경우(예: 과거 버그로 생긴 우연한 중복) 무고한 워크스페이스의 실제 운영 중인 웹훅이 예고 없이 끊길 수 있다. 사용자 결정(2026-09-18)에 따른 의도된 트레이드오프이므로 결함으로 보진 않으나, side-effect 관점에서 "한 번 실행되면 외부로 나간 URL 을 되돌릴 수 없이 무효화" 라는 비가역적 영향은 명시적으로 기록해 둔다.
  - 제안: 없음(설계 결정 확인용 기록).

- **[INFO]** e2e 프로브(V131)가 만드는 임시 스키마가 비정상 종료 시 공유 e2e DB 에 잔존할 수 있다
  - 위치: `codebase/backend/test/trigger-endpoint-path-dedupe.e2e-spec.ts` (`CREATE SCHEMA v131_probe` / `CREATE TABLE v131_probe.trigger ...`, 이후 `try { ... } finally { await db.query('ROLLBACK'); }`)
  - 상세: `CREATE SCHEMA v131_probe` 는 `IF NOT EXISTS` 가 없고, 원복은 트랜잭션 `ROLLBACK` 에 전적으로 의존한다. 정상/실패(assert throw) 종료 시엔 `finally` 가 롤백을 보장하지만, 프로세스가 강제 종료되거나(OOM, 타임아웃 kill) 커넥션이 비정상적으로 끊기면 트랜잭션이 커밋되지 않은 채 남아 실질적으로는 문제되지 않는다(미종료 트랜잭션은 서버가 정리) — 다만 만약 이 트랜잭션이 어떤 경로로든 커밋되는 변형이 생기면 `v131_probe` 스키마가 공유 e2e DB 에 영구히 남아 다음 실행에서 `CREATE SCHEMA` 충돌로 이 스위트 자체가 깨진다. 현재 코드는 커밋 경로가 없어 실질 위험은 낮다.
  - 제안: 없음(현재 구조로는 안전 — 참고 기록).

- **[INFO]** `TriggersService.rethrowEndpointPathConflict` 의 사용자 응답 `message` 문구 변경은 공개 API 응답 바디의 텍스트를 바꾼다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `rethrowEndpointPathConflict` 내 `message` 필드 (`'같은 워크스페이스에 그 엔드포인트 경로를 쓰는 트리거가 이미 있어요.'` → `'그 엔드포인트 경로는 이미 다른 트리거가 쓰고 있어요. 새 경로를 쓰세요.'`)
  - 상세: 계약 SoT(`2-trigger-list.md §3`, `3-error-handling.md §1.10`)는 `code`/`details.field`/`details.code` 만 계약으로 명시하고 `message` 는 자유 텍스트다. 저장소 전체(`codebase/frontend/src`, 다른 백엔드 테스트)를 grep 했을 때 옛 문구를 리터럴로 참조하는 곳은 없어 하위 호환 문제는 없음을 확인했다. 워크스페이스 문구를 제거한 것은 이번 보안 수정(충돌 상대가 다른 워크스페이스일 수 있음)과 일치하는 정확한 수정이다.
  - 제안: 없음(문제 없음, 확인 기록).

- **[INFO]** `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 상수 값 변경(`idx_trigger_workspace_endpoint` → `idx_trigger_endpoint_path`)은 모듈 내부 전용이라 외부 호출자 영향 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:228`
  - 상세: `export` 되지 않은 파일-스코프 `const` 이며, 저장소 전체 grep 결과 이 상수를 참조하는 곳은 `triggers.service.ts` 자신뿐이다. `triggers.service.spec.ts` 는 문자열 리터럴로 인덱스명을 직접 넣는 fixture(`uniqueViolation('idx_trigger_endpoint_path', surface)`)라 상수와 별도로 동기화되어 있고, 옛 이름이 다시 나타나면 `false` 를 반환하도록 명시적으로 테스트된다(3130~3139행). 시그니처/인터페이스 변경에 해당하지 않는다.
  - 제안: 없음.

## 요약

핵심 변경(V131/V132 마이그레이션, 인덱스 명 상수 교체, 에러 메시지 문구 정정, controller Swagger 설명 상수화)은 대부분 스코프가 명확하고 부작용이 잘 억제되어 있다 — 새 전역 변수 도입, 공개 함수 시그니처 변경, 예상 밖 네트워크 호출은 없으며, 문서(mdx/spec)·plan 변경도 텍스트 정정에 그친다. 유일하게 실질적인 side-effect 리스크는 V131 이 순수 SQL 로 `endpoint_path` 를 재발급하면서 애플리케이션 레이어가 보장하는 "endpointPath 변경 시 provider 콜백 재등록" 불변식을 우회한다는 점이다 — 이는 마이그레이션 작성자가 이미 인지하고 NOTICE + 운영 절차로 완화했지만, 강제 수단이 사람이 로그를 확인하는 것 하나뿐이라 채팅 채널 웹훅이 조용히 끊길 여지가 남는다. 나머지(비가역적 URL 무효화, e2e 임시 스키마 잔존 가능성, 에러 메시지 문구 변경)는 이미 문서화됐거나 실질 위험이 낮아 기록 목적의 INFO 로 남긴다.

## 위험도

MEDIUM
