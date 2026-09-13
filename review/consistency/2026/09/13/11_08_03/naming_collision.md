# 신규 식별자 충돌 검토 — naming_collision (impl-done, 4차)

## 검토 범위 및 방법

- 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`.
- `spec/5-system/` 자체의 델타는 **0개 파일** — 이 브랜치는 그 spec 영역을 바꾸지 않았다.
  코드 전용(+가이드 mdx) PR 이므로 정상이며, 델타 0 자체를 근거로 CRITICAL 을 내지 않았다.
- 대상 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/guide-error-code-truth`)를
  직접 열어 `git diff origin/main...HEAD`(HEAD=`de99def86`, `codebase/**` 21파일)를 전수 실측했다
  — 프롬프트 번들의 diff 는 예산 절단으로 본문이 빠져 있어(§`<git diff …>` 항목 참고) CWD 기준
  Read/Grep 대신 실제 워킹트리에서 직접 diff·grep 을 돌렸다.
- 이 plan(`guide-error-code-truth`)에 대한 **네 번째** naming_collision 검토다. 1차
  (`--impl-prep`, `01_15_40`, LOW) · 2차(`--impl-done`, `10_12_54`, NONE) · 3차(`--impl-done`,
  `10_41_13`, NONE)가 이미 핵심 diff 전체(LLM 연결-테스트 `error`→`message` 정정·`latencyMs`
  제거·가이드 4파일 정정·신규 가드 2종·`TestConnectionResultDto.code` 신설·`nodeName`→
  `nodeLabel`)를 대조했다. 이번 라운드는 그 이후 마지막 커밋(`de99def86`, 리뷰 라운드 2 처분 —
  형제 엔드포인트 계약 검사 배선·JSDoc 정리·CHANGELOG 정정)까지 반영된 **최종 diff 전수**를
  독립적으로 재확인했고, 3차 이후 diff 증분(`integrations.service.spec.ts` 의
  `assertMatchesContract` 배선, `integration-response.dto.ts` JSDoc 재배치)도 포함해 봤다.

## 점검 관점별 실측

1. **요구사항 ID 충돌** — 신규 요구사항 ID 없음 (spec 델타 0). 트래커 참조 번호(`#1330`)도
   `plan/in-progress/guide-error-code-truth.md` · `spec-draft-nullable-notation-followups.md`
   밖에서 재사용되지 않는다(grep 0건).
2. **엔티티/타입명 충돌**
   - `TestConnectionResultDto.code?: string` 신설(`integration-response.dto.ts`) — 값은
     `MCP_*`·`EMAIL_CONNECT_FAILED`·`INTEGRATION_INCOMPLETE` 등이며 전부
     `IntegrationTestResult.code`(`integrations.service.ts`, 생산자 26곳)가 이미 내던 값이고
     `spec/2-navigation/4-integration.md §9.1`이 이미 문서화한 이름이다. **신규 도입이 아니라
     미선언 필드의 뒤늦은 선언**. 같은 이름의 형제 클래스 `ModelTestConnectionResultDto` 에는
     `code` 를 추가하지 않았다(그 경로의 실패 필드는 `message` 로 정정) — 두 DTO 가 같은
     `code`/`message` 어휘를 쓰되 서로 다른 필드 집합을 갖는 것은 각자의 실제 생산자와
     일치하는 의도된 비대칭이라 충돌이 아니다.
   - `TestConnectionResultDto.code` 가 `spec/5-system/2-api-convention.md §5.3` 의 표준
     **에러 봉투** top-level `code`(4xx/5xx `GlobalExceptionFilter` 발행)와 같은 필드명을
     쓰지만, 이 필드는 **HTTP 200 결과 객체** 안에 있고 §5.3 이 규정하는 에러 응답이 아니다.
     같은 이름·다른 구조라는 잠재적 혼동 축이지만, 이 dual-use 는 이 PR 이 만든 것이 아니라
     `/api/integrations/:id/test` 엔드포인트가 origin/main 시점부터 이미 그렇게 응답해 왔고
     spec §9.1 도 이미 승인해 둔 형태다(DTO 가 뒤늦게 선언을 따라잡았을 뿐).
   - 신규 export 심볼 `CitationAxis`(type)·`ErrorCodeCitation`(interface)·
     `scanErrorCodeCitations`·`collectBackendTokens`(function) — `guide-error-code-scan.ts`.
     frontend 전체(`codebase/frontend/src`)에서 동일 이름의 기존 export 는 0건(신규 파일
     자신을 제외).
3. **API endpoint 충돌** — 이번 diff 는 신규 endpoint 를 추가하지 않는다. 기존
   `POST /api/model-configs/:id/test` · `POST /api/integrations/:id/test` 의 **응답 필드
   구성**만 정정했다(엔드포인트 자체는 origin/main 부터 존재). `models{,.en}.mdx` 에 새로
   붙인 `<ImplAnchor kind="api-endpoint" … describes="POST /api/model-configs/:id/test">` 는
   같은 문서의 기존 endpoint 표(`FieldTable`, "POST /api/model-configs/:id/test" 행)와 같은
   대상을 가리키는 중복 표기이지 다른 의미의 재정의가 아니다.
4. **이벤트/메시지명 충돌** — 신규 webhook·queue·SSE 이벤트 없음.
5. **환경변수·설정키 충돌** — 신규 ENV var·config key 없음(`process.env.*` 신규 참조 0건,
   diff 전수 grep 확인).
6. **파일 경로 충돌**
   - 신규 파일 3종: `guide-error-code-scan.ts` · `guide-error-code-existence.test.ts` ·
     `guide-sanitized-message-parity.test.ts` (`codebase/frontend/src/lib/docs/__tests__/`).
     같은 디렉터리 기존 파일(`impl-anchor-{parse.ts,existence.test.ts}` ·
     `spec-frontmatter-{parse.ts,test.ts}` · `spec-links.{ts,test.ts}` · `tree-walk.{ts,test.ts}`)
     과 이름이 겹치지 않는다. 헬퍼(`.ts`)와 그 헬퍼를 쓰는 테스트(`.test.ts`)의 base 이름이
     다른 것(`guide-error-code-scan.ts` → `guide-error-code-existence.test.ts` 가 소비)도
     선례(`impl-anchor-parse.ts` → `impl-anchor-existence.test.ts`)와 같은 관례라 컨벤션
     위반이 아니다.
   - `describe()` 최상위 타이틀도 같은 폴더 내 중복 없음(전수 대조).

## 참고 — 신규 충돌 아님(이미 추적 중)

`spec/conventions/user-guide-evidence.md §2.1` 관계표가 이번 PR 이 신설한 가드 2종
(`guide-error-code-existence.test.ts`·`guide-sanitized-message-parity.test.ts`)을 아직 반영하지
않은 상태(§2 는 여전히 "3건"으로 서술)는 1~3차 검토가 이미 지적했고
`plan/in-progress/guide-error-code-truth.md` §E·§H 에 planner 등재분으로 명시돼 있다(spec 쓰기는
developer 권한 밖). 이는 **식별자가 다른 의미로 충돌**하는 문제가 아니라 등재 문구의 최신성
문제라 이번 naming_collision 관점의 신규 발견 사유는 아니다.

## 요약

impl-done 최종 diff(`de99def86`, `codebase/**` 21파일)를 6개 관점 전수로 재확인한 결과, 이번
plan 이 새로 도입하는 식별자(`TestConnectionResultDto.code` 필드·`CitationAxis`/
`ErrorCodeCitation`/`scanErrorCodeCitations`/`collectBackendTokens`·신규 테스트 파일 3종)는 모두
(a) 이미 다른 곳에 생산자·spec 문서화가 있던 값의 뒤늦은 DTO 선언이거나, (b) 기존 가드 가족의
명명 관례를 그대로 따르는 새 모듈/함수로 기존 export 와 충돌하지 않으며, (c) 신규 endpoint·
이벤트·ENV var·요구사항 ID 는 이번 diff 범위에 없다. 1~3차 검토가 이미 핵심 표면을 NONE~LOW 로
판정했고, 그 이후 마지막 커밋까지 포함한 이번 4차 재확인도 그 결론을 뒤집을 새 충돌을 찾지
못했다. 유일한 인접 이슈(가드 관계표 staleness)는 이미 planner 트래커에 등재돼 있어 차단 사유가
아니다.

## 위험도

NONE
