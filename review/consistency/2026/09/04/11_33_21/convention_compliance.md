# 정식 규약 준수 검토 — `spec/5-system/` (impl-done)

## 검토 범위 메모

- `spec/5-system/` 자체의 diff 는 0개 파일 — 이 브랜치는 spec 을 바꾸지 않았다. 정상.
- 프롬프트 번들의 `## 구현 변경 사항` diff 본문은 예산에 잘려 보이지 않았으므로, 워킹트리를
  절대경로로 직접 열어 실제 구현 diff(`git diff origin/main...HEAD`)를 재확인했다.
- 실제 codebase diff: `background-run-response.dto.ts` · `create-assistant-session.dto.ts` ·
  신규 `swagger-dto-contract-guard.ts`/`swagger-dto-contract.spec.ts` · `nullable-type-lie-cast-guard.ts`/
  `.spec.ts` 리팩터 · 신규 `common/__test-utils__/temp-fixture.ts`. 이 변경들이 `spec/conventions/swagger.md`
  및 `spec/5-system/2-api-convention.md §5.4` (부재 표현 규약) 를 얼마나 따르는지가 실질 검토 대상이다.

## 발견사항

- **[INFO]** `background-run-response.dto.ts` 위치가 `dto/responses/` 하위 패턴을 따르지 않음
  - target 위치: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts`
  - 위반 규약: `spec/conventions/swagger.md` §5-1 ("응답 DTO 위치: `codebase/backend/src/modules/<module>/dto/responses/*-response.dto.ts`")
  - 상세: 저장소 전수 확인 결과 `*-response.dto.ts` 35개 중 33개가 `dto/responses/` 하위에 있고, 이 파일과 `system-status-response.dto.ts` 2개만 `dto/` 바로 아래에 있다. 이번 diff 는 이 파일을 **새로 만들지 않고** 기존 파일의 필드 선언(`@ApiPropertyOptional`→`@ApiProperty({nullable:true})`)만 고쳤으므로, 이 위치 drift 는 이 PR 이 만든 것이 아니라 기존에 있던 것이다.
  - 제안: 이번 PR 의 책임 범위는 아니다(§5-1 은 "신규" 파일에 대한 위치 규약이지 소급 이동을 요구하지 않음, swagger.md 전반의 "신규 변경 한정" 원칙과 동형). 향후 이 파일을 다시 손댈 기회가 있으면 `dto/responses/` 로 옮기는 것을 고려할 수 있다는 정도의 참고 사항.

- **[INFO]** 새 가드 파일이 `spec/conventions/swagger.md` frontmatter `code:` 목록에 없음
  - target 위치: `spec/conventions/swagger.md` frontmatter `code:` (line 4-8)
  - 위반 규약: 없음 — 확인 결과 이는 실제 위반이 아니라 기존 관행과 일치한다. `nullable-type-lie-cast-guard.ts` 등 기존 형제 가드들도 대응 spec 문서의 `code:` frontmatter 에 등재되지 않고, 대신 spec 본문 Rationale 안에서 인라인으로 언급되는 패턴이다(예: `spec/4-nodes/7-trigger/1-manual-trigger.md:201`, `spec/5-system/14-external-interaction-api.md:1591` 이 `masked-reject-callers-guard.ts` 를 그렇게 인용). 신규 가드 `swagger-dto-contract-guard.ts`/`.spec.ts` 도 이 패턴을 그대로 따른 것으로 판단되며 별도 조치 불요. 기록만 남긴다.

## 준수가 확인된 항목 (특기할 만큼 정밀했음)

- **§1-4 "닫힌 union" / §5.4 "부재 표현" 규약과 diff 의 일치**: `background-run-response.dto.ts` 의
  `finishedAt`/`durationMs`/`inputData`/`outputData`/`error`/`nextCursor`/`completedAt` 필드가
  전부 `@ApiPropertyOptional` → `@ApiProperty({ nullable: true })` 로 바뀌었다. 이는
  `spec/conventions/swagger.md` §1-4 콜아웃("이 필드는 **상시 존재**하고 값만 없을 수 있다 …
  `@ApiPropertyOptional` 은 `ApiProperty({ required: false })` 의 별칭이라 쓰면 OpenAPI 가 키를
  optional 로 문서화한다")과 `spec/5-system/2-api-convention.md` §5.4 표("`null` 을 쓰는(상시 존재)
  필드 → `@ApiProperty({ nullable: true })` + `field: T | null`")를 정확히 구현한다.
- **신규 가드 `swagger-dto-contract-guard.ts`**: `spec/5-system/2-api-convention.md §5.4` 를
  SoT 로 명시 인용하고(`SoT: spec/5-system/2-api-convention.md §5.4`), presence 축(`required` vs
  `?`)·null 축(`nullable` vs `| null`)을 AST(TypeScript compiler API)로 판정한다. `@ApiPropertyOptional`
  이 `ApiProperty({required:false})` 의 별칭이라는 판정 근거는 별도 캐너리 테스트로 `@nestjs/swagger`
  실제 메타데이터를 읽어 검증한다 — Rationale 이 검증 가능한 사실에 기반해 있다.
  `@Transform` 예외(쿼리스트링 `workflowId`)도 spec §5.4 의 취지(wire 표현과 TS 타입이 다른 대상을
  기술하는 자리는 판정 축이 성립하지 않음)와 정합적으로 설계됐다.
  파일 네이밍(`<name>-guard.ts` + `<name>.spec.ts`, 순수 판정 로직과 소비 spec 분리)도 기존
  `masked-reject-callers-guard.ts`/`production-build-devdep-guard.ts` 쌍과 동일 패턴임을 실제
  파일 존재로 확인했다 — 근거 없는 관행 주장이 아니다.
- **`create-assistant-session.dto.ts` `llmConfigId`**: 요청 DTO 의 진짜 optional(키 생략 가능) +
  nullable(명시적 null 허용) 조합이며 `@ApiPropertyOptional({ nullable: true })` + `?: string | null`
  로 선언돼 있다. §5.4 표는 "상시 존재 nullable" 대 "키 생략" 양자택일을 다루지만, 이 필드는
  형제 DTO(`update-...`)와의 일치를 근거로 두 속성을 모두 갖는 사례로 plan 문서에 근거가 남아 있고
  (`spec-draft-nullable-notation-followups.md`), 규약과 모순되지 않는다.
- **plan frontmatter**: `plan/in-progress/spec-draft-nullable-notation-followups.md` 는
  `worktree:`·`spec_impact:`(리스트 형식) 를 모두 갖췄고, `plan/in-progress/execution-engine-residual-gaps.md`
  도 `worktree:` 필드를 유지한다 — CLAUDE.md 의 plan frontmatter 규약(Gate C) 위반 없음.

## 요약

이번 diff(spec 델타 0, 코드 diff는 nullable-notation 배치의 후속 "계약 거짓 9곳" 수정 + 재발 방지
가드 신설)는 `spec/conventions/swagger.md` §1-3/§1-4 및 `spec/5-system/2-api-convention.md` §5.4 가
규정한 "`@ApiPropertyOptional` vs `@ApiProperty({nullable:true})`" 구분을 정확히 구현하고, 그
판정을 코드로 강제하는 신규 가드까지 기존 형제 가드와 동일한 파일 배치·명명 패턴으로 세웠다.
CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다. 유일하게 짚을 만한 것은 이 diff 가 손댄
`background-run-response.dto.ts` 가 애초부터(이 PR 이전부터) `dto/responses/` 위치 관례를 따르지
않았다는 점(INFO, 이 PR 책임 아님)과, 신규 가드가 spec frontmatter `code:` 목록에 미등재됐다는
점(INFO, 기존 형제 가드들의 확립된 패턴과 일치하므로 실질적으로 위반 아님)뿐이다.

## 위험도

NONE
