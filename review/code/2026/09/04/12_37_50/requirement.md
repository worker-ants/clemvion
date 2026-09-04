# 요구사항(Requirement) 리뷰 — 4R (`12_37_50`) — Swagger DTO nullable/presence 계약 정합화

## 검증 방법

이 diff(`origin/main..HEAD`, 커밋 `fefec2b27`~`fd5697f92`)는 이미 3라운드의 requirement 리뷰
(`11_02_30`·`11_44_16`·`12_17_50`)를 거쳤고, 매 라운드가 지적한 WARNING 은 다음 커밋에서 조치돼
있었다. 재탕을 피하려고 이번 라운드는 (1) 3R 이 남긴 유일한 WARNING(`engine-error-code-anchor-guard.ts`
미정규화)이 실제로 고쳐졌는지, (2) 그 수정이 저장소 전체를 다시 훑어도 "완결"이 맞는지, (3) 핵심
로직 파일(`swagger-dto-contract-guard.ts`/`.spec.ts`, 두 DTO, `temp-fixture.ts`)의 현재(최종) 상태를
`Read`로 직접 열어 spec(`spec/5-system/2-api-convention.md` §5.4, `spec/conventions/swagger.md`
§1-4)과 line-level 대조, (4) 실제 서비스 코드(`background-runs.service.ts`,
`workflow-assistant-session.service.ts`)까지 따라가 "동작 변경 없음" 주장을 재확인하는 데 집중했다.
저장소에는 쓰기를 하지 않았다(`Read`/`Bash`(read-only: `grep`/`git show`/`git diff`)만 사용).
`git status --short` 로 시작 전/후 상태를 대조해 내가 만든 변형이 없음을 확인했다.

## 발견사항

- **[INFO]** 리뷰 세션과 무관한 워킹트리 변형이 관측된다 — 이 리뷰가 만든 것이 아니다
  - 위치: `review/consistency/2026/09/04/11_33_21/SUMMARY.md` (uncommitted, `git status`상 `M`)
  - 상세: 이 파일은 이번 diff 의 파일 61(신규 파일, 커밋된 내용은 `de7e270ee` 해시와 동일한
    "Consistency SUMMARY" 포맷)로 리뷰 대상에 포함돼 있다. 그런데 현재 워킹트리에는 그 커밋된
    내용 위에 **다른 포맷("Consistency Check 통합 보고서")으로 다시 쓴, 아직 커밋되지 않은
    변경**이 얹혀 있다. 이 세션은 시작 시점(`git status --short`)부터 이미 이 파일이 `M` 상태였다
    — 내가 만든 변형이 아니고, 이 리뷰의 어떤 도구 호출도 그 파일을 쓴 적이 없다. 병렬로 도는
    다른 세션/reviewer 가 같은 워크트리를 편집 중일 가능성이 있다(사용자 메모리
    `feedback_reviewer_mutates_shared_worktree`와 같은 패턴). 이 diff 리뷰 결과에는 영향이
    없다(리뷰 대상은 커밋된 내용이고, line-level 대조도 그 기준으로 했다) — 다만 조용히
    넘어가면 다음 사람이 이 잔여물을 진짜 결함으로 오인할 수 있어 보고한다.
  - 제안: 이 리뷰가 원복할 사안은 아니다(내가 만들지 않았고, `git checkout`/`restore` 는 금지
    규약). orchestrator/다음 세션이 이 uncommitted 변경의 출처를 확인해 의도된 것이면 커밋하고,
    아니면 별도로 처리할 것.

- **[NONE — 정합 재확인]** 3R 이 지적한 "경로 정규화 완결" 주장의 재확인 — 이번엔 실제로 저장소
  전수 재현
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:173,199`
    (`file: toPosixRelative(repoRoot, abs)`)
  - 상세: 3R(`12_17_50`) requirement 리뷰가 "8곳 전부 통일" 주장이 거짓이었고
    `engine-error-code-anchor-guard.ts` 가 여전히 미정규화라고 지적했다. `fd5697f92` 가 이를
    고쳤고, 이번 라운드에서 `grep -rn "path\.relative(" codebase/backend/src/repo-guards/
    codebase/backend/src/common/__test-utils__/` 로 저장소를 **직접 재현**한 결과, 정규화 없이
    남은 자리는 **0건**이었다(유일한 `path.relative(` 호출은 `toPosixRelative` 정의 자신,
    `source-scan.ts:305`). 3R 이 지적한 함정("이미 정규화된 자리만 찾는 grep 패턴으로는 결함의
    *부재*를 원리적으로 못 찾는다")을 피해 반대 패턴(정규화가 **없는** `path.relative(`)으로
    재현했다는 점도 확인했다 — 이번엔 "고친 것을 센" 것이 아니라 "안 고친 것을 셌다."

- **[NONE — 정합 확인]** `background-run-response.dto.ts` 8필드·`create-assistant-session.dto.ts`
  `llmConfigId` — spec §5.4 및 실제 서비스 코드와 line-level 로 일치
  - 위치: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:43-149`,
    `codebase/backend/src/modules/workflow-assistant/dto/create-assistant-session.dto.ts:12-19`
  - 상세: `spec/5-system/2-api-convention.md` §5.4(175-192행)의 "상시 존재 필드 →
    `@ApiProperty({nullable:true})` + `field: T | null`" 규칙과 정확히 일치한다.
    `background-runs.service.ts:114-127,268-296`(`finishedAt`/`durationMs`/`completedAt`/
    `nextCursor` 모두 조건부 스프레드 없이 항상 대입)을 따라가 8필드가 실제로 wire 상 상시
    존재함을 재확인했다. `llmConfigId` 는 §5.4 가 "## 5. 응답 형식" 하위 절(요청 DTO 비대상)이라는
    CHANGELOG/plan 의 근거가 문서 구조(spec 파일 상 위치)와 일치하고,
    `workflow-assistant-session.service.ts:91`(`dto.llmConfigId ?? null`)가 `undefined`/`null`
    을 동일하게 처리해 "동작 변경 없음" 주장도 사실이다.

- **[NONE — 재현 확인]** `swagger-dto-contract-guard.ts`/`.spec.ts` 의 두 축(presence/null) 판정 —
  구현이 docstring·spec 이 서술하는 규칙을 정확히 구현
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:113-176`
    (`findSwaggerContractMismatches`)
  - 상세: `effectiveRequired = declaredRequired ?? (api.name === 'ApiProperty')` 는 §5.4 각주("
    `ApiPropertyOptional` 은 `ApiProperty({required:false})` 의 별칭")를 그대로 코드화했고,
    `presenceMismatch := effectiveRequired === tsOptional` 는 "OpenAPI required 와 TS `?` 는
    반대여야 한다"는 규칙과 부호까지 일치한다(변수명이 없어 읽기 어렵다는 지적은 이미 이전
    라운드 maintainability 리뷰가 INFO 로 남겼다 — 기능 결함 아님). `hasTopLevelNull` 은 최상위
    유니온만 보고 중첩 `null`(`{ appType: 'x' | null }`)을 배제하는데, 이는 §5.4 규칙("이
    필드가 nullable" 여부)과 요구되는 의미가 정확히 일치한다. `@Transform` 예외의 null-축
    한정(presence 축은 면제하지 않음)도 정확히 구현·테스트돼 있다(`swagger-dto-contract.spec.ts:173-194`).
    `[대조군]` 블록들이 실제 정규식 실패 3형태를 각각 픽스처로 고정해 회귀 방지 근거가 충실하다.

- **[NONE]** `temp-fixture.ts` 의 async/thenable 조기 실패 처리와 unhandled rejection 방지가
  의도대로 구현되고 검증됨
  - 위치: `codebase/backend/src/common/__test-utils__/temp-fixture.ts:56-68`,
    `temp-fixture.spec.ts:71-95`
  - 상세: `withFiles` 가 콜백 반환값이 thenable 이면 `result.then(undefined, () => {})` 로
    무구독 rejection 을 없앤 뒤 명시적으로 throw 한다 — 3R WARNING#3("종전 테스트는 콜백이
    resolve 만 해서 reject 경로가 무방비")를 실제로 겨눈 신규 테스트(`process.on('unhandledRejection', ...)`
    로 누출 직접 관측)가 통과함을 코드 읽기로 확인했다. TODO/FIXME/HACK/XXX 마커는 이번 diff
    전체(`git diff origin/main..HEAD -- codebase/`)에서 0건.

- **[NONE]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 실측 수치 정정
  (103+8=111, 104=103+`llmConfigId`)이 서로 모순 없이 정합
  - 위치: 파일 전체 (특히 "저장소 실측" 절·"마이그레이션은 이 문서가 강제하지 않는다" 절·
    "후속" 체크리스트)
  - 상세: 세 라운드에 걸쳐 두 번 틀렸던 집계("70/16" → "101/18" → "103/17")가 이번엔 AST 가드
    (`findSwaggerContractMismatches`) 실행 결과와 같은 도구·같은 기준으로 재측정됐고, "이 표는
    적용 전 스냅샷" 이라는 시점 고지와 "적용 후 104/25/0/1" 갱신치가 산수상 모순 없다(103+1=104,
    세 번째 버킷 8→0 은 이 PR 이 고친 8필드와 정확히 대응). 요청 DTO 카테고리 제외 근거(PATCH
    tri-state 는 §5.4 비대상)도 consistency-check(`11_33_21` W2)의 처분과 일치한다.

## 요약

핵심 요구사항(Swagger `@ApiProperty`/`@ApiPropertyOptional` 선언과 TS 타입의 presence/null 계약
불일치 9곳 수정 + 그 축을 강제하는 신규 AST 가드)은 `spec/5-system/2-api-convention.md` §5.4 와
line-level 로 정확히 일치하고, "동작 변경 없음" 주장은 실제 서비스 조립 코드까지 추적해 사실로
확인했다. 3라운드에 걸쳐 이 diff 자신이 반복해서 만들어 온 결함들(경로 정규화 "완결" 주장이 실은
2번 거짓이었던 것, async 콜백 레이스, unhandled rejection, 무관한 plan 편집)은 이번 라운드에서
전부 코드/문서 양쪽으로 재확인했을 때 진짜로 해소돼 있었다 — 특히 경로 정규화는 "이미 정규화된
자리만 찾는" grep 함정을 피해 반대 방향 패턴으로 저장소를 직접 재현해 0건임을 확인했다. CRITICAL/
WARNING 급 신규 발견은 없다. 유일한 관측 사항은 이번 diff 와 무관한 워킹트리 uncommitted 변형
(`review/consistency/2026/09/04/11_33_21/SUMMARY.md`)이며, 이는 이 리뷰 세션이 만든 것이 아니고
프로토콜에 따라 보고만 한다.

## 위험도

LOW
