# 신규 식별자 충돌 검토 — `spec/5-system/`

## 검토 방법

- 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`.
- 프롬프트 번들 안의 "구현 변경 사항" diff 섹션은 예산에 잘려 비어 있었으므로, 워킹트리
  (`/Volumes/project/private/clemvion/.claude/worktrees/plan-in-progress-items-b0c80b`) 에서
  `git diff origin/main --stat` 로 실제 변경분을 직접 확인했다.
- 실측: `spec/5-system/` 델타 = **0 파일** (이 브랜치는 그 spec 영역을 전혀 건드리지 않음).
  구현 diff = **8 파일 / 640 insertions + 45 deletions** (codebase 한정):
  - `codebase/backend/src/common/__test-utils__/temp-fixture.ts` (신규)
  - `codebase/backend/src/common/__test-utils__/temp-fixture.spec.ts` (신규)
  - `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts`
  - `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts`
  - `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts`
  - `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts`
  - `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (신규)
  - `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` (신규)

이 PR 은 nullable 표기(`@ApiPropertyOptional` → `@ApiProperty({ nullable: true })`) 계약
검증용 repo-guard/테스트 인프라 추가와 기존 DTO 필드의 데코레이터 정정이 전부다. `spec/5-system/`
(인증·API 규약·에러 처리·webhook) 의 요구사항 ID·엔티티명·엔드포인트·이벤트명·ENV var·spec 파일
경로 중 어느 것도 새로 도입하지 않는다.

## 점검 관점별 확인

1. **요구사항 ID 충돌** — 신규 ID 부여 없음 (spec 델타 0).
2. **엔티티/타입명 충돌** — 새로 추가된 타입은 `ContractMismatch` (인터페이스),
   `findSwaggerContractMismatches`(함수), `withFiles`/`withFixture`(테스트 헬퍼) 뿐이며 전부
   `codebase/backend/src/repo-guards/__tests__/` 와 `common/__test-utils__/` 내부의 리포지토리
   전용 정적분석/테스트 유틸이다. `git grep` 로 기존 사용처를 확인한 결과 이 이름들이 다른 의미로
   먼저 쓰이던 곳은 없다 (`nullable-type-lie-cast.spec.ts`·`swagger-dto-contract.spec.ts` 가
   `temp-fixture.ts` 의 `withFiles`/`withFixture` 를 그대로 재사용 — 의도된 공유 헬퍼 추출).
   DTO 쪽은 `finishedAt`/`durationMs`/`inputData`/`outputData`/`error`/`nextCursor`/
   `completedAt`/`llmConfigId` 등 **기존 필드의 데코레이터만** `nullable: true` 로 정정한 것이며
   신규 필드/DTO 명 도입은 없다.
3. **API endpoint 충돌** — 신규 endpoint 없음. 변경된 두 DTO 는 기존 endpoint
   (`background-runs` 조회, `workflow-assistant` 세션 생성)의 응답/요청 바디 문서화 정정일 뿐,
   method+path 변경이 아니다.
4. **이벤트/메시지명 충돌** — webhook·queue·SSE 관련 변경 없음.
5. **환경변수·설정키 충돌** — `git diff origin/main -- codebase/` 전체에서 `process.env`/신규
   ENV var 도입 없음 (`WEBAUTHN_*`, `COOKIE_SAMESITE`, `TRUST_CF_CONNECTING_IP` 등
   `spec/5-system/1-auth.md`·`2-api-convention.md` 기존 변수와 무관).
6. **파일 경로 충돌** — `spec/5-system/` 신규 파일 없음. 신규 코드 파일 4개
   (`temp-fixture.ts`/`.spec.ts`, `swagger-dto-contract-guard.ts`/`.spec.ts`) 는 모두
   `repo-guards/__tests__/` 및 `common/__test-utils__/` 의 기존 명명 컨벤션
   (`*-guard.ts` + 형제 `*.spec.ts`, guard 프롬프트가 직접 언급하는
   `production-build-devdep-guard.ts`/`masked-reject-callers-guard.ts` 패턴)을 그대로 따른다.
   `spec/5-system/` 경로와는 겹치지 않는다.

## 발견사항

없음. `spec/5-system/` 스코프에서 이번 diff 가 새로 도입한 요구사항 ID·엔티티/DTO명·API
endpoint·이벤트명·ENV var·spec 파일 경로가 전무하므로 검토 관점 1~6 모두 충돌 후보가 없다.

## 요약

이번 변경은 nullable 표기 계약(`@ApiPropertyOptional` vs `@ApiProperty({nullable:true})`)을
검증하는 repo-guard/테스트 인프라 추가와 기존 DTO 필드 2곳의 데코레이터 정정으로 구성되며,
`spec/5-system/` 은 전혀 건드리지 않는다(델타 0). 새로 도입된 식별자(`ContractMismatch`,
`findSwaggerContractMismatches`, `withFiles`, `withFixture` 등)는 모두 리포지토리 내부
정적분석/테스트 유틸 이름으로, `spec/5-system/` 이 정의하는 요구사항 ID·엔티티·엔드포인트·
이벤트·ENV var·spec 파일 경로 어느 것과도 겹치지 않는다. 신규 식별자 충돌 관점에서 이 PR 은
안전하다.

## 위험도

NONE
