# 요구사항(Requirement) 리뷰 — keyset 커서 id 성분 UUID 검증

## 발견사항

- **[INFO]** e2e 레벨 검증 부재 — 이번 변경은 `decodeCursor` 내부 분기만 unit 테스트로 고정했고, 실제 HTTP 응답 코드(200/400)를 엔드투엔드로 확인하는 e2e 는 추가되지 않았다.
  - 위치: `codebase/backend/src/modules/auth/login-history.service.spec.ts` / `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts` (전체 diff, 함수 `decodeCursor` 테스트 스위트)
  - 상세: 같은 CHANGELOG 배치의 다른 항목들(예: `WorkflowVersionsService.findOne`)은 "이 엔드포인트에는 e2e 가 한 건도 없었으므로 추가한다" 는 원칙을 명시적으로 적용했다. 이번 변경은 unit 레벨에서 4개 회귀 테스트 + 4개 뮤테이션(M1~M4, 전부 예측대로 RED)으로 강하게 고정돼 있어 실질 위험은 낮지만, 컨트롤러 경계까지 통과하는 e2e 는 없다(`test/` 하위에 `login-history`/`background-runs` e2e 없음 — grep 확인).
  - 제안: 필수는 아니나, 향후 `GlobalExceptionFilter` 나 라우팅 계층이 바뀔 때 이 회귀를 unit 만으로는 못 잡을 수 있으므로 후속 e2e 추가를 고려할 것.

- **[INFO]** spec 카탈로그 갭 3건은 이번 diff 의 결함이 아니라 이미 올바르게 planner 로 이관됨 (spec fidelity 확인).
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:3168-3201`
  - 상세: `/consistency-check --impl-prep`(`review/consistency/2026/09/12/22_51_25`, BLOCK:NO, Critical 0)가 낸 WARNING 4건 중 3건(에러코드 카탈로그 미등재·`§8.2` cursor 단일표준과 `login_history` 예외 미기재·`EXECUTION_NOT_FOUND` 각주 불일치)은 코드 수정이 아니라 `spec/**` 편집 대상이라 developer 권한 밖이며, 실제로 "planner 항목" 표기로 정확히 등재됐다. 남은 1건(plan_coherence: won't-do 종결 대상 파일 미명시)은 이번 diff 가 `spec-draft-nullable-notation-followups.md:3223-3255` 를 취소선 처리 + 근거 각주로 직접 해소했다 — 4건 전부 처리 완료 상태로 확인됨.
  - 제안: 조치 불요 (이미 올바르게 처리됨. 참고로 기록).

## 검증 상세 (판정 근거)

- **핵심 사실 확인**: `LoginHistory.id`, `NodeExecution.id` 둘 다 `@PrimaryGeneratedColumn('uuid')` 임을 엔티티 파일에서 직접 확인 — CHANGELOG/plan 문서의 "두 id 컬럼이 uuid 타입" 주장과 일치.
- **`GlobalExceptionFilter` 분기 확인**: `codebase/backend/src/common/filters/http-exception.filter.ts` 를 직접 열람 — `HttpException` / `isPostgresUniqueViolation` / `mapHttpErrorLike`(4xx http-error-like) 세 분기만 있고 22P02(`invalid_text_representation`) 분기는 없음. 매핑 실패 시 `logger.error` 후 고정 500 메시지로 마스킹 — CHANGELOG·plan 서술과 정확히 일치.
- **`isUuidShaped` vs `isValidUuid` 근거**: `codebase/backend/src/common/utils/uuid.ts` 의 docstring 이 "Postgres 가 `uuid` 컬럼 값으로 파싱 가능한가" 를 명시적으로 판별 기준으로 삼고 nil UUID·v6/v7 을 의도적으로 통과시킨다고 적음 — 코드 주석·CHANGELOG·plan 세 곳의 서술이 서로 모순 없이 일치.
- **spec 앵커 확인**: `spec/data-flow/12-workspace.md:375` 에 `### X-Workspace-Id 헤더 vs :id 경로 파라미터 — UUID 검증 강도 비대칭 (2026-08-09)` 절이 실제로 존재. `spec/5-system/3-error-handling.md:80` 에 "JWT 클레임은 검증하지 않는다 … 서버 버그를 클라이언트 오류로 보고하게 된다" 문구가 그대로 존재 — plan 문서 §A 의 인용이 정확함.
- **엔드포인트 경로 확인**: `GET /api/users/me/login-history`(`sessions.controller.ts:167`, `@Controller('users/me')`), `GET /api/executions/:executionId/background-runs/:backgroundRunId`(`background-runs.controller.ts:19-23`) — CHANGELOG 표의 엔드포인트 서술과 일치(파라미터명은 일반화 표기이나 실제 경로 구조와 일치).
- **테스트 실행**: `npx jest login-history.service.spec.ts background-runs.service.spec.ts` 직접 실행 — 2 suites / 35 tests 전부 PASS. 저장소 파일은 변경하지 않았음(`git status --short` 재확인 결과 review 산출물 외 변경 없음).
- **전수성 확인**: 저장소 전체에서 `decodeCursor`/`cursorId`/`cursor.i` 패턴이 이 두 서비스 파일 외에 없음(grep). `cursor` 키워드가 있는 다른 서비스(`execution-engine.service.ts`의 그래프 순회 변수, `mcp-client.service.ts`의 무관 타입)는 uuid 컬럼 바인딩과 무관 — plan §B 의 "정확히 2곳" 주장이 실측과 일치.
- **회귀/뮤테이션 서술 확인**: plan 문서가 제시한 "기존 fixture 가 결함을 정상으로 고정" 서술(`'cursor-id'` → `CURSOR_UUID`로 교체)이 diff 에 그대로 반영돼 있고, 새 대조군 테스트(nil UUID 통과)와 결함 재현 테스트(비-UUID 거부)가 각 파일에 쌍으로 존재 — 서술과 구현이 line-level 로 일치.
- **TODO/FIXME/HACK/XXX**: diff 범위(`login-history.service.ts`, `background-runs.service.ts` 및 두 spec 파일)에 없음.
- **반환값/분기 완전성**: `login-history.service.ts` `decodeCursor` 는 모든 실패 경로(빈 값·구분자 누락·날짜 파싱 실패·id 비-UUID)에서 일관되게 `null` 반환 → 상위에서 커서 무시로 처리. `background-runs.service.ts` `decodeCursor` 는 모든 실패 경로에서 `catch` 블록이 `BadRequestException({code:'INVALID_CURSOR', ...})` 로 수렴 — 두 함수 모두 모든 경로에서 정의된 값을 반환/throw 하며 unhandled 경로 없음.

## 요약

`login-history.service.ts`·`background-runs.service.ts` 두 keyset 커서 디코더에 `isUuidShaped` 검증을 추가해, 비-UUID id 성분이 Postgres `uuid` 컬럼까지 흘러 SQLSTATE 22P02 → `GlobalExceptionFilter` 미분류 → 500 마스킹으로 이어지던 인증-사용자 트리거 가능 결함을 닫았다. 두 엔드포인트의 기존 실패 계약(무시 후 1페이지 vs 400 `INVALID_CURSOR`)을 의도적으로 유지한 채 최소 변경으로 처리했고, 그 판단 근거(필터 레벨 22P02→400 일괄 분기를 기각한 이유, `isUuidShaped`를 쓰고 `isValidUuid`를 쓰지 않는 이유)가 코드 주석·CHANGELOG·plan 문서·기존 spec Rationale 사이에서 모두 line-level 로 일치함을 직접 파일 열람과 테스트 실행으로 확인했다. `GlobalExceptionFilter`에 실제로 22P02 분기가 없다는 것, 두 엔티티가 실제로 uuid 기본키라는 것, 저장소 전체에 이 패턴의 다른 유입 지점이 없다는 것(전수 확인)도 grep/코드 열람으로 재검증했으며 모두 문서 서술과 부합한다. 뮤테이션 4/4·회귀 테스트 4개가 갖춰져 있고 실제로 `npx jest`를 돌려 35/35 GREEN을 확인했다. TODO/FIXME 등 미완성 표식 없음. 남은 사항은 e2e 레벨 검증 부재(INFO, unit+뮤테이션으로 충분히 상쇄됨)와 이미 planner 로 올바르게 이관된 spec 카탈로그 갭 3건(이번 diff의 결함 아님) 뿐이다. Critical/Warning 급 결함은 발견되지 않았다.

## 위험도

LOW
