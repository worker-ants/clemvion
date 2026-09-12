# 신규 식별자 충돌 검토 — `trigger-uuid-and-guide-codes`

## 조사 방법

- target scope(`spec/5-system/`)의 `origin/main` 대비 델타는 **0 파일** — 이 PR 은 그 spec 영역을
  바꾸지 않는다. 새 요구사항 ID·엔티티/DTO·API endpoint·이벤트명은 spec 레벨에서 애초에 도입되지
  않았다.
- 프롬프트에 실린 diff 본문이 예산 절단으로 비어 있어, 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/trigger-uuid-and-guide-codes`)를 절대경로로 직접
  `git diff origin/main...HEAD` 하여 실제 변경분(17 files / 1050+)을 확인했다.
- 실제 변경은 코드 하드닝(`ParseUUIDPipe`/`@ApiParam format:'uuid'` 부착) + repo-guard 신설 +
  가이드 문서(`content/docs/**`, MDX)·`plan/in-progress/**` 의 오귀속 정정이며, 신규 도메인
  식별자(요구사항 ID·엔티티·endpoint·이벤트·ENV·spec 파일 경로)를 도입하지 않는다.

## 관점별 확인 결과

1. **요구사항 ID** — 신규 ID 없음. 기존 `CCH-SE-04`/`R-CC-23` 등은 참조만, 재정의 없음.
2. **엔티티/타입명** — 신설 타입은 `param-uuid-pipe-guard.ts` 의 `UuidParamAxis`(union type),
   함수 `scanUuidParams`/`collectMethodViolations` 뿐이며 모두 그 파일 내부 스코프. 저장소 전체
   grep 결과 다른 곳에서 동명 사용 없음 — 충돌 없음.
3. **API endpoint 충돌** — 신규 endpoint 없음. 기존 `POST /api/triggers/:id/chat-channel/rotate-bot-token`,
   `PATCH/POST /api/auth/workspaces/:id/switch` 에 `ParseUUIDPipe`/`@ApiParam format:'uuid'`
   를 보강했을 뿐 method+path 변경 없음.
4. **이벤트/메시지명** — 변경 없음.
5. **환경변수·설정키** — 신규 ENV 없음. 가이드 문서의 `MCP_INSECURE_URL_ALLOWED`(오기) →
   `MCP_ALLOW_INSECURE_URL`(실재 기존 env, `.env.example`·`mcp.config.spec.ts`·
   `mcp-tool-provider.ts` 에 이미 존재)로 **정정**한 것으로, 새 키를 만든 게 아니라 기존 키에
   문서를 맞춘 것 — 충돌 아님.
6. **파일 경로 충돌**
   - 신규 파일: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts`,
     `param-uuid-pipe.spec.ts`, `fixtures/param-uuid-pipe/sample.controller.ts`. 기존
     `<name>-guard.ts` + `<name>.spec.ts` + `fixtures/<name>/` 3분할 컨벤션(예:
     `swagger-dto-contract-guard.ts`/`swagger-dto-contract.spec.ts`,
     `dto-class-name-collision-guard.ts`/`.spec.ts`)과 정확히 일치. 경로 충돌·컨벤션 위반 없음.
   - `plan/in-progress/trigger-uuid-and-guide-error-codes.md` (신규) — 기존
     `plan/complete/trigger-endpoint-path-uuid-validate.md` 와 "trigger"+"uuid" 토큰이 겹치나,
     후자는 2026-06-28 완료된 **DB CHECK 제약(`endpoint_path` 컬럼) 마이그레이션** 건이고
     전자는 **컨트롤러 `:id` 경로 파라미터의 `ParseUUIDPipe`/가이드 문서 정정** 건으로 대상
     리소스·계층이 다르다. 실질 의미 충돌은 아니나, 두 이름 모두 "trigger 의 uuid" 를 다루므로
     추후 `plan/` grep 시 사람이 혼동할 여지는 있다 (아래 INFO).

## 발견사항

- **[INFO]** plan 파일명 근접 — "trigger" + "uuid" 토큰 중복
  - target 신규 식별자: `plan/in-progress/trigger-uuid-and-guide-error-codes.md`
  - 기존 사용처: `plan/complete/trigger-endpoint-path-uuid-validate.md` (2026-06-28, DB
    CHECK 제약 `chk_trigger_endpoint_path_uuid` VALIDATE 승격)
  - 상세: 두 문서는 완전히 다른 계층(DB 컬럼 제약 vs REST `:id` 경로 파라미터 파이프)을
    다루며 내용 충돌은 없다. 다만 파일명만 보면 둘 다 "trigger 관련 uuid 검증" 으로 읽혀,
    이후 회고·검색(`grep -l trigger.*uuid plan/`) 시 어느 것이 어느 계층인지 혼동될 수 있다.
  - 제안: 별도 조치 불요(의미 충돌 없음). 필요하면 신규 문서 서두에 "DB 컬럼 제약이 아니라
    컨트롤러 경로 파라미터 검증" 이라는 한 줄 스코프 고지를 덧붙이는 정도로 충분.

이 외 CRITICAL/WARNING 급 신규 식별자 충돌은 발견되지 않았다.

## 요약

이번 target 은 `spec/5-system/` 델타가 0 이고, 실제 diff 도 새 요구사항 ID·엔티티·API
endpoint·이벤트명·환경변수를 도입하지 않는 순수 하드닝(`ParseUUIDPipe`/`@ApiParam
format:'uuid'`) + repo-guard 신설 + 문서 오귀속 정정이다. 신설된 코드 식별자(`UuidParamAxis`,
`scanUuidParams`, `collectMethodViolations`)와 신규 파일 경로(`param-uuid-pipe-guard.ts` 등)는
저장소 전수 grep 기준 기존 사용처와 겹치지 않으며 기존 `<name>-guard.ts`/`<name>.spec.ts`
컨벤션을 그대로 따른다. `MCP_INSECURE_URL_ALLOWED`→`MCP_ALLOW_INSECURE_URL`,
`TRIGGER_NOT_FOUND`→`RESOURCE_NOT_FOUND` 정정도 모두 신규 키가 아니라 기존에 이미 존재하는
식별자로 문서를 맞춘 것이라 충돌 위험이 없다. 유일한 관찰은 plan 파일명("trigger"+"uuid")이
과거 완료된 무관 주제의 plan 파일명과 표면적으로 겹친다는 것인데, 내용 충돌은 없어 INFO
수준이다.

## 위험도

NONE
