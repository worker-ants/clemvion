# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] EmbedConfigDto — JSDoc 과 @ApiProperty description 사이 미묘한 표현 차이
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts` 라인 69
- 상세: `enforce` 필드의 JSDoc 주석(`/** soft 차단 활성 여부 — allowlist 가 1개 이상일 때 true. enforce=true + 호스트 origin 불일치 시 위젯이 렌더/시작 거부. */`)과 `@ApiProperty({ description: ... })` 문자열이 미묘하게 다른 표현을 사용한다. JSDoc 에는 "enforce=true + 호스트 origin 불일치 시 위젯이 렌더/시작 거부"이고, @ApiProperty 에는 "위젯은 enforce=true 이고 호스트 origin 이 allowlist 에 없으면 렌더/시작을 거부한다"로 표현만 다를 뿐 동일 의미이다. 기능 오류는 아니나, Swagger 독자와 코드 독자가 서로 다른 단편을 볼 수 있어 미래에 한쪽만 수정될 경우 drift 가 생길 수 있다.
- 제안: JSDoc 을 @ApiProperty description 과 동일 문자열로 통일하거나, 반대로 JSDoc 을 "권위"로 삼고 @ApiProperty 는 `description: enforce_doc`처럼 상수로 연결한다. 단, 현재 두 설명이 의미적으로 일치하므로 차단 대상 아님.

---

### [INFO] safeApiBaseFromQuery — export 되었지만 모듈 레벨 JSDoc 만 있고 파라미터/반환 @param·@returns 태그 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/channel-web-chat/src/widget/use-widget.ts` 라인 191-206
- 상세: 새로 `export` 된 공개 함수 `safeApiBaseFromQuery` 에 다단 JSDoc 블록이 있어 함수 목적·보안 이유·동작 설명이 잘 문서화되어 있다. 그러나 TypeScript 프로젝트에서 공개 함수에 일반적으로 기대되는 `@param raw` 및 `@returns` 태그가 없다. 본 함수는 단순하고 시그니처가 자명하므로 기능 이해에 지장은 없으나, 프로젝트 내 다른 공개 함수들과 문서화 스타일을 맞추려면 추가가 바람직하다.
- 제안: 필요 시 `@param raw - 검증할 URL 문자열. null 이면 undefined 반환(경고 없음).` 및 `@returns http(s) URL 이면 원 문자열, 그 외 undefined.` 를 추가한다. 프로젝트 규약 상 @param/@returns 생략이 허용된다면 현 상태 유지가 적절하다.

---

### [INFO] use-widget.test.ts — 테스트 describe 블록에 보안 컨텍스트 주석이 함수 수준에만 있고 파일 상단에 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/channel-web-chat/src/widget/use-widget.test.ts` 라인 105
- 상세: `safeApiBaseFromQuery` describe 블록 위에 "쿼리 apiBase 하드닝 — http(s) 스킴만 허용(direct-load 외부 입력 방어)." 한 줄 주석이 있어 맥락이 잘 제공된다. 기존 첫 describe 블록("use-widget — 토큰 갱신 헬퍼 re-export") 위에도 유사한 방식으로 배경 주석이 있어 일관성이 갖추어져 있다. 현 상태 양호.
- 제안: 없음.

---

### [INFO] plan/in-progress/webchat-polish-batch.md — 절차 체크박스가 아직 미완료 상태로 커밋됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/plan/in-progress/webchat-polish-batch.md` 라인 778-781
- 상세: `## 절차` 섹션의 4개 항목(`/consistency-check --impl-prep`, `TEST WORKFLOW`, `/ai-review`, `/consistency-check --impl-done`)이 모두 `[ ]`(미완료)로 커밋됐다. 프로젝트 memory 기준("plan 체크박스 = 실제 상태")에 따라 수행 완료 시 체크박스를 갱신해야 하며, consistency-check --impl-prep 는 이미 `review/consistency/2026/06/28/14_36_34/SUMMARY.md` 산출물이 존재해 완료된 것으로 보인다. 코드 리뷰가 진행 중이므로 해당 항목은 완료 후 체크되어야 한다.
- 제안: `/consistency-check --impl-prep → BLOCK: NO` 항목을 `[x]`로 갱신하고, 이후 단계도 완료 시마다 체크하여 커밋에 포함한다. 현재 이 리뷰가 진행 중이므로 `/ai-review + Critical/Warning 0` 항목은 리뷰 완료 후 갱신한다.

---

### [INFO] use-widget.ts — 내부 비공개 함수 configFromQuery·fetchEmbedConfig·isEmbedAllowed 에 JSDoc 주석 있음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/channel-web-chat/src/widget/use-widget.ts` 라인 251-284
- 상세: `fetchEmbedConfig`, `isEmbedAllowed` 등 내부 함수에 한 줄 JSDoc 주석이 있고, `configFromQuery` 에도 짧은 주석이 있다. 이들은 비공개 함수이나 문서화가 잘 되어 있다. 새로 추가된 `safeApiBaseFromQuery` 만 `export` 되어 있어 공개/비공개 구분이 명확하다. 양호한 상태.
- 제안: 없음.

---

### [INFO] spec/7-channel-web-chat/1-widget-app.md — `isTextInputSurface` SoT 언급 추가, 인라인 참조 명시
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/spec/7-channel-web-chat/1-widget-app.md` 라인 46(패치된 줄)
- 상세: 입력창 활성 조건이 `ai_conversation` 단독에서 "텍스트 표면 = `ai_conversation` 또는 `pending=null`(ai_conversation 도달 전 과도 상태)"로 구체화되고, 판정 SoT로 `widget-state.isTextInputSurface`가 명시되었다. 이는 코드와 spec 간 SPEC-DRIFT 를 해소하며, 구현체를 spec 에서 가리키는 방향이라 문서화 방향이 적절하다.
- 제안: 없음. 변경이 적절하다.

---

### [INFO] spec/7-channel-web-chat/2-sdk.md — §1 메서드 열거에 resetSession 추가, §3 표·§5 타입과 정렬
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/spec/7-channel-web-chat/2-sdk.md` 라인 2023-2024(패치된 줄)
- 상세: `§1` 스니펫 로더 산문의 메서드 열거에 `resetSession`이 추가되어 §3 `wc:command` 표 및 §5 `ChatInstance` 타입과 정렬이 맞춰졌다. 세 위치(`§1 산문`, `§3 표`, `§5 타입`)의 일관성이 확보된다.
- 제안: 없음. 변경이 적절하다.

---

### [INFO] review/ 산출물 파일들 — 내부 워크플로우 아티팩트로 사용자 문서가 아님
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polski-batch-99e2ed/review/consistency/2026/06/28/14_36_34/` 하위 파일들
- 상세: `SUMMARY.md`, `cross_spec.md`, `rationale_continuity.md`, `convention_compliance.md`, `plan_coherence.md`, `naming_collision.md`, `_retry_state.json`, `meta.json` 은 모두 프로젝트 내부 일관성 검토 프로세스 산출물이다. 이 파일들은 사용자 향 문서가 아니므로 별도 README 업데이트나 API 문서화가 필요하지 않다. 다만 `_retry_state.json`은 `agents_pending`에 5개 agent가 남아 있고 `agents_success`가 비어 있어(워크플로우 초기 상태 스냅샷) 내용이 실제 완료 상태를 반영하지 않으나, 이는 문서화 문제가 아닌 상태 파일의 성격이다.
- 제안: 없음(문서화 관점 이슈 아님).

---

## 요약

이번 변경의 문서화 품질은 전반적으로 양호하다. 핵심 코드 변경 두 건(`EmbedConfigDto` JSDoc 추가, `safeApiBaseFromQuery` export + 다단 JSDoc)은 목적·동작·보안 이유가 명확히 서술되어 있으며, spec 변경(`1-widget-app.md`, `2-sdk.md`)도 코드 SoT 를 명시하거나 누락된 메서드 열거를 보충해 spec-impl 정합성을 높였다. 발견된 사항들은 모두 INFO 등급으로, `EmbedConfigDto` JSDoc 과 Swagger description 간 표현 일치 개선, `safeApiBaseFromQuery` @param/@returns 태그 추가 검토, plan 체크박스 갱신의 세 가지 선택적 개선 사항이다. 차단 수준(CRITICAL/WARNING) 문서화 문제는 없다.

## 위험도

NONE
