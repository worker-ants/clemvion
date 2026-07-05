# Rationale 연속성 검토 — V-10 (트리거 목록 findAll() cron/nextRunAt 배치 enrichment)

## 검토 대상

`plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-10 — `spec/2-navigation/2-trigger-list.md` §2.1(목업 `0 9 * * * Next: 09:00`)이 목록 행에 Schedule cron/다음 실행 시각 표시를 명시하는데, 실제 `triggers.service.ts findAll()` 은 schedule join 없이 반환하고(enrichment 는 `findOneDetail` 단건에만), 응답 DTO(`TriggerDto.cronExpression`/`timezone`/`nextRunAt`)의 Swagger 주석도 "단건 조회 시에만 채워짐" 이라 명시한다. 채택 방향은 "코드 구현" — `findAll()` 에 `type=schedule` 행 대상 schedule 테이블 일괄 `IN` join 을 추가해 3자(spec·코드·DTO 주석) 불일치를 해소한다.

## 발견사항

기존 spec 전체(`2-trigger-list.md` R-1~R-16, `1-data-model.md` Rationale, `2-navigation/3-schedule.md` Rationale, `5-system/2-api-convention.md` Rationale)를 조사한 결과, "schedule enrichment(cron/nextRunAt)는 detail-only 로 유지한다" 는 취지의 명시적 `## Rationale` 항목은 **어디에도 존재하지 않는다**. `TriggerDto` 의 "단건 조회 시에만 채워짐" 주석은 spec 의 `## Rationale` 이 아니라 코드 쪽의 **현재 동작 서술**(사실 기록)일 뿐, 대안 비교 후 의도적으로 채택한 설계 결정이 아니다. 이 구분이 이번 검토의 핵심이다 — "폐기된 결정의 재도입" 이 성립하려면 과거에 명시적으로 검토·기각한 대안이 있어야 하는데, 그런 ADR 은 발견되지 않았다.

오히려 인접 선례는 이 방향을 지지한다:

- `spec/2-navigation/1-workflow-list.md §2.4` "마지막 실행순" 정렬은 이미 목록 쿼리에서 `execution` 테이블의 워크플로별 `MAX(started_at)` **correlated subquery** 를 배치로 계산해 목록 행에 노출한다 — "목록 레벨에서 연관 테이블 파생 값을 배치로 enrichment 하는 패턴" 이 이 코드베이스에 이미 선례로 존재.
- `schedules.service.ts findAll()` (Schedule 화면 자신의 목록 API) 은 `leftJoinAndSelect('s.trigger', 't')` 로 이미 trigger 를 배치 join 하고 있다 — 같은 도메인 내에서 "목록 조회 시 연관 엔티티 배치 join" 이 기존 관행이다.

이 두 선례를 감안하면, V-10 의 "코드 구현(findAll 배치 join)" 방향은 기존 합의 원칙과 **정합**하며, 오히려 detail-only 로 놔두는 쪽이 이 코드베이스의 기존 패턴에서 벗어난 예외다.

### 확인해야 할 사소한 정합 포인트 (INFO)

- **[INFO]** `TriggerDto` Swagger 주석 갱신 필요
  - target 위치: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` V-10 (코드 구현 옵션)
  - 과거 결정 출처: 해당 없음 (기존 spec Rationale 에 이 항목 없음 — 코드 주석만 존재)
  - 상세: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` 의 `cronExpression`/`timezone`/`nextRunAt` 세 필드 주석이 "schedule 타입 트리거 단건 조회 시에만 채워짐" 이라 되어 있다. `findAll()` 배치 join 을 구현하면 이 주석이 stale 해진다 (목록에서도 채워짐).
  - 제안: 구현 시 위 세 주석을 "단건 조회 및 목록 조회(schedule 타입) 모두에서 채워짐" 또는 유사 문구로 함께 갱신. Swagger 문서·코드·spec 3자 정합을 유지하려면 이 주석 갱신이 V-10 구현 체크리스트에 포함되어야 한다 (구현 완료 후 이 주석만 stale 로 남으면 새로운 3자 불일치가 재발한다).

- **[INFO]** `2-trigger-list.md` §2.1 표 기술이 "필요조건"만 서술 — 구현 후 Rationale 신설은 선택
  - target 위치: `spec/2-navigation/2-trigger-list.md §2.1` "Schedule 태그" 행 + §3 API 표
  - 과거 결정 출처: 없음 (신규 결정)
  - 상세: 이번 변경은 "번복" 이 아니라 미이행 상태(gap)의 최초 이행이므로 새 Rationale 항목이 의무는 아니다. 다만 성능 트레이드오프(목록 쿼리에 `IN` join 1회 추가)를 명시적으로 남기면 향후 유사 배치-enrichment 판단(예: webhook 트리거의 chatChannelHealth 등)에 참조 가치가 있다.
  - 제안: `2-trigger-list.md` Rationale 에 R-17(가칭) 로 "findAll() schedule cron/nextRunAt 배치 join — 목록 §2.1 약속 이행" 을 1-workflow-list §2.4 correlated subquery 선례와 함께 짧게 기록하면 향후 유사 판단에 도움이 되지만 필수는 아니다.

## 요약

V-10 이 채택한 "findAll() 배치 join 으로 schedule cron/nextRunAt 목록 enrichment" 방향은 기존 spec 의 `## Rationale` 어디에서도 명시적으로 기각된 대안이 아니다. 코드의 "단건 조회 시에만 채워짐" DTO 주석은 설계 ADR 이 아니라 미이행 상태를 기술한 현재 동작 설명이며, 오히려 `1-workflow-list.md §2.4`(마지막 실행순 correlated subquery)와 `schedules.service.ts findAll()`(trigger left join) 두 선례가 "목록 조회에서 연관 데이터 배치 enrichment" 를 이미 정착된 패턴으로 뒷받침한다. 따라서 이 변경은 결정 번복이 아니라 스펙에 명시된 §2.1 약속의 최초 이행(gap 해소)이며, 새 Rationale 작성은 권장 사항일 뿐 의무는 아니다. 유일하게 실무적으로 챙겨야 할 점은 `TriggerDto` 의 "단건 조회 시에만 채워짐" Swagger 주석이 구현과 함께 갱신되지 않으면 새로운 3자 불일치(코드 주석 vs 실제 동작)가 재발한다는 점이다.

## 위험도

NONE
