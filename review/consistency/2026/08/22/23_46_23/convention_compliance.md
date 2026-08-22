# 정식 규약 준수 검토 — `spec/5-system/` (--impl-prep)

검토 범위: prompt 에 전문이 포함된 `spec/5-system/1-auth.md` · `2-api-convention.md` ·
`3-error-handling.md` (예산 초과로 생략된 나머지 15개 파일 중 이번 작업(`execute-workflow.dto.ts`
OpenAPI 문서화)과 직접 관련된 `spec/conventions/swagger.md` · `spec/conventions/error-codes.md`
는 Read 로 직접 열어 대조). 대조 대상 정식 규약: `spec/conventions/swagger.md` ·
`spec/conventions/error-codes.md` · `CLAUDE.md`/`project-planner/SKILL.md` 문서 구조 규약.

## 발견사항

- **[INFO]** `2-api-convention.md` 에만 `## Overview` 섹션이 없음
  - target 위치: `spec/5-system/2-api-convention.md` — 타이틀(`# Spec: API 설계 규칙`) 직후 바로
    `## 1. 기본 원칙`으로 진입 (Rationale 은 line 416 에 정상 존재)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` "Spec 문서 구조 (3섹션 권장)" —
    Overview/본문/Rationale
  - 상세: 같은 `spec/5-system/` 디렉터리의 형제 문서 `1-auth.md`(line 27)·`3-error-handling.md`
    (line 19)는 각각 자체 `## Overview` 섹션을 갖는데 `2-api-convention.md` 만 없다. 다중 spec
    파일 영역은 `_product-overview.md`(존재함, PRD 비기능요구사항)로 Overview 를 위임할 수 있으나,
    그 경우도 형제 파일들이 이미 로컬 Overview 를 병행하고 있어 `2-api-convention.md` 만 관행에서
    벗어난 형태다. "권장" 사항이라 CRITICAL/WARNING 은 아니다.
  - 제안: `## Overview` 절을 추가해 §1~§12 요약(1-auth.md 스타일)을 넣거나, 의도적 생략이면 이유를
    남기지 않아도 되지만(3섹션은 강제가 아님) 일관성 차원에서는 추가 권장.

- **[INFO]** `3-error-handling.md §3.2` 의 절 제목이 실제 내용(공용 표기 규약 SoT)을 가리지 않음
  - target 위치: `spec/5-system/3-error-handling.md` line 313 (`### 3.2 Route to Error Port 상세`)
    vs `spec/conventions/error-codes.md` line 19 의 인용(`3-error-handling.md §3.2`가
    `UPPER_SNAKE_CASE` 표기 SoT)
  - 위반 규약: 없음(참조 자체는 유효 — line 337 필드 정의 표에 실제로 `UPPER_SNAKE_CASE` 표기
    규정이 있다). 다만 이 사실이 "Route to Error Port 상세"라는, node-error-port 라우팅 전용으로
    읽히는 절 제목 안에 묻혀 있어 절 이름만 보고 찾아가기 어렵다.
  - 상세: cross-doc 참조 자체는 착지하므로 규약 위반은 아니고 가독성 제안(INFO)에 그친다.
  - 제안: 해당 필드 정의 표 앞에 짧은 앵커용 소제목(예: `#### 에러 코드 표기 규약`)을 추가하면
    `error-codes.md` 의 SoT 인용이 절 제목만으로도 자명해진다. (필수 아님.)

- **[WARNING]** 이번 작업이 만드는 DTO 패턴이 `swagger.md` §1-4 의 열린 map 표기를 따르지 않음
  (target 범위 밖 — 코드, 그러나 이 impl-prep 검토가 겨냥하는 바로 그 규약)
  - target 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts`
    (`parameterValues`/`input` 필드, `type: Object`) — 형제 파일
    `codebase/backend/src/modules/executions/dto/re-run.dto.ts` (`inputOverride`, 동일 패턴)
  - 위반 규약: `spec/conventions/swagger.md` §1-4 "열린/동적 map(키 집합이 런타임 결정)" —
    `@ApiProperty({ type: 'object', additionalProperties: true })`
  - 상세: `parameterValues`/`input`(Manual Trigger 자유 입력 맵)은 §1-4 가 정의하는 "사용자 정의
    변수 맵" 의 전형적 사례인데, 두 필드 모두 `type: Object` 만 쓰고 `additionalProperties: true`
    를 달지 않았다. 코드베이스 실측: `additionalProperties: true` 를 쓰는 `*.dto.ts` 38개 vs
    `type: Object` 만 쓰는 파일 2개(`re-run.dto.ts`, 이번에 추가된 `execute-workflow.dto.ts`) —
    소수 패턴이 이미 있던 것을 새 DTO 가 교정 없이 그대로 답습했다. 기능상 차이는 크지 않지만
    (`type: Object`도 NestJS Swagger 가 `{ type: 'object' }` 로 렌더링) §1-4 문면이 명시한 표기와
    다르다.
  - 제안: `type: Object` → `{ type: 'object', additionalProperties: true }` 로 두 파일 모두 정정
    (이번 PR 범위 확대가 부담이면 최소 신규 파일만이라도 규약대로, 기존 `re-run.dto.ts` 는 별도
    후속으로 등재). 또는 swagger.md 가 `type: Object` 축약형도 동등하게 허용함을 명시적으로 추가.

- **[INFO]** `input` 필드 설명이 §3 길이 가이드(10~40자)를 넘지만 예외 사유(보안·정책 캐비엇)에
  해당하지 않음 (target 범위 밖 — 코드)
  - target 위치: `execute-workflow.dto.ts` `input` 필드 description (86자 실측)
  - 위반 규약: `spec/conventions/swagger.md` §3 "DTO `description`은 10~40자 내외"
  - 상세: `input` 필드 설명("레거시 입력 봉투. `parameterValues` 미지정 시 `input.parameters` 를
    대신 읽는다...")은 §3 예외표의 두 부류(응답값-저장값 상이 / 요청값-정책거부) 어느 쪽도 아니다
    (fallback 우선순위 설명일 뿐). 다만 swagger.md 자신의 Rationale(§3)이 이미 "요청 DTO 73개 중
    114개(34%)가 40자 초과"를 실측·추인했다고 기록하고 있어, 이 특정 사례를 규약 위반으로 강하게
    볼 근거는 약하다 — 그래서 WARNING 이 아니라 INFO.
  - 제안: 굳이 조정한다면 요약 1줄로 줄이고 fallback 순서 상세는 별도 spec(SoT) 링크로 위임.
    선택 사항.

- **[없음 — 확인됨]** `parameterValues` 필드 설명(94자)은 swagger.md §3 "요청 값이 정책으로
  거부될 수 있는 필드" 예외(2026-08-22 확장분)에 정확히 해당해 규약 위반 아님. `ReRunRequestDto`
  형제 문구·`EIA §R17` SoT 링크 방식도 규약이 요구하는 "요약 1~2문장 + SoT 링크" 형태를 그대로
  따른다.

- **[없음 — 확인됨]** `2-api-convention.md`/`3-error-handling.md` 의 `../conventions/swagger.md`
  앵커 인용 3건(§1-3, §2-5, §6) 전부 대상 헤딩과 정확히 일치. `error-codes.md` 의
  `UPPER_SNAKE_CASE`/rename-안정성/historical-artifact 인용, `INVALID_INPUT → INVALID_TRIGGER_
  PARAMETERS`(#1193, 등급 B) 서술도 `error-codes.md §5` 원문과 정합.

## 요약

검토 범위(`spec/5-system/1-auth.md`·`2-api-convention.md`·`3-error-handling.md`)는 명명 규약
(UPPER_SNAKE_CASE 에러 코드·케밥케이스 URL)·출력 포맷 규약(`{data}`/`{data,pagination}` wrapping·
`null` vs 키 생략)·API 문서 규약(swagger.md 인용 앵커)·금지 항목(레거시 double-wrap 재도입 금지 등)
전반에서 `spec/conventions/**` 와 잘 정합돼 있고, CRITICAL 급 위반은 발견되지 않았다. 문서 구조
3섹션 권장에서 `2-api-convention.md` 만 형제 파일과 달리 로컬 `## Overview` 가 없는 점, 그리고
`3-error-handling.md §3.2` 의 절 제목이 실제 SoT 내용을 가리지 않는 점은 INFO 수준의 가독성
제안이다. 한편 이 impl-prep 검토가 직접 겨냥하는 작업(`ExecuteWorkflowDto` OpenAPI 문서화)이 이미
worktree 에 코드로 존재해(`execute-workflow.dto.ts`, 미커밋) 살펴본 결과, `swagger.md` §1-4 가
명시한 열린 map 표기(`additionalProperties: true`)를 따르지 않고 형제 `re-run.dto.ts` 의 소수
패턴(`type: Object`)을 그대로 답습하는 WARNING 이 하나 확인된다 — target 문서(spec) 자체의 결함은
아니지만 이번 검토의 실질 목적과 직결돼 함께 보고한다.

## 위험도
LOW
