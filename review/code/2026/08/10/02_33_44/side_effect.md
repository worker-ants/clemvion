# 부작용(Side Effect) 리뷰 — plan-frontmatter.test.ts

## 발견사항

없음 (No Critical/Warning/Info findings).

리뷰 대상은 `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` 단일 테스트 파일이다. 실제 diff(직전 커밋 대비)는 다음 세 가지로 국한된다:

1. `import { extractLinks, findBrokenPlanLinks } from "./spec-links";` — 기존 import 문에 named import 하나 추가 (`spec-links.ts:extractLinks`, 순수 함수: `fs.readFileSync` 로 파일 하나를 읽어 링크 배열을 반환, 부작용 없음).
2. `"the plan link scanner actually sees links (non-vacuity)"` 테스트 본문을 "파일 수 카운트"에서 "`collectLivePlanMarkdown(root)` 로 얻은 파일들에 대해 `extractLinks` 를 reduce 하여 추출된 링크 총수를 세는" 방식으로 교체.
3. `"finds completed plans to validate"` → `"finds completed plans to validate (discovery only)"` 로 테스트 설명 문자열만 변경, 단언 로직(`collectCompletePlanMarkdown(root).length > 5`)은 그대로.

부작용 관점 점검 결과:

- **의도치 않은 상태 변경 / 전역 변수**: 해당 없음. 모든 신규 코드는 `it(...)` 콜백 내부 지역 변수(`links`)로 스코프가 닫혀 있고, 모듈 레벨 상수(`ISO_DATE`, `WORKTREE_PLACEHOLDER`, `WORKTREE_SENTINEL`)는 변경 diff 밖의 기존 코드다.
- **파일시스템 부작용**: `extractLinks` 는 `fs.readFileSync` 로 **읽기만** 한다(쓰기·삭제 없음). 호출 대상 경로는 `collectLivePlanMarkdown(root)` 가 실제로 디스크에서 찾은 파일의 `absPath` 이므로 정상 경로에서는 존재가 보장된다. 다만 `extractLinks` 자체는 `try/catch` 가 없어(같은 파일의 `headingSlugs` 는 read 실패 시 빈 Set 을 반환하도록 방어돼 있는 것과 대비) 파일이 테스트 실행 중 사라지는 등의 극단적 레이스에서는 예외를 던질 수 있다 — 이는 테스트 flakiness 리스크이지 이번 diff 가 새로 만든 "부작용"은 아니며, 등급을 매길 정도의 실질 위험은 아니다(참고용으로만 기록, 등급 부여 안 함).
- **시그니처/인터페이스 변경**: 없음. 테스트 파일이며 프로덕션 함수 시그니처나 공개 API 변경이 없다. `extractLinks`, `collectLivePlanMarkdown` 등 참조된 함수들은 기존 시그니처 그대로 사용된다.
- **환경 변수**: 읽기/쓰기 없음.
- **네트워크 호출**: 없음.
- **이벤트/콜백**: 없음. `reduce` 콜백은 순수 누산기이고 외부에 어떤 이벤트도 발생시키지 않는다.

## 요약

이번 변경은 테스트 파일 내부에서 "링크 추출 caniary" 를 파일-개수 기준에서 실제-추출-링크-개수 기준으로 강화하고 테스트 설명 문자열을 명확히 한 것으로, 순수 읽기 전용 로직(`fs.readFileSync` 기반 `extractLinks`)만 추가로 호출하며 전역 상태·환경 변수·네트워크·공개 인터페이스·함수 시그니처에 어떤 영향도 주지 않는다. 부작용 관점에서 지적할 사항이 없다.

## 위험도

NONE
