# Scope Review — plan-scan.ts 추출 (plan-lifecycle-gates)

## 발견사항

없음.

## 요약

리뷰 대상 4개 파일(`plan-scan.ts` 신설, `plan-scan.test.ts` 신설, `plan-frontmatter.test.ts`,
`spec-links.ts`)은 커밋 이력(`9e880e908` → `f4a1723be` → `882f15d6f` → `ebb6f9598`)이 보여주는
단일 작업 흐름의 마지막 단계 — "3라운드 리뷰 WARNING(status 검사가 fixture 로 증명되지 않음,
link 검사와 달리 인라인에 남아있음)을 근본 해결하기 위한 리팩터링 추출" — 그 자체다. 각 변경이
명시된 목적에 정확히 대응한다:

- `plan-scan.ts` 신설은 `plan-frontmatter.test.ts`에 인라인이던 `TERMINAL_STATUSES` /
  `findNonTerminalCompletedPlans` / plan 트리 walker 를 그대로 옮긴 것이며, 저장소에 이미
  존재하던 4번째 독립 walker(`spec-plan-completion.test.ts`의 `collectCompletePlans`)와 필터
  규칙(`0-`/`_`/`archive` 제외)이 실제로 일치함을 확인했다 — 주석의 "네 벌 있었다" 주장이
  사실과 부합한다.
- `plan-scan.test.ts` 신설은 방금 추출한 모듈의 negative-path fixture 로, 커밋 메시지가 밝힌
  "158 tests 전량 GREEN 인데 위반 수집 분기가 한 번도 실행되지 않았다"는 리뷰 지적을 직접
  해소하는 테스트다. 심어둔 위반 개수(3건)를 정확히 그만큼만 잡는지 단언하는 over-reach 방지
  테스트까지 포함해 기능 확장 없이 검증만 강화했다.
- `plan-frontmatter.test.ts`의 `collectTopLevelPlans`는 손으로 짠 순회를
  `collectLivePlanMarkdown` 위임으로 교체 — "두 곳이 조용히 틀어진다"는 동일 파일 상단 경고를
  자신이 반복하던 것을 스스로 고친 변경이라 범위 내다. 추가된 두 `describe` 블록(status 모순 ·
  상대링크 무결성)은 이 PR 계열이 도입 중인 두 게이트 그 자체다.
- `spec-links.ts`의 `findBrokenPlanLinks` 신설 + `collectLivePlanMarkdown` re-export 는 (b)
  링크 게이트가 요구하는 공유 구현 단일화이며, 기존 호출부(`plan-frontmatter.test.ts`)를 깨지
  않기 위한 re-export 라 하위 호환 목적이 분명하다.

포맷팅-only 변경, 미사용 임포트, 관련 없는 설정 파일 수정, 목적 없는 주석 정리는 발견되지 않았다.
`spec-links.ts`에 추가된 `import { collectLivePlanMarkdown } from "./plan-scan";`가 기존
node 내장 임포트와 외부 라이브러리 임포트 사이에 끼어들어 그룹 순서가 다소 어색하지만
(node 내장 → 상대 → 외부 라이브러리), 기능·범위 문제는 아니고 스타일 수준이라 CRITICAL/WARNING
대상은 아니다. 코드 자체는 커밋 히스토리와 정확히 대응하는 단일 목적 추출로, scope 관점에서
지적할 사항이 없다.

## 위험도

NONE
