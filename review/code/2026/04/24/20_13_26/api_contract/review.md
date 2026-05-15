### 발견사항

- **[INFO]** `send-email` config 직렬화 형태 변경 — DB/API 응답에 빈 문자열 필드 추가
  - 위치: `send-email.schema.ts` line 116, 120 (`subject`, `body`)
  - 상세: `.optional()` → `.default('')` 변경으로 Zod parse 결과의 shape이 바뀜. 이전에는 클라이언트가 `subject`를 전송하지 않으면 config 객체에 해당 키가 없었으나, 이제는 항상 `""` 키가 포함되어 직렬화됨. DB에 저장된 기존 config는 읽을 때 Zod parse를 거치므로 자동으로 `""` 주입 — 저장 형태는 변하지 않고 read-time에만 영향.
  - 제안: 현 동작은 의도적이며 안전. 단, API 응답으로 config를 그대로 내려주는 엔드포인트가 있다면 응답 body에 `subject: ""` / `body: ""` 키가 새로 생겨 클라이언트 null-check 로직에 영향 없는지 확인 권장.

- **[INFO]** `sendEmailNodeOutputSchema.config.subject`와 config schema 간 비대칭
  - 위치: `send-email.schema.ts` line 28 (output schema의 `config.subject`)
  - 상세: 노드 config schema에서 `subject`는 이제 항상 `string`(빈 문자열 포함)이지만, output schema의 `config` 에코에는 여전히 `z.string().optional()`로 남아 있음. 런타임에서 output을 소비하는 클라이언트가 output echo를 config schema와 동일하다고 가정하면 타입 불일치 발생 가능.
  - 제안: 심각한 breaking change는 아니나, output schema의 `config.subject` / `config.body`도 `.default('')` 또는 필수 `z.string()`으로 정렬하면 계약 일관성 향상.

- **[INFO]** `caseDefSchema.id` 추가 — 순수 additive, 하위 호환
  - 위치: `switch.schema.ts` line 11-15
  - 상세: `.optional()`로 추가되어 기존 switch config payload (id 미포함)는 Zod parse를 그대로 통과함. `caseDefSchema`를 참조하는 `switchNodeOutputSchema.config.cases`도 자동으로 새 필드를 허용하여 계약 확장이 clean하게 전파됨.
  - 제안: 없음. 패턴이 `conditionDefSchema.id`와 일치하여 일관성도 유지됨.

- **[INFO]** API 버전 관리 없음
  - 위치: 전체 스키마
  - 상세: 노드 config 스키마에 버전 필드나 마이그레이션 레이어가 없어, breaking change 발생 시 기존 저장된 config를 명시적으로 구분할 수단이 없음. 현재 변경은 non-breaking이므로 즉각적 문제는 없음.
  - 제안: 장기적으로 `schemaVersion` 필드 도입 고려 (F-1 text-classifier stable id 마이그레이션 시 실질적으로 필요해질 수 있음).

---

### 요약

세 파일 모두 API 계약 관점에서 **하위 호환**을 유지한다. `send-email`의 `subject`/`body` `.default('')` 전환은 Zod parse 결과의 직렬화 shape만 변경하며, `undefined` 대신 `""` 키가 추가되는 수준이라 기존 클라이언트의 falsy-check 로직에는 영향이 없다. 유일한 잠재 리스크는 output schema의 `config.subject` 에코 타입이 config schema와 비대칭을 이루는 점이나 `.passthrough()` 덕분에 런타임 파괴는 없다. switch `id` 추가는 완전한 additive change다.

### 위험도

**LOW**