# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (`rows[]`, 22개 change_type) 를 SSOT 로 적재. `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문은 nuance 보조로 참고했다(핵심 판단은 JSON trigger 기준).

## 변경 파일 식별
이번 diff(브랜치 `claude/entity-column-drift-b83f15`)의 실제 코드 변경은 다음 8개 TypeORM 엔티티 파일 + 1개 e2e 테스트 파일이다. 나머지는 `plan/in-progress/*.md` 2건(문서 편집)과 `review/consistency/2026/09/19/10_58_34/**` 신규 산출물(기존 `--impl-prep` 콘솔 로그의 커밋)이다.

- `codebase/backend/src/modules/alerts/entities/alert-rule.entity.ts` — `workspace_id` 컬럼에 `type: 'uuid'` 추가
- `codebase/backend/src/modules/edges/entities/edge.entity.ts` — `type` enum 컬럼에 `enumName: 'edge_type'` 추가
- `codebase/backend/src/modules/integrations/entities/integration-usage-log.entity.ts` — `node_execution_id`/`workflow_id` 에 `type: 'uuid'` 추가
- `codebase/backend/src/modules/llm/entities/llm-usage-log.entity.ts` — `workspace_id` 에 `type: 'uuid'` 추가
- `codebase/backend/src/modules/model-config/entities/model-config.entity.ts` — `kind` 컬럼에 `default: 'chat'` 추가
- `codebase/backend/src/modules/nodes/entities/node.entity.ts` — `category` enum 컬럼에 `enumName: 'node_category'` 추가
- `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts` — `last_interaction_at` 에 `default: () => 'now()'` 추가
- `codebase/backend/src/modules/workspaces/entities/workspace-invitation.entity.ts` — `workspace_id` 에 `type: 'uuid'` 추가
- `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — 선언↔DB 드리프트 가드를 컬럼 층까지 확장

## trigger 매칭 검토

1. **new-node / node-schema-change** (`codebase/backend/src/nodes/**`) — 저장소를 직접 확인한 결과 `codebase/backend/src/nodes/` (노드 핸들러 구현 트리: `ai/core/data/flow/integration/logic/presentation/trigger`) 와 `codebase/backend/src/modules/nodes/` (Node 엔티티의 NestJS CRUD 모듈: `entities/dto/controller/service`) 는 **서로 다른 디렉터리**다. 변경된 파일은 후자(`modules/nodes/entities/node.entity.ts`)이므로 이 trigger glob 에 매칭되지 않는다. 또한 `NodeCategory` enum 의 값 자체(`trigger/logic/flow/ai/integration/data/presentation`)는 변경 없음 — 추가된 것은 TypeORM 스키마 비교기가 DB 의 실제 enum 타입 이름(`node_category`)과 매칭하도록 하는 메타데이터(`enumName`)뿐이다. 사용자에게 노출되는 필드·라벨·노드 종류에 변화 없음.
2. **new-ui-string** (`codebase/frontend/src/**/*.tsx`) — 변경분에 frontend TSX 파일 없음. 매칭 없음.
3. **integration-provider-change** (semantic) — `integration-usage-log.entity.ts` 변경은 기존 컬럼(`node_execution_id`, `workflow_id`)의 TypeORM 타입 선언을 실제 DB 컬럼 타입(`uuid`)에 맞춘 것뿐이다. 신규/변경된 provider 는 없다. 매칭 없음.
4. **new-userguide-section-dir** (`codebase/frontend/src/content/docs/*/`) — 매칭 없음.
5. **auth-session-flow-change** (`codebase/backend/src/modules/auth/**`) — `workspace-invitation.entity.ts` 는 `modules/workspaces/entities/` 아래이며 `modules/auth/` 가 아니다. 변경 내용도 `workspace_id` 컬럼 타입 선언 정정뿐, 초대 승인·역할·세션 로직 변경 없음. 의미상으로도 인증·권한·세션 흐름 변경이 아니다. 매칭 없음.
6. **expression-language-change** (`codebase/packages/expression-engine/**`) — 매칭 없음.
7. **run-debug-flow-change** (semantic) — 실행 엔진·디버그 로깅 동작 변경 없음(엔티티 컬럼 선언만). 매칭 없음.
8. **new-warning-code / new-error-code** — `warningRules` 나 `error-codes.ts` 변경 없음. 매칭 없음.
9. **new-cross-cutting-enum** (semantic) — `edge.entity.ts`/`node.entity.ts` 에서 `enumName` 을 추가했지만 이는 **enum 값 신설이 아니라** DB 의 기존 enum 타입 이름을 TypeORM 비교기에 알려주는 메타데이터다(`EdgeType`: `DATA`/`ERROR`, `NodeCategory`: 7종 모두 그대로). cross-cutting enum 매트릭스 갱신 대상 아님.
10. 나머지(spec-major-change, userguide-gui-flow-section, backend-api-change, new-bullmq-queue, auth-config-type-enum-change, new-handler-output-field, new-backend-ui-zod-value 등) — 해당 glob/semantic 조건에 전혀 해당하지 않음.

`plan/in-progress/*.md` 2건은 이번 작업(엔티티 컬럼 선언 정정 + 가드 확장)의 진행 기록이며, `spec/0-overview.md` 의 Prisma/TypeORM 서술 오류를 발견해 `project-planner` 인계 체크리스트에 등재한 것은 이미 절차대로(자기-반증형 소정정 조건에 해당하지 않는 일반 spec 결함이라 developer 가 직접 spec 을 고치지 않고 후속 planner 턴으로 넘김) 처리됐다 — `spec-defect-found` 행이 요구하는 "plan/in-progress/spec-update-<name>.md 작성 후 project-planner 위임" 취지와도 부합한다(같은 트래커에 항목으로 등재, 별도 파일 신설은 아니지만 트래커 편입도 등재 방식의 일종으로 실무상 허용되는 경로 — 이 reviewer 의 영역인 docs/i18n 갱신과는 무관).

`review/consistency/2026/09/19/10_58_34/**` 신규 파일들은 `--impl-prep` 산출물이며, 그 안의 CRITICAL(`spec/2-navigation/4-integration.md` §5.4 UPPER_SNAKE_CASE 위반)은 이미 다른 PR(#1357)로 해소됐다고 plan 본문에 기록돼 있다 — 이번 diff 의 코드 변경(엔티티 컬럼 선언)과는 무관한 별개 스펙 결함이었고, User Guide Sync 매트릭스 어떤 trigger 와도 관련 없다.

## 결론

이번 변경은 TypeORM 엔티티의 컬럼 선언(타입·enum 타입 이름·기본값)을 실제 DB 스키마와 일치시키는 정정과, 그 드리프트를 잡는 e2e 가드(스키마 비교기) 확장이다. `synchronize: false` 환경에서 런타임 동작은 거의 그대로이며(문서화된 유일한 예외: `default` 선언 시 INSERT 후 `RETURNING` 값을 엔티티에 채우는 것 — 값 자체는 기존 DB 기본값과 동일), 사용자에게 노출되는 노드 종류·필드·라벨·에러 문구·통합 provider·인증 흐름·표현식 언어·실행/디버깅 UX 중 어느 것도 바뀌지 않는다. 매트릭스 22개 change_type 전체를 순회했으나 어느 것도 매칭되지 않는다(매칭 0 / 누락 0). **User Guide Sync 관점에서 해당 없음.**

## 위험도

NONE
