### 발견사항

- **[WARNING]** 에러 메트릭 검증 로직 중복
  - 위치: `spec.ts` 새 테스트 2개 (단일/멀티 레이블 에러 케이스)
  - 상세: 두 테스트의 본문이 `meta.durationMs`, `meta.model`, `meta.llmCalls`, `llmCalls[0].responsePayload`, `llmCalls[0].durationMs` 검증 등 8줄 이상 거의 동일하다. 멀티 레이블 쪽이 `requestPayload` 검증 하나만 빠진 형태.
  - 제안: `assertErrorMeta(meta, expectedModel)` 같은 로컬 헬퍼로 공통 단언을 추출하면 향후 meta 필드가 변경될 때 수정 지점이 단일화된다.

- **[WARNING]** 성공/에러 경로 `meta` shape 비대칭, 코드에 미문서화
  - 위치: `handler.ts` 성공 경로(`processSingleLabelResult`) vs 에러 경로 catch 블록
  - 상세: 에러 경로는 `meta.durationMs`를 핸들러가 직접 주입하지만, 성공 경로는 `durationMs` 없이 반환하고 엔진이 나중에 주입한다(스펙 테이블 출처 `engine inject`). 이 의도적 비대칭이 코드에 설명되지 않아 미래 기여자가 "성공 경로에도 durationMs가 빠져 있다"고 오인하고 추가할 위험이 있다.
  - 제안: 성공 경로 `meta` 블록 근처에 한 줄 주석으로 엔진 주입 사실을 명시하거나, 에러 경로 주석에 비대칭 이유를 한 문장 추가한다.

- **[INFO]** `void _omit` 패턴 비표준
  - 위치: `spec.ts` `should fall back model…` 테스트
  - 상세: `const { model: _omit, ...rest } = ...; void _omit;` 는 미사용 변수 경고를 억제하는 비관용적 방식이다. TypeScript에서 `_` 접두어만으로 충분히 린터가 무시하도록 설정돼 있는 경우가 많다.
  - 제안: `const { model: _, ...configWithoutModel } = ...` 로 단순화하거나, 아예 `Omit` 타입과 객체 생성으로 대체한다.

- **[INFO]** 테스트 내 불필요한 타입 캐스트
  - 위치: `spec.ts` 두 새 테스트 모두 `expect(meta.durationMs as number).toBeGreaterThanOrEqual(0)`
  - 상세: 바로 위 줄에서 `typeof meta.durationMs === 'number'`를 검증했으므로, `as number` 캐스트는 타입 안전성에 기여하지 않는 잉여 표현이다.
  - 제안: `as number` 제거.

- **[INFO]** `errorDurationMs` 변수 두 곳 재사용 – 의도 불분명
  - 위치: `handler.ts` catch 블록
  - 상세: `meta.durationMs`와 `llmCalls[0].durationMs`가 동일한 변수를 참조한다. LLM 호출이 단일 호출이므로 값이 같은 것이 정상이지만, "두 필드가 같은 이유"가 코드에서 자명하지 않다. 향후 다중 호출(재시도 로직 추가 등)이 생기면 혼동할 수 있다.
  - 제안: 현재 구조 유지는 적절하나, 위의 WARNING 주석에 "단일 호출이므로 총 durationMs = 호출 durationMs" 사실을 포함하면 충분하다.

- **[INFO]** 테스트 내 과도한 인라인 주석
  - 위치: `spec.ts` 첫 번째 새 테스트 4줄 블록 주석
  - 상세: CONVENTIONS Principle 2 설명이 테스트 이름에 이미 `(Principle 2)`로 표기되어 있고, 핸들러 코드에도 동일 주석이 있다. 테스트 내 주석은 "why"가 아닌 "what"을 반복 설명하는 형태다.
  - 제안: 테스트 주석을 제거하거나 한 줄로 축약한다.

---

### 요약

변경의 핵심인 에러 경로 `meta` 채우기(`durationMs`/`model`/`llmCalls`)는 구조적으로 올바르고 기존 패턴과 일관된다. 주된 유지보수성 위험은 두 가지다: 첫째, 단일/멀티 레이블 에러 테스트 본문의 중복이 향후 meta 계약 변경 시 누락 수정 위험을 높인다. 둘째, 성공/에러 경로 간 `durationMs` 주입 주체의 비대칭이 코드에 명시되지 않아 오해를 살 수 있다. 나머지 발견사항은 사소한 가독성 문제이며, 전체 변경은 스펙 정합성 향상이라는 목적에 집중되어 있다.

### 위험도

**LOW**