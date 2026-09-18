# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 새 취약점/구조적 결함은 없음(핵심 보안 수정 자체는 견고·검증됨). 유일한 실질 리스크는 V131 마이그레이션이 애플리케이션 레벨 "재등록" 불변식(채팅 채널 provider 콜백 갱신, 외부 웹훅 URL 소유자 통지)을 우회한 채 `endpoint_path` 를 조용히 재발급한다는 점(WARNING, side_effect 리뷰어 MEDIUM 판정) — 이미 문서화·완화되어 있으나 강제 수단이 사람이 로그를 확인하는 것뿐이라 완전 해소는 아니다. forced 화이트리스트(database, documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect / API Contract | V131 dedupe 마이그레이션이 순수 SQL `UPDATE` 로 "복사로 판단된" 트리거의 `endpoint_path`(공개 웹훅 URL)를 소유자 동의·통지 없이 재발급한다. 채팅 채널 트리거의 경우 provider(Telegram/Slack/Discord)에 등록된 콜백 URL 은 옛 경로 그대로 남아 수신이 조용히 끊기고, 일반 웹훅(Stripe/GitHub 등)도 원래 서비스가 옛 URL 로 계속 POST 하면 유실된다. 완화 수단은 `RAISE NOTICE` 로그 + 운영 절차 문서뿐이며 자동 강제(알림·모니터링)는 없다 | `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql` (DO 블록, `UPDATE trigger SET endpoint_path = gen_random_uuid()::text ...`) | NOTICE 대상을 로그 확인에만 의존하지 말고 별도 테이블/트래커에 영속 기록해 운영 체크리스트로 강제하거나, 배포 직후 `config ? 'chatChannel'` + 마이그레이션 시각 일치 트리거를 질의하는 후속 점검 스크립트를 README §6 절차에 추가. 이미 알려진 트레이드오프이므로 재설계 불요, 관측/통지 보강만 권장 |
| 2 | Documentation | 보안 결함(cross-tenant 웹훅 가로채기) 수정인데 `CHANGELOG.md` 에 항목이 없다 — 동일 성격의 직전 트리거 보안/격리 수정 4건(`a9288bf6e`·`cc199df6f`·`2d20cc3e1`·`60be0712a`)은 모두 "문제·수정·잔여위험"을 CHANGELOG 에 기록해 온 선례가 있다 | `CHANGELOG.md` (루트) | 선례 형식대로 Unreleased 섹션에 "워크스페이스 단위 UNIQUE가 전역 라우팅 키를 보호하지 못함 → V131/V132로 전역 UNIQUE화 → 남는 창(지운 경로 재등록, 트래커 등재됨)" 요약 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / API Contract | 지운 웹훅 경로의 재등록(묘비 부재)이 남은 공격 표면 — 이번 스코프 밖으로 명시, 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목으로 등재됨 | `plan/in-progress/spec-draft-nullable-notation-followups.md`, `spec/1-data-model.md` Rationale "남는 틈" | 후속 작업에서 쿨다운/묘비 테이블 도입 검토 (추가 조치 불요, 이미 추적 중) |
| 2 | Security / Concurrency | V131(정리, 트랜잭션)과 V132(전역 UNIQUE 인덱스 생성, CONCURRENTLY)가 별도 커밋이라 그 사이 새 중복이 생기면 인덱스 빌드가 실패해 invalid 인덱스가 남을 수 있음 — 옛 인덱스는 valid 유지라 보호 수준 즉시 저하는 없고, README §6 재실행 절차로 커버됨 | `V132__trigger_endpoint_path_global_unique.sql` 헤더 "운영 절차 ①" | 배포 시 V131→V132 사이 시간 최소화, invalid 인덱스 검증을 배포 파이프라인에 포함 |
| 3 | Architecture | 일회성 SQL 마이그레이션(V131)이 "채팅 채널 트리거" 판정(`config ? 'chatChannel'`)을 애플리케이션 코드(`chat-channel-binder.service.ts`)와 독립적으로 인코딩 — Flyway 이력 파일 특성상 드리프트 위험은 낮고, 저장소 선례(V066)와 일치 | `V131__trigger_endpoint_path_dedupe.sql:35` vs `chat-channel-binder.service.ts:366-369` | 조치 불요 — 같은 패턴 재사용 시 헤더 주석에 "판정 키 변경 시 조용히 놓친다" 명시 관례 유지 |
| 4 | Requirement / API Contract | `TriggersService.findByEndpointPath(workspaceId, endpointPath)` 가 워크스페이스 스코프 시그니처를 그대로 유지하나 현재 호출부가 없는 dead code — 전역 유일 체제 아래 재사용 시 오인 소지 | `codebase/backend/src/modules/triggers/triggers.service.ts` (`findByEndpointPath`) | 실사용처 생기기 전까지 조치 불요, 재사용 시 전역 스코프 조회와 명확히 구분 |
| 5 | Requirement | 마이그레이션/e2e/spec 주석이 아직 `plan/in-progress/`에 있는 draft 를 `plan/complete/` 경로로 인용(dangling) — draft 자신의 체크리스트가 "마지막 커밋에 이동"으로 예고한 정상 미완료 단계 | `V131`/`V132` 헤더, `trigger-endpoint-path-dedupe.e2e-spec.ts:20`, `spec/1-data-model.md:1017` | `--impl-done` 이후 draft 를 `plan/complete/` 로 이동하고 draft 가 적어 둔 grep 검증 수행 |
| 6 | Documentation | `create-trigger.dto.ts`/`update-trigger.dto.ts` 의 `endpointPath` 프로퍼티 레벨 Swagger 설명이 새 "복사 방지(전역 유일)" 의미를 언급하지 않음 — 엔드포인트 레벨 `@ApiConflictResponse` 는 이미 갱신됨 | `create-trigger.dto.ts`/`update-trigger.dto.ts` `endpointPath` `@ApiPropertyOptional` | 프로퍼티 설명에도 "다른 워크스페이스의 트리거와 값이 겹치면 안 됨" 한 문장 추가 권장(필수 아님) |
| 7 | Testing | 채팅 채널 재등록 갭(WARNING #1)을 검증하는 자동 테스트/캐너리가 없음 — 운영 절차로 SQL 밖에 남긴 의도적 설계이나 회귀 안전망 부재 | `trigger-endpoint-path-dedupe.e2e-spec.ts` | dedupe 후 chat-channel 트리거의 재등록 절차 실행 여부를 확인하는 관측 포인트/캐너리 추가 검토 |
| 8 | Maintainability | e2e `B5` 테스트가 생성/PATCH/라우팅 세 독립 시나리오를 한 `it` 블록(87줄)에 담아 실패 시 원인 범위가 넓음 | `codebase/backend/test/webhook-trigger.e2e-spec.ts:215-301` | 필요 시 `describe`/`it.each` 로 분리해 실패 지점 좁히기 (필수 아님) |
| 9 | Maintainability | `(own.body.data as { id: string }).id` 캐스팅이 8줄 간격으로 반복 — 변수 추출 누락 | `webhook-trigger.e2e-spec.ts:275, 283` | `const ownId = ...` 로 한 번만 캐스팅해 재사용 |
| 10 | Performance / Database | V131 dedupe 의 윈도우 함수가 `trigger` 테이블 전체를 스캔·정렬(선두 인덱스 없어 seq scan+sort 가능) — 일회성 마이그레이션이고 정상 규모(5만 행)에서는 무시할 비용 | `V131__trigger_endpoint_path_dedupe.sql:32-40` | 대규모 설치에서 유사 정리 마이그레이션 재작성 시 배치(청크) 처리 검토; 현재는 조치 불요 |
| 11 | Side Effect / Testing | e2e 마이그레이션 프로브(`CREATE SCHEMA v131_probe`, `IF NOT EXISTS` 없음)가 비정상 종료 시 스키마 잔존 이론적 가능성 — 현재 `try/finally ROLLBACK` 구조상 실질 위험은 낮음 | `trigger-endpoint-path-dedupe.e2e-spec.ts:60-64` | `DROP SCHEMA IF EXISTS ... CASCADE` 선행 또는 `CREATE SCHEMA IF NOT EXISTS` 로 한 단계 더 방어(필수 아님) |
| 12 | Scope | consistency-check 4라운드 산출물(`review/consistency/2026/09/18~19/**`)이 diff 대다수를 차지 — CLAUDE.md 가 명시한 정식 워크플로 산출물이라 스코프 이탈 아님 | `review/consistency/**` | 조치 불요 — 컨벤션 부합 확인 |
| 13 | Performance (긍정 확인) | V132 인덱스 교체가 워크스페이스 무관 수신 조회의 인덱스 미스매치를 해소 — 실측 0.200ms → 0.025ms, 인덱스 개수 1:1 교체로 쓰기 오버헤드 증가 없음, `CONCURRENTLY` 로 무중단 | `V132__trigger_endpoint_path_global_unique.sql:21-25` | 조치 불요 — 개선 확인 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 핵심 취약점(cross-workspace 웹훅 가로채기) 수정 확인·e2e 검증됨. 묘비 부재·레이스 윈도우는 INFO(이미 문서화·추적) |
| performance | NONE | 순수 성능 이득(인덱스 교체 0.200ms→0.025ms), dedupe 1회성 스캔은 무시 가능 |
| architecture | NONE | 불변식을 DB 제약 단일 지점으로 집중시킨 우수한 레이어 설계. SQL/app 판정 로직 분리는 구조적 트레이드오프(INFO) |
| requirement | LOW | 기능·spec 정합성 전부 확인됨. dangling plan 경로 참조는 예고된 정상 미완료 단계 |
| scope | NONE | 무관 파일·기능 확장 없음. consistency 산출물 다량 포함은 컨벤션 부합 |
| side_effect | MEDIUM | V131 이 채팅 채널 provider 재등록 불변식을 우회 — 수동 NOTICE 확인에만 의존 (WARNING) |
| maintainability | LOW | e2e 테스트 구조·반복 캐스팅 등 사소한 개선 여지만 존재 |
| testing | LOW | 커버리지 자체는 촘촘(판정 양방향·DB/앱 계층 모두 검증). 채팅 채널 재등록 관측 테스트 부재만 갭 |
| documentation | LOW | 인라인 문서화는 저장소 평균 이상. CHANGELOG.md 미기재가 유일한 실질 공백 (WARNING) |
| database | LOW | 무중단 인덱스 교체 모범 사례. 1회성 전체 스캔은 INFO 수준 |
| concurrency | LOW | 원자적 UNIQUE-violation-catch 패턴 유지, 회귀 없음. V131→V132 레이스 창은 문서화·완화됨 |
| api_contract | LOW | 409 계약·인증/인가 회귀 없음. endpoint_path 동의 없는 재발급이 하위호환 트레이드오프(WARNING과 연결) |
| user_guide_sync | NONE | 매트릭스 20개 트리거 전수 대조, 갱신 누락 0건(직전 라운드에서 이미 KO/EN 정정 반영됨) |

## 발견 없는 에이전트

- **user_guide_sync** — 사용자 가이드 동반 갱신 누락 0건. 유일하게 나올 뻔했던 갭(옛 "워크스페이스 도메인 아래" 서술)은 직전 리뷰 라운드에서 이미 지적·수정(`b9162a877`)되어 이번 changeset 에 반영됨.

## 권장 조치사항

1. **(WARNING #1)** V131 이 재발급한 `endpoint_path` 중 채팅 채널 트리거에 대해 provider 재등록이 실제로 수행됐는지 확인하는 운영 점검(NOTICE 로그 기반 영속 기록 또는 후속 점검 스크립트)을 배포 절차에 명시적으로 추가한다.
2. **(WARNING #2)** `CHANGELOG.md` Unreleased 섹션에 이번 보안 수정(문제/수정/잔여위험)을 저장소 선례 형식으로 기록한다.
3. (INFO, 선택) `create-trigger.dto.ts`/`update-trigger.dto.ts` 의 `endpointPath` 프로퍼티 설명에 전역 유일성 문구를 보강한다.
4. (INFO, 선택) 채팅 채널 재등록 갭에 대한 캐너리/관측 테스트, e2e `B5` 시나리오 분리, 반복 캐스팅 변수 추출 등 유지보수성 개선은 후속 PR 에서 검토한다.
5. 나머지 INFO 항목(묘비 부재, 레이스 윈도우, dead code, dangling plan 참조 등)은 이미 문서화·추적 중이므로 이번 PR 범위에서 추가 조치 불요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync (13명)
  - **제외**: 아래 표 (1명)
  - **강제 포함(router_safety)**: database, documentation, maintainability, requirement, scope, security, side_effect, testing (전원 결과 확보됨 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단 — 이번 changeset(DB 마이그레이션·서비스 상수·spec/문서)에 신규/변경 패키지 의존성이 없어 제외 |
