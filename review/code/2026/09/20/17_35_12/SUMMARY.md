# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. `rotate()`의 lost-update/TOCTOU 수정 자체는 건전하나, 신규 안전장치(락 안 재검증 · workspaceId 스코핑)가 뮤테이션 테스트로 실증된 커버리지 갭을 남기고, 권한재검사·머지검증 로직이 락 전/후로 복제되어 있다. 강제 포함(router_safety) 대상 7개(`documentation, maintainability, requirement, scope, security, side_effect, testing`)는 전원 결과 확보됨 — 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | 락 안 재읽기 후 자격증명 재검증(`freshErrors`) 분기를 통째로 지워도 unit 141개 전부 GREEN — 뮤테이션으로 실증한 커버리지 갭 | `codebase/backend/src/modules/integrations/integrations.service.ts:1177-1182` | `동시 rotate (lost update)` describe 에 재읽은 행의 필드 조합이 구조 검증에 실패하는 시나리오 테스트 추가 |
| 2 | 테스트 | 락 안 재읽기 `where` 절의 `workspaceId` 스코핑을 제거해도 unit 141개 전부 GREEN — 뮤테이션으로 실증한 커버리지 갭 | `codebase/backend/src/modules/integrations/integrations.service.ts:1148-1151` | `findOne.mock.calls[1]` 의 `where` 에 `workspaceId` 포함 여부를 단언에 추가 |
| 3 | 아키텍처/유지보수성 | "조직 스코프 권한 재검사" 로직이 락 전(`entity.scope`)/락 안(`fresh.scope`)으로 조건·에러코드·메시지까지 완전히 복제됨 — 보안 직결 코드라 drift 비용이 큼 | `codebase/backend/src/modules/integrations/integrations.service.ts:1093-1099` vs `:1159-1165` | `private assertCanRotate(row, userRole)` 헬퍼로 추출해 두 지점에서 재사용 |
| 4 | 아키텍처/유지보수성 | "credentials 병합 + 구조 검증" 로직이 락 전(`merged`/`baseCreds`)/락 안(`committed`/`freshBase`)으로 변수명만 바뀐 채 복제됨 | `codebase/backend/src/modules/integrations/integrations.service.ts:1104-1118` vs `:1167-1182` | `private mergeAndValidateCredentials(row, patch)` 헬퍼로 통일 (검증 실패 시 스스로 `BadRequestException` throw) |
| 5 | 유지보수성 | `rotate()` 메서드가 144줄(1078~1221)로 길고 책임이 5갈래(입력검증 → 외부 I/O → 트랜잭션 내 재인가·재머지·재검증·UPDATE·재조회 → 감사로그 → 브로드캐스트)로 나뉨 | `codebase/backend/src/modules/integrations/integrations.service.ts:1078-1221` | 트랜잭션 콜백을 `private commitRotation(...)` 으로 추출해 `rotate()` 를 오케스트레이션 함수로 축소 (위 3, 4와 함께 처리하면 자연히 해소) |
| 6 | 부작용/테스트 | 신규 e2e 가 `BEGIN`~`COMMIT` 구간을 `try/finally` 없이 열어 둠 — 구간 내 assertion 실패 시 `locker` 커넥션이 미종결 트랜잭션인 채로 `afterAll` 까지 행 락을 쥐고, 대기 중이던 `pending`(두 번째 rotate 요청)도 정리되지 않음 | `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts:80-122` | `BEGIN` 이후를 `try { ... } finally { await locker.query('ROLLBACK').catch(()=>undefined); }` 로 감싸고 `pending` 도 finally 에서 drain |
| 7 | 범위 | 이번 작업(rotate lost-update)과 무관한 main 브랜치 결함 수정(YAML 파싱 깨짐 수정)이 같은 커밋에 섞여 들어감 — 투명하게 문서화되어 있고 1줄 수정이라 위험은 낮음 | `plan/complete/spec-draft-integration-error-facts.md:2` | 향후에는 "선행 커밋이 깨뜨린 게이트 수정"과 "이번 기능 변경"을 별도 커밋/PR 로 분리 |
| 8 | 문서화 | 같은 클래스의 선례(`trigger-config-lost-update.md`)는 `CHANGELOG.md` 에 항목을 남겼는데 이번 수정에는 대응 항목이 없음 | `CHANGELOG.md` (미갱신), 대조: `CHANGELOG.md:125` | `trigger-config-lost-update` 항목과 같은 형식으로 "Unreleased" 항목 추가 (결함·고친 것·남는 것) + plan 체크리스트에도 반영 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/요구사항/동시성 (긍정) | lost-update 수정이 부수적으로 조직-스코프 인가 TOCTOU 창(요청 시작 시점 스냅샷으로 admin-only 제약을 우회할 수 있던 창)까지 함께 닫음, 대응 테스트 존재 | `integrations.service.ts:1159` (신규 재검사) vs `:1093` (기존 1회성 검사) | 없음 — 개선 사항 |
| 2 | 보안/DB (긍정) | 락 안 재조회가 `workspaceId` 조건을 유지해 테넌트 격리 보존, 이후 부분 `update`/재조회는 같은 트랜잭션 내 락 보유로 안전 | `integrations.service.ts:1148-1151` | 없음 |
| 3 | 보안 | `{ ...freshBase, ...body.credentials }` 는 object-literal spread(`CreateDataProperty`)라 `__proto__` 키가 와도 prototype pollution 벡터 아님 | `integrations.service.ts:1170` | 없음 — 참고 기록 |
| 4 | 보안/DB | 신규 e2e 의 원시 SQL(`FOR UPDATE`, `UPDATE`)은 전부 `$1`/`$2` 파라미터 바인딩 — 인젝션 없음 | `integration-rotate-concurrency.e2e-spec.ts` | 없음 |
| 5 | 성능/DB/동시성 | `pessimistic_write` 대기 상한(lock/statement timeout) 부재 — 같은 모듈 선례(CONC H-3)와 동일 설계, plan 에서 의도적으로 결정. rotate 는 사용자가 반복 클릭 가능한 표면이라 위험 프로파일이 콜백보다 약간 높음 | `integrations.service.ts:1141`, `plan/in-progress/rotate-lost-update.md` INFO 2 | 현재 조치 불요. 향후 고빈도 호출로 바뀌면 debounce 또는 `lock_timeout` 재검토 |
| 6 | 성능 | 트랜잭션 도입으로 DB 왕복 최대 2회→5회 증가, `validateCredentials` 도 rotate 당 2회 호출 — 둘 다 순수/저비용 연산이라 지배 비용(연결 테스트 수 초)에 비해 무시 가능 | `integrations.service.ts` `rotate()` 전체 | 조치 불요 |
| 7 | 요구사항/DB/테스트 (문서화된 트레이드오프) | 두 concurrent rotate 가 서로 다른 credential 필드를 바꾸면 최종 커밋 조합은 어느 쪽 연결 테스트도 실제로 검증한 적 없는 조합일 수 있음 — 코드 주석·plan §B 가 명시적으로 인지·수용 | `integrations.service.ts:1143-1170` | 이미 유예됨, 재지적 불필요 |
| 8 | 요구사항 | 이번 PR 이 새로 추가한 `!fresh`(재읽기 시 행이 사라진 경우) 404 분기는 unit 테스트로 직접 exercise 되지 않음 — 단, 같은 모듈 선례(CONC H-3)도 동일 패턴이라 회귀 아님 | `integrations.service.ts:1152-1157` | 필수 아님, 원하면 뮤턴트 셋에 케이스 추가 |
| 9 | 아키텍처 | "재조회+락+병합" unit-of-work 모양이 서비스 레이어에 인라인된 채 형제 서비스(`integration-oauth.service.ts` CONC H-3)와 동일하게 두 번째로 반복됨(Rule of Three 미달) | `integrations.service.ts:1146-1209` vs `integration-oauth.service.ts:721-785` | 지금 조치 불요, 세 번째 사례 생기면 공통 유틸 검토 |
| 10 | 아키텍처 | unit 테스트가 `findOne` mock 호출 순서(인덱스)로 "락 안 재읽기"를 식별 — 형제 스펙과 동일한 기존 관례 | `integrations.service.spec.ts:1401-1405` | 향후 `rotate()` 앞단에 `findOne` 호출 추가 시 인덱스 가정 재확인 |
| 11 | 아키텍처 | e2e 가 API 계약이 아니라 테이블/컬럼명을 직접 겨냥 — 의도적(암호화 컬럼 우회), 선례(`trigger-config-lost-update.md §C`)와 일치 | `integration-rotate-concurrency.e2e-spec.ts:80-103` | 스키마 변경 시 함께 갱신 필요함을 인지 |
| 12 | 범위 | `review/consistency/**` 에 철회된(superseded) spec draft(409 `INTEGRATION_ROTATE_CONFLICT`)에 대한 검토 산출물 9개가 diff 에 포함 — 정상 절차의 증적, 방향전환 근거는 plan §C 에 기록됨 | `plan/complete/spec-draft-rotate-conflict.md`, `review/consistency/2026/09/20/16_43_05/**` | 조치 불요 |
| 13 | 유지보수성 | 락 전/후 병합 결과 변수명이 `merged` → `committed` 로 바뀌어 "어느 쪽이 실제 저장되는가"가 이름만으로 불명확 | `integrations.service.ts:1107` vs `:1170` | WARNING 3/4 헬퍼 추출 시 자연히 해소 |
| 14 | 유지보수성 (긍정) | 신규 `describe('동시 rotate (lock update)')` 및 e2e 의 네이밍·주석이 시나리오 의도를 명확히 전달 | `integrations.service.spec.ts:1337-1422`, `integration-rotate-concurrency.e2e-spec.ts` | 없음 |
| 15 | 문서화 | `spec/data-flow/5-integration.md` 의 rotate 서술이 신규 잠금 메커니즘을 언급하지 않음 — `--impl-prep` 에서 이미 INFO(비차단)로 확인됨 | `spec/data-flow/5-integration.md:65-67` | 선택 사항, PR 차단 아님 |
| 16 | DB | 저장 후 재읽기(`findOne({ where: { id: entity.id } })`)에 `workspaceId` 필터 없음 — PK 조회라 실질 위험 없고 변경 전 코드도 동일 패턴 | `integrations.service.ts:~1200` | 조치 불요 |
| 17 | 동시성 | `authType` 은 락 안에서 재검증하지 않음 — 현재 어떤 경로도 기존 행의 `authType` 을 변경하지 않아 TOCTOU 아님. 향후 서비스 전환 기능이 생기면 재검토 필요 | `integrations.service.ts:1087` vs 트랜잭션 블록 | 현재 조치 불요 |

## SPEC-DRIFT

없음 — 이번 diff 는 `spec/**` 을 수정하지 않았고(`spec_impact: none` 이 실측과 일치), 철회된 spec draft(409 신설안)는 `/consistency-check --spec` 로 반증되어 코드 전용 처방으로 대체된 정상 이력이다.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 조직 스코프 TOCTOU 도 함께 닫힘(긍정), prototype pollution/인젝션 벡터 없음 |
| performance | LOW | 락 대기 상한 부재·DB 왕복 증가는 저빈도 admin 작업 특성상 의도된 트레이드오프 |
| architecture | MEDIUM | 권한재검사·머지검증 로직이 락 전/후로 완전 복제(WARNING 2건) |
| requirement | LOW | Spec 계약 유지, `!fresh`/재검증 실패 분기 미검증(기존 선례와 동일 패턴) |
| scope | LOW | 핵심 변경은 선언 범위와 정확히 부합, 무관한 main 결함 수정 1건 혼입 |
| side_effect | LOW | e2e 트랜잭션이 try/finally 미보호(WARNING), 생성자 시그니처 변경은 안전 |
| maintainability | LOW | 로직 복제(위 architecture 와 동일 지적)+`rotate()` 144줄 장문 |
| testing | MEDIUM | 신규 안전장치 2건(재검증·workspaceId 스코핑)이 뮤테이션 테스트로 커버리지 갭 실증 |
| documentation | LOW | CHANGELOG.md 미갱신, 그 외 주석·spec 인용 전부 정확 |
| database | LOW | 트랜잭션·락 설계 건전, 파라미터화 쿼리, 마이그레이션 없음 |
| concurrency | LOW | 단일 행 락으로 데드락 경로 없음, 락 대기 상한 부재는 기존 트레이드오프 |

## 발견 없는 에이전트

없음 — 11개 reviewer 모두 최소 1건 이상(INFO 포함)의 발견사항을 보고함. Critical 급 발견은 어느 reviewer 에서도 없었음.

## 권장 조치사항

1. `mergeAndValidateCredentials` / `assertCanRotate` private 헬퍼를 추출해 락 전/후 중복 로직을 단일화한다(WARNING 3, 4, 5, INFO 13 동시 해소) — 보안 직결 코드의 drift 위험을 없애는 가장 중요한 조치.
2. 락 안 재검증(`freshErrors`)과 `workspaceId` 스코핑 각각에 대해 뮤테이션으로 실증된 커버리지 갭을 메우는 테스트를 추가한다(WARNING 1, 2) — 삭제·오조건 회귀를 잡을 최소 안전망.
3. 신규 e2e 의 `BEGIN`~`COMMIT` 구간을 `try/finally` 로 감싸 assertion 실패 시 트랜잭션·대기 요청이 정리되도록 한다(WARNING 6).
4. `CHANGELOG.md` 에 이번 lost-update 수정 항목을 선례(`trigger-config-lost-update`)와 같은 형식으로 추가한다(WARNING 8).
5. (선택, 저비용) 향후 별도 PR 에서는 "선행 커밋이 깨뜨린 게이트 수정"과 "이번 기능 변경"을 커밋을 분리해 리뷰·bisect 용이성을 높인다(WARNING 7).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency` (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨, 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단상 이번 diff 와 관련도 낮음 (신규/변경 의존성 없음) |
  | api_contract | 외부 API 계약(엔드포인트 시그니처·응답 스키마) 변경 없음 |
  | user_guide_sync | 사용자 가이드/문서 동기화 대상 변경 없음 |
