# 신규 식별자 충돌 검토 — `useResultDetailWaiting` / `deriveFlags`

## 검토 대상

- 신규 파일: `codebase/frontend/src/components/editor/run-results/use-result-detail-waiting.ts`
- 신규 hook: `useResultDetailWaiting()`
- 신규 closure: `deriveFlags(isSelectedWaiting: boolean)` (hook 내부, 반환 객체 프로퍼티로 노출)
- 배경: V-05 후속(#822 계열), `run-results-drawer.tsx` 와 `executions/[executionId]/page.tsx` 가 각자 중복 유도하던 waiting selector 블록을 단일 hook 으로 추출 (커밋 `b6a9c6cf5`, `358f12ca1`)

## 조사 방법

- 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/result-detail-props-hook-94eca4`) 기준 절대경로 grep/find 로 전체 `codebase/` 스캔
- `git log --oneline -5`, `git diff origin/main --stat` 로 변경 범위 확인
- 참고: `_prompts/naming_collision.md` 페이로드는 `spec/conventions/` 전체 및 여러 `plan/in-progress/*.md` 를 담고 있었으나, 실제 diff(`## 구현 변경 사항`) 섹션이나 hook 관련 언급이 전혀 없어 이번 실제 변경(hook 추출)과 무관한 것으로 판단. 사용자 프롬프트가 명시한 실제 target(신규 hook/파일)을 기준으로 코드베이스를 직접 검증함.

## 발견사항

없음. 아래는 확인한 항목별 결과.

### 1. hook 이름 `useResultDetailWaiting` 충돌 여부

`grep -rn "useResultDetail" codebase/` 결과, 정의는 `use-result-detail-waiting.ts` 1곳뿐이고 사용처는 의도된 두 소비처(`run-results-drawer.tsx`, `executions/[executionId]/page.tsx`)뿐이다. 동일/유사 이름의 다른 hook(`useResultDetail*`) 은 존재하지 않는다. 충돌 없음.

### 2. `deriveFlags` closure 이름 충돌 여부

`grep -rn "deriveFlags" codebase/` 결과, 정의·사용 전부가 `use-result-detail-waiting.ts` 및 그 두 소비처, 그리고 해당 unit 테스트(`use-result-detail-waiting.test.ts`)에 국한된다. 이 심볼은 export 되지 않고 hook 반환 객체의 프로퍼티로만 노출되므로 모듈 스코프 오염이 없고, 코드베이스 어디에도 동명의 다른 함수/변수가 없다. 충돌 없음.

### 3. 파일 경로 `use-result-detail-waiting.ts` 충돌 여부

`find codebase -iname "use-result-detail-*"` 결과 신규 파일과 그 테스트 파일뿐이다. 동일 디렉터리(`run-results/`)에 barrel(`index.ts`) 이 없어 재-export 충돌 경로도 없다. 기존 파일 명명 컨벤션(`use-<kebab-subject>.ts`, 디렉터리 내 다른 파일들도 `result-detail.tsx`/`result-timeline.tsx`/`resolve-result-field.ts` 등 kebab-case)과 일치한다. 충돌 없음.

### 4. 기존 `ResultDetail` 컴포넌트와의 관계 (참고, 문제 아님)

`ResultDetail` 은 기존 컴포넌트(`result-detail.tsx`)의 export 이름이다. 신규 hook `useResultDetailWaiting` 은 `use<컴포넌트명><관심사>` 패턴으로 그 컴포넌트가 쓰는 waiting 파생값을 제공하는 hook임을 의도적으로 드러낸 이름이며, 실제로 `ResultDetail` 자체가 아니라 그 소비처들(드로어·실행 상세 페이지)에서 계산 로직을 대체하는 용도로 쓰인다. 이름 유사성은 "동일 개념의 파생 hook" 관계를 의도적으로 반영한 것이며 다른 의미로 중복 정의된 사례는 없어 CRITICAL/WARNING 대상이 아니다.

### 5. 기타 관점 (요구사항 ID / API endpoint / 이벤트명 / ENV 변수)

이번 변경은 프런트엔드 내부 리팩터(hook 추출)로, 신규 요구사항 ID·API endpoint·webhook/queue/sse 이벤트명·ENV 변수/설정키를 전혀 도입하지 않는다. 해당 관점은 본 target 에 적용 대상이 없음.

## 요약

신규 hook `useResultDetailWaiting` 과 그 내부 closure `deriveFlags`, 파일 `use-result-detail-waiting.ts` 모두 코드베이스 전체를 기준으로 유일하게 정의되며, 이름이 겹치거나 다른 의미로 이미 쓰이고 있는 기존 식별자가 없다. 파일 명명도 디렉터리 컨벤션(kebab-case `use-*.ts`)을 따른다. `ResultDetail` 컴포넌트와의 이름 유사성은 의도된 관계(그 컴포넌트의 파생 상태를 제공하는 hook)이며 혼선을 유발하는 충돌이 아니다. 신규 식별자 충돌 관점에서 위험 요소가 발견되지 않았다.

## 위험도

NONE
