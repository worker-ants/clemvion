# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 요약

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- **spec 델타: 0개 파일** — 이 브랜치는 `spec/5-system/` 을 변경하지 않았다(정상. 코드 전용 PR).
- **구현 diff: 16개 파일 / 1262줄**, 전부 `codebase/backend/src/` 내부:
  1. `common/__test-utils__/source-scan.ts`(+`.spec.ts`) — `toPosixPath`/`toPosixRelative` 신규 export
  2. `common/__test-utils__/temp-fixture.ts`(+`.spec.ts`, 신규 파일) — `withFiles`/`withFixture` 공유 헬퍼로 추출
  3. `modules/executions/background-runs/dto/background-run-response.dto.ts` — `@ApiPropertyOptional`→`@ApiProperty({nullable:true})` 표기 정정
  4. `modules/workflow-assistant/dto/create-assistant-session.dto.ts` — `llmConfigId` 타입을 `string | null` 로 확장
  5. `repo-guards/__tests__/swagger-dto-contract-guard.ts`(+`.spec.ts`, 신규 파일) — Swagger DTO ↔ TS 타입 정합 AST 가드
  6. 그 외 `audit-action-binding.spec.ts`·`engine-error-code-anchor-guard.ts`·`masked-reject-callers-guard.ts`·`nullable-type-lie-cast-guard.ts`(+`.spec.ts`)·`production-build-devdep-guard.ts`(+`.spec.ts`) — 전부 `path.relative(...).split(path.sep).join('/')` 반복 호출부를 `toPosixRelative` 공용 함수로 교체하는 리팩터

diff 전체를 절대경로 워킹트리 기준으로 확인했다(위 목록이 diff 상 16개 파일과 일치).

## 발견사항

해당 사항 없음 — 이 diff 가 도입하는 새 식별자는 전부 저장소 내부 repo-guard/테스트 인프라 함수·타입·파일이며, 제품 요구사항 ID·엔티티/DTO 명·API endpoint·webhook/queue/sse 이벤트명·ENV var·spec 파일 경로 어느 축에서도 기존 `spec/5-system/` 정의와 겹치지 않는다.

- **요구사항 ID**: 신규 ID 부여 없음(spec 델타 0).
- **엔티티/DTO/인터페이스명**: `ContractMismatch`(신규 인터페이스), `toPosixPath`/`toPosixRelative`/`withFiles`/`withFixture`(신규 함수) 모두 `grep -rn` 결과 저장소 내 유일 정의이며 `spec/` 전역에도 동명 사용처가 없다(직접 확인). `BackgroundRunNodeExecutionDto`/`BackgroundRunResponseDto`/`CreateAssistantSessionDto` 는 기존 엔티티로, 이번 diff 는 필드 nullable 표기만 정정했을 뿐 이름을 새로 만들지 않았다.
- **API endpoint**: 신규 endpoint 없음. DTO 필드의 `@ApiProperty`/`@ApiPropertyOptional` 전환은 응답 스키마 표기(nullable 여부)만 정정한 것으로, method+path 신설이 아니다.
- **이벤트/메시지명**: webhook·queue·sse 이벤트명 변경/신설 없음.
- **환경변수·설정키**: 신규 ENV var/config key 없음.
- **파일 경로**: `swagger-dto-contract-guard.ts` + `swagger-dto-contract.spec.ts` 는 `codebase/backend/src/repo-guards/__tests__/` 에 새로 생겼지만, 같은 디렉터리의 기존 형제 쌍(`production-build-devdep-guard.ts`+`.spec.ts`, `masked-reject-callers-guard.ts`+`nullable-type-lie-cast-guard.ts`)과 동일한 "판정 로직(guard) / 소비 spec" 분리 명명 컨벤션을 그대로 따른다 — 컨벤션 위반도 기존 파일과의 경로 충돌도 없다. `temp-fixture.ts` 도 형제 디렉터리 `common/__test-utils__/` 의 기존 `source-scan.ts` 명명 패턴과 일치한다.

## 요약

이번 diff 는 spec/5-system 을 전혀 건드리지 않는 코드 전용 변경으로, 도입되는 모든 신규 식별자(`toPosixPath`, `toPosixRelative`, `withFiles`, `withFixture`, `ContractMismatch`, `findSwaggerContractMismatches`, `swagger-dto-contract-guard.ts`/`.spec.ts`, `temp-fixture.ts`/`.spec.ts`)가 저장소 내부 repo-guard·테스트 인프라 영역에 한정되며, 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·ENV var·spec 파일 경로 등 제품/spec 레벨의 기존 식별자와 겹치는 사례는 발견되지 않았다. 새 guard 파일 쌍의 명명도 기존 형제 guard 들의 컨벤션(`*-guard.ts` + `*.spec.ts` 분리)을 그대로 따라 컨벤션 이탈도 없다.

## 위험도

NONE
