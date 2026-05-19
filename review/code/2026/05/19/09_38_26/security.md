### 발견사항

- **[INFO]** `requiredWhen.equals` 타입이 `unknown | readonly unknown[]` 로 선언되어 런타임 분기 안전성은 `Array.isArray` 로 보장되나, TypeScript 타입 상 단일 값과 배열을 동일 union 으로 표현하므로 향후 오용 시 컴파일러가 잡지 못할 가능성 존재
  - 위치: `node-component.interface.ts:299`, `types.ts:1054`
  - 상세: `equals: unknown | readonly unknown[]` 는 정적 타입 수준에서 두 형태를 구분하지 않는다. 호출 측이 실수로 배열을 단일 값 위치에 넘겨도 TypeScript 컴파일 오류가 발생하지 않는다. 런타임에서는 `matchesRequired` 의 `Array.isArray` 분기가 올바르게 처리하지만, 설계 의도가 타입으로 명확히 표현되지 않는다.
  - 제안: `equals: T | readonly T[]` 형태의 제네릭 타입으로 좁히거나, 두 형태를 별개 key 로 분리(예: `equalsValue` / `equalsAny`)하면 컴파일 타임 안전성이 높아진다. 단, 현재 런타임 동작 자체는 안전하므로 즉각 수정 필요 수준은 아니다.

- **[INFO]** `matchesRequired` 에서 `Array.isArray(rule.equals)` 이후 `.includes(value)` 를 호출할 때 `value` 의 타입이 `unknown` 이며, `Array.prototype.includes` 시그니처는 `searchElement: T` 를 요구하므로 TypeScript strict 환경에서 타입 경고가 발생할 수 있음
  - 위치: `visibility.ts:976` — `rule.equals.includes(value)`
  - 상세: 현재 코드는 `as` 캐스팅 없이 `value` 를 그대로 전달한다. `ReadonlyArray<unknown>.includes(unknown)` 는 `unknown extends unknown` 이므로 실제로는 통과하지만, 더 좁은 제네릭 배열(예: `readonly string[]`)로 타입이 구체화될 경우 캐스팅이 필요해질 수 있다.
  - 제안: `(rule.equals as readonly unknown[]).includes(value)` 또는 별도 헬퍼로 명시적으로 처리. 현재 상태에서 런타임 오류 가능성은 없다.

- **[INFO]** `validateSwitchConfig` 에서 `item.id` 를 에러 메시지에 직접 포함하여 반환 (`cases[${i}].id '${item.id}' is duplicated`)
  - 위치: `switch.schema.ts:663–668`
  - 상세: 에러 메시지에 사용자 입력값(`item.id`)이 그대로 포함된다. 이 에러 문자열이 API 응답이나 UI 에 그대로 노출될 경우, 공격자가 제어하는 문자열(예: 매우 긴 문자열, 특수문자)이 에러 메시지에 반영된다. 단, `item.id` 는 이전에 `/^[a-zA-Z0-9_-]+$/` 정규식과 `.max(64)` 로 검증된 값이므로 XSS 등 직접 공격 벡터는 차단되어 있다.
  - 제안: 현재 schema-level regex 검증이 선행되므로 실질적 위험은 낮다. 다만 `validateConfig` 가 schema parse 후에 호출되는지 보장하는 방어적 확인(`typeof item.id === 'string' && /^[a-zA-Z0-9_-]+$/.test(item.id)` 재검증)을 추가하면 방어 심층화(defense-in-depth) 에 유리하다.

- **[INFO]** `caseDefSchema` 에 `.passthrough()` 사용으로 미정의 속성이 그대로 통과됨
  - 위치: `switch.schema.ts:543` — `caseDefSchema ... .passthrough()`
  - 상세: `.passthrough()` 는 스키마에 선언되지 않은 추가 필드를 통과시킨다. 동일하게 `switchNodeConfigSchema` 도 `.passthrough()`(line 622) 다. 따라서 임의 키-값이 config 에 포함될 수 있으며, `validateSwitchConfig` 및 handler 에서 이를 적극적으로 차단하지 않는 한 미정의 데이터가 내부 로직에 유입될 수 있다.
  - 제안: UI/DSL 평가 함수(`matchesRequired`, `matchesVisible`)는 `config[rule.field]` 만 참조하므로 직접 공격 표면은 제한적이다. 그러나 저장·전파되는 config 가 임의 키를 허용한다면 전반적인 입력 표면을 넓히는 설계다. 보안 관점에서 `.strip()` 또는 엄격 스키마 사용을 장기적으로 고려할 것.

- **[INFO]** `visibleWhen` DSL 은 여전히 `notEquals` / `oneOf` 형태를 유지하고 있으나 `requiredWhen` 은 `equals` 단일 형태로 정준화됨 — 두 DSL 간 일관성 부재는 보안 정책 관점의 문제라기보다 유지보수 위험이나, 향후 `notEquals` 블랙리스트 의도와 다른 가시성 부여 위험 가능성 존재
  - 위치: `visibility.ts:964–970` (`matchesVisible`) 및 `types.ts:1118–1121` (`visibleWhen`)
  - 상세: plan 문서에서 `visibleWhen` 의 `notEquals`/`oneOf` → `equals array` 마이그레이션을 별 worktree 로 예정하고 있음. 현재 `notEquals` 에 의해 visibility 가 결정되는 필드가 향후 mode 추가 시 의도치 않게 표시될 가능성이 있다. 직접적인 보안 취약점은 아니지만 로직 오류(잘못된 필드 노출)를 야기할 수 있다.
  - 제안: 예정된 마이그레이션을 적시에 진행하고, `matchesVisible` 에도 `notEquals` 패턴 사용 경고를 주석 또는 lint 규칙으로 표시할 것.

### 요약

이번 변경은 `requiredWhen` DSL 을 `notEquals`/`oneOf` 블랙리스트 형태에서 `equals: T | T[]` 화이트리스트 단일 형태로 정준화하는 순수 인터페이스/DSL 정리 작업이다. 인젝션, 하드코딩 시크릿, 인증/인가, 암호화, 의존성 취약점 등 주요 보안 범주에 해당하는 문제는 발견되지 않았다. `validateSwitchConfig` 에서 case id 가 에러 메시지에 포함되나 이미 schema 정규식(`/^[a-zA-Z0-9_-]+$/`, `.max(64)`)이 선행 검증하므로 실질 위험은 낮다. `caseDefSchema`/`switchNodeConfigSchema` 의 `.passthrough()` 는 미정의 속성을 허용하는 설계로, 입력 표면을 넓히는 잠재 요소이나 현재 평가 로직이 선언된 필드만 참조하므로 즉각적 위험은 없다. 타입 시스템 수준에서 `equals: unknown | readonly unknown[]` union 이 두 형태를 컴파일 타임에 구분하지 못하는 점은 미래 오용 가능성을 내포하지만 런타임에서는 `Array.isArray` 분기가 안전하게 처리한다. 전반적으로 보안 위험도는 낮으며, 발견 사항 모두 INFO 수준이다.

### 위험도

LOW
