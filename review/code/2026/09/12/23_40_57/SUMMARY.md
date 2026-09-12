# Code Review 통합 보고서

## 전체 위험도
**LOW** — keyset 커서(id 성분) UUID 형태 검증 추가는 CRITICAL 없이, 테스트 커버리지 갭(e2e 미검증·stale 주석)과 이미 트래커에 등재된 기존 계약 비대칭(WARNING 5건)만 남는 국소적·견고성 강화 수정. forced(router_safety) whitelist 7개(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 확인됨 — 누락 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 이 수정이 의존하는 핵심 전제("비-UUID 문자열이 `uuid` 컬럼에 바인딩되면 Postgres 가 22P02 로 거부한다")가 실 DB 를 태우는 e2e 로 한 번도 검증되지 않음 — 두 신규 테스트 모두 `createQueryBuilder`/`andWhere` 를 mock 해 "검증 로직이 값을 거부하는지"만 확인하고 "그 값을 통과시켰을 때 Postgres 가 정말 22P02 를 내는가"는 아무 데도 확인하지 않음. 저장소에 동일 판단 원칙의 선례(`webhook-trigger.e2e-spec.ts:184` B4)가 이미 존재 | `login-history.service.spec.ts:194`, `background-runs.service.spec.ts:633` (둘 다 mock 기반); 관련 실DB e2e: `test/session-revocation.e2e-spec.ts`, `test/background-monitoring.e2e-spec.ts` (잘못된 커서 id 케이스 부재) | 두 e2e 스펙에 잘못된 id 성분을 가진 커서 요청 케이스를 각 1건 추가 — 응답이 500 이 아니라 CHANGELOG 가 약속한 200/1페이지 또는 400 `INVALID_CURSOR` 인지 확인 |
| 2 | Testing | `isUuidShaped` 의 "프로덕션 호출부는 1곳뿐"이라는 기존 테스트 주석이 이번 PR 로 거짓이 됐는데 갱신되지 않음(이제 3곳: workspace-context 1곳 + 이번에 추가된 2곳) | `codebase/backend/src/common/utils/uuid.spec.ts:54-57` | "한 곳뿐이다" 서술을 3곳으로 갱신하거나, 개수 주장 대신 "호출부 전수는 grep 으로 확인"으로 완화 |
| 3 | API Contract | 동일한 실패(비-UUID 커서 id)에 대해 두 keyset 커서 엔드포인트가 서로 다른 wire 계약을 유지·강화 — `login-history` 는 조용히 무시(200, 1페이지), `background-runs` 는 400 `INVALID_CURSOR`. `spec/2-api-convention.md §8.2` 의 단일 표준(opaque base64 + 실패 시 400)과 어긋나는 기존 비대칭을, 통일 대신 "각자 강화"하는 방향으로 처리해 수명을 연장시킴 | `login-history.service.ts:65` vs `background-runs.service.ts:178-180` | 이번 배치 자체는 되돌릴 필요 없음(근거 충분). `plan/in-progress/keyset-cursor-uuid-validation.md §C` / `spec-draft-nullable-notation-followups.md` 에 이미 등재된 planner 결정(§8.2 예외 vs 통일)을 조기에 닫을 것 |
| 4 | Maintainability / Documentation / Architecture / Scope / Dependency (중복 지적, 5개 리뷰어) | 22P02→500 마스킹 근거·`isUuidShaped` 선택 이유·spec Rationale 인용을 설명하는 ~12줄 주석 블록이 두 프로덕션 파일에 거의 그대로 복제됨(검증 로직 자체는 공유 유틸 재사용이라 중복 아님, 주석만 comment-drift 위험) | `login-history.service.ts:53-65`, `background-runs.service.ts:165-180` | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재됨(주석-only, 이번 배치 수렴 기준 밖). 후속 작업 시 상세 근거를 `common/utils/uuid.ts` 의 `isUuidShaped` JSDoc 한 곳으로 모으고 호출부는 짧은 참조로 압축 |
| 5 | Maintainability | 신규 테스트 1건이 파일 내 유일하게 `.then()` promise 체이닝을 씀(나머지 11개는 전부 `async/await`) — 패턴 혼재 시 향후 복사-붙여넣기로 `return` 누락 → vacuous 테스트 위험 | `login-history.service.spec.ts:165` | `async () => { await service.findForUser({...}); expect(...); }` 형태로 통일 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Database | SQL 인젝션 벡터 아님 — 커서 값은 변경 전부터 TypeORM named parameter 로 바인딩됨. 실제 결함은 인젝션이 아니라 22P02 예외가 어떤 필터 분기에도 안 걸려 500 마스킹되던 것(가용성/관측성 문제이지 정보 노출 아님) | `login-history.service.ts:122-127`, `background-runs.service.ts:265-273` | 없음 |
| 2 | Security / Database | `isUuidShaped` 는 의도적으로 `isValidUuid` 보다 느슨함(nil UUID·v6/v7 통과) — 인가 판단에 관여하지 않는 리소스 식별자 비교에만 쓰이고, Postgres 가 실제 파싱 가능한 범위와 정확히 일치하도록 고른 선택. `spec/data-flow/12-workspace.md` Rationale 근거 및 대조군 테스트로 고정됨 | `common/utils/uuid.ts` (`UUID_SHAPE_PATTERN`) | 없음 |
| 3 | Security / Performance | 정규식(`UUID_SHAPE_PATTERN`)은 앵커드 + 고정 길이 quantifier 만 사용해 ReDoS/DoS 위험 없음 | `common/utils/uuid.ts:31,42-47` | 없음 |
| 4 | Performance / Database | 검증을 DB 바인딩 이전에 추가해 실패 케이스의 불필요한 DB 왕복을 제거 — 회귀 아니라 개선 방향 | `login-history.service.ts:65`, `background-runs.service.ts:178` | 없음 |
| 5 | Architecture / Database | `GlobalExceptionFilter` 에 22P02→400 중앙집중 분기를 넣는 대안을 명시적으로 검토·기각하고 각 입구에서 조기 검증하는 방향을 택함 — 필터는 값의 출처(클라이언트 입력 vs 서버 서명값)를 모른다는 `spec/5-system/3-error-handling.md §1` 원칙과 정확히 일치하는 레이어 책임 판단 | `plan/in-progress/keyset-cursor-uuid-validation.md §A` | 없음 |
| 6 | Requirement / API Contract | spec 갭 3건(에러코드 카탈로그 미등재, §8.2 단일표준과 `login_history` 예외 미기재, §1.6 각주 분류 불일치)은 developer 권한 밖(`spec/**`)이라 코드를 고치지 않고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로 정당하게 등재 | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불필요 — planner 턴 대기 |
| 7 | Documentation | `isUuidShaped` JSDoc 이 새 소비처(커서 id, 비-인가 컨텍스트)의 확장된 적용 범위를 반영하지 않음(기존 JSDoc 은 워크스페이스 헤더 인가 컨텍스트만 서술) — developer 본인이 plan §B 에서 "적용 범위가 넓어진다"고 이미 인지·기록 | `common/utils/uuid.ts:16-41` (diff 밖) | 위 WARNING #4 항목과 함께 후속 처리 시 반영 |
| 8 | Maintainability | `login-history.service.spec.ts` 에 처음으로 한국어 테스트 타이틀이 등장해 해당 파일 내 기존 일관성(전부 영어)이 깨짐(저장소 전체 컨벤션 위반은 아님) | `login-history.service.spec.ts:165,194` | 낮은 우선순위 — 파일 내 스타일 통일 여부만 정하면 됨 |
| 9 | Dependency | 신규 외부 패키지·락파일 변경 없음 — 저장소 내부 기존 유틸(`isUuidShaped`) 재사용만 | 전체 diff | 없음 |
| 10 | Side Effect / API Contract | 관측 가능 동작 변경(500→200 / 500→400)이 있으나 CHANGELOG 에 "⚠️ 배포 시 확인"으로 명시 고지됨, 함수 시그니처 불변이라 코드 레벨 호출자 영향 없음 | `login-history.service.ts:65`, `background-runs.service.ts:178-180` | 없음 |
| 11 | Documentation / Scope / Requirement | CHANGELOG·plan 문서화가 근거 인용(spec 원문 대조 확인됨)·배포 경고·developer/planner 권한 경계 준수 모두 충실 | `CHANGELOG.md`, `plan/in-progress/keyset-cursor-uuid-validation.md` | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션 벡터 아님, 500 마스킹은 정보 노출 아닌 가용성 문제, `isUuidShaped` 느슨함은 인가 미관여라 안전 |
| performance | NONE | 검증 추가는 DB 왕복 제거로 오히려 개선, ReDoS 없음 |
| architecture | LOW | 근거 주석 복제(기존 추적), 두 디코더 계약 비대칭(기존), 필터 대신 입구 검증 결정은 긍정적 |
| requirement | NONE | 기능 완전, spec 갭 3건은 정당하게 planner 이관, 계약 비대칭은 자기신고된 잔여 결정 |
| scope | NONE | 7개 파일 전부 단일 결함 수정에 종속, 범위 이탈 없음 |
| side_effect | LOW | 500→200/400 관측 가능 동작 변경, CHANGELOG 로 고지됨 |
| maintainability | LOW | `.then()` 패턴 혼재, 근거 주석 복제, 한국어 타이틀 컨벤션 이탈 |
| testing | LOW | 핵심 전제(22P02) e2e 미검증, `uuid.spec.ts` stale 주석 |
| documentation | NONE | CHANGELOG/주석/plan 문서화 충실, 주석 복제·JSDoc 갭은 이미 트래킹됨 |
| dependency | NONE | 신규 의존성 없음, 내부 유틸 재사용 |
| database | NONE | 파라미터화 유지, 인덱스 영향 없음, 필터 미수정 결정 타당 |
| concurrency | NONE | 순수 동기 함수, 공유 가변 상태 없음, 해당 사항 없음 |
| api_contract | LOW | 두 엔드포인트 실패 계약 비대칭(기존, 등재됨), 에러코드 신규 발행 없음 |
| user_guide_sync | NONE | 매칭 후보 2건 모두 정상 흐름 무변경으로 기각, 갱신 대상 없음 |

## 발견 없는 에이전트

- concurrency — 동시성 표면(락·공유 상태·병행 I/O) 자체가 diff 에 없음
- user_guide_sync — 문서 매트릭스 후보 2건 검토 후 정상 사용자 흐름 무변경으로 전부 매칭 기각

## 권장 조치사항

1. (WARNING #1) `session-revocation.e2e-spec.ts`, `background-monitoring.e2e-spec.ts` 에 잘못된 커서 id 케이스를 각 1건 추가해 mock 이 아닌 실 DB 기준으로 "22P02 유발 없이 200/1페이지 또는 400 을 반환하는지" 검증한다.
2. (WARNING #2) `uuid.spec.ts:54-57` 의 "호출부 1곳뿐" 서술을 현재 호출부 수(3곳)에 맞게 갱신하거나 개수 주장을 제거한다.
3. (WARNING #3) `plan/in-progress/keyset-cursor-uuid-validation.md §C` / `spec-draft-nullable-notation-followups.md` 에 등재된 두 엔드포인트 실패 계약 통일 여부를 planner 턴에서 조기에 결정한다.
4. (WARNING #4) 후속 작업 시 두 파일에 복제된 근거 주석을 `isUuidShaped` JSDoc 한 곳으로 모으고 호출부는 짧은 참조로 압축한다(JSDoc 갱신 시 새 소비처 컨텍스트도 함께 반영 — INFO #7).
5. (WARNING #5) `login-history.service.spec.ts:165` 의 `.then()` 체이닝을 `async/await` 로 통일한다.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 전체 14개 reviewer 실행(forced whitelist 7개: documentation, maintainability, requirement, scope, security, side_effect, testing 포함, 전원 결과 확보됨).