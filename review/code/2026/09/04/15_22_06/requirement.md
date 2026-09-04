# 요구사항(Requirement) 리뷰 — 응답 DTO 15곳 `required: false → true` (§5.4 drift 1단계)

## 검토 대상

`origin/main...HEAD` 3커밋(`499675277`→`441761478`→`145b7ddcd`) 누적 diff, 25개 파일. 실질 코드
변경은 2개 DTO 파일(`ExecutionDto` 10필드, `ExecutionStatusDto` 5필드)과 그 스키마 테스트 1개이며,
나머지 20개는 `CHANGELOG.md`·plan 트래커·이전 세션(`14_54_36` code-review, `15_16_28`
consistency-check)의 산출물이다.

## 검증 방법

- `spec/5-system/2-api-convention.md` §5.4(176~198행)를 직접 열어 diff 와 line-level 대조.
- `codebase/backend/src/modules/executions/executions.service.ts` `toExecutionDto`/
  `toResponseExecution`, `codebase/backend/src/modules/external-interaction/interaction.service.ts`
  `getStatus`를 읽어, 바뀐 15필드가 실제 조립부에서 **항상 키가 채워지는지**(§5.4 "상시 존재"
  전제)를 코드 레벨로 확인.
- `execution-status-response.dto.spec.ts`를 실제로 `jest` 실행 — GREEN 20/20 확인.
- 저장소 파일을 직접 뮤테이션(`currentNode` 데코레이터를 `@ApiPropertyOptional`로 되돌림)해
  RESOLUTION.md의 W2 검증표(RED 1건/19 pass)를 재현 — **정확히 재현됨**. 뮤테이션 전 원본을
  scratch(`/private/tmp/.../scratchpad/execution-status-response.dto.ts.orig`)에 백업했고,
  검증 직후 `cp`로 원복 → `git status --short`로 클린 상태 재확인(잔여물 없음).
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 전체를 읽어 §5.4 drift 배치 관련
  체크박스·수치(104=21+83, 83-68=15)·인접 항목(WS wire, `QueryExecutionDto.workflowId`) 정합성 확인.
- `AlertRuleDto.threshold: number` vs `AlertRule.threshold: string`, `notifications` 서비스의
  부분 `select:` 등 plan 본문이 인용하는 실측 주장을 grep으로 재확인.

## 발견사항

- **[INFO]** 15필드 전환은 §5.4·조립부 실측과 line-level로 정확히 일치
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:19-20,42-43,46-47,57-62,72-77,88-93,96-97,100-101,112-113,116-117`,
    `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts:123-130,133-138,147-156,159-165,168-174`
  - 상세: `toExecutionDto`(목록 경로, `executions.service.ts:977-1024`)는 10필드 전부를
    `?? null` 명시 coalesce로 채우고, `toResponseExecution`(단건 경로, `:1070-1079`)은 엔티티
    전체를 spread한 뒤 masking 함수로 error/inputData/outputData만 덮어써 나머지 필드(트리거·
    executedBy 등)는 엔티티 컬럼 그대로 상시 존재한다. `getStatus`(`interaction.service.ts:331-`
    이하)는 5필드(durationMs/currentNode/context/result/error)를 리터럴 반환 객체에 전부 명시
    할당한다. §5.4 "null(키 present)=기본값, 상시 존재" 규칙과 정확히 부합.
  - 제안: 없음.

- **[INFO]** 회귀 테스트가 실제로 이 축(`required`)을 잡는지 뮤테이션으로 독립 재현
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts:131-141`
  - 상세: `currentNode` 필드를 `@ApiPropertyOptional`로 되돌리자 신설된 `required` 배열 단언만
    RED(1건), 기존 `nullable` 단언(`it.each`, :110-119)은 그대로 GREEN — RESOLUTION.md가 주장한
    "RED 1건 / 19 pass"와 정확히 일치. 원복 후 20/20 GREEN 재확인, 저장소 뮤테이션 잔존 없음.
  - 제안: 없음 — 증빙 확인 목적.

- **[WARNING]** plan 트래커의 "종결 조건" 요약 문장이 자신이 나열하는 열린 항목 목록과
  불일치 — 3건은 이미 닫혔고, 이 diff가 새로 연 2건이 빠져 있다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (`## 종결 조건` 절,
    "현재 열려 있는 것은 §5.4 drift 배치 · `idx_schedule_next_run` · §2.2 단일 동사 패턴 ·
    §5.4 응답 바디 스코프 문구 · `3-schedule.md` §2.1 다섯이며" 문장)
  - 상세: 실제 `## 후속` 섹션의 체크박스 상태(`grep -n '^\- \[[ x]\]'`로 전수 확인)는 —
    §2.2 단일 동사 패턴(`[x]`, 반영 완료) · §5.4 응답 바디 스코프 문구(`[x]`, 반영 완료) ·
    `3-schedule.md` §2.1(`[x]`, 반영 완료) — 셋 다 이미 닫혀 있는데도 요약 문장은 여전히
    "열려 있다"고 적는다. 반대로 이번 diff가 새로 연 두 항목 — "§5.4 drift 배치 — 2단계:
    패스스루 응답 DTO 68곳"과 "§5.4 가 WS wire 에도 적용되는가" — 은 그 요약 문장에 전혀
    등장하지 않는다. `git diff origin/main...HEAD`로 대조하면 이 요약 문장 자체는 이번
    diff가 건드리지 않은 pre-existing 텍스트지만(§2.2/§5.4스코프/§2.1은 origin/main 시점에도
    이미 `[x]`였다), 이번 diff는 바로 그 절이 요약하는 "§5.4 drift 배치" 체크박스를 두 개로
    쪼개고 새 항목을 추가하는 **본문 수정**을 했다 — 같은 세션이 인접 섹션을 편집하면서
    하단 요약을 갱신하지 않은 것은 이번 diff의 정합성 결함이다. 다음 세션이 이 요약만 읽고
    "닫아야 할 5건"으로 착수하면 이미 완료된 3건에서 시간을 낭비하고, 실제로 열려 있는
    2단계·WS wire 항목의 존재를 놓칠 수 있다.
  - 제안: `## 종결 조건`의 열린 항목 목록을 `## 후속`의 실제 `[ ]` 4건(§5.4 drift 2단계 ·
    §5.4 WS wire 적용 여부 · `QueryExecutionDto.workflowId` · `idx_schedule_next_run`)으로
    갱신.

- **[INFO]** `NodeExecutionSummaryDto`의 동명 자매 필드(`finishedAt`/`durationMs`/`inputData`/
  `outputData`/`error`)는 여전히 옛 패턴(`@ApiPropertyOptional({nullable:true}) field?: T|null`)
  — 이번 diff 범위 밖이고 이미 plan에 2단계로 등재됨(중복 미보고, 확인만)
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:159-164,173-178,193-198,207-212`
  - 상세: `consistency-check`(`review/consistency/2026/09/04/15_16_28/convention_compliance.md`)가
    이미 INFO로 등재하고 plan 2단계(§5.4 drift 배치 2단계, 68곳) 소속임을 확인했다. 새 결함
    아님 — 교차 확인만 하고 재보고하지 않는다.
  - 제안: 없음(추적됨).

- **[INFO]** plan 본문이 인용하는 실측 근거(`AlertRuleDto.threshold: number` vs 엔티티
  `string`, `notifications` 부분 `select:`)를 재확인 — 둘 다 정확
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:22`
    vs `codebase/backend/src/modules/alerts/entities/alert-rule.entity.ts:35`;
    `codebase/backend/src/modules/notifications/notifications.service.ts:353,367,417,449`
  - 제안: 없음.

## 요약

핵심 코드 변경(`ExecutionDto` 10필드·`ExecutionStatusDto` 5필드의 `@ApiPropertyOptional`→
`@ApiProperty` 전환)은 `spec/5-system/2-api-convention.md` §5.4 문면·조립부(`toExecutionDto`/
`toResponseExecution`/`getStatus`) 실측과 line-level로 정확히 일치하며, 실행 가능한 회귀
테스트(뮤테이션 재현 RED 1/19 GREEN 확인)로 뒷받침된다. 기능 완전성·엣지 케이스·에러 시나리오·
반환값 관점에서 결함은 발견되지 않았고 TODO/FIXME류 미완성 표식도 없다. 유일한 흠은 코드가
아니라 부속 plan 문서(`spec-draft-nullable-notation-followups.md`)의 하단 요약 문장이 본문
체크박스 변경(이번 diff가 만든 것 포함)과 어긋나는 것 — 3건은 이미 닫혔는데 열려 있다고
적고, 새로 연 2건은 빠져 있다. 코드 품질 자체의 위험은 아니지만 다음 세션의 착수 판단을
오도할 수 있어 WARNING으로 기록한다.

## 위험도

LOW
