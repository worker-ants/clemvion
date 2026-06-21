# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `try/catch` 이중 중첩 — 의도는 명확하나 중첩 깊이 소폭 증가
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `requestEmailChange` 메일 발송 실패 처리 블록
- 상세: 메일 발송 실패 시 `clearPendingEmailChange` 롤백을 시도하는 구조가 `try { await mailService... } catch (mailErr) { try { await clearPendingEmailChange... } catch { /* 무시 */ } throw mailErr; }` 형태의 2중 try/catch 로 구현되어 있다. 의도(best-effort 롤백 후 주 오류 rethrow)는 주석으로 잘 설명되어 있고, 기능적으로 올바르다. 그러나 `catch` 안에 다시 `try/catch` 가 들어가는 패턴은 독자가 제어 흐름을 추적하는 데 인지 부담을 줄 수 있다.
- 제안: 현행 구조 유지 허용(주석이 충분히 설명함). 중기적으로 롤백 로직을 `private async tryRollbackPending(userId: string): Promise<void>` 헬퍼로 추출하면 중첩 깊이를 제거하고 `resendEmailChange` 에서도 재사용 가능성이 생긴다.

---

### [INFO] `EMAIL_CHANGE_TTL_MS` 상수 위치 — 모듈 최상단 `const` vs 클래스 멤버
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` L53 (`const EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000`)
- 상세: 상수를 클래스 외부 모듈 스코프에 `const` 로 선언했다. 기존 코드베이스 패턴(`ConfigService` 기반 ENV 변수 또는 클래스 `private readonly` 멤버)과 비교했을 때 일관성 차이가 있을 수 있다. 모듈 스코프 const 는 파일 내 어디서든 읽을 수 있어 범위가 넓고, 테스트에서 모킹이 불가능하다는 특성이 있으나, TTL 같은 하드코딩 시간 상수는 모킹보다 직접 주입 패턴이 더 적합하므로 모듈 스코프 const 가 실용적으로 타당하다. JSDoc 주석(`/** 이메일 변경 토큰 TTL (1시간). requestEmailChange / resendEmailChange 두 곳에서 동일하게 사용. */`)이 잘 작성되어 있어 목적이 명확하다.
- 제안: 현행 구조 수용. 향후 TTL 을 환경별로 다르게 하려면 `ConfigService` 경유로 교체.

---

### [INFO] `logger.warn` 호출 인자 형식 — NestJS Logger 시그니처 불일치 가능성
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `verifyEmailChange` catch 블록 L127-130
- 상세: `this.logger.warn(message, context)` 형태로 호출하고 있다. NestJS `Logger.warn(message, context?)` 의 두 번째 인자는 컨텍스트 문자열(모듈명 등)이다. 현재 코드에서는 두 번째 인자로 `noticeErr instanceof Error ? noticeErr.message : String(noticeErr)` 를 넘기고 있는데, 이는 오류 메시지를 "context" 자리에 넣는 것이다. NestJS Logger 는 `[context]` 를 브라켓으로 출력하므로 로그가 `WARN [SMTP timeout] sendEmailChangedNotice to...` 형태로 출력되어 오류 메시지가 컨텍스트처럼 보일 수 있다. 기존 코드베이스의 다른 `logger.warn` 호출 패턴과 일관성을 확인하는 것이 권장된다.
- 제안: `this.logger.warn(`sendEmailChangedNotice to ${oldEmail} failed — ${...}`, AuthService.name)` 또는 스택 트레이스 포함 시 `this.logger.warn(message, noticeErr instanceof Error ? noticeErr.stack : String(noticeErr))` 형태로 구체화. 현행도 기능 동작에는 문제없음.

---

### [INFO] `makeQb` 헬퍼 함수 반환 타입 — `unknown` 단언 이후 재단언 필요
- 위치: `codebase/backend/src/modules/users/users.service.spec.ts` L435-442 (`makeQb` 함수)
- 상세: `makeQb(count: number): unknown` 으로 반환 타입을 `unknown` 으로 선언한 뒤, 사용 측에서 `makeQb(0) as { where: jest.Mock; andWhere: jest.Mock; getCount: jest.Mock }` 으로 재단언하는 패턴이다. 반환 타입을 처음부터 인터페이스나 타입으로 명시하면 단언 없이 타입 안전하게 사용할 수 있다. 테스트 코드이므로 즉각 수정 필요도는 낮으나, 동일 파일 내에서 타입 단언이 반복된다(L487).
- 제안: ```ts
  interface QueryBuilderMock { where: jest.Mock; andWhere: jest.Mock; getCount: jest.Mock; }
  function makeQb(count: number): QueryBuilderMock { ... }
  ``` 로 변경하면 L487의 재단언 없이 바로 `qb.where` 접근 가능.

---

### [INFO] `isUniqueEmailViolation` 주석 — 기존 리뷰에서 이미 추가됨, 동일 패턴 shared util 여부 미확인
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `isUniqueEmailViolation` L147
- 상세: 이번 changeset 에서 `// 23505 = PostgreSQL unique_violation — email UNIQUE 제약 위반.` 주석이 추가됐다. 이전 RESOLUTION(INFO#18)에서 이미 적용 완료된 항목이다. 기존 코드베이스에 동일 패턴(`code === '23505'`)이 다른 파일에도 존재한다면 공통 util 로 추출 대상이 될 수 있다. 현재는 이 파일에서만 사용되어 수용 가능한 수준이나 추후 중복 시 refactor 권장.
- 제안: 현행 유지. 코드베이스 전역 탐색에서 동일 패턴이 2곳 이상 발견되면 `shared/utils/db-errors.ts` 로 추출 고려.

---

### [INFO] `auth.service.spec.ts` diff 생략 — 테스트 내용 검증 불가
- 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts`
- 상세: 프롬프트에서 파일 1(auth.service.spec.ts)의 diff 가 "diff omitted due to prompt size limit" 으로 생략됐다. 이전 RESOLUTION W1에서 4개 메서드 단위 테스트가 추가됐다고 명시되어 있으나, 현재 changeset 에서 그 테스트 코드의 실제 내용을 직접 검증하지 못했다. 다른 테스트 파일(sessions.service.spec.ts, users.service.spec.ts, mail.service.spec.ts)의 패턴은 적절하게 작성되어 있다.
- 제안: 별도 검증 불필요(단위 테스트 통과 확인됨: 7227 passed).

---

### [INFO] TOCTOU 주석 위치 — 코드와 주석 간격이 있어 연결이 다소 불명확
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` L66-68 (requestEmailChange 내 TOCTOU 주석)
- 상세: TOCTOU 주석이 `// 3) 토큰 발급` 주석 다음, `const rawToken = uuidv4()` 직전에 위치한다. 주석이 설명하는 레이스는 "2) emailTakenByOther 검사 후 이 update 사이에" 이므로 논리적으로는 step 2 와 step 3 사이에 위치해야 적절하다. 현재 위치는 step 3 레이블 주석과 TOCTOU 주석이 섞여 있어 어느 단계를 설명하는지 순간적으로 혼동을 줄 수 있다.
- 제안: TOCTOU 주석을 `emailTakenByOther` 호출 직후(step 2 완료 직후) 또는 `// 3) 토큰 발급` 주석 앞으로 이동해 단계 설명과 레이스 조건 경고를 명확히 분리.

---

## 요약

이번 변경셋은 이전 코드 리뷰(18_29_37) 결과에서 도출된 maintainability 항목(INFO#10 TTL 상수 추출, INFO#17 JSDoc 추가, INFO#18 PostgreSQL 코드 주석)을 모두 반영하여 유지보수성 문제를 잘 해소했다. `EMAIL_CHANGE_TTL_MS` 상수 추출로 두 곳에 반복되던 매직 넘버가 제거됐고, 주요 메서드에 한국어 인라인 주석이 풍부하게 추가됐다. 새로 도입된 유지보수성 관련 사항은 모두 INFO 등급으로, 2중 try/catch 중첩(롤백 패턴), `logger.warn` 두 번째 인자 컨벤션, 테스트 코드의 타입 단언 반복, TOCTOU 주석의 위치 세밀화 등 소규모 개선 여지만 존재한다. CRITICAL 또는 WARNING 수준의 유지보수성 결함은 발견되지 않았다.

## 위험도

LOW

STATUS=success ISSUES=7 PATH=/Volumes/project/private/clemvion/.claude/worktrees/spec-email-change-0fcba4/review/code/2026/06/21/20_21_02/maintainability.md RESET_HINT=
