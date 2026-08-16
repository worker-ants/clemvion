# 변경 범위(Scope) Review

## 발견사항

- **[WARNING]** 새 함수(`redactTerminalError`) docstring 을 삽입하면서 기존 `toTerminalErrorPayload` 의 `@param`/`@returns` JSDoc 이 궤도 이탈(orphan)했다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:47-91`
    (`@param err ...`/`@returns ...` 블록 47-51행, 새 `redactTerminalError` JSDoc 52-80행,
    `function redactTerminalError` 81행, `export function toTerminalErrorPayload` 91행)
  - 상세: diff 전에는 47-51행의 JSDoc(`@param err`, `@returns`)이 바로 아래 `toTerminalErrorPayload` 선언에 붙어 있었다. 이번 변경이 그 사이에 `redactTerminalError` 의 새 JSDoc(52-80행)과 함수 본문(81-89행)을 통째로 끼워 넣으면서, 47-51행 블록은 이제 자신이 설명하던 함수(`toTerminalErrorPayload`, 91행)로부터 두 블록만큼 멀어졌다. JSDoc 툴링(TSDoc/IDE hover)은 선언 바로 위 주석만 그 선언에 귀속시키므로, 47-51행은 사실상 어디에도 붙지 않는 dangling 주석이 되고 `toTerminalErrorPayload` 자신은 `@param`/`@returns` 문서를 hover 로 더 이상 못 보여준다. 리뷰 관점 6번("주석 변경: 불필요한 주석 추가/삭제/수정")에 해당하는, 의도치 않은 부작용이다. 기능적 결함은 아니지만 이번 diff 가 만든 회귀다.
  - 제안: `redactTerminalError`(신규 함수+JSDoc)를 `toTerminalErrorPayload` 의 `@param`/`@returns` 블록보다 **앞**으로 옮기거나, 47-51행 블록을 `toTerminalErrorPayload` 선언 바로 위(91행 직전)로 재배치해 원래 귀속을 복원할 것.

## 요약

이번 diff(13개 파일, `+724/-8`)는 `plan/in-progress/eia-terminal-error-sanitize.md` 가 명시한 조치 목록과 1:1로 대응한다 — `toTerminalErrorPayload` 내부 egress 마스킹 추가(파일 3), `sanitize-error-message.ts` 과장된 첫 줄 정정(파일 1, 순수 docstring만 변경), 회귀/음성 테스트 추가(파일 2), 자매 트래커 체크박스 동시 갱신(파일 5), 그리고 `--impl-prep` 의무 단계인 consistency-check 산출물(파일 6-13, `review/consistency/**`)이다. `git diff --stat` 로 대조해도 프롬프트에 나열된 13개 파일 외 추가 변경은 없고, plan 문서의 "범위 밖" 절이 노드 핸들러 raw 메시지·`error-policy` output·500자 절단 정책을 명시적으로 제외해 스코프가 사전에 좁게 고정돼 있다. 각 파일의 diff 도 해당 목적 이외의 리팩토링·포맷팅·불필요한 import 변경은 발견되지 않았다. 유일한 흠은 새 함수 삽입 위치로 인해 기존 함수의 JSDoc 이 궤도를 이탈한 부수 효과(WARNING 1건)이며, 이는 스코프 확장이 아니라 삽입 위치 실수에 가깝다.

## 위험도
LOW
