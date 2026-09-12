# Code Review 통합 보고서

## 전체 위험도
**LOW** — keyset 커서(`login-history`, `background-runs`)의 id 성분에 `isUuidShaped` 검증을 추가해 비-UUID 값이 Postgres `uuid` 컬럼에 바인딩되어 22P02 → 500 으로 마스킹되던 결함을 닫은 좁은 범위의 방어적 수정. Critical 없음. forced whitelist(7명: documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보 확인됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `background-runs.service.ts` 쪽에 "정상 v4 UUID 커서가 실제로 쿼리에 반영되어 완주하는" happy-path 유닛 테스트가 없음. 신규 대조군 테스트는 `nodeExecutionRepo.createQueryBuilder` 를 mock 하지 않아 완주를 단언하지 못하고 `code !== 'INVALID_CURSOR'` 만 확인함. 자매 파일(`login-history.service.spec.ts`)의 `CURSOR_UUID` 완주 테스트와 비대칭. `isUuidShaped` 호출부 조건이 뒤집혀도 unit/e2e 어느 쪽에서도 잡히지 않음 | `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts:633-681` | `nodeExecutionRepo.createQueryBuilder` 체인을 완전히 세운 뒤, 유효 v4 UUID 커서로 `getBackgroundRun` 이 정상 완주하고 `fetchBodyPage` 가 올바른 `lastId` 로 필터링했음을 확인하는 케이스 추가 |
| 2 | 문서화 (plan 위생) | plan 체크리스트 항목이 "완료"라고 서술하면서 체크박스는 미체크(`[ ]`) 상태로 불일치 — 실제로 `CHANGELOG.md` 에 해당 항목은 이미 반영됨(서술이 맞고 체크박스가 뒤처짐) | `plan/in-progress/keyset-cursor-uuid-validation.md:160` | `- [x] CHANGELOG (완료 — 관측 가능한 변경 2건)` 로 체크박스를 실제 상태에 맞춰 정정 |
| 3 | API 계약 / 아키텍처 | 동일 개념(malformed keyset 커서)에 대해 두 엔드포인트의 실패 계약(무시 후 1페이지 vs 400 `INVALID_CURSOR`)이 통일 없이 이번 변경으로 각각 강화되어 비대칭이 사실상 굳어짐. `spec/5-system/2-api-convention.md §8.2` 의 단일 표준(opaque + 400)과도 어긋남 | `plan/in-progress/keyset-cursor-uuid-validation.md §C`, `login-history.service.ts` `decodeCursor` vs `background-runs.service.ts` `decodeCursor` | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목(계약 통일 여부, §8.2 예외 각주 여부)으로 등재됨 — 이번 PR 범위 외 후속 조치로 충분, "완전히 해소된 상태 아님"만 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | 두 keyset 커서 디코더에 거의 동일한 12줄짜리 근거(rationale) 주석이 복제됨(`isUuidShaped` 선택 이유, 22P02→500 마스킹 메커니즘, spec Rationale 인용). 검증 로직 자체는 공유 유틸 재사용이라 중복 아님 | `login-history.service.ts:53-65`, `background-runs.service.ts:165-181` | 상세 근거는 `common/utils/uuid.ts` 의 `isUuidShaped` JSDoc 한 곳으로 모으고 각 호출부는 짧은 참조로 압축하는 것을 고려(모집단 2 · 인코딩 상이라 코덱 추출은 plan 에서 이미 보류됨) |
| 2 | 보안 / 부작용 | `GlobalExceptionFilter` 는 여전히 SQLSTATE 22P02 를 분류하지 않아, 이번에 닫힌 두 경로 밖의 다른 입구로 비-UUID 값이 uuid 컬럼에 도달하면 같은 500 마스킹이 재발할 수 있음. 필터 레벨 일괄 매핑은 `spec/5-system/3-error-handling.md §1` 원칙과 충돌한다는 근거로 명시적으로 기각·won't-do 종결됨 | `plan/in-progress/keyset-cursor-uuid-validation.md §A`, `plan/in-progress/spec-draft-nullable-notation-followups.md` | 이미 후속 항목으로 등재됨 — 향후 동일 클래스의 새 입구가 생길 때마다 개별 입구단 검증 필요 |
| 3 | 요구사항 / 테스트 | `decodeCursor` 분기는 unit(4개 회귀 + 4개 뮤테이션, 전부 예측대로 RED)으로 강하게 고정되어 있으나, HTTP 응답 코드(200/400)까지 확인하는 e2e 는 없음 | `login-history.service.spec.ts`, `background-runs.service.spec.ts` | 필수는 아니나, 라우팅/필터 계층 변경 시 unit 만으로 못 잡을 회귀 대비 후속 e2e 고려 |
| 4 | 문서화 | CHANGELOG 의 엔드포인트 표기가 실제 라우트 파라미터명(`:executionId`/`:backgroundRunId`)과 다르게 축약(`:id`/`:runId`)됨 — 의미 전달에는 지장 없음 | `CHANGELOG.md:12` | `GET /api/executions/:executionId/background-runs/:backgroundRunId` 로 정정(선택 사항) |
| 5 | 데이터베이스 (범위 밖) | `login_history` 의 keyset 정렬 키는 `(created_at, id)` 튜플이나 기존 인덱스는 `(user_id, created_at)` 뿐이라 `id` tie-breaker 가 인덱스에 없음 — 이번 PR 이 만든 문제 아닌 사전 존재 상태 | `codebase/backend/src/modules/auth/entities/login-history.entity.ts` (`idx_login_history_user_created`) | 후속 검토용 참고 — 필요 시 인덱스를 `(user_id, created_at, id)` 3-컬럼으로 확장 고려 |
| 6 | 유저 가이드 동반 갱신 | `login-history.service.ts`(`auth-session-flow-change`)·`background-runs.service.ts`(`run-debug-flow-change`) 가 경로상 semantic 트리거 glob 에 인접하나, 실제로는 로그인/세션/권한 흐름이나 실행·디버깅 UI 흐름의 의미 변경이 아니라 커서 uuid 형태 검증뿐 — 문서 동반 갱신 누락 아님 | `codebase/backend/src/modules/auth/login-history.service.ts`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` | 조치 불요(grey-zone 정보 기록) |
| 7 | API 계약 / 부작용 | 두 엔드포인트에 관측 가능한 breaking status-code 변화(500→200, 500→400)가 있으나 CHANGELOG 에 "⚠️ 배포 시 확인" 문구로 명확히 문서화됨 — 이 fix 의 목적 자체 | `login-history.service.ts:65`, `background-runs.service.ts:178-180`, `CHANGELOG.md` | 조치 불요 — 배포 채널에 실제 전달 여부만 운영에서 확인 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션 경로 없음(파라미터 바인딩 유지)·ReDoS 없음·시크릿 노출 없음. GlobalExceptionFilter 잔여 리스크는 문서화된 won't-do |
| performance | NONE | O(1) 정규식 검증 1회 추가, 알고리즘/DB 왕복 영향 없음 |
| architecture | LOW | 두 디코더 근거 주석 복제, 실패 계약 비대칭이 통일 없이 굳어짐(둘 다 이미 백로그 등재) |
| requirement | LOW | e2e 검증 부재(INFO), spec 카탈로그 갭 3건은 이미 올바르게 planner 이관 확인 |
| scope | NONE | 의도 이상의 변경 없음, 스코프 절제 우수. plan 체크박스 불일치만 발견 |
| side_effect | LOW | 의도된 status-code 변화(CHANGELOG 문서화됨), 실패 계약 비대칭 유지, 필터 미변경 확인 |
| maintainability | LOW | 근거 주석 복제, 구조적 중복(이미 등재된 기술 부채) |
| testing | LOW | happy-path 완주 테스트 부재(WARNING), 그 외 회귀/뮤테이션/대조군 설계 탄탄 |
| documentation | LOW | plan 체크리스트 텍스트-체크박스 불일치(WARNING), CHANGELOG 파라미터명 축약(INFO) |
| dependency | NONE | 새 외부 의존성 없음, 기존 내부 유틸 재사용만 |
| database | NONE | 파라미터화 유지, keyset 패턴 유지, ReDoS 없음. 인덱스 tie-breaker 미포함은 범위 밖 사전 상태 |
| concurrency | NONE | 순수 동기 검증 추가, 공유 상태·락·비동기 흐름 영향 없음 |
| api_contract | LOW | 실패 계약 비대칭 굳어짐(WARNING, 이미 추적 중), status-code 변화는 문서화됨 |
| user_guide_sync | NONE | 매트릭스 20행 전부 미매칭, semantic grey-zone 2건은 의미상 비해당으로 판단 |

## 발견 없는 에이전트

- concurrency — "해당 없음" 명시(순수 동기 검증 추가, 공유 가변 상태·락·비동기 흐름 무영향)

## 권장 조치사항

1. `background-runs.service.ts` 에 정상 v4 UUID 커서가 실제로 완주하는 happy-path 유닛 테스트 추가 (WARNING #1)
2. `plan/in-progress/keyset-cursor-uuid-validation.md:160` 의 CHANGELOG 체크박스를 `[x]` 로 정정 (WARNING #2)
3. (후속, 이번 PR 범위 외) 두 keyset 커서 디코더의 실패 계약(무시 vs 400) 통일 여부를 `spec/5-system/2-api-convention.md §8.2` 기준으로 planner 트랙에서 결정 — 이미 `spec-draft-nullable-notation-followups.md` 에 등재됨, 진행 상황만 추적 (WARNING #3)
4. (선택) CHANGELOG 의 background-runs 엔드포인트 파라미터명 표기를 실제 라우트와 일치시킴 (INFO #4)

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 14개 reviewer 실행(강제 포함 7명: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보 확인됨. 미이행 없음).