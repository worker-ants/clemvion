## 발견사항

---

### File 1: `send-email.schema.ts`

**[WARNING] `SendEmailConfig` 타입 시그니처 변경 — 소비자 코드 영향**
- 위치: `subject`, `body` 필드
- 상세: `.optional()` → `.default('')` 로 변경 시 Zod inferred type이 `string | undefined` → `string` 으로 바뀐다. `SendEmailConfig`를 타입으로 사용하는 모든 소비자(주로 handler, DTO mapper)에서 `config.subject === undefined` 분기가 TypeScript 레벨에서 dead code가 된다. 런타임에서는 스키마를 통해 파싱된 값이면 `''`로 채워지지만, 스키마를 거치지 않고 DB에서 직접 조회한 raw JSON을 `as SendEmailConfig`로 캐스팅하는 코드가 있다면 여전히 `undefined`가 들어올 수 있어 타입과 실제 값의 불일치가 발생한다.
- 제안: `send-email.handler.ts`에서 `config.subject`/`config.body` 접근 코드를 확인하고, raw JSON 캐스팅 대신 `schema.parse(...)` 또는 `schema.safeParse(...)` 를 통해 파싱하는지 검증한다.

**[INFO] `.default('')` 는 `null` 에 적용되지 않음**
- 위치: `subject`, `body` 필드
- 상세: Zod의 `.default(v)` 는 값이 `undefined`일 때만 기본값으로 채운다. DB에 `subject: null`이 저장되어 있으면 `.parse()` 시 `ZodError`가 발생한다(`.optional()`도 마찬가지로 null을 허용하지 않으므로 이전 버전과 동일한 위험이지만, default 추가 이후 behavior를 파악할 때 주의가 필요하다).
- 제안: 기존 DB 레코드에 `null`이 저장된 경우를 확인하거나, 필요 시 `.nullable().default('')`를 사용한다.

**[INFO] LLM tool-argument 생성 패턴 변경 (의도된 동작)**
- 위치: `subject`, `body`
- 상세: `.optional()` 제거로 LLM이 tool-call 시 해당 필드를 생략할 수 없게 된다. plan 문서에서 명시한 의도("선택 사항이니 생략 가능" 오인 차단)와 일치하므로 부작용이 아니라 의도된 변경임. 단, 기존에 `subject`/`body`를 생략한 채 저장된 assistant-generated config는 재파싱 시 `''`로 채워져 렌더링에 영향을 줄 수 있다.

---

### File 2: `switch.schema.ts`

**[INFO] 순수 additive 변경 — 하위 호환 유지**
- 위치: `caseDefSchema.id`
- 상세: `.optional()` 필드 추가이고 `caseDefSchema`에 `.passthrough()`가 있어 기존 데이터(id 없음)는 그대로 통과한다. `resolve-dynamic-ports.ts`가 이미 `c.id || 'case_${i}'` 패턴으로 동작한다고 plan 문서에 명시되어 있어, 스키마와 런타임 간 정합성이 맞다.
- 제안: 없음. 안전한 변경.

**[INFO] `SwitchConfig` 타입에 `id?: string` 노출**
- 위치: `caseDefSchema` → `switchNodeConfigSchema.cases[*]`
- 상세: `SwitchConfig = z.infer<typeof switchNodeConfigSchema>` 를 사용하는 소비자는 이제 `cases[*].id`를 타입 안전하게 읽을 수 있다. 기존 코드에서 `c.id`를 이미 사용 중이었다면 TypeScript 경고가 사라지는 긍정적 효과다.

---

### File 3: `plan/node-schema-audit.md`

**[INFO] 런타임 부작용 없음**
- 상세: 순수 문서 파일로 어떤 런타임 상태, 타입, API도 변경하지 않는다.

---

## 요약

주요 부작용 위험은 **File 1의 타입 시그니처 변경**에 있다. `SendEmailConfig.subject`/`.body`가 `string | undefined` → `string`으로 좁혀지므로, DB raw JSON을 스키마를 거치지 않고 직접 캐스팅하는 핸들러 코드가 있다면 타입과 실제 값의 불일치가 발생할 수 있다. 단, 이는 `.parse()` 경로를 일관되게 사용한다면 완전히 회피 가능하다. File 2의 switch `id` 추가는 순수 additive이며 기존 동작에 영향을 주지 않는다. File 3은 문서 변경으로 부작용이 없다.

## 위험도

**LOW** — 실제 문제가 되려면 스키마 파싱을 우회하는 raw 캐스팅 코드가 존재해야 하며, `null` 저장 레코드가 없다면 현재 동작은 정상이다.