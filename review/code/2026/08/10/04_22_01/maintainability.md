# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `rawScalar` 가 `key` 파라미터를 이스케이프 없이 동적 정규식에 삽입
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:197` (`function rawScalar`)
  - 상세: `new RegExp(`^[ \\t]*${key}:[ \\t]*(.*)$`, "m")` 는 `key` 에 정규식 메타문자가 있으면 깨진다. 현재는 리터럴 `"started"` 로만 호출되어 안전하지만, private 헬퍼치고는 범용 시그니처(`key: string`)라 향후 다른 필드명으로 재사용될 때 조용히 오동작할 여지가 있다.
  - 제안: 당장 고칠 필요는 낮으나, JSDoc 에 "호출부는 리터럴 키만 허용, 정규식 메타문자 포함 키는 이스케이프 필요" 를 한 줄 명시하거나 `key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")` 로 방어하면 향후 호출부 확장 시 함정을 없앤다.

- **[INFO]** `WORKTREE_PLACEHOLDER` 정규식이 5개 대안을 한 줄 alternation 으로 묶어 개별 의도가 주석에 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:187` (`const WORKTREE_PLACEHOLDER = ...`)
  - 상세: `/\bTBD\b|assigned at impl|미정|착수\s*시|^pending$/i` 는 영어·한국어 관용구가 섞여 있고, 위 JSDoc(176-186)은 "왜 거부하는가"만 설명하고 "각 대안이 무엇을 매치하려는지"는 설명하지 않는다. 새 placeholder 어휘를 추가/삭제할 때 각 조각의 출처(어떤 실제 사례에서 관측됐는지)를 모르면 안전하게 편집하기 어렵다.
  - 제안: 각 alternation 뒤에 짧은 인라인 주석(예: `// "착수 시" 계열 한국어 표현`)을 붙이거나, 이미 확립된 스타일(다른 정규식 `ISO_DATE` 처럼)대로 명명된 하위 상수로 분리.

- **[INFO]** `spec-plan-completion.test.ts` 의 `startedDate` 와 `plan-scan.ts` 의 `isIsoDate` 가 같은 `started` 필드를 서로 다른 엄격도로 파싱
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:27` (`function startedDate`) vs `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:212` (`function isIsoDate`)
  - 상세: `plan-scan.ts` 의 JSDoc(204-211)은 "파싱 결과(Date 인스턴스)를 신뢰하면 안 된다 — js-yaml 이 잘못된 날짜를 조용히 굴려 유효한 Date 로 만든다" 를 명시적으로 경고한다. 그런데 `startedDate` 는 `data.started instanceof Date` 이면 검증 없이 그대로 반환하고, 문자열이면 `/^\d{4}-\d{2}-\d{2}$/` 자리수 정규식만 통과시켜 `new Date(...)` 로 변환한다 — 바로 옆 파일이 "부족하다" 고 명시한 그 검사 패턴이다. 용도가 다르다(Gate C 컷오프 비교 vs frontmatter 필드 유효성 검증)는 점에서 버그는 아니지만, 같은 파일 트리 안에 강도가 다른 두 날짜 파서가 나란히 있어 향후 유지보수자가 "이미 검증된 값이겠거니" 하고 오인할 위험이 있다.
  - 제안: `startedDate` 상단에 "이 함수는 컷오프 비교 전용이며 `started` 필드 자체의 유효성 검증은 `isIsoDate` 소관" 이라는 한 줄 교차 참조를 추가하면, 두 함수의 관계와 의도적 강도 차이가 명확해진다.

- **[INFO]** `expect(plans.length).toBeGreaterThan(10)` 의 임계값 `10` 이 근거 없이 하드코딩
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:88`
  - 상세: 바로 위 주석(82-83)은 "repoRoot 오탐지 → 빈 스캔 → 전량 grandfathered 집합의 vacuous pass" 를 방지하는 캐너리라고 설명하지만, 왜 `10` 인지(현재 plan 개수 대비 여유값인지, 임의의 "충분히 크다" 인지)는 밝히지 않는다.
  - 제안: 사소하지만 `// 2026-08 기준 실측 plan 개수 > 10, 여유 있게 하한선 설정` 같은 근거 한 줄을 덧붙이면 이후 plan 저장소가 줄어들 때(아카이빙 등) 이 숫자가 왜 깨졌는지 바로 판단할 수 있다.

## 요약

두 파일 모두 유지보수성 관점에서 상당히 높은 수준이다. 함수는 각각 단일 책임을 지키며 짧고(가장 긴 `checkPlanFrontmatter` 도 로직 자체는 20줄 내외), 중첩 깊이도 `walkPlanMarkdown` 의 while+for+if 3단이 최대로 과도하지 않다. 특히 두드러지는 강점은 "왜 이렇게 짰는가" 를 실측(mutation testing·리뷰에서 발각된 과거 결함)까지 인용해 문서화한 점으로, 매직 넘버·정규식·엣지케이스 대부분이 근거 주석을 동반해 코드 자체가 회귀 방지 지식 베이스 역할을 한다. 이번에 지적한 4건은 모두 INFO 수준의 사소한 보강 기회(동적 정규식 이스케이프 부재, 복합 정규식 개별 주석 부재, 두 날짜 파서 간 교차 참조 부재, 임계값 근거 부재)이며, 기능적 결함이나 구조적 위험은 발견되지 않았다.

## 위험도

LOW
