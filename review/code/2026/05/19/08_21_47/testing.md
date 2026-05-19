# Testing Review — send-email-to-array-only

## 발견사항

### [INFO] `normalizeRecipients` 방어 코드 경로에 대한 직접 단위 테스트 부재
- 위치: `send-email.handler.ts` `normalizeRecipients` 함수 / `send-email.handler.spec.ts`
- 상세: `normalizeRecipients` 는 비-배열 입력에 대해 방어적으로 `[]` 를 반환하는 경로를 유지하고 있다. 이 경로는 "legacy 데이터 safety net" 으로 문서화되어 있지만, 해당 분기를 직접 호출하는 단위 테스트는 존재하지 않는다. 현재 테스트는 `handler.execute()` 를 통해 간접적으로만 `normalizeRecipients` 를 호출하며, 비-배열 입력이 `execute()` 레벨까지 도달하는 경우는 `validate()` 와 schema parse 가 이미 막아주기 때문에 사실상 표준 경로에서는 호출되지 않는다. 즉 해당 방어 분기는 테스트로 검증되지 않는 dead code 상태다.
- 제안: `normalizeRecipients` 를 파일 내 export 하거나, 별도 테스트 케이스에서 직접 non-array 입력(`null`, `42`, `'a@b.com'`)을 주었을 때 `[]` 가 반환되는지 검증하는 테스트를 추가한다. 또는 해당 방어 분기에 대한 의도를 주석으로 더 명확히 기술하고, 엔진 레벨 통합 테스트에서 legacy payload 시나리오를 다루는 방향도 고려할 수 있다.

---

### [INFO] `isOptionalRecipientSet` 의 non-array 비-undefined/null 입력에 대한 테스트 누락
- 위치: `send-email.schema.ts` `isOptionalRecipientSet` / `send-email.schema.spec.ts`
- 상세: `isOptionalRecipientSet` 은 `value === undefined || value === null` 이면 `false`, 빈 배열이면 `false`, 그 외는 `true` 를 반환한다. "그 외" 에는 비-배열 타입(예: `42`, `'str'`, `{}`)이 포함되며, 이 경우 `isRecipientsLike` 가 뒤에서 array-only 로 reject 하도록 설계되어 있다. `rejects cc when set but is a string (array-only)` 테스트가 이 경로의 일부를 커버하지만, `bcc` 에 대해서는 동일한 string raw reject 케이스가 `validateSendEmailConfig` 레벨 테스트에 없다. cc string reject 케이스는 추가되었으나 bcc string reject 케이스는 `handler.spec.ts` 에서만 커버된다.
- 제안: `send-email.schema.spec.ts` 의 `validateSendEmailConfig` describe 블록에 `rejects bcc when set but is a string (array-only)` 케이스를 추가해 cc/bcc 의 대칭성을 유지한다.

---

### [INFO] 부분 거부(partial rejection) 시나리오 테스트 부재 — 기존 미해결 갭
- 위치: `send-email.handler.spec.ts` 정상 발송 describe 블록 (약 line 209-261)
- 상세: plan 문서(`send-email.md` 개선안 항목 3)에서 이미 명시된 누락이다. nodemailer mock 이 `rejected: ['x@y.com']` 를 반환하는 시나리오 — 즉 부분 거부가 발생해도 `port` 가 `out` 이고 `meta.deliveryStatus='sent'` 이며 `output.rejected` 에 해당 주소가 포함되는지 — 를 검증하는 테스트가 없다. spec §5.1 footnote 는 부분 거부가 success 분기로 흐른다고 명시하나 회귀 테스트가 없어 추후 로직 변경 시 보호막이 없다. 이번 PR 의 변경과 직접 관련은 없으나 기존 갭이 유지된 채 PR 이 진행되고 있다.
- 제안: `nodemailer` mock 을 `{ messageId: 'msg-x', accepted: ['a@x.com'], rejected: ['b@x.com'] }` 로 설정한 테스트 케이스를 추가해 `out.output.rejected` 에 `['b@x.com']` 이 포함되고 `meta.deliveryStatus` 가 `'sent'` 임을 검증한다.

---

### [WARNING] `sendEmailNodeOutputSchema` 타입 강화 후 기존 `config.to` 가 string 인 output 의 parse 동작 미검증
- 위치: `send-email.schema.ts` `sendEmailNodeOutputSchema` / `send-email.schema.spec.ts` `sendEmailNodeOutputSchema` describe 블록
- 상세: `sendEmailNodeOutputSchema.config.to/cc/bcc` 가 `z.unknown()` 에서 `z.array(z.string())` 으로 좁혀졌다. 이로 인해 legacy 워크플로(DB 에 string 형태의 `to` 가 저장된 경우) 의 실행 이력을 읽을 때 output schema parse 가 실패할 수 있다. 현재 테스트는 정상 shape(`to: ['a@x.com']`) 와 error shape 만 검증하며, `config.to` 가 문자열인 경우 schema 가 어떻게 반응하는지(`success: false` 인지, passthrough 로 통과되는지)를 확인하는 테스트가 없다. `sendEmailNodeOutputSchema` 에 `.passthrough()` 가 있지만 `config` 내부의 `to` 필드는 `z.array(z.string())` 으로 typed 되어 있어 string input 은 실패할 것으로 예상된다.
- 제안: `sendEmailNodeOutputSchema.safeParse({ config: { to: 'legacy@x.com' } })` 의 결과를 테스트하여 실패 여부를 명시적으로 확인한다. 만약 legacy output 호환성이 요구 사항이라면 `z.union([z.string(), z.array(z.string())])` 으로 output schema 만 유지하거나, `.optional()` 처리로 parse 실패를 방지하는 방안을 검토한다. 단 plan 문서에서 마이그레이션 skip 을 결정했으므로, 이 gap 이 의도적이라면 테스트에서 명시적으로 `success: false` 를 assert 하여 문서화한다.

---

### [INFO] `warningRules` 의 `send_email:no-recipient` — `to` 가 string 일 때 동작 미검증
- 위치: `send-email.schema.spec.ts` `warningRules > send_email:no-recipient` describe
- 상세: array-only 정준화 이후 `send_email:no-recipient` warningRule 의 `when: 'length(to) == 0'` 조건이 `to` 가 string 타입일 때 어떻게 평가되는지 테스트되지 않는다. `length(to)` DSL 이 string 을 받았을 때 string length 로 해석해 비어 있지 않은 string 에서 rule 이 fire 되지 않을 가능성이 있다. 이는 array-only 정준화의 의도와 다를 수 있다.
- 제안: `firedIds({ to: 'single@example.com' })` 가 `'send_email:no-recipient'` 를 fire 하는지 테스트를 추가한다. 만약 DSL 이 string length 를 보아 fire 하지 않는다면, 이 동작이 허용 가능한지 spec 과 대조해 결정하고 테스트에 주석으로 명시한다.

---

### [INFO] `bcc must be an array of email addresses` i18n 키 매핑 테스트 부재
- 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts`
- 상세: 새로 추가된 i18n 키 3개(`to is required and must be a non-empty array...`, `cc must be an array...`, `bcc must be an array...`)에 대한 프론트엔드 테스트가 없다. 현재 코드베이스에 `backend-labels.ts` 의 번역 키를 검증하는 테스트가 있는지 확인이 필요하다. 없다면 번역 키 오타 또는 누락이 런타임에서만 발견된다.
- 제안: 기존 i18n 테스트 패턴이 있다면 새 키 3개를 동일 패턴으로 추가한다. 없다면 최소한 `WARNING_KO` 객체에 해당 key 가 존재하는지를 snapshot 또는 key-existence 테스트로 잠근다.

---

### [INFO] `handler.validate` 에서 `cc` string raw 에 대한 에러 메시지 내용 미검증
- 위치: `send-email.handler.spec.ts` `rejects cc when raw is a string (array-only)` 테스트
- 상세: 해당 테스트는 `result.valid` 가 `false` 임만 검증하고, `result.errors` 의 내용을 검증하지 않는다. `rejects missing integrationId`, `rejects empty array for to` 등 다른 테스트는 `result.errors.join(' ').toMatch(...)` 로 에러 메시지 내용을 함께 검증한다. cc/bcc string reject 케이스는 valid/invalid 여부만 assert 해 에러 메시지가 의도한 내용인지 확인하지 않는다.
- 제안: `expect(result.errors.join(' ')).toMatch(/cc|CC/)` 또는 구체적인 에러 문자열을 추가해 에러 메시지 내용까지 잠근다. bcc 케이스도 동일.

---

## 요약

이번 PR 의 테스트 변경은 array-only 정준화라는 breaking change 에 대해 전반적으로 충실하게 대응하고 있다. `to`/`cc`/`bcc` 의 string raw reject 케이스, expression-in-array 허용 케이스, absent/empty-array 허용 케이스가 handler spec 과 schema spec 양쪽에서 체계적으로 추가되었고, baseConfig 와 execute 레벨의 데이터도 일관되게 array 로 갱신되었다. 다만 몇 가지 커버리지 갭이 남아 있다: `normalizeRecipients` 의 방어 분기가 단위 테스트로 검증되지 않고, `sendEmailNodeOutputSchema` 의 타입 강화로 인해 legacy string 형태 output 의 parse 동작이 명시적으로 검증되지 않으며, schema spec 에서 bcc string reject 케이스가 빠져 있어 cc 와 비대칭이다. 부분 거부(partial rejection) 회귀 테스트 부재는 이번 PR 과 무관한 기존 갭이지만 해소되지 않은 채 유지되고 있다. cc/bcc string reject 테스트에서 에러 메시지 내용 검증이 누락된 점도 일관성 측면에서 보완이 필요하다.

## 위험도

LOW
