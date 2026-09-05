# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 성공, 전문 전량 확보)

## 전체 위험도
**MEDIUM** — Critical 없음. 다만 convention_compliance 가 "직전 라운드가 고친 위반을 같은 커밋이 다른 필드에 재도입"한 WARNING 1건을 새로 검출해 이번 라운드 최고 위험도를 끌어올림. 나머지는 전부 INFO(대부분 이미 plan 에 등재된 후속 항목).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | 직전 fix 커밋(66a2510fd)이 `ScheduleDto.trigger`/클래스 JSDoc 에서 고친 "리뷰 인용을 필드 JSDoc 에 남기는" 위반을, 바로 다음 커밋(48704becd)이 신규 `ScheduleTriggerRefDto.workflow` 필드 JSDoc 에 재도입("종전 이 주석은 ... 틀렸다 (`review/code/.../22_48_39` W3)"). 필드 JSDoc 은 `introspectComments` 로 공개 OpenAPI `description` 에 그대로 노출되어 문면상 위반을 넘어 기능적 유출 | `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts:34-47` | `spec/conventions/swagger.md §3`(주석/설명 톤) / `spec/conventions/review-citations.md §3`(DTO·컨트롤러 JSDoc 은 리뷰 인용 대상 아님) | 해당 필드 JSDoc 에서 "종전 이 주석은 ... 틀렸다" 정정 서술을 삭제하고, 같은 파일의 `ScheduleDto.trigger` 가 쓴 패턴대로 `//` 내부 주석으로 옮긴다. JSDoc 에는 소비자가 읽을 내용(필드가 언제 채워지는지)만 남긴다 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `ScheduleDto.trigger`/`ScheduleDto.trigger.workflow`/`TriggerDto.workflow` 키-생략 사유가 필드 JSDoc 에만 있고 `spec/2-navigation/2-trigger-list.md`·`3-schedule.md` 의 API 표에는 아직 미반영 | `spec/5-system/2-api-convention.md §5.4` vs nav-spec | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` (planner, `21_40_38` W1 / `22_25_00` W2)에 등재됨 — 중복 지적 불요, 그대로 진행 |
| 2 | cross_spec | `IntegrationDto.consecutiveNetworkFailures` 신규 노출 필드가 `spec/2-navigation/4-integration.md §9.1` 응답 필드 설명에 미등재 | `spec/2-navigation/4-integration.md §9.1` | 동일 plan 파일에 "노출 중단 검토" 항목으로 이미 등재 — 별도 처리 불요 |
| 3 | cross_spec, plan_coherence | §5.4 ratchet 양성 대조군(`optional-nullable.fixture.ts`)이 `2-api-convention.md`/`swagger.md` frontmatter `code:` glob 밖이라, 이 fixture 를 약화시키는 편집이 있어도 `--impl-done` 재검토가 트리거 안 됨 | `spec/5-system/2-api-convention.md` frontmatter `code:` / `spec/conventions/swagger.md` frontmatter `code:` | 이미 plan 항목(planner, `20_45_39` W1)으로 등재 — 다음 planner 턴에서 `code:` 에 `codebase/backend/src/repo-guards/__tests__/fixtures/**` 추가 권장(우선순위 상향 제안) |
| 4 | rationale_continuity | 이 PR 초안이 §5.4 금지 조합(`ApiPropertyOptional`+`nullable:true`, 23개 필드 중 17개)을 재도입했다가 같은 세션의 `--impl-done 18_23_03` 라운드가 Critical 로 검출, 전량 정정 + 3번째 정적 축(래칫) 신설로 재발 방지까지 완료 | `plan/in-progress/spec-draft-nullable-notation-followups.md`, `CHANGELOG.md` | 조치 불요 — 이미 해소, CHANGELOG·plan 에 투명하게 기록됨 |
| 5 | convention_compliance | `TriggerDto.chatChannelHealth`/`notificationHealth` 가 엔티티 타입을 그대로 import(`swagger.md §5-1` DTO-엔티티 결합 금지 경향과 어긋남) | `trigger-response.dto.ts:2-5` | 직전 라운드(`22_48_40`)부터 재확인된 저장소 전역 기존 패턴(6곳+), 이번 diff 고유 이탈 아님 — 이번 범위 조치 불요, 다음에 손댈 때 리터럴 타입 추출 고려 |
| 6 | plan_coherence | `spec/conventions/secret-store.md §1` "노출 창이 아직 닫혀 있지 않다" 서술이 이 브랜치 머지 시 사실과 어긋나게 됨(이 브랜치가 실제로 그 창을 닫음) | `spec/conventions/secret-store.md §1` | `plan/in-progress/spec-draft-notification-secret-storage.md` 가 "머지되면 닫는다"고 이미 조건부 처분 — 미해결 결정과의 충돌이 아니라 정상 집행. planner 다음 턴에서 문구 갱신 필요(developer 가 쓴 문장이 아니므로 자기-반증형 소정정 대상 아님) |
| 7 | plan_coherence | `spec-draft-api-convention-verifier-registration.md`, `spec-draft-notification-secret-storage.md` 두 plan 이 열린 체크박스 0개인데도 `plan/in-progress/`에 남아 있음(이 브랜치가 만든 문제 아님, 사전 존재) | `plan/in-progress/` 두 파일 | planner 다음 턴에서 `plan/complete/`로 이동 |
| 8 | naming_collision | `SchedulesController.toResponse` vs `ExecutionsService.toResponseExecution` — 같은 역할(엔티티→응답 매핑)의 private 메서드 명명 패턴 불일치. 충돌 아님, 스타일 관찰 | `schedules.controller.ts` / `executions.service.ts` | 이번 PR 범위 조치 불요 — 향후 같은 패턴이 늘면 저장소 전역 관례 통일 검토 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec/5-system 델타 0(정상). 데이터모델·nav-spec·secret-store·EIA/chat-channel 전 영역 필드명·타입·nullable·시크릿 스트립 1:1 일치. 잔여는 문서 동기화 지연 3건, 전부 plan 에 이미 등재 |
| rationale_continuity | NONE | §5.4/secret-store 기존 Rationale 위반 없음. PR 초안의 자체 위반은 같은 세션 리뷰로 즉시 정정되어 HEAD 에 잔존 없음 |
| convention_compliance | MEDIUM | 직전 라운드가 고친 "리뷰 인용을 JSDoc 에 남기는" 위반을 같은 커밋이 다른 필드에 재도입(WARNING, 실제 OpenAPI 노출 유출). 그 외 §5.4/numeric/secret-store/명명 규약 전부 준수 |
| plan_coherence | LOW | target(spec/5-system) 델타 0. 이 브랜치는 plan 이 이미 조건부로 걸어 둔 결정(secret 노출 창 닫기)을 정상 집행. 새 설계 질문은 전부 planner 배정으로 올바르게 이월됨 |
| naming_collision | NONE | 신규 식별자 16개 전수 재검색, 기존 다른 의미로 쓰이는 충돌 없음. 개명(`sanitizeForResponse`)도 전 호출부 동시 치환으로 잔존 구식별자 없음 |

## 권장 조치사항
1. (WARNING 해소) `schedule-response.dto.ts` 의 `ScheduleTriggerRefDto.workflow` 필드 JSDoc 에서 리뷰 인용/정정 서술("종전 이 주석은 ... 틀렸다 (`review/code/.../22_48_39` W3)")을 삭제하고 `//` 내부 주석으로 이동 — 공개 OpenAPI `description` 노출 방지.
2. (INFO, planner 턴) `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 기등재 항목 진행: (a) nav-spec 에 `trigger`/`workflow` 키-생략 사유 반영, (b) `IntegrationDto.consecutiveNetworkFailures` 노출 여부 결정, (c) §5.4 ratchet fixture 를 `2-api-convention.md`/`swagger.md` frontmatter `code:` 에 등재.
3. (INFO, planner 턴) `spec/conventions/secret-store.md §1` "노출 창 미마감" 문구를 이 브랜치 머지 시점에 맞춰 갱신, 열린 항목 0개인 plan 2건을 `plan/complete/`로 이동.
