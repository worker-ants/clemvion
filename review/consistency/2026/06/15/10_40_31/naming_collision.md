# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-draft-form-validation-enum.md`

---

## 발견사항

이 draft 가 도입하는 변경은 세 곳의 illustrative 열거 문자열을 확장하는 것이다. 새로운 요구사항 ID, 엔티티/타입명, API endpoint, 이벤트명, 환경변수, 설정키, 파일경로를 신규 정의하지 않는다.

### INFO — `maxLength` 표기 네임스페이스 주의 (충돌 아님)

- **target 신규 식별자**: `maxLength` (chat-channel-adapter §4.1 step 4 및 §4.2 step 3 의 schema-level 검증 규칙 열거에 추가)
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/spec-sync-form-validation-enum-bc3d96/spec/conventions/chat-channel-adapter.md` line 434 에는 Slack/Discord provider-native API 속성 `min_length`/`max_length`(snake_case)가 이미 등장한다.
- **상세**: target 이 추가하는 `maxLength`(camelCase)는 `form.schema.ts` 의 `validationRuleSchema` 필드명(`validation.maxLength`)이고, line 434 의 `max_length`(snake_case)는 Slack/Discord modal API 의 provider-native input 속성이다. 두 표기는 다른 네임스페이스(schema-level vs provider-native API)에 속하며 문서 문맥도 명확히 구분되어 혼동 위험이 낮다. 단, 같은 파일 안에 두 표기가 공존하므로 독자가 오해하지 않도록 기존 line 434 처럼 provider 출처를 명시하는 패턴이 이미 있어 충돌 없이 병존 가능하다.
- **제안**: 현행화 기술에 문제는 없으나, §4.1 step 4 의 변경 문구에서 `minLength·maxLength`(schema 규칙) 와 provider-native `min_length`/`max_length` 를 혼동하지 않도록 기존 line 434 의 병기 방식(`provider native 검증 (Slack input min_length/max_length...)`)이 이미 명확히 분리되어 있음을 확인하는 것으로 충분하다.

---

해당 draft 가 도입하는 식별자 변경은:
1. **요구사항 ID**: 신규 ID 없음 — 기존 섹션 본문의 예시 열거만 확장.
2. **엔티티/타입명**: 신규 엔티티·DTO·인터페이스명 없음.
3. **API endpoint**: 신규 endpoint 없음.
4. **이벤트/메시지명**: 신규 이벤트명 없음 — `VALIDATION_ERROR` 는 기존 코드이며 설명 열거 보강만.
5. **환경변수·설정키**: 신규 ENV var / config key 없음.
6. **파일 경로**: 신규 파일 생성 없음 — 기존 두 파일(`spec/conventions/chat-channel-adapter.md`, `spec/5-system/6-websocket-protocol.md`)의 인라인 텍스트 수정만.

---

## 요약

이 draft 는 `validateFormSubmission` 이 이미 구현한 `min`/`max`(숫자 범위)·`pattern`·`maxLength` 검증을 기존 illustrative 열거("등" 표현)에 보완 추가하는 순수 문서 동기화다. 신규 요구사항 ID, 엔티티/타입명, API endpoint, 이벤트명, 환경변수, 설정키, 파일 경로가 전혀 도입되지 않으므로 식별자 충돌 위험이 없다. `maxLength`(schema camelCase)가 같은 파일에 이미 존재하는 provider-native `max_length`(snake_case)와 혼동될 수 있으나, 두 표기는 다른 네임스페이스에 속하며 기존 문서가 충분히 맥락을 구분하고 있어 충돌이 아닌 INFO 수준으로 분류한다.

## 위험도

NONE
