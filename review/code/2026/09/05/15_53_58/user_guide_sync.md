# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 범위 요약

매트릭스 적재: `.claude/config/doc-sync-matrix.json` (rows 21개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(같은 21행, prose nuance 포함) 을 Read 했다.

변경 파일 목록은 prompt 에 포함된 82개 전체(`git diff --name-only origin/main...HEAD` 로도 82개 일치 확인)이며, 구성은:

- `CHANGELOG.md` 1건
- 백엔드 소스 2건 (`audit-logs.service.ts`, `audit-logs.spec.ts`) — 감사 로그 엔드포인트가 `User` 엔티티 26개 컬럼을 통째로 내보내던 유출을 3필드(`id`/`name`/`email`)로 좁히는 보안 수정
- 백엔드 신규 테스트 인프라 4건 (`response-contract.ts`/`.spec.ts`, `execution-response.dto.spec.ts`) — §5.4(응답 `null` vs 키 생략) 계약을 실 HTTP 응답·생성된 OpenAPI 스키마와 대조하는 재사용 헬퍼 + 그 자신의 회귀 가드
- e2e 스펙 4건 (`audit-logs`, `session-revocation`, `workflow-crud`, `workflow-execution`) — 기존 엔드포인트에 `assertMatchesContract` 단언을 추가 배선
- `plan/in-progress/*.md` 3건, `review/code/**`·`review/consistency/**` 산출물 다수 — 트래커·리뷰 산출물 갱신

## 매트릭스 매칭 점검

각 trigger 를 82개 파일 전체와 대조했다 (glob 은 `git diff --name-only` 로 직접 매칭, semantic 은 판단):

- **새 노드 추가 / 노드 schema 변경** (`codebase/backend/src/nodes/**`) — 매칭 파일 0건
- **신규 UI 문자열** (`codebase/frontend/src/**/*.tsx`) — frontend 변경 파일 자체가 0건 (전수 grep 확인)
- **신규 위젯 chrome 문자열** (`codebase/channel-web-chat/**`) — 0건
- **통합/제공자 변경** — 해당 없음
- **유저 가이드 신규 섹션 디렉토리** (`content/docs/*/`) — 0건
- **백엔드 API 추가·변경** (`*.controller.ts`, `dto/**`) — `execution-response.dto.spec.ts` 1건이 경로상 `dto/**` 에 걸리지만, 이는 **기존** `ExecutionDto` 선언을 고정하는 신규 회귀 테스트일 뿐 실제 DTO·controller·swagger 선언 변경이 아님(diff 확인: `execution-response.dto.ts` 자체는 변경 파일 목록에 없음). API 표면 변경 없음 → 매칭 아님
- **신규 BullMQ 큐** — 해당 없음
- **신규 warningCode/errorCode** (`error-codes.ts`, warningRules) — 변경 없음
- **신규 cross-cutting enum / backend ui.label 값 / handler output field** — 해당 없음
- **인증·권한·세션 흐름 변경** (`codebase/backend/src/modules/auth/**`) — 이 glob 에 걸리는 실제 소스 변경 0건. `session-revocation.e2e-spec.ts` 가 `SessionDto` 를 **import** 하지만 이는 기존 auth 모듈의 기존 타입을 계약 대조에 재사용하는 것일 뿐, `modules/auth/**` 자체의 어떤 파일도 diff 에 없음(흐름 미변경) → 매칭 아님
- **표현식 언어 변경** (`packages/expression-engine/**`) — 0건
- **실행·디버깅 흐름 변경** — `workflow-execution.e2e-spec.ts` 가 실행 엔진 자체가 아니라 테스트에 계약 단언만 추가. 실행 엔진 소스 변경 없음 → 매칭 아님
- **spec 신규/대규모 변경** (`spec/{2,3,4,5}-*/**`, `spec/conventions/**`) — `spec/` 하위 파일 변경 0건 (plan/review 문서만 spec 파일을 텍스트로 언급할 뿐)
- **spec 자체 결함 발견** — `plan/in-progress/spec-conventions-engine-error-code-surface.md` 는 *이미 해소된* 두 항목을 취소선 처리하는 트래커 갱신이지 새 결함 제안이 아님

## 발견사항

없음. 21개 trigger 중 어느 것도 이 변경 set 에 매칭되지 않는다.

이 PR 은 (1) 감사 로그 엔드포인트가 이미 선언된 DTO(`AuditLogUserDto` 3필드)보다 넓게 응답하던 보안 결함을 좁히는 백엔드 전용 수정과, (2) §5.4 응답 계약을 실측 검증하는 테스트 인프라(신규 유저 가이드 대상 표면이 아닌 내부 QA 도구) 로만 구성된다. frontend 코드, `content/docs/**`, i18n dict, `backend-labels.ts`, `packages/expression-engine/**`, 실제 `modules/auth/**` 소스, backend warning/error 코드 카탈로그 중 어느 것도 건드리지 않았다.

## 검증용 뮤테이션

수행하지 않음 — 매칭 trigger 가 없어 검증이 불필요했다. 저장소 트리에 어떤 파일도 쓰거나 고치지 않았다(`git status --short` 로 확인, 본 리뷰 세션 자신의 출력 디렉터리 외 변경 없음).

## 요약

매트릭스 trigger 21개 중 매칭 0건, 동반 갱신 누락 0건. 변경 set 은 백엔드 데이터 유출 보안 수정 + §5.4 계약 검증 테스트 인프라 + plan/review 트래커 갱신으로 전량 구성되어 유저 가이드(docs MDX)·i18n dict·backend-labels·섹션 locale 등록 어느 표면도 건드리지 않는다. 해당 없음.

## 위험도

NONE
