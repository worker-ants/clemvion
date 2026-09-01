---
title: "spec draft — `error-codes.md` §Overview 적용 범위에 두 surface 병기"
worktree: easy-a-harness-hygiene
started: 2026-09-01
owner: project-planner
status: in-progress
priority: P3
spec_impact:
  - spec/conventions/error-codes.md
---

## Overview

`spec/conventions/error-codes.md` §Overview "적용 범위" 문단이 `ErrorCode` **하나만** 대표
surface 로 지목한다. 실제로는 엔진이 싣는 코드가 별 const(`EngineErrorCode`)로 존재하고,
그 사실이 규약 문서 어디에도 없다.

착수 근거는 `plan/in-progress/spec-conventions-engine-error-code-surface.md` 이고, 그 문서가
이 병기를 planner 턴으로 지정했다 — developer 의 자기-반증형 소정정 예외에 **해당하지 않는다**
(규약 서술이고, developer 가 쓴 문장도 아니다).

## 실측

| 확인 | 결과 |
|---|---|
| `ErrorCode` 선언 | `codebase/backend/src/nodes/core/error-codes.ts:8` |
| `EngineErrorCode` 선언 | **같은 파일** `:147` |
| 키 중첩 | `error-codes.spec.ts:59` 가 `overlap` 을 단언 — 두 집합이 겹치지 않음을 테스트가 고정 |

**"파일은 하나, const 는 둘"** 이 이 설계의 핵심이다. 문서가 두 파일로 읽히면 오해가 되므로
병기할 때 그 점을 함께 적는다.

## 변경 제안

§Overview "적용 범위" 문단에 두 surface 를 병기한다:

- `ErrorCode` — 노드 핸들러가 `output.error.code` 에 싣는다
- `EngineErrorCode` — 엔진이 `Execution.error` · `NodeExecution.error` 에 싣는다
- 둘은 **같은 파일의 자매 const** 이고 키가 겹치지 않는다(테스트로 고정)

기존 서술("프로젝트 전체의 에러 코드 문자열에 적용")은 **그대로 둔다** — 적용 범위가
넓다는 것이 이 문단의 요지이고, 병기는 그 안에서 대표 surface 를 **하나에서 둘로** 늘리는
것이지 범위를 좁히는 것이 아니다.

## Rationale

**왜 지금인가.** 이 병기가 없으면 규약 문서를 읽고 `EngineErrorCode` 를 새로 만드는 사람이
"규약 밖" 이라 판단할 수 있다. §1 적용 범위가 "프로젝트 전체" 라 실제로는 안에 있는데,
대표 surface 열거가 하나뿐이라 그 넓은 서술보다 좁은 예시가 먼저 읽힌다.

**왜 자매 const 인가 (선례와의 이탈)** — `exec-intake-followups.md` ARCH#5 ⑤ 가 그 근거를
정리하고 있고, 이 draft 는 그 결정을 **재확인**할 뿐 번복하지 않는다. 두 코드 집합을 한
enum 으로 합치지 않은 이유는 노출 경계가 다르기 때문이다(핸들러 출력 vs 엔진 상태 필드).

**무엇을 안 하나.** §3·§4 의 정규화 파이프라인 서술은 건드리지 않는다. 그쪽은 "내부 분류
문자열 → 정규화 → public 코드" 형태를 다루고, 이 draft 는 **대표 surface 열거**만 늘린다.
