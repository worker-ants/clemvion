# 요구사항(Requirement) 리뷰

## 발견사항

### 파일 1: cafe24-token-refresh.constants.ts

- **[INFO]** `reactive_401` source 값 추가 및 JSDoc 작성
  - 위치: `Cafe24RefreshJobData.source` union type
  - 상세: 새 `reactive_401` 값의 의미(short-circuit guard skip 조건)가 JSDoc 에 명확히 기술됨. worker 동작 변화 의도와 타입 정의가 일치한다. 다른 empirical 신호 경로 확장 시 `reactive_<signal>` 패턴 명시는 spec 에도 반영되어 있어 일관성 있음.
  - 제안: 이슈 없음.

---

### 파일 2: integration-oauth.service.cafe24.spec.ts

- **[INFO]** 세 회귀 테스트 케이스 추가 (JWT 우선, JWT 비정상 fallback, TZ-less ISO KST 정규화)
  - 위치: 파일 라인 180-423 (신규 테스트 3건)
  - 상세: 각 테스트는 try/finally 로 global.fetch 와 OAUTH_STUB_MODE 복원을 보장하며, 어서션이 요구사항과 직접 대응됨. `makeFakeJwt` helper 중복(파일 6과 동일 구현)은 별도 공유 모듈로 추출하지 않았으나 테스트 파일 격리 정책상 허용 가능한 범위.
  - 제안: 이슈 없음.

- **[WARNING]** TZ-less ISO 테스트가 `integrationRepo.save.mock.calls[0][0]` 인덱스에 의존
  - 위치: 파일 라인 326, 413 (`save.mock.calls[0][0]`)
  - 상세: 각 테스트가 독립 실행될 때는 mock 이 초기화되므로 문제없지만, 동일 `describe` 블록 안의 이전 테스트가 `save`를 호출한 채로 mock 이 리셋되지 않으면 `calls[0]`가 다른 호출을 가리킬 수 있다. Jest `beforeEach` 에서 `integrationRepo.save.mockClear()` 가 보장되는지 확인 필요. 전체 파일 컨텍스트에서 리셋 여부가 명시되지 않음.
  - 제안: 각 테스트 시작 시점에 `integrationRepo.save.mockClear()` 를 명시적으로 호출하거나, `expect(integrationRepo.save).toHaveBeenCalledTimes(1)` 어서션을 앞에 추가해 인덱스 의존을 자기검증으로 보완.

---

### 파일 3: integration-oauth.service.ts

- **[INFO]** `parseTokenExpiresAt` 의 precedence 재구성 (JWT exp → expires_in → expires_at ISO → 2h)
  - 위치: 라인 1685-1524 (diff 기준)
  - 상세: cafe24 분기와 기타 provider 분기의 분리가 명확하고, 각 단계 주석이 명세와 일치. `hasTimezoneDesignator` 함수 분리로 가독성 향상.
  - 제안: 이슈 없음.

- **[WARNING]** `hasTimezoneDesignator` 와 `normalizeCafe24IsoTimezone` 중복 구현
  - 위치: `integration-oauth.service.ts` 의 `hasTimezoneDesignator`, `cafe24-api.client.ts` 의 `normalizeCafe24IsoTimezone`
  - 상세: 두 함수는 동일한 정규식 `/Z$|[+-]\d{2}:?\d{2}$/` 을 사용해 TZ designator 감지 후 `+09:00` 부여하는 동일 로직이다. 파일이 달라 별도 구현했으나, 향후 Cafe24 의 TZ 정책 변경 시 한 곳만 수정하면 다른 곳에 회귀가 발생할 수 있다.
  - 제안: 두 함수를 `jwt-exp.ts` 또는 `cafe24-utils.ts` 같은 공유 모듈로 추출해 단일 진실 원칙 적용. 단, 현재 명세에서 `parseJwtExp` 가 null 일 때만 ISO fallback 이 사용되므로 실질 위험은 낮음.

- **[INFO]** 기타 provider 에 대한 `expiresIn` 처리 위치 변경
  - 위치: 라인 521 (diff 기준, `return null` 직전)
  - 상세: 이전 코드는 cafe24 분기 전에 모든 provider 에 대해 `expires_in` 을 먼저 읽었으나, 변경 후 기타 provider 는 cafe24 분기 외부에서 처리한다. 기타 provider 의 동작은 변경 전과 동일 (expires_in 있으면 사용, 없으면 null). 기능 회귀 없음.
  - 제안: 이슈 없음.

---

### 파일 4: jwt-exp.spec.ts (신규)

- **[INFO]** 포괄적인 단위 테스트 — 21개 케이스
  - 위치: 전체 파일
  - 상세: 정상 케이스(exp 있음, minimal payload), 경계값(exp=0, exp 음수, exp=Infinity, exp=NaN), 비정상 입력(null, undefined, number, object, 빈 문자열), 구조 오류(segment 1/2개, base64 오류, JSON 오류, non-object payload), Cafe24-like payload 검증까지 망라. 반환 규약 명세와 정확히 대응.
  - 제안: 이슈 없음.

- **[INFO]** `exp = 0` null 처리 의도 문서화
  - 위치: 라인 690-695
  - 상세: `exp = 0` (1970-01-01 epoch) 을 의미 없는 sentinel 로 판단해 null 반환하는 결정이 주석으로 명확히 기술됨. `parseJwtExp` 의 `exp <= 0` 조건과 일치.
  - 제안: 이슈 없음.

---

### 파일 5: jwt-exp.ts (신규)

- **[INFO]** 순수 함수로 구현, DI 없음
  - 위치: 전체 파일 (50 라인)
  - 상세: Node 18+ `Buffer.from(str, 'base64url')` 표준 지원 활용, try/catch 로 JSON 파싱 오류 흡수, Array/null 체크로 non-object payload 방어, `typeof exp !== 'number' || !Number.isFinite(exp) || exp <= 0` 복합 조건으로 비정상 exp 전부 방어. 반환 규약 문서가 구현과 정확히 일치.
  - 제안: 이슈 없음.

- **[WARNING]** `exp` 가 매우 큰 정수일 때 `exp * 1000` 의 정밀도 손실 가능성
  - 위치: 라인 926 (`return exp * 1000;`)
  - 상세: JavaScript `number` (IEEE 754 double)의 안전 정수 상한은 `Number.MAX_SAFE_INTEGER = 2^53 - 1 = 9007199254740991`. `exp * 1000` 결과가 이 범위를 벗어나면 정밀도 손실. `exp = 9007199254740991 / 1000 ≈ 9007199254740.99` 이므로 약 285,000년 후의 epoch 초 값에서 발생. Cafe24 JWT 의 실제 exp 는 현재로부터 최대 2h 후이므로 실용상 문제 없음. 단, 이론적 경계값 방어가 없음.
  - 제안: 실용상 위험도 극히 낮으므로 현재 구현 수용. 필요 시 `Number.isSafeInteger(exp)` 추가 체크 고려.

---

### 파일 6: cafe24-api.client.spec.ts

- **[INFO]** 세 회귀 테스트 케이스 추가 (refresh JWT 우선, TZ-less ISO fallback, reactive_401 자가 회복)
  - 위치: diff 라인 1036-1244
  - 상세: 핵심 회귀 어서션이 명확하고, `queue.add` 호출 인자 (source, removeOnComplete) 검증이 명세와 일치.
  - 제안: 이슈 없음.

- **[CRITICAL]** `reactive_401` 테스트에서 `refreshedAt` 변수가 정의되지 않음
  - 위치: 라인 1189 (`tokenExpiresAt: refreshedAt`) 및 라인 1191 (`expires_at: refreshedAt.toISOString()`)
  - 상세: `refreshedRow` 객체 리터럴에서 `refreshedAt` 를 참조하고 있으나, diff 상 이 변수의 선언이 보이지 않는다. 테스트 파일의 모듈 스코프 또는 `describe` 블록 상단에 정의된 변수일 가능성이 있지만 전체 파일 컨텍스트의 해당 부분이 잘려 확인 불가. 만약 정의 없이 사용된다면 `ReferenceError: refreshedAt is not defined` 로 테스트가 런타임 오류. 실제 코드에서 누락된 경우 해당 통합 회귀 테스트 전체가 실패한다.
  - 제안: `refreshedAt` 의 선언 위치 확인 필수. 미정의라면 `const refreshedAt = new Date(Date.now() + 3600 * 1000);` 등 명시적 선언 추가.

---

### 파일 7: cafe24-api.client.ts

- **[INFO]** `performAuthRefresh` 에서 `'proactive'` → `'reactive_401'` 변경
  - 위치: 라인 1327-1328 (diff 기준)
  - 상세: 401 자가 회복 경로에서 source 를 `'reactive_401'` 로 전달하는 변경이 명세 의도와 정확히 일치. worker 의 short-circuit skip 조건 (`source === 'reactive_401'`) 과 연결됨.
  - 제안: 이슈 없음.

- **[INFO]** `refreshAccessToken` 의 expiresAt 계산에 동일 precedence 적용
  - 위치: 라인 1360-1369 (diff 기준)
  - 상세: `parseTokenExpiresAt` 와 동일한 4단계 precedence (JWT exp → expires_in → expires_at ISO → 2h)가 일관되게 적용. `normalizeCafe24IsoTimezone` 이 내부에서만 사용되는 private 함수로 분리.
  - 제안: 이슈 없음.

- **[WARNING]** `normalizeCafe24IsoTimezone` 과 `hasTimezoneDesignator` 의 이중 구현 (파일 3과 동일 지적)
  - 위치: 라인 1388-1390 (diff 기준)
  - 상세: 파일 3의 WARNING 과 동일. 향후 정규식 패턴 변경 시 두 곳 모두 수정 필요.
  - 제안: 공유 모듈로 추출 권장 (낮은 긴급도).

- **[INFO]** `refreshViaQueue` 의 `removeOnComplete` 차등 적용
  - 위치: 라인 1290-1303 (diff 기준)
  - 상세: `reactive_401` 에 `age: 0` 적용 이유(completed job 잔존 dedup edge case 차단)가 주석으로 명확히 설명됨. 비즈니스 로직과 구현이 일치.
  - 제안: 이슈 없음.

---

### 파일 8: cafe24-token-refresh.processor.spec.ts

- **[INFO]** `reactive_401` short-circuit skip 회귀 테스트 및 status guard 유지 테스트 추가
  - 위치: 라인 1421-1449 (diff 기준)
  - 상세: `reactive_401` 이 expiry guard 만 우회하고 status guard 는 그대로임을 검증. `it.each` 로 `'error' | 'expired' | 'pending_install'` 세 status 모두 검증. 요구사항과 완전히 일치.
  - 제안: 이슈 없음.

---

### 파일 9: cafe24-token-refresh.processor.ts

- **[INFO]** `source === 'reactive_401'` 조건부 short-circuit skip
  - 위치: 라인 1489-1500 (diff 기준)
  - 상세: `if (source !== 'reactive_401')` 블록으로 기존 short-circuit 로직을 감싸는 구현이 명세와 정확히 일치. proactive/background 의 short-circuit은 그대로 유지되며, debug 로그에 source 가 추가되어 진단 가능성 향상.
  - 제안: 이슈 없음.

- **[WARNING]** `source` 변수의 추출 경로가 diff 에서 명시되지 않음
  - 위치: 라인 1489 (`if (source !== 'reactive_401')`)
  - 상세: diff 상 `source` 변수가 `job.data.source` 에서 구조분해 또는 직접 참조되는 부분이 보이지 않는다. 전체 파일 컨텍스트에서 잘린 부분일 가능성이 높으나, 만약 `source` 가 선언되지 않은 채로 사용된다면 TypeScript 컴파일 오류. diff 가 context 를 일부만 보여주는 형태라 실제 파일에는 존재할 것으로 추정되나 확인 필요.
  - 제안: `process(job)` 메서드 내 `const { integrationId, source } = job.data;` 구조분해가 있는지 확인. 누락 시 추가.

---

### 파일 10: plan/in-progress/cafe24-jwt-exp-fix.md (신규)

- **[INFO]** Plan 문서 체크박스가 모두 미완료(`[ ]`) 상태
  - 위치: 전체 체크박스
  - 상세: 이 PR 이 실제 코드 변경(파일 1-9)을 포함하고 있으나 plan 의 작업 항목이 `[ ]` 미완료 상태다. plan 라이프사이클 규약상 완료된 항목은 `[x]` 로 표시되어야 하고, 모든 항목이 완료되면 `complete/` 로 이동해야 한다. `/ai-review` 실행 자체도 체크박스가 있는데 현재 실행 중이므로 반영 시점 문제일 수 있음.
  - 제안: 코드 변경이 완료된 항목은 `[x]` 로 갱신 필요. 이 PR 머지 전에 체크박스 상태를 실제 완료 여부에 맞게 동기화.

---

### 파일 11: plan/in-progress/spec-update-cafe24-jwt-exp.md (신규)

- **[INFO]** spec 갱신 계획이 별도 plan 으로 분리, consistency-check 결과 참조 명시
  - 위치: 전체 문서
  - 상세: consistency-check 결과(BLOCK: NO, WARNING 5건)가 반영 계획에 포함되고, 갱신 항목이 구체적으로 기술됨. developer 가 사용자 권한 위임으로 spec 에 직접 쓰는 예외가 명시됨.
  - 제안: 이슈 없음.

- **[WARNING]** spec-update plan 의 처리 체크박스도 미완료 상태
  - 위치: 전체 문서
  - 상세: `처리` 섹션에 3개 step 이 기술되어 있으나 체크박스가 없어 완료 여부 추적이 안 됨. plan 파일 안에 있어서 관리 관점에서 누락.
  - 제안: 처리 항목에도 체크박스(`- [ ]`) 추가 권장.

---

### 파일 12: review/consistency/2026/05/18/19_29_07/_retry_state.json (신규)

- **[INFO]** consistency-check orchestration 상태 파일
  - 위치: 전체 파일
  - 상세: 5개 checker 가 모두 `agents_pending` 에 있고 `agents_success` 가 비어 있다. 이는 이 파일이 orchestrator 초기화 시점의 스냅샷임을 의미. review 세션 자체의 초기 상태 기록이므로 요구사항 관점의 코드 이슈와 무관.
  - 제안: 이슈 없음.

---

## 요약

이번 변경은 Cafe24 JWT access_token 의 `exp` claim 을 만료 시각의 single source of truth 로 격상하고, 401 자가 회복 경로에서 워커 short-circuit 을 우회하는 `reactive_401` source 를 도입한 구조적 bugfix 다. 핵심 구현(`jwt-exp.ts`, `parseTokenExpiresAt` precedence 재구성, processor short-circuit 차등 적용)은 요구사항 명세와 정확히 일치하며, 단위·회귀 테스트가 각 비즈니스 규칙(JWT 우선, TZ-less ISO KST 정규화, reactive_401 short-circuit skip, status guard 유지)을 개별 어서션으로 검증한다. 단, `cafe24-api.client.spec.ts` 의 `reactive_401` 통합 회귀 테스트에서 `refreshedAt` 변수가 diff 상 미정의로 보이는 CRITICAL 이슈가 있어 확인이 필요하다. 추가로 `hasTimezoneDesignator` / `normalizeCafe24IsoTimezone` 의 두 파일 중복 구현은 향후 유지보수 리스크로 경고 등급 지적 사항이다.

## 위험도

MEDIUM

(CRITICAL 1건: `refreshedAt` 미정의 여부 확인 필요 — 실제 미정의라면 통합 회귀 테스트 실패로 PR 블록킹 수준. 실제 파일에서는 정의되어 있을 가능성이 높으나 diff 만으로는 확인 불가.)
