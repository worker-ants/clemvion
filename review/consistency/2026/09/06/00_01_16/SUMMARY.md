# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — `spec/5-system/` 델타 0(코드 전용 PR). §5.4 응답-계약 스윕과 비밀 필드 스트립이
관련 spec(`api-convention.md §5.4`, `secret-store.md §1.1`, `1-data-model.md`, nav-spec,
plan 트래커) 전 영역과 1:1 정합. CRITICAL/WARNING 없음, INFO 10건만 존재.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `ScheduleDto.trigger`/`ScheduleTriggerRefDto.workflow`/`TriggerDto.workflow` 키-생략 사유가 nav-spec 미반영 | `spec/2-navigation/3-schedule.md` §4 인근 · `2-trigger-list.md` | 조치 불요 — `plan/in-progress/spec-draft-nullable-notation-followups.md` W1/W2 로 이미 등재 |
| 2 | cross_spec | `IntegrationDto.consecutiveNetworkFailures` 신규 노출 필드가 `4-integration.md §9.1` 미등재 | `spec/2-navigation/4-integration.md §9.1` | 조치 불요 — 같은 plan 파일에 "노출 중단 검토"로 이미 등재 |
| 3 | rationale_continuity | §5.4 "금지 조합"(optional+nullable) 축의 소급 면제가 원문 문맥의 유추 적용 | `swagger-dto-contract-guard.ts` `EXPECTED_OPTIONAL_NULLABLE_DRIFT`(78건) | 급하지 않음 — 다음 §5.4 편집 시 "DTO 선언 형태 위반 조합도 비소급 대상" 한 줄 명문화 권장 |
| 4 | convention_compliance | 응답 DTO 가 엔티티에서 유니온 타입을 직접 import (`swagger.md §5-1`과 경계 모호) | `trigger-response.dto.ts` 1~4행 | 조치 불요에 가까움 — 값 배열은 엔티티에서 파생되지 않아 실질 위험 낮음. 규약 문구에 예외 명시 시 재해석 분쟁 예방 |
| 5 | convention_compliance | 동일 파일 내 동일 enum 값 배열(`chatChannelHealth`/`notificationHealth`) 두 번 반복 선언, `*.literal.ts` 미추출 | `trigger-response.dto.ts` 107행/123행 | 현상 유지 권장 — 두 축이 독립 진화 가능함을 방어 근거로 DTO 파일에 한 줄 남기면 오독 방지 |
| 6 | plan_coherence | `secret-store.md §1` "노출 창이 아직 닫혀 있지 않다" 서술이 이 PR 머지 순간 stale 화 | `spec/conventions/secret-store.md §1` | 이 PR 조치 불요(스코프 밖) — 병합 후 `spec-draft-nullable-notation-followups.md` 후속 planner 턴이 §7.1 정정 이력 패턴으로 집행되는지만 확인 |
| 7 | plan_coherence | `4-integration.md §9.1` IntegrationDto 확장 필드 포인터 — 이 브랜치가 선행조건 충족 | `spec/2-navigation/4-integration.md §9.1` | 이 PR 조치 불요 — 병합 후 두 plan 문서의 §9.1 포인터 항목이 열릴 수 있음을 integrator 인지 |
| 8 | plan_coherence | 신규 래칫 fixture(`optional-nullable.fixture.ts`)가 아직 어떤 spec `code:`에도 미등재 | `spec/5-system/2-api-convention.md` frontmatter `code:` | 이 PR 조치 불요 — spec 쓰기는 developer 권한 밖, 이미 planner 항목으로 등재됨 |
| 9 | naming_collision | `TriggerWorkflowRefDto`/`ScheduleTriggerWorkflowRefDto` — 같은 개념(트리거-워크플로우 참조)을 다른 이름·필드 구성으로 표현 | `trigger-response.dto.ts` / `schedule-response.dto.ts` | 지금 정정 불요 — 세 번째 Ref DTO 추가 시 명명 표준화 검토 |
| 10 | naming_collision | 신규 fixture 파일이 `repo-guards/__tests__/` 인접 fixture와 다른 서브폴더/구두점 관례(`fixtures/dto/responses/optional-nullable.fixture.ts`) | `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts` | 파일 충돌 아님 — 이후 fixture 추가 시 표준화 여부만 판단 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec 델타 0, 코드가 `1-data-model.md`·nav-spec·`secret-store.md §1.1`과 필드/타입/nullable/비밀 스트립 대상 1:1 대응. INFO 2건(nav-spec 문서화 지연, 둘 다 plan에 이미 등재) |
| rationale_continuity | NONE | §5.4·secret-store.md §1.1 Rationale을 그대로 구현·확장. 무근거 번복·기각된 대안 재도입 없음. INFO 1건(유추 적용 명문화 권장) |
| convention_compliance | NONE | swagger.md §1-3/§1-6/§3/§5-1/§5-2, review-citations.md 광범위 준수. INFO 2건(엔티티 타입 import 선례 연장, enum 값 배열 중복 — 둘 다 실질 wire 리스크 없음) |
| plan_coherence | LOW | 두 개의 별도 planner 턴(notification-secret-storage, nullable-notation-followups)이 위임한 항목을 정확히 구현, 체크리스트 동기화 확인. INFO 3건(전부 "이 PR 머지 후" 후속 조치, 이미 트래커 등재) |
| naming_collision | NONE | spec 델타 0으로 신규 요구사항 ID/endpoint/이벤트명/환경변수 없음. 신규 클래스·상수 저장소 전체 grep으로 유일성 확인. INFO 2건(Ref DTO 이명, fixture 서브폴더 관례) |

## 권장 조치사항

1. (BLOCK 해소 사유 없음 — 현재 병합 차단 요인 없음)
2. 병합 후 후속 조치(이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 및
   `spec-draft-notification-secret-storage.md`에 등재됨, 새 항목 생성 불요):
   - `secret-store.md §1` "노출 창 열림" 서술을 §7.1 정정 이력 패턴으로 갱신
   - `4-integration.md §9.1`에 `IntegrationDto` 신규 6필드(`appUrl`/`mallId`/`tokenExpiresAt`/
     `lastRotatedAt`/`lastUsedAt`/`consecutiveNetworkFailures`) 문서화
   - `ScheduleDto.trigger`/`ScheduleTriggerRefDto.workflow`/`TriggerDto.workflow` 키-생략
     사유를 `3-schedule.md`/`2-trigger-list.md`에 반영
   - `2-api-convention.md` frontmatter `code:`에 `fixtures/**` glob 추가해 래칫 fixture 등재
3. (선택, 급하지 않음) 다음 `2-api-convention.md §5.4` 편집 기회에 "DTO 선언 형태 위반
   조합도 비소급 대상" 한 줄 명문화, `swagger.md §5-1`에 "타입만 import, 값 배열은 직접
   선언"하는 경우의 예외 명시
