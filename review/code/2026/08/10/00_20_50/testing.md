# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** (a) "완료 plan 의 status 모순" 검사에 탐지 로직 자체를 증명하는 negative-path/fixture 테스트가 없다 — 라이브 저장소 상태에만 의존하는 vacuous-pass 위험
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:195` (`it("no completed plan still declares \`status: in-progress\`" ...)`, 검사 로직 본문 195-218), 관련 헬퍼 `collectCompletedPlans` 55-71, `TERMINAL_STATUSES` 80
  - 상세: 이 파일 헤더 주석(22-33행)이 정확히 이 실패 패턴을 명시적으로 경고한다 — "뮤테이션으로 확인했더니 spec/plan 문서 가드 18파일 / 2821 tests 가 전부 GREEN 이었다 — 이 필드는 게이트가 아니라 사람의 규율에만 기대고 있었다." 같은 PR 의 자매 검사 (b) `findBrokenPlanLinks` 는 이 교훈을 받아 로직을 `spec-links.ts` 로 추출해 exported 함수로 만들고 `spec-links.test.ts` 에 합성 temp-dir fixture(DEAD 링크·펜스 무시·self-anchor 등)로 실제 탐지가 작동함을 증명한다. 반면 (a) 는 `collectCompletedPlans` + `TERMINAL_STATUSES` 비교 로직이 `plan-frontmatter.test.ts` 안에 export 되지 않는 로컬 함수/인라인 코드로만 존재해, 동일한 방식의 fixture 검증이 구조적으로 불가능하다. 실측: 현재 저장소에 `status: in-progress` 인 완료 plan 이 없으므로 `wrong.push(...)` 분기는 테스트 실행 중 한 번도 실행되지 않는다(`npx vitest run plan-frontmatter.test.ts spec-links.test.ts` → 158 tests 전부 GREEN, 이 분기 unexercised). 향후 `data.status` 필드명 오타, `TERMINAL_STATUSES.has` 조건 반전/삭제 같은 조용한 회귀가 들어와도 지금 이 테스트 스위트는 계속 초록일 것이다 — 이 정확한 클래스의 결함이 이미 두 번(`#1108`, `#1117`) 놓쳤다고 헤더에 스스로 적어 두고 있다.
  - 제안: `collectCompletedPlans` + status 비교 로직을 `spec-links.ts`(또는 별도 shared 모듈)의 `root` 파라미터를 받는 export 함수(예: `findNonTerminalCompletedPlans(root): string[]`)로 추출하고, `spec-links.test.ts` 에 `plan/complete/*.md` 에 `status: in-progress`(또는 임의 non-terminal 값)를 가진 합성 fixture 를 만들어 "실제로 위반이 잡히는지" 를 증명하는 negative-path 테스트를 추가할 것. (b) 의 "non-vacuity" 패턴을 그대로 재사용 가능.

- **[INFO]** 테스트명이 실제 검사 범위보다 좁게 서술됨 — allowlist 방식(`TERMINAL_STATUSES` 밖의 모든 문자열을 위반으로 처리)인데 이름은 `in-progress` 리터럴만 언급
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:195` (`it("no completed plan still declares \`status: in-progress\`", ...)`)
  - 상세: 구현(209-211행)은 `status` 가 `TERMINAL_STATUSES = {complete, implemented, applied, superseded}` 에 없으면 그 값이 무엇이든(`draft`, `paused` 등) 위반으로 잡는다. 테스트 이름은 `in-progress` 케이스만 예시로 들지만 실제로는 더 넓은 allowlist 검사라, 이름만 보면 검사 범위를 과소평가하기 쉽다.
  - 제안: 테스트명을 "declares a non-terminal status" 등으로 일반화하거나, 최소한 이름 옆에 "(any non-terminal value, not just literal `in-progress`)" 주석 보강.

- **[INFO]** `collectCompletedPlans` 의 재귀 `walk`(임의 깊이, `archive` 이름 디렉터리 스킵) 동작이 합성 fixture 로 검증되지 않고 라이브 저장소의 우연한 트리 형태에만 의존
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:55-71` (`collectCompletedPlans`)
  - 상세: 기존 `collectTopLevelPlans` 는 flat `readdirSync` 였지만 이 함수는 새로 작성된 재귀 walk 다. `archive` 명명 디렉터리 스킵, `.md` 확장자 필터, 임의 깊이 재귀가 모두 실 저장소 트리에서 우연히 검증될 뿐 전용 테스트가 없다.
  - 제안: 위 WARNING 항목과 함께 추출 시 nested `archive`/non-`archive` 서브디렉터리를 가진 temp fixture 로 단위 테스트 추가.

## 요약

이번 변경의 핵심은 두 개의 신규 게이트 — (a) `complete/` 이동 시 `status` 모순, (b) 살아있는 plan 의 깨진 상대링크 — 인데, (b) 는 로직을 `spec-links.ts` 공유 모듈로 추출해 `spec-links.test.ts` 에 DEAD/ANCHOR/코드펜스/서브폴더 면제/healthy-path 를 아우르는 견고한 negative-path fixture 를 갖추고 있고 뮤테이션 검증(M2 생존 사례를 실제로 잡아 고친 이력)까지 문서화돼 있어 테스트 품질이 우수하다. 반면 (a) status 모순 검사는 탐지 로직이 export 되지 않은 채 실 저장소에 대한 positive-only 검사로만 존재해, 파일 자신의 헤더가 명시적으로 경고하는 "뮤테이션으로 밝혀진 전원 GREEN" 실패 패턴과 동일한 구조적 위험(vacuous pass)을 안고 있다 — 실측으로도 현재 `wrong.push` 분기가 한 번도 실행되지 않음을 확인했다. 나머지(픽스처 격리, cleanup, mock 미사용·실제 파일시스템 기반 검증, 기존 테스트 회귀 없음)는 전반적으로 양호하다.

## 위험도
MEDIUM
