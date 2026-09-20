# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 2건 모두 비차단(문서 내부 모순 정정, 조건부 방어적 방향성 개선 제안)이며, forced 화이트리스트 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨(미이행 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | `CHANGELOG.md` 의 기존 트리거 항목 "남는 것" 문단이 "`SchedulesService.remove()` 자신의 스케줄 행 삭제는 아직 같은 결함을 갖고 있다" 고 계속 서술하는데, 바로 위(이번 diff 신규 추가)의 스케줄 항목이 그 결함을 이미 닫았다고 기록해 같은 파일 안에서 인접 항목이 모순된다 | `CHANGELOG.md:63-66` (트리거 항목의 "남는 것" 문단) | 트리거 항목 끝에 "**2026-09-21 해소**: 위 스케줄 항목이 이 잔여를 닫았다" 형태의 해소 각주 추가(원문은 삭제하지 말고 유지) — 이 저장소가 tracker 문서(`spec-draft-nullable-notation-followups.md`)에서 이미 쓰는 관례와 동일하게 |
| 2 | concurrency | `!affected` 판정이 `affected === 0`(진짜 동시 삭제 패배)과 `null`/`undefined`(드라이버 미보고)를 구분하지 않음. 같은 락 서브시스템의 자매 함수 `rewriteTriggerConfigLocked` 는 이 지점을 이미 실측해 정반대로("모른다"를 "없다"로 읽지 않도록 `affected === 0` 명시 비교) 결정해 두었는데, 이번 delete 판정 두 곳은 그 캐비어트를 반영하지 않음 | `codebase/backend/src/modules/schedules/schedules.service.ts:337-338`, `:371-375` (비교 대상: `trigger-config-lock.ts:247-255`) | `result.affected === 0` 명시 비교로 통일하거나 최소한 캐비어트 주석 추가. 현재 TypeORM+pg 드라이버는 `rowCount` 를 신뢰성 있게 정수 반환하므로 오늘 당장 관측 가능한 결함은 아니며 코드베이스 다른 곳(`auth.service.ts:655` 등)도 같은 falsy 패턴을 씀 — Critical 아님 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement, side_effect | `spec/2-navigation/3-schedule.md` §4 가 여전히 "동시 삭제 → 두 번째 요청 404" 계약을 서술하지 않음(spec 침묵, 코드는 형제 `2-trigger-list.md §4.4` 정책과 정합). 새 결함이 아니라 이미 등재된 문서 격차 | `spec/2-navigation/3-schedule.md:142`; `plan/in-progress/spec-draft-nullable-notation-followups.md:4795` | 조치 불요(이미 추적 중). 트래커 처리 시 project-planner 가 §4 에 한 문장 추가 |
| 2 | requirement, side_effect, concurrency | `triggerId` 없는 방어 분기(`scheduleRepository.delete` 판정)는 `Schedule.triggerId` 컬럼이 NOT NULL 이라 현재 도달 불가능한 코드 | `schedules.service.ts:368-376`; `schedule.entity.ts:25-26` | 조치 불요 — 스키마가 nullable 로 바뀌는 시점에 재검토 |
| 3 | side_effect, concurrency | BullMQ `removeJob()` 이 advisory lock 획득/승패 판정보다 먼저(락 밖) 실행되어 동시 DELETE 두 건 모두 이 외부 호출을 각자 수행함(되돌릴 수 없는 부작용) | `schedules.service.ts:311` | 조치 불요 — CHANGELOG·plan 에 이미 명시된 미해결 잔여, 형제 PR(#1369·#1370)과 동일 처리 |
| 4 | side_effect | 동시 DELETE 진 쪽 응답이 204 → 404 로 바뀌는 관측 가능한 API 계약 변경(이 PR 의 목적 자체, CHANGELOG·plan·e2e 로 문서화됨) | `schedules.service.ts:337-338, 371-375` | 조치 불요 — 외부 API 클라이언트의 DELETE 재시도 로직이 404 를 별도 처리하는지만 참고 확인 권장 |
| 5 | side_effect | `NotFoundException` 발생 시 `Logger.error` 호출을 건너뛰어 "반쯤 삭제" 오탐 로그가 줄어드는 로깅 부작용 변경(의도된 개선) | `schedules.service.ts:340-344` | 조치 불요 — 로그 기반 알림 룰이 해당 문구를 정확 매치로 쓰고 있다면 팀 공지 권장 |
| 6 | security | 서버 로그(`this.logger.error`)에 트리거 삭제 실패 시 `err.message` 를 그대로 남김(이번 diff 이전부터 존재, 클라이언트에는 일반화된 메시지만 노출) | `schedules.service.ts` `remove()` 의 `.catch` 블록 | 조치 불요 |
| 7 | testing | 신규 0-affected→404 테스트가 `scheduleRepo.remove` 미호출을 직접 단언하지 않음(감사 미호출 단언으로 간접 커버는 있음). 형제 테스트는 이를 명시적으로 단언해 비대칭 | `schedules.service.spec.ts:778-813` | `expect(scheduleRepo.remove).not.toHaveBeenCalled();` 한 줄 추가로 대칭 권장(비차단) |
| 8 | testing | 신규 테스트 2건이 이름이 맞지 않는 기존 `describe('create — timezone fallback (§2.2)', ...)` 블록 안에 계속 쌓임(이번 PR 이 만든 문제는 아님) | `schedules.service.spec.ts:254`(및 최상위 `:17`) | 우선순위 낮음 — 후속 정리 시 `describe('SchedulesService.remove', ...)` 분리 권장 |
| 9 | documentation | 공유 트래커(`spec-draft-nullable-notation-followups.md:4773`)의 `SchedulesService.remove()` 항목이 여전히 `- [ ]`(미해소) — 다만 이 PR 자신의 plan 체크리스트에도 세션 마무리 단계 작업으로 명시돼 있어 현재는 의도된 미완료 상태 | `plan/in-progress/spec-draft-nullable-notation-followups.md:4773` | 세션 마무리 시 `plan/in-progress/schedule-dup-delete.md` 체크리스트 완료와 함께 트래커 줄을 `[x]` + 해소 각주로 갱신 |
| 10 | scope, maintainability | 리뷰 진행 중 병렬로 도는 다른 reviewer 로 추정되는 일시적 파일 뮤테이션(스케줄 서비스의 else 분기 부근)이 관측됐으나 스스로 원복되어 최종 `git status --short` 는 clean. 본 세션은 저장소를 뮤테이션하지 않았음 | `codebase/backend/src/modules/schedules/schedules.service.ts` (일시적, 비영속) | 조치 불요 — 절차 기록용. 최종 판정에는 영향 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·인가·시크릿·에러노출 전 관점 이상 없음. 로그 `err.message` 노출은 기존 상태(INFO) |
| requirement | NONE | WARNING 4건(직전 라운드) 전부 실물 대조로 해소 확인. spec `3-schedule.md` 침묵은 기존 추적 항목(INFO) |
| scope | NONE | diff 29개 파일 전수 대조 일치, 헬퍼 추출은 직전 리뷰 요청에 대한 응답, 스코프 이탈 없음 |
| side_effect | LOW | 204→404 계약 변경·로그 억제 등은 모두 의도되고 문서화됨. 신규 위험 없음 |
| maintainability | NONE | 리터럴 3중복제 헬퍼 추출로 해소, `remove()` 책임 증가는 기존 트래커 추적 중 |
| testing | LOW | 직전 라운드 testing WARNING 2건을 뮤테이션 재현으로 독립 검증(해소 확인). 비차단 INFO 2건만 잔존 |
| documentation | LOW | CHANGELOG 인접 항목 모순 1건(WARNING), 트래커 체크박스 미해소는 계획된 미완료 |
| database | LOW | 트랜잭션·advisory lock·판별자 선택·파라미터화 쿼리 모두 안전. CASCADE 이중삭제는 방어적 설계(INFO) |
| concurrency | LOW | 설계(lock+affected 판별자+트랜잭션 롤백) 건전. `!affected` 의 null/undefined 미구분이 자매 함수와 철학 불일치(WARNING) |

## 발견 없는 에이전트

security, requirement, scope, maintainability — Critical/Warning 없음(NONE, 순수 INFO 또는 무발견).

## 권장 조치사항

1. `CHANGELOG.md` 의 기존 트리거 항목 "남는 것" 문단에 해소 각주 한 줄 추가(WARNING #1) — 문서 내부 모순 정정.
2. `!affected` 판정을 `result.affected === 0` 명시 비교로 통일하거나 캐비어트 주석 추가(WARNING #2) — `trigger-config-lock.ts` 와의 철학 불일치 해소. Critical 아니므로 급하지 않음.
3. (선택, 비차단) `expect(scheduleRepo.remove).not.toHaveBeenCalled()` 추가로 테스트 대칭성 개선.
4. (선택, 비차단) 세션 마무리 시 `plan/in-progress/spec-draft-nullable-notation-followups.md:4773` 트래커 항목을 `[x]` + 해소 각주로 갱신하고 `plan/in-progress/schedule-dup-delete.md` 를 `plan/complete/` 로 이동.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 7명 전원 결과 확보됨 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 스코프 밖(제외 사유 상세는 `_routing_decision.json` 참고, prompt 미포함) |
  | architecture | router 판단 — 스코프 밖 |
  | dependency | router 판단 — 신규 의존성 없음 |
  | api_contract | router 판단 — 공개 API 시그니처 불변 |
  | user_guide_sync | router 판단 — 사용자 가이드 영향 없음 |
