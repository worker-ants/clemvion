---
title: 사용자 결정 3건 집행 — 여분 키 유지 · `input` deprecation · 길이 규칙 비강제화
status: complete
worktree: swagger-decisions-d24f77
started: 2026-08-23
owner: developer
spec_impact:
  - spec/conventions/swagger.md
---

# 사용자 결정 3건 집행

2026-08-23 결정 브리핑에 대한 사용자 판단을 집행한다. 셋 다 정본 트래커
[`spec-sync-external-interaction-api-gaps.md`](../in-progress/spec-sync-external-interaction-api-gaps.md)
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

**강제는 정말 필요한 곳에만 남긴다** — 엔드포인트 `summary`(10~20자)는 목록 UI 에서 잘리므로
길이가 기능적 제약이고, 엔드포인트 `description`(50~150자)도 **그대로 강제 유지**한다.
비강제로 돌리는 것은 **DTO `description` 하나뿐**이다.

> 세 축을 다 적는 이유: 이 문서군에서 **DTO 기준(10~40자)과 엔드포인트 기준(50~150자)을
> 혼동한 선례**가 트래커에 기록돼 있다. "길이 규칙" 이라고 뭉뚱그리면 그 혼동이 재발한다.

## 작업

- [x] `/consistency-check --spec` — `11_59_11` **BLOCK: NO**. WARNING 4건·INFO 2건 반영
- [x] ② `ExecuteWorkflowDto.input` 에 `deprecated: true` + 가드 단언 (대조군 포함)
- [x] ③ `swagger.md §3` 문면 개정 + `## Rationale` 신설
- [x] 트래커 3건 종결 (결정과 사유 기록) — 미체크 **29 → 26**
- [x] TEST WORKFLOW 4단계 + 타입체크 ratchet — 4단계 PASS
      (backend **8,914** · frontend 6,136 · web-chat 451 · e2e 285), ratchet 199건/38파일
- [x] `/ai-review`

## consistency 가 제일 아픈 곳을 짚었다 (W2)

*"강제가 아니게 되면 **예외**라는 틀이 자기모순"* — 없는 상한을 면제할 수는 없다. 제 초안은
본문 문구만 *"길이 논의 밖"* 으로 바꿨을 뿐 **틀 자체는 그대로 뒀다.**

그래서 보안·정책 캐비엇을 **면제가 아니라 적극 지시**로 뒤집었다: *"다른 필드는 짧게 써도
되지만 이 둘은 길어도 적어야 한다."* 결과적으로 그 자리는 **더 강해졌다** — 비강제화가
느슨해지기만 하는 변경이 아니게 됐다.

나머지 반영: 해제하는 유보 문구 인용(W3) · `deprecated` 를 §1 로 일반화하지 않는 판단(W4,
사례 1건이라 rule of three 미달) · 실측치 병존에 재실측일 각주(INFO1) · ①이 최초 결정이
아니라 `execute-body-dto` 가 갈라 둔 자리의 답임을 명시(INFO2).

## 뮤테이션 — 예측을 먼저 적고 실행

| 뮤턴트 | 예측 | 실측 |
| --- | --- | --- |
| `deprecated: true` 제거 (결정이 조용히 사라지는 형태) | 신규 단언 RED | ✅ **RED, 단독** — 나머지 9건 GREEN |

`tsc` 선검증 0 오류로 유효 뮤턴트 확인. 원복 후 `cmp` 바이트 동일.

> 단언에 **대조군**을 함께 뒀다 — `parameterValues` 는 deprecated 가 **아니어야** 한다.
> 한쪽만 보면 "둘 다 deprecated" 로 바꿔도 통과한다.

## 부수 관측 — unit 1회 SIGSEGV

첫 unit 실행에서 무관한 cafe24 스펙이 `SIGSEGV`(jest 워커가 OS 에 의해 종료)로 스위트 실패했다.
**테스트 실패가 아니라 환경 사건**이고(실패 테스트 0건), DTO 데코레이터 + 마크다운 변경이
segfault 를 낼 수는 없다. 1회 재실행에서 PASS — phantom 으로 기록한다.

## 검증 기준

- ②는 **런타임 무변경**이어야 한다 — 기존 캐너리(`@Body()` 가 DTO 로 타입되지 않는다)가
  그대로 GREEN 이어야 하고, 신규 단언은 OpenAPI 스키마의 `deprecated` 플래그만 본다.
- **뮤테이션**: `deprecated: true` 를 지우면 신규 단언이 **RED** 여야 한다. GREEN 이면 그
  단언은 결정을 고정하지 못한다.
- 뮤테이션은 **커밋 후** `cp` 백업으로. `git checkout`/`reset --hard` 금지.
