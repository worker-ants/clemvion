### 발견사항

없음.

target 은 `spec/conventions/spec-impl-evidence.md` 로 지정되어 있으나 "구현 대상 spec 영역" 은 `(없음)` 이며, 실제 diff (`codebase/frontend/src/lib/docs/__tests__/spec-links.ts`) 는 spec-link 검증 테스트 헬퍼 내부의 순수 리팩터링이다:

- `findBrokenLinks`(spec markdown 대상)와 `findBrokenSpecLinksInSources`(codebase 소스 대상)에 중복돼 있던 DEAD/ANCHOR 스캔 로직을 `findBrokenLinksInFiles` 공용 함수로 추출하고, 두 진입점의 차이(같은 파일 내 `#anchor` 자기참조 검사 여부 `checkSelfAnchors`, 대상 경로 필터 `targetFilter`)를 옵션으로 표현했다.
- 동작 등가성: 리팩터링 전 `findBrokenLinks` 는 self-anchor 를 항상 검사했고(`checkSelfAnchors: true`), `findBrokenSpecLinksInSources` 는애초에 self-anchor 분기 자체가 없었다(코드 소스는 heading 이 없으므로 사실상 `checkSelfAnchors: false`와 동일 효과). `targetFilter` 도 기존 `SPEC_MD_TARGET_RE` 필터를 그대로 함수 인자화한 것이다. 새 옵션은 기존 두 함수 각각의 기존 동작을 그대로 보존하는 방향으로 선택되어 있어 회귀는 없다.
- 공개 함수 시그니처(`findBrokenLinks(root)`, `findBrokenSpecLinksInSources(root)`, `LinkViolation` 인터페이스)는 변경되지 않았고, `spec/**` 나 `codebase/**` 어디에도 이 함수들이 반환하는 shape 을 API 계약이나 데이터 모델로 명세하는 문서가 없다(`spec/conventions/spec-impl-evidence.md` 는 `code:` frontmatter 에 파일 경로만 참조).

이 변경은 엔티티·API·요구사항 ID·상태 머신·RBAC·계층 책임 중 어느 것도 신규로 도입하거나 수정하지 않는 test-only 내부 리팩터링이므로, Cross-Spec 6개 관점 어디에도 해당 사항이 없다. 함께 제공된 "관련 spec 본문"(`spec/0-overview.md`, `spec/1-data-model.md`)은 이 diff 와 직접적으로 연관되는 내용이 없는 일반 cross-cutting 참고 자료였다.

### 요약
target 의 실제 diff 는 프런트엔드 spec-link 검증 테스트 유틸리티(`spec-links.ts`)의 순수 DRY 리팩터링이며, spec 본문 변경이나 신규 데이터 모델·API·요구사항 ID·상태 전이·RBAC·계층 책임 선언이 전혀 없다. 두 공개 함수의 관찰 가능한 동작은 리팩터링 전과 동일하게 보존되어 있어 다른 spec 영역과 충돌할 표면 자체가 존재하지 않는다.

### 위험도
NONE
