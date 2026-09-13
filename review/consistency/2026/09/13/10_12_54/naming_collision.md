# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 및 방법

- 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- `spec/5-system/` 자체의 델타는 0개 파일(정상 — 이 브랜치는 코드·문서 전용 PR).
- 실제 변경은 코드 17파일/936줄: LLM 연결-테스트 응답 필드 정정(`error`→`message`,
  `latencyMs` 제거), 유저 가이드 MDX 4파일의 에러 코드 표 정정, 신규 build-time 가드
  2파일(`guide-error-code-scan.ts` / `guide-error-code-existence.test.ts`).
- 대상 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/guide-error-code-truth`)를
  절대경로로 직접 열어 diff·현재 소스를 실측했다(`git diff origin/main...HEAD`,
  `grep -rn` 전수).

## 발견사항

검토 관점 1~6(요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·ENV/설정키·파일 경로)
전체에 대해 이 diff 가 새로 도입한 식별자를 전수 대조한 결과, **기존 사용처와 다른 의미로
충돌하는 식별자는 발견되지 않았다.**

세부 대조:

1. **엔티티/타입명** — `CitationAxis`, `ErrorCodeCitation`, `scanErrorCodeCitations`,
   `collectBackendTokens` (신규, `guide-error-code-scan.ts`)를 저장소 전체에서
   `grep -rn` 했다. 정의 파일 자신을 제외하면 사용처가 없다 — 기존 동명 식별자 없음.
2. **파일 경로** — `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` ·
   `guide-error-code-existence.test.ts` 는 같은 디렉터리의 기존 명명 패턴
   (`plan-scan.ts`/`plan-scan.test.ts`, `spec-frontmatter-parse.ts`/`spec-frontmatter.test.ts`)과
   `<topic>-scan.ts` / `<topic>-existence.test.ts` 형태로 정확히 합치한다. 기존 파일과
   겹치지 않는다(`find codebase -iname "*guide-error-code*"` → 신규 2파일뿐).
3. **API endpoint** — 새 endpoint 는 추가되지 않았다. `POST /api/model-configs/:id/test` 는
   기존 endpoint 이며, 이번 diff 는 실패 응답의 **필드명**만 `error`→`message` 로 바꿨다
   (DTO `ModelTestConnectionResultDto.message` 는 원래부터 있던 필드 — 신규 식별자 아님,
   서비스 반환값을 기존 선언에 맞춘 정정). `ImplAnchor kind="api-endpoint"` 는
   `impl-anchor.tsx` 의 `ImplAnchorKind` 유니온에 origin/main 시점부터 이미 있던 값이라
   신규 종류가 아니다.
4. **에러 코드 문자열** — MDX 가 새로 인용하는 `MAKESHOP_404`/`MAKESHOP_422`/`MAKESHOP_4XX`/
   `MAKESHOP_5XX`/`MAKESHOP_AUTH_FAILED`/`MAKESHOP_RATE_LIMITED`/`MAKESHOP_TRANSPORT_FAILED`,
   `LLM_TIMEOUT`, `HTTP_TRANSPORT_FAILED` 등은 전부 backend 소스(`makeshop-api.client.ts`,
   `makeshop.handler.ts`, `makeshop-mcp-tool-provider.ts`, `nodes/core/error-codes.ts` 등)에
   같은 의미로 이미 존재하는 코드다 — **신규 도입이 아니라 오귀속 정정**이므로 충돌 대상이
   아니다.
5. **이벤트/메시지명 · ENV/설정키** — 이번 diff 에 해당 없음(신규 webhook·queue·SSE 이벤트,
   신규 ENV var/config key 없음).
6. **요구사항 ID** — `spec/5-system/` 자체가 변경되지 않았으므로 신규 ID 부여 없음.

## 참고 — 이미 추적 중인 인접 이슈 (신규 발견 아님)

`spec/conventions/user-guide-evidence.md` 의 §2("Build-time 가드 3건")·frontmatter `code:`
목록이 이번에 추가된 4번째 가드(`guide-error-code-*`)를 아직 반영하지 않는다. 이는
**식별자 충돌이 아니라 spec-frontmatter 커버리지 staleness**이며, 이전
`--impl-prep`(`review/consistency/2026/09/13/01_15_40` naming_collision WARNING#4·#5)에서
이미 지적되어 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로
등재·추적 중이다(spec 쓰기 권한은 developer 소관 밖). 새로 raise 하지 않고 참고로만 남긴다.

## 요약

이번 PR 이 도입한 신규 식별자(신규 타입 4종, 신규 파일 2개, 필드명 정정 1건)는 기존
코드베이스·spec 어디에서도 다른 의미로 이미 쓰이고 있지 않다. 오히려 이 diff 의 본질은
"신규 도입"이 아니라 "가이드가 지어내거나 오귀속한 이름을 실재하는 기존 이름으로 정정"하는
작업이라 신규 식별자 충돌 표면 자체가 작다. 유일하게 인접한 이슈(가드 3→4건 카운트 staleness)는
이미 별도 트래커 항목으로 planner 에 등재되어 있어 이 검토에서 새로 차단할 사유가 아니다.

## 위험도

NONE
