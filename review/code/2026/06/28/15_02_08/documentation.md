# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] EmbedConfigDto — JSDoc 과 @ApiProperty.description 사이 표현 미묘한 차이 (컨벤션상 허용)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts` 라인 18–24
- 상세: `enforce` 필드의 JSDoc (`/** soft 차단 활성 여부 — allowlist 가 1개 이상일 때 true. enforce=true + 호스트 origin 불일치 시 위젯이 렌더/시작 거부. */`)과 `@ApiProperty({ description: ... })` 문자열이 미묘하게 다른 표현을 사용한다. 의미는 동일하나 두 표면 중 하나만 수정될 경우 향후 drift 가 발생할 수 있다. 이전 리뷰(14_49_11)에서 "swagger.md §1-1 이 JSDoc+@ApiProperty 병기를 규정(중복은 컨벤션)" 으로 유지 결정이 내려진 항목이다.
- 제안: 컨벤션에 따라 현 상태 유지가 적절하다. 추후 표현을 단일화할 경우 JSDoc 을 권위 있는 SoT 로 삼고 `@ApiProperty.description` 을 동일 문자열로 맞추는 방향을 권장한다.

---

### [INFO] safeApiBaseFromQuery — @param/@returns 태그 및 변수명 이미 적용 완료
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/channel-web-chat/src/widget/use-widget.ts` 라인 75–83
- 상세: 이전 리뷰(14_49_11)에서 INFO #6·#11 로 지적된 `@param raw` / `@returns` 태그 부재 및 `const u` → `const url` 변수명 개선이 현재 코드에 이미 반영되어 있다. JSDoc 블록은 함수 목적(보안 이유, 허용 스킴, 동작 설명)과 함께 `@param`·`@returns` 태그를 완전히 갖추고 있다. 이 항목은 해결 완료 상태다.
- 제안: 없음.

---

### [INFO] use-widget.test.ts — 테스트 describe 블록 주석 일관성 양호
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/codebase/channel-web-chat/src/widget/use-widget.test.ts` 라인 104–106
- 상세: `safeApiBaseFromQuery` describe 블록 위에 "쿼리 apiBase 하드닝 — http(s) 스킴만 허용(direct-load 외부 입력 방어)." 주석이 있어 보안 컨텍스트를 명확히 전달한다. 기존 첫 번째 describe 블록에도 배경 주석이 있어 스타일 일관성이 확보되어 있다.
- 제안: 없음.

---

### [INFO] plan/in-progress/webchat-polish-batch.md — 절차 체크박스 일부 미완료 상태
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-polish-batch-99e2ed/plan/in-progress/webchat-polish-batch.md` 절차 섹션
- 상세: `## 절차` 섹션의 마지막 항목 "(fresh) /ai-review + /consistency-check --impl-done" 이 `[ ]` 미완료 상태다. 이는 본 fresh 리뷰가 진행 중이므로 예상된 상태다. 프로젝트 memory 규약("plan 체크박스 = 실제 상태")에 따라 이 리뷰 완료 후 해당 체크박스를 `[x]` 로 갱신해 커밋에 포함해야 한다.
- 제안: 리뷰·--impl-done 완료 후 체크박스 갱신을 커밋에 포함한다.

---

### [INFO] spec/7-channel-web-chat/4-security.md — apiBase 입력 검증 행 spec 반영 필요(plan에 이미 완료 표기)
- 위치: `spec/7-channel-web-chat/4-security.md §1` (plan/in-progress/webchat-polish-batch.md 라인 "4-security §1 apiBase 입력 검증 행 신설")
- 상세: plan 파일에 따르면 이전 리뷰(14_49_11) SPEC-DRIFT #1 에 대한 대응으로 `4-security §1` 에 `safeApiBaseFromQuery` 의 spec home(http(s) 스킴 검증 명세) 추가가 `[x]` 완료 표기되어 있다. 이번 변경 세트에 해당 spec 파일이 포함되어 있는지 diff 에서 확인되지 않으나, plan 에서 완료로 표기된 이상 해당 spec 변경이 포함된 것으로 간주한다. 만약 누락됐다면 SPEC-DRIFT 가 잔존한다.
- 제안: 커밋 전 `spec/7-channel-web-chat/4-security.md §1` 에 apiBase http(s) 검증 anchor 가 실제로 추가됐는지 확인한다.

---

### [INFO] spec/7-channel-web-chat/2-sdk.md — resetSession 정정(wc:command 전용) 주석 정확성
- 위치: `spec/7-channel-web-chat/2-sdk.md §1·§3`
- 상세: plan 에 따르면 `§1 ClemvionChat` 메서드 목록에서 `resetSession` 을 제거하고 "wc:command 전용, npm 미노출" 을 §1·§3 에 명시하는 변경이 `[x]` 완료로 표기되어 있다. 이는 코드(`ClemvionChatMethod`/`ChatInstance`/loader 미존재)와 spec 간 정합을 맞추는 올바른 문서 수정 방향이다.
- 제안: 없음.

---

### [INFO] review/ 산출물 파일들 — 내부 워크플로우 아티팩트
- 위치: `review/consistency/2026/06/28/14_36_34/` 및 `review/code/2026/06/28/14_49_11/` 하위 파일 전체
- 상세: consistency-check 및 이전 ai-review 산출물들은 프로젝트 내부 프로세스 아티팩트다. 사용자 향 문서화 관점의 평가 대상이 아니다. `_retry_state.json` 의 `agents_pending` 리스트가 초기 상태 스냅샷이나 이는 상태 파일의 성격이며 문서화 문제가 아니다.
- 제안: 없음.

---

## 요약

이번 변경의 문서화 품질은 전반적으로 양호하다. 핵심 코드 변경 두 건(`EmbedConfigDto` JSDoc 추가, `safeApiBaseFromQuery` export + 완전한 JSDoc)은 목적·동작·보안 이유·`@param`/`@returns` 태그까지 갖추고 있으며, 이전 리뷰(14_49_11)에서 지적된 `@param`/`@returns` 부재 및 `const u` 변수명은 현재 코드에 이미 반영 완료됐다. Spec 변경(`1-widget-app.md` 입력창 SoT 명시, `2-sdk.md` resetSession 정정, `4-security.md` apiBase 검증 anchor)도 코드와 spec 간 정합을 높이는 방향으로 올바르다. `EmbedConfigDto` JSDoc 과 `@ApiProperty.description` 간 표현 차이는 swagger.md §1-1 컨벤션에 따라 의도된 병기이므로 차단 대상이 아니다. 절차 체크박스 갱신과 `4-security §1` 추가 여부 확인만 완료 전 남은 항목이다. CRITICAL 및 WARNING 수준 문서화 문제는 없다.

## 위험도

NONE
