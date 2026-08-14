# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인 (선행 조사)

`--impl-done, scope=spec/5-system/, diff-base=origin/main` 로 지정됐으나, 실측 결과 **이번 diff 는 `spec/5-system/` 를 포함해 `spec/` 하위 어떤 파일도 변경하지 않는다**:

```
git diff origin/main --stat -- spec/5-system/   → (출력 없음)
```

실제 코드 변경은 `codebase/` 6개 파일뿐이다 (신규 2 · 수정 4):

- 신규: `codebase/backend/src/shared/utils/strip-external-only-fields.ts`
- 신규: `codebase/backend/src/shared/utils/strip-external-only-fields.spec.ts`
- 수정: `codebase/backend/src/modules/websocket/websocket.service.ts` (+51/-51 net 재배치)
- 수정: `codebase/backend/src/modules/websocket/websocket.service.spec.ts`
- 수정: `codebase/backend/src/modules/external-interaction/interaction.service.ts`
- 수정: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts`

따라서 "target 문서가 새로 부여하는 요구사항 ID/엔티티명/endpoint/이벤트명/ENV 키" 자체가 존재하지 않는다 — spec 본문에 신규 도입 선언이 없다. 아래는 실제 diff 가 도입한 **코드 식별자**를 6개 관점에 대조한 결과다.

## 신규 식별자 인벤토리 (diff 기준)

| 식별자 | 성격 | 비고 |
|---|---|---|
| `stripExternalOnlyFields(value, maxDepth)` | 함수, export 승격 + 시그니처 변경 | 원래 `websocket.service.ts` 내부 비-export 함수였다(depth-1 shallow). 이번 PR 이 `shared/utils/strip-external-only-fields.ts` 로 이관하며 재귀형 + `maxDepth` 매개변수로 확장, `export` 로 승격해 `interaction.service.ts` 가 재사용 |
| `EXTERNAL_STRIPPED_FIELDS` | 상수, export 승격 | 동일하게 이관·export. 값은 `['llmCalls']` 로 불변 |
| `redactAndStrip(value)` | 함수, `interaction.service.ts` 신규 private 헬퍼 | 파일 스코프 로컬, export 안 됨 |

## 발견사항

### [INFO] 이관된 식별자명은 유지됨 — 진짜 충돌 없음
- target 신규 식별자: `stripExternalOnlyFields`, `EXTERNAL_STRIPPED_FIELDS`
- 기존 사용처: `codebase/backend/src/modules/websocket/websocket.service.ts` (구 버전, origin/main) 내부 스코프에 동일 이름으로 이미 존재
- 상세: 신규 도입이 아니라 **동일 개념·동일 이름의 이관(relocate) + export 승격**이다. 의미도 "외부 fanout debug 필드 제거"로 동일하며 시그니처만 `maxDepth` 매개변수가 추가됐다(shallow → 재귀). `spec/`, `plan/` 전체를 grep 해도 이 두 식별자가 다른 의미로 쓰인 곳은 없다(`plan/complete/eia-strick-llmcalls.md`, `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 모두 동일 의미로 참조). 유일한 잔존 참조는 `codebase/backend/dist/modules/websocket/websocket.service.js`(stale 빌드 산출물)뿐이며 이는 소스가 아니라 다음 빌드에서 갱신될 대상이라 충돌 판정 대상이 아니다.
- 제안: 없음(정보성). export 승격 시 JSDoc 이 `spec/5-system/6-websocket-protocol.md §4.4` 를 SoT 로 인용하는데, 코드 함수명이 spec 본문에 문자 그대로 등장하지 않는다 — 원하면 §4.4 Rationale("`ai_message.llmCalls[]` 외부 수신자 strip") 항목에 구현 함수명을 각주로 남겨 코드↔spec 대응을 명시할 수 있으나 필수는 아니다.

### [INFO] `redactAndStrip` — 로컬 스코프, 충돌 없음
- target 신규 식별자: `redactAndStrip` (`interaction.service.ts` 파일 스코프 함수)
- 기존 사용처: 없음 (전체 `codebase/` grep 결과 이번 diff 신규 3곳 호출부 외 등장 없음)
- 상세: export 되지 않는 module-private 헬퍼라 다른 파일과 충돌할 표면 자체가 없다.
- 제안: 없음.

### [INFO] 새 파일 경로는 기존 명명 컨벤션과 정합
- target 신규 식별자: `codebase/backend/src/shared/utils/strip-external-only-fields.ts` (+ `.spec.ts`)
- 기존 사용처: 같은 디렉터리의 `bcrypt-format.ts`, `retry-after.ts`, `sanitize-error-message.ts`
- 상세: kebab-case 동사구 파일명 컨벤션을 그대로 따른다. 기존 파일과 경로 중복 없음.
- 제안: 없음.

## 확인했으나 해당 없음 (6개 관점 중 나머지)

- **요구사항 ID 충돌**: spec 변경 없음 → 신규 ID 부여 없음. 해당 없음.
- **API endpoint 충돌**: diff 에 `@Post`/`@Get`/`@Controller` 등 신규 라우트 추가 없음(grep 결과 0건). 해당 없음.
- **이벤트/메시지명 충돌**: diff 에 `@SubscribeMessage` 등 신규 WS/webhook/SSE 이벤트명 추가 없음. 기존 `execution.waiting_for_input` 등 이벤트명은 이번 PR 이 새로 붙이는 것이 아니라 기존 wire 를 그대로 사용. 해당 없음.
- **환경변수·설정키 충돌**: diff 에 `process.env`/`ConfigService` 신규 참조 없음. `MAX_SANITIZE_DEPTH`(websocket.service.ts) · `MAX_REDACT_DEPTH`(sanitize-error-message.ts) 는 이번 PR 이 신설한 것이 아니라 기존 상수를 새 호출부(`interaction.service.ts`)가 import 해 재사용하는 것뿐이다. 해당 없음.

## 요약

이번 target 은 `spec/5-system/` 문서 자체를 변경하지 않는 순수 코드 변경(보안 픽스: REST `getStatus` 응답에서도 fanout 과 동일하게 `llmCalls` 를 strip)이라, "신규 식별자가 기존과 다른 의미로 충돌"할 표면이 구조적으로 거의 없다. 유일하게 새로 export 되는 두 식별자(`stripExternalOnlyFields`, `EXTERNAL_STRIPPED_FIELDS`)는 완전히 새로운 이름이 아니라 기존 `websocket.service.ts` 내부 스코프에 있던 것을 `shared/utils/`로 이관·재사용한 것이며 의미도 그대로다. 새 파일 경로는 기존 `shared/utils/` 명명 컨벤션을 따른다. 신규 endpoint·이벤트명·ENV 키·요구사항 ID는 전무하다. 유의미한 충돌 없음.

## 위험도

NONE
