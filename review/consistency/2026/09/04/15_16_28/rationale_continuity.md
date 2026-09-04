# Rationale 연속성 검토

## 검토 범위

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- `spec/5-system/` 자체의 델타는 0개 파일(정상 — 이번 변경은 spec 이 아니라 코드 전용 PR).
- 실제 target: 구현 diff 3개 파일 / 229줄
  - `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`
  - `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts`
  - `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts`
- 프롬프트 번들에서 `## 구현 변경 사항` 섹션 자체가 컨텍스트 예산으로 완전히 잘려 있어(제목만 참조되고 본문 없음), 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/plan-in-progress-items-b0c80b`)에서 `git diff origin/main -- codebase/` 를 직접 실행해 diff 원문을 확보한 뒤 검토했다.

## 변경 내용 요약

`ExecutionDto`(10필드: `triggerId`·`finishedAt`·`durationMs`·`inputData`·`outputData`·`error`·`executedBy`·`parentExecutionId`·`reRunOf`·`chainId`)와 `ExecutionStatusDto`(5필드: `durationMs`·`currentNode`·`context`·`result`·`error`)를 `@ApiPropertyOptional({ nullable: true }) field?: T | null` → `@ApiProperty({ nullable: true }) field: T | null` 로 정정. 런타임 wire 값은 불변, OpenAPI `required` 만 `false→true`. `.spec.ts` 는 `nullable` 만 보던 기존 `it.each` 단언에 `currentNode`/`context` 를 추가하고, `required` 축을 직접 단언하는 신규 테스트를 뮤테이션 검증과 함께 추가했다.

## 발견사항

없음 — Rationale 연속성 관점에서 기각된 대안 재도입·원칙 위반·무근거 번복·invariant 우회 어느 유형도 발견되지 않았다. 오히려 다음 근거로 **기존 Rationale/합의 원칙을 그대로 집행하는 변경**으로 판단된다.

- **[INFO] §5.4 규칙의 정확한 구현 확인**
  - target 위치: `execution-response.dto.ts` / `execution-status-response.dto.ts` diff 전체
  - 근거 출처: `spec/5-system/2-api-convention.md` §5.4 "부재 표현 — `null` vs 키 생략" (본문, Rationale 아님) — "`null` 을 쓰는(상시 존재) 필드 → `@ApiProperty({ nullable: true })` + `field: T | null`" / "왜 `null` 필드에 `@ApiPropertyOptional` 을 쓰지 않는가" 캐비엇. 동일 규칙이 `spec/conventions/swagger.md` §1-4 예시(`ExecutionStatusDto.context`)에도 그대로 실려 있다.
  - 상세: diff 가 바꾼 15개 필드는 전부 "값이 없을 수 있지만 키는 상시 존재"(§5.4 표의 기본 케이스)에 해당한다 — `triggerId`(수동/서브워크플로우 시 null), `finishedAt`/`durationMs`(종료 전 null), `currentNode`/`context`/`result`/`error`(EIA `getStatus`, 상태별 null) 등. `spec/5-system/14-external-interaction-api.md` R17("`currentNode`/`context` 실값 노출... `seq` 만 placeholder")도 이 필드들을 "상시 존재 + null 값" 범주로 다루고 있어 diff 의 분류와 일치한다. 이전 코드가 `@ApiPropertyOptional`(=`required:false`)을 쓴 것이 §5.4·swagger §1-4 캐비엇이 명시적으로 경고하는 바로 그 오류 형태였고, diff 는 이를 정정한 것이다.
  - §5.4 "소급 적용 대상 아님" 문단은 **키 생략(present-when-available) 형태**로 이미 문서화된 필드(`mcpDiagnostics`, cafe24 `status` 등)만 소급 면제 대상으로 지목한다 — 이번 diff 의 15필드는 애초에 "null(키 상시존재)" 형태를 선택했던 필드라 그 면제 대상이 아니며, "앞으로 도입·변경되는 필드에 적용" 절에 따라 §5.4 규칙이 그대로 적용된다.
  - 이 변경이 문서화된 결정을 뒤집는 사례가 아님을 뒷받침하는 정황: 이 필드들의 git 이력에 `@ApiPropertyOptional` 선택을 정당화하는 커밋/주석이 없고(`git log` 확인), CHANGELOG.md 신규 항목이 "104 = 요청 21 + 응답 83, 그중 tsc 가 검증하는 15곳" 이라는 측정 방법론과 함께 §5.4 drift 정정으로 명시하고 있다(`#1277`/`#1280` 후속). `plan/in-progress/spec-draft-nullable-notation-followups.md` 에도 동일 배치가 "1단계: tsc 가 검증하는 15곳 완료" 로 추적돼 있어 무근거 번복이 아니라 계획된 정합화다.
  - 제안: 없음(수정 불필요). 참고로 같은 plan 문서에 "2단계: 패스스루 응답 DTO 68곳" 이 남아 있으므로, 향후 그 배치도 동일 §5.4 기준으로 이어지는지는 후속 검토 대상이다(본 리뷰 범위 밖).

## 요약

이번 diff(`ExecutionDto`/`ExecutionStatusDto` 15필드의 `@ApiPropertyOptional`→`@ApiProperty` 전환 + 대응 스펙 테스트 보강)는 `spec/5-system/2-api-convention.md` §5.4 의 "null 을 쓰는 상시 존재 필드는 `@ApiProperty({nullable:true})` + 필수 타입" 규칙과 `spec/conventions/swagger.md` §1-4 의 동일 규약 예시, `spec/5-system/14-external-interaction-api.md` R17 의 "실값 노출 + null placeholder" 서술과 모두 정합하며, 이를 위반하거나 기각된 대안을 재도입하는 지점을 찾지 못했다. `spec/1-data-model.md`·`spec/data-flow/3-execution.md`·`spec/3-workflow-editor/3-execution.md` 등 인접 Rationale 에도 이 필드들의 optional 선택을 정당화하는 과거 결정이 없어, drift 를 정정한 것으로 판단된다(CHANGELOG·plan 문서의 측정 근거와도 일치). Rationale 연속성 관점에서 이 변경을 차단할 사유는 없다.

## 위험도

NONE
