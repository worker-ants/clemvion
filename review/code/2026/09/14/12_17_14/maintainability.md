# 유지보수성(Maintainability) 리뷰 — trigger-canary-hardening (라운드 3)

## 검토 범위

실질 코드 변경은 6개 파일이다 — 신규 repo-guard(`trigger-secret-columns-guard.ts`) + 소비
spec(`trigger-secret-columns.spec.ts`), 기존 `trigger-workflow-ref.spec.ts` 의 원문자→아라비아
숫자 표기 통일, 그리고 `chat-channel-trigger-create.e2e-spec.ts`·`schedule-trigger.e2e-spec.ts`·
`trigger-workflow-ref.e2e-spec.ts` 세 e2e 파일의 주석 정정 + 기존 헬퍼 호출 추가다.

이 세션은 이미 두 차례 `/ai-review` 라운드(`review/code/2026/09/14/11_27_40`,
`review/code/2026/09/14/11_52_13`)를 거친 뒤의 상태다. 라운드 1 이 낸 maintainability
WARNING(vacuous 삼항식)과 라운드 2 가 낸 INFO(불필요한 중첩 템플릿 리터럴 `${'…'}`) 모두
**현재 소스(`trigger-secret-columns.spec.ts` 64~67행)에서 실제로 해소돼 있음을 직접 `Read` 로
확인했다** — `if (value === null) throw new Error(\`${rel}: 상수를 못 읽었다 — …\`);` 형태로,
중첩 템플릿 리터럴 없이 단일 템플릿으로 정리됨. 재발 없음.

나머지 파일(`plan/**` 2개, `review/code/2026/09/14/{11_27_40,11_52_13}/**`,
`review/consistency/2026/09/14/**` 다수)은 코드가 아니라 이전 라운드의 리뷰·컨시스턴시
산출물과 작업 트래커다 — 함수 길이·중첩 깊이·순환 복잡도 같은 코드 메트릭이 적용되지 않고,
표·인용·각주 구조가 저장소 기존 관례를 그대로 따르고 있어 별도 지적사항 없음(라운드 1·2 의
동일 판단과 일치).

## 발견사항

- **[INFO]** 신규 가드의 파일-부재 에러 메시지가 **자기 파일명을 문자열 리터럴로 하드코딩**하고 있어, 파일이 리네임되면 그 사실을 알려주려는 메시지 자체가 조용히 낡는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` — `readStringArrayConst` 함수 내 `fs.existsSync` 분기, 게이트 55~58행.
  - 상세: `` `${relPath} 가 없다 — 파일이 옮겨졌거나 이름이 바뀌었다. ` + `trigger-secret-columns-guard.ts 의 경로 상수를 함께 고칠 것.` `` 에서 두 번째 조각의 `trigger-secret-columns-guard.ts` 는 이 파일 자신의 이름을 문자열로 박아 놓은 것이다. 이 저장소의 다른 26개 repo-guard 를 `grep` 으로 전수 확인한 결과 이런 자기-파일명 하드코딩 패턴은 이 한 곳뿐이다. 만약 이 가드 파일 자체가 나중에 리네임되면(다른 가드들처럼 `<주제>-guard.ts` 명명 관례를 따르는 한 있을 법한 일이다), 이 에러 메시지 안의 파일명은 자동으로 갱신되지 않고 잘못된 안내를 하게 된다 — "가드가 깨졌다 vs 대상이 리네임됐다를 구분하려는" 이 가드 고유의 설계 의도(JSDoc 52~53행)와 정확히 같은 종류의 문제를 메시지 자신이 안고 있다는 점이 아이러니하다. 다만 심각도는 낮다 — 이 파일이 리네임될 때 이 문자열을 함께 고치는 것을 놓칠 확률은 낮고(같은 파일 안에 있어 눈에 띈다), 잘못되더라도 안내 문구의 정확도만 떨어질 뿐 가드의 검출 능력 자체는 영향받지 않는다.
  - 제안: `__filename`(또는 `path.basename(__filename)`)을 사용해 파일명을 런타임에 얻거나, 최소한 리네임 시 이 문자열도 함께 고쳐야 함을 파일 헤더 주석에 한 줄 추가.

- **[INFO]** `unwrap`(as/satisfies/괄호 언랩) 로직이 형제 가드들의 유사 로직과 완전히 겹치지는 않지만, 세 곳에서 각기 다른 범위로 재구현되어 있다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts:68-79`(as/satisfies/괄호 3종 언랩) vs `engine-error-code-anchor-guard.ts:90-92`·`184-188`(as 만 언랩하는 삼항식 두 곳) — 소스 직접 대조로 확인.
  - 상세: 세 자리 모두 "TypeScript 래퍼 표현식을 벗기고 내부 리터럴에 도달한다"는 같은 목적을 갖지만, 벗기는 래퍼의 종류(이 파일은 `AsExpression`+`SatisfiesExpression`+`ParenthesizedExpression` 루프, 다른 가드는 `AsExpression` 하나만 삼항식으로)와 구현 형태(루프 vs 삼항식)가 서로 다르다. 완전 동일 코드의 복붙은 아니라서 "중복 코드"로 단정하기는 약하지만, 저장소에 이미 3벌의 "AST 래퍼 언랩" 소형 유틸이 독립적으로 존재하게 된 상태이고, 이 파일의 JSDoc 이 스스로 강조하는 교훈("`AsExpression` 하나만 벗기는 리더는 정본에서 `null` 을 낸다")이 향후 다른 가드에도 똑같이 재발할 수 있는 함정이다. 다만 이 저장소의 repo-guard 관례가 "각 가드는 독립적 순수 로직"(파일 헤더에 명시)이라 의도적으로 결합을 피하는 설계이므로, 공유 유틸로 추출하는 것이 오히려 이 관례와 충돌할 수 있어 강하게 권고하지는 않는다.
  - 제안: 조치 불요(현 상태 유지 가능). 다음에 네 번째 AST 언랩 유틸이 생기면 그때 `common/__test-utils__/` 로 추출을 재고.

- **[INFO]** `expectTriggerWorkflowRef(row/patch.body.data, { present: true, expectedWorkflowId: workflowId })` 동일 인자 형태 호출이 3곳(C-2 목록, PATCH cron 케이스, PATCH 재활성 케이스) 반복된다 — 라운드 1·2 에서 이미 검토되고 "결함 아님"으로 처분된 사항의 재확인.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` — 게이트 277~280, 392~395, 429~432.
  - 상세: 같은 파일에서 `assertMatchesContract(...)` 도 각 `it()` 마다 반복되는 기존 관례이고, 세 호출은 서로 다른 독립 시나리오(목록 조회·cron 수정·재활성)의 회귀 방어라 공용 헬퍼로 묶으면 오히려 각 케이스가 "무엇을 확인하는지"를 그 자리에서 읽기 어려워질 수 있다. 이번 라운드에서 코드가 달라지지 않았으므로 이전 판단을 유지한다. 조치 불요.

## 확인한 사항 (문제 없음)

- 라운드 1 WARNING(vacuous 삼항식)·라운드 2 INFO(중첩 템플릿 리터럴) 모두 현재 소스에서 실제로 해소돼 있음을 직접 대조 확인 — 재발이나 반쪽 수정 없음.
- `readStringArrayConst`(약 60줄, `unwrap`/`visit` 두 지역 함수 포함)는 AST 순회라는 단일 책임 안에서 응집돼 있고, 중첩 깊이도 (if → if → for → if) 4단 수준으로 이 저장소의 다른 AST 기반 repo-guard(`redis-fail-open-catalog-guard.ts`, `engine-error-code-anchor-guard.ts`)와 동등한 수준이라 과도하지 않다.
- 네이밍: `CANONICAL_SOURCE`/`CANONICAL_CONST`/`MIRROR_SOURCES`/`MIRROR_CONST` 가 의미를 정확히 드러내고, 형제 가드의 `UNION_SOURCE`/`UNION_TYPE_NAME` 명명 패턴과 일관된다.
- 매직 넘버: 신규 코드에 의미 불명 상수·숫자 없음 — 경로·상수명 모두 export 된 명명 상수로 관리된다.
- `trigger-workflow-ref.spec.ts` 의 원문자(①~⑪) → 아라비아 숫자 통일은 `grep '가드 [0-9]'` 로 헤더 목록·케이스 헤딩·구획주석이 실제로 같은 번호 체계를 쓰게 된 것을 직접 재현 확인(총 13줄 = 헤딩 3 + 구획주석 7 + 산문 3) — 목적(grep 가능성)에 부합하는 실질 개선이고 나머지 테스트 로직은 무편집.
- `trigger-secret-columns.spec.ts` 신규 spec 10개 케이스: `[대조군]` 그룹핑, `describe` 중첩 1단, 각 `it()` 이 단일 관심사(주석 무시/satisfies 언랩/래퍼 없음/선언 없음/빈 배열/부재 파일/비-문자열 원소)로 분리돼 있어 가독성이 높다.
- e2e 3파일의 추가는 기존 export 헬퍼(`expectTriggerWorkflowRef`)를 그대로 재사용하는 소규모 삽입이며 새 복잡도를 만들지 않는다.

## 요약

라운드 1·2 에서 지적된 maintainability 항목(vacuous 삼항식 WARNING, 중첩 템플릿 리터럴 INFO)은 모두 현재 코드에서 실제로 해소돼 있고 재발이 없다. 이번 라운드에서 새로 발견한 항목은 둘 다 INFO 수준이다 — 신규 가드의 파일-부재 에러 메시지가 자기 파일명을 하드코딩해 리네임 시 조용히 낡을 수 있는 점, 그리고 AST 래퍼-언랩 소형 로직이 저장소 안에 3벌 독립적으로 존재하게 된 점(다만 저장소의 "가드별 독립 순수 로직" 관례상 결합을 강제할 근거는 약함). 둘 다 차단 사유가 아니다. 핵심 신규 코드는 함수 길이·중첩 깊이·네이밍·JSDoc 스타일 모두 형제 repo-guard 와 동등한 수준으로 정렬돼 있고, e2e·self-spec 변경은 기존 헬퍼·관례를 그대로 재사용하는 저위험 추가다.

## 위험도

LOW
