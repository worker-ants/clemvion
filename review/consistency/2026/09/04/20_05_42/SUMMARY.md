# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — `spec/2-navigation/` 자체는 델타 0(정상), 실 구현 diff(alerts `AlertRuleDto.threshold` number→string 정정 + swagger-DTO 계약 가드 신설)는 navigation 영역과 직접 관련 없으나 API 문서 규약 관점에서 WARNING 2건, 그 외 문서 동기화성 INFO 4건 발견. Critical 없음.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | | | | | |

## planner 인계 (권한 밖 Critical)

> 해당 없음 — Critical 이 없어 인계 대상 없음.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (없음) | | | | |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | DTO JSDoc 에 내부 개발 서사("종전 `number` 라고 했다 — 거짓이었다" 등)가 그대로 공개 OpenAPI `description` 으로 노출 | `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` `AlertRuleDto.threshold` JSDoc (238~253줄) | `spec/conventions/swagger.md` §3 (소비자용 요약 1~2문장 + SoT 링크 원칙) | JSDoc 을 "임계값. wire 는 문자열(컬럼 numeric(12,4), 정밀도 보존). 쓰기는 number)" 로 축약하고 경위는 spec Rationale/CHANGELOG 로 이동 |
| 2 | convention_compliance | 신규 repo-wide DTO 불변식(`numeric`/`decimal` 컬럼 → 응답은 `string`)이 코드 가드로는 전역 강제되지만 `spec/conventions/swagger.md` 에는 규약화되지 않음 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` 신규 `findNumericAsNumber` | `spec/conventions/swagger.md` §1 (기존 DTO 불변식은 §1/§5 소절로 규약화해 온 관행) | swagger.md §1 에 "numeric/decimal 컬럼 → 응답은 string" 소절 추가(근거 1~2문장 + guard 링크), 최소한 pointer 라도 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `AlertRule.threshold` 읽기(string)/쓰기(number) 비대칭이 spec 양쪽에 문서화되지 않음 | `spec/2-navigation/9-user-profile.md` §6.3 (`GET /api/alerts` 응답 타입 미명시) / `spec/1-data-model.md` §2.25 (`Float` 라벨) | `GET /api/alerts` 응답 threshold 는 문자열 직렬화(정밀도 보존)임을 §6.3 또는 §2.25 각주로 명시 |
| 2 | cross_spec | `CHANGELOG.md` 신규 항목의 라우트 표기 오류 (`GET /api/alerts/rules`, 실제는 `/api/alerts`) | `CHANGELOG.md` Unreleased 항목 | `GET /api/alerts` 로 정정 |
| 3 | rationale_continuity | alerts DTO 타입 정정(`string`)이 `spec/1-data-model.md` §2.25 `Float` 표기와 표기상 간극 — target 스코프 밖 기록 | `spec/1-data-model.md` §2.25 `threshold` 행 | 후속 alerts/data-model 정합 검토에서 "API 응답은 string(wire), 개념 타입은 Float" 각주 판단 권장 (cross_spec INFO#1 과 동일 축, 중복 조치 불요) |
| 4 | plan_coherence | `3-schedule.md` Rationale 이 인용하는 plan 경로가 stale(`in-progress` → 실제 `plan/complete/`) | `spec/2-navigation/3-schedule.md` §Rationale "sort/order 쿼리 반영" 문단 | 경로를 `plan/complete/spec-sync-schedule-gaps.md` 로 갱신 (내용 충돌 없음, 링크만 낡음) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `spec/2-navigation/` 델타 0. alerts `threshold` wire 타입 정정이 spec 문서에 반영 안 됨(INFO) + CHANGELOG 라우트 오기(INFO). Critical/Warning 없음 |
| rationale_continuity | NONE | navigation 영역 Rationale 재도입/번복 없음. alerts↔data-model 표기 간극은 scope 밖 기록(INFO)만 |
| convention_compliance | LOW | navigation spec 자체는 API/명명/에러코드 규약과 잘 정렬. diff(alerts) 에서 JSDoc 노출 범위(WARNING)와 신규 불변식 미규약화(WARNING) 2건 |
| plan_coherence | LOW | navigation 델타 0, diff 는 관련 plan(`spec-draft-nullable-notation-followups.md`)에 정확히 추적됨. 무관한 기존 stale plan 경로 참조 1건(INFO) |
| naming_collision | NONE | diff 가 도입한 3개 식별자(`NumericAsNumberOffender`, `findNumericAsNumber`, `NUMERIC_COLUMN`) 전수 검색 결과 저장소 내 유일. 충돌 없음 |

## 권장 조치사항
1. (WARNING #1) `AlertRuleDto.threshold` JSDoc 을 소비자용 요약으로 축약 — 내부 개발 서사(오류 경위)는 spec Rationale/CHANGELOG 로 이동.
2. (WARNING #2) `spec/conventions/swagger.md` §1 에 "numeric/decimal 컬럼 → 응답 string" 소절 추가 또는 최소 guard 링크 pointer 삽입.
3. (INFO #1/#3, 낮은 우선순위) `spec/2-navigation/9-user-profile.md` §6.3 또는 `spec/1-data-model.md` §2.25 에 `threshold` 읽기/쓰기 비대칭 각주 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 기존 미결 항목과 함께 처리 가능.
4. (INFO #2, 선택) `CHANGELOG.md` 라우트 표기 정정.
5. (INFO #4, 선택) `spec/2-navigation/3-schedule.md` Rationale 의 plan 경로를 `plan/complete/` 로 갱신.
