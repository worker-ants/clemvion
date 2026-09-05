# 요구사항(Requirement) 리뷰

## 검증 방법

이 changeset(74개 변경 파일 중 실제 코드는 파일 1~30, 31은 plan 트래커, 32~74는 이전 리뷰 라운드(`18_23_02`/`19_08_18`/`18_23_03`/`19_08_19`)의 산출물이 그대로 커밋된 것)는 여러 차례의 자체 리뷰·수정 사이클을 거친 최종 상태다. 프롬프트에 diff가 생략된 핵심 파일(`triggers.service.ts` 전체, `swagger-dto-contract.spec.ts`의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT`)은 `Read`/`Grep`으로 원본을 직접 열어 대조했고, DTO에 선언된 모든 신규 필드(`nullable`/기본값/enum)는 대응 엔티티 컬럼 정의와 1:1로 대조했다. `spec/5-system/2-api-convention.md §5.4`(부재 표현 규칙)와 `spec/2-navigation/1-workflow-list.md`(formatVersion Planned 갭)를 SoT로 열어 코드·주석의 인용이 정확한지 확인했다. 저장소 트리에는 아무것도 쓰지 않았다(`git status --short` 확인 — 신규 review 산출물 디렉터리 외 변경 없음).

## 발견사항

- **[WARNING]** `PATCH /api/schedules/:id`로 `isActive: false`를 보내는 경로 — 즉 `SchedulesService.update()`가 `if (schedule.isActive)` 분기의 `else`(단순 `removeJob`)로 빠지는 경우 — 를 실제로 때리며 응답의 `trigger` 필드가 여전히 존재하는지 확인하는 e2e/unit 테스트가 없다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` — `async update(...)`, 특히 `saved.trigger = trigger ?? schedule.trigger;` 대입이 `if (schedule.isActive) { ... } else { await this.scheduleRunnerService.removeJob(saved.id); }`의 **if 분기 안에만** 있고 else 분기에는 없는 지점(`Read`로 확인한 실제 줄 220/230/261~265). 테스트 쪽 인지 흔적: `codebase/backend/test/schedule-trigger.e2e-spec.ts` 'D. PATCH cron → nextRunAt 재계산' 테스트 주석 — "PATCH 도 `toResponse` 를 타지만 `update()` 의 trigger 대입 로직이 `findOne` 과 달라(`trigger ?? schedule.trigger`) 공유 헬퍼만으로 안전이 자동 보장되지 않는다".
  - 상세: `SchedulesController.toResponse()`가 `schedule.trigger`를 읽어 `ScheduleTriggerRefDto`로 좁히는데, `update()`가 반환하는 `saved`(=`scheduleRepository.save(schedule)`의 결과)에 `.trigger`가 붙어 있는 것은 (1) `findById()`가 `relations: ['trigger', 'trigger.workflow']`로 이미 로드해 둔 `schedule.trigger`가 (2) TypeORM의 `save()`가 통상 **같은 객체 참조**를 반환한다는, 코드 어디에도 보장되지 않는 구현 세부에 암묵적으로 의존한다. `isActive` true 분기에서는 `saved.trigger = trigger ?? schedule.trigger`로 명시 재대입해 이 의존을 없앴지만, else 분기(비활성화 경로)는 그 안전장치가 없다. `ScheduleDto.trigger`가 `@ApiPropertyOptional`(키 생략 허용)로 선언돼 있어, 만약 이 경로에서 실제로 `trigger`가 사라지더라도 `assertMatchesContract`(§5.4 계약 대조기)는 그것을 위반으로 잡지 못한다 — required가 아니므로 missing이 legal이다. 즉 이 특정 상태 전이(스케줄을 PATCH로 비활성화)에서 응답 shape이 조용히 달라져도 현재 테스트 스위트로는 검출되지 않는다. 코드 작성자 스스로 이 취약점을 주석으로 인지·기록했으나("공유 헬퍼만으로 안전이 자동 보장되지 않는다"), 실제로 그 경로를 재현하는 테스트(예: `PATCH /api/schedules/:id { isActive: false }` 후 `detail.body.data.trigger`가 4필드로 존재함을 양성 단언)는 추가되지 않았다. `schedule-trigger.e2e-spec.ts`의 G/H 테스트는 `PATCH /api/triggers/:id`(트리거 엔드포인트, 다른 서비스 메서드 `TriggersService.update` 경유)로 `isActive`를 바꾸는 것이라 이 갭을 덮지 않는다.
  - 제안: `schedule-trigger.e2e-spec.ts`에 `PATCH /api/schedules/:id { isActive: false }` 후 `GET`(또는 PATCH 응답 자체)에서 `trigger` 키가 4필드 그대로 존재함을 양성 단언하는 케이스를 추가하거나, `update()`의 `saved.trigger` 대입을 `findAll`/`findOneDetail`처럼 조건 분기 밖으로 옮겨 두 경로의 로직을 통일할 것(이미 `create()`에서 동일한 클래스의 결함을 "조건 밖으로 옮김"으로 고친 선례가 있다 — `schedules.service.ts:198-203`의 주석 참고).

- **[INFO]** 위 지점은 실제 결함이 아니라 "테스트로 고정되지 않은 암묵적 가정"이라는 성격이 강하다 — TypeORM의 `Repository.save()`가 update 시 동일 인스턴스를 반환하는 것은 실무적으로 신뢰할 수 있는 동작이라, 지금 당장 응답이 잘못 나갈 가능성은 낮다. 다만 이 메서드가 향후 `queryRunner.manager.update()`류로 바뀌거나 `save()`가 새 인스턴스를 반환하는 방향으로 리팩터링되면 조용히 깨지는 지점이라는 점만 기록해 둔다.

## 검증된 사항 (결함 아님 — 이번 스윕이 정확히 구현됐음을 확인)

- `TriggersService.sanitizeForResponse`가 3개 축(chat-channel JSONB 키·notification.signing JSONB 키·엔티티 컬럼 2개)을 모두 덮고, 조기 return 없이 모든 트리거 타입에 적용됨을 `findAll`/`findOneDetail`/`create`/`update` 4개 호출부에서 확인했다. `TRIGGER_RESPONSE_STRIP_COLUMNS`는 `delete` 단일 루프로 정리돼 있어(이전 라운드가 지적한 "이중 순회 죽은 코드"는 이미 제거됨) 서술과 구현이 일치한다.
- `SchedulesController.toResponse`가 `findAll`/`findOne`/`create`/`update` 4개 핸들러 전부에 배선돼 있고, `delete`(204, no body)는 대상이 아님을 확인 — 누락 없음.
- 신규 선언된 DTO 필드 23개(`TriggerDto` 7·`IntegrationDto` 6·`KnowledgeBaseDto` 7·`AlertRuleDto` 2·`ScheduleDto.trigger` 1) 전부를 대응 엔티티 컬럼(`nullable`/`type`/`default`)과 1:1 대조했고, `nullable: true`/`enum`/`example` 선언이 실제 컬럼 정의(예: `chatChannelHealth`/`notificationHealth`의 `default: 'unknown'` 비-null enum, `KnowledgeBaseDto.rerankCandidateK` 기본값 50 vs `example: 50`, `IntegrationDto.appUrl`의 `IntegrationsService.toPublic` 기저값 `{appUrl: null}`)와 정확히 일치함을 확인했다. CHANGELOG의 "23필드" 소제목도 현재 표 합계와 일치한다(이전 라운드의 24 vs 23 불일치는 이미 정정됨).
- §5.4 금지 조합(`@ApiPropertyOptional({nullable:true})` + `field?: T | null`) 문제는 이번 커밋들 안에서 스스로 재발했다가(1차 스윕이 17개 필드를 그 형태로 선언) 같은 브랜치 후속 커밋에서 정정되고, `swagger-dto-contract-guard.ts`에 3번째 축(`findOptionalNullableResponseFields`)이 신설돼 78건을 `EXPECTED_OPTIONAL_NULLABLE_DRIFT`로 양방향 래칫했다. 현재 코드 상태에서 이번 PR이 새로 추가한 필드 중 어느 것도 이 드리프트 목록에 포함되지 않음을 grep으로 확인 — 즉 재발이 실제로 해소된 상태다. 이 래칫의 "존재하지 않는 fixture를 참조해 vacuous했다"는 Critical도 `optional-nullable.fixture.ts` 신설 + 양성/음성 대조군 단언으로 해소돼 있음을 확인했다.
- `contractForDto`의 promise 메모이제이션(실패 시 캐시 삭제 후 rethrow, in-flight promise 캐싱)과 `allowMissing`/`allowUndeclared`의 경로 매칭(`join(prefix, name)` 기반, nested path 지원)이 설명된 대로 구현돼 있다.
- `spec/5-system/2-api-convention.md §5.4`(부재 표현 규칙 + "두 검증자" 표)와 `spec/2-navigation/1-workflow-list.md`(`formatVersion` Planned 갭)를 열어 코드/CHANGELOG의 인용이 spec 본문과 정확히 일치함을 확인했다. spec 자체의 결함이나 spec-drift는 발견되지 않았다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md`의 체크박스·수치 서술은 실제 커밋 이력(`dfb2664af`·`cb17f0870`·`a6f582680`)과 대조해 stale하지 않음을 확인했다.

## 요약

이 changeset은 §5.4 응답-계약 검증자를 14→18개 DTO로 넓히는 배선 작업, 그 과정에서 실측으로 드러난 두 건의 실제 비밀 유출(트리거 회전 secret의 엔티티 컬럼 미스트립 + 스케줄 조인을 통한 2차 유출) 수정, 그리고 5개 DTO 23개 필드의 선언-실제 정합화로 구성된다. 여러 차례의 자체 리뷰 라운드를 거치며 지적된 Critical(vacuous 래칫 대조군, §5.4 금지 조합 재도입, 엔티티 컬럼 미스트립, unit fixture 사각지대 등)이 모두 코드·테스트 양쪽에서 실제로 해소됐음을 원본 파일 직접 대조로 확인했다. DTO 신규 필드의 nullable/기본값/enum 선언은 대응 엔티티 컬럼과 전수 일치하고, spec §5.4 본문과의 line-level 불일치도 발견되지 않았다. 유일하게 남는 지적은 `SchedulesService.update()`가 스케줄을 PATCH로 비활성화하는 경로에서 `trigger` 필드 보존이 TypeORM의 암묵적 참조 반환 동작에 의존하며, 그 정확한 경로를 검증하는 테스트가 없다는 것이다 — 팀이 이미 주석으로 인지하고 있는 위험이지만 실제 회귀 테스트로 고정되지는 않았다.

## 위험도
LOW
