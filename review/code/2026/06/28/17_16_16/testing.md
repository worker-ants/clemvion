# 테스트(Testing) 리뷰 결과

리뷰 대상: webhook 하드닝 후속 — RESOLUTION 반영 코드 (17_16_16)
리뷰 일시: 2026-06-28
대상 파일: http-exception.filter.spec.ts, http-exception.filter.ts, client-ip.spec.ts, public-webhook-throttle.guard.spec.ts, public-webhook-throttle.guard.ts

---

## 발견사항

### [INFO] `http-exception.filter.spec.ts` — 비-413 4xx 테스트 추가 확인 (WARNING 해소)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.spec.ts` L65–82
- 상세: 이전 리뷰(17_00_25)의 W1(테스트 커버리지 갭)에서 요청된 비-413 4xx 분기 테스트가 정상 추가됐다. `{ status: 400 }` HttpErrorLike 를 `catch()` 에 전달해 `body.error.message === 'The request could not be processed.'` + `VALIDATION_ERROR` 코드 + `logger.warn` 원문 포함 호출을 단언한다. 세 가지 단언을 하나의 케이스에 묶은 구조는 목적이 명확해 가독성이 좋다.
- 제안: 해당 없음. WARNING 해소 완료.

### [INFO] `http-exception.filter.spec.ts` — logger.warn spy 패턴 적절성
- 위치: `http-exception.filter.spec.ts` L66–81
- 상세: `jest.spyOn(Logger.prototype, 'warn').mockImplementation()` + `warn.mockRestore()` 패턴을 사용한다. prototype spy 는 동일 describe 블록 내 다른 테스트에도 영향을 줄 수 있으나, `mockRestore()` 가 테스트 말미에 명시적으로 호출되므로 격리는 유지된다. 단, 테스트 실행 중 예외가 발생하면 `mockRestore()` 가 호출되지 않아 spy 가 남을 수 있다. `afterEach` 후크나 `try/finally` 블록이 아닌 테스트 끝에 위치하므로 잠재적 격리 취약점이 존재한다.
- 제안: guard spec 의 `errorLog.mockRestore()` 도 동일 패턴으로 일관성은 갖췄다. 장기적으로 `afterEach` 패턴으로 통일하는 것이 테스트 격리 강건성을 높이지만 현재 수준에서는 INFO.

### [INFO] `public-webhook-throttle.guard.spec.ts` — fail-open logger.error 호출 단언 추가 확인 (I16 해소)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts` L221–231
- 상세: 이전 리뷰 I16 에서 요청된 `logger.error` 호출 단언이 추가됐다. `jest.spyOn(Logger.prototype, 'error').mockImplementation()` 으로 spy 주입 후 `expect(errorLog).toHaveBeenCalledTimes(1)` 로 정확히 1회 호출을 검증한다. 호출 횟수를 1로 고정한 단언이므로 불필요한 다중 로깅 회귀도 탐지 가능하다.
- 제안: 호출 인수(`stringContaining` 등)까지 단언하면 로그 내용 변경을 추가로 고정할 수 있으나, 현 수준도 충분하다.

### [INFO] `client-ip.spec.ts` — 새 케이스의 afterEach 스코프 불일치 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/auth/utils/client-ip.spec.ts` L43–55
- 상세: 신규 두 케이스는 `describe('extractClientIpFromHeaders')` 블록 바깥에 위치한다(L43–55 기준). 해당 describe 블록의 `afterEach` (L388 경 `extractClientIp` describe 내) 는 이 케이스들에 적용되지 않는다. 첫 번째 케이스(`empty/whitespace cf-connecting-ip → falls back to XFF`)는 `process.env.TRUST_CF_CONNECTING_IP = 'true'` 를 설정하고 복원하지 않는다. 두 번째 케이스(`whitespace-only XFF → null`)는 env 를 직접 설정하지 않지만 실행 순서에 따라 첫 케이스의 잔류 env(`TRUST_CF_CONNECTING_IP=true`)를 이어받을 수 있다.
  - 실제 파일 확인 결과, 두 케이스는 `extractClientIpFromHeaders` describe 의 마지막에 추가된 구조이므로 describe 수준 `afterEach` 가 있다면 커버될 수 있다. 그러나 L43 케이스에 `afterEach` 없이 env 를 설정하는 구조는 잠재적 격리 취약점이다.
- 제안: 첫 번째 케이스(`CF on`)에 대해 해당 `it` 블록 내부에 `try/finally` 로 env 를 복원하거나, 두 케이스를 별도 describe 로 감싸고 `afterEach` 를 명시한다. 또는 두 번째 케이스 첫 줄에 `delete process.env.TRUST_CF_CONNECTING_IP` 를 명시적으로 추가해 자기완결성 강화.

### [INFO] `http-exception.filter.spec.ts` — 413 케이스 requestId 단언 누락
- 위치: `http-exception.filter.spec.ts` L57–62
- 상세: 신규 추가된 비-413 케이스에는 `requestId` 단언이 없으나, 기존 413 케이스(PayloadTooLargeException)에는 `expect(body.error.requestId).toBeDefined()` 가 있다. 비-413 케이스도 동일 GlobalExceptionFilter 경로를 거치므로 `requestId` 가 응답에 포함되는지 검증하는 것이 일관성에 기여한다. 현재는 INFO 수준.
- 제안: 비-413 4xx 케이스에 `expect(body.error.requestId).toBeDefined()` 단언 추가 고려.

### [INFO] `public-webhook-throttle.guard.spec.ts` — extractClientIp 이관 후 Guard 통합 테스트 커버리지 유지 확인
- 위치: `public-webhook-throttle.guard.spec.ts` — CF/XFF 통합 케이스 유지
- 상세: 삭제된 4건의 `extractClientIp` 직접 단위 테스트 중 "XFF 다중 IP 첫 번째", "헤더 모두 없음 → undefined" 는 `extractClientIpFromHeaders` describe 에 기존 커버리지로 이미 존재. "CF off 상태 XFF 폴백", "공백 XFF → null" 2건은 신규로 `client-ip.spec.ts` 에 추가. Guard 수준 통합 케이스(CF 우선·XFF 폴백)는 유지되어 기능 회귀 방지가 적절하다.
- 제안: 해당 없음.

---

## 요약

이번 변경은 이전 리뷰(17_00_25)의 테스트 관련 WARNING(W1: 비-413 4xx 분기 미검증)과 INFO(I15: logger.warn 호출 미검증, I16: logger.error 호출 미검증)를 모두 해소했다. 비-413 4xx 케이스 추가, logger spy 주입 단언, fail-open logger.error 1회 단언이 정확하게 구현됐으며, extractClientIp 테스트 이관은 사본 drift 를 제거하는 올바른 방향이다. 잔여 주의 사항으로, client-ip.spec.ts 신규 케이스의 env 복원이 afterEach 스코프 밖에 위치해 격리 취약점이 있고, logger spy 의 mockRestore() 가 테스트 말미 위치로 예외 시 잔류 가능성이 있다. 두 항목 모두 INFO 수준이며 즉각적인 차단 사유는 없다.

---

## 위험도

LOW

---

STATUS: PASS
