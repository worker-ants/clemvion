# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 전문 확보, 재시도 필요 항목 없음)

## 전체 위험도
**LOW** — Critical 0건. WARNING 2건(모두 cross_spec, spec 동기화 누락 성격)과 INFO 4건. rationale_continuity·plan_coherence 는 NONE, naming_collision 도 NONE. 기능을 깨뜨리는 직접 모순은 없다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `ScheduleDto.trigger`/`ScheduleTriggerRefDto.workflow` 를 키-생략형(`@ApiPropertyOptional`)으로 신규 선언 — data model 의 NOT NULL 1:1 보장 및 실측 호출부(모든 서비스 경로가 무조건 `trigger` 를 채움)와 어긋나고, §5.4 가 요구하는 "선택 근거를 그 필드를 문서화하는 절에 명시" 가 spec 어디에도 없음 | `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts` (`ScheduleTriggerRefDto.workflow?`, `ScheduleDto.trigger?`), `schedules.controller.ts` `toResponse()` | `spec/1-data-model.md §2.9.1`(Schedule.trigger_id NOT NULL 1:1), `spec/5-system/2-api-convention.md §5.4`(부재 표현 선택 기준 + 문서화 의무) | `spec/2-navigation/3-schedule.md §4` 또는 `1-data-model.md §2.9.1` 에 `trigger` 필드와 참조 형태를 문서화하고 부재 발생 경로를 §5.4 (a)/(b) 기준으로 명시하거나, 실측대로 상시 존재하면 `@ApiProperty(nullable:false)` 등 기본형으로 재검토. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 `IntegrationDto` 항목과 대칭되는 포인터 항목 추가 |
| 2 | cross_spec | `spec/conventions/secret-store.md §1` 의 "노출 창이 아직 닫히지 않았다"(현재형) 서술이 이 PR 로 stale 화됨 — `TRIGGER_RESPONSE_STRIP_COLUMNS` + `schedules.controller.ts` allowlist 좁히기가 정확히 그 갭(`GET/POST/PATCH /api/triggers`, `GET /api/schedules`)을 닫았는데 spec 텍스트는 갱신 안 됨 | (코드) `triggers.service.ts` `TRIGGER_RESPONSE_STRIP_COLUMNS`/`sanitizeForResponse()`, `schedules.controller.ts` `toResponse()` | `spec/conventions/secret-store.md §1`(line 69-78) | §7.1 정정 이력 패턴(원문 취소선 + "정정 이력(날짜)" 블록)을 따라 "노출 창이 이 PR 로 닫혔다"와 커밋 참조를 추가. `spec/` 쓰기이므로 별도 planner 턴 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `ScheduleTriggerWorkflowRefDto` 클래스 JSDoc 에 보안사고 경위 등 내부 서사가 여전히 섞여 있음 (2라운드째 미수정 재발견). `introspectComments` 는 클래스 레벨 JSDoc 을 공개 OpenAPI 로 승격하지 않아 실질 wire 유출은 없음 — 차단 사유 아님 | `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts` 3~14행 | `spec/conventions/swagger.md §3` 원칙대로 경위 서술을 클래스 위 `//` 블록으로 이동, `/** */` 는 한 줄 요약만. 다음에 이 파일을 건드릴 때 함께 정리해도 무방 |
| 2 | convention_compliance | §5.4 래칫 양성 대조군 fixture(`optional-nullable.fixture.ts`)가 `spec/5-system/2-api-convention.md` `code:` glob 커버리지 밖 — 이미 정확한 절차(developer 가 spec 미수정, planner 후속 트래커에만 등재)로 처리됨. 위반 아님, 확인 차원 | `spec/5-system/2-api-convention.md` frontmatter `code:` | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속 항목으로 등재됨 — 별도 조치 불요 |
| 3 | naming_collision | 신규 fixture 파일(`optional-nullable.fixture.ts`)이 `repo-guards/__tests__/` 기존 fixture(평면 배치 + `-fixture.ts` 하이픈)와 배치·접미사 컨벤션이 다름(의도적 — 경로 술어 통과 목적). 저장소 유일 패턴이라 향후 판단 기준 부재 | `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts` | 결정 되돌릴 필요 없음. `repo-guards/__tests__/` 상단에 "경로 술어를 통과해야 하는 fixture 는 중첩+`.fixture.ts`, 그 외는 평면+`-fixture.ts`" 한 줄 규칙을 남기면 다음 충돌 예방 |
| 4 | naming_collision | `ScheduleTriggerRefDto`/`ScheduleTriggerWorkflowRefDto` 가 저장소 최초의 "narrowed reference DTO" — 선례 명명 규칙 없음(현재 충돌 없음) | `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts` | 조치 불요. 두 번째 유사 DTO 등장 시 `spec/conventions/`에 명명 패턴 문서화 권고 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `ScheduleDto.trigger` 키-생략형 선언의 §5.4 근거 미문서화, `secret-store.md §1` stale 서술 — 둘 다 spec 동기화 누락, 기능 모순 아님 |
| rationale_continuity | NONE | 신규 커밋(`67881bbd4`)은 기존 원칙(§5.4, `appUrl: string\|null`, create/update 불변식)의 일관 적용일 뿐, 새 설계 결정·기각 대안 재도입 없음 |
| convention_compliance | LOW | 신규 순증분은 §5.4 대칭 복구로 규약 위반 없음. INFO 2건은 재확인(JSDoc 서사 잔존, fixture code: 공백 — 후자는 이미 정확한 경계로 planner 등재됨) |
| plan_coherence | NONE | 이전 3라운드 WARNING 전부 이번 커밋 시점 해소 확인. plan 과 diff 간 불일치 없음 |
| naming_collision | NONE | 신규 식별자(DTO 2개·필드 23개·상수 5개·함수 6개·파일 1개) 전수 대조 결과 기존 정의와 충돌 없음. INFO 2건은 선례 부재/컨벤션 미문서화일 뿐 |

## 권장 조치사항
1. `spec/2-navigation/3-schedule.md §4` 또는 `spec/1-data-model.md §2.9.1` 에 `ScheduleDto.trigger`/`ScheduleTriggerRefDto.workflow` 필드를 문서화하고 §5.4 선택 근거(왜 키-생략형인지, 실측대로 상시 존재라면 기본형 전환 검토)를 명시 (WARNING #1)
2. `spec/conventions/secret-store.md §1` 을 갱신해 이 PR 이 노출 창을 닫았음을 반영 — §7.1 정정 이력 패턴 준용 (WARNING #2)
3. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 `ScheduleDto.trigger` planner 후속 포인터 항목을 `IntegrationDto` 항목과 대칭으로 추가
4. (선택, 비차단) `schedule-response.dto.ts` 클래스 JSDoc 의 내부 서사를 `//` 주석으로 이동
5. (선택, 비차단) `repo-guards/__tests__/` fixture 명명·배치 컨벤션 한 줄 문서화