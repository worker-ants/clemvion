# Code Review 통합 보고서

## 전체 위험도

**NONE** — CRITICAL/WARNING 신규 발견사항 0건. 14개 reviewer(강제 화이트리스트 7명 전원 포함) 모두 실행·전문 확보 완료, 누락 없음. 일부 reviewer(requirement·maintainability·documentation·api_contract)가 개별 위험도를 LOW 로 매겼으나 근거는 전부 INFO 성격의 워크플로 진행 상태(트래커 체크박스 미완료)·기존에 알려진 설계 트레이드오프(문서 전용 DTO 이중 선언)이며 신규 코드 결함이 아니다.

이번 diff(`origin/main...HEAD`, 32개 파일)는 3개 기존 라우트(`rotate-bot-token`, `executions/:id/continue`, `hooks/:endpointPath`)에 OpenAPI `@ApiBody`/`@ApiConsumes` 요청 본문 스키마를 광고하는 문서 전용 변경이며, `@Body()` 파라미터 타입은 인라인(`Object`/`unknown`)으로 유지해 전역 `CustomValidationPipe` 진입(=런타임 계약 변경)을 의도적으로 피했다. 이 라운드(2R)는 1R(`17_55_14`)이 지적한 유일한 WARNING(테스트 헬퍼 `bodyParamDesignType` 에러 경로 무테스트)이 커밋 `fafc6b8ac` 로 해소되고 스팟 뮤테이션(가드 무력화 → 즉시 RED)으로 재검증됐음을 확인했다.

## Critical 발견사항

(없음)

## 경고 (WARNING)

(없음 — 1R WARNING 3건 중 코드 성격 W1 은 `fafc6b8ac` 로 해소, W2(캐너리 템플릿 반복)는 이미 근거를 갖춰 유예 결정(RESOLUTION.md)되어 이번 라운드에서 INFO 로 하향, W3(트래커 미체크)은 plan 이 정직하게 미완료로 표시한 예정된 워크플로 단계로 INFO 유지)

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | 이 PR 이 "닫는다"고 선언한 상위 트래커 항목이 아직 미체크 | `plan/in-progress/spec-draft-nullable-notation-followups.md:2459`, `plan/in-progress/rotate-bot-token-body.md` 체크리스트 마지막 3줄 | 마무리 커밋에서 트래커 항목 체크 + 처방 문구를 실채택안("문서 전용 DTO + `@ApiBody`")으로 정정 |
| 2 | Documentation/Convention | `<Domain><Action>RequestDto` 명명 관례가 `spec/conventions/swagger.md` §1-7 에 아직 성문화되지 않음 (기존 응답 DTO 와 명명 비대칭도 동반) | `spec/conventions/swagger.md` §1-7, `chat-channel-rotate-bot-token-request.dto.ts` vs `chat-channel-rotate-bot-token-response.dto.ts` | 트래커 정정 작업에 묶어 §1-7 표에 규약 행 추가(project-planner 턴) |
| 3 | Architecture | 문서용 DTO(`@ApiBody` 대상)와 실제 `@Body()` 인라인 타입이 별개로 선언된 "이중 선언" 구조 — 컴파일러가 아닌 캐너리 테스트로만 동기화 보장 | `triggers.controller.ts`(`rotateBotToken`) vs `chat-channel-rotate-bot-token-request.dto.ts`, `executions.controller.ts`(`continueExecution`) vs `continue-execution.dto.ts` | 조치 불요(의도된 트레이드오프, 캐너리로 커버). 5번째 유사 라우트 발생 시 팩토리화 + 필드 집합 일치 보조 테스트 검토 |
| 4 | Dependency | 신규 테스트 헬퍼 `bodyParamDesignType` 이 `@nestjs/common` 비공개 서브패스(`ROUTE_ARGS_METADATA`, `RouteParamtypes`)를 딥임포트 — caret(`^11.0.1`) 고정 하에서 마이너/패치로도 깨질 수 있음(현재 `11.1.27` 정상 동작 확인) | `codebase/backend/src/shared/testing/swagger-probe.ts:9-10, 145-171` | 테스트 전용·영향 범위 국한이라 조치 불요. JSDoc 의 "메이저 업그레이드" 문구를 "마이너/패치 포함"으로 넓히면 좋음 |
| 5 | Side Effect | 세 라우트가 처음으로 OpenAPI `requestBody` 를 광고 — 외부 codegen 클라이언트 관점에서 문서 표면이 확장됨(런타임 계약은 캐너리로 불변 고정) | `triggers.controller.ts`/`executions.controller.ts`/`hooks.controller.ts` 의 신규 `@ApiBody`/`@ApiConsumes` | 조치 불요 — CHANGELOG/plan 이 이미 additive 변경으로 명시 |
| 6 | Maintainability | 캐너리 spec 4-테스트 템플릿이 4개 라우트에서 반복(rule-of-three 충족) — 1R 에서 이미 "라우트별 독립 가독성" 근거로 유예 결정, 재검토 결과도 유지 | `executions-continue-body.spec.ts`, `triggers-rotate-bot-token-body.spec.ts`, `hooks-webhook-body.spec.ts`, `workflows-execute-body.spec.ts` | 조치 불요(이미 처분). 5번째 유사 라우트 발생 시 공용 factory 재검토 |
| 7 | Maintainability | "문서 전용 DTO" 설계 근거 주석이 3개 DTO 파일에 거의 동일하게 반복 | `continue-execution.dto.ts:3-10`, `chat-channel-rotate-bot-token-request.dto.ts:3-11` | 조치 불요. 후속으로 핵심 근거를 `CustomValidationPipe` JSDoc 한 곳에 모으는 안 고려 가능(낮은 우선순위) |
| 8 | Security/Documentation | `newBotToken` 필드 `writeOnly: true` + 예시값 없음으로 시크릿 평문 노출 억제 규약 정확히 준수 (양호 확인) | `chat-channel-rotate-bot-token-request.dto.ts:14-18` | 없음(양호) |
| 9 | Testing | 1R WARNING(`bodyParamDesignType` 에러 분기 무테스트)이 `fafc6b8ac` 로 해소되고 스팟 뮤테이션(가드 무력화 → 즉시 RED)으로 실제 KILL 을 재현 확인 | `swagger-probe.spec.ts:75-120` | 없음(양호) |
| 10 | User Guide Sync | `backend-api-change` trigger 매칭되었으나 swagger jsdoc(target a)은 이 PR 자체가 충족, user-guide 페이지(target b)는 세 엔드포인트 모두 기존 서술이 이미 정확해 갱신 불요 | `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:96, 427-439, 463` | 없음(갭 없음) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 문서화, 인증/인가/검증 경로 불변. `writeOnly` 시크릿 노출 억제 준수 |
| performance | NONE | 부트스트랩 1회성 데코레이터 등록 외 런타임 경로 영향 없음 |
| architecture | NONE | 이중 DTO 선언은 의도된 트레이드오프, 레이어 분리·모듈 경계 양호 |
| requirement | LOW | 코드-spec line-level 일치 재확인, 1R WARNING 해소 확인. 잔여는 트래커 미체크(INFO) |
| scope | NONE | 4개 신규 커밋 모두 1R 지적사항에 1:1 대응하는 최소 변경, 스코프 이탈 없음 |
| side_effect | NONE | `@Body()` 시그니처 불변, 신규 헬퍼는 메타데이터 읽기 전용(쓰기 없음) |
| maintainability | LOW | 캐너리 템플릿 반복은 이미 유예 결정 유지(INFO 하향), 1R WARNING 해소 확인 |
| testing | NONE | 유일한 테스트 갭 해소 + 스팟 뮤테이션으로 가드 생존 재검증 |
| documentation | LOW | 코드/JSDoc/테스트 삼자 일치 확인, 잔여는 예정된 트래커 미체크(INFO) |
| dependency | NONE | 신규 패키지 없음, Nest 내부 서브패스 딥임포트는 테스트 전용·영향 국한 |
| database | NONE | 해당 코드 없음 |
| concurrency | NONE | 해당 코드 없음 |
| api_contract | LOW | 하위 호환성 파괴 없음, 문서-검증 계층 의도적 분리 재확인. 잔여는 명명 비대칭·트래커(INFO) |
| user_guide_sync | NONE | 매칭된 trigger 갭 0건, 기존 가이드가 이미 정확함을 실측 확인 |

## 발견 없는 에이전트

- scope, database, concurrency, testing, user_guide_sync (신규 결함 0건, INFO 성격 발견조차 없음 또는 전부 긍정 관찰)

## 권장 조치사항

1. (마무리 커밋, developer) `plan/in-progress/spec-draft-nullable-notation-followups.md:2459` 트래커 항목 체크 + 처방 문구를 실채택안("문서 전용 DTO + `@ApiBody`, 파라미터는 인라인 유지 — 전역 파이프 계약 변경 회피")으로 정정. `plan/in-progress/rotate-bot-token-body.md` 체크리스트의 대응 줄도 함께 체크.
2. (후속, project-planner 턴) `spec/conventions/swagger.md` §1-7 에 `<Domain><Action>RequestDto` 명명 규약과 "인라인 `@Body()` 타입에는 `@ApiBody` 필수" 규칙을 성문화 — 이번 PR 이 이미 계획해 둔 항목.
3. (선택, 낮은 우선순위) `swagger-probe.ts` JSDoc 의 "Nest 메이저 업그레이드" 문구를 "마이너/패치 포함"으로 넓혀 다음 업그레이드 담당자에게 정확한 리스크 범위 전달.
4. 이번 라운드에서 즉시 코드 변경이 필요한 항목은 없음 — `--impl-done` 진행 가능.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 전체 reviewer(14명) 실행됨.
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨. 강제 화이트리스트 미이행 없음.
- **제외**: 없음(전원 실행).
