# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** plan 체크리스트: 체크박스 상태와 서술이 어긋난다 — "완료" 라고 적어 놓고 미체크
  - 위치: `plan/in-progress/keyset-cursor-uuid-validation.md:160` (`- [ ] CHANGELOG (완료 — 관측 가능한 변경 2건)`)
  - 상세: 같은 체크리스트의 다른 8개 항목은 `[x]`/`[ ]` 가 실제 완료 여부와 일치한다(A~D 는 모두 `[x]`, 아래 두 항목 `run-test-all.sh`·`ai-review + --impl-done` 은 미체크로 실제 미수행 상태와 맞는다). 그런데 이 항목만 `[ ]`(미체크)이면서 괄호 안엔 "완료 — 관측 가능한 변경 2건" 이라고 적혀 있다. 실제로 `CHANGELOG.md` 에는 이번 커밋에서 새 섹션(§파일 1)이 이미 추가돼 작업 자체는 끝났음을 diff 로 확인했다 — 즉 텍스트 서술이 맞고 체크박스가 뒤처져 있다. 이 프로젝트 컨벤션은 "체크박스 = 실제 상태" 를 명시적으로 요구하며(수행 직후에만 체크), 완료 서술과 미체크 상태가 공존하면 다음 세션이 "이 항목이 아직 안 끝났나?" 를 다시 조사하게 만든다.
  - 제안: `- [x] CHANGELOG (완료 — 관측 가능한 변경 2건)` 로 체크 표시를 실제 상태에 맞춘다. 세 항목(`CHANGELOG`/`run-test-all.sh`/`ai-review`)을 일괄 미체크로 두려 한 것이라면 반대로 "완료" 문구를 빼고 진행 예정으로 남겨야 한다.

- **[INFO]** CHANGELOG 새 항목의 엔드포인트 표기가 실제 라우트 파라미터명과 다르다
  - 위치: `CHANGELOG.md:12` (표 두 번째 행 `GET /api/executions/:id/background-runs/:runId`)
  - 상세: 실제 라우트는 `@Controller('executions/:executionId/background-runs')` + `@Get(':backgroundRunId')` (`codebase/backend/src/modules/executions/background-runs/background-runs.controller.ts`) 라 파라미터명이 `:executionId`/`:backgroundRunId` 다. CHANGELOG 는 `:id`/`:runId` 로 축약해 적었다. 같은 파일의 인접 항목들(예: `POST /api/triggers/:id/chat-channel/rotate-bot-token`, `GET /api/executions/workflow/:workflowId`)은 실제 파라미터명을 그대로 쓰는 편이라, 이 항목만 일반화된 이름을 쓰면 코드에서 grep 할 때 어긋난다.
  - 제안: `GET /api/executions/:executionId/background-runs/:backgroundRunId` 로 정정(선택 사항 — 의미 전달에는 지장 없음).

## 확인한 사항 (문제 없음)

- `isUuidShaped`(`codebase/backend/src/common/utils/uuid.ts`)는 이번 diff 대상이 아닌 기존 함수이며, 이미 상세한 JSDoc(목적·`isValidUuid` 와의 차이·Rationale 앵커)을 갖추고 있어 새 소비처 추가에 별도 문서 보강이 불필요하다.
- `login-history.service.ts`/`background-runs.service.ts` 의 새 인라인 주석은 각각 (1) 왜 검증이 필요한지(22P02→500 마스킹 경로), (2) 왜 `isUuidShaped` 이지 `isValidUuid` 가 아닌지, (3) 형제 디코더와 처분이 다른 이유를 모두 설명하고, `spec/data-flow/12-workspace.md §Rationale "UUID 검증 강도 비대칭"` 앵커도 실제로 존재해 정확하다.
- `spec/5-system/3-error-handling.md §1` 의 `VALIDATION_ERROR`/`X-Workspace-Id` 관련 서술을 대조한 결과, `plan/in-progress/keyset-cursor-uuid-validation.md` §A 가 인용한 "JWT 클레임은 검증하지 않는다" 원칙과 23502/23505 분기 실측은 spec 본문과 일치한다.
- `LoginHistory.id`/`NodeExecution.id` 가 둘 다 `@PrimaryGeneratedColumn('uuid')` 라는 plan 문서의 주장을 엔티티 파일에서 직접 확인했다 — 정확하다.
- 두 컨트롤러의 Swagger 데코레이터(`@ApiBadRequestResponse({ description: 'cursor 디코딩 실패 또는 limit 범위 오류' })`, `login-history` 의 `@ApiQuery cursor` 설명)는 이미 일반화된 서술이라 새 실패 서브케이스(비-UUID id)를 추가했다고 해서 OpenAPI 데코레이터를 바꿀 필요가 없다 — 실제로 손대지 않았고 그것이 맞다.
- `spec-draft-nullable-notation-followups.md` 의 항목 종결은 CLAUDE.md 의 취소선 보존 관례를 그대로 따른다 — 원문을 `~~...~~` 로 남기고 `> **종결 — won't-do (...)**` 각주로 반증 근거(실측 4가지)를 붙였다. 이 plan 파일은 developer 소유(`plan/**`)라 spec 자기-반증형 소정정 예외 절차가 적용될 필요가 없는 자리이며, 실제로 그 절차를 요구하지 않고 처리한 점도 맞다.
- `keyset-cursor-uuid-validation.md` frontmatter 는 `worktree`/`started`/`owner` 3필드를 모두 갖췄고 `spec_impact: none` 도 `.claude/docs/plan-lifecycle.md` 가 허용하는 bare 리터럴 형태다.
- 새 테스트 4건(로그인 이력 2건 + background-runs 2건)은 모두 "왜 이 케이스가 필요한가" 를 주석으로 설명하고, 대조군(`[대조군]`) 테스트는 엄격한 술어를 쓰면 안 되는 이유까지 재진술해 회귀 방지 의도가 코드만 봐도 이해된다 — 인라인 주석 품질이 높다.
- README/설정 문서: 이번 변경은 새 환경변수·설정 옵션·공개 API 추가가 없는 내부 버그 수정이라 README 업데이트가 필요하지 않다.

## 요약

문서화 수준이 전반적으로 높다 — CHANGELOG 항목은 배포 시 확인사항·근거 링크·기각한 대안까지 포함해 상세하고, 코드 인라인 주석은 "왜"를 설명하며 spec Rationale 앵커를 정확히 인용하고, 두 서비스의 계약 비대칭(무시 vs 400)도 양쪽 주석에 명시해 다음 사람이 헷갈리지 않게 했다. plan 문서는 반증된 원래 처방(필터 분기)을 원문 보존 + 취소선 + 각주로 정정하는 프로젝트 관례를 정확히 따랐다. 유일한 실질 흠은 새로 만든 plan 체크리스트 한 줄에서 "완료" 서술과 미체크 상태가 어긋난 것으로, 사소하지만 이 프로젝트가 반복 지적해 온 패턴(체크박스≠실제 상태)이라 WARNING 으로 표시했다. CHANGELOG 의 라우트 파라미터명 축약은 의미 전달에는 지장 없는 INFO 수준이다.

## 위험도

LOW
