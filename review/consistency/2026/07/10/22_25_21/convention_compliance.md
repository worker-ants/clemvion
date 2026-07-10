# 정식 규약 준수 검토 — getStatus() 2단계 조회 projection 최적화

- 모드: `--impl-prep` (구현 착수 직전)
- target: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()` — TypeORM `findOne` 전 컬럼 조회 → 2단계 `select` projection 분리 (미구현, 계획 단계)
- 검토 관점: 정식 규약(`spec/conventions/**`) 준수 여부 (명명·출력 포맷·문서 구조·API 문서·금지 항목)

---

## 발견사항

### [WARNING] `conversationThread` 2차 조회 결과에도 `redactThreadForPublic` 마스킹 재적용이 계획 서술에 명시돼 있지 않음

- target 위치: 검토 대상 변경 설명 2번째 항목 ("`status === waiting_for_input` 일 때만 `findOne({ select:['id','conversationThread'] })` 추가, NodeExecution 조회와 `Promise.all` 병렬")
- 위반 규약: `spec/conventions/conversation-thread.md` "소비처 갱신 (2026-07-09)" 절 — "이 불변식은 이제 **런타임 강제**된다 — SSE emit 과 REST `getStatus` 가 공유하는 단일 helper `redactThreadForPublic` 가 egress 시... 마스킹한다" / `spec/5-system/14-external-interaction-api.md` §R17 "`conversationThread` (강제됨)" 절
- 상세: 현재 코드(`interaction.service.ts:264-266`)는 `execution.conversationThread ? redactThreadForPublic(execution.conversationThread) : undefined` 로, 1회 `findOne`(전 컬럼)이 반환한 동일 `execution` 객체에서 값을 읽어 마스킹한다. 계획대로 1단계 조회에서 `conversationThread` 를 `select` 목록에서 제외하면 이후 `execution.conversationThread` 는 TypeORM projection 규약상 `undefined` 가 되므로, waiting 분기는 **반드시 2단계 조회가 반환한 별도 partial entity 의 `conversationThread`** 를 소스로 바꿔 읽어야 한다. 계획 서술은 "select 필드 추가"까지만 명시하고, (a) 소스를 새 partial entity 로 바꾸는 배선, (b) 그 값에 기존과 동일하게 `redactThreadForPublic` 을 적용하는 것을 명시적으로 재확인하지 않는다. 이는 EIA §R17 이 "런타임 강제" 라고 못박은 secret-마스킹 불변식이라, 리팩터 중 소스 전환을 놓치면 (b-1) `undefined` 참조로 인한 기능 회귀(새로고침 히스토리 복원 소실) 또는 (b-2) 마스킹 helper 호출부 자체가 다른 위치로 옮겨지며 우회되는 두 갈래 회귀 위험이 있다.
- 제안: 구현 시 (1) 2차 `findOne` 결과 변수(예: `threadRow`)의 `conversationThread` 를 `redactThreadForPublic` 에 그대로 통과시키는 지점을 TDD 테스트로 고정(예: waiting_for_input + `conversation_thread` 존재 케이스에서 응답 `context.conversationThread` 가 여전히 마스킹된 값으로 채워지는지 단정), (2) 1단계 `select` 목록에서 `conversationThread` 를 제외한 것을 코드 리뷰 시 `execution.conversationThread` 잔존 참조 grep 으로 확인. 계획 자체를 규약 위반으로 판정하지는 않으나(아직 코드가 없음), 구현 시 반드시 지켜야 할 불변식으로 impl-prep 단계에 명시.

### [INFO] TypeORM `select` projection 관행은 `spec/conventions/**` 에 정식 규약으로 문서화돼 있지 않음 — 단, 코드베이스 관행과는 일치

- target 위치: 검토 질문 1 ("TypeORM 조회·projection·repository 사용 규약이 있는가?")
- 위반 규약: 해당 없음 — `spec/conventions/*.md` 전수 검색(`data-hydration-surfaces.md`, `execution-context.md`, `node-output.md`, `conversation-thread.md`, `swagger.md`, `error-codes.md`, `migrations.md` 등) 결과 TypeORM `select`/`QueryBuilder`/projection 선택 기준을 다루는 정식 규약 문서는 없음
- 상세: 이 검토가 근거로 삼을 "정식 규약" 자체가 부재하므로 CRITICAL/WARNING 판정 대상이 아니다. 다만 코드베이스에는 이미 8개 파일에서 `select: [...]` 패턴이 쓰이고 있고, 그중 4개(`interaction.service.ts` 3곳 + `interaction-token.service.ts`, `interaction.guard.ts`, `notification-webhook.processor.ts`, `notification-fanout.service.ts`)가 **바로 이 `external-interaction` 모듈** 안에 있다 — 즉 이 모듈 자체가 "필요한 컬럼만 select" 관행의 밀집 사례다. 특히 `interaction.service.ts` 안에서만 `select: ['id', 'status']` 가 `interact()`(line 156)·`refreshToken()`(line 209)·`loadAndAssertAlive()`(line 359) 세 곳에 동일 패턴으로 이미 존재한다(검토 질문 2 답변: 정확히 일치). 검토 대상 변경은 이 idiom 을 `getStatus()` 에도 확장 적용하는 것으로, 기존 파일 내부 관행과 완전히 일관된다.
- 제안: 규약 위반 없음. 다만 이 idiom 이 프로젝트 전반에 재현되는 패턴으로 굳어지고 있으므로(8개소, 그중 절반이 한 모듈), 향후 규모가 더 커지면 `spec/conventions/` 에 "언제 select projection 을 쓰는가"(예: hot-path 조회 + 큰 jsonb 컬럼 존재 시)를 정식 규약으로 승격하는 것을 고려할 수 있다 — 이번 변경이 강제하는 사안은 아님.

### [INFO] Wire 응답 형식 무변경 주장 — 검증 결과 유지 확인, 단 위 WARNING 이 유일한 리스크 지점

- target 위치: 검토 질문 3
- 위반 규약: 없음(확인 목적) — 관련: `spec/5-system/14-external-interaction-api.md` §5.3 응답 스키마, §R17 필드 계약
- 상세: `getStatus()` 반환문(`interaction.service.ts:325-353`)이 실제로 읽는 `execution.*` 필드는 `id`, `workflowId`, `status`, `outputData`(COMPLETED/FAILED 분기), `finishedAt`, `startedAt` 뿐이며, waiting 분기는 `conversationThread` 만 추가로 읽는다. 계획된 1단계 select 목록(`id`,`status`,`workflowId`,`startedAt`,`finishedAt`,`outputData`)이 이를 정확히 커버하고, `conversationThread` 는 조건부 2단계 조회로 분리되므로 — 위 WARNING 항목이 올바르게 구현되는 한 — `ExecutionStatusDto` 의 wire shape·필드 값 자체는 변하지 않는다. `swagger.md` §5-1(엔티티 그대로 노출 금지, 응답 DTO 경유)·§2-5(TransformInterceptor 래핑) 규약도 이번 변경으로 건드리지 않는다(응답 DTO·컨트롤러·데코레이터 무변경).
- 제안: 없음(확인 완료). 구현 후 기존 e2e/unit(`getStatus` 관련)이 그대로 통과하는지가 이 주장의 최종 검증 게이트.

### [INFO] Spec 참조 주석(`[Spec EIA §5.3]` 류) — 정식 규약 아님, house style 권장 사항

- target 위치: 검토 질문 4
- 위반 규약: 없음 — `spec/conventions/**` 전수 검색 결과 "코드에 spec 앵커 주석을 반드시 단다"를 명문화한 정식 규약 문서는 존재하지 않는다(CLAUDE.md 는 "결정의 배경·근거 → spec 문서의 `## Rationale`"만 규정, 코드 인라인 주석 의무는 규정하지 않음)
- 상세: 그럼에도 `getStatus()` 자체가 이미 JSDoc 에 `[EIA §5.3]`, `EIA §R17`, `EIA §5.3/§R17 재조정` 등 spec 앵커를 조밀하게 인용하는 구간이며(line 222-240, 250-256, 260-263), 이 파일의 다른 모든 분기 처리도 동일 스타일을 따른다(예: `dispatchContinuation` 의 `[spec §5.1 / form §4·§6.2]`). 정식 규약은 아니지만 이 함수 한정으로는 매우 강한 실질 관행이다.
- 제안: 필수는 아니나, 이번 2단계 조회 분리가 "왜 conversationThread 를 분리했는지"(불필요한 대용량 jsonb 컬럼 로드 회피 — waiting 이 아닌 절대다수 호출에서 미사용)를 한 줄 주석으로 남기면 이 파일의 기존 스타일과 일관되고, 위 WARNING 이 지적한 마스킹 재적용 지점을 코드 리뷰어가 놓치지 않도록 돕는다. 규약 갱신 사안은 아님.

### [INFO] `PROJECT.md §변경 유형 → 갱신 위치 매핑` — 해당 행 없음, 동반 갱신 의무 없음

- target 위치: 검토 질문 5
- 위반 규약: 없음(확인 목적) — `PROJECT.md` §변경 유형 → 갱신 위치 매핑 표 전 행 대조
- 상세: 표의 "백엔드 API 추가·변경" 행은 엔드포인트/DTO/route 표면 변경을 대상으로 하며 (a) swagger jsdoc (b) user-guide 페이지 갱신을 요구한다. 이번 변경은 컨트롤러·DTO·엔드포인트·에러코드·wire 응답 어느 것도 바꾸지 않는 backend 내부 쿼리 최적화이므로 이 행에 해당하지 않는다. 신규 노드/schema/UI 문자열/warningCode/errorCode/cross-cutting enum/handler output field/AuthConfig enum 등 표의 나머지 행도 전부 무관하다. i18n·backend-labels·user-guide·swagger 동반 갱신은 요구되지 않는다.
- 제안: 없음(확인 완료). 단, 이 결론은 위 WARNING 이 지적한 대로 `conversationThread` 재배선이 정확히 이뤄져 실제로 wire 가 무변경일 때에만 유효하다 — 만약 구현 과정에서 waiting 분기 응답에 `conversationThread` 가 누락되는 회귀가 생기면 그 순간 "백엔드 API 변경"(사용자 가시 동작 변경, 웹채팅 위젯 새로고침 복원 실패)에 해당해 표의 (b) 사용자 안내 영향 검토가 소급 발동한다. impl-prep 단계에서는 계획 서술 자체가 이런 변경을 의도하지 않으므로 위반 아님.

---

## 요약

검토 대상은 `spec/conventions/**` 에 명문화된 규약을 직접 위반하지 않는다. TypeORM `select` projection 관행은 애초에 정식 규약으로 codify 돼 있지 않지만, 코드베이스 — 특히 바로 이 `external-interaction` 모듈·이 파일 내부의 기존 3개 호출부 — 의 실제 idiom 과 정확히 일치하는 확장이며, `getStatus()` 가 실제로 소비하는 `Execution` 필드를 1단계 select 목록이 빠짐없이 커버해 wire 응답 형식도 이론상 무변경이다. 유일한 실질 리스크는 정식 규약 위반이 아니라 **구현 시 지켜야 할 불변식**이다 — `spec/conventions/conversation-thread.md` 와 EIA §R17 이 "런타임 강제"로 규정한 `redactThreadForPublic` 마스킹을, 새로 분리되는 2차 `conversationThread` 조회 결과에도 정확히 재적용해야 한다(소스 객체가 바뀌므로 배선 누락 위험 존재). 이 점만 구현 단계에서 테스트로 고정하면 PROJECT.md 동반 갱신 의무(i18n/swagger/user-guide)도 발생하지 않는 순수 내부 최적화로 마무리된다.

## 위험도

LOW

STATUS: OK
