# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위

- target: `spec/conventions/` (scope 델타 0개 파일 — 이 브랜치는 spec/conventions 를 바꾸지 않았다. 정상.)
- 실제 변경: `guide-error-code-existence.test.ts` + `guide-error-code-scan.ts` (삭제) →
  `guide-identifier-existence.test.ts` + `guide-identifier-scan.ts` (신규) 로 교체. 유저 가이드가
  인용하는 UPPER_SNAKE 식별자(에러 코드 + 환경변수) 실재성 가드를 일반화한 리네임/재작성.
  `PROJECT.md`·`CHANGELOG.md`·`plan/in-progress/guide-identifier-existence.md` 동반 갱신.
- 판정은 워킹트리 HEAD(`git -C .../guide-identifier-existence grep|show`)를 1차 근거로 삼았다.

## 점검한 신규 식별자와 결과

| 신규 식별자 | 종류 | 충돌 검색 결과 |
|---|---|---|
| `guide-identifier-existence.test.ts` / `guide-identifier-scan.ts` | 파일 경로 | `codebase/frontend/src/lib/docs/__tests__/` 내 기존 `<subject>-existence.test.ts` + `<subject>-scan.ts`/`-parse.ts` 명명 패턴(`impl-anchor-existence.test.ts`/`impl-anchor-parse.ts`, `spec-link-integrity.test.ts`/`spec-links.ts` 등)과 일치. 동명 파일 없음. 삭제된 `guide-error-code-*` 두 파일과 경로 중복 없음(완전 교체) |
| `CitationAxis` (`"field-table"\|"code-field"\|"backtick"`) | 타입명 | 동명 타입이 옛 `guide-error-code-scan.ts` 에도 있었으나 그 파일은 같은 커밋에서 삭제됨 — 사용처가 신규 파일 내부로 한정되어 충돌 없음. 리터럴 유니온도 `"prose"`→`"backtick"` 로 교체(공존 아님) |
| `IdentifierCitation`, `scanIdentifierCitations`, `collectSourceTokens`, `collectEnvDeclarations` | 함수/인터페이스명 | 저장소 전체에서 신규 파일과 그 import 지점(테스트·`PROJECT.md`·`CHANGELOG.md` 서술) 외 사용처 없음. 충돌 없음 |
| `GUIDE_EXTERNAL_VOCABULARY` (const, `{token, system, why}[]`) | 엔티티/상수명 | 저장소 전체에서 신규 파일·해당 테스트·`CHANGELOG.md` 서술 외 사용처 없음. 다른 allowlist 상수와 이름 겹침 없음 |
| `MCP_ALLOW_INSECURE_URL` (테스트 주석 내 인용) | 환경변수 | `codebase/backend/.env.example:331`·`mcp.config.ts`·`production-guards.ts` 의 **실재하는** 기존 변수와 일치(신규 도입 아님, 정정 사례를 주석으로 인용한 것뿐) |
| `MCP_INSECURE_URL_ALLOWED` (테스트 주석 내 인용) | 환경변수 | 저장소 전체에 실재하지 않음 — 과거 오탈자 사례를 "부재해야 정상"인 반례로 인용한 것이라 신규 식별자 도입이 아님 |

## 발견사항

없음. 이 PR 이 새로 도입한 파일명·타입명·함수명·상수명 중 기존 사용처와 의미가 다르게 겹치는 것을 찾지 못했다. 삭제되는 `guide-error-code-*` 파일에 대한 참조는 `spec/conventions/user-guide-evidence.md`(가드 가족을 구체 파일명이 아니라 개념으로만 서술)와 `PROJECT.md`(신규 파일명으로 갱신됨)에 남아 있지 않음을 확인했다 — 리네임 후 댕글링 레퍼런스 없음. `plan/complete/guide-error-code-truth.md` 에 옛 파일명이 남아 있는 것은 완료된 이력 문서의 정상적인 스냅샷이라 충돌로 보지 않는다.

## 참고 (충돌은 아니나 인접 관찰)

- 이 배치는 `spec/conventions/user-guide-evidence.md §2` 에 새 가드 패밀리 항목을 등재해야 한다는 점을 plan 자체가 명시하고 있다(`plan/in-progress/guide-identifier-existence.md` 상단 배너, developer 권한 밖 → planner 항목으로 등재됨). 이는 신규 식별자 **충돌**이 아니라 SoT 등재 지연 사안이라 본 checker 관점 밖으로 판단했다.

## 요약

target scope(`spec/conventions/`)에 대한 실제 변경은 0건이며, 이번 PR 의 실질 변경은 harness 테스트 파일 두 쌍의 교체(에러 코드 전용 가드 → 식별자 전반 가드로 일반화)다. 새로 도입된 파일 경로·타입명·함수명·상수명(`guide-identifier-existence.test.ts`/`guide-identifier-scan.ts`, `CitationAxis`, `IdentifierCitation`, `scanIdentifierCitations`, `collectSourceTokens`, `collectEnvDeclarations`, `GUIDE_EXTERNAL_VOCABULARY`)을 저장소 전수 grep 으로 대조한 결과 기존 사용처와 의미가 다르게 겹치는 사례는 없었고, 옛 `guide-error-code-*` 식별자에 대한 댕글링 참조도 없다. 파일 명명은 같은 디렉터리의 기존 `<subject>-existence.test.ts` + `<subject>-scan.ts` 컨벤션을 그대로 따른다.

## 위험도

NONE
