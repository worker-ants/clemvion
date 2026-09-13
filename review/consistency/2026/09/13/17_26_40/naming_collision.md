# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 요약

- 검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`
- `spec/conventions/` 델타: **0개 파일** — 이 브랜치는 spec 영역을 바꾸지 않는다(코드 전용 PR, 정상).
- 실제 구현 diff: 5개 파일 / 1281줄. 핵심은 `guide-error-code-existence.test.ts` +
  `guide-error-code-scan.ts` (삭제) → `guide-identifier-existence.test.ts` +
  `guide-identifier-scan.ts` (신규)로의 **재작성** — 유저 가이드 실재성 가드를 "에러 코드
  전용"에서 "식별자(에러 코드 + 환경변수) 전체"로 일반화. `guide-sanitized-message-parity.test.ts`
  는 주석의 자매 파일명 인용만 갱신.
- 절대경로 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/guide-identifier-existence`)
  기준으로 `git diff origin/main...HEAD` 전문·현재 파일 상태를 직접 읽어 확인했다(예산 절단
  구간을 이 경로로 우회).

## 신규 식별자 인벤토리 및 충돌 조사

target diff 가 새로 도입한 식별자는 아래로 한정된다 (모두
`codebase/frontend/src/lib/docs/__tests__/` 스코프의 내부 test-harness 모듈, 외부에
export 되지 않음):

- 파일: `guide-identifier-existence.test.ts`, `guide-identifier-scan.ts`
- export: `scanIdentifierCitations`, `collectSourceTokens`, `collectEnvDeclarations`,
  `GUIDE_EXTERNAL_VOCABULARY`, 타입 `CitationAxis`(`"field-table"|"code-field"|"backtick"`),
  인터페이스 `IdentifierCitation`
- 모듈 로컬 const: `UPPER_SNAKE`, `FIELD_TABLE_NAME`, `CODE_FIELD`, `BACKTICK_SPAN`,
  `BACKTICK_INNER`, 테스트 쪽 `EXTERNAL_VOCABULARY_CAP`
- 리터럴 데이터: `GUIDE_EXTERNAL_VOCABULARY` 의 유일한 항목 `MESSAGE_CREATE` (Discord Gateway
  이벤트명, 허용목록)

각 항목을 저장소 전체에서 grep 하여 충돌 여부를 확인했다:

- `scanIdentifierCitations`·`collectSourceTokens`·`collectEnvDeclarations`·
  `GUIDE_EXTERNAL_VOCABULARY`·`IdentifierCitation`·`CitationAxis` — 신규 파일 자신을 빼면
  저장소 어디에도 등장하지 않는다. 이전 판(`guide-error-code-scan.ts`)의 동명 export
  (`CitationAxis`=`{field-table,code-field,prose}`, `ErrorCodeCitation`,
  `scanErrorCodeCitations`, `collectBackendTokens`)는 **같은 커밋에서 파일째 삭제**되므로
  타입 재정의가 아니라 교체이며, 공존 구간이 없어 충돌이 아니다.
- 파일명: `guide-identifier-existence.test.ts` / `guide-identifier-scan.ts` 는
  `__tests__/` 디렉토리(29개 파일)의 기존 관례(`impl-anchor-existence.test.ts` +
  `impl-anchor-parse.ts`, `plan-scan.test.ts` + `plan-scan.ts`, `spec-links.test.ts` +
  `spec-links.ts`)와 동일한 `<domain>-<concept>.test.ts`/`.ts` 짝 패턴을 그대로 따르며
  기존 파일과 겹치지 않는다.
- `MESSAGE_CREATE` — `spec/5-system/15-chat-channel.md`, `spec/4-nodes/7-trigger/providers/discord.md`,
  `discord.mdx`/`discord.en.mdx` 전부에서 "Discord Gateway 이벤트 이름(우리 코드엔 없는
  것이 정상)"이라는 **동일한 의미**로 이미 쓰이고 있다. `GUIDE_EXTERNAL_VOCABULARY` 의
  `system`/`why` 필드 서술도 이와 일치한다 — 의미 충돌 없음.
- `MCP_ALLOW_INSECURE_URL` (테스트 fixture 가 참조하는 "정정된" 이름) — `mcp.config.ts`,
  `production-guards.ts`, `mcp-tool-provider.ts` 등에 실재하는 기존 env var 로, 새로
  도입되는 이름이 아니라 이미 존재하는 이름을 테스트가 인용한 것. 충돌 없음.
- `UPPER_SNAKE` — 동일 이름의 모듈-로컬 `const`(정규식 패턴, 동일 의미: "밑줄 하나 이상의
  대문자 스네이크")가 `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:60`
  에도 독립적으로 존재한다. 두 정의 모두 파일 스코프 로컬이라 컴파일·런타임 충돌은 없고,
  의미도 동일(우연한 재발명이지 다른 의미로 쓰인 동명이 아님) — DRY 관점의 사소한 중복일
  뿐 "다른 의미로 이미 사용 중"인 CRITICAL/WARNING 케이스에 해당하지 않는다.

## 부수 관찰 (충돌은 아니지만 기록)

- `spec/conventions/user-guide-evidence.md` 의 frontmatter `code:` 목록에는 옛
  `guide-error-code-*.ts` 도, 신규 `guide-identifier-*.ts` 도 등재돼 있지 않다(이번 PR 이전부터
  미등재). 이는 **식별자 충돌이 아니라 spec-impl-evidence 커버리지 갭**이며, 이 작업의
  plan(`plan/in-progress/guide-identifier-existence.md` frontmatter `spec_impact: none`
  + 본문 상단 주석)이 "developer 권한 밖이라 planner 항목(§D)으로 이미 등재했다"고 명시적으로
  자인하고 있다. 새로 발생한 미등재가 아니라 기존에 알려진 채로 이월된 항목이라 본 관점
  (신규 식별자 충돌)의 대상이 아니다 — 참고로만 남긴다.
- `IdentifierCitation`/`scanIdentifierCitations` 가 쓰는 "citation" 이라는 단어는
  `spec/conventions/review-citations.md`(코드 주석의 리뷰 산출물 인용 관례)와 표면적으로
  같은 영어 단어를 쓰지만, 완전히 다른 도메인(가이드 문서 안의 식별자 인용 vs 코드 주석의
  리뷰 경로 인용)이고 네임스페이스도 겹치지 않는다 — 혼동 가능성은 낮다.

## 발견사항

없음. 위 조사에서 CRITICAL/WARNING 등급의 신규 식별자 충돌을 찾지 못했다.

## 요약

이번 target 은 `spec/conventions/` 자체를 변경하지 않는 코드 전용 diff이며, 실질 변경은
유저 가이드 실재성 가드 하나를 "에러 코드 전용"에서 "식별자(에러 코드+환경변수) 전체"로
재작성·일반화한 것이다. 새로 도입된 함수/타입/상수/파일명은 전부 해당 테스트-하네스 모듈에
국한된 내부 식별자이며, 저장소 전체 grep 결과 기존 사용처와 다른 의미로 충돌하는 사례는
발견되지 않았다(옛 동명 export 는 같은 커밋에서 파일째 삭제되어 교체일 뿐 공존 충돌이
아니다). 유일하게 등장하는 외부 어휘 허용목록 항목(`MESSAGE_CREATE`)과 테스트가 인용하는
실제 환경변수(`MCP_ALLOW_INSECURE_URL`)도 기존 spec·코드의 의미와 일치한다. 요구사항
ID·엔티티/DTO·API endpoint·이벤트명·spec 파일 경로 축에서는 애초에 신규 도입이 없다.

## 위험도

NONE
