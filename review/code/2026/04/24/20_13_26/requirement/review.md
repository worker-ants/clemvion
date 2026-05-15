### 발견사항

- **[INFO]** `send-email`: `subject`/`body` `.default('')` 전환은 요구사항 충족
  - 위치: `send-email.schema.ts` L113–122
  - 상세: `.optional()`은 LLM이 "생략 가능"으로 오인할 수 있어 `.default('')`가 더 명확한 의도를 전달함. 핸들러가 빈 문자열을 빈 값으로 처리하는지 별도 확인 필요하지만, 기존 코드가 `undefined` 처리를 하고 있었다면 빈 문자열도 동치로 처리할 가능성이 높음.
  - 제안: `send-email.handler.ts`에서 `config.subject ?? ''` 같은 방어 코드가 이미 있다면 중복이지만 무해함. 없다면 이번 변경이 그 역할을 수행.

- **[INFO]** `switch`: `caseDefSchema.id` 추가는 resolver 동작과 정합
  - 위치: `switch.schema.ts` L10–14
  - 상세: resolver가 이미 `c.id || case_${i}` fallback을 사용 중이므로 스키마 보강이 기존 동작을 깨지 않음. `optional()`이므로 기존 워크플로 데이터도 안전.
  - 제안: 이상 없음.

- **[WARNING]** `caseDefSchema.id`에 대한 유효성 검증 없음
  - 위치: `switch.schema.ts` L10–14
  - 상세: `id`가 공백 문자열 `''`이면 resolver의 `c.id || case_${i}` 조건에서 falsy로 평가되어 fallback이 발동하지만, `c.id.length > 0` 체크를 하는 버전(`resolve-dynamic-ports.ts` F-1 스코프에서 제안됨)과는 일관성이 있음. 단, `id: ' '`(공백) 같은 경우는 truthy로 평가되어 공백 id로 포트가 생성될 수 있음.
  - 제안: `.string().optional()` → `.string().trim().optional()` 또는 resolver 단에서 `c.id?.trim()` 처리.

- **[WARNING]** `plan/node-schema-audit.md` F-1이 "HIGH"이나 `switch`와의 구현 불일치
  - 위치: `plan/node-schema-audit.md` F-1 스코프 #2
  - 상세: F-1 스코프에서 resolver를 `c.id && c.id.length > 0 ? c.id : 'class_${i}'`로 수정하라고 제안하는데, `switch`의 resolver는 `c.id || case_${i}`(단순 falsy 체크) 패턴을 이미 사용 중. 두 패턴 중 어느 것이 표준인지 문서가 통일하지 않음.
  - 제안: audit 문서의 F-1 스코프 #2를 `c.id?.trim() || 'class_${i}'`로 통일하거나, 기존 `switch` resolver도 동일 패턴으로 일치시켜야 함.

- **[INFO]** `plan/node-schema-audit.md`의 F-3 `form.optionSchema.value` 조치가 불완전
  - 위치: `plan/node-schema-audit.md` F-3
  - 상세: "type 별 분기 필요할 수 있음"이라고 명시하면서도 조치를 단순 `.default('')`로 제안. `z.unknown().optional()`에 `.default('')`를 붙이면 숫자형 옵션 value에 빈 문자열이 기본값이 되어 타입 오염 가능성.
  - 제안: F-3 조치 항목에 "select/radio 옵션의 value 타입에 따라 `.default(null)` 검토" 명시 보강.

- **[INFO]** `send-email.handler.ts` 연동 검증 부재
  - 위치: `send-email.schema.ts` 전반
  - 상세: 스키마에서 `subject`/`body`가 `.default('')`가 되면 핸들러가 항상 문자열을 받게 됨. 기존에 `undefined`를 허용하던 SMTP 라이브러리 호출 경로가 있다면 동작은 동일하지만, 빈 문자열 제목의 이메일이 발송될 가능성이 생김. 요구사항상 제목 없는 이메일 발송이 허용되는지 확인 필요.
  - 제안: 핸들러 또는 실행 전 validation 단계에서 `subject`가 비어있을 때 경고/에러를 낼지 비즈니스 정책 명확화 필요.

---

### 요약

세 파일의 변경은 모두 스키마 보강 범주로, 기능 완전성과 LLM 연동 안정성을 개선하는 방향이다. `switch` `id` 추가와 `send-email` default 설정은 기존 resolver/handler 동작과 정합하며 하위 호환도 유지된다. 주의할 점은 두 가지다. 첫째, `caseDefSchema.id` 공백 문자열이 truthy로 처리되면서 잘못된 포트 id가 생성될 수 있는 엣지 케이스가 있다. 둘째, `send-email`에서 `subject`/`body`가 항상 `string`으로 내려가게 됨에 따라 "빈 제목 이메일 발송 허용 여부"라는 비즈니스 정책이 명확히 정의되지 않은 상태다. audit 문서(F-1 resolver 패턴 불일치, F-3 type 분기 미결)의 일부 제안도 세부 사항이 불완전하다.

### 위험도

**LOW**