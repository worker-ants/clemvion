---
title: 사용자 결정 3건 집행 — 여분 키 유지 · `input` deprecation · 길이 규칙 비강제화
status: in-progress
worktree: swagger-decisions-d24f77
started: 2026-08-23
owner: developer
spec_impact:
  - spec/conventions/swagger.md
---

# 사용자 결정 3건 집행

2026-08-23 결정 브리핑에 대한 사용자 판단을 집행한다. 셋 다 정본 트래커
[`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md)
에 *"사용자 판단 필요"* 로 열려 있던 항목이다.

| 항목 | 결정 | 성격 |
| --- | --- | --- |
| ① `execute` 여분 키 400 거부 | **(b) 현행 유지** | 코드 무변경 — 결정 기록만 |
| ② `ExecuteWorkflowDto.input` 동명이의 | **현행 유지 + deprecation 방향** | developer |
| ③ `swagger.md §3` 길이 규칙 | **(c) 강제 대상 아님 명문화** | planner |

## ① 현행 유지 — 왜 이게 결정인가

*"미룬다"* 가 아니라 **"거부하지 않기로 정했다"** 다. 그래서 항목을 닫는다 — 열어 두면 다음
사람이 같은 조사를 반복한다.

기록해야 할 것: `execute` 는 전역 파이프에 **진입하지 않고**(`toValidate()` 가 `Object`
제외), 형제 `re-run` 은 진입한다. **이 비대칭은 의도적으로 유지되는 상태**이지 미발견 결함이
아니다 — 그걸 안 적으면 다음 리뷰가 다시 CRITICAL 로 올린다.

## ② `deprecated` 표시 — 리네임이 아니다

checker 는 `legacyInput` 리네임을 제안했으나 **성립하지 않는다**: 런타임이 `body?.input` 을
읽으므로 DTO 속성명만 바꾸면 OpenAPI 가 없는 필드를 광고한다.

코드가 이미 답을 말하고 있다 — `parameterValues ?? input.parameters` 로 **`parameterValues`
가 preferred** 이고 `input` 은 back-compat 다. `deprecated: true` 는 비파괴이고 클라이언트를
올바른 필드로 유도하므로, 동명이의가 **시간이 지나며 저절로 해소**된다.

## ③ 길이 규칙 — 실측이 "규칙 아님" 을 말한다

| 범위 | 40자 초과 |
| --- | --- |
| 요청 DTO | 116/335 (34%) |
| 응답 DTO | 58/128 (**45%**) |
| 전체 | **174/463 (37%)** |

37% 미준수는 *"규칙이 안 지켜진다"* 가 아니라 **"그건 규칙이 아니라 스타일 힌트다"** 는 뜻이다.
문면도 이미 `내외` 로 완충을 달고 있다. §3 이 자기 예외를 도입할 때 쓴 *"이미 굳은 관행의
추인"* 논리를 기본 규칙에도 적용한다.

**강제는 정말 필요한 곳에만 남긴다** — 엔드포인트 `summary` 는 목록 UI 에서 잘리므로 길이가
기능적 제약이다. DTO `description` 은 그렇지 않다.

## 작업

- [ ] `/consistency-check --spec` (planner 의무 — ③이 `spec/conventions/` 를 건드린다)
- [ ] ② `ExecuteWorkflowDto.input` 에 `deprecated: true` + 가드 단언 추가
- [ ] ③ `swagger.md §3` 문면 개정 + `## Rationale` 에 근거
- [ ] 트래커 3건 종결 (결정과 사유 기록)
- [ ] TEST WORKFLOW 4단계 + 타입체크 ratchet
- [ ] `/ai-review`

## 검증 기준

- ②는 **런타임 무변경**이어야 한다 — 기존 캐너리(`@Body()` 가 DTO 로 타입되지 않는다)가
  그대로 GREEN 이어야 하고, 신규 단언은 OpenAPI 스키마의 `deprecated` 플래그만 본다.
- **뮤테이션**: `deprecated: true` 를 지우면 신규 단언이 **RED** 여야 한다. GREEN 이면 그
  단언은 결정을 고정하지 못한다.
- 뮤테이션은 **커밋 후** `cp` 백업으로. `git checkout`/`reset --hard` 금지.
