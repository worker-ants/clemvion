# Code Review 통합 보고서

## 전체 위험도
**LOW** — 3라운드째 재검토. 핵심 코드(`TriggersService.update()` 부분 객체 `save` 수정)는 1·2라운드 이후 바이트 단위로 변경 없음(architecture/side_effect/concurrency/documentation/database 리뷰가 각각 `git diff`/`git show`로 확인). 이번 라운드가 실제로 추가한 것은 `CHANGELOG.md`·`trigger-transaction-mock.ts` JSDoc·`plan/in-progress/trigger-save-partial-patch.md` 세 곳의 문서/주석 정정뿐이다. Critical 0건, Warning 1건(documentation — CHANGELOG 내부 시제 자기모순), 나머지는 전부 INFO/SPEC-DRIFT/POSITIVE. 라우터 forced 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 완료 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | `CHANGELOG.md` 안에서 이번 PR이 추가한 최신 항목이 "재읽기 뒤 `workflow` 삭제(FK CASCADE)는 시끄러운 실패+롤백"이라고 실측 확정했는데, 바로 아래 이미 main에 merge된 이전 항목(`#1341`, 커밋 `2d20cc3e1`)은 같은 창에 대해 "아직 재지 않았다 · 프로세스 내부 훅이 필요하다"고 서술해 파일 내부 시제가 어긋난다. | `CHANGELOG.md` 최신 절(게이트 24~27) vs 이전 절(게이트 없는 줄 56~62) | 트래커 항목 7 종결 시 이전 항목 문장에 "(2026-09-17 갱신) 이 창은 실측 확정됨 — 시끄러운 실패(23503), 부활 없음"을 추가해 정합화. 차단 사유 아님. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | [SPEC-DRIFT] | `spec/2-navigation/2-trigger-list.md §3`의 ⚠️ "실측되지 않은 잔여" 문구가 이번 PR로 이중으로 낡았다 — (1) "통째 저장" 전제 자체가 깨졌고 (2) "확인되지 않았다"던 ①②가 실제 Postgres+TypeORM e2e로 확정 실측·수정됐다. 코드는 옳고 spec 문구 갱신이 안 됨. developer 자기-반증형 소정정 예외 미해당(문장 작성자가 developer 아님) — planner 후속 필요. | `spec/2-navigation/2-trigger-list.md §3` | 머지 직후 planner 후속 PR에서 ⚠️ 문장을 "① 시끄러운 실패로 실측됨(23503/23502) · ② 실결함이었고 부분 객체 `save`로 수정됨"으로 교체, `trigger-update-save-window.e2e-spec.ts`를 frontmatter `code:`에 등재. plan이 이미 이 항목을 구체적으로 적어둠. |
| 2 | requirement/database/concurrency/api_contract | `if (written.updatedAt) target.updatedAt = written.updatedAt;` 방어 분기는 실제 TypeORM 경로에서 항상 참(실측)이라 falsy 분기를 이름 붙여 단언하는 테스트가 없다. | `triggers.service.ts:713-716` | 조치 불요(비차단). 여유 있으면 non-null assertion 또는 falsy 분기 전용 회귀 테스트 추가 고려. |
| 3 | testing | CHANGELOG/plan이 나열한 락 밖 컬럼 4개(`notification_secret_v2`·`chat_channel_token_v2`·`last_triggered_at`·schedule `name`/`is_active`) 중 e2e가 직접 SQL로 갱신·검증하는 것은 2개뿐. 단위 테스트의 키 집합 단언이 일반화 보호를 제공해 기능적 공백은 아님. | `trigger-update-save-window.e2e-spec.ts:162` | 조치 불요(기존 처분 유지). 여유 있으면 `chat_channel_token_v2` null-write 케이스 추가. |
| 4 | maintainability | Postgres SQLSTATE(`23503`/`23502`) 매직 스트링이 e2e에 리터럴로 2회 등장, 이름 있는 상수 유틸 없음. | `trigger-update-save-window.e2e-spec.ts:135,149` | 낮은 우선순위, 처분 유지. |
| 5 | api_contract/database | 재읽기 뒤 `workflow` FK CASCADE 삭제 경합의 SQLSTATE가 23503→23502로 바뀌었지만 클라이언트 응답은 여전히 일반 500(`INTERNAL_ERROR`)으로 마스킹됨 — 기존 갭, 이번 PR이 새로 만들거나 악화시키지 않음. | `triggers.service.ts` `rethrowEndpointPathConflict`, `http-exception.filter.ts` | 조치 불요 — planner 후속(`spec/7-integrations/15-chat-channel.md §5.4` 404 매핑)으로 이미 등재됨. |
| 6 | side_effect/testing | 공용 트랜잭션 mock(`trigger-transaction-mock.ts`) `save` 폴백이 `undefined` 한정에서 falsy 전반(`null`/`0`/`''`)으로 넓어짐 — 현재 이 값을 쓰는 테스트 없어 무해, 실제 TypeORM도 falsy 미반환이라 실동작과 불일치 아님. | `trigger-transaction-mock.ts:125-132` | 별도 조치 불요, 기록 목적. |
| 7 | architecture | `TriggersService.update()`가 여전히 219줄 단일 메서드에 다수 관심사 혼재(SRP), 서비스 계층이 TypeORM `save()` 컬럼-diff 내부 동작에 직접 의존(DIP). 호출부 1곳 한정이라 즉시 조치 불요. | `triggers.service.ts` `update()` 전체, 680~711행 | 두 번째 호출부 생기면 `TriggerRepository.savePartial()` 류 헬퍼 추출 재검토. |
| 8 | maintainability(POSITIVE) | 이번 라운드 유일 실질 diff가 "재현 불가능한 매직 넘버"(뮤턴트 RED 건수 13→53→60→64/68 이력)를 구체 숫자 대신 재현 규칙 서술로 교체 — 유지보수 부담을 줄이는 개선. | `trigger-transaction-mock.ts:62-69`, `CHANGELOG.md:24-27` | 없음 — 선례로 참고. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | PK/테넌트 주입 경로 없음(재확인), lost-update 수정이 시크릿 회전 상태 관련 결함을 실제로 닫음, 신규 raw SQL 전부 파라미터 바인딩 |
| performance | NONE | 쿼리 구조·직렬화 컬럼 수 불변~약간 감소, e2e는 CI 전용, N+1/블로킹 없음 |
| architecture | LOW | SRP/DIP INFO 3건 재확인(변경 없음), 새 구조적 결함 없음 |
| requirement | LOW | SPEC-DRIFT 1건(재확인), `written.updatedAt` 방어 분기 INFO |
| scope | NONE | 5개 codebase 파일 모두 단일 결함 수정에 직결, 불필요한 리팩토링/기능확장/무관 수정 없음 |
| side_effect | LOW | 응답 one-beat-stale 값, mock 트립와이어 약화 — 둘 다 기존 처분 재확인. 엔티티 리스너/cascade 부재 backend 전체로 확장 재검증(이슈 없음) |
| maintainability | LOW | 핵심 로직 불변, 유일 실질 diff는 문서 개선(POSITIVE). 메서드 길이·매직 SQLSTATE는 기존 INFO 재확인 |
| testing | LOW | 149 passed/1 skipped(무관) 직접 재실행 확인. falsy 분기 테스트 부재, e2e 컬럼 커버리지 2/4 — 모두 비차단 |
| documentation | LOW | 1·2라운드 지적 회귀 없음 확인. 신규 WARNING(CHANGELOG 내부 시제 자기모순) |
| database | NONE | 이번 라운드 신규 커밋은 DB 코드 무영향(문서 전용), 핵심 로직 재확인 |
| concurrency | LOW | 락 키 공유·부분 객체 저장 메커니즘·FK CASCADE loud-failure 설계 모두 불변 재확인 |
| api_contract | NONE | 엔드포인트/DTO/에러 매핑 불변, breaking change 없음 |
| user_guide_sync | NONE | doc-sync-matrix 21행 전원 미매칭 — 순수 내부 영속성 버그 수정 |

## 발견 없는 에이전트

security, performance, scope, database, api_contract, user_guide_sync — 실질적 신규 발견 없이 NONE 판정(전원 재확인성 검증 완료, CRITICAL/WARNING 없음).

## 권장 조치사항

1. (documentation WARNING) `CHANGELOG.md`의 이전 항목(`#1341`) 문구를 최신 실측 상태와 맞춘다 — 트래커 항목 7 종결 시 함께 처리. 차단 사유 아님.
2. (SPEC-DRIFT) `spec/2-navigation/2-trigger-list.md §3`의 ⚠️ 문구를 planner 후속 PR에서 실측 확정 서술로 교체하고 `trigger-update-save-window.e2e-spec.ts`를 frontmatter `code:`에 등재한다. developer 권한 밖 — 코드는 유지.
3. 나머지 INFO(falsy 분기 테스트 부재, e2e 컬럼 커버리지 2/4, SQLSTATE 500 마스킹, mock 폴백 확장 등)는 전부 기존 라운드에서 이미 처분된 비차단 항목으로 이번 라운드에서 추가 조치 불요.
4. 이 PR을 막을 사유는 없다 — Critical 0, 신규 WARNING 1건(문서 자기모순, 비차단)뿐이다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync (13명)
  - **제외**: 아래 표 (1명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 7명 전원 결과 확보 완료 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router가 이번 diff(triggers 서비스 로직 + 테스트 + 문서 정정)에 신규 의존성 추가/버전 변경이 없다고 판단해 제외. 실제로 `package.json`/lockfile 변경 없음(diff 전체 대조 결과 일치). |