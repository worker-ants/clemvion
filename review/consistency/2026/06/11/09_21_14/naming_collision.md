# 신규 식별자 충돌 검토 결과

검토 범위: `spec/2-navigation/` (구현 완료 후 검토, diff-base=origin/main)
실제 변경 파일:
- `codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx`
- `codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx`
- `codebase/frontend/src/components/knowledge-base/__tests__/unsearchable-banner.test.tsx`

spec/ 변경: 없음 (git diff origin/main -- spec/ 출력 0줄).

---

## 발견사항

이번 변경이 도입한 신규 식별자는 4개다.

### 1. `interface UnsearchableBannerProps`

- target 신규 식별자: `UnsearchableBannerProps` (기존 `Props` 를 파일 내에서 rename)
- 기존 사용처: 동일 파일(`unsearchable-banner.tsx`) 내 `interface Props` — 파일 외부로 export 되지 않음
- 충돌 여부: 없음. `UnsearchableBannerProps` 라는 이름은 codebase 전체(`codebase/frontend/src/`) 어디에도 존재하지 않았다. 타 컴포넌트들은 각자의 `*Props` 접미사 패턴(예: `EmbeddingModelComboboxProps`, `KbSelectorProps`)을 사용 중이며 서로 독립 파일 스코프.
- 상세: rename 이므로 외부 계약 변화 없음.

### 2. `type ReembedStatus`

- target 신규 식별자: `type ReembedStatus` (로컬 type alias, `KnowledgeBaseData["reembedStatus"]` 파생)
- 기존 사용처: `codebase/frontend/src/lib/api/knowledge-bases.ts` line 30, 83 에 `"idle" | "in_progress"` 인라인 리터럴로 이미 사용 중. 백엔드(`knowledge-base.service.ts` line 392, `rag-search.service.ts` line 65)도 동일 리터럴 유니온을 `reembedStatus: 'idle' | 'in_progress'` 형태로 로컬 선언.
- 충돌 여부: `ReembedStatus` 라는 이름의 exported type/interface 는 codebase 어디에도 없다. 신규 선언은 파일 내 private type alias 이며 export 되지 않으므로 충돌 없음.
- 상세: 의미도 동일(같은 KB 도메인의 같은 필드를 참조). 동일 의미의 리터럴 유니온이 여러 파일에 중복 선언된 상태는 현 시점에서 기존 문제이며 이번 PR 범위 밖이다.

### 3. `const STATE_CONFIG`

- target 신규 식별자: `STATE_CONFIG` (파일 스코프 module-level 상수)
- 기존 사용처: `codebase/frontend/src/` 전체에서 `STATE_CONFIG` 라는 module-level 상수는 `unsearchable-banner.tsx` 이외에 존재하지 않는다.
- 충돌 여부: 없음. export 되지 않으므로 전역 충돌 위험 없음.

### 4. 파일 경로

- target 신규 파일: 없음. 기존 `unsearchable-banner.tsx` 를 in-place 수정.
- 충돌 여부: 없음.

---

## 요약

이번 KB 배너 리팩터 변경은 `unsearchable-banner.tsx` 내부의 리팩터링(Props rename, 로컬 type alias 추가, 로컬 STATE_CONFIG 상수 도입)에 국한된다. 도입된 4개의 신규 식별자(`UnsearchableBannerProps`, `ReembedStatus`, `STATE_CONFIG`, 파일 경로 변경 없음) 중 외부로 export 되는 것은 하나도 없으며, codebase 전체에서 동일한 이름이 다른 의미로 사용된 사례도 발견되지 않았다. spec/ 은 변경이 없으므로 요구사항 ID, API endpoint, 이벤트명, 환경변수 충돌 검토 대상이 발생하지 않는다.

---

## 위험도

NONE
