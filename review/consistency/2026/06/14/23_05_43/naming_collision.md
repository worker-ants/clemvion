# 신규 식별자 충돌 검토 결과

## 발견사항

신규 식별자 충돌이 발견되지 않았습니다. 아래는 검토 항목별 확인 결과입니다.

### [INFO] `validation.min` / `validation.max` — 기존 필드명과 동일, 의미 일치

- target 신규 식별자: `ValidationRule.min`, `ValidationRule.max` (숫자 범위 검증)
- 기존 사용처: `spec/4-nodes/6-presentation/4-form.md §1` 및 `codebase/backend/src/nodes/presentation/form/form.schema.ts:24-25` (`validationRuleSchema` 내 `min: z.number().optional()` / `max: z.number().optional()`)
- 상세: target 이 "Planned" 에서 "구현됨"으로 상태를 올린 것이지 새 필드 이름을 도입한 것이 아니다. `min`/`max` 는 기존 schema 에 이미 선언돼 있고 (`form.schema.ts:24-25`), `FormModalField.min` / `FormModalField.max` 도 이번 PR 에서 `codebase/backend/src/modules/chat-channel/types.ts:246-247` 에 추가됐다. `transform` 노드의 `args.pattern`(날짜 포맷 문자열)과 이름이 다르고 (`args.pattern` vs `validation.min`), 형제 네임스페이스가 완전히 분리돼 충돌 없음.
- 제안: 없음.

### [INFO] `validation.pattern` — 여러 곳에 같은 단어가 있으나 네임스페이스 분리됨

- target 신규 식별자: `ValidationRule.pattern` (custom 정규표현식 검증), `FormModalField.pattern` (서버 검증 전용)
- 기존 사용처:
  - `spec/4-nodes/5-data/1-transform.md §63`: transform 노드 `format` operation 의 `args.pattern` (날짜 포맷 문자열 — `"YYYY-MM-DD HH:mm:ss"` 류)
  - `spec/5-system/5-expression-language.md §266-267`: 표현식 함수 `formatDate(dateStr, pattern)`, `parseDate(str, pattern?)` 의 `pattern` 인수 (날짜 포맷 문자열)
  - `spec/5-system/14-external-interaction-api.md §645`: `workspace_settings.notification_url_allow_pattern` (URL 허용 패턴 설정 키)
  - `spec/conventions/chat-channel-adapter.md §426,434,443`: client-side 검증 "type/pattern/minLength" 맥락에서 `pattern` 이 이미 form 검증 규칙을 지칭하는 용어로 사용 중
  - `codebase/backend/src/modules/chat-channel/types.ts:252`: `FormModalField.pattern?` — 이번 PR 에서 추가된 동일 필드
- 상세: `validation.pattern` (FormField 검증용 정규식)과 transform/expression-language 의 `pattern` (날짜 포맷 문자열)은 소속 엔티티·타입·네임스페이스가 완전히 다르다. `FormModalField.pattern` 은 `types.ts:250` 에 "transform 노드의 날짜 포맷 `args.pattern` 과는 무관하다" 고 명시 주석이 이미 기재돼 있다. `chat-channel-adapter.md` 의 기존 용례도 form validation 규칙으로서의 `pattern` 을 이미 같은 의미로 지칭하고 있어 충돌이 아닌 일치다.
- 제안: 없음. 기존 구현 주석이 혼동 차단 역할을 충분히 수행하고 있다.

### [INFO] `MAX_PATTERN_LENGTH` 상수 — 기존 상수와 충돌 없음

- target 신규 식별자: `MAX_PATTERN_LENGTH = 512` (`codebase/backend/src/modules/chat-channel/shared/form-mode.ts:154`)
- 기존 사용처: 동일 파일 내에서만 사용되는 모듈 스코프 상수. 프로젝트 전역에서 동명 상수 없음.
- 상세: 파일 내부 상수로 외부 export 없음. 충돌 없음.
- 제안: 없음.

### [INFO] EIA 링크 앵커 교정 (`#51-에러-코드` → `#51-인터랙션-명령-제출--post-apiexternalexecutionsexecutionidinteract`)

- target 변경: `spec/4-nodes/6-presentation/4-form.md §6.2` 의 EIA 참조 링크 앵커
- 기존 사용처: 기존 `#51-에러-코드` 앵커는 EIA 문서에 존재하지 않는 잘못된 앵커였음 (`spec/5-system/14-external-interaction-api.md` 내 §5.1 제목은 "인터랙션 명령 제출 — `POST /api/external/executions/:executionId/interact`")
- 상세: 신규 앵커 `#51-인터랙션-명령-제출--post-apiexternalexecutionsexecutionidinteract` 가 실제 섹션 제목과 일치한다. 이는 기존 깨진 링크 수정이므로 충돌이 아닌 정정.
- 제안: 없음.

### [INFO] Rationale 소제목 변경 — 기존 절과 중복 없음

- target 신규 식별자: `### \`validation.min\`/\`max\`·\`pattern\` 은 공유 validator 확장으로, file 검증은 cluster 로 분리` (Rationale 소제목)
- 기존 사용처 (변경 전): `### file 검증(MIME/크기/개수)·\`validation.min\`/\`max\`·\`pattern\` 분리 defer`
- 상세: 같은 Rationale 절의 제목이 구현 완료 상태를 반영해 바뀐 것이므로 중복 섹션 생성이 아니다.
- 제안: 없음.

---

## 요약

target 문서(`spec/4-nodes/6-presentation/4-form.md`)가 도입하는 신규 식별자는 모두 기존에 정의되거나 예정된 범위 내에 있다. `validation.min`/`max`/`pattern` 은 기존 `validationRuleSchema`에 이미 선언된 필드이며, 이번 변경은 "Planned"에서 "구현됨"으로의 상태 전환이지 새 식별자 도입이 아니다. `pattern` 이라는 단어가 transform 노드 / 표현식 언어 / URL allowlist 등 여러 맥락에 분산 존재하지만 각각의 타입·네임스페이스·소속 엔티티가 명확히 다르며, 기존 코드 주석에서도 이미 구분 설명을 제공하고 있다. EIA §5.1 링크 앵커 교정은 충돌 해소에 해당한다. 신규 식별자 충돌 관점에서 발견된 문제는 없다.

## 위험도

NONE
