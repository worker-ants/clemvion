# Requirement Review — PR-B2a fix-pass (11_36_39)

대상: 이전 리뷰(11_22_25) Warning W1/W2/W3/W5/W9 에 대한 수정 커밋.  
변경 파일: `package.json`, `main.ts`, `stub.client.spec.ts`, `llm.service.spec.ts` (LLM_STUB_MODE 분기), `llm.service.ts` (캐시 순서 재조정), 이전 리뷰 산출물 md/json.

---

## 발견사항

### [INFO] W1 수정 — `main.ts` LLM_STUB_MODE 프로덕션 가드 충족

- 위치: `codebase/backend/src/main.ts` L207–212
- 상세: `NODE_ENV === 'production' && LLM_STUB_MODE === 'true'` 조합에서 `throw new Error(...)` 가드가 `OAUTH_STUB_MODE` 직후에 추가됐다. 패턴 일관성과 fail-closed 안전성 모두 충족. 이전 W1 해소 확인.

### [INFO] W2 수정 — `stub.client.spec.ts` 신설 및 경계값 커버리지 충족

- 위치: `codebase/backend/src/modules/llm/clients/stub.client.spec.ts` (신규 76라인)
- 상세: echo 멀티턴·빈 user 메시지·200자 슬라이싱·model fallback(빈 문자열)·embed 벡터 개수·listModels 스키마·testConnection 전부 커버. 이전 W2 해소 확인.
- 추가 관찰: `model: ''` → `stub-model` fallback 케이스를 명시적으로 검증하나, `model` 이 `undefined` 인 경우는 테스트하지 않는다. `ChatParams.model` 이 필수 `string` 이라면 타입 레벨에서 이미 방어되므로 INFO 수준.

### [INFO] W3 수정 — `llm.service.spec.ts` LLM_STUB_MODE 분기 테스트 충족

- 위치: `codebase/backend/src/modules/llm/llm.service.spec.ts` 추가 `describe` 블록 (L608–643)
- 상세: stub 반환 + 실경로 미진입, 미설정 정상 경로, stub 캐시 일관성(`toBe(b)`) 3케이스가 모두 존재한다. `afterEach` 에서 `process.env.LLM_STUB_MODE` 를 원상 복구해 테스트 격리도 확보됐다. 이전 W3 해소 확인.

### [INFO] W5/I7 수정 — `createClient` stub 분기가 캐시 체크 앞으로 이동

- 위치: `codebase/backend/src/modules/llm/llm.service.ts` L69–91 (현재 상태)
- 상세: 리오더 후 `LLM_STUB_MODE=true` 에서 캐시된 `StubLlmClient` 를 재사용(`instanceof StubLlmClient` 체크)하고, 정상 경로의 실 클라이언트 캐시 체크는 stub 분기 이후로 이동했다. mid-test env 변경 오염 위험 해소. 이전 W5/I7 해소 확인.

### [INFO] W9 수정 — `jsonwebtoken` 명시적 선언 충족

- 위치: `codebase/backend/package.json` devDependencies
- 상세: `"jsonwebtoken": "9.0.3"` 와 `"@types/jsonwebtoken": "^9.0.0"` 이 devDependencies 에 명시 추가됐다. 전이 의존성 암묵 의존 해소. 이전 W9 해소 확인.

### [WARNING] [SPEC-DRIFT] `LLM_STUB_MODE` stub 인프라가 spec 에 미반영

- 위치: `codebase/backend/src/modules/llm/llm.service.ts` + `main.ts` / spec 없음
- 상세: `OAUTH_STUB_MODE` 는 `spec/2-navigation/10-auth-flow.md` L326 에 env 변수명과 목적이 기술되어 있다. `LLM_STUB_MODE` 는 코드·주석·plan 에 존재하나 어떤 spec 문서에도 기술되어 있지 않다. e2e stub 전략(환경 변수명·docker-compose 격리·프로덕션 가드 패턴·StubLlmClient 동작 계약)을 정의하는 spec 본문이 없다. 코드 동작이 합리적이고 의도적이며 되돌리는 것이 오답인 경우(`LLM_STUB_MODE` 패턴은 PR-B2a 요구사항의 핵심 테스트 인프라)이므로 SPEC-DRIFT 로 분류한다.
- 제안: 코드 유지 + spec 반영. `spec/5-system/7-llm-client.md` (또는 `spec/5-system/4-execution-engine.md §4.x banner`) 에 "e2e 테스트 인프라 — LLM_STUB_MODE" 항목 추가. `OAUTH_STUB_MODE` 가 `spec/2-navigation/10-auth-flow.md` 에 기술된 것과 동형. 반영은 `project-planner` 위임.

### [WARNING] e2e `mintInteractionToken` — EIA spec §8.3 "trigger 별 secret 분리" 와 구현 간 해석 모호

- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` `mintInteractionToken()`, spec `spec/5-system/14-external-interaction-api.md` §8.3 L636
- 상세: spec §8.3 은 `iext_*` JWT 를 "JWT HS256, secret 은 trigger 별 분리" 로 정의한다. e2e 는 전역 `JWT_SECRET` (`clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7` 또는 `process.env.JWT_SECRET`) 으로 서명해 mint 한다. e2e 가 실제로 통과한다는 사실은 서버가 같은 `JWT_SECRET` 으로 검증한다는 것을 런타임에 확인한 것이지만, spec 의 "trigger 별 분리" 문구와 실제 구현이 어긋난 것인지(코드가 틀림) 혹은 spec 문구가 현재 구현의 전역 secret 방식과 어긋난 것인지(SPEC-DRIFT) 판단이 모호하다. 판단이 불명확하므로 일반 WARNING 으로 두고 사람이 판단한다.
- 제안: `InteractionTokenService.issuePerExecution` 의 서명 secret 소스(`JWT_SECRET` vs trigger-specific secret) 를 확인하고, spec §8.3 "trigger 별 분리" 표현이 현재 구현과 일치하는지 project-planner 와 함께 정합 여부를 결정한다. e2e 의 `JWT_SECRET` 사용이 옳다면 spec §8.3 갱신 필요; 구현이 틀렸다면 코드 fix 필요.

### [INFO] e2e runner 서비스의 `JWT_SECRET` 암묵적 의존

- 위치: `docker-compose.e2e.yml` (backend-e2e-runner 서비스), `execution-park-resume.e2e-spec.ts` L679
- 상세: `backend-e2e-runner` 에 `JWT_SECRET` 이 주입되지 않아 `process.env.JWT_SECRET` 이 `undefined` 가 되어 hardcoded fallback 상수로 동작한다. 이 fallback 이 `backend-e2e` 의 `JWT_SECRET` 과 일치하므로 현재 동작에 문제는 없다. 그러나 fallback 상수를 변경하지 않고 `backend-e2e` 의 `JWT_SECRET` 만 변경하면 인증 실패가 발생하며, 그 원인이 runner 환경변수 누락임을 추적하기 어렵다.
- 제안: 중요도 낮음 — follow-up 이월 허용. runner 에 `JWT_SECRET` 을 명시적으로 주입하거나 코드 주석으로 암묵적 의존 명시.

### [INFO] `stub.client.spec.ts` — `embed([])` 빈 입력 케이스 미검증

- 위치: `codebase/backend/src/modules/llm/clients/stub.client.spec.ts` L481–487
- 상세: `embed` 테스트는 `embed(['a', 'b'])` (2개 입력) 만 검증하고 `embed([])` 빈 배열 케이스를 검증하지 않는다. StubLlmClient.embed 가 `inputs.map(() => [0,0,0])` 구조라면 빈 배열에도 `[]` 를 반환할 것이므로 동작 상 문제는 없을 것이나, 명시 검증이 없다. 심각도 낮음.

### [INFO] spec fidelity — conversation_thread turn 스키마 및 spec §4.x 불변식 일치 확인

- 위치: 이전 리뷰(11_22_25) requirement.md 발견사항 10/11 재확인
- 상세: e2e 기대 필드(`seq`, `source`, `text`, `nodeId`)가 `spec/conventions/conversation-thread.md §1.3` 와 일치하고, `source` 값 `ai_user`/`ai_assistant` 가 spec §1.4 와 일치한다. park 시 `execution.status=waiting_for_input` + `node_execution.status=WAITING` + `_resumeCheckpoint` 존재 + thread 무손실 누적 + `end_conversation → completed` 전이 검증이 spec §4.x·§7.5 불변식과 line-level 로 정합이다. 이번 fix-pass 에서 변경 없으므로 기존 평가 유지.

---

## 요약

이번 fix-pass(11_36_39) 의 코드 변경(W1 main.ts 가드, W2 stub spec, W3 service spec, W5 캐시 순서, W9 package.json)은 이전 리뷰가 지적한 5개 Warning 을 모두 올바르게 해소했다. 기능 완전성 관점에서 PR-B2a 의 핵심 요구사항(LLM 없이 멀티턴 AI park→rehydration resume 를 결정적으로 e2e 검증)은 충족됐으며, 기존 spec §4.x·§7.5·conversation_thread 불변식과의 정합도 유지된다. 새로 발견된 사항은 두 가지: (a) `LLM_STUB_MODE` 인프라가 spec 에 미반영(SPEC-DRIFT WARNING — 코드는 옳고 spec 갱신 필요), (b) EIA spec §8.3 "trigger 별 secret 분리" 문구와 e2e 가 `JWT_SECRET` 전역 key 를 사용하는 구현 간 해석 모호(판단 위임 WARNING). 나머지는 모두 INFO 수준이다.

---

## 위험도

LOW
