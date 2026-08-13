# 정식 규약 준수 검토 — spec/5-system/

## 방법론 노트

`_prompts/convention_compliance.md` 는 이번 회차도 `spec/5-system/` 다수 파일 본문과
`git diff origin/main...HEAD -- code_areas` 자체를 컨텍스트 예산 초과로 생략했다(파일명만
나열, `<git diff ...>` 항목 자체가 생략 리스트에 포함). 따라서 프롬프트 대신 HEAD 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`, 현재 세션의
실제 CWD)에서 직접 확인했다:

- `git diff origin/main...HEAD --stat -- spec/` — spec 변경 여부
- `git diff origin/main...HEAD --stat` / 개별 파일 diff — 실제 코드 변경 내용
- `spec/5-system/` 디렉토리 목록 + `4-execution-engine.md` 의 `## Overview`/`## Rationale` 헤더
- `spec/conventions/**` 에서 `RETURNING`/`assertRowArray`/`updateReturningRows` 관련 규약 존재 여부

## 핵심 사실 확인

1. **이번 PR 은 `spec/` 하위를 전혀 건드리지 않는다.** `git diff origin/main...HEAD --stat -- spec/` 출력이 빈 결과다(재확인 완료). Review 대상으로 지정된 `spec/5-system/` 은 diff 상 변경분이 0이다.
2. 실제 코드 diff 는 다음 5개 파일뿐이다: `codebase/backend/src/common/utils/update-returning-rows.ts`(신규 헬퍼) + `assert-row-array.spec.ts`(회귀 가드 카운트 갱신) + 이를 소비하는 `execution-engine.service.ts`(admission UPDATE·`updateExecutionStatus`) · `knowledge-base.service.ts`(재추출/재임베딩 CAS 락 + 재큐 4곳) · `auth-oauth.service.ts`(OAuth state 소비). 추가로 `test/auth-oauth-callback.e2e-spec.ts`(신규 e2e, 실 드라이버로 튜플 shape 회귀를 고정) 가 포함된다. 전부 **TypeORM 0.3.31 + pg 가 `UPDATE`/`DELETE ... RETURNING` 에 `[rows, rowCount]` 튜플을 돌려준다**는 사실을 오인해 `.length`/`.map`/제네릭 단언을 직접 쓰던 버그를 고치는 내부 정합성 수정이다. API 응답 형식·에러 코드 값·이벤트 페이로드·컨트롤러 데코레이터는 변경되지 않았다(`KB_REEXTRACT_IN_PROGRESS`·`KB_REEMBED_IN_PROGRESS` 등 기존 에러 코드 값은 그대로).
3. 신규 헬퍼 `updateReturningRows(result, detail)` 는 기존 sibling `assertRowArray(rows, detail)` 와 동일한 계약(호출부 컨텍스트 `detail` 필수 파라미터, 배열이 아니면 내부 `Error` throw)을 따른다 — 새 관용구를 만들지 않고 기존 패턴을 재사용했다. 파일명(`update-returning-rows.ts`, kebab-case)·함수명(camelCase 동사+대상)도 sibling `assert-row-array.ts`/`assertRowArray` 와 일관된다.
4. `spec/conventions/**` 전체를 검색한 결과 TypeORM raw query 의 `RETURNING` shape·`assertRowArray`/`updateReturningRows` 류 내부 헬퍼를 규율하는 정식 규약 문서는 존재하지 않는다(`node-output.md` 의 "raw" 언급은 노드 config echo 문맥으로 무관). 즉 이번 diff 가 위반할 수 있는 명시적 정식 규약 표면 자체가 없다.

## 발견사항

이번 회차에서도 CRITICAL/WARNING 급 정식 규약 위반은 발견하지 못했다. 근거:

- **명명 규약**: `spec/5-system/` 파일명은 모두 `N-name.md` + `_product-overview.md` 패턴을 유지한다(`ls spec/5-system/` 재확인 — `1-auth.md` ~ `17-agent-memory.md`, `_product-overview.md`). 루트 `0-` prefix 는 `spec/0-overview.md` 전용이며 `spec/5-system/` 안에는 없다 — CLAUDE.md 규약과 일치. 코드 쪽 신규 식별자(`updateReturningRows`, 파일 `update-returning-rows.ts`)도 기존 `assertRowArray`/`assert-row-array.ts` 네이밍 패턴과 일관되어 새로운 명명 이탈이 없다.
- **출력 포맷 규약**: 이번 diff 는 `NodeHandlerOutput`(`output`/`meta`/`port`/`status`, `spec/conventions/node-output.md`) 이나 REST 응답/이벤트 페이로드 형태를 전혀 건드리지 않는다 — DB raw query 결과의 내부 shape 파싱만 고친다. `updateReturningRows` 가 실패 시 던지는 `Error` 는 사용자에게 노출되는 `output.error.code`(`UPPER_SNAKE_CASE`, node-output.md §3.2) 나 REST 에러코드가 아니라 트랜잭션 내부 invariant 위반을 로그로 드러내는 내부 assertion 이다 — 기존 sibling `assertRowArray` 와 동일 계층이라 새 위반이 아니다.
- **문서 구조 규약**: `spec/5-system/4-execution-engine.md`(이번 코드 변경과 가장 근접한 문서 — admission gate·`updateExecutionStatus` 관련 서술 포함)는 `## Overview`(L21)·`## Rationale`(L1328) 를 모두 갖춰 Overview/본문/Rationale 3섹션 권장을 충족한다(직접 grep 재확인). `spec/5-system/` 전체가 diff 대상이 아니므로 구조 변경 자체가 없다.
- **API 문서 규약**: 변경된 파일 중 `@Controller`/`@Api*` 데코레이터가 붙은 클래스는 없다(서비스 클래스·유틸 함수·e2e 테스트뿐) — swagger.md 대상 표면이 아니다.
- **금지 항목**: `node-output.md` Principle 7 의 config echo 금지 패턴, `error-codes.md` 의 명명·rename 정책 등 conventions 가 명시한 금지 사항과 이번 diff 는 접점이 없다(에러 코드 값 신설·변경 없음). 외부 LLM 호출 정책(`subprocess.run(["claude", "-p", ...])` 금지 등)도 해당 코드 경로와 무관.

## 요약

`spec/5-system/` 은 이번 PR 에서 변경되지 않았으며(`git diff origin/main...HEAD --stat -- spec/` 무출력, 재확인 완료), 수반 코드 diff(TypeORM `UPDATE/DELETE ... RETURNING` 튜플-shape 파싱 버그 수정, 신규 헬퍼 `updateReturningRows` + 이를 소비하는 4개 서비스 파일 + 회귀 고정용 e2e 테스트 1개)는 `spec/conventions/**` 가 규율하는 명명·출력 포맷·문서 구조·API 문서 표면과 접점이 없는 내부 정합성 수정이다. `spec/conventions/**` 전체 검색에서도 이 클래스의 DB raw-query shape 문제를 규율하는 정식 규약 문서가 존재하지 않아, 위반 가능한 표면 자체가 없다. 신규 헬퍼는 기존 `assertRowArray` 관용구·명명 패턴을 그대로 재사용해 새로운 패턴을 도입하지 않았다. 이전 회차(00_00_45) 검토와 동일한 결론이며, 그 사이 추가된 e2e 테스트 1건도 spec/conventions 표면에 영향이 없다.

## 위험도
NONE
