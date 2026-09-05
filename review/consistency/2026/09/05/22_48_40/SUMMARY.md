# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 성공, 인라인 전문 확보)

## 전체 위험도
**LOW** — `spec/5-system/` 자체는 델타 0(코드 전용 §5.4 응답-계약 스윕), 직전 라운드(`22_25_00`)의 CRITICAL(`interaction.triggerToken` 평문 노출)이 이번 diff(`66a2510fd`)의 `INTERACTION_RESPONSE_STRIP_KEYS` 로 해소됐음을 5개 checker 전원이 교차 확인. 유일한 잔여는 신규 참조 DTO 2개의 클래스 JSDoc 에 리뷰 인용/정정 경위가 남은 WARNING 1건.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | 응답 DTO **클래스** JSDoc(`/** */`)에 리뷰 인용·정정 경위(`review/code/2026/09/05/21_40_37 W1` 등)를 그대로 남김 — 같은 날 등재된 `review-citations.md §3`("DTO·컨트롤러의 `/** */` JSDoc 은 리뷰 인용 대상 아님")·`swagger.md §3`("내부 서사는 `//`로") 문면 위반. 같은 diff 의 **필드** JSDoc(`ScheduleDto.trigger`)은 규칙을 정확히 지켰다는 점에서 클래스/필드 간 일관성 결여가 뚜렷함. 완화: `@nestjs/swagger` 플러그인 실측 결과 클래스 JSDoc 은 OpenAPI `description` 으로 새어 나가지 않아 라이브 wire 유출은 없음 | `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:7-16`(`TriggerWorkflowRefDto`), `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts:3-14`(`ScheduleTriggerWorkflowRefDto`) | `spec/conventions/review-citations.md §3`, `spec/conventions/swagger.md §3` | 두 클래스 JSDoc 을 필드 예시와 동일 패턴으로 쪼갠다 — 소비자용 설명만 `/** */` 에 남기고 "왜 새로 만들었는지·어느 리뷰가 찾았는지"는 바로 위 `//` 로 이동. (대안: 이 클래스/필드 경계가 의도된 완화라면 `review-citations.md §3` 표 행을 "필드 `/** */`" 로 명시 좁히는 규약 갱신) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `TriggerDto.chatChannelHealth`/`notificationHealth` 가 엔티티 모듈에서 타입을 `import type` — `swagger.md §5-1`("엔티티 enum 에서 파생하지 않는다") 문면과는 어긋나나, 저장소 전역에 이미 6곳 이상(`edge-response.dto.ts` 등) 동일 관행이 있어 이번 diff 특유의 이탈이 아님 | `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:2-5,107,123` | 이번 PR 범위 밖. 다음에 손댈 때 `*.literal.ts` 추출 고려. §5-1 문면-관행 괴리 자체를 별도로 실측·정리하는 편이 값짐 |
| 2 | naming_collision | `SchedulesController.toResponse` vs `ExecutionsService.toResponseExecution` — 같은 역할("엔티티→응답 매핑")에 명명 패턴 불일치(접미사 유무). 충돌 아님(스코프 분리, 의미 충돌 없음) | `codebase/backend/src/modules/schedules/schedules.controller.ts`(신설 `toResponse`) vs `codebase/backend/src/modules/executions/executions.service.ts:1070` | 조치 불필요. 향후 같은 패턴이 늘면 저장소 전역 관례(`to<Resource>Response` 또는 클래스-로컬 `toResponse`) 통일 고려 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 직전 라운드(`22_25_00`) CRITICAL(`config.interaction.triggerToken` 평문 노출)이 `INTERACTION_RESPONSE_STRIP_KEYS` 로 해소됨을 코드·회귀 테스트 양쪽에서 확인. `secret-store.md §1.1` 이 열거한 5개 노출 경로 전부 스트립 완료. 신규/보강 DTO 필드(트리거 7·통합 6·지식베이스 7·알림규칙 2) 전부 `spec/1-data-model.md`·`spec/2-navigation/**`·`spec/5-system/**` 와 필드명·타입·nullable·enum 단위 일치 |
| rationale_continuity | NONE | §5.4(부재 표현 규칙)·`secret-store.md §1.1/§5.5` 기존 Rationale 을 위반하지 않고 적용 범위를 확장. PR 내 자체 실수(`ApiPropertyOptional`+`nullable:true` 1건)를 같은 PR 안에서 발견·정정하고 회귀 가드(`OptionalNullableOffender`)까지 추가한 이력이 정직하게 기록됨 |
| convention_compliance | LOW | 클래스 JSDoc 리뷰 인용 WARNING 1건(§review-citations/swagger §3, 라이브 유출은 없음) + 엔티티 타입 import INFO 1건(기존 관행). `secret-store.md §1.1` 완전 준수, §5.4 nullable/optional 분기 정확, 검증 층 3축 정상 동작 등 다수 준수 확인 |
| plan_coherence | NONE | 직전 라운드 WARNING(`TriggerDto.workflow` nav-spec 트래커 누락)이 최신 커밋(`66a2510fd`)에서 해소됨. 자매 plan(`spec-draft-notification-secret-storage.md`)이 이 브랜치 병합을 전제로 건 두 항목(노출 차단 코드·`IntegrationDto` 5필드)과 정확히 대응. 함수 리네임(`sanitizeChatChannelForResponse`→`sanitizeForResponse`) 관련 stale plan/spec 참조 없음 |
| naming_collision | NONE | 신규 식별자(클래스 6·함수 3·모듈 상수 5·옵션 키 1·private 메서드 2) 전수 재검색 결과 기존과 다른 의미로 충돌하는 동명 식별자 없음. `sanitizeForResponse` 리네임은 9곳 호출부 동시 치환으로 구 이름 잔존 0건. `toResponse` 명명 스타일 INFO 1건만 |

## 권장 조치사항
1. `TriggerWorkflowRefDto`(`trigger-response.dto.ts:7-16`)·`ScheduleTriggerWorkflowRefDto`(`schedule-response.dto.ts:3-14`) 클래스 JSDoc 에서 리뷰 인용·정정 경위를 바로 위 `//` 내부 주석으로 이동해 `review-citations.md §3`/`swagger.md §3` 문면을 맞춘다(라이브 유출은 없어 긴급하지 않으나 다음 커밋에서 정리 권장).
2. (선택, 이번 PR 범위 밖) `chatChannelHealth`/`notificationHealth` 등 엔티티 타입 재사용 패턴과 `swagger.md §5-1` 문면 간 괴리(저장소 전역 6곳+)를 별도 실측 후 규약 갱신 또는 일괄 리팩터 여부를 결정한다.
