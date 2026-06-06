# 보안(Security) 리뷰 결과

## 발견사항

### 파일 1: codebase/backend/.env.example

- **[INFO]** `LLM_STUB_MODE` 기본값이 `false`로 올바르게 설정되어 있고, production 부팅 가드 언급이 명확함.
  - 위치: 라인 265-269 (`LLM_STUB_MODE=false` 추가 블록)
  - 상세: `OAUTH_STUB_MODE` 패턴을 그대로 따라 `!! Boot fails if NODE_ENV=production AND LLM_STUB_MODE=true. !!` 경고가 명시되어 있음. 실제 부팅 가드가 서비스 레이어에서 강제된다는 전제 하에 문서 측면에서 문제 없음.
  - 제안: 없음 (적절히 처리됨).

- **[INFO]** `INTERACTION_JWT_SECRET` 는 주석 처리(비활성)로 추가되어 있고, 설명에 production 필수 설정 안내가 포함됨.
  - 위치: 라인 140-143
  - 상세: 미설정 시 `JWT_SECRET` fallback 동작이 설명되어 있으며, 프로덕션 필수 설정 안내가 명확함. 새 코드(interaction-token.service.ts)에서 production fail-closed 가드가 추가되어 문서와 구현이 일치함.
  - 제안: 없음.

- **[WARNING]** `ENCRYPTION_KEY` 가 실제 16진수 값(`0123456789abcdef...`)으로 기본값에 설정되어 있음.
  - 위치: 라인 198 (`ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`)
  - 상세: 이 항목은 이번 diff의 변경사항이 아니지만, 사전 정의된 "예시" 값이 실제 키처럼 보일 위험이 있음. `change-me-*` 형식이 아니라 실제 16진수 값이 기본으로 적혀 있어 개발자가 이를 그대로 복사해 사용할 경우 위험. 현재 diff 범위 외 사항이므로 INFO 수준으로 처리.
  - 제안: `ENCRYPTION_KEY=change-me-64-hex-chars` 같은 placeholder로 변경하거나, 주석으로 "절대 운영 그대로 사용 금지" 강조 추가를 권고.

---

### 파일 2: codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts

- **[INFO]** 변경 내용은 `driveResumeDetached` → `driveResumeAwaited` 함수명 변경에 따른 테스트 주석·spy 참조 업데이트 전용.
  - 위치: diff 전체
  - 상세: 순수 명칭 변경(리팩터링) — 보안 관련 로직 변경 없음. 테스트 mock 데이터는 하드코딩된 시크릿이나 실제 자격증명 없이 `'exec-1'`, `'workflow-1'` 같은 비민감 픽스처만 사용.
  - 제안: 없음.

---

### 파일 3: codebase/backend/src/modules/execution-engine/execution-engine.service.ts

- **[INFO]** `driveResumeDetached` → `driveResumeAwaited` 리팩터링 + `ProcessTurnResult` named alias 추가.
  - 위치: diff 전체
  - 상세: 보안 관련 로직 변경 없음. `ProcessTurnResult = void | ParkSignal` alias 는 타입 안전성을 높이는 변경으로 보안에 긍정적 영향. 인가·인증·입력 검증·에러 처리 로직 변경 없음.
  - 제안: 없음.

---

### 파일 4: codebase/backend/src/modules/external-interaction/interaction-token.service.spec.ts

- **[INFO]** production fail-closed 테스트 추가 — 보안을 강화하는 긍정적 변경.
  - 위치: 라인 430-476 (`constructor — secret 미설정 시 prod fail-closed` describe 블록)
  - 상세: `NODE_ENV=production + secret 전무 → throw` 케이스와 `NODE_ENV!=production + secret 전무 → no throw` 케이스를 모두 검증. `afterEach` 에서 `process.env` 원상복구로 테스트 오염 방지도 올바르게 구현됨.
  - 제안: 없음.

- **[INFO]** 테스트 내 `TEST_SECRET = 'unit-test-secret-must-be-long-enough-32b'` 는 테스트 전용이며, 실제 코드/환경설정 파일에 유출되지 않음.
  - 위치: 라인 1978
  - 상세: 단위 테스트 픽스처이므로 위험 없음.
  - 제안: 없음.

---

### 파일 5: codebase/backend/src/modules/external-interaction/interaction-token.service.ts

- **[INFO]** production fail-closed 가드 추가 — 보안을 개선하는 긍정적 변경.
  - 위치: `constructor` 내 `if (!envSecret)` 블록 (라인 91~103 상당)
  - 상세: `NODE_ENV=production` 환경에서 JWT secret 미설정 시 즉시 `throw`하여 서버 부팅 자체를 차단. 이는 기존 warn 후 weak fallback(`'interaction-fallback'`) 서명을 허용하던 것보다 명백히 안전함.
  - 제안: 없음.

- **[WARNING]** `dev/test` 환경에서는 여전히 `'interaction-fallback'` 고정 문자열로 JWT 서명 가능 (`this.secret = envSecret ?? 'interaction-fallback'`).
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-polish-080a4d/codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — `this.secret = envSecret ?? 'interaction-fallback'` 라인
  - 상세: dev/test 환경에서 환경변수가 없으면 `'interaction-fallback'`이라는 공개적으로 알려진 문자열로 JWT를 서명한다. 이 토큰을 알고 있는 누구나 동일 dev 인스턴스에 유효한 JWT를 위조할 수 있음. 이 변경 자체가 이 동작을 도입한 것은 아니지만 (기존부터 존재), 이번 PR에서 warn 메시지를 "dev 전용 비보안 fallback"으로 더 명시했으므로 언급.
  - 제안: dev/test 전용 격리 환경이라면 허용 가능. 단, dev 서버가 외부에 노출될 경우(터널링, ngrok 등) 실제 위험이 됨. 보안 강화를 원한다면 dev도 warn에서 임의 생성 secret(부팅 시 randomBytes)으로 대체하는 방안 검토 권고.

- **[INFO]** Redis 미가용 시 blacklist 검사 fail-open 정책은 의도된 것으로 문서화되어 있음.
  - 위치: 클래스 주석 및 `verifyPerExecution` 내부
  - 상세: 단명 토큰(기본 1h)이므로 Redis 단기 장애 시 위험 제한적. 보안 트레이드오프가 문서에 명시되어 있으므로 위험 인식이 있음.
  - 제안: 없음 (현재 아키텍처 결정 존중).

---

## 요약

이번 변경은 주로 `driveResumeDetached` → `driveResumeAwaited` 내부 메서드 리네이밍(보안 중립)과 `InteractionTokenService` 생성자의 production fail-closed 가드 추가로 구성된다. 보안 관점에서 production 환경에서 JWT secret 미설정 시 서버 부팅을 차단하는 가드가 추가된 점은 명백한 보안 개선이다. 신규 인젝션 취약점, 하드코딩 시크릿, 인가 우회, 암호화 약화, 민감 정보 에러 노출 등의 이슈는 발견되지 않았다. 하나의 경미한 경고 사항(`dev/test` 환경의 known-string fallback secret)은 기존 동작의 유지이며 신규 도입이 아니다. `.env.example`의 `ENCRYPTION_KEY` 기본값 설정 방식(실제 16진수 값)은 이번 변경 범위 밖이지만 장기적으로 개선 검토를 권장한다.

## 위험도

LOW
