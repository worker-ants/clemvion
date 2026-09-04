# 변경 범위(Scope) 리뷰

## 검토 대상 확인

`git log --oneline origin/main..HEAD` 기준 현재 브랜치(`claude/dto-nullable-contract-lies`)는
커밋 10개, `git diff --stat`(review/** 제외) 기준 codebase 9파일 + `CHANGELOG.md` +
`plan/in-progress/` 2파일 = 16파일이 변경됐다. 핵심 주제는 "Swagger `@ApiProperty`/
`@ApiPropertyOptional` 선언과 TS 타입의 nullable/presence 불일치(계약 거짓) 9곳 수정 + 그 축을
잡는 신규 AST 가드(`swagger-dto-contract-guard.ts`/`.spec.ts`) 신설" 이며, 나머지 커밋 대부분은
그 위에서 진행된 2회 코드리뷰(`11_02_30`, `11_44_16`)·1회 consistency-check(`11_33_21`)의
WARNING 을 해소한 fix 다. `review/code/**`·`review/consistency/**` 산출물이 함께 커밋된 것은
이 프로젝트의 표준 워크플로(`/ai-review`·`--impl-done` 은 구현 완료 후 상시 승인된 강제 단계이고
그 산출물은 gitignore 대상이 아님, CLAUDE.md "외부 LLM 호출 정책")이므로 스코프 위반이 아니다.

## 발견사항

- **[WARNING]** 브랜치 목적과 무관한 plan 문서가, 그것도 **자신이 명시한 소유 worktree 가 아닌
  곳에서** 수정된 채 이 diff 에 그대로 남아 있다 — 2회 리뷰 라운드에서 INFO 로 지목됐지만
  끝내 분리되지 않았다
  - 위치: `plan/in-progress/execution-engine-residual-gaps.md:2`(`worktree:
    spec-frontmatter-status-migration-027c17`) / 삽입 블록은 같은 파일 `:55-69`(커밋 `8691a2f25`)
  - 상세: 이 파일 frontmatter 는 자신의 소유 worktree 를
    `spec-frontmatter-status-migration-027c17` 로 명시한다(CLAUDE.md: "진행 중 작업 …
    frontmatter 에 `worktree` 명시"). 그런데 실제 편집은 **다른 worktree
    (`plan-in-progress-items-b0c80b`)** 에서, **이 브랜치(`claude/dto-nullable-contract-lies`)의
    본 주제(Swagger DTO 계약 정정)와 아무 코드·주제도 공유하지 않는** execution-engine
    G2/G3(`errorPolicy: 'continue'` 매핑, 인터럽트 복구 인프라) 차단 사유 재확인을 위해
    일어났다. 이미 `review/code/2026/09/04/11_02_30/scope.md`(1R, 본 diff 의 파일 27)와
    `review/code/2026/09/04/11_44_16/scope.md`(2R, 파일 41)가 각각 이 문제를 INFO 로 지목했고,
    2R 은 frontmatter 의 worktree 불일치까지 스스로 확인해 명시했다 — 그런데도 이번(3번째)
    라운드까지 그 블록이 분리되지 않고 diff 에 그대로 남았다. 코드 레벨 오염(`codebase/**`)은
    없고 문서 한 파일에 국한되지만, (a) 다른 세션/worktree 가 소유를 선언한 파일을 건드리는
    것은 사용자 메모리에 기록된 "다른 세션이 먼저 머지했을 수 있다 — 작업 중에도 머지된다"
    충돌 위험 패턴과 정확히 같은 종류의 위험을 만들고, (b) 두 차례 지적에도 조치되지 않았다는
    사실 자체가 "INFO 로 두면 계속 방치된다"는 신호라 WARNING 으로 올려 기록한다.
  - 제안: 이 블록을 별도 커밋으로 분리해 실제 소유 worktree(`spec-frontmatter-status-migration-027c17`
    가 가리키는 세션/브랜치)로 옮기거나, 여기서 계속 관리할 것이라면 frontmatter `worktree:`
    필드를 현재 worktree 로 갱신해 소유권 선언과 실제 편집 주체를 일치시킨다. 최소한 이번
    브랜치의 PR 설명에 "이 파일은 무관한 별도 정정" 이라고 명시해 리뷰어가 혼동하지 않게 한다.

- **[INFO]** WARNING fix 하나가 리뷰어가 지목한 자리보다 넓게 고쳐졌다 — 자기 신고돼 있어
  은폐된 확장은 아님
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` 의
    `findCastOffenders`·`findUntypedNullableColumns`·`findStaleSpecCasts` 세 함수(커밋
    `59f83058e`)
  - 상세: 직전 라운드 maintainability 리뷰어는 `swagger-dto-contract-guard.ts` 의 경로 정규화
    누락 한 곳만 지목했는데, 수정은 형제 파일의 같은 결함 3곳까지 함께 고쳤다. 이후 2R 자체
    리뷰(`nullable-type-lie-cast-guard.ts` 주석 "리뷰 W3, 세 자리 동시 수정")와
    `RESOLUTION.md`(`review/code/2026/09/04/11_02_30/RESOLUTION.md` "W3 확장 수정" 절)가 그
    이유("지적된 한 자리만 고치면 같은 저장소 관례 이탈이 세 곳 그대로 남는다")를 명시하고
    있어 은폐된 스코프 확장이 아니다. 실제로도 그 다음 라운드(2R)에서 이 확장 자체가 "사본을
    복사만 하고 테스트가 없다" 는 결함으로 재지적돼(W2/W3), `toPosixPath`/`toPosixRelative`
    추출 + 뮤테이션 검증으로 정정됐다 — 즉 이 확장은 그 자체로 검증 루프를 거쳤다.
  - 제안: 문제 아님(정보성). 블로킹 아님.

- **[NONE]** 핵심 코드 변경(`background-run-response.dto.ts` 8필드,
  `create-assistant-session.dto.ts` `llmConfigId`)은 커밋 메시지·`CHANGELOG.md` 가 선언한
  "9곳"과 정확히 일치한다. `ApiPropertyOptional` import 제거(파일 6)도 더 이상 쓰이지 않게 된
  데 따른 즉시 정리이지 드라이브바이 정리가 아니다.
- **[NONE]** 신규 가드(`swagger-dto-contract-guard.ts`/`.spec.ts`)는 presence·null 두 축만
  판정한다 — 자동 수정 기능이나 요청 범위를 넘는 축 확장은 없다.
- **[NONE]** `temp-fixture.ts`/`temp-fixture.spec.ts` 추출, async-thenable 즉시 실패 처리는
  1R side_effect 리뷰의 WARNING 이 요구한 수정과 그 수정 자체를 검증하는 테스트로, 새로 만든
  동작 범위를 넘지 않는다.
- **[NONE]** `CHANGELOG.md`·`plan/in-progress/spec-draft-nullable-notation-followups.md` 의
  나머지 수정은 전부 이번 작업이 만든 실측치 갱신·완료 체크박스·후속 항목 등재이며,
  `QueryExecutionDto.workflowId` 죽은 필드 등 새로 발견한 별건은 코드로 확장하지 않고 "이 PR
  범위 밖 — 등재만"으로 명확히 분리했다.
- **[NONE]** `git diff` vs `git diff -w` 라인 수 대조 결과 동일 — 실질 변경과 뒤섞인 포맷팅
  전용 변경 없음. `console.log`/`debugger`/미사용 임포트 잔존 없음(`path` import 제거 2건은
  추출로 인한 정당한 정리).

## 요약

핵심 변경(Swagger DTO nullable/presence 계약 불일치 9곳 수정 + AST 가드 신설 + 그 위 2회
code-review·1회 consistency-check WARNING 전량 해소)은 각 라운드가 요청한 범위와 정확히
일치하고, 유일한 리팩터(`temp-fixture.ts`/`toPosixPath`·`toPosixRelative` 추출)도 신규 가드가
직접 요구하는 최소 범위였으며 확장된 부분(W3)은 자기 신고·후속 검증까지 거쳤다. 다만 이
브랜치의 diff 에는 본 주제와 전혀 무관하고 **다른 worktree 가 소유를 선언한** plan 문서 수정
(`execution-engine-residual-gaps.md`, 커밋 `8691a2f25`)이 두 차례 리뷰 지적에도 분리되지 않은
채 그대로 남아 있다 — 코드 오염은 없지만 소유권 규약 위반과 세션 충돌 위험이 있어 WARNING 으로
기록한다.

## 위험도

LOW
