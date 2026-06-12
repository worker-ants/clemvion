# 요구사항(Requirement) 리뷰

## 발견사항

### 1. [INFO] [SPEC-DRIFT] 04 M-1 — `isSwaggerEnabled` + `ENABLE_SWAGGER_IN_PROD` 구현이 spec 에 미반영

- 위치: `codebase/backend/src/common/config/production-guards.ts` (isSwaggerEnabled 함수) + `codebase/backend/src/main.ts`
- 상세: 구현은 `plan/in-progress/refactor/04-security.md §M-1` 권장안(옵션 A)을 올바르게 적용했다. `isSwaggerEnabled(env)` 는 `NODE_ENV !== 'production'` 시 항상 true, production 에서는 `ENABLE_SWAGGER_IN_PROD` 가 정확히 `'true'`/`'1'` 일 때만 true 를 반환하며, `isFlagOn` 과 일관된 패턴으로 구현됐다. 그러나 `spec/conventions/swagger.md` 와 `spec/5-system/2-api-convention.md` 에는 Swagger UI 의 production 노출 게이팅 정책(`non-production 전용`, `ENABLE_SWAGGER_IN_PROD` opt-in)이 전혀 기술되지 않은 상태다. plan M-1 의 "spec 갱신: swagger.md 또는 api-convention 에 non-production 전용 규약 (planner)" 가 아직 완료되지 않았다.
- 제안: 코드 유지 + spec 반영 필요. `spec/conventions/swagger.md` 또는 `spec/5-system/2-api-convention.md` 에 "Swagger UI 는 non-production 전용 (`NODE_ENV !== 'production'`). production 노출이 필요하면 `ENABLE_SWAGGER_IN_PROD=true` opt-in" 규약 1절 추가 (`project-planner` 위임).

---

### 2. [INFO] [SPEC-DRIFT] 04 M-3 — spec 의 "길이 200 = ReDoS 방지" 서술이 `safe-regex` 도입 후 부정확하게 잔존

- 위치: `spec/4-nodes/5-data/1-transform.md` ("ReDoS 방지를 위해 regex 패턴 길이는 200자 이내" / "`string_op.replace` 의 `regex: true` 패턴이 200자를 넘으면 no-op (ReDoS 방지)") 및 관련 4개 spec 문서
- 상세: 구현은 `safe-regex` 를 이용한 사전 검출 + `compileUserRegex` 단일 chokepoint 방식으로 지수 패턴(`(a+)+$` 등)을 길이 제한과 무관하게 컴파일 전 거부한다. 이는 plan M-3 권장안(옵션 B)의 올바른 구현이다. 그러나 spec 4곳의 "길이 200 = ReDoS 방지" 서술이 이미 "길이 제한 + safe-regex 검출" 조합으로 바뀐 현실을 반영하지 못해 부정확하다. plan README "transform/filter/if-else/switch 의 길이 200 = ReDoS 방지 정정" 항목이 spec 갱신 대기 중이다.
- 제안: 코드 유지 + spec 반영 필요. `spec/4-nodes/5-data/1-transform.md`, `spec/4-nodes/1-logic/1-if-else.md` 등 4개 파일의 "길이 200 = ReDoS 방지" 서술을 "길이 200자 초과 또는 지수 백트래킹(`safe-regex` 검출) 패턴은 컴파일 거부(silent false + meta.invalidRegexPatterns 가시화)" 로 정정 (`project-planner` 위임).

---

### 3. [INFO] [SPEC-DRIFT] 04 M-6 — `workflow:`/`notifications:` authorizer 구현이 spec §3.3 에 미반영

- 위치: `spec/5-system/6-websocket-protocol.md §3.3` ("권한 검증: `execution:`/`kb:`/`background:run:` 3채널만 소유 검증" 으로 명시)
- 상세: 구현은 `channelAuthorizers` 에 `workflow:` authorizer(workflowId→workspace `findById` 검증 + UUID 사전 필터)와 `notifications:` authorizer(JWT sub `userId` 일치 검증)를 추가해 IDOR 를 차단한다. plan M-6 판정("spec 자체가 IDOR 갭을 담은 케이스, 코드가 맞고 spec 이 낡음")대로 코드의 확장이 맞고 spec §3.3 의 채널 목록이 현실을 반영하지 못한다. plan M-6 "spec 갱신: §3.3 검증 채널 목록에 2채널 추가 + notifications 는 user 단위 명시 (planner)" 가 아직 완료되지 않았다.
- 제안: 코드 유지 + spec 반영 필요. `spec/5-system/6-websocket-protocol.md §3.3` 권한 검증 서술을 "`execution:`/`kb:`/`background:run:`/`workflow:` 는 workspace 소유 검증, `notifications:<userId>` 는 JWT sub 일치 검증" 으로 갱신 (`project-planner` 위임).

---

### 4. [WARNING] `notifications:` 채널 — `workspaceId` 공가드가 `userId` 검증을 우회할 가능성 설명

- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` (handleSubscribe 내 `if (!workspaceId)` 가드, L284 부근)
- 상세: `handleSubscribe` 는 모든 authorizer-대상 채널에 대해 `workspaceId` 부재 시 "Not authenticated" 로 일차 차단한다. `notifications:` 채널은 user 단위지만 이 공가드에도 걸린다. 주석은 "인증된 소켓은 JWT 에 workspaceId 를 함께 담으므로 본 가드는 정상 경로를 막지 않는다. userId 검증은 authorizer." 로 설명한다. `handleConnection`(L205)에서 JWT payload 의 `workspaceId` 필드가 선택적(`payload.workspaceId?: string`)임을 감안하면, 향후 workspaceId 없이 발급된 JWT 가 도입될 때 정상 사용자의 `notifications:` 구독이 "Not authenticated" 로 차단될 수 있다. 현재 인증 체계에서는 workspaceId 없이 발급되는 케이스가 없어 기능상 문제 없으나, 확장성 측면의 주의가 필요하다.
- 제안: 현재 구현 유지. 향후 multi-workspace JWT 또는 workspaceId 없는 토큰 도입 시 `handleSubscribe` 의 `if (!workspaceId)` 가드를 채널 prefix 별로 조건화하거나 authorizer 내부로 이관하는 것을 검토할 것.

---

### 5. [INFO] `compileUserRegex` — `safe-regex` false positive 동작 설명 JSDoc 누락

- 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts` `compileUserRegex` 함수 JSDoc
- 상세: `safe-regex` 는 휴리스틱 기반이라 false positive(안전한 패턴을 unsafe 로 판정)가 가능성상 잔존한다(plan M-3 옵션 B 장단점에 명시). 함수 JSDoc 은 "위험 패턴은 거부" 만 기술하고, false positive 발생 시 사용처(filter.handler.ts, transform.handler.ts)에서 `meta.invalidRegexPatterns` 로 노출된다는 소비 계약이 함수 수준에서 언급되지 않는다. 런타임 동작은 올바르다.
- 제안: 문서화 보강 검토 — `compileUserRegex` JSDoc 에 "safe-regex 의 false positive 시 `{ regex: null, reason: 'unsafe' }` 반환, 사용처는 `meta.invalidRegexPatterns` 등 기존 invalid 채널로 가시화해야 함" 설명 추가.

---

## 요약

이번 변경은 `refactor-04-security` 의 M-1(Swagger production 게이팅), M-3(ReDoS safe-regex 사전 검출), M-6(WebSocket `workflow:`/`notifications:` IDOR 차단) 세 항목을 구현한다. 각 구현의 기능 완전성은 높다 — `isSwaggerEnabled` 는 non-production 전용 + opt-in escape hatch 를 올바르게 구분하고, `compileUserRegex` 는 길이·unsafe·invalid 세 사유를 단일 chokepoint 에서 처리하며, websocket authorizer 는 UUID 사전 필터 + DB 소유 검증 + JWT sub 비교의 방어 계층을 갖췄다. 에러 시나리오, 반환값, 비즈니스 로직(fail-closed, 비-UUID 차단, `isFlagOn` 재사용) 모두 의도에 부합하고 TODO/FIXME 미완성 주석도 없다. 주요 발견사항은 spec fidelity 측면의 `[SPEC-DRIFT]` 3건(M-1·M-3·M-6 모두 spec 갱신 누락)으로, 코드 자체는 올바르고 spec 반영이 후행 작업으로 남은 상태다. WARNING 1건은 `notifications:` 채널의 workspaceId 공가드 전제에 관한 잠재적 확장성 혼선이며, 현재 JWT 발급 방식에서는 문제없다.

## 위험도

LOW
