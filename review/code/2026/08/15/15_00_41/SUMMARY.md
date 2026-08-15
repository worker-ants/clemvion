# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 4건(전부 저위험 방어 누락·문서 drift). 보안/DB/스코프/유저가이드 5개 영역은 NONE 판정. `forced` reviewer 7명 전원(documentation, maintainability, requirement, scope, security, side_effect, testing) 결과 확보 완료 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `finalizeCancelledExecution` 의 0행 매칭 후 재조회(`findOneBy`)가 try/catch 로 감싸여 있지 않다 — DB 일시 장애로 reject 되면 예외가 그대로 호출자(워커 job 처리 루프)까지 전파돼, 사용자가 누른 Stop 이 "재조회 자체 실패"로 무음이 되는 새 경로가 생긴다. 자매 헬퍼 `emitCancellationEvent` 는 이미 자체 try/catch(warn 흡수)를 갖고 있는데 이 신규 지점엔 같은 원칙이 적용되지 않았다 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `finalizeCancelledExecution`, `!persisted` 분기의 `findOneBy` 호출 | `findOneBy` 를 try/catch 로 감싸 실패 시 명시적 동작(예: warn 로그 후 skip) 정의 + DB 장애 시나리오 회귀 테스트 추가 |
| 2 | testing | 같은 재조회 분기의 `finishedAt` 되쓰기 줄(`savedExecution.finishedAt = live.finishedAt ?? ...`)이 어떤 테스트로도 검증되지 않는다 — 그 줄을 통째로 삭제해도 관련 describe 블록(3 tests)이 전부 GREEN 임을 직접 뮤테이션으로 확인. 같은 PR 이 자매 코드(`retry-turn.service.ts`)에서 정확히 이 형태의 결함을 스스로 발견해 고쳤음에도 형제 함수엔 같은 처방이 적용되지 않았다 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `finalizeCancelledExecution` 4926-4928행; 테스트 `execution-engine.service.spec.ts` describe `finalizeCancelledExecution — 0행 매칭의 두 의미`, test (a) | `arrange()` 의 `live` 픽스처에 `finishedAt` 추가하고 test (a) 에서 되쓰기 결과를 단언. `resolveTerminalDurationMs` fallback 경로(`live.durationMs: null` + `live.finishedAt` 조합)를 확인하는 케이스 추가 권장 |
| 3 | documentation | `spec/conventions/node-cancellation.md` §2.4 표 + Rationale 이 되돌려진 중간 커밋(`692dfa00e`, "0행이면 무조건 skip")의 동작을 여전히 서술한다. 최종 코드(`b4d0ca27e` 이후)는 재조회 후 조건부 재발행(case a: CANCELLED 면 emit / case b: 선점됐으면 skip)인데, 문서는 "모두 skip"·"자매 `finalizeFailedExecution` 과 동형"이라고 단정한다. 다음에 유사한 guarded-cancel 경로를 이 표만 보고 복사하면 `13_58_27` W3 와 같은 사고가 재발할 위험 | `spec/conventions/node-cancellation.md:198` (§2.4 표), `:210-211` (Rationale) | 표/Rationale 을 "0행이면 재조회 → DB 가 CANCELLED 면 발행, 선점됐으면 skip"으로 정정하고 "형태는 같으나 극성은 반대"로 수정. `~~원문~~` + 정정 노트 패턴 유지 |
| 4 | documentation | `plan/in-progress/eia-db-wire-invariant.md` 체크리스트가 두 번째 `/ai-review` 라운드(`14_47_14`, WARNING 2건, `bf0f86ca8` 로 조치 완료)의 실행·해결을 전혀 기록하지 않는다 — `13_58_27` 라운드만 `[x]`, 117행은 여전히 미체크 상태로 남아 감사 추적에 구멍이 있다 | `plan/in-progress/eia-db-wire-invariant.md:107-119` (`## 체크리스트`) | `14_47_14` 라운드용 항목 추가(`[x] /ai-review (14_47_14) WARNING 2 — 조치, RESOLUTION 참조`), 117행을 이번(`15_00_41`) 기준으로 갱신 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | guarded UPDATE 반환값 미확인 결함 수정은 보안 관점에서도 데이터 무결성/신뢰성 개선 — 재조회 스코프가 기존 guarded UPDATE 와 동일해 권한 경계 변화 없음 | `execution-engine.service.ts:4899-4929` | 조치 불요 |
| 2 | security | REST `durationMs` 추가는 기존 push 채널에 이미 노출되던 저민감도 값을 REST 에도 동일 노출 — 신규 표면 아님 | `execution-status-response.dto.ts`, `interaction.service.ts` | 조치 불요 |
| 3 | side_effect | `EXECUTION_CANCELLED` 발행 조건이 무조건→DB 실측 조건부로 바뀌어 특정 레이스에서 외부 수신자에게 가던 이벤트가 안 갈 수 있음 — CHANGELOG/plan/JSDoc 3중 고지된 의도된 정상화 | `execution-engine.service.ts` `finalizeCancelledExecution` | 조치 불요 |
| 4 | side_effect | 두 종결 헬퍼(`finalizeCancelledExecution`/`finalizeGuarded`)가 파라미터 엔티티를 in-place mutate — 현재 호출 스코프에서는 안전하나 계약이 타입에 드러나지 않음 | `execution-engine.service.ts`, `retry-turn.service.ts` | 새 호출부 재사용 시 "호출자는 같은 참조로 이전 값 기대 말 것" 캐비엇 추가 권장(비긴급) |
| 5 | maintainability | `finalizeGuarded` CANCELLED 분기 중첩 4단, mock 리터럴 4곳 중복, `finalizeCancelledExecution` 책임 확대 — 전부 plan "범위 밖(등재됨)" 절에 별도 PR 로 명시 이관된 기존 부채, 이번 PR 신규 결함 아님 | `retry-turn.service.ts:641-676`, `retry-turn.service.spec.ts` | 후속 PR 에서 헬퍼/팩토리 추출 고려 |
| 6 | testing | `retry-turn.service.ts` 파싱-실패(로컬 값 보존) 분기에 서비스 레벨 통합 테스트 없음 — 이론적 케이스, 직전 라운드도 조치 불요로 정착 | `retry-turn.service.ts:664-673` | 조치 불요(참고용) |
| 7 | concurrency | `finalizeCancelledExecution` 재조회의 정합성은 Postgres 단일 UPDATE 행 잠금 직렬화에 암묵 의존 — 현재는 안전하나 향후 `updateExecutionStatus` else 분기가 다중 문장으로 쪼개지면 전제가 조용히 깨질 수 있음 | `execution-engine.service.ts:4899-4929` | 재조회 지점에 "단일 UPDATE 문 원자성에 의존" 캐비엇 추가 권장(비긴급) |
| 8 | api_contract | `execution.cancelled` push 이벤트가 특정 레이스에서 더 이상 발행되지 않는 동작 변경 — CHANGELOG 에 명시 고지, 재조회 API 로 실제 상태 확인 가능 | `execution-engine.service.ts` | 조치 불요. (선택) EIA spec 웹훅 신뢰성 절에도 한 줄 반영 고려 |
| 9 | database | 스키마·마이그레이션·인덱스 변경 없음. 모든 신규 SQL 은 파라미터 바인딩, REST projection 확장은 단건 PK 조회라 N+1 무관 | 4개 파일 전체 | 조치 불요 |

## SPEC-DRIFT

없음. (WARNING #3 은 spec 이 구현보다 "낡은" 사례이지만, 이는 documentation-reviewer 가 `[SPEC-DRIFT]` 태그 없이 일반 WARNING 으로 보고했다 — spec 을 구현에 맞춰 갱신해야 하는 문서 수정 항목으로 처리할 것.)

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 SQL 전부 파라미터 바인딩, 재조회 스코프 기존과 동일, 신규 표면 없음 |
| requirement | LOW | `findOneBy` 재조회 에러 처리 누락(WARNING 1건). plan/spec/CHANGELOG 서술과 구현 line-level 일치 확인 |
| scope | NONE | 55파일 전량이 plan ①②③ 3항목 + 트래커 미러 + 이전 리뷰 라운드 산출물로 설명됨. drive-by 변경 없음 |
| side_effect | LOW | emit 조건 변경·in-place mutation 2건 모두 의도되고 스코프 내 안전(INFO) |
| maintainability | LOW | 신규 결함 없음. 기존 부채(중첩 깊이·mock 중복)는 plan 에 이관 완료 |
| testing | LOW | `finishedAt` 되쓰기 미검증(WARNING 1건). 나머지 테스트 밀도·판별력 높음 |
| documentation | LOW | node-cancellation.md spec drift + plan 체크리스트 누락(WARNING 2건) |
| database | NONE | 스키마 변경 없음, 원자적 SQL 유지, N+1/인젝션 표면 없음 |
| concurrency | LOW | 신규 레이스 없음. Postgres 직렬화 의존 전제가 코드에 미명시(INFO) |
| api_contract | LOW | REST 필드 additive/nullable, breaking change 없음 |
| user_guide_sync | NONE | 매칭 trigger 2건 + 그레이존 1건 모두 같은 changeset 에서 ko/en 동반 갱신 확인 |

## 발견 없는 에이전트

security, scope, database, user_guide_sync (전부 위험도 NONE — INFO 성격 확인사항만 존재)

## 권장 조치사항

1. `finalizeCancelledExecution` 재조회(`findOneBy`) 호출을 try/catch 로 감싸 DB 장애 시 명시적 fail-safe 동작(warn+skip)을 정의하고 회귀 테스트 추가 (requirement WARNING).
2. `execution-engine.service.spec.ts` 의 `finalizeCancelledExecution` 테스트에 `finishedAt` 되쓰기를 실제로 판별하는 단언 추가 — `retry-turn.service.spec.ts` 가 이미 쓴 "두 컬럼 모두 단언" 패턴을 형제 함수에도 적용 (testing WARNING).
3. `spec/conventions/node-cancellation.md` §2.4 표 + Rationale 을 최종 코드(재조회 후 조건부 재발행)에 맞게 재정정 — 다음 guarded-cancel 경로 구현자가 잘못된 패턴을 복사하지 않도록 (documentation WARNING, 우선순위 높음: 이 표는 향후 실수의 직접 원인이 될 수 있음).
4. `plan/in-progress/eia-db-wire-invariant.md` 체크리스트에 `14_47_14` 라운드 기록을 추가하고 117행 상태를 이번 라운드 기준으로 갱신 (documentation WARNING).
5. (비긴급, 참고) 재조회 지점·in-place mutation 헬퍼에 원자성/부작용 전제를 명시하는 캐비엇 주석 추가 — concurrency·side_effect INFO 권고.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(구체적 사유 미제공 — 이번 diff 가 REST projection 확장·guarded UPDATE 반환값 소비 등 저비용 단건 조회 위주라 성능 표면 낮음으로 추정) |
  | architecture | 라우터 판단(구체적 사유 미제공 — 신규 모듈/레이어 경계 변경 없음으로 추정) |
  | dependency | 라우터 판단(구체적 사유 미제공 — 신규 외부 라이브러리 도입 없음으로 추정, security 리뷰어가 별도 확인) |