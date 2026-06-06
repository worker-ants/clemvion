# 부작용(Side Effect) Review

## 발견사항

### 파일 1: stub.client.ts (신규)

- **[INFO]** 순수 구현체 — 전역 상태 없음, 외부 호출 없음
  - 위치: 전체 파일
  - 상세: `StubLlmClient`는 인스턴스 필드가 없는 stateless 구현체다. `chat`, `embed`, `listModels`, `testConnection` 모두 외부 I/O 없이 리터럴 값을 반환한다. 부작용 없음.
  - 제안: 없음

- **[INFO]** `stream` 메서드 미구현 — 의도적 누락
  - 위치: `LLMClient` 인터페이스 `stream?` (optional)
  - 상세: `LLMClient.stream`은 optional이므로 구현 의무 없음. `LlmService.chatStream`은 `if (!client.stream)` 분기로 `LLM_STREAMING_UNSUPPORTED` 오류를 발생시킨다. e2e 시나리오가 `chatStream`을 호출하지 않는 한 문제 없다. AI agent 핸들러는 `llmService.chat`만 사용하므로 현재 e2e 경로에서 영향 없음.
  - 제안: 없음 (의도적 설계). 단, 향후 스트리밍 경로 e2e 추가 시 stub에 `stream` 구현 필요.

- **[INFO]** `embed` 반환 3차원 zero 벡터 — 차원 불일치 잠재 위험
  - 위치: `stub.client.ts` line 39-41
  - 상세: `knowledge-base.service.ts`는 `embed` probe 결과의 `vectors[0].length`를 embedding dimension으로 DB 스키마와 함께 사용한다. `LLM_STUB_MODE=true`에서 `POST /api/knowledge-bases`를 호출하면 3-dim 벡터가 반환되어 실제 embedding 컬럼 차원(예: 1536)과 충돌할 수 있다. 현재 e2e에서 knowledge-base 호출은 없으므로 실제 부작용 없으나, 동일 e2e 환경에서 knowledge-base 관련 테스트가 추가되면 문제가 된다.
  - 제안: e2e에서 knowledge-base 시나리오와 LLM_STUB_MODE=true를 동시에 사용하지 않도록 주의 또는 문서화.

---

### 파일 2: llm.service.ts (변경)

- **[WARNING]** `LLM_STUB_MODE=true`에 production guard 없음 — `OAUTH_STUB_MODE` 선례 미적용
  - 위치: `llm.service.ts` line 81, `main.ts` line 41-50
  - 상세: `OAUTH_STUB_MODE=true`는 `main.ts`의 bootstrap에서 `NODE_ENV=production`일 때 즉시 프로세스를 종료시키는 fail-closed 가드가 있다. 반면 `LLM_STUB_MODE`는 동일한 가드가 없다. 운영 환경에서 실수로 `LLM_STUB_MODE=true`를 설정하면 모든 LLM 호출이 stub echo로 대체된다. 실제 AI 응답이 `[stub] received: <message>` 형태의 텍스트로 대체되어 서비스 장애에 준하는 영향이 발생한다.
  - 제안: `main.ts`의 OAUTH_STUB_MODE 가드 바로 아래에 동일 패턴으로 추가:
    ```ts
    if (process.env.NODE_ENV === 'production' && process.env.LLM_STUB_MODE === 'true') {
      throw new Error('LLM_STUB_MODE=true is not allowed when NODE_ENV=production');
    }
    ```

- **[INFO]** stub 캐싱 — `clientCache`에 stub을 저장
  - 위치: `llm.service.ts` line 83
  - 상세: `LLM_STUB_MODE=true`일 때 stub 인스턴스가 `clientCache.set(config.id, stub)`으로 캐시된다. `clearClientCache(configId)`가 호출되면 stub이 캐시에서 제거되고 다음 `createClient` 호출 시 새 stub 인스턴스가 생성된다. 이는 기존 캐시 무효화 로직(llm-config 업데이트/삭제 핸들러)과 충돌 없이 동작하므로 의도된 동작.
  - 제안: 없음

- **[INFO]** stub 사용 시에도 `usageLogService.record` 호출됨
  - 위치: `llm.service.ts` line 140
  - 상세: `chat()` 경로에서 stub이 반환한 `usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }`가 그대로 `usageLogService.record`에 전달된다. e2e DB에 stub usage row가 기록되며, 이는 테스트 실행 후 DB 상태를 확인할 때 의도하지 않은 usage 데이터가 존재할 수 있음을 의미한다. fire-and-forget이므로 결과에 영향은 없으나, usage log를 검증하는 테스트가 있다면 의도하지 않은 데이터와 충돌 가능.
  - 제안: 현재 e2e가 usage log를 검증하지 않으므로 허용. 필요 시 stub에 zero usage를 반환하거나 stub 경로에서 usage 기록을 건너뛰는 방식 고려.

- **[INFO]** `withRetry` 는 stub 경로에서도 실행됨 (디폴트 경로)
  - 위치: `llm.service.ts` line 319-321
  - 상세: `chat()`이 `disableInnerRetry` 없이 호출되면 `this.withRetry(run)`이 실행된다. stub은 절대 throw하지 않으므로 retry 로직이 실제로 동작하지 않는다. 불필요한 wrapper call 비용만 발생하며 실제 부작용 없음.
  - 제안: 없음

---

### 파일 3: execution-park-resume.e2e-spec.ts (변경)

- **[WARNING]** `JWT_SECRET` 하드코딩 fallback이 소스에 노출
  - 위치: line 265-266 (describe 블록 내 `const JWT_SECRET = process.env.JWT_SECRET ?? 'clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7'`)
  - 상세: 해당 값은 `docker-compose.e2e.yml`에도 동일하게 하드코딩되어 있고(line 1827), 주석에 "repo에 공개됨"이라고 명시되어 있다. 테스트 전용 시크릿이며 `INTERACTION_JWT_SECRET` 또는 `JWT_SECRET`이 별도 설정되어 있지 않을 때에만 사용된다. e2e 컨텍스트에서의 의도적 패턴이므로 보안 위험보다는 문서적 위험. 그러나 미래에 이 값이 실수로 운영에 사용되는 것을 방지하기 위해 `do-not-use-in-prod` 명명은 충분하다.
  - 제안: 현 패턴 유지. 이미 OAUTH 시크릿과 동일 패턴으로 관리되고 있음.

- **[INFO]** DB 직접 INSERT (`llm_config` 테이블) — 암호화 경로 우회
  - 위치: line 428-433
  - 상세: e2e에서 `POST /api/llm-configs` 대신 `db.query(INSERT INTO llm_config ...)`로 행을 직접 삽입한다. 주석에 e2e ENCRYPTION_KEY 포맷 불일치(`hex 64자` vs `utf8 32B`) 문제를 우회하기 위함이라고 명시되어 있다. `LLM_STUB_MODE=true`에서 `createClient`는 API key 복호화 이전에 stub을 반환하므로 실제 API key 값은 무관하다. 의도된 우회이며 테스트 환경 내에서 자기 완결적.
  - 제안: 없음. 다만 `'stub-not-used'`가 실제 유효한 암호화 문자열이 아니므로 stub 모드 해제 시 즉시 decryption 오류가 발생해 실수 방지 역할을 한다.

- **[INFO]** `waitForUserTurn` 폴링 — DB 직접 읽기 부작용
  - 위치: line 389-404
  - 상세: `conversation_thread` JSONB를 DB에서 직접 읽는 방식은 API 경유 대신 DB에 강결합된다. 테이블/컬럼명 변경 시 e2e가 함께 깨진다. 그러나 이는 e2e 설계 선택이며, 부작용(Side Effect) 관점에서 외부 상태를 변경하지 않는 읽기 전용 쿼리이므로 부작용 없음.
  - 제안: 없음

- **[INFO]** `authHeader()` 함수가 두 `describe` 블록에 중복 선언
  - 위치: PR-B1 describe line 117, PR-B2a describe line 697
  - 상세: 각 `describe` 스코프 내 함수 선언이므로 서로 다른 클로저를 캡처한다. 의도된 분리이며 전역 상태 없음.
  - 제안: 없음

---

### 파일 4: docker-compose.e2e.yml (변경)

- **[INFO]** `LLM_STUB_MODE: "true"` 추가 — `backend-e2e` 서비스에만 적용
  - 위치: line 143
  - 상세: `backend-e2e-runner` 서비스에는 `LLM_STUB_MODE`가 주입되지 않는다. runner는 테스트 코드를 실행하는 컨테이너이며 `process.env.LLM_STUB_MODE`를 읽지 않으므로 영향 없음. 환경변수가 실제로 stub 경로를 활성화하는 `backend-e2e` 서비스에만 적절히 적용됨.
  - 제안: 없음

- **[INFO]** image 공유 정책과 stub 충돌 가능성 (헤더 주석 참조)
  - 위치: docker-compose.e2e.yml 헤더 주석 + line 143
  - 상세: `clemvion-e2e/backend:latest` image는 모든 worktree가 공유한다. 그러나 `LLM_STUB_MODE`는 image 빌드 ARG가 아닌 runtime env이므로, 서로 다른 worktree의 compose가 같은 image를 쓰더라도 runtime env 설정은 각 컨테이너별로 독립적이다. 기존 주석에 설명된 image 공유 트레이드오프와 동일 범주.
  - 제안: 없음

---

## 요약

이번 변경의 핵심은 `LLM_STUB_MODE` env-gated stub 패턴을 `OAUTH_STUB_MODE` 선례에 맞게 추가한 것이다. `StubLlmClient` 자체는 완전히 stateless하며 외부 I/O가 없어 부작용이 없다. 가장 주목할 부작용 위험은 `LLM_STUB_MODE=true`를 production에서 실수로 설정했을 때 모든 LLM 응답이 stub echo로 대체되는 것인데, `OAUTH_STUB_MODE`와 달리 `main.ts`에 fail-closed production guard가 없다. 이 점이 유일한 실질적 위험(WARNING)으로, 선례 패턴의 일관성을 위해 보완이 권장된다. e2e 테스트 코드는 DB 직접 INSERT와 JWT 직접 mint를 의도적으로 사용하며 이는 자기 완결적인 e2e 설계 패턴으로 문제 없다.

## 위험도

LOW

STATUS: SUCCESS
