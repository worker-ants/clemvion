# 요구사항(Requirement) 리뷰

## 검토 범위

`origin/main` 대비 138개 변경 파일 중 실질 기능 변경은 25개(`codebase/**` 20 · `plan/**` 2 ·
`CHANGELOG.md`/`PROJECT.md` 2). 나머지 113개는 이 브랜치 안에서 이미 수행된 4라운드 리뷰
(`review/code/2026/09/13/{10_12_19,10_40_34,11_07_36,11_33_23}` +
`review/consistency/2026/09/13/{01_15_40,10_12_54,11_33_51}`)의 산출물이며, 본 리뷰는 그
산출물을 신뢰하지 않고 핵심 코드·spec 을 직접 재대조했다.

핵심 기능 변경 두 갈래:
1. `POST /api/model-configs/:id/test` 실패 응답 필드명 정정(`error`→`message`) + 미발행
   `latencyMs` DTO 필드 제거 + 형제 `TestConnectionResultDto` 의 `code`/`meta` 방향 정리.
2. 유저 가이드가 이름으로 적은 존재하지 않는/은퇴된/지어낸 에러 코드 5종 정정 + 이를 지키는
   신규 build-time 가드(`guide-error-code-existence`, `guide-sanitized-message-parity`).

## 직접 재검증한 사실 (Read/Grep, 리뷰 산출물 인용에 의존하지 않음)

- `LlmService.testConnection` (`codebase/backend/src/modules/llm/llm.service.ts:326,354`) —
  반환 타입·catch 분기 모두 `message` 로 일관. `ModelTestConnectionResultDto`
  (`model-config-response.dto.ts:49-66`)·프런트 `model-configs.ts:138-144`·소비 컴포넌트
  `model-config-manager.tsx:79-101` 세 층이 전부 `message` 로 일치함을 확인. 실패 시
  `!result.success` 분기에서 즉시 `return` 하여 `updateMock`(차원 저장)이 호출되지 않는 것도
  코드로 확인 — `model-config-manager.test.tsx` 신규 테스트의 단언과 일치.
- `sanitizeLlmErrorMessage` (`sanitize-error.util.ts`) 8개 반환 리터럴을
  `models.mdx`/`models.en.mdx` 신규 표와 문자 단위로 대조 — 8개 전부 일치. 신설
  `guide-sanitized-message-parity.test.ts` 의 정규식(`/^\|\s*([A-Z][^|]*?\.)\s*\|/gm`)이
  다중 마침표 셀에서도 non-greedy + `[^|]*` 배타 매칭으로 셀 전체를 정확히 캡처함을 직접
  트레이스로 확인.
- `TestConnectionResultDto.code?: string` 신설 — `IntegrationTestResult.code`
  (`integrations.service.ts:79`)·`spec/2-navigation/4-integration.md:798`(
  `200 + { success:false, code:'INTEGRATION_INCOMPLETE' }`)와 대조해 spec 이 이미 문서화한
  필드를 DTO 가 뒤늦게 선언한 것임을 확인. `meta` 제거는 `IntegrationTestResult` 인터페이스에
  해당 필드가 없음을 직접 확인.
- `run-results{,.en}.mdx` 의 신규 노드-종류별 코드표(HTTP/DB/Email/LLM/Code/Sub-workflow) —
  `spec/5-system/3-error-handling.md §1.4` 표와 **행 단위로 완전히 일치**(누락 0, 초과 0).
  `HTTP_TIMEOUT`(spec 이 "미발행" 으로 명시)이 가이드 표에서 정확히 빠져 있는 것도 확인.
- MakeShop 가이드의 `MAKESHOP_UNRESOLVED_PATH_PARAM` 관련 신규 `<Callout>` —
  `makeshop.handler.ts:359-360,435-436` 을 직접 읽어 "일반 `Error`(→ `IntegrationError` 가
  아님) → catch 에서 `INTEGRATION_CALL_FAILED` 공용 fallback, 원인은 `message` 접두로만
  남는다"는 서술이 실제 분기와 정확히 일치함을 확인. 형제 셋(`MAKESHOP_UNKNOWN_OPERATION`/
  `MISSING_FIELDS`/`INVALID_SHOP_UID`)이 `IntegrationError` 첫 인자로 실제 코드가 되는 것도
  확인.
- `guide-error-code-scan.ts`/`guide-error-code-existence.test.ts` — 스캐너 자체 로직(3축 판정,
  코드-문맥 신호, 표 경계 판정)과 자기 한계 서술("존재 검사이지 방출 검사가 아니다")이 코드와
  주석 양쪽에서 일관되고, 그 한계로 인해 실제로 새로 놓친 사례(`MAKESHOP_UNRESOLVED_PATH_PARAM`)
  가 발생했었음을 별도 커밋(`42680d5f9`)에서 이미 고쳤음을 확인.

## 발견사항

- **[INFO][SPEC-DRIFT 아님 — 이미 등재된 갭]** `spec/conventions/user-guide-evidence.md §2` 의
  가드 인벤토리("Build-time 가드 (3건)")가 이 PR 이 신설한 두 가드
  (`guide-error-code-existence.test.ts`, `guide-sanitized-message-parity.test.ts`)를 반영하지
  못해 실제(5건)와 어긋난다.
  - 위치: `spec/conventions/user-guide-evidence.md:68` (`## 2. Build-time 가드 (3건)`)
  - 상세: CHANGELOG/PROJECT.md 는 두 신규 가드를 "user-guide-evidence.md 의 가드 가족" 으로
    서술하지만 정작 그 spec 문서의 §2 표·§2.1 관계표에는 반영돼 있지 않다. 다만 이것은
    developer 가 놓친 것이 아니라 **의도적으로 escalate 된 상태**다 —
    `plan/in-progress/spec-draft-nullable-notation-followups.md:3243-3257` 에 정확히
    "3건 → 5건, 관계표에 두 가드 설명 행 추가" 로 planner 턴 항목 등재가 이미 돼 있다
    (developer 는 `spec/` 를 직접 고칠 권한이 없으므로 이 처리가 맞는 절차다).
  - 제안: 코드 fix 대상 아님. planner 가 다음 턴에 §2/§2.1 을 갱신하면 해소된다. 이미
    등재돼 있으므로 추가 조치 불요 — 인지 목적으로만 기록.

- **[INFO][out-of-scope, pre-existing]** `run-results{,.en}.mdx` 의 엔진 레벨 `FieldTable`
  중 `EXECUTION_TIMEOUT` 행 설명("Per-node or overall workflow timeout exceeded.")이
  `spec/5-system/3-error-handling.md §1.4` 의 정의(Code 노드 스크립트 실행 타임아웃 한정,
  누적 실행시간 초과는 별도 코드 `EXECUTION_TIME_LIMIT_EXCEEDED`)와 정확히는 다르다.
  - 위치: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.en.mdx` (엔진 레벨
    `FieldTable`, `EXECUTION_TIMEOUT` 행) / `run-results.mdx` 동일 행
  - 상세: 이 행은 이번 diff 가 건드리지 않은 기존 문장이다(diff 는 그 표에서 은퇴 코드 2행만
    제거했을 뿐 이 행은 무변경). 이번 PR 의 취지("가이드가 적은 에러 코드는 실재해야 한다")와는
    결이 다른 별개의 서술 정확도 문제라 이 PR 의 결함으로 등재하지 않지만, 같은 표를 만지는
    후속 작업이 있다면 함께 정정할 후보로 남긴다.
  - 제안: 이번 PR 범위 밖 — 조치 불요, 참고용 기록.

- **[INFO]** 신규 가드(`guide-error-code-scan.ts`)의 "존재 검사이지 방출 검사가 아니다" 라는
  한계는 코드·CHANGELOG·plan 세 곳에서 일관되게 self-disclosure 되어 있고, 그 한계로 실제
  발생한 결함(`MAKESHOP_UNRESOLVED_PATH_PARAM` 오귀속)은 같은 브랜치의 후속 커밋
  (`42680d5f9`)에서 이미 수정 완료됨을 확인했다. 새로 조치할 것 없음 — 검증 결과만 기록.

## 요약

`testConnection` 3층 필드명 불일치(서비스 `error` vs DTO/프런트 `message`)로 실패 사유가
화면에 전혀 도달하지 않던 실제 버그를 정확히 짚어 고쳤고, 서비스 반환·DTO 선언·프런트 소비·
컴포넌트 테스트·와이어 레벨 계약 테스트(`assertMatchesContract`)까지 전 층을 직접 대조해
일치함을 확인했다. 형제 `/api/integrations/:id/test` 의 `code`/`meta` 필드 정리도
`spec/2-navigation/4-integration.md §9.1` 및 실제 서비스 반환 타입과 정확히 일치한다. 유저
가이드가 적은 에러 코드 정정(모델 연결 테스트 8갈래 문장표, 실행 결과 노드-종류별 코드표,
MakeShop 코드 정정)은 `spec/5-system/3-error-handling.md §1.4` 와 실제 handler 코드를 행
단위로 대조해도 어긋남이 없다. 신규 가드 2종(`guide-error-code-existence`,
`guide-sanitized-message-parity`)은 판정 축과 자기 한계가 코드·주석에 명시적으로 기록돼
있고, 그 한계로 인한 실측 결함(MakeShop 오귀속)은 이미 후속 커밋으로 해소됐다. 유일하게
남은 결이 다른 지점은 `spec/conventions/user-guide-evidence.md §2` 의 가드 인벤토리가
"3건" 으로 낡은 것인데, 이는 developer 권한 밖 spec 수정이라 이미 plan 트래커에 planner
턴 항목으로 정확히 등재돼 있어 이 PR 의 미비로 볼 수 없다. 기능 완전성·엣지 케이스·에러
시나리오·반환값·spec 정합성 모든 관점에서 새로운 CRITICAL/WARNING 급 결함을 찾지 못했다.

## 위험도

LOW
