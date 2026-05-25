# 유지보수성(Maintainability) 리뷰

검토 일시: 2026-05-25  
대상 파일:
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- `review/consistency/2026/05/25/15_27_39/SUMMARY.md`
- `review/consistency/2026/05/25/15_27_39/_retry_state.json`
- `review/consistency/2026/05/25/15_27_39/convention_compliance.md`
- `review/consistency/2026/05/25/15_27_39/cross_spec.md`

---

## 발견사항

### [WARNING] 프로덕션 코드: warn 로그 메시지가 과도하게 길고 구조화되지 않음
- **위치**: `execution-engine.service.ts` diff 추가 부분 — `this.logger.warn(...)` 호출 (line 3083-3084)
- **상세**: 단일 warn 메시지가 220자를 초과하는 자연어 문장 + 다수의 변수 보간을 한 줄로 연결한다. 영문·한국어 혼용, 괄호·대시·em-dash가 혼재하여 로그 수집 도구(Elasticsearch, Datadog 등)에서 파싱하거나 grep으로 추출할 때 패턴 매칭이 어렵다. 기존 코드베이스의 다른 warn 메시지(`Unknown continuation action.type=... skip=${...}/${...}`)는 짧고 구조적이므로 일관성도 깨진다.
- **제안**: 핵심 식별자(execution, buttonId)만 보간하고, 상세 맥락은 structured metadata object의 두 번째 인자로 분리하는 기존 NestJS Logger 패턴을 따른다. 예: `this.logger.warn('[waitForAiConversation] stale button_click ignored', { executionId, buttonId: buttonIdStr })`. 또는 메시지를 두 줄 이하의 상수 템플릿으로 분리.

---

### [WARNING] 테스트 코드: `pendingContinuations` 타입 단언 블록의 중복
- **위치**: `execution-engine.service.spec.ts` — 새로 추가된 테스트(line 67-74)의 인라인 타입 단언
- **상세**: 파일 내에 이미 `getPendings` 헬퍼(line 973-983)가 `pendingContinuations` Map에 대한 타입 단언을 추상화하여 존재한다. 이 헬퍼는 "W8 (SUMMARY) — 3곳 이상의 중복을 줄여 타입 단언 변경 시 단일 수정점 보장" 이라는 명시적 이유로 도입되었다. 그러나 새로 추가된 테스트는 `getPendings` 헬퍼를 사용하지 않고 인라인 타입 단언 블록을 반복 작성했다. 헬퍼 도입 목적이 정확히 이 상황을 위한 것이었으므로, 이 중복은 헬퍼의 단일 수정점 보장 효과를 즉시 약화시킨다.
- **제안**: 새 테스트에서 `getPendings(service)` 헬퍼를 사용하도록 교체. 현재 `const pendings = (service as unknown as { pendingContinuations: Map<...> }).pendingContinuations;` 블록을 `const pendings = getPendings(service);`로 대체하면 가독성과 단일 수정점 모두 회복된다.

---

### [WARNING] 프로덕션 코드: `action` 타입 단언이 분기 내에 인라인으로 반복됨
- **위치**: `execution-engine.service.ts` 추가 분기 — `const buttonIdRaw = (action as { buttonId?: unknown }).buttonId;`
- **상세**: `action` 객체는 이미 외부 루프에서 이 분기에 도달하기 전에 `type === 'button_click'`으로 확정된다. 분기 직후에 `as { buttonId?: unknown }` 타입 단언을 다시 수행하는 것은 해당 분기에서 `action`의 타입이 좁혀지지 않는다는 의미다. 기존 코드에서 `form_submitted` 분기는 `action.formData`를 단언 없이 접근하는 것으로 보아 `action`의 공용체 타입이 이미 `formData`를 포함하고 있을 가능성이 있다. `button_click` 케이스에만 `buttonId` 가 타입에 없어 단언이 필요하다면, 이는 `button_click` variant가 action의 공용체 타입 정의에 포함되어 있지 않음을 뜻하며 타입 모델 갱신이 더 적절하다.
- **제안**: `waitForAiConversation`의 `action` 파라미터 타입 또는 continuation payload 공용체에 `{ type: 'button_click'; buttonId?: string }` variant를 추가하여 분기 내에서 타입 시스템이 `buttonId`를 인식하게 한다. 이렇게 하면 인라인 단언이 제거되고 이 분기가 미래에 타입 안전하게 수정 가능해진다.

---

### [INFO] 프로덕션 코드: 매직 숫자 `64` (buttonId 슬라이스 길이)
- **위치**: `execution-engine.service.ts` — `buttonIdRaw.slice(0, 64)`
- **상세**: `64`는 의미를 알 수 없는 하드코딩된 숫자다. 같은 함수 파일에 `MAX_UNKNOWN_SKIPS`처럼 상수로 분리된 선례가 있다. `64`가 buttonId의 최대 안전 로그 길이인지, DB 컬럼 길이 제한인지, 또는 다른 사유에서 온 것인지 코드만으로는 알 수 없다. action.type 슬라이스에서도 `.slice(0, 64)`가 기존 else 분기에서 이미 사용되고 있어 중복된 매직 넘버가 두 곳에 존재한다.
- **제안**: 파일 상단의 상수 선언 영역에 `const MAX_LOG_ID_LENGTH = 64;`를 추가하고 두 곳에서 공유하여 사용한다. 주석으로 64의 근거(예: 로그 중복 방지용 truncation, DB 제약 등)를 간략히 기술한다.

---

### [INFO] 테스트 코드: 매직 숫자 `25` (반복 횟수)와 인라인 주석의 명시성
- **위치**: `execution-engine.service.spec.ts` — `for (let i = 0; i < 25; i += 1)`
- **상세**: `25`는 `MAX_UNKNOWN_SKIPS (20)`를 "충분히 초과"하기 위해 선택된 값으로, 바로 위 주석에 설명되어 있다. 주석이 이유를 서술하고 있으므로 치명적 문제는 아니나, 프로덕션 상수 `MAX_UNKNOWN_SKIPS`가 바뀔 경우 이 테스트 숫자도 수동으로 조정해야 함을 테스트 코드만 보는 독자가 놓칠 수 있다. 기존 파일에서 `MAX_UNKNOWN_SKIPS` 상수를 임포트하거나 참조하는 패턴이 있다면 그것을 따르는 것이 더 견고하다.
- **제안**: `const OVER_CAP_CLICK_COUNT = MAX_UNKNOWN_SKIPS + 5;` 형태로 반복 횟수를 상수로 선언하고, 프로덕션 상수를 테스트에서 임포트하여 사용한다. 상수 임포트가 테스트 파일의 격리 원칙과 충돌하면, 최소한 `const CLICK_COUNT_ABOVE_CAP = 25; // MAX_UNKNOWN_SKIPS(20) + 5 margin` 형태의 named constant로 분리한다.

---

### [INFO] 테스트 코드: `warnSpy` 설정과 `warnSpy.mockRestore()`가 `beforeEach`/`afterEach`가 아닌 테스트 본문에 산재
- **위치**: `execution-engine.service.spec.ts` — 새 테스트 내 `jest.spyOn(logger, 'warn')` 및 `warnSpy.mockRestore()`
- **상세**: 파일 내 기존 유사 테스트(`it('button_click action.type: MAX_UNKNOWN_SKIPS ...')` 바로 위의 테스트)도 동일하게 `warnSpy`를 본문 내에서 spy/restore한다. 이 패턴이 파일 전반에서 일관되게 반복되므로 현재 테스트 코드베이스의 관행과는 일관성이 있다. 다만 `mockRestore`가 호출되기 전에 `expect(hasCapWarn).toBe(false)` 단언이 실패하면 spy가 복구되지 않아 다른 테스트에 누출될 위험이 있다.
- **제안**: 현재 구조를 유지하는 것은 기존 관행과 일관되므로 즉시 변경은 불필요하다. 단, spy 누출 방지를 위해 `try/finally` 블록 또는 `afterEach(() => warnSpy.mockRestore())` 패턴 도입을 장기적으로 고려한다.

---

### [INFO] review 산출물 파일(`_retry_state.json`): 파일 끝 개행 없음
- **위치**: `review/consistency/2026/05/25/15_27_39/_retry_state.json`
- **상세**: diff에서 `\ No newline at end of file`이 표시된다. 이는 툴 출력이 자동 생성하는 파일이어서 직접 수정 대상은 아니지만, git diff 노이즈가 발생하고 일부 JSON 파서가 경고를 낼 수 있다.
- **제안**: 자동 생성 도구에서 파일 끝 개행을 보장하도록 출력 형식을 조정한다.

---

## 요약

이번 변경의 핵심인 `waitForAiConversation` `button_click` 분기 추가는 목적이 명확하고 주석이 충실하여 의도 파악이 용이하다. 전반적으로 코드 구조는 기존 패턴을 잘 따르고 있으나, 두 가지 유지보수성 문제가 주목된다. 첫째, 테스트에서 `getPendings` 헬퍼가 도입된 명시적 목적(타입 단언 중복 제거)과 정반대로 인라인 타입 단언이 새 테스트에 다시 등장했다. 이는 코드베이스 내 기존 추상화의 일관된 사용 원칙을 깨뜨리며 단일 수정점 보장을 약화시킨다. 둘째, 로그 메시지가 과도하게 길고 구조화되지 않아 운영 중 검색·파싱 효율이 낮다. 나머지 발견사항(매직 숫자, 타입 단언 위치, spy 패턴)은 기존 관행과 비교해 볼 때 즉시 차단이 필요한 수준은 아니나 장기 유지보수성에 지속적인 마찰을 유발할 수 있다.

---

## 위험도

LOW
