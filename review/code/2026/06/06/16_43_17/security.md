# Security Review — 2026/06/06 16:43:17

## 발견사항

### 파일 1: execution-engine.service.spec.ts (테스트 파일 신규 추가)

- **[INFO]** `as unknown as` 캐스팅으로 private 메서드에 직접 접근
  - 위치: 전반적인 테스트 코드 (`FormResumeSubject`, `DriveW3Subject`, `W5Subject` 등)
  - 상세: TypeScript private 접근 제어를 우회해 내부 구현 세부사항을 직접 테스트한다. 보안 취약점은 아니지만, 내부 API 변경 시 테스트가 조용히 깨지거나 캐스팅이 잘못된 타입으로 실제 취약점을 숨길 수 있다.
  - 제안: 이는 단위 테스트의 표준 패턴으로 수용 가능. 다만 `FormResumeSubject` 같은 헬퍼 타입을 별도 파일로 분리해 재사용성을 높이면 캐스팅 오류 가능성이 낮아진다.

- **[INFO]** 테스트 픽스처에 평문 더미 데이터 사용
  - 위치: `{ answer: 'yes' }`, `{ answer: 'raw-no-sentinel' }` 등 폼 데이터 값
  - 상세: 모두 더미 테스트 값이며 실제 민감 정보(API 키, 비밀번호, 토큰 등)가 하드코딩되지 않았다. `triggerId: 'trg-w5-spy'` 같은 값도 더미 식별자로 실제 시크릿이 아니다.
  - 제안: 현재 상태 적절.

- **[INFO]** `ConfigService` mock에서 `get: jest.fn().mockReturnValue(undefined)` 패턴
  - 위치: 여러 `describe` 블록의 `beforeEach` (예: line 176)
  - 상세: 테스트 내 ConfigService를 undefined 반환으로 mock하여 실제 환경 변수나 설정값이 테스트 코드에 주입되지 않는다. 의도적이고 올바른 패턴.
  - 제안: 현재 상태 적절.

### 파일 2: execution-engine.service.ts (프로덕션 코드 변경)

- **[INFO]** 에러 메시지에 `executionId`와 에러 메시지 포함
  - 위치: diff `-2899` ~ `+2913`의 `failFirstSegmentSetup` catch 블록
  - 상세: `secondaryErr instanceof Error ? secondaryErr.message : String(secondaryErr)` 패턴으로 에러를 로그에 기록한다. `executionId`(내부 UUID)와 에러 메시지가 서버 로그에 기록되는 것은 내부 모니터링 목적으로 표준적이다. 단, 에러 메시지가 사용자에게 직접 노출되지 않는 서버사이드 로그에만 기록되므로 정보 노출 위험은 없다.
  - 제안: 현재 패턴 적절. 단, 향후 에러 메시지에 PII나 민감 데이터가 포함될 수 있는 경로를 주의한다.

- **[INFO]** `failFirstSegmentSetup` 2차 실패 silencing
  - 위치: `runExecutionFromQueue` catch 블록의 `.catch(secondaryErr => this.logger.error(...))`
  - 상세: 2차 실패를 BullMQ worker로 전파하지 않고 `logger.error`로만 흡수한다. 이는 보안적으로 double-execution 방지라는 올바른 설계이며, 에러 정보가 외부로 노출되지 않는다.
  - 제안: 현재 상태 적절.

### 파일 3: plan/in-progress/exec-park-durable-resume.md

- **[INFO]** Plan 문서에 내부 commit hash, worktree ID 등 포함
  - 위치: 전반 (예: `commit 2dbb31b6`, `branch claude/exec-park-b2b-04a2f8`)
  - 상세: 내부 개발 추적 정보(commit hash, branch 이름)가 plan 문서에 기록되어 있다. 이는 내부 개발 문서로 보안 민감 정보가 아니다. API 키, 비밀번호, 토큰, 인증서 등의 시크릿은 없다.
  - 제안: 현재 상태 적절.

- **[INFO]** `e2e ENCRYPTION_KEY` 언급
  - 위치: `PR-B2a follow-up` 항목 ("LLM_STUB_MODE 문서화·EIA §8.3·doc-sync·e2e ENCRYPTION_KEY")
  - 상세: "e2e ENCRYPTION_KEY"가 follow-up 항목으로 언급만 되어 있고 실제 키 값은 없다. e2e 테스트 환경 변수 처리가 미완료 상태임을 나타내는 TODO 성격.
  - 제안: 해당 follow-up 완료 시 ENCRYPTION_KEY가 코드나 plan 문서에 평문으로 기록되지 않도록 환경 변수 또는 시크릿 관리 도구를 사용해야 한다.

### 파일 4: review/code/.../RESOLUTION.md

- **[INFO]** 리뷰 산출물 문서, 보안 민감 정보 없음
  - 상세: RESOLUTION.md는 순수 개발 메타 문서(조치 내역 추적)이며 하드코딩된 시크릿, 인증 정보, 민감 데이터 없음.

---

## 요약

이번 변경은 실행 엔진(execution engine)의 park/resume 아키텍처 리팩터링(in-memory 코루틴 제거, durable rehydration 일원화)을 위한 테스트 보강(spec.ts)과 프로덕션 코드 에러 처리 개선(service.ts), 그리고 계획 문서 및 리뷰 산출물 업데이트로 구성된다. 보안 관점에서 하드코딩된 시크릿, SQL/명령 인젝션, 인증 우회, 안전하지 않은 암호화, 직접적인 민감 정보 노출 등 OWASP Top 10 해당 취약점은 발견되지 않았다. 테스트 코드의 `as unknown as` TypeScript 캐스팅 패턴은 private 접근 제어 우회이나 테스트 관용구로 수용 가능하며, `failFirstSegmentSetup` 2차 실패를 logger.error로 silencing하는 패턴은 BullMQ 이중 재시도 방지를 위한 의도적 설계로 타당하다. `e2e ENCRYPTION_KEY` follow-up 항목은 향후 구현 시 키 값이 코드나 문서에 평문으로 노출되지 않도록 주의가 필요하다.

## 위험도

NONE
