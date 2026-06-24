# 보안(Security) 리뷰 결과

리뷰 대상 커밋: `86cd2a97` — `fix(workflow-assistant): system-prompt Self-review skip 안내를 코드에 정합`

변경 파일:
- `codebase/backend/src/modules/workflow-assistant/prompts/system-prompt.spec.ts`
- `codebase/backend/src/modules/workflow-assistant/prompts/system-prompt.ts`
- `review/consistency/2026/06/24/14_03_16/SUMMARY.md` (산출물)
- `review/consistency/2026/06/24/14_03_16/_retry_state.json` (산출물)
- `review/consistency/2026/06/24/14_03_16/convention_compliance.md` (산출물)
- `review/consistency/2026/06/24/14_03_16/cross_spec.md` (산출물)
- `review/consistency/2026/06/24/14_03_16/meta.json` (산출물)
- `review/consistency/2026/06/24/14_03_16/naming_collision.md` (산출물)

---

## 발견사항

### **[INFO]** `system-prompt.ts`: 사용자 입력(`userRequest`)의 XSS/프롬프트 인젝션 새니타이징이 테스트로 명시적 검증됨

- 위치: `codebase/backend/src/modules/workflow-assistant/prompts/system-prompt.ts` — `buildSystemPrompt` + `renderActivePlanSection`; 검증 테스트: `system-prompt.spec.ts` lines 359–386, 627–673
- 상세: `userRequest`, `plan.title`, `openQuestions` 에 마크다운 헤더(`#`), 백틱, 꺾쇠(`<`/`>`) 가 입력될 때 fullwidth 치환·prefix neutralization·길이 상한(200자) 이 동작함을 회귀 단언으로 고정. XML fence `<user-request>...</user-request>` 로 사용자 입력을 지시문과 격리하는 구조도 테스트로 보장됨. 이번 변경에서 해당 방어 로직이 추가·제거되지 않았으므로 기존 방어가 유지된다.
- 제안: 없음. 현재 수준으로 충분히 방어적.

### **[INFO]** `_retry_state.json` 내 절대 경로 노출

- 위치: `review/consistency/2026/06/24/14_03_16/_retry_state.json` — `session_dir`, `prompt_file`, `output_file` 값들
- 상세: `/Volumes/project/private/clemvion/...` 형태의 로컬 절대 경로가 review 산출물에 기록됨. 이는 리뷰 워크플로 아티팩트이며 코드 런타임에 반영되지 않는다. 저장소가 내부 전용이면 수용 가능하나, 만약 이 저장소가 공개될 경우 개발자 머신 경로 구조가 노출될 수 있다.
- 제안: 산출물 JSON에 절대 경로 대신 저장소 루트 기준 상대 경로를 기록하는 방식을 중장기적으로 고려.

### **[INFO]** 하드코딩된 시크릿 없음 확인

- 위치: 전체 변경 파일
- 상세: API 키, 비밀번호, 토큰, 인증서 등 시크릿이 코드나 산출물에 직접 포함된 사례 없음. `[REDACTED]` 는 프롬프트 교육 내 예시 문자열로 실제 시크릿이 아님.

### **[INFO]** 인증/인가 관련 변경 없음

- 위치: 전체 변경 파일
- 상세: 이번 변경은 LLM 시스템 프롬프트 문자열 및 단언 테스트만 수정하며(behavior-neutral), 인증·인가·세션 관련 코드 경로에 접촉이 없다.

### **[INFO]** `snapshotJson` — 워크플로우 스냅샷을 LLM 프롬프트에 직렬화하는 패턴

- 위치: `system-prompt.ts` 내 `buildSystemPrompt` 함수, `snapshotJson = JSON.stringify(toWorkflowView(snapshot))` 라인
- 상세: 이번 변경과 직접 관련은 없으나, 스냅샷 내 민감 필드(`apiKey`, `token` 등)가 `[REDACTED]` 처리되어 LLM 에 전달된다는 방어가 프롬프트 교육(`## Editing an existing node's config` 섹션)에 명시되어 있다. `toWorkflowView` 함수가 실제로 민감 키를 마스킹하는지는 이번 diff 범위 밖이나, 기존 구조가 유지되고 있음이 확인된다.
- 제안: `toWorkflowView` 의 필드 마스킹 로직이 별도 단위 테스트로 커버되어 있는지 주기적으로 확인 권고.

---

## 요약

이번 변경은 LLM 시스템 프롬프트 문자열의 Self-review skip 안내를 코드 동작에 맞게 정정(behavior-neutral)하고 회귀 단언 2건을 추가한 것으로, 실제 서버 동작이나 인증·인가·데이터 흐름에 변경이 없다. 보안 관점에서 주목할 신규 취약점이 도입되지 않았다. `userRequest` 등 사용자 입력에 대한 프롬프트 인젝션 방어(마크다운 헤더 중화, fullwidth 꺾쇠 치환, 길이 상한, XML fence 격리)는 기존 구조가 그대로 유지되며 테스트로 잠금된 상태다. 유일한 미세 지적은 review 산출물 JSON에 로컬 절대 경로가 기록되는 패턴으로, 저장소가 내부 전용인 한 실질 위험은 없다.

## 위험도

NONE
