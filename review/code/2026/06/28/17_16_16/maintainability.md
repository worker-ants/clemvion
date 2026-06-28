# 유지보수성(Maintainability) 리뷰 결과

검토 일시: 2026-06-28
대상 파일: 5개 코드 파일 (codebase/backend) + review 산출물

---

## 발견사항

### [INFO] `http-exception.filter.ts` — 매직 넘버 `413` 인라인 사용
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.ts` L119 (`mapHttpErrorLike`)
- 상세: `errStatus === 413` 조건에서 숫자 리터럴 `413`을 직접 사용한다. `HttpStatus.PAYLOAD_TOO_LARGE`(NestJS 상수)가 이미 import 되어 있으므로 상수 치환이 자연스럽다. 주석에 `no-unsafe-enum-comparison` 회피 이유가 설명되어 있어 현재는 혼동이 없으나, 상태 코드 분기가 추가될 경우 숫자 리터럴 증가로 이어질 수 있다. `getCodeFromStatus` switch 내부도 숫자 리터럴 case 를 사용하므로 패턴이 충돌하지는 않는다.
- 제안: lint 규칙 충돌이 실제로 해소되지 않는다면 현행 유지 + 주석으로 충분. 해소된다면 `HttpStatus.PAYLOAD_TOO_LARGE`로 교체. 분기가 2개를 초과하면 `STATUS_MESSAGES: Partial<Record<number, string>>` 맵으로 선언적 관리 권장.

---

### [INFO] `http-exception.filter.ts` — 기본 에러 메시지 문자열 두 버전 공존
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.ts` L36(`'An unexpected error occurred'`), L82(`'An unexpected error occurred. Please try again later.'`)
- 상세: 두 문자열이 동일한 의미를 전달하면서 내용이 미세하게 다르다. L36은 초기화 기본값이고 L82는 `else` 분기에서 재할당되어 최종적으로는 후자만 클라이언트에 노출된다. 그러나 두 리터럴이 클래스 내에 흩어져 있으면 향후 메시지 문구 변경 시 하나를 놓칠 수 있다. 현재는 죽은 코드(L36 값이 외부로 노출되는 경로 없음)에 가까워 버그 가능성은 낮다.
- 제안: 클래스 최상단에 `private static readonly DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred. Please try again later.'` 상수를 선언하고, L36과 L82 두 위치 모두에서 참조하도록 리팩터.

---

### [INFO] `public-webhook-throttle.guard.ts` — `getRequest` 인라인 익명 타입과 테스트 `ReqShape` 간 구조 중복
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` `canActivate` 내 `getRequest<{...}>()` 인라인 타입; `public-webhook-throttle.guard.spec.ts` `ReqShape` interface
- 상세: `canActivate`에서 `getRequest<{ params?:...; headers?:...; body?:...; rawBody?:...; __publicWebhookTrigger?:... }>()` 형태의 인라인 익명 타입이 사용된다. 테스트 파일의 export된 `ReqShape` 인터페이스는 실질적으로 동일한 필드 구조를 가진다. 필드 추가나 변경 시 두 곳을 동기화해야 하는 유지보수 부담이 생긴다.
- 제안: `public-webhook-throttle.guard.ts` 내에 named interface(`PublicWebhookReqShape` 등)를 선언하고 `getRequest<PublicWebhookReqShape>()` 형태로 사용. 테스트의 `ReqShape`는 해당 인터페이스를 import하거나 extends해 단일 진실 유지.

---

### [INFO] `public-webhook-throttle.guard.spec.ts` — env 복원 패턴 혼용 (`afterEach` vs `try/finally`)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts` CF 관련 테스트 블록
- 상세: `extractClientIpFromHeaders` describe 블록은 `afterEach`로 `process.env` 복원을 처리하는 반면, guard spec 의 CF 테스트 일부는 `try/finally` 패턴으로 직접 복원한다. 두 패턴이 동일 목적(env 복원)으로 혼용되면 코드베이스 내 일관성이 낮아지고 신규 테스트 작성 시 어느 패턴을 따라야 할지 기준이 불명확해진다.
- 제안: guard spec 의 CF 테스트에도 `beforeEach`/`afterEach` 패턴을 적용해 통일. `try/finally` 는 describe 블록 구조 제약이 있는 경우에만 사용.

---

### [INFO] `client-ip.spec.ts` — 신규 테스트의 env 설정 자기완결성 미흡
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/auth/utils/client-ip.spec.ts` L133–145 (신규 추가 테스트 2건)
- 상세: `'empty/whitespace cf-connecting-ip → falls back to XFF (CF on)'` 테스트는 `process.env.TRUST_CF_CONNECTING_IP = 'true'`를 설정하고 `afterEach`에 복원을 의존한다. `'whitespace-only XFF → null'` 테스트는 env를 직접 설정하지 않지만, 앞 테스트 후 env 상태가 복원되지 않았을 경우 영향을 받을 수 있다. 현재 `afterEach`가 선언되어 실제 격리가 보장되나, 테스트 자체가 독립적임을 명시하지 않아 가독성이 낮다.
- 제안: `'whitespace-only XFF → null'` 테스트 첫 줄에 `delete process.env.TRUST_CF_CONNECTING_IP` 또는 `process.env.TRUST_CF_CONNECTING_IP = undefined` 를 명시적으로 추가해 자기완결성 강화.

---

### [INFO] `public-webhook-throttle.guard.spec.ts` — 이관 주석 두 위치 중복
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts` — 삭제된 `extractClientIp` 테스트 블록 위치와 섹션 구분자 부근 두 곳
- 상세: `extractClientIp` 헤더 추출 테스트가 `auth/utils/client-ip.spec.ts`로 이관됐음을 설명하는 주석이 두 곳에 나타난다. 동일 내용이 두 위치에 존재하면 향후 어느 쪽이 canonical 설명인지 혼동이 생길 수 있다.
- 제안: 섹션 구분자 부근 위치 한 곳만 남기고 나머지 중복 주석 제거.

---

### [INFO] `review/code/2026/06/28/17_00_25/RESOLUTION.md` — 이전 리뷰 주기 발견사항과의 비교
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/review/code/2026/06/28/17_00_25/RESOLUTION.md`
- 상세: 이번 변경은 이전 리뷰(17_00_25)에서 지적된 `ai-review I10`(매직 넘버), `I11/I12/I13/I14`(메시지 상수 dedup·인라인 타입·env 복원 패턴·이관 주석 중복)를 "경미한 유지보수 — 현행/후속" 으로 보류한 상태다. 이번 리뷰 대상(17_16_16) 변경에도 동일 항목이 잔존하는 것은 의도된 미결 상태임이 RESOLUTION에 명시되어 있다. 따라서 새로운 회귀가 아니며 INFO로 기록한다.

---

## 요약

이번 변경(CWE-209 메시지 sanitize, fail-open 로그 레벨 격상, `extractClientIp` 공유 코어 통합)은 책임 분리와 중복 코드 제거 측면에서 유지보수성을 개선한 방향으로 올바르다. 특히 로컬 래퍼 함수 제거와 공유 코어 직접 호출로의 전환은 향후 IP 추출 로직 변경 시 단일 위치만 수정하면 되는 구조를 만들어 유지보수 비용을 낮춘다. 다만 소수의 기존 패턴 개선 기회가 남아 있다: `mapHttpErrorLike` 내 `413` 매직 넘버, 동일 의미의 기본 에러 메시지 문자열 두 버전 공존, `getRequest` 인라인 익명 타입과 테스트 `ReqShape` 간 구조 중복, env 복원 패턴 혼용, 이관 주석 중복. 이들은 모두 이전 리뷰(17_00_25)에서도 확인된 INFO 수준 항목으로 현행 코드에서 즉각적 버그 위험은 없으나 코드베이스 규모가 커질수록 유지보수 비용을 높이는 잠재 요인이다.

## 위험도

LOW
