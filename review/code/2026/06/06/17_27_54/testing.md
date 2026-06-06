# Testing 관점 코드 리뷰

## 발견사항

### [INFO] LLM config 생성 경로 교체 — 커버리지 개선
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` 라인 643~663 (diff 핵심)
- 상세: 기존 코드는 `llm_config` 행을 DB 에 직접 INSERT 해 `crypto.util.encrypt` 경로(`POST /api/llm-configs`)를 우회했다. 변경 후 정식 API 경로로 교체해 e2e 커버 범위가 한 계층 확장됐다. `ENCRYPTION_KEY: 0123456789abcdef0123456789abcdef`(32-char=16B) → `0123456789abcdef...0123456789abcdef`(64-hex=32B) 수정과 함께 실제 암호화 경로가 500 없이 동작하는 것까지 확인한다.
- 제안: 양호. 정식 경로 e2e 커버는 회귀 방어력을 높이는 올바른 방향이다.

### [INFO] INTERACTION_JWT_SECRET 미주입 — 테스트 토큰 mint 의 secret 매칭 방식
- 위치: `execution-park-resume.e2e-spec.ts` 라인 416~421, `interaction-token.service.ts` 라인 89~91
- 상세: `mintInteractionToken`은 `process.env.JWT_SECRET ?? 'clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7'` 로 토큰을 직접 mint 한다. 한편 `InteractionTokenService` 는 `INTERACTION_JWT_SECRET → jwt.secret → JWT_SECRET → fallback` 우선순위로 시크릿을 결정한다. `docker-compose.e2e.yml` 에 `INTERACTION_JWT_SECRET` 이 주입되지 않으므로 백엔드는 `JWT_SECRET`(`clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7`)을 사용하며, e2e 의 mint 경로와 일치해 현재 동작은 정상이다. 그러나 향후 `INTERACTION_JWT_SECRET` 를 독립 env 로 분리해 compose 에 주입할 경우 mint 경로가 JWT_SECRET 를 계속 쓰면 불일치가 발생한다.
- 제안: `docker-compose.e2e.yml` 에 `INTERACTION_JWT_SECRET` 를 명시적으로 설정하고 `mintInteractionToken` 도 동일 env 변수를 읽도록 동기화하거나, 현재 fallback 체인이 유지된다는 사실을 주석에 명시해 추후 env 분리 시 연동 변경 필요성을 상기시킨다.

### [WARNING] `ENCRYPTION_KEY` 교정과 기존 e2e 무회귀 확인 범위 불명확
- 위치: `docker-compose.e2e.yml` 라인 880 (diff), `ENCRYPTION_KEY` 값 변경
- 상세: e2e DB 가 ephemeral 이므로 키 변경 자체는 안전하다. 그러나 변경된 키는 `crypto.util.encrypt/decrypt`를 사용하는 **다른 모든 e2e 테스트**(예: `workflow-execution.e2e-spec.ts`, `external-interaction.e2e-spec.ts` 등)에도 영향을 미친다. `INTEGRATION_ENCRYPTION_KEY`(SHA-256 derive → 길이 무관)와 달리 `ENCRYPTION_KEY`는 직접 `Buffer.from(key,'hex')`로 파싱되므로, 기존 테스트들이 이 키로 암호화된 데이터를 생성 후 복호화하는 시나리오가 있는지 점검이 필요하다.
- 제안: 기존 e2e 파일 중 `POST /api/llm-configs` 또는 `ENCRYPTION_KEY` 경로를 사용하는 스위트를 나열하고, 변경 후 전체 e2e suite 를 실행해 무회귀를 확인한다. (플랜 ④항에 "기존 e2e(174+) 무회귀 확인"이 명시됐으나 실행 증거가 리뷰 시점에 제공되지 않음.)

### [INFO] `waitForUserTurn` polling — thread turn 완료 판별 방식의 합리성
- 위치: `execution-park-resume.e2e-spec.ts` 라인 544~562
- 상세: `status` 기반 poll 만으로는 turn 처리 완료를 판별할 수 없다는 문제를 `conversation_thread` JSONB 가 user turn 을 포함할 때까지 polling 하는 방식으로 해결했다. 비동기 re-park 의 status-stale 문제에 대한 올바른 접근이며 결정적이다.
- 제안: 양호. `timeoutMs=20_000` 의 합리성은 CI 환경 성능에 따라 다르지만 명시적 주석이 있어 의도가 명확하다.

### [INFO] `poll` 함수 구현 중복 — 두 `describe` 블록에 동일 구조가 각각 존재
- 위치: 라인 178~200 (PR-B1 describe), 라인 478~498 (PR-B2a describe)
- 상세: `poll`, `createWorkflow`, `saveCanvas` 헬퍼가 두 describe 블록 각각에 중복 정의되어 있다. 내용은 거의 동일하나 `timeoutMs` 기본값이 다르다 (PR-B1: 15_000ms, PR-B2a: 20_000ms).
- 제안: 기능 자체에 문제는 없으나, 장기 관점에서 `test/helpers/` 에 `pollExecution` 헬퍼로 추출하면 유지보수성이 높아진다. 현 PR 범위에서 강제 사항은 아님.

### [INFO] `spec/5-system/7-llm-client.md` §7.1 stub 문서 — `StubLlmClient.embed` 동작 미언급
- 위치: `spec/5-system/7-llm-client.md` 라인 2123~2129 (diff)
- 상세: stub 문서는 chat 동작(echo 응답, no tool call)을 명시했으나, `embed`(zero 벡터 반환)와 `listModels`(stub-model 1건)의 동작이 미언급됐다. `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-b2a-followup-9fdefc/codebase/backend/src/modules/llm/clients/stub.client.ts` 라인 45~56 참조.
- 제안: 테스트 관점에서 다른 e2e 가 stub 모드에서 embed 를 호출하면 zero 벡터를 받는다는 사실을 인지해야 잘못된 기대를 방지할 수 있다. spec 에 한 줄 추가 권장.

### [INFO] `spec/5-system/14-external-interaction-api.md` §8.3 변경 — 테스트 커버리지 없음
- 위치: diff §8.3 token 규약 clarification
- 상세: `iext_*` 가 단일 글로벌 secret 을 쓴다는 사실을 spec 에서 명확화했으나, 이 secret fallback chain(`INTERACTION_JWT_SECRET → jwt.secret → JWT_SECRET → 'interaction-fallback'`)이 올바르게 동작하는지 검증하는 단위/통합 테스트가 없다. `InteractionTokenService` 의 secret 결정 로직은 현재 e2e 만 간접적으로 커버한다.
- 제안: `InteractionTokenService` 의 secret fallback 체인에 대한 unit test 추가를 권장한다 (낮은 우선순위 — 현 PR 범위 밖).

### [INFO] `end_conversation` 에 대한 서버 응답 body 검증 미수행
- 위치: 라인 749~754
- 상세: `end_conversation` 요청의 응답 status 만 `202` 로 확인하고, body 의 `accepted: true` 는 검증하지 않는다. 반면 `submit_message`(라인 530~534)는 `accepted` 까지 확인한다. 일관성이 없다.
- 제안: `end_conversation` 응답도 `expect(res.body.data?.accepted).toBe(true)` 를 추가해 응답 형식을 검증하는 것이 좋다.

---

## 요약

이번 변경의 핵심은 두 가지다: (1) `docker-compose.e2e.yml` 의 `ENCRYPTION_KEY` 를 32-char(16B)에서 64-hex(32B)로 교정해 `POST /api/llm-configs` 의 AES-256-GCM 암호화 경로가 실제로 동작하게 했고, (2) e2e 테스트에서 DB 직접 INSERT 우회를 제거하고 정식 API 경로로 교체해 그 경로의 e2e 커버리지를 확보했다. 테스트 로직 자체는 turn-park 불변식(durable 영속 + cold rehydration + thread 무손실 누적)을 명확하게 검증하며 의도가 잘 표현돼 있다. 다만 `INTERACTION_JWT_SECRET` 미주입으로 인한 secret fallback 의존이 암묵적이고, `end_conversation` 응답 body 검증이 누락됐으며, 키 변경이 타 e2e 에 미치는 영향의 무회귀 실행 증거가 미제공이다. 전반적으로 테스트 품질은 양호하며 위험도는 낮다.

## 위험도

LOW
