# 정식 규약 준수 검토 — spec/5-system/

## 방법론 노트 (중요)

`_prompts/convention_compliance.md` 에는 `spec/5-system/` 19개 파일 **본문과 `git diff origin/main...HEAD -- code_areas` 자체가 모두 컨텍스트 예산 초과로 생략**되어 있었다(파일명만 나열, `<git diff ...>` 항목 자체가 생략 리스트에 포함됨). 즉 이 프롬프트만으로는 target 문서의 실제 내용도, 이번 PR 의 diff 도 근거할 수 없는 상태였다.

따라서 프롬프트 대신 HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`, 현재 세션의 실제 CWD)에서 직접:

- `git diff origin/main...HEAD --stat` 로 실제 변경 파일 목록을 확인
- `git diff origin/main...HEAD --stat -- spec/` 로 spec 변경 여부를 확인
- `spec/5-system/` 디렉토리 목록·파일 크기·구조(Overview/Rationale 헤더)를 직접 `ls`/`grep`/`Read` 로 확인
- 변경된 코드(execution-engine.service.ts / knowledge-base.service.ts / auth-oauth.service.ts / update-returning-rows.ts)의 실제 diff를 직접 조회

했다.

## 핵심 사실 확인

1. **이번 PR 은 `spec/` 하위를 전혀 건드리지 않는다.** `git diff origin/main...HEAD --stat -- spec/` 출력이 빈 결과였다(재확인 완료). 즉 review 대상으로 지정된 `spec/5-system/` 은 diff 상 변경분이 0이다.
2. 실제 코드 diff는 `codebase/backend/src/common/utils/update-returning-rows.ts`(신규) + 이를 소비하는 `execution-engine.service.ts`(admission UPDATE, `updateExecutionStatus`) · `knowledge-base.service.ts`(재추출/재임베딩 CAS 락 + 재큐) · `auth-oauth.service.ts`(OAuth state 소비) 4곳뿐이다. 전부 **TypeORM 0.3.31 + pg 가 `UPDATE`/`DELETE ... RETURNING` 에 대해 `[rows, rowCount]` 튜플을 돌려준다**는 사실을 오인해 `.length`/`.map` 을 직접 쓰던 버그를 고치는 내부 정합성 수정이다.
3. 신규 헬퍼 `updateReturningRows(result, detail)` 는 기존 sibling `assertRowArray(rows, detail)` 와 동일한 계약(호출부 컨텍스트 `detail` 필수, 배열이 아니면 내부 `Error` throw)을 따른다 — 새 관용구를 만들지 않고 기존 패턴을 그대로 재사용했다.

## 발견사항

이번 라운드에서 CRITICAL/WARNING 급 정식 규약 위반은 발견하지 못했다. 근거:

- **명명 규약**: `spec/5-system/` 파일명은 모두 `N-name.md` + `_product-overview.md` 패턴을 유지하고 있다(`ls spec/5-system/` 확인 — `1-auth.md` ~ `17-agent-memory.md`, `_product-overview.md`). 루트 `0-` prefix 는 `spec/0-overview.md` 에만 쓰이며 `spec/5-system/` 안에는 없다 — CLAUDE.md 규약과 일치. 코드 쪽 신규 식별자(`updateReturningRows`)도 기존 `assertRowArray` 네이밍 패턴(동사+대상)과 일관된다.
- **출력 포맷 규약**: 이번 diff 는 `NodeHandlerOutput`(`output`/`meta`/`port`/`status`, `spec/conventions/node-output.md`) 이나 REST 응답/이벤트 페이로드 형태를 전혀 건드리지 않는다 — DB raw query 결과의 내부 shape 파싱만 고친다. `updateReturningRows` 가 실패 시 던지는 `Error` 는 사용자에게 노출되는 `output.error.code`(`UPPER_SNAKE_CASE`, node-output.md §3.2) 나 REST 에러코드가 아니라, 트랜잭션 내부 invariant 위반을 로그로 드러내기 위한 내부 assertion 이다 — 기존 sibling `assertRowArray` 와 동일 계층이라 새 위반이 아니다.
- **문서 구조 규약**: `spec/5-system/4-execution-engine.md`(이번 코드 변경과 가장 근접한 문서 — admission gate/§8, `updateExecutionStatus` 관련 §7.5 서술을 포함)는 `## Overview`(L21)·`## Rationale`(L1328) 를 모두 갖춰 Overview/본문/Rationale 3섹션 권장을 충족한다(직접 grep 확인). `_product-overview.md` 는 PRD 성격의 NFR 표 문서로 기존 관용을 유지 — 이번 PR 로 변경되지 않았다.
- **API 문서 규약**: 변경된 4개 파일 중 `@Controller`/`@Api*` 데코레이터가 붙은 클래스는 없다(`auth-oauth.service.ts` 는 서비스 클래스, grep 으로 데코레이터 부재 확인) — swagger.md 대상 표면이 아니다.
- **금지 항목**: node-output.md Principle 7 D1 의 "spread 로 config echo 금지" 류 금지 패턴은 이번 diff 대상 코드(raw query 헬퍼)와 무관 — 해당 없음.

결론적으로 이번 회차는 **review 대상 target 문서(spec/5-system/) 자체에 diff 가 없고, 수반된 코드 diff 도 spec/conventions/** 가 규율하는 표면(노드 output/에러 포맷·API 데코레이터·문서 구조·명명)을 건드리지 않는다.**

## 요약

`spec/5-system/` 은 이번 PR 에서 변경되지 않았으며(직접 재확인: `git diff origin/main...HEAD --stat -- spec/` 무출력), 수반 코드 diff(TypeORM `UPDATE/DELETE ... RETURNING` 튜플-shape 파싱 버그 수정, 신규 헬퍼 `updateReturningRows`)는 `spec/conventions/**` 가 규율하는 명명·출력 포맷·문서 구조·API 문서 표면과 접점이 없는 내부 정합성 수정이다. 신규 헬퍼는 기존 `assertRowArray` 관용구를 그대로 재사용해 새로운 패턴을 도입하지 않았다. `spec/5-system/4-execution-engine.md` 등 관련 spec 문서의 구조(Overview/Rationale)·파일 명명도 직접 확인한 범위에서 규약과 일치한다. (참고: 프롬프트 자체는 target 본문과 diff 를 모두 예산 초과로 생략했으므로, 이 결론은 프롬프트가 아니라 HEAD 워킹트리 직접 조회에 근거한다 — cross_spec/spec-coverage 관점의 "spec 서술이 코드 동작을 정확히 반영하는가"는 본 checker 의 소관(정식 규약 준수) 밖이라 별도 언급하지 않았다.)

## 위험도
NONE
