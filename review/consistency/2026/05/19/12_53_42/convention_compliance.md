# 정식 규약 준수 검토 결과

**검토 모드**: 구현 착수 전 (`--impl-prep`)
**검토 범위**: `LlmService.withRetry` 에 RFC 7231 `Retry-After` 헤더 존중 로직 추가
**변경 대상**:
- `codebase/backend/src/modules/llm/llm.service.ts` — `withRetry` + 신규 `extractRetryAfterMs` helper
- `codebase/backend/src/modules/llm/llm.service.spec.ts` — 단위 + 통합 테스트
**신규 spec / 식별자**: 없음 (plan 명시)
**Plan**: `plan/in-progress/llm-retry-after.md`

---

## 발견사항

### [INFO] `extractRetryAfterMs` helper 가시성 — `private` vs 모듈 내부 공개
- target 위치: `plan/in-progress/llm-retry-after.md` §변경 범위 1), `llm.service.ts` 신규 추가 예정
- 위반 규약: 없음 (직접 위반 없음)
- 상세: plan 은 `extractRetryAfterMs` 를 `withRetry` 안의 신규 helper 로 명시하고, `llm.service.spec.ts` 단위 테스트에서 직접 호출하는 형태를 설계하고 있다 (`spec.ts` 의 `extractRetryAfterMs` 단위 테스트 참조). `private` 메서드를 테스트하려면 TypeScript `any` 캐스트(`(service as any).extractRetryAfterMs(...)`) 가 필요한데, 이 패턴은 테스트가 구현 내부 세부사항에 결합된다는 일반적 경고를 유발한다. 대안으로 모듈 내부 export 함수(`export function extractRetryAfterMs(...)`)로 분리하면 테스트가 명확해진다. 어느 방향이든 conventions 위반은 아니지만, plan 에 결정이 명시되어 있지 않아 구현 시 판단이 필요하다.
- 제안: plan 에 helper 가시성 결정을 한 줄 추가하거나, 구현 시 `any` 캐스트 없이 테스트 가능한 형태(별도 export 또는 `protected`) 를 선택한다.

### [INFO] `MAX_BACKOFF_MS` 상수 위치 — 파일 상단 module-level 상수 규약
- target 위치: `llm.service.ts` 기존 파일 상단 (line 16-17, `LIST_MODELS_TIMEOUT_MS`, `LIST_MODELS_CACHE_TTL_MS`)
- 위반 규약: 없음 (직접 위반 없음)
- 상세: 기존 파일이 module-level 상수를 파일 상단에 모아 두는 패턴을 사용하고 있다 (`LIST_MODELS_TIMEOUT_MS`, `LIST_MODELS_CACHE_TTL_MS`). plan 은 60s 상한을 `MAX_BACKOFF_MS` 라는 이름으로 도입할 것을 명시하는데, 이 상수를 같은 위치(파일 상단)에 두는 것이 기존 코드 스타일과 일관적이다. plan 이 이를 명시하지 않아 구현 시 `withRetry` 메서드 안에 인라인 리터럴로 둘 위험이 있다.
- 제안: `MAX_BACKOFF_MS = 60_000` 을 파일 상단 기존 상수 블록에 추가해 기존 패턴과 일관성을 유지한다.

### [INFO] warn 로그 형식 — 기존 로그 패턴과 일관성
- target 위치: `llm.service.ts:304` (`this.logger.warn(...)`)
- 위반 규약: 없음 (직접 위반 없음; conventions 에 warn 로그 포맷 규칙 없음)
- 상세: 현재 `withRetry` 의 warn 로그는 `Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})` 형식이다. plan §변경 범위 1) 은 backoff 출처(Retry-After / exponential)를 명시하도록 로그를 갱신할 것을 요구한다. 형식 변경이 기존 로그 파서·모니터링에 영향을 줄 수 있으나, 별도 conventions 규칙은 없으므로 INFO 로 분류한다.
- 제안: 로그 형식을 `Rate limited (Retry-After / exponential), retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})` 처럼 출처 표기를 포함하되 기존 키워드(`Rate limited`, `retrying in`, `attempt N/M`)를 유지해 기존 grep 패턴과 호환성을 지킨다.

---

## 규약 관점 종합 평가

본 구현 scope (`extractRetryAfterMs` helper + `withRetry` backoff 분기 + 테스트) 는 신규 spec 식별자나 API endpoint 를 전혀 도입하지 않으며, 파일 명명·모듈 구조·에러 코드 포맷·DTO 패턴 등 `spec/conventions/` 가 다루는 정식 규약의 적용 대상이 아니다. 기존 `llm.service.ts` 는 `UPPER_SNAKE_CASE` 에러 코드(`LLM_CONFIG_NOT_FOUND`, `LLM_MODEL_LIST_FAILED`), `sanitizeLlmErrorMessage` 유틸 패턴, module-level 상수 블록 등 내부 일관성을 잘 유지하고 있다. 발견된 3건은 모두 INFO 수준으로, 구현 스타일 일관성 제안에 해당하며 정식 규약을 직접 위반하지 않는다. 구현 착수를 차단할 CRITICAL 또는 WARNING 발견사항 없음.

---

## 위험도

NONE
