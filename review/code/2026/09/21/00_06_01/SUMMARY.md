# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL은 없다. `SchedulesService.remove()`의 동시 DELETE 중복 감사 수정 자체(판별자를 락 안 트리거 삭제 `affected`로 잡은 것)는 형제 PR(#1369·#1370)과 같은 검증된 패턴으로 올바르게 구현됐으나, 이번 diff로 새로 생긴 두 방어 분기가 어떤 테스트로도 실행이 검증되지 않는다(testing WARNING). 동일 결함 클래스 시리즈에서 CHANGELOG 누락이 세 번째로 재발했고(documentation WARNING), `NotFoundException` 리터럴 복제도 형제 파일에서 이미 한 번 고친 패턴이 재도입됐다(maintainability WARNING). 라우터 forced 화이트리스트(7명) 전원 결과 확보 확인됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 방어용 `scheduleRepository.remove(schedule)` 호출(CASCADE 없어지면 유일한 삭제라는 안전망 주석)이 어떤 테스트로도 "호출됐는가"로 검증되지 않는다 — 이 줄을 지워도 유닛·e2e 모두 GREEN | `codebase/backend/src/modules/schedules/schedules.service.ts:364`, 성공 경로 테스트 `schedules.service.spec.ts:736` | 성공 경로 테스트에 `expect(scheduleRepo.remove).toHaveBeenCalledWith(schedule)` 추가해 설계 근거를 뮤테이션으로 반증 가능하게 고정 |
| 2 | testing | 신규 방어 분기(`triggerId` 없음 → `scheduleRepository.delete`의 `affected===0` → 404)의 0-affected 경로가 테스트되지 않음(유일한 테스트가 happy-path만 exercise) | `schedules.service.ts:368-377`, 테스트 `schedules.service.spec.ts:850` | `scheduleRepo.delete.mockResolvedValueOnce({affected:0, raw:[]})`로 404 reject 를 고정하는 대조 테스트 추가 |
| 3 | maintainability | `NotFoundException({code:'RESOURCE_NOT_FOUND', message:'Schedule not found'})` 리터럴이 이번 diff로 파일 내 3중 복제(141-146, 330-335, 372-377행) — 형제 파일(`triggers.service.ts`)에서 4곳까지 늘었다가 `/ai-review`로 지적돼 헬퍼로 추출된 전례와 동일 패턴 재도입 | `codebase/backend/src/modules/schedules/schedules.service.ts:141-146, 330-335, 372-377` | `triggers.service.ts` 선례처럼 `private throwScheduleNotFound(): never` 헬퍼로 추출해 세 지점 모두 호출 |
| 4 | documentation | `CHANGELOG.md`에 이번 수정 항목 누락 — 같은 결함 클래스 형제 PR(#1369, #1370) 모두 최초 커밋엔 빠졌다가 documentation reviewer 지적 후 별도 커밋으로 추가된 이력이 있는데, 이번이 동일 누락의 **세 번째 재발**(`git diff --name-only origin/main...HEAD`에 `CHANGELOG.md` 없음 확인) | `CHANGELOG.md` (`## Unreleased` 섹션) | 트리거/워크플로 항목과 같은 3~4단 구성(문제→고친 것→판별력 실측→남는 것)으로 항목 추가. 판별자가 형제 셋과 다른 이유(CASCADE)를 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect / requirement / concurrency | 동시 DELETE 두 건이 겹치면 BullMQ `removeJob()`(락 밖, 되돌릴 수 없음)이 여전히 두 번 호출됨 — 이 PR이 명시적으로 defer한 기존 잔여(형제 PR도 동일) | `schedules.service.ts:303`(advisory lock 진입 전) | 조치 불요(트래커에 defer 근거 존재). `removeJob` 멱등성은 이 PR 범위 밖에서 한 번 확인할 가치 |
| 2 | side_effect / database | `scheduleRepository.remove(schedule)`가 트리거 경로에서 CASCADE로 인해 항상 0행 no-op — 의도된 방어적 이중 삭제 | `schedules.service.ts:364` | 조치 불요. 원하면 CASCADE를 유일 SoT로 확정하고 제거 가능하나 현행 방어적 형태도 타당 |
| 3 | side_effect | 동시 DELETE의 "진 쪽" 응답이 204→404로 바뀌는 의도된 API 동작 변화(이 PR의 목적 자체) | `schedules.service.ts:330-335, 372-377` | 조치 불요 — `3-schedule.md §4` 문서화는 트래커에 이미 등재 |
| 4 | requirement | `3-schedule.md`에 트리거 문서와 대칭되는 "동시 삭제→두 번째 404" 서술 없음(모순 아닌 침묵) | `spec/2-navigation/3-schedule.md` §4 | 조치 불요 — `plan/in-progress/spec-draft-nullable-notation-followups.md:4795`에 이미 등재, consistency-check도 동일 분류 |
| 5 | requirement | `triggerId` 없는 방어 분기가 트리거 경로와 달리 실패 시 별도 로깅·의미 분리가 없음(현재 스키마상 도달 불가) | `schedules.service.ts` `remove()` else 분기 | 조치 불요 — `triggerId` NOT NULL이라 도달 불가. nullable로 바뀔 때 재검토 |
| 6 | scope | 공유 백로그 트래커(`spec-draft-nullable-notation-followups.md`)에 5번째 자리(`IntegrationsService.remove()`)를 등재만 하고 이번 PR에서 고치지 않음 — 의도적으로 스코프 유지 | `plan/in-progress/spec-draft-nullable-notation-followups.md:4785` | 조치 불요(절차상 적절) |
| 7 | security | 삭제 실패 로그(`this.logger.error`)에 내부 `triggerId`와 원본 `err.message`를 그대로 남김(클라이언트 응답은 일반화됨, 형제 경로와 동일 패턴, 신규 아님) | `schedules.service.ts:346-350` | 현행 유지로 충분 |
| 8 | security | `m.delete(Trigger, triggerId)`가 트랜잭션 내부에서 `workspaceId`로 재스코프되지 않음(진입부에서 이미 workspace-scoped 조회를 거쳤으므로 실제 크로스테넌트 위험 없음) | `schedules.service.ts:329` | 기록만, 조치 불요 |
| 9 | testing | 새 race 테스트가 `triggerRepo.delete` 호출 인자를 단언하지 않음(happy-path 형제 테스트는 단언) | `schedules.service.spec.ts:772-804` | `expect(triggerRepo.delete).toHaveBeenCalledWith('trig-race')` 추가 권장(강제 아님) |
| 10 | testing | `affected`가 `0`/`null`/`undefined` 모두 동일 처리되나 테스트는 `0`만 다룸 | `schedules.service.ts:329-330, 372-373` | 우선순위 낮음, 변경 불요 |
| 11 | maintainability | `remove()` 메서드 책임·순환 복잡도가 이번 diff로 더 증가(6가지 책임, 86줄) — 트래커가 "네 자리 공용 형태" 설계로 이미 추적 중 | `schedules.service.ts:300-385` | 트래커 항목 처리 시 `removeTriggerLocked()` 추출 함께 고려. 지금 차단 사유 아님 |
| 12 | database | advisory lock이 트랜잭션 범위(`pg_advisory_xact_lock`)라 `NotFoundException` throw로도 정상 해제됨을 e2e로 확인 | `schedules.service.ts:329-335` | 문제 없음, 기록만 |
| 13 | concurrency | e2e 겹침 강제 기법(별도 커넥션 선점+공허성 가드)은 적절하나 CI 부하 시 5초 락 타임아웃에 근접하면 이론상 flaky 가능(형제 e2e와 동일 기존 패턴) | `test/schedule-delete-concurrency.e2e-spec.ts:94-121` | 조치 불요 — 새로운 위험 아님 |

## 문제 없음으로 확인된 항목

- **security**: 인젝션·인증/인가 우회·시크릿 하드코딩·안전하지 않은 암호화 없음. 모든 DB 조작이 파라미터 바인딩. 감사 로그 무결성 개선 방향.
- **requirement**: 판별자 선택(CASCADE로 인해 트리거 `affected`를 판정자로 삼은 것) 정확, 에러 분기 분리 정확, 테스트-구현 계약 정합, e2e 재현·검증 충분.
- **scope**: diff 13개 파일이 git 실측과 1:1 일치, 스코프 이탈(포맷팅·무관 리팩토링·설정 변경) 없음.
- **database**: 인덱스·N+1·트랜잭션·마이그레이션·스키마·커넥션 관리·SQL 인젝션·대량 데이터 전 관점에서 문제 없음.
- **concurrency**: 인터리빙 단계별 추적 결과 경쟁 조건·데드락·원자성 위반 없음. 락 획득→삭제→판정→커밋/롤백 순서 일관.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 발견 없음(INFO 2건은 기존 패턴 기록용) |
| requirement | NONE | 기능 완전성 문제 없음, spec 침묵 격차는 이미 트래커 등재 |
| scope | NONE | diff 스코프 정확히 일치, 이탈 없음 |
| side_effect | LOW | BullMQ 이중 호출(기존 잔여), 204→404 의도된 변화 — 모두 INFO |
| maintainability | LOW | `NotFoundException` 리터럴 3중 복제(WARNING), `remove()` 복잡도 증가(INFO) |
| testing | MEDIUM | 방어 분기 2곳(no-op 안전망, 0-affected 방어)이 어떤 테스트로도 실행 검증 안 됨(WARNING x2) |
| documentation | LOW | `CHANGELOG.md` 누락 — 동일 패턴 3번째 재발(WARNING) |
| database | LOW | 트랜잭션/advisory lock 정상, CASCADE no-op 확인(INFO만) |
| concurrency | LOW | 인터리빙 검증 완료, 이슈 없음(INFO만) |

## 발견 없는 에이전트

없음 — 9개 에이전트 전원이 최소 INFO 이상을 기록했다(security/requirement/scope는 위험도 NONE이나 참고용 INFO 보유).

## 권장 조치사항

1. **(WARNING #4, documentation)** `CHANGELOG.md`에 이번 수정 항목 추가 — 동일 패턴이 이 시리즈에서 이미 두 번 지적된 뒤에야 수습됐으므로 병합 전 반영 권장.
2. **(WARNING #1~#2, testing)** 신규 방어 분기 두 곳(방어적 `scheduleRepo.remove` 호출, `triggerId` 없음 분기의 0-affected→404)에 대한 실행 검증 테스트 추가 — "쓰여 있지만 검증되지 않은 설계 근거"를 남기지 않는다.
3. **(WARNING #3, maintainability)** `NotFoundException` 리터럴을 헬퍼로 추출해 3중 복제 제거 — 형제 파일에서 이미 겪은 drift 재발 방지.
4. 그 외 INFO 항목은 대부분 조치 불요 또는 이미 트래커에 등재됨 — 별도 대응 불요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency` (9명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — forced 전원 결과 확보 확인됨(누락 없음)
  - **제외**: 아래 표 (5명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(manifest에 개별 사유 미제공) — 이번 diff가 PK 기반 단건 삭제 로직 변경으로 성능 표면과 무관하다고 판단된 것으로 추정 |
  | architecture | 라우터 판단 — 아키텍처 변경 없음(기존 패턴 재적용) |
  | dependency | 라우터 판단 — 신규 의존성 추가 없음 |
  | api_contract | 라우터 판단 — 공개 API 시그니처 변경 없음(응답 코드 204→404 변화는 내부 동시성 경합에만 국한) |
  | user_guide_sync | 라우터 판단 — 사용자 가이드 영향 없음 |
