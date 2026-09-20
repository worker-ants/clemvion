# Code Review 통합 보고서

## 전체 위험도

**LOW** — CRITICAL 0건, WARNING 1건(documentation — CHANGELOG 갱신 누락, 비차단). forced whitelist(documentation·maintainability·requirement·scope·security·side_effect·testing) 7명 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | `CHANGELOG.md` 스케줄 항목이 여전히 1라운드 시점 서술에 머물러, 이후 두 라운드에서 실제로 굳어진 핵심 설계 결정(`!affected` → `affected === 0` 명시 비교 전환, 그리고 그 근거를 지키는 대조군 테스트 추가)을 반영하지 않는다. 코드·테스트 자체는 정확하므로 기능 결함은 아니지만, 이 PR 시리즈가 CHANGELOG를 유일한 요약 진입점으로 엄격히 다뤄온 관례(1·2라운드 모두 CHANGELOG WARNING)에서 세 번째로 벗어난 지점 | `CHANGELOG.md:18`, `:27-31` | "고친 것"/"판별력 실측" 문단에 `affected === 0` 명시 비교 근거(자매 함수 `rewriteTriggerConfigLocked`와 동일 근거)와 대조군 추가 전/후 뮤턴트 생존 변화(32건 GREEN → 2건 RED)를 한두 문장 추가. 기존 문단은 유지하고 덧붙이는 형태 권장 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement / documentation / side_effect | spec `3-schedule.md` §4가 "동시 삭제 시 두 번째 요청 404" 계약을 서술하지 않음 — 회색지대이며 모순·SPEC-DRIFT 아님. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:4795` 트래커에 등재됨 | `spec/2-navigation/3-schedule.md:142` | 조치 불요 — 트래커 처리 대기(project-planner 소관) |
| 2 | requirement / database / side_effect / concurrency | `triggerId` 없는 방어 분기(else)는 `Schedule.triggerId` NOT NULL 제약상 현재 도달 불가능한 죽은 코드. 락 없이 처리하지만 단일 `DELETE` 문 자체가 DB 레벨에서 원자적이라 안전 | `codebase/backend/src/modules/schedules/schedules.service.ts:372-381` | 조치 불요 — `triggerId`가 nullable로 바뀌는 시점 재검토 |
| 3 | security | 삭제 실패 로그(`Logger.error`)에 `triggerId`와 원본 에러 메시지가 남음 — 클라이언트 응답은 일반화되어 API 노출 없음, 형제 경로(`TriggersService`)와 동일한 기존 패턴 | `schedules.service.ts` `remove()` `.catch` (~353행) | 조치 불요 |
| 4 | security | `affected`가 `null`/`undefined`(드라이버 미보고)일 때 실제 삭제 여부 보장 없이 감사·비밀정리가 진행되는 이론적 잔여 — 자매 함수(`rewriteTriggerConfigLocked`) 정책을 일관 적용한 결과이며 신규 위험 아님 | `schedules.service.ts` `if (affected === 0)` 판정부 | 조치 불요 |
| 5 | side_effect / concurrency | 동시 DELETE의 "진 쪽" 응답이 204→404로 바뀌는, 이 PR 목적 자체인 관측 가능한 API 변화 — CHANGELOG·plan·e2e·형제 PR(#1369/#1370)로 근거 고정 | `schedules.service.ts:342,380` | 조치 불요 — 의도된 변경 |
| 6 | side_effect | `NotFoundException` 발생 시 `Logger.error` 호출을 건너뛰는 로깅 억제 — 동시 삭제로 인한 정상 404를 거짓 경보로 남기지 않기 위함, 테스트로 계약 고정 | `schedules.service.ts:348` | 조치 불요 |
| 7 | side_effect / concurrency | advisory lock 획득 이전(락 밖) `scheduleRunnerService.removeJob()` 이중 호출 — 형제 PR(#1369/#1370)과 동일한 기존 잔여, plan에 명시적 defer 근거 있음 | `schedules.service.ts` `remove()` 최상단 | 조치 불요 |
| 8 | database | 트랜잭션 커밋 후 비밀 정리·CASCADE no-op 삭제·감사 기록이 원자적이지 않음 — 기존 트레이드오프이며 이 diff가 새로 만든 문제 아님 | `schedules.service.ts:360-387` | 이번 PR 범위 밖, 별도 조치 불요 |
| 9 | maintainability | `remove()`의 책임 수·순환 복잡도가 여전히 높음(7가지 책임, 81줄) — 공용 헬퍼 추출은 이미 별도 트래커(`spec-draft-nullable-notation-followups.md:4501`)와 plan "이 PR이 하지 않는 것"에서 스코프 아웃된 설계 결정 | `schedules.service.ts:308-388` | 트래커 처리 시 `removeTriggerLocked()` 형태 분리 고려. 지금 diff를 막을 사유 아님 |
| 10 | maintainability | 신규 대조군 테스트 두 건이 유사한 반복문 구조를 복제 — 기존 파일 관례(0행 테스트 쌍)와 일관되며 신규 부채 아님 | `schedules.service.spec.ts:827-866` | 향후 파일 전체 정리 시 `it.each` 파라미터화 검토 |
| 11 | testing | `remove()` 관련 테스트들이 무관한 `describe('create — timezone fallback (§2.2)', ...)` 블록 안에 위치 (3라운드 연속 재확인) | `schedules.service.spec.ts` | 후속 정리 시 `describe('SchedulesService.remove', ...)` 분리 권장, 차단 사유 아님 |
| 12 | testing | 신규 테스트 이름("삭제 — 같은 대조군 (triggerId 없는 방어 분기)")이 단독으로는 "무엇의 대조군인가"를 전달하지 못함 | `schedules.service.spec.ts:848` | 차단 아님, 이름 개선 여지 |
| 13 | scope | 실질 코드 변경은 4개 파일(`schedules.service.ts`/`.spec.ts`/신규 e2e/`CHANGELOG.md`)뿐이며, 나머지 51개는 `CLAUDE.md`가 규정한 표준 워크플로에 따른 plan/이전 리뷰 라운드 산출물 | 전체 diff (`git diff --stat origin/main...HEAD`) | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 하드코딩 시크릿·SQL 인젝션·인가 우회 없음. 로그 노출·null/undefined 이론적 잔여는 기존 정책의 일관 적용으로 신규 위험 아님 |
| requirement | NONE | 3라운드에 걸친 WARNING 전부 실측 해소 확인. spec `3-schedule.md` §4 침묵은 기존 트래커 등재 상태 유지, CRITICAL/WARNING 신규 없음 |
| scope | NONE | 55개 파일 `git diff --stat` 1:1 실측 대조. 실질 코드 변경 4파일로 좁게 유지, 스코프 이탈·drive-by 변경 없음 |
| side_effect | LOW | 최신 커밋(`210808701`)은 테스트 전용. 유일한 관측 가능 변화(204→404)는 이 PR의 의도된 목적 |
| maintainability | NONE | 이전 WARNING(`NotFoundException` 리터럴 3중복, CHANGELOG 누락) 모두 헬퍼 추출·CHANGELOG 반영으로 해소 확인. 잔여 복잡도는 별도 트래커 관리 중 |
| testing | NONE | 뮤테이션 재현으로 직전 라운드 WARNING(판별력 공백) 해소 검증 완료(`=== 0` → `!affected` 뮤턴트: 32건 GREEN → 2건 RED) |
| documentation | LOW | 신규 테스트 JSDoc·인용 정확. `CHANGELOG.md`가 2·3라운드 설계 결정(`=== 0` 전환)을 반영 못 함 — WARNING 1건 |
| database | LOW | 스키마 변경 없음. CASCADE 의미론과 판정 로직 설계 타당성 확인. 커밋 후 비원자성은 기존에 문서화된 잔여 |
| concurrency | LOW | advisory lock 기반 승/패 판정 정확성 재확인. 최신 커밋은 프로덕션 코드 무변경(`git diff`로 확인), 대조군만 추가 |

## 발견 없는 에이전트

없음 — 전 9개 에이전트가 최소 INFO 이상을 보고했으며, 모두 "조치 불요" 또는 이미 처분된 항목의 재확인이다. 신규 CRITICAL/WARNING(1건 제외)은 없다.

## 권장 조치사항

1. `CHANGELOG.md` 스케줄 항목의 "고친 것"/"판별력 실측" 문단에 `affected === 0` 명시 비교로의 전환 근거(자매 함수 `rewriteTriggerConfigLocked`와 동일 근거)와 대조군 추가 전/후 뮤턴트 생존 변화(32건 GREEN → 2건 RED)를 한두 문장 추가한다 — 기존 문단은 지우지 말고 덧붙일 것 (documentation WARNING #1, 비차단이나 이 PR 시리즈의 CHANGELOG 엄격 관례상 권장).
2. (후순위, 비차단) `spec/2-navigation/3-schedule.md` §4의 동시 삭제 404 서술 격차는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 등재되어 있으므로 project-planner의 후속 트래커 처리를 기다린다.
3. (후순위, 비차단) `remove()`의 높은 책임 수(7가지)는 별도 트래커(`spec-draft-nullable-notation-followups.md:4501`)가 이미 "네 자리 공용 헬퍼" 설계 항목으로 추적 중 — 그 트래커가 처리될 때 함께 정리한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency` (9명)
  - **제외**: 표 참조 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 7명 전원 결과 확보됨

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff와 관련성 낮음 (성능 영향 없는 동시성/감사 로직 수정) |
  | architecture | router 판단상 이번 diff와 관련성 낮음 (아키텍처 변경 없음, 기존 패턴의 좁은 확장) |
  | dependency | router 판단상 이번 diff와 관련성 낮음 (의존성 변경 없음) |
  | api_contract | router 판단상 이번 diff와 관련성 낮음 (공개 API 시그니처 변경 없음, 에러 코드 상태 전이는 기존 계약 확장) |
  | user_guide_sync | router 판단상 이번 diff와 관련성 낮음 (사용자 가이드 영향 없는 백엔드 동시성 수정) |
