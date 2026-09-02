# 정식 규약 준수 검토 — `spec-draft-error-code-two-surfaces.md`

## 검토 대상

- target: `plan/in-progress/spec-draft-error-code-two-surfaces.md`
- 검토 모드: spec draft 검토 (`--spec`)
- 대조 대상 정식 규약: `spec/conventions/error-codes.md` (전문 번들됨), `spec/conventions/audit-actions.md` (참고용, 전문 번들됨). 그 외 `spec/conventions/**` 다수는 컨텍스트 예산 초과로 절단되어 이번 라운드 대조 범위 밖.

## 발견사항

- **[WARNING] "변경 제안" 의 층(layer) 프레이밍이 같은 문서 "Rationale" 의 명시적 자제 원칙과 충돌하고, 문서 자신의 실측과도 어긋난다**
  - target 위치: `## 변경 제안` 절의 병기 문안 —
    ```
    - `ErrorCode` — **노드 핸들러 층**의 대표 surface
    - `EngineErrorCode` — **엔진 층**의 대표 surface
    ```
  - 위반 규약: 이 draft 자신의 `## Rationale` 절("왜 자매 const 인가 — 선례를 평평하게 만들지 않는다")이 세운 자체 원칙 — *"그래서 이 병기는 그 형태를 규약으로 굳히는 서술을 쓰지 않는다 — 두 surface 가 **존재한다는 사실만 적는다**."* 이 원칙은 `exec-intake-followups.md` ARCH#5 ⑤ 의 유보("해석이 열린 이탈이다… 내 근거가 선례를 이겼다고 읽지 않도록")를 그대로 이어받는다고 draft 스스로 밝힌다. 대조 대상 규약 문서 `spec/conventions/error-codes.md` 도 §1 에서 "구현 세부·전이적 맥락을 이름/서술에 박지 않는다" 는 정밀성 원칙을 두고 있다.
  - 상세: `## 변경 제안` 이 실제로 `spec/conventions/error-codes.md` §Overview 에 그대로 옮겨 붙일 문안인데, 여기서 `ErrorCode`↔`EngineErrorCode` 를 "노드 핸들러 층" / "엔진 층" 이라는 **아키텍처적 층 분리**로 명명하는 것은 "두 surface 가 존재한다는 사실만 적는다" 는 스스로의 서술 범위를 넘어선다 — 존재 사실 서술이 아니라 **책임 분리 원칙**을 새로 세우는 서술이다.
    또한 이 프레이밍은 draft 자신이 수집한 실측과 충돌한다. `## 목적지 필드를 여기 안 쓰는 이유` 절은 `EXECUTION_TIME_LIMIT_EXCEEDED` 가 `ErrorCode` 소속이면서 **엔진**(`execution-engine.service.ts:8270`)이 `Execution.error.code` 로 싣는다고 실측 확인한다. 번들된 `spec/conventions/error-codes.md` §4.1 콜아웃도 이를 뒷받침한다 — *"엔진 레벨 누적 타임아웃은 또 다른 코드 `EXECUTION_TIME_LIMIT_EXCEEDED` 로 구분된다."* 즉 `ErrorCode` 는 이미 최소 1개의 **엔진 레벨** 코드를 포함하고 있어 "노드 핸들러 층의 대표 surface" 라는 서술은 부정확하다. `## 범위 한정` 절이 인용하는 `4-execution-engine.md §Rationale`(2026-06-14, "신규 코드는 **중앙** `ErrorCode` 확장")도 `ErrorCode` 를 노드-국한이 아니라 **중앙(central)** 엔um으로 규정하고 있어, 이 draft 의 다른 절들이 이미 "노드 핸들러 층" 프레이밍을 반증하고 있다.
    이 문안이 그대로 `spec/conventions/error-codes.md` §Overview 에 landing 하면, 정식 규약 문서가 스스로 반증된 층 분리를 "정식 서술"로 굳히게 되어 이후 신규 엔진 코드를 `EngineErrorCode` 로만 보내야 한다는 오독을 유발할 수 있다 — 정확히 이 draft 의 `## Rationale` 이 막으려던 독법이다.
  - 제안: "층" 프레이밍을 빼고 draft 자신의 원칙대로 **존재 사실**만 적는 것으로 되돌린다 (예: "`ErrorCode` 와 `EngineErrorCode` 는 같은 파일의 자매 const 로 공존한다" 정도). 굳이 소속 subsystem 을 언급해야 한다면 "대표적으로 어디서 쓰이는가" 로 완화하고, `EXECUTION_TIME_LIMIT_EXCEEDED` 처럼 층을 넘는 예외가 있음을 각주로 병기하거나, 층 서술 자체를 제거해 §Overview 를 "두 surface 존재" 선언에 국한시킨다.

- **[INFO] `## Rationale` 뒤에 동급(`##`) 섹션이 이어져 CLAUDE.md 의 "문서 끝 Rationale" 배치를 벗어난다**
  - target 위치: `## 판단 기준은 이번에 안 쓴다 — 결정으로 남긴다` (파일 최하단, `## Rationale` 다음)
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 — *"결정의 배경·근거 | 해당 spec 문서 **끝**의 `## Rationale`"*. 이 draft 는 `## Overview` / `## Rationale` 헤더를 문자 그대로 사용해 spec 3섹션 컨벤션을 의식적으로 따르고 있는데, 정작 `Rationale` 뒤에 별도 `##` 섹션(판단 기준 보류 결정)을 덧붙여 "Rationale 이 끝" 이라는 배치를 어긴다.
  - 상세: `plan/in-progress/*.md` 는 spec 문서 자체가 아니라 planner 트래킹 산출물이라 이 컨벤션이 문자 그대로 강제되는 대상은 아니다. 다만 이 draft 가 스스로 Overview/Rationale 헤더로 spec 형태를 모사하고 있어, 마지막에 동급 섹션이 하나 더 붙는 구조는 이 문서를 참고하는 다음 사람에게 "Rationale 다음에도 결정 섹션이 올 수 있다" 는 그릇된 선례를 남길 수 있다. `spec/conventions/error-codes.md` 본문(번들 확인)은 Rationale 을 정확히 최종 섹션으로 배치해 컨벤션을 준수하고 있어 대비된다.
  - 제안: "판단 기준은 이번에 안 쓴다" 절을 `## Rationale` 의 하위 subsection(`###`)으로 접어 넣거나, `## Rationale` 앞으로 옮겨 Rationale 이 최종 섹션이 되도록 재배열한다. 실질 내용 변경은 불필요.

## 요약

번들된 유일한 전체 대조 대상 정식 규약(`spec/conventions/error-codes.md`)에 대해, 이 draft 는 §Overview 책임 경계·SoT 위임 패턴·historical-artifact 관례를 대체로 정확히 따르고 있고 1·2차 review 라운드에서 지적된 "목적지 필드 오류" 와 "SoT 중복" 문제는 이미 잘 흡수했다. 다만 이번 라운드에서 새로 드러난 문제는, 문제를 피하려고 도입한 "층(layer)" 프레이밍이 오히려 draft 자신의 Rationale 원칙("형태를 규약으로 굳히지 않는다")과 자기 실측(EXECUTION_TIME_LIMIT_EXCEEDED 사례) 양쪽과 충돌한다는 점이다 — 규약을 새로 쓰기 전에 반드시 정정이 필요한 자기모순이다. 그 외에는 문서 구조상 사소한 INFO 하나뿐이며, 나머지 대다수 `spec/conventions/**` 파일은 이번 번들에서 컨텍스트 예산 초과로 절단되어 대조 범위 밖이었다(대상 draft 가 그 문서들을 건드리지 않으므로 실질 영향은 낮음).

## 위험도
MEDIUM
