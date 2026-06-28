# 유지보수성(Maintainability) 리뷰 결과

검토 일시: 2026-06-28
대상 파일: 13개 (codebase 5개 + review/consistency 8개)

---

## 발견사항

### [INFO] `http-exception.filter.ts` — status 코드 하드코딩(매직 넘버)
- 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` L306 (`mapHttpErrorLike`)
- 상세: `errStatus === 413` 조건에서 숫자 `413`을 인라인으로 사용한다. `getCodeFromStatus`에는 이미 같은 상수가 switch case로 존재하며, 클래스 바깥의 `HttpStatus.PAYLOAD_TOO_LARGE` NestJS 상수를 쓸 수 있다. 현재 의미는 주석으로 충분히 보완되어 있으나, 향후 상태코드 분기가 추가될 경우 숫자 리터럴이 proliferate할 위험이 있다.
- 제안: `errStatus === HttpStatus.PAYLOAD_TOO_LARGE` 로 교체하거나, 별도 `STATUS_MESSAGES` 맵을 두어 상태코드 → 메시지를 선언적으로 관리. 현 스케일에서는 INFO 수준이나, 상태코드 분기가 2개를 초과하면 맵 패턴으로 전환 권장.

---

### [INFO] `http-exception.filter.ts` — 기본 메시지 문자열 중복
- 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` L225, L271
- 상세: `'An unexpected error occurred'`(L225)와 `'An unexpected error occurred. Please try again later.'`(L271) 두 문자열이 논리적으로 같은 의도를 전달하면서 미세하게 다르다. 하나는 초기화 기본값이고 다른 하나는 catch 이후 재할당이라 결국 후자가 사용되지만, 동일 의미의 두 리터럴이 클래스에 흩어져 있으면 향후 문구 변경 시 하나를 놓칠 수 있다.
- 제안: 클래스 최상단에 `private static readonly DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred. Please try again later.'` 상수를 두고 두 위치 모두에서 참조.

---

### [INFO] `public-webhook-throttle.guard.ts` — 인라인 타입 캐스트 반복
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L1052–1058 (`canActivate` 메서드 내 `getRequest<{...}>` 인라인 타입)
- 상세: `getRequest<{ params?:...; headers?:...; body?:...; rawBody?:...; __publicWebhookTrigger?:... }>()` 인라인 익명 타입이 메서드 시그니처 안에 직접 기술되어 있다. 동일 형태가 테스트 파일의 `ReqShape` 인터페이스(별도 export)와 사실상 같은 구조를 중복 정의하고 있다. 향후 필드 추가 시 두 곳을 동기화해야 한다.
- 제안: `public-webhook-throttle.guard.ts` 파일 내에 named interface를 두고 `getRequest<PublicWebhookReqShape>()` 형태로 사용. 테스트의 `ReqShape`는 그 interface를 import하거나 extends하도록 통합.

---

### [INFO] `public-webhook-throttle.guard.spec.ts` — env 복원 패턴 두 가지 혼용
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts` L801–823, L826–847 (CF 관련 테스트)
- 상세: `extractClientIpFromHeaders` describe 블록은 `afterEach`로 env를 복원하는 반면, guard 스펙의 CF 테스트 두 건은 `try/finally`로 직접 복원한다. 두 패턴이 동일 목적(env 복원)에 대해 혼용되어 코드베이스 일관성이 낮다. `afterEach` 블록이 이미 `extractClientIp` describe에 선언되어 있으므로 guard describe에도 `afterEach` 패턴을 쓰는 것이 더 자연스럽다.
- 제안: guard spec의 CF 테스트도 describe 수준의 `beforeEach`/`afterEach` 패턴으로 통일. try/finally 복원은 describe가 분리되어 있을 때 구조 제약이 있는 경우에만 사용.

---

### [INFO] `client-ip.spec.ts` — 신규 테스트에서 env 설정 후 afterEach 의존 범위
- 위치: `codebase/backend/src/modules/auth/utils/client-ip.spec.ts` L420–432 (신규 추가 두 테스트)
- 상세: `'empty/whitespace cf-connecting-ip → falls back to XFF (CF on)'` 테스트는 `process.env.TRUST_CF_CONNECTING_IP = 'true'`를 설정하고 `afterEach`에서 복원에 의존한다. `'whitespace-only XFF → null'` 테스트는 env를 설정하지 않지만 실행 순서에 따라 앞 테스트 상태가 남아있을 경우 영향을 받을 수 있다. 현재 `afterEach`가 선언되어 있어 실제 버그는 아니나, 테스트 의존성이 순서에 영향받는 구조가 잠재적으로 취약하다.
- 제안: 두 번째 신규 테스트 `'whitespace-only XFF → null'` 에도 명시적으로 `delete process.env.TRUST_CF_CONNECTING_IP`를 추가해 자기완결성 강화.

---

### [INFO] `public-webhook-throttle.guard.spec.ts` — 삭제된 `extractClientIp` 테스트를 대체하는 이관 주석의 위치 중복
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts` L621, L898–899
- 상세: 이관 사실을 설명하는 주석 블록이 두 곳에 나타난다 (삭제된 코드 위치 L621과 섹션 구분자 L898). 동일 메모가 두 위치에 존재해 미래에 어느 쪽이 canonical인지 혼동할 수 있다.
- 제안: 두 주석 중 하나(섹션 구분자 부근 L898 위치)만 남기고 나머지는 제거.

---

### [INFO] consistency review 파일들 — `_retry_state.json` 내 절대 경로 하드코딩
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/review/consistency/2026/06/28/16_50_18/_retry_state.json`
- 상세: `session_dir`, `prompt_file`, `output_file` 등 모든 경로가 로컬 worktree 절대 경로로 하드코딩되어 있다. 이 파일은 오케스트레이터가 생성하는 런타임 상태 파일이므로 코드 품질 관점에서 직접 수정 대상은 아니나, 다른 환경(CI, 다른 개발자 머신)에서 재현이 불가능한 구조다.
- 제안: 오케스트레이터 생성 로직에서 절대 경로 대신 `session_dir` 기준 상대 경로를 쓰도록 개선 고려. 현재 리뷰 범위에서는 INFO만 기록.

---

## 요약

이번 변경의 핵심인 `http-exception.filter.ts`의 CWE-209 대응(내부 메시지 노출 차단)과 `public-webhook-throttle.guard.ts`의 `extractClientIp` 제거·공유 코어 위임은 책임 분리와 중복 코드 제거 측면에서 유지보수성을 개선한 바람직한 변경이다. 테스트 파일(`client-ip.spec.ts`, `public-webhook-throttle.guard.spec.ts`)도 대체로 가독성이 높고 테스트 의도가 명확하다. 다만 소수의 개선점이 있다: `mapHttpErrorLike`의 `413` 매직 넘버, 기본 에러 메시지 문자열 두 버전 공존, guard req 인라인 익명 타입과 테스트 `ReqShape` 간 구조 중복, env 복원 패턴의 `afterEach` vs `try/finally` 혼용, 이관 주석의 위치 중복. 이 항목들은 모두 INFO 수준으로 즉각적인 버그 위험은 없으나 코드베이스가 커질수록 유지보수 비용을 높이는 요인이 될 수 있다.

---

## 위험도

LOW

---

STATUS: PASS
