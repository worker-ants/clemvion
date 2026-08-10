# 변경 범위(Scope) 리뷰

## 컨텍스트 확인

- 대상 3파일은 `plan-lifecycle-gates` 브랜치(29 커밋, `feat(harness): plan 이동이 남기던 두 갭에 게이트` 시작 + 다수 `fix(harness)` 리뷰 반영 라운드)의 일부다.
- `plan-scan.ts`(신규, 318줄)·`plan-scan.test.ts`(신규, 371줄)는 origin/main 대비 전량 추가. `spec-plan-completion.test.ts`(312줄)는 기존 파일에 대한 리팩토링 + 확장(198줄 추가/62줄 삭제).
- 브랜치 안에 이번 리뷰 대상이 아닌 `plan-frontmatter.test.ts`/`spec-links.ts`/`spec-links.test.ts` 변경도 있으나, 이번 payload 의 "리뷰 대상 파일"에는 포함되지 않아 범위 판정에서 제외했다(타겟 재실행 관례에 부합).
- `plan/in-progress/docs-guard-walker-dedup.md` 를 확인했다 — 이 PR 이 실측 중 발견한 추가 확장 여지(spec-links.ts 내부 DFS 중복 통합, `extractLinks` 성능 최적화, `SpecMdFile` 개명, `NONE_VALUES` 대소문자 fixture 등)를 **의도적으로 별도 plan 으로 분리**해 이번 PR에 포함하지 않았다는 근거가 확인된다. 이는 스코프 관리가 잘 되고 있다는 신호다(발견사항 아님, 참고용).

## 점검 결과

### 1. 의도 이상의 변경 / 4. 무관한 수정
3개 파일의 모든 변경은 "plan 라이프사이클 게이트"(Gate C `spec_impact` 강제 + 완료 plan `status` 모순 검출 + 필수 frontmatter 필드 검사)라는 단일 주제로 수렴한다. `hasMalformedStarted`/`danglingSpecImpact`/`makeSpecExists`/`findUnparseablePlans` 모두 "조용한 게이트 우회" 라는 이 PR 의 핵심 결함 클래스를 겨눈 함수이고, 무관한 기능이나 파일을 건드리지 않았다.

### 2. 불필요한 리팩토링
`plan-scan.ts` 는 `spec-plan-completion.test.ts` 에 있던 손수 DFS(`collectCompletePlans`)와 (범위 밖 파일이지만) `plan-frontmatter.test.ts` 의 `collectTopLevelPlans`/`checkPlanFrontmatter`/`WORKTREE_SENTINEL`/`ISO_DATE` 를 한 곳으로 모았다. 후자는 이 PR 이전부터 있던 코드라 "무관한 드라이브바이 리팩토링"으로 보일 수 있으나:
- 헤더 주석(plan-scan.ts:14-21)과 `spec-plan-completion.test.ts:125-127` 주석이 "필터 값이 우연히 같았을 뿐 강제하는 장치가 없었다"는 것을 이 PR 스스로 만든 신규 게이트(status 검사)와 기존 Gate C 사이에서 실측했다고 명시한다.
- 기존 `ISO_DATE` 정규식(`/^\d{4}-\d{2}-\d{2}$/`)이 이 PR 이 고치는 "달력상 실재하지 않는 날짜를 통과시키는" 결함과 동일 클래스였다(구 `plan-frontmatter.test.ts` diff에서 확인) — 새 `isIsoDate` 로 통합하지 않으면 같은 버그가 두 곳에 남는다.
따라서 이 통합은 "이 작업과 무관한 정리"가 아니라 이 PR 이 만들거나 겨냥한 버그 클래스를 닫기 위한 필수 통합으로 판단된다. INFO 수준으로만 기록한다.

### 3. 기능 확장 (over-engineering)
`makeSpecExists`(빈 문자열/디렉터리 오탐 차단), `danglingSpecImpact`(비-문자열 원소 차단) 등은 신규 헬퍼가 늘었지만 전부 실측된 fail-open 결함(§주석에 실측 근거 명시)을 닫는 목적이며, 요구 이상의 기능(예: 새 CLI 옵션, 새 리포트 포맷 등)을 추가하지 않았다.

### 5·6·7. 포맷팅 / 주석 / 임포트
- 포맷팅과 로직 변경이 섞인 곳은 발견되지 않았다(diff 전체가 의미 있는 변경).
- 주석은 분량이 많지만 전부 실측 근거(뮤테이션 테스트 결과, 실 데이터 카운트, 이전 버그 사례)를 담고 있어 이 저장소의 Rationale 관례에 부합한다. 장식적/불필요한 주석은 없었다.
- 3개 파일의 import 를 전수 대조했다 — `spec-plan-completion.test.ts`(`collectCompletePlanMarkdown`/`findUnparseablePlans`/`isIsoDate`/`parseFrontmatterSafe`/`rawScalar`), `plan-scan.test.ts`(8개 named import) 모두 실제로 사용되며 미사용 임포트는 없다.

### 8. 설정 변경
3개 파일 모두 테스트/구현 코드이며 설정 파일 변경은 없다.

## 요약
검토한 3개 파일(`plan-scan.ts` 신규, `plan-scan.test.ts` 신규, `spec-plan-completion.test.ts` 리팩토링)의 변경은 모두 "plan-lifecycle-gates" 작업의 핵심 주제(Gate C 강제 + status 모순 검출 + frontmatter 필수 필드 검사, 그리고 그 판정 로직의 이중화·fail-open 결함 제거)로 수렴하며, 무관한 파일·기능·포맷팅·주석·임포트 변경은 발견되지 않았다. 사전 존재하던 `checkPlanFrontmatter`/`ISO_DATE` 류를 `plan-scan.ts` 로 옮긴 부분은 범위 밖 리팩토링처럼 보일 여지가 있으나, 이 PR 이 고치는 것과 동일한 버그 클래스(느슨한 날짜 검증)를 공유하고 있어 통합이 정당화된다(INFO). 또한 작업 중 발견한 추가 확장 여지를 `plan/in-progress/docs-guard-walker-dedup.md` 로 분리해 이번 PR 범위에서 의도적으로 제외한 점은 스코프 관리가 양호함을 보여준다.

## 위험도
LOW
