# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0건. 다만 이 PR 의 핵심(V131 dedupe — 되돌릴 수 없는 1회성 운영 데이터 교정 SQL)에 자동 테스트가 전혀 없고(CI/e2e 는 항상 빈 테이블이라 핵심 분기가 원리적으로 실행되지 않음), 사용자 가이드가 이번 PR 이 보안 결함으로 반증한 옛 "워크스페이스 단위 고유" 모델을 그대로 서술하는 등 실질적 WARNING 6건이 발견됨. forced 화이트리스트(database·documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | V131 마이그레이션의 실제 중복-정리 로직(`DO $$` 블록 — 최초 생성 행 보존/나머지 UUID 재발급/chat 건수 집계)이 자동화된 테스트로 전혀 커버되지 않음. 되돌릴 수 없고 운영 데이터에 단 한 번 적용되는 코드인데, CI/e2e 는 항상 빈 테이블에 마이그레이션을 적용하므로 `WHERE d.rn > 1` 분기(실제 정리 로직)가 원리적으로 한 번도 실행되지 않는다. 검증은 plan 문서에 기록된 1회성 수동 프로브뿐 | `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:24-46` | 테스트 DB 에 V001~V130 만 적용 후 합성 중복 행을 심어 V131 SQL 을 실행하는 통합 테스트 추가(최소한 "가장 먼저 만든 행 유지 / 나머지 새 UUID / 재실행 시 0건(멱등)" 단언). 불가하다면 자동화하지 않은 이유를 plan 에 명시 |
| 2 | testing | 동일 `created_at`(진짜 동시 삽입) tie-break 케이스가 수동 프로브·자동 테스트 어디에도 없음 — `ORDER BY created_at, id` 이므로 완전 동일 타임스탬프면 승자가 `id`(UUID) 순으로 결정되어 "가장 먼저 만든 쪽이 원본을 지킨다"는 정책 서술과 어긋날 수 있음 | `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:34` | 발생 가능성이 낮음을 명시하거나, 최소한 헤더 주석/plan Rationale 에 이 tie-break 한계를 기록 |
| 3 | user_guide_sync | 사용자 가이드(`triggers.mdx`)가 이번 PR 이 보안 결함으로 반증한 옛 모델("워크스페이스 도메인 아래에 고유 엔드포인트")을 그대로 서술 — 실제로는 전역 유일(다른 워크스페이스가 같은 경로를 등록할 수 없음)이 이번 PR 이 새로 추가한 보호다. "UUID = 브루트포스 방지" 문구도 복사 등록 방지책인 양 오인될 소지 | `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:87,95`, `triggers.en.mdx:76,84` | 문장을 "시스템 전체에서 유일(다른 워크스페이스가 같은 경로를 등록할 수 없음)"로 정정하고, UUID 발급 문구 옆에 "복사 등록은 전역 UNIQUE 제약이 막음"이라는 단서 추가. `spec/1-data-model.md` 신설 Rationale 문구를 미러링 |
| 4 | documentation | 아직 존재하지 않는 `plan/complete/spec-draft-webhook-endpoint-path-global-unique.md` 경로를 마이그레이션 SQL 헤더·spec Rationale 에 이미 인용(dangling). 마이그레이션 SQL 파일은 append-only 관례라 draft 이동이 이 커밋 이후로 순서가 어긋나면 사후 정정이 어려움 | `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:4`, `V132__trigger_endpoint_path_global_unique.sql:5`, `spec/1-data-model.md` 신설 Rationale 절 | `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md` 를 `plan/complete/`로 이동하는 마지막 단계가 이 세 참조가 가리키는 커밋과 같은/이후 시점에 실행되도록 순서 강제. 이동 후 `grep -rln`으로 전수 재확인(draft 체크리스트에 이미 계획됨) |
| 5 | side_effect | V131 dedupe 가 `TriggersService`/`setupChannel` 애플리케이션 계층을 우회해 chat-channel 트리거의 `endpoint_path` 를 SQL 로 직접 재발급 — provider(Telegram/Slack/Discord) 콜백 URL 이 갱신되지 않아 해당 채널이 마이그레이션 직후 조용히 끊길 수 있음. 자동 알림·백그라운드 잡 없이 NOTICE 로그 + 소유자 수동 재저장 절차에만 의존(이미 인지·부분 완화된 트레이드오프이나 여전히 유효한 side effect) | `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:40` | 배포 절차(runbook)에 "V131 NOTICE 의 `chat_channel=true` 대상에게 실제 알림을 보냈는지" 체크리스트 항목으로 명시 |
| 6 | maintainability | `@ApiConflictResponse` description 문자열이 `create()`/`update()` 두 데코레이터에 완전히 동일하게 하드코딩되어 있고, 이번 변경도 그 중복을 답습 — 다음에 한쪽만 고치면 Swagger 문서가 조용히 어긋남 | `codebase/backend/src/modules/triggers/triggers.controller.ts:102, 139` | 파일 상단에 `TRIGGER_ENDPOINT_PATH_CONFLICT_DESCRIPTION` 상수를 두고 두 데코레이터가 참조하도록 추출(저장소 내 `integrations.controller.ts` 의 `OAUTH_BEGIN_RESULT_DESCRIPTION` 선례와 동일 패턴) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security / database / requirement (중복 통합) | V131 dedupe 가 chat-channel 트리거를 건드리면 provider 재등록을 SQL 로 수행할 수 없어(WARNING #5 와 동일 근본 원인) provider URL 어긋남이 발생할 수 있음 — 이미 consistency-check 라운드에서 검토·수용된 트레이드오프 | `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:16-18, 40-47` | 배포 시 NOTICE 로그의 `chat_channel=true` 항목 알림 자동화를 후속 검토(WARNING #5 제안과 동일) |
| 2 | database / performance (중복 통합) | V131 dedupe 가 set-based UPDATE 대신 중복 그룹마다 행 단위 개별 `UPDATE` 루프를 실행(N+1 형태). 감사 로그(NOTICE) 요구사항에 따른 의도적 설계이며 예상 영향 행 수는 극소수(복사 등록 흔적)로 전제 | `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:30-46` | 실제 중복 건수가 클 가능성이 있다면 배포 전 `SELECT count(*) ... HAVING count(*)>1` 로 사전 확인 |
| 3 | database / security (중복 통합) | V131→V132 사이 배포 경합(TOCTOU) — 그 사이 새 복사 등록이 끼면 `CREATE UNIQUE INDEX CONCURRENTLY` 가 실패해 invalid 인덱스가 남을 수 있음. 다만 옛 인덱스가 DROP 되지 않아 보호 수준이 이전보다 낮아지지 않고, 복구 절차(V132 헤더 "운영 절차 ①")가 문서화됨 | `codebase/backend/migrations/V132__trigger_endpoint_path_global_unique.sql:13-25` | 배포 파이프라인에 `indisvalid` 자동 확인 스텝 추가(현재는 e2e B6·사람의 Flyway 로그 확인에만 의존) |
| 4 | documentation | V132 헤더의 "운영 절차 ①"(2-파일 협조 복구 패턴)이 `migrations/README.md` §5 기존 표에는 없는 새로운 복구 패턴인데 README 에는 반영되지 않음 | `codebase/backend/migrations/V132__trigger_endpoint_path_global_unique.sql` 헤더 | 같은 패턴이 재발하면 README §5/§6 에 일반화해 추가(이번 PR 범위 필수 아님) |
| 5 | side_effect | V131 raw SQL UPDATE 가 애플리케이션 감사 로그(`audit_log`)를 거치지 않아 영향받은 워크스페이스 소유자가 제품 내 감사 로그 UI 에서 경로 변경 이력을 확인할 수 없음(서버 로그 NOTICE 로만 남음) | `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:40-47` | 배포 후 영향받은 워크스페이스 소유자에게 별도 채널(이메일 등) 통지 절차를 런북에 명시 |
| 6 | scope | 리뷰 diff 의 대부분(51개 파일 중 28개)이 `review/consistency/2026/09/{18,19}/**` 4개 세션 산출물 — 실제 코드 변경(~230줄)에 비해 diff 크기가 매우 크지만, CLAUDE.md 가 강제하는 `--spec`/`--impl-prep` 게이트 4회분과 1:1 대응하는 정식 SoT 산출물로 확인됨(스코프 위반 아님) | `review/consistency/2026/09/18/23_39_46/**` 등 4개 세션 | 없음(관례상 정상, 참고 기록) |
| 7 | scope | 에러 메시지 변경 시 "새 경로를 쓰세요"라는 행동 유도 문구가 원 지적(워크스페이스 문구 제거) 범위를 살짝 넘어 추가됨 — 실질 영향 미미 | `triggers.service.ts` (`rethrowEndpointPathConflict`) | 문제 삼을 정도는 아님 |
| 8 | api_contract | 유일성 범위 전역화는 의도된 breaking change — 복사 등록된(비-chat) 일반 webhook 트리거는 애플리케이션 레벨 알림 없이 DB NOTICE 로만 재발급 사실이 남음 | `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql` 전체 | 배포 노트/운영 절차에 "비채팅 webhook 도 트리거 상세에서 새 URL 재확인 필요" 문구 추가 권장 |
| 9 | api_contract | 유일성이 전역화되면서 이미 UUID(추측 불가한 경로)를 알고 있는 워크스페이스가 409 응답으로 "그 경로가 이미 등록돼 있다"는 사실을 확인할 수 있는 새 oracle 이 생기지만, v4 UUID 를 이미 알고 있어야만 성립해 실질 추가 노출은 거의 없음 | `triggers.service.ts` (`rethrowEndpointPathConflict`) | 없음 |
| 10 | testing | B5 e2e 가 실패한 PATCH(경로 충돌) 이후 대상 트리거의 `endpointPath` 가 부분 반영 없이 원래 값 그대로인지 재확인하지 않음 | `codebase/backend/test/webhook-trigger.e2e-spec.ts` (B5 "(2) 수정" 케이스) | PATCH 실패 후 GET/DB SELECT 로 `endpointPath` 불변 단언 추가 |
| 11 | maintainability | e2e B5 가 `beforeAll` 의 액터 생성·`createWebhookTrigger` 요청 본문 구성을 인라인으로 재구현(멀티-액터 지원 헬퍼 부재) — 파일 내 1회성이고 저장소 전반의 기존 관행과 부합해 심각한 일탈은 아님 | `codebase/backend/test/webhook-trigger.e2e-spec.ts` (B5 블록, 215~292행) | 향후 멀티-액터 e2e 가 늘면 `createWebhookTrigger` 에 override 파라미터를 받도록 일반화 |
| 12 | requirement | plan tracker(`spec-draft-nullable-notation-followups.md`)가 아직 `plan/in-progress/`에 있는 draft 를 `plan/complete/...`로 앞당겨 참조(WARNING #4 와 동일 근본 원인, forward-reference) | `plan/in-progress/spec-draft-nullable-notation-followups.md:4632` | WARNING #4 제안과 동일 — `--impl-done` 통과 후 draft 이동 누락 방지 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·인가 우회·정보 노출 회귀 없음. 잔여 리스크는 운영 절차 준수에 의존(V131↔V132 경합, chat-channel 재등록) |
| performance | LOW | V131 행단위 UPDATE·풀스캔은 의도된 트레이드오프. V132 는 오히려 조회 성능 개선(0.200ms→0.025ms) |
| requirement | NONE | spec·코드·테스트 line-level 일치. plan tracker forward-reference dangling(계획된 순서) |
| scope | NONE | 핵심 변경은 단일 목적에 정확히 국한. consistency 산출물 diff 비중은 정상 게이트 산출물 |
| side_effect | LOW | chat-channel provider URL 어긋남(WARNING), 감사 로그 공백(INFO). 공개 시그니처·계약 영향 없음 |
| maintainability | LOW | Swagger description 리터럴 중복(WARNING), e2e 보일러플레이트 반복(INFO). 전반적으로 양호 |
| testing | MEDIUM | V131 핵심 dedupe 로직 자동 테스트 전무 + tie-break 미검증(WARNING 2건). 나머지 회귀 테스트는 두텁고 정교 |
| documentation | LOW | dangling `plan/complete/` 참조(WARNING). 그 외 문서화 품질은 이례적으로 높음 |
| database | LOW | 인덱스 설계·마이그레이션 절차 안전. TOCTOU·N+1-형태 루프는 이미 문서화된 트레이드오프(INFO) |
| api_contract | LOW | 응답 봉투(code/details/409) 완전 보존. breaking 지점(dedupe 재발급)은 의도된 보안 트레이드오프 |
| user_guide_sync | MEDIUM | 유저 가이드가 이번 PR 이 반증한 옛 "워크스페이스 단위 고유" 모델을 그대로 서술(WARNING). i18n/라벨은 갭 없음 |

## 발견 없는 에이전트

없음 — 11개 에이전트 전원이 최소 1건 이상의 발견사항(대부분 INFO, 일부 WARNING)을 보고함. Critical 은 전원 0건.

## 권장 조치사항

1. V131 마이그레이션의 핵심 dedupe 로직(`DO $$` 블록)에 대한 통합 테스트를 추가하거나(테스트 DB에 합성 중복 행을 심어 실행), 불가하다면 자동화하지 않은 사유를 plan 문서에 명시한다 — 되돌릴 수 없는 1회성 보안 교정 코드가 CI 안전망 밖에 있다는 것이 이번 리뷰의 가장 중요한 지적이다 (WARNING #1).
2. 사용자 가이드(`triggers.mdx`/`.en.mdx`)의 "워크스페이스 단위 고유" 서술을 이번 PR 의 실제 보안 모델(전역 유일)로 정정한다 — 그대로 두면 사용자가 이미 반증된 보안 속성을 신뢰하게 된다 (WARNING #3).
3. `plan/complete/spec-draft-webhook-endpoint-path-global-unique.md` 이동을 이 PR 의 마지막 커밋으로 확정하고, SQL 헤더·spec Rationale 의 참조가 실제 경로와 일치하는지 이동 후 `grep -rln` 으로 전수 재확인한다 (WARNING #4, INFO #12).
4. 동일 `created_at` tie-break 한계를 마이그레이션 헤더 주석 또는 plan Rationale 에 명시적으로 기록한다 (WARNING #2).
5. 배포 런북에 "V131 NOTICE 의 `chat_channel=true` 대상 소유자에게 알림을 보냈는지" 체크리스트 항목과 "V132 적용 후 `indisvalid` 확인" 항목을 추가한다 (WARNING #5, INFO #1·#3).
6. `@ApiConflictResponse` description 문자열을 상수로 추출해 `create()`/`update()` 양쪽이 참조하게 한다 (WARNING #6).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract, user_guide_sync` (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: `database, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명) — forced 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | router 판단상 이번 변경(마이그레이션 2개 + 서비스/컨트롤러 소규모 수정)에 아키텍처 재설계 영향 없음 |
  | dependency | 신규/변경된 외부 패키지 의존성 없음 |
  | concurrency | DB 트랜잭션/락 이슈는 forced 목록의 database·security 리뷰가 커버 |
