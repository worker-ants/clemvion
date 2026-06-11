# 유지보수성(Maintainability) 리뷰 결과

**대상 파일**: `codebase/backend/src/nodes/core/error-codes.ts`, `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`, `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts`, `plan/in-progress/http-ssrf-all-auth.md`, `plan/in-progress/refactor/04-security.md`
**검토일**: 2026-06-11

---

## 발견사항

### 1. **[INFO]** 인라인 주석 언어 혼용 — 한국어·영어 비일관
- 위치: `http-request.handler.ts` SSRF guard 블록 (lines 335–345, 350–351, 364)
- 상세: 동일 메서드 내에 영어 주석 블록("SSRF guard — applies to ALL…")과 한국어 주석("Usage 로그는 integration 인증에 한정…", "두 layer 검증: 호스트 리터럴…")이 혼재한다. 파일 내 다른 섹션도 동일한 혼용 패턴을 보이나 이번 변경이 이를 더 강화했다. 읽는 사람에 따라 어느 한 언어를 읽지 못할 수 있어 유지보수 접근성이 떨어진다.
- 제안: 파일 전반의 주석 언어 정책을 통일하거나, 현행 패턴(한국어 = "왜", 영어 = "무엇")을 명시적 컨벤션으로 문서화하여 일관성을 담보한다.

### 2. **[INFO]** `configEcho` 필드 목록과 스키마 정의의 단일 진실 부재
- 위치: `http-request.handler.ts` lines 164–177
- 상세: 명시 열거 방식으로 전환한 것은 Principle 7 D1 관점에서 올바른 결정이나, 열거된 11개 필드 목록이 `http-request.schema.ts` 스키마 정의와 두 곳에서 중복 관리된다. 향후 스키마에 필드가 추가·삭제될 때 이 목록을 동기화해야 한다는 사실이 주석에는 언급되지 않는다. "adding a new schema field is automatically echoed" 라는 구 주석(line 157–158)은 현재와 반대의 동작을 설명하며, 변경 후에도 제거되지 않고 그 위에 새 주석이 덮여 있어 모순된 서술이 공존한다.
- 제안: 구 주석("adding a new schema field is automatically echoed without a maintenance step")을 제거하고, 새 주석에 "스키마 필드 추가 시 이 목록도 동기화 필요 (http-request.schema.ts 참조)"를 명시한다.

### 3. **[INFO]** 매직 스트링 `'SSRF_BLOCKED'` 리터럴 반복
- 위치: `http-request.handler.ts` line 418 (`throw new Error('SSRF_BLOCKED: redirect chain exceeded 5 hops')`), `http-request.handler.spec.ts` lines 94, 117 (`toMatch(/SSRF_BLOCKED/)`)
- 상세: `HTTP_BLOCKED` 에러 코드는 `ErrorCode` 열거형으로 관리되나, SSRF 차단 시 던지는 Error 메시지 내 `'SSRF_BLOCKED:'` 프리픽스는 하드코딩된 문자열 리터럴로 남아 있다. 스펙 테스트가 이 리터럴에 의존(`toMatch(/SSRF_BLOCKED/)`)하므로, 메시지 포맷 변경 시 테스트와 핸들러 양쪽을 동시에 수정해야 한다는 암묵적 결합이 있다.
- 제안: 즉시 리팩터링은 불필요하나, `http-safety.ts` 혹은 동일 파일 상단에 `const SSRF_BLOCKED_PREFIX = 'SSRF_BLOCKED'` 상수를 정의해 두 파일이 같은 리터럴을 참조하도록 하면 결합을 명시적으로 만들 수 있다.

### 4. **[INFO]** 매직 넘버 `5` (redirect hop 한도)
- 위치: `http-request.handler.ts` lines 417–418
- 상세: `hops >= 5` 의 `5`는 "5 hops" 제한을 의미하며 주석으로 설명은 되어 있으나 named constant 가 아니다. 이 숫자가 스펙에서 정의된 값이라면(`spec/4-nodes/4-integration/1-http-request.md §4 step 9` 참조) 상수화가 유지보수성을 높인다.
- 제안: `const MAX_REDIRECT_HOPS = 5`로 추출하고 hop 오류 메시지도 이를 참조하게 한다.

### 5. **[INFO]** 테스트 내 `process.env` 패치의 cleanup 패턴 — 일관성 양호, 소규모 중복 존재
- 위치: `http-request.handler.spec.ts` lines 141–167
- 상세: `ALLOW_PRIVATE_HOST_TARGETS` opt-out 테스트에서 `prev` 변수로 원복하는 try/finally 패턴은 안전하고 읽기 쉽다. 그러나 동일한 env-backup 패턴이 이미 다른 테스트에서도 사용되고 있다면 헬퍼 함수(`withEnv(key, value, fn)`)로 추출할 여지가 있다.
- 제안: 파일 내 동일 패턴이 3회 이상이면 `withEnv` 유틸로 추출을 검토한다. 현재 변경에서는 1회만 추가되므로 즉시 조치 불필요.

### 6. **[INFO]** `err instanceof Error ? err.message : String(err)` 패턴 3회 반복
- 위치: `http-request.handler.ts` lines 359, 368 (이번 변경), 이전 코드에도 동일 패턴 존재
- 상세: 에러 메시지를 안전하게 문자열로 변환하는 `err instanceof Error ? err.message : String(err)` 패턴이 handler 내에서 반복된다. 이미 `toLogError` 같은 유틸이 파일 내에서 사용되는 것으로 보이므로 이 패턴을 공유 유틸로 통합할 기회가 있다.
- 제안: `errorMessage(err: unknown): string` 헬퍼를 추출하거나 기존 유틸을 활용하여 산발적 인라인 패턴을 제거한다.

---

## 요약

이번 변경(`authentication==='integration'` 가드 제거 → 전 인증 방식 SSRF 차단, `configEcho` spread → 명시 열거)은 보안 목적에 집중되어 있으며 변경 범위가 명확하게 제한되어 있다. 코드의 의도는 풍부한 주석으로 잘 표현되어 있고, 구조적 복잡도나 함수 길이·중첩 깊이에 대한 새로운 문제는 없다. 다만 (1) 구 주석("adding a new schema field is automatically echoed")이 새 동작과 정면 모순된 채 삭제되지 않아 혼란을 줄 수 있고, (2) `configEcho` 필드 목록과 스키마 정의 간의 동기화 책임이 주석에 명시되지 않아 향후 필드 추가 시 누락 위험이 있으며, (3) 한국어·영어 혼용 주석 패턴이 강화됐다는 점이 유지보수 시 마찰 요인이 된다. Critical·Warning 수준의 유지보수성 문제는 없으며 발견사항 전체가 INFO 수준이다.

---

## 위험도

LOW
