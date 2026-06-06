# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] 파일 1 — `.env.example`: `LLM_STUB_MODE` 기본값 활성화 (false)
- 위치: `.env.example` line 269 (`LLM_STUB_MODE=false`)
- 상세: `OAUTH_STUB_MODE=false` 와 동일한 패턴으로 `LLM_STUB_MODE=false` 를 주석 없는 라인으로 추가했다. 운영자가 `.env` 에 복사할 때 명시적으로 `false` 로 세팅되므로 실수로 `true` 가 넘어갈 가능성이 없다. `main.ts` 에 `NODE_ENV=production` + `LLM_STUB_MODE=true` 부팅 거부 가드가 이미 존재해 이중 방어가 성립한다. 환경변수를 새로 도입하지만 기본값 `false` + 주석 문서화로 부작용 없음.
- 제안: 이상 없음.

### [INFO] 파일 1 — `.env.example`: `INTERACTION_JWT_SECRET` 주석 처리 유지
- 위치: `.env.example` lines 140-143
- 상세: `INTERACTION_JWT_SECRET` 은 주석으로 남겨 두어 "옵션 설정" 의도를 명확히 했다. `JWT_SECRET` fallback 정책이 `.env.example` 주석 및 `interaction-token.service.ts` 생성자 로직과 일치한다.
- 제안: 이상 없음.

### [INFO] 파일 3 — `execution-engine.service.ts`: `driveResumeDetached` → `driveResumeAwaited` 메서드명 변경
- 위치: `execution-engine.service.ts` — `private async driveResumeAwaited` 선언 및 모든 호출 지점
- 상세: `private` 메서드이므로 외부 공개 API 변경 없음. 호출 지점(`resumeFromCheckpoint` 내 단일 `await this.driveResumeAwaited(...)`)과 테스트 spy (`svcAny.driveResumeAwaited`) 가 일관되게 갱신되어 있다. 동작 시맨틱은 기존 fire-and-forget detach 에서 awaited 로 이미 PR-B3 에서 변경된 것의 이름 정합 패치이므로 런타임 부작용 없음.
- 제안: 이상 없음.

### [INFO] 파일 3 — `execution-engine.service.ts`: `ProcessTurnResult` 타입 alias 도입
- 위치: line 285 `type ProcessTurnResult = void | ParkSignal`
- 상세: 모듈 레벨 `type` alias (non-exported). 전역 상태 변경 없음. `void | ParkSignal` 인라인 혼용을 named alias 로 통일한 순수 타입 리팩토링이므로 런타임 부작용 없음.
- 제안: 이상 없음.

### [WARNING] 파일 4 & 5 — `interaction-token.service.ts` 생성자: `process.env.NODE_ENV` 읽기 + 조건부 throw
- 위치: `interaction-token.service.ts` lines 97-102; 테스트 `interaction-token.service.spec.ts` 신규 `describe` 블록
- 상세: 생성자가 `process.env.NODE_ENV === 'production'` 조건으로 throw 한다. NestJS DI 컨테이너가 `InteractionTokenService` 를 초기화할 때 — 즉 모듈 부팅 시점에 — 생성자 throw 가 전파된다. 이는 의도된 fail-closed 동작이며, 기존 `OAUTH_STUB_MODE` / `LLM_STUB_MODE` 가드(`main.ts`)와 같은 "부팅 거부" 패턴이다. 단, 기존 가드들은 `bootstrap()` 함수 내 명시적 if-throw 블록이라 어디서 throw 되는지 명확한 반면, 이 변경은 **생성자 throw** 라 NestJS `ExceptionFilter` 를 거치지 않고 `NestFactory.create()` 단계에서 원시 `Error` 로 프로세스를 중단시킨다. 운영 환경에서 `JWT_SECRET` 도 없으면 다른 곳에서 먼저 죽으므로 실제 도달 빈도는 낮지만, 생성자 throw 는 테스트에서 직접 `new InteractionTokenService(...)` 호출 시 예상치 못한 throw 를 일으킬 수 있다 — 신규 테스트 블록은 이를 `afterEach` 로 `process.env` 복원하여 처리하고 있으므로 테스트 간 오염은 없다.
- 제안: 현행 구현은 의도에 부합하며 테스트 격리도 올바르다. 다만 향후 테스트 작성자가 `NODE_ENV=production` + secret 미설정 상태로 `new InteractionTokenService(...)` 를 호출하면 의도치 않게 throw 될 수 있음을 문서화하거나 생성자 주석에 명시하는 것이 좋다. 현재 diff 범위 내에서는 결함 없음.

### [INFO] 파일 4 — `interaction-token.service.spec.ts`: `process.env` 직접 변조 + `afterEach` 복원
- 위치: 신규 `describe('constructor — secret 미설정 시 prod fail-closed', ...)` 블록, `afterEach` 참조
- 상세: `OLD_ENV`, `OLD_INT`, `OLD_JWT` 를 `describe` 스코프 상수에 캡처한 뒤 `afterEach` 에서 원상 복원한다. `itk_*` describe 블록과 `iext_*` describe 블록 양쪽에 동일한 패턴이 복제되어 있다. `afterEach` 가 각 블록의 내부에 있으므로 블록 간 공유 오염은 없다. 단, `beforeEach` 시점에 환경변수를 캡처하지 않고 `describe` 실행 시점에 캡처하므로, 만약 해당 `describe` 이전에 실행된 다른 테스트가 `process.env.NODE_ENV` 를 변경한 채 복원하지 않으면 `OLD_ENV` 가 오염값을 포착할 수 있다. 그러나 현재 파일 범위에서는 다른 블록이 `NODE_ENV` 를 변경하지 않으므로 실제 문제 없음.
- 제안: 이상 없음.

### [INFO] 파일 2 — `execution-engine.service.spec.ts`: 주석 내 메서드명 정합 (driveResumeDetached → driveResumeAwaited)
- 위치: 여러 주석 및 spy 선언 (`svcAny.driveResumeAwaited`, `jest.spyOn(svcAny, 'driveResumeAwaited')`)
- 상세: 순수 주석 수정 + spy 대상 문자열 갱신이다. 실제 private 메서드명이 `driveResumeAwaited` 로 변경됐으므로 spy 가 올바른 심볼을 가리킨다. 런타임 부작용 없음.
- 제안: 이상 없음.

## 요약

이번 변경은 (1) `driveResumeDetached` → `driveResumeAwaited` 리네이밍(private 메서드, 외부 시그니처 영향 없음), (2) `ProcessTurnResult` 타입 alias 도입(순수 타입, 런타임 영향 없음), (3) `LLM_STUB_MODE` 환경변수 추가(`.env.example` 기본값 `false`, main.ts 부팅 가드 존재), (4) `InteractionTokenService` 생성자 fail-closed 강화(production + secret 전무 시 throw, dev/test 는 기존 fallback 유지)로 구성된다. 전역 상태 변경, 의도치 않은 파일시스템 부작용, 공개 API 변경, 외부 네트워크 호출 추가는 없다. `InteractionTokenService` 생성자 throw 는 의도된 보안 강화이며 테스트 격리가 `afterEach` 로 올바르게 처리되어 있다. 주의점은 production 환경에서 `JWT_SECRET` 도 미설정인 드문 경우 DI 컨테이너 초기화 단계에서 원시 오류로 프로세스가 중단된다는 점이나, 이는 의도된 동작이다.

## 위험도

LOW
