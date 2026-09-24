# 신규 식별자 충돌 검토

## 검토 범위

이 PR 은 `spec/` 델타가 0개(코드 전용 변경)다. 구현 diff 는 3개 파일 / 160줄:

- `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts` — 새 순수 술어 `isPendingPlanPath(relPath: unknown): boolean` + 모듈-local 상수 `PENDING_PLAN_DIRS` 추가
- `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.test.ts` — 위 술어의 단위 테스트 8건
- `codebase/frontend/src/lib/docs/__tests__/spec-pending-plan-existence.test.ts` — 가드에 `isPendingPlanPath` 호출 추가

요구사항 ID·API endpoint·이벤트/메시지명·환경변수는 이 diff 에 등장하지 않는다(관점 1·3·4·5 는 해당 없음). 새 spec 파일도 생성되지 않는다(관점 6 해당 없음). 따라서 실질 검토 대상은 관점 2(엔티티/함수/상수명)뿐이다.

## 발견사항

### 신규 식별자 존재 여부 확인 (충돌 없음)

- **`isPendingPlanPath`**: `codebase/`, `spec/`, `plan/` 전역에서 이 diff 가 도입한 3개 파일 + `plan/in-progress/pending-plan-is-plan.md`(본 작업의 plan 문서, 서술용 인용) + `CHANGELOG.md`(같은 변경의 로그) 외에는 등장하지 않는다. 기존 코드에 동명 함수·변수 없음.
- **`PENDING_PLAN_DIRS`**: 위와 동일하게 신규 도입 파일 외 등장 없음. `codebase/backend`, `codebase/packages`, `codebase/channel-web-chat` 전체를 grep 해도 0건.

두 식별자 모두 새로 도입된 이름이며 기존 사용처와 다른 의미로 이미 쓰이고 있는 사례가 없다 — CRITICAL 없음.

### 명명 관례 정합성 (충돌 아님, 참고용 INFO)

- **[INFO]** `PENDING_PLAN_DIRS` 는 같은 파일의 자매 상수 `INCLUDE_PREFIXES`/`EXCLUDE_BASENAMES`/`CATALOG_FIELD_FILE` 와 나란히 있고, 같은 파일의 `isApplicable` 술어 패턴(`export function is...(relPath): boolean`)을 그대로 따른다. 명명 스타일은 기존 컨벤션과 정합적이다. 다만 `spec-links.ts` 의 동류 상수(`GOVERNANCE_SKIP_DIRS`, `CODEBASE_SKIP_DIRS`)는 `Set<string>` 인 반면 `PENDING_PLAN_DIRS` 는 `string[]` 이다 — 이름 자체의 충돌은 아니고 값 타입 선택의 사소한 불일치라 등급을 매길 정도는 아니다.
- **[INFO]** `plan-scan.ts` 에 이미 `isLifecyclePlan(name: string): boolean` 이라는, 이름과 목적이 유사한 술어(파일명이 `0-`/`_` 접두가 아닌 `.md` 인지 판정 — plan 트리 워커의 파일 포함 필터)가 존재한다. `isPendingPlanPath(relPath: unknown): boolean` 은 이름이 다르고(`isLifecyclePlan` vs `isPendingPlanPath`), 검증 대상도 다르다(파일 basename vs 정규화된 상대 전체 경로 + in-progress/complete 위치 제약). 함수명이 겹치지 않아 실제 충돌은 아니지만, 두 술어 모두 "이것이 plan 인가"를 묻는 질문이라 향후 세 번째 유사 술어가 추가될 때 이름이 더 근접해질 위험은 있다(예: `isPlanFile` 류 이름을 새로 붙이면 혼동 가능). 현재로서는 조치 불요.

## 요약

이 변경은 신규 spec ID·API endpoint·이벤트명·환경변수를 전혀 도입하지 않으며, 새로 도입한 두 코드 심볼(`isPendingPlanPath`, `PENDING_PLAN_DIRS`)은 저장소 전체에서 grep 0건으로 확인되어 기존 사용처와 충돌하지 않는다. 명명 스타일도 같은 파일의 기존 술어/상수 패턴(`isApplicable`, `INCLUDE_PREFIXES` 등)을 그대로 따라 일관적이다. `plan-scan.ts` 의 `isLifecyclePlan` 과 목적이 인접하지만 이름이 구별되고 검증 대상이 달라 충돌로 볼 수준은 아니다(INFO 로만 기록). 신규 식별자 충돌 관점에서 이 PR 을 막을 이유는 없다.

## 위험도

NONE
