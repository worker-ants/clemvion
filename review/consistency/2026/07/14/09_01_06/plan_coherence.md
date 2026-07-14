# Plan 정합성 검토 — @nestjs/swagger 핀 제거 + deep-import 정리 (§2)

## 검토 방법
payload 의 plan 목록(`plan/in-progress/**`)에 정작 대상 plan 인 `pnpm-migration-followups.md` 가
누락되어 있어(assembly 상 5개 문서만 포함, 목록에 pnpm-migration-followups.md 없음), 워킹트리에서
해당 plan 파일과 실제 커밋(`3f1df0dcd`, `git log origin/main..HEAD`)을 직접 대조해 확인했다.

## 발견사항

- **[INFO]** plan 문서 §2 텍스트가 구현 완료를 아직 반영하지 않음
  - target 위치: 커밋 `3f1df0dcd`(`refactor(backend): @nestjs/swagger 11.2.7 핀 제거 + deep-import 공개 타입 파생 교체 (§2)`) — `codebase/backend/src/common/swagger/api-wrapped.ts`, `execution-status-response.dto.spec.ts`, `interact-ack-response.dto.spec.ts`, `codebase/backend/package.json`, `pnpm-workspace.yaml`
  - 관련 plan: `plan/in-progress/pnpm-migration-followups.md` §2 (라인 43-53)
  - 상세: §2 의 명시적 완료 조건("교체 완료 시 `pnpm-workspace.yaml` `overrides` 의 `@nestjs/swagger` 핀 제거")은 실제로 충족됐다 — `git diff origin/main...HEAD -- pnpm-workspace.yaml` 확인 결과 `@nestjs/swagger: 11.2.7` override 행이 완전히 제거됐고, `codebase/backend/package.json` 의 dependency 도 `^11.4.5` 로 상향됐으며, deep-import(`@nestjs/swagger/dist/interfaces/open-api-spec.interface`)는 3곳(`api-wrapped.ts` + EIA 응답 DTO spec 2곳) 모두 공개 타입 파생(`type SchemaObject = ApiResponseSchemaHost['schema']`)으로 교체됐다(`git grep`으로 잔존 deep-import 0건 확인). 그런데 plan 문서 §2 본문은 여전히 "**조사(2026-07-12, defer)** ... 별 focused PR 로 분리한다" 라는 미완료·보류 문구 그대로이고, §1/§1-(a) 처럼 "완료(날짜, PR)" 인라인 주석이 없다. 코드와 plan 문서 상태가 어긋난 채로 남아 있다.
  - 제안: 이번 PR 커밋(또는 마무리 커밋)에서 `plan/in-progress/pnpm-migration-followups.md` §2 에 "완료(2026-07-14, 본 PR)" 주석을 추가하고, 채택한 해법(공개 타입 파생 — openapi3-ts 신규 의존성 불필요)을 명시해 §1 스타일과 맞출 것. plan-lifecycle 관례상 구현 완료 시점에 plan 문서 갱신이 따라야 하므로 이번 턴 마무리 전에 반영 권장.

## 정합성 확인 (문제 없음 — 참고용)

- **완료 조건 일치**: plan §2 는 두 가지 완료 경로((a) `openapi3-ts` 신규 devDep 추가, (b) 버전 bump + 회귀 검증)를 열어뒀는데, 실제 구현은 이보다 나은 제3의 방법(`@nestjs/swagger` 자체의 공개 export `ApiResponseSchemaHost['schema']` 파생)으로 신규 의존성 없이 해결했다. plan 이 "결정 필요"로 남긴 대체 타입 소스 조사 항목에 대한 정당한 해소이며, 미해결 결정을 우회하거나 다른 결정과 충돌하지 않는다.
- **후속 항목 미영향 확인**: `plan/in-progress/eia-context-schema-followups.md` (라인 35)에 "EIA dto/responses spec 의 Swagger `buildDocument` 보일러플레이트 dedup (**3번째 스키마 회귀 spec 추가 시점 트리거**)" 이라는 별도 보류 항목이 있어, 이번 diff 가 EIA 응답 DTO spec 파일 2곳(`execution-status-response.dto.spec.ts`, `interact-ack-response.dto.spec.ts`)을 건드리는 만큼 트리거 조건 충족 여부를 확인했다. 커밋 메시지의 "DTO 스키마 회귀 가드 3 suites/28 tests 통과"는 기존에 이미 존재하는 3개 suite(신규 spec 파일 추가 아님, `refresh-token-response.dto.spec.ts` 는애초에 없음)를 가리키므로 신규 3번째 spec 추가가 아니다 — 트리거 미충족, 해당 후속 항목에 영향 없음.
- **spec 정합 무영향**: `spec/conventions/swagger.md` 는 버전 무관한 사용 패턴(`ApiProperty`, `PickType` 등)만 규정하고 `wrapDataSchema()` 의 시그니처·동작은 이번 diff 로 변경되지 않아(내부 타입 파생만 교체) 문서와 충돌 없음.
- **다른 in-progress plan 과의 충돌 없음**: `plan/in-progress/self-hosting-deployment.md` 가 backend Dockerfile 을 언급하나 아직 미착수·범용 서술("multi-stage build (deps → build → runtime)")이라 구체적 스테이지 명(`prod-deps`→`deploy` 개명 등, §1-(a) 별도 완료분)과 충돌하지 않는다. `@nestjs/swagger`/`SchemaObject`/`openapi3-ts` 를 언급하는 다른 in-progress plan 은 없음(`grep` 전수 확인).

## 요약

`pnpm-migration-followups.md` §2 의 명시적 완료 조건("deep-import 공개 경로 교체 + 핀 제거")은 실제 커밋에서 정확히 충족됐고, plan 이 열어둔 대체안 조사도 신규 의존성 없는 더 나은 해법으로 정당하게 해소됐다. 다른 in-progress plan(특히 EIA 관련 후속 항목·spec 컨벤션)과의 충돌이나 트리거 조건 충족도 발견되지 않았다. 유일한 이슈는 plan 문서 §2 본문 자체가 구현 완료를 아직 반영하지 않아(§1 스타일의 "완료" 주석 부재) 코드-plan 상태가 일시적으로 어긋나 있다는 점이며, 이는 이번 PR 마무리 커밋에서 쉽게 해소 가능한 INFO 성격이다.

## 위험도

LOW
