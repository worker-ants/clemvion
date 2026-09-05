# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 성공, 전문 확보)

## 전체 위험도
**LOW** — §5.4 응답-계약 스윕 1차(트리거/스케줄 secret 이중 유출 차단 + 23필드 선언 정합화)는 데이터 모델·기존 Rationale·정식 규약·plan 서술·신규 식별자 어느 축에서도 Critical 충돌이 없다. 신규 canary fixture 하나가 spec `code:` 등재 밖이라는 WARNING 1건과 비필수 INFO 다수만 남는다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | §5.4 래칫의 신규 canary fixture(가드 자기검증용 양성 대조군)가 spec `code:` glob 커버리지 밖 — `_glob_to_regex` 의 `*` 가 `/` 경계를 못 넘고 파일명도 `swagger-dto-contract`로 시작 안 함 | `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts` | `spec/conventions/swagger.md` / `spec/5-system/2-api-convention.md` frontmatter `code:` | `code:` 에 `codebase/backend/src/repo-guards/__tests__/fixtures/**` (또는 해당 파일 패턴) 추가하거나, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 후속 planner 항목으로 명시 등재 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 이전 라운드(19_08_19) CRITICAL — `notification_secret_v2` 저장형태 vs `14-external-interaction-api.md §7.1` 불일치 — 이미 정정 확인 (PR #1290, `secret-store.md` §1.1 등재) | `spec/5-system/14-external-interaction-api.md §7.1`, `spec/conventions/secret-store.md §1.1` | 조치 불요, 기록만 |
| 2 | cross_spec | `IntegrationDto` 신규 5필드가 `2-navigation/4-integration.md §9.1` 표에 아직 미등재 — data-model 과는 모순 없음, 이 브랜치 머지 후 포인터 추가 예정이 plan 에 명시됨 | `codebase/backend/.../integration-response.dto.ts`, `spec/2-navigation/4-integration.md §9.1` | 머지 후 planner 턴에서 §9.1 포인터 1줄 추가 |
| 3 | cross_spec | `IntegrationDto.consecutiveNetworkFailures` FE 미소비 노출 — 별도 트랙(`spec-draft-nullable-notation-followups.md`)에서 추적 중 | 동일 파일 | 중복 판단 불요 |
| 4 | convention_compliance | `ScheduleTriggerWorkflowRefDto`/`ScheduleTriggerRefDto` 클래스 JSDoc 에 내부 경위 서사가 섞여 `swagger.md §3`("JSDoc 은 공개 OpenAPI 로 나간다") 취지에서 벗어남 — `introspectComments` 가 클래스 레벨 JSDoc 을 공개 스키마로 승격하지 않음이 선행 라운드에서 실측 확인돼 공개 유출은 없음 | `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts` (3~21행) | 필수 아님 — 다음에 이 파일을 손댈 때 경위 서술을 `//` 주석으로 옮기고 `/** */` 는 한 줄 요약만 남김 |
| 5 | plan_coherence | `spec-draft-nullable-notation-followups.md` 안에서 메모이제이션 항목이 "미착수"(266~278줄, 미완 체크박스 메모)로도, "스윕 1차 절"에서 "이미 완료"로도 읽혀 자기모순 | `plan/in-progress/spec-draft-nullable-notation-followups.md:266-278` vs 동일 파일 "스윕 1차(2026-09-05)" 절 | 266~278줄을 "메모이제이션은 이 PR(`response-contract.ts`)에서 이미 완료 — 남은 것은 헬퍼 추출뿐"으로 정정 |
| 6 | naming_collision | 이전 라운드(19_08_19) WARNING — `OPTIONAL_NULLABLE_DRIFT` vs `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 근접 명명 중복 SoT — 양쪽 JSDoc 에 상호 포인터 추가로 해소 확인. 근접 명명 관찰 자체는 유효 | `execution-response.dto.spec.ts:62-70`, `swagger-dto-contract.spec.ts` | (선택) `2-api-convention.md` "검증 층" 절에 "상수 근접 명명 시 상호 포인터 필수" 한 줄 정식화 |
| 7 | naming_collision | 응답 경계 변환 헬퍼 명명이 서비스마다 다름(`sanitizeForResponse`/`toResponse`/`toResponseExecution`) — 동일 패턴, 다른 이름. 클래스 경계 안이라 충돌은 아님 | `TriggersService`/`SchedulesController`/`ExecutionsService` | 관찰만, 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 신규 DTO 필드 전부 `1-data-model.md` 와 일치. 이전 CRITICAL(secret 유출 서술 불일치) 해소 확인. `4-integration.md §9.1` 미등재는 의도된 지연 |
| rationale_continuity | NONE | §5.4·`secret-store.md §1.1`·기존 debt-ratchet 관행 모두 준수, Rationale 위반·기각 대안 재도입 없음 |
| convention_compliance | LOW | §5.4 형태 규칙·numeric wire 타입·양쪽 `code:` 등재 등 대부분 충실 준수. JSDoc 내부서사 잔존 2곳(비필수, 공개 미노출) |
| plan_coherence | LOW | 신규 canary fixture 가 `code:` glob 밖(WARNING). plan 문서 내 서술 자기모순 1건(INFO) |
| naming_collision | NONE | 신규 식별자 충돌 없음. 이전 WARNING(근접 명명 SoT 중복)은 상호 포인터로 해소 확인 |

## 권장 조치사항
1. (WARNING 해소) `spec/conventions/swagger.md` 또는 `spec/5-system/2-api-convention.md` frontmatter `code:` 에 `codebase/backend/src/repo-guards/__tests__/fixtures/**` 등 신규 canary fixture 경로를 추가하거나, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 후속 planner 항목으로 명시 등재한다.
2. (INFO, 선택) `spec-draft-nullable-notation-followups.md` 266~278줄의 메모이제이션 관련 서술을 "이미 완료" 상태로 정정해 자기모순을 해소한다.
3. (INFO, 선택) 다음에 `schedule-response.dto.ts` 를 손댈 때 `ScheduleTriggerWorkflowRefDto`/`ScheduleTriggerRefDto` 의 JSDoc 내부 서사를 `//` 주석으로 옮긴다.