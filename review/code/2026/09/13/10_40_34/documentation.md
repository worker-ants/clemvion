# 문서화(Documentation) 코드 리뷰

## 검토 범위와 방법

프롬프트 번들 56개 파일(코드 6개·프런트 테스트/클라이언트 4개·유저가이드 mdx 8개·신규 가드 2개·
plan 2개·이전 라운드 review 산출물 34개) 전수를 확인했다. 프롬프트가 절단한 자리는 `Read`로
원본을 직접 열어 대조했다 — 특히 `guide-error-code-scan.ts`(165줄 전문),
`guide-error-code-existence.test.ts`(189줄 전문), `llm-model-config.controller.spec.ts`(262줄
전문), `llm.service.ts`의 `testConnection` JSDoc(299~356행)을 전부 읽었다. 이전 두 라운드
(`review/code/.../10_12_19`, `review/consistency/.../10_12_54`)가 이번 diff에 **커밋된 채로
포함**돼 있어, 그 라운드가 지적한 WARNING이 현재 소스에서 실제로 해소됐는지 직접 재검증했다.
저장소 파일은 뮤테이션하지 않았다(읽기 전용 `Read`/`grep`만 사용).

## 발견사항

- **[INFO]** 직전 impl-done consistency-check(`review/consistency/2026/09/13/10_12_54`)가 지적한
  WARNING 2건이 현재 diff에서 이미 해소됨을 직접 확인
  - 위치: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx:173`,
    `run-results.en.mdx:163` (`nodeLabel`), 및 두 파일의 엔진-레벨 `<FieldTable>`
    (`LLM_RATE_LIMIT` 행 제거)
  - 상세: `rationale_continuity`가 "이 PR이 바로 옆 `code` 필드를 고치면서 `nodeName`을
    지나쳤다"고 지적했는데, 프롬프트 diff(파일 12·13)와 현재 소스(`grep -n "nodeName\|nodeLabel"`)
    를 대조한 결과 **이미 `nodeLabel`로 정정돼 있다**. `cross_spec`가 지적한 `LLM_RATE_LIMIT`
    노드-종류별/엔진-수준 표 중복 배치도 현재 소스에는 노드-종류별 표에만 1회 등장한다(엔진 표
    행이 삭제됨). 두 WARNING 모두 이번 세션 안에서 코드로 이미 반영됐다.
  - 제안: 없음(확인용 기록 — 다음 검토자가 이 WARNING을 "미해결"로 재-flag하지 않도록 남긴다).

- **[INFO]** 이전 maintainability 라운드(`review/code/.../10_12_19/maintainability.md`)의
  WARNING#2(`collectBackendTokens` 파라미터명이 실제 값(파일 내용)과 반대로 `files`로 돼 있다)도
  현재 소스에서 이미 해소됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts:154`
  - 상세: 직접 `Read`로 확인한 결과 시그니처는 `export function collectBackendTokens(fileTexts: readonly string[]): Set<string>`로, 파라미터명이 이미 `fileTexts`다. 지적된 이름 불일치는 없다.
  - 제안: 없음(확인용 기록).

- **[INFO]** 같은 maintainability 라운드의 WARNING#1(`llm.service.ts`의 근거 주석이 "함수
  시그니처 파라미터 목록과 반환 타입 사이"에 끼어 있다는 주장)은 현재 소스와 대조하면 **부정확한
  서술**로 보인다
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts:299-326` (`testConnection` JSDoc + 시그니처)
  - 상세: 직접 `Read`로 확인한 결과, "## 실패 필드는 `message` 다" 절을 포함한 근거 문단
    전체(299~321행)는 `/** ... */` JSDoc 블록 **안**에 있고, 그 블록은 322행 `*/`로 완전히
    닫힌 뒤 323행에서 `async testConnection(`가 시작한다. 파라미터(`configId`, `workspaceId`,
    324~325행)와 반환 타입(326행 `): Promise<{...}> {`) 사이에는 어떤 주석도 없다 — 즉 근거
    문단은 함수 위의 정상적인 leading JSDoc 자리에 있으며, 시그니처 중간을 끊고 있지 않다. 이
    WARNING은 이 리뷰가 검증할 수 있는 현재 상태와 맞지 않는다.
  - 제안: 이 리뷰 자체를 정정할 필요는 없다(이미 커밋된 과거 산출물이며 사후 정정 관례가 없다).
    다만 후속 검토자가 이 WARNING을 근거로 재작업하지 않도록, 이 파일을 신뢰할 SoT로 재확인 없이
    인용하지 말 것을 남긴다 — 위치 인용 오류가 리뷰 산출물 자체에도 발생할 수 있음을 보여주는
    사례.

- **[INFO]** CHANGELOG·DTO 주석·JSDoc의 정량적 주장을 전수 대조 — 전부 실측과 일치
  - 위치: `CHANGELOG.md`(8갈래 문장 언급), `codebase/backend/src/modules/llm/utils/sanitize-error.util.ts`,
    `codebase/frontend/src/content/docs/06-integrations-and-config/models.en.mdx:79-86`
  - 상세: `sanitize-error.util.ts`를 `grep -n "return '"`으로 대조한 결과 정확히 8개의 반환
    문자열이 있고, `models.en.mdx`의 8행 표가 그 문자열과 **글자까지** 일치한다(공백·구두점
    포함). `latencyMs` 잔존 참조를 저장소 전체(`codebase/`, `spec/`)에서 재검색한 결과, 남은
    출현은 전부 이번 필드 제거를 설명하는 의도적 rationale 주석뿐이며 죽은/낡은 참조는 없다.
    신규 회귀 테스트(`guide-sanitized-message-parity.test.ts`)가 이 대조를 build-time에
    영구화해, 향후 `sanitize-error.util.ts`가 바뀌면 mdx 표가 조용히 낡는 것을 막는다.
  - 제안: 없음(확인용 기록 — 우수 사례).

- **[INFO]** 신규 가드 2건(`guide-error-code-scan.ts`, `guide-error-code-existence.test.ts`)의
  헤더 주석은 판정 축을 좁힌 근거를 실측 수치 표로 남겨 이례적으로 높은 문서화 수준을 보인다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts:1-40`
  - 상세: "전수 열거(82종)" vs "축소 채택(66종)" 등 시도했다 폐기한 대안과 그 근거(오탐/미검출
    수치)를 표로 남겼고, `CODE_CONTEXT`·`TABLE_HEADER_WITH_CODE` 정규식 각각에 "왜 이 형태인가
    (실패 사례 포함)"를 JSDoc으로 붙였다. 대조군 테스트(`guide-error-code-existence.test.ts`
    107행 이하)도 "[비대상]"·"[경계]" 라벨로 의도적 미검출을 코드로 고정해 다음 사람이 "왜 안
    걸렸지"를 추적할 필요가 없게 했다.
  - 제안: 없음(우수 사례로 기록).

- **[INFO]** spec 층 갱신 필요 항목(3건: `7-llm-client.md §8.3` 실패 shape 미문서화,
  `3-error-handling.md §1` LLM/통합 도메인 카탈로그 공백, `user-guide-evidence.md §2.1` 신규
  가드 미등재)은 developer 쓰기 권한 밖으로 정확히 판단돼 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 백로그로 이관돼 있다
  - 위치: `plan/in-progress/guide-error-code-truth.md` §E, `plan/in-progress/spec-draft-nullable-notation-followups.md`(신규 항목 3건)
  - 상세: CLAUDE.md 역할 경계(`developer`는 `spec/` read-only)를 정확히 지킨 처리이며, 이미
    5개 checker(두 라운드)가 동일 결론에 도달했다. 문서화 관점에서 이 PR의 결함으로 등재하지
    않는다 — 절차가 규약대로다.
  - 제안: 없음(추적 확인용).

- **[INFO]** `plan/in-progress/guide-error-code-truth.md`(진행 중 plan)의 frontmatter에
  `spec_impact`가 없음 — 결함 아님
  - 위치: `plan/in-progress/guide-error-code-truth.md` frontmatter(`worktree`/`started`/`owner` 3필드만)
  - 상세: `.claude/docs/plan-lifecycle.md` §5(Gate C)에 따르면 `spec_impact`는 **완료
    시점**(`complete/` 이동 시) 필드이며 in-progress 단계에서는 의무가 아니다(`spec-plan-completion.test.ts`가 `plan/complete/`만 검사). 이 plan은 아직 `in-progress/`에 있으므로 필드 부재가
    정상이다.
  - 제안: 없음.

## 요약

이번 라운드에서 재검증한 결과, 앞선 두 라운드(코드 리뷰 10_12_19, impl-done consistency-check
10_12_54)가 지적한 문서 관련 WARNING(엔진-레벨 표의 `LLM_RATE_LIMIT` 중복, `run-results.mdx`의
잔존 `nodeName`, `collectBackendTokens` 파라미터 오명명)은 모두 현재 소스에서 이미 해소돼 있다.
CHANGELOG·DTO 주석·JSDoc의 정량 주장(8갈래 문장, `latencyMs` 생산자 0건 등)을 저장소 실측과
전수 대조했고 어긋남이 없었다. 신규 가드 두 파일과 신규 parity 테스트는 판정 축을 좁힌 근거를
실측 표로 남겨 이 프로젝트 문서 관례 중 상위권 수준이다. 유일하게 눈에 띈 것은 **이전
maintainability 라운드 자신의 위치 인용 오류**(근거 주석이 함수 시그니처 안에 있다는 주장 —
직접 대조 결과 정상적인 leading JSDoc 위치)인데, 이는 이번 PR의 결함이 아니라 커밋된 리뷰
산출물 자체의 부정확한 서술이라 참고용 INFO로만 남긴다. spec 층 문서화 공백 3건은 모두 developer
권한 밖으로 정확히 판단돼 planner 백로그에 정식 등재돼 있다. CRITICAL/WARNING 급 문서 결함은
발견되지 않았다.

## 위험도

NONE
