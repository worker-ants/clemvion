# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `plan-scan.ts` 헤더 주석의 "네 벌"/"남은 둘" 서술이 자체 모순
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:13-23` (`## 스캔 소스가 하나여야 하는 이유` 절)
  - 상세: 13번째 줄은 "`plan/` 트리를 손으로 순회하는 walker 가 저장소에 네 벌 있었고" 라고 하여 **"네 벌" 의 정의를 "plan/ 트리를 순회하는 walker" 로 한정**한다. 16번째 줄은 "**plan 계열 네 벌은 이 구현 하나로 모였다**" 라고 그 넷 전부가 이 파일로 수렴했다고 말한다. 그런데 바로 다음 21-22번째 줄은 "**남은 walker 둘은 `spec-links.ts` 안에 있다**(`collectSpecMarkdown`·`collectCodebaseSources`) — **plan 트리가 아니라 spec/codebase 를 보므로** 이 파일의 범위 밖" 이라고 적는다. `collectSpecMarkdown`/`collectCodebaseSources` 는 정의상 `spec/`·`codebase/` 를 순회하지 `plan/` 트리를 순회하지 않는다(직접 `spec-links.ts:132`,`:319` 확인 — `path.join(root, "spec")` 기준 DFS). 즉 13번째 줄이 정의한 "네 벌 = plan/ 트리 walker" 집합에 애초에 속할 수 없는 두 함수를 "남은(remaining) 둘" 이라며 마치 그 넷 중 일부인 것처럼 이어 붙였다 — 16번째 줄의 "네 벌 전부가 여기로 모였다" 는 주장과 21번째 줄의 "둘은 여전히 밖에 있다" 는 주장이 산술적으로도 부딪힌다.
    같은 주제를 추적하는 `plan/in-progress/docs-guard-walker-dedup.md` 는 이미 이 혼동을 한 차례 정정한 이력이 있다("이 문단은 처음에 '네 벌 → 한 벌' 이라고 썼는데 `plan-scan.ts` 헤더 주석은 '그중 둘' 이라고 정확히 적고 있었다 — 코드가 맞고 이 요약이 틀렸다", 35-37행) — 그리고 그 문서의 walker 표는 `walkPlanMarkdown`(plan 트리) 대 `collectSpecMarkdown`/`collectCodebaseSources`(각각 spec/codebase 트리)를 명확히 구분해 등재한다. 이번 커밋(`22b437873`)이 W1 지적("통합했는데 주석은 독립 구현이라 그대로")을 고치는 과정에서 그 구분을 다시 흐려 놓았다 — 정확히 이 헤더 주석이 막으려던 "스코프 혼동" 결함 클래스의 재발이다.
  - 제안: "네 벌" 의 정의를 명확히 하거나(예: "저장소에 markdown 트리를 손으로 순회하는 walker 가 네 벌 있었는데 그중 셋은 서로 다른 `0-`/`_` 접두·재귀 규칙으로 `plan/` 을 봤고 하나(또는 둘)는 `spec/`·`codebase/` 를 봤다"), 혹은 "네 벌"을 "plan 트리 세 벌(그중 둘은 walkPlanMarkdown, 하나는 Gate C)" 로 좁혀 21행의 spec-links.ts 두 함수를 별도 문장("자매 문제로 `spec-links.ts` 에도 유사 중복이 있다")으로 분리한다. `docs-guard-walker-dedup.md` 의 walker 표(3벌 + Gate C 4번째)와 숫자가 일치하도록 맞출 것.

- **[INFO]** 신설 `danglingSpecImpact` 만 완전한 JSDoc, 인접 export 둘은 개별 문서 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:38`(`isGateCEnforced`), `:43`(`hasValidSpecImpact`)
  - 상세: 이번 라운드에서 새로 추출된 `danglingSpecImpact` (71-75행)는 "왜 뺐는가"까지 포함한 상세 JSDoc을 갖는 반면, 같은 파일에서 export 되는 `isGateCEnforced`/`hasValidSpecImpact` 는 위쪽 2줄짜리 공용 주석("Pure enforcement predicates — unit-tested below…") 만 공유하고 함수별 파라미터 설명(특히 `hasValidSpecImpact` 의 `specExists` 콜백 계약)은 없다. 기능상 문제는 아니나 같은 파일 안에서 문서화 밀도가 고르지 않다.
  - 제안: 세 함수 모두 export 되는 순수 판정 함수이므로, `hasValidSpecImpact` 에도 반환값 의미(문자열 none 계열/비어있지 않은 스펙 경로 배열)를 한 줄이라도 명시하면 일관성이 높아진다. 필수는 아님.

- **[INFO]** `ParsedFrontmatter` 인터페이스의 `data` 필드 미문서화
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:98-102`
  - 상세: `block` 필드에는 "frontmatter 원문 블록 — 파싱이 값을 바꾸는 필드(날짜)는 이쪽을 봐야 한다" 는 중요한 사용 지침이 JSDoc으로 달려 있는데, 같은 인터페이스의 `data` 필드는 설명이 없다. `data` 자체는 이름으로 유추 가능하지만, `block` 과의 차이(파싱됨 vs 원문)를 아는 사람만 왜 두 필드가 공존하는지 이해할 수 있어 대칭적으로 한 줄을 추가하면 더 명확해진다.
  - 제안: `data: Record<string, unknown>; // gray-matter 파싱 결과 — 날짜 등은 롤오버될 수 있다(원문 필요 시 block 참조)` 정도로 보강.

## 요약

이번 변경분(주로 `spec-plan-completion.test.ts` 의 `danglingSpecImpact` 추출과 그 합성 fixture, `plan-scan.ts` 헤더 주석 갱신)은 직전 `/ai-review` 라운드(04_22_01)의 WARNING 5건을 성실히 반영했고, 새 로직(`danglingSpecImpact`)에는 "왜 이렇게 짰는가"·"왜 순수 함수로 뺐는가"·"뮤테이션 실측 결과"까지 담은 모범적인 JSDoc이 붙어 있다. `plan-lifecycle.md`/`spec-impl-evidence.md` 등 SoT 문서도 Gate C·`spec_impact`·terminal status 어휘·`0-`/`_` 인덱스 면제·PR 번호(`#1108`·`#1117`·`#576`) 인용까지 코드와 정확히 동기화돼 있어 대체로 문서화 품질이 높다. 다만 이번 커밋이 W1("통합됐는데 주석은 독립 구현이라 적힘")을 고치며 다시 쓴 `plan-scan.ts` 헤더의 "네 벌 → 이 구현 하나로 모임" / "남은 둘은 spec/codebase 라 plan 트리 아님" 서술이 자체 모순이라, 이 파일이 원래 방지하려던 "조용한 스코프 혼동" 결함 클래스를 주석 차원에서 재현하고 있다. 그 외에는 CRITICAL 급 문서 결함이나 README/API/설정 문서 갱신 누락은 없다.

## 위험도

LOW
