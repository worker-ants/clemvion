# 부작용(Side Effect) 리뷰

## 발견사항

### [WARNING] `startHeadlessChat` 함수 시그니처 변경 — 기존 호출자 파괴적 변경
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-webchat-doc-strings/codebase/packages/web-chat-sdk/examples/byo-ui-headless.ts` (34행)
- 상세: `firstMessage: string` 파라미터가 제거되고 `profile?: Record<string, unknown>` 파라미터가 추가됐다. 파라미터 순서도 변경됐다 — `(apiBase, endpointPath, firstMessage, handlers)` → `(apiBase, endpointPath, handlers, profile?)`. 이는 위치 기반 파라미터이므로 기존 호출자가 `firstMessage` 위치에 `handlers` 객체를 전달하면 타입 불일치(런타임 오류 또는 silently wrong)가 발생한다. 현재 codebase 내 직접 호출자는 없음(grep 확인)이므로 내부 파괴적 영향은 없으나, 이 파일이 `export` 된 공개 API이고 패키지 사용자가 있다면 breaking change다.
- 제안: 패키지가 publish 되지 않은 internal-only 상태(README 확인: "publish 정책은 internal-only(별도 지정 전까지)")라면 현재 internal 사용자 없음이 확인됐으므로 위험도는 낮다. 단, 향후 publish 전에 CHANGELOG에 breaking change로 명시해야 한다.

### [INFO] `RagSearchDto.topK` — Swagger `default: 5` 제거, 런타임 동작 영향 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-webchat-doc-strings/codebase/backend/src/modules/knowledge-base/dto/rag-search.dto.ts` (33-44행)
- 상세: `@ApiPropertyOptional` 의 `default: 5` 메타데이터가 제거됐다. 이는 Swagger 문서에서 "기본값 5"로 표시되던 것이 사라지는 효과다. 실제 런타임 default 처리는 서비스 레이어(`rag-search.service.ts` 142행: `options?.topK ?? RAG_MAX_INJECT_COUNT`)에서 하므로 런타임 동작에는 영향 없다. Swagger UI 에서 "기본값" 표시가 사라지는 것이 의도된 변경이라면 적합하다.
- 제안: 문서상 default 제거가 의도된 것인지 확인. 실제 런타임 동작(RAG_MAX_INJECT_COUNT 상수값)을 Swagger description에 언급하면 API 사용자 혼란이 줄어든다.

### [INFO] DTO Swagger `description` 변경 — 런타임 부작용 없음
- 위치: `create-knowledge-base.dto.ts`, `update-knowledge-base.dto.ts` — `rerankMode` 및 `rerankLlmConfigId` description 문자열 변경
- 상세: `@ApiPropertyOptional` 의 `description` 필드 변경은 Swagger 문서 생성 시 메타데이터로만 사용된다. class-validator 데코레이터(`@IsIn`, `@IsUUID` 등)에는 변경 없어 런타임 유효성 검증 동작이 동일하다. 전역/공유 상태, 환경 변수, 네트워크 호출에 영향 없다.
- 제안: 없음.

### [INFO] README.md 코드 스니펫 수정 — 문서 파일, 런타임 부작용 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-webchat-doc-strings/codebase/packages/web-chat-sdk/README.md` (61-73행)
- 상세: Markdown 파일 내 코드 예시가 `{ firstMessage }` → `{ profile }` 로 변경됐다. 문서 파일이므로 런타임 실행 코드가 아니며 어떤 부작용도 없다.
- 제안: 없음.

### [INFO] `plan/in-progress` 작업 추적 문서 갱신 — 부작용 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/rag-webchat-doc-strings/plan/in-progress/spec-code-cross-audit-2026-06-10.md`
- 상세: 체크박스 상태와 브랜치 이름 업데이트(PR 번호 명시, 새 항목 추가). 추적 문서이며 런타임 코드가 아니다.
- 제안: 없음.

## 요약

이번 변경의 핵심은 DTO Swagger 설명 문자열 정정(V-16)과 BYO-UI 헬퍼 함수의 폐기된 `firstMessage` 패턴 제거(V-17)다. DTO 변경은 모두 문서 메타데이터 수준이며 유효성 검증 로직, 전역 상태, 네트워크 호출에 영향을 주지 않는다. 유일한 주목 지점은 `startHeadlessChat` 함수의 파라미터 시그니처 변경으로, `firstMessage` 제거 + `profile` 추가 + 위치 순서 변경이 복합적으로 발생해 기존 호출자가 있다면 파괴적 변경이 된다. 그러나 현재 codebase 내 직접 호출자가 없고 패키지가 internal-only 상태임을 확인했으므로 실질적 위험은 낮다.

## 위험도

LOW
