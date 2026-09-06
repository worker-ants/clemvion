# 성능(Performance) 리뷰

## 개요

이번 diff(`origin/main...HEAD`)는 `User` 엔티티 컬럼 노출을 잡는 검출용 정적 가드 3종(`user-entity-exposure-guard.ts`, `user-secret-absence.ts`, `dto-jsdoc-citation-guard.ts` + 각 spec/fixture), 그 소비 지점(e2e 3건 추가/확장), `WorkflowVersionsService`/`TriggersService` 의 실제 프로덕션 코드 수정, `.claude/hooks/_lib/review_guard.py` 의 YAML 프런트매터 파서 보정으로 구성된다. 프로덕션 런타임 경로에 실질적인 성능 결함은 발견되지 않았고, 오히려 하나는 성능 개선의 부수 효과가 있다.

## 발견사항

- **[INFO]** `WorkflowVersionsService.findOne` 의 `select` 투영 도입은 보안 수정이면서 동시에 성능 개선
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` `findOne` 메서드(`select: { … creator: CREATOR_PROJECTION }` 블록)
  - 상세: 기존 코드는 `relations: ['creator']` 로 `User` 관계를 로드해 TypeORM 이 `User` 테이블의 **전 컬럼**(비밀 컬럼 포함)을 SELECT 했다. 이번 수정은 `select` 로 `creator: { id, name, email }` 3필드만 명시해, 보안 목적(비밀 컬럼 미노출)과 별개로 Postgres 에서 실제로 전송되는 컬럼 수를 줄인다 — 네트워크 전송량·row 역직렬화 비용이 줄어드는 부수적 성능 이득이다. 별도 조치 불요, 관측만 기록.
  - 제안: 없음 (긍정적 변경).

- **[INFO]** 신규 테스트가 같은 단일 fixture 파일을 3회 독립적으로 재파싱한다 — 비용은 무시할 수준
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation.spec.ts:75`, `:102`, `:114` — 세 곳 모두 `findDtoJsDocCitations([CITATION_FIXTURE], SRC_ROOT)` 를 독립 호출
  - 상세: `findDtoJsDocCitations` 는 호출될 때마다 대상 파일을 `fs.readFileSync` 로 다시 읽고 `ts.createSourceFile` 로 다시 파싱한다(`dto-jsdoc-citation-guard.ts:85-90`). 세 `it()` 블록이 정확히 같은 1개 파일(`jsdoc-citation.fixture.ts`, 61줄)에 대해 이 작업을 반복한다. 대상이 단일 소형 fixture 파일이라 실측 영향은 밀리초 미만으로, 실질적 성능 문제는 아니다. 다만 형제 가드 `user-entity-exposure.spec.ts`(스캔 결과를 `describe` 최상위에서 한 번 계산해 재사용하는 패턴, 프롬프트 §파일 18 확인)와 비교하면 관례상 일관성이 떨어진다.
  - 제안: `beforeAll`/모듈 스코프에서 `findDtoJsDocCitations([CITATION_FIXTURE], SRC_ROOT)` 결과를 한 번 계산해 세 테스트가 공유하도록 리팩터링 — 성능보다는 형제 가드와의 패턴 일관성 목적.

- **[INFO]** 정적 가드 3종(`user-entity-exposure-guard.ts`, `dto-jsdoc-citation-guard.ts`)의 알고리즘 복잡도는 파일당 O(n) 선형 AST 순회이며 문제 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts`(`forEachUserTypedProperty`, `findUserRelationLoads`), `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`(`findDtoJsDocCitations`)
  - 상세: 두 가드 모두 `src/modules` 하위 파일을 한 번씩만 방문하며 파일당 단일 `ts.forEachChild` 재귀 순회로 끝난다. 중첩 루프나 파일 간 교차 비교가 없어 전체는 O(총 소스 라인 수)로 선형이다. 이 코드는 프로덕션 런타임이 아니라 Jest 테스트 스위트에서만 실행되므로 CI 시간에 소폭 영향을 줄 뿐 사용자 요청 경로와 무관하다. 결함 아님 — 확인 차 기록.
  - 제안: 조치 불요.

- **[INFO]** `findUserSecretLeaks`(재귀 깊이 우선 탐색)는 테스트 전용이며 프로덕션 응답 크기 기준으로 안전
  - 위치: `codebase/backend/src/shared/testing/user-secret-absence.ts:45-61`(`walk` 재귀 함수)
  - 상세: 응답 본문(`res.body`) 전체를 재귀적으로 순회하며 각 노드마다 `Object.entries` + `Set.has` 로 금지 키를 검사한다. 입력이 `JSON.parse` 결과라 순환 참조가 불가능하므로 무한루프 위험은 없고, e2e 테스트에서만 호출되므로 프로덕션 핫패스에 영향이 없다. 결함 아님 — 확인 차 기록.
  - 제안: 조치 불요.

- **[INFO]** `.claude/hooks/_lib/review_guard.py` 의 프런트매터 주석 처리 보정은 O(1)/O(n) 수준 추가 연산으로 파서 성능에 영향 없음
  - 위치: `.claude/hooks/_lib/review_guard.py` `_strip_comment`(신설, `_parse_frontmatter_code` 내부) 및 블록 리스트 루프의 빈 줄/주석 skip 분기
  - 상세: 토큰당 정규식 매치 1회(`re.split`) 또는 따옴표 탐색(`str.find`) 1회가 추가됐고, 블록 리스트 순회 시 빈 줄·주석 줄을 건너뛰는 분기가 추가됐다. `_spec_code_patterns` 는 `os.walk` 로 `spec/**/*.md` 를 1회 순회하고 파일당 1회만 파싱하는 기존 구조를 그대로 유지하며, 이 훅은 git 훅/CI 검증 시점에만 실행되고 요청 경로가 아니므로 성능 영향은 무시할 수준이다.
  - 제안: 조치 불요.

## 요약

이번 변경의 실제 프로덕션 런타임 영향은 두 곳(`TriggersService` 의 UNIQUE 위반 세분화, `WorkflowVersionsService.findOne` 의 DB 레벨 컬럼 투영)뿐이며, 둘 다 성능 저하 요인이 없고 오히려 후자는 로드되는 컬럼 수를 줄여 성능이 개선되는 부수 효과가 있다. 나머지 대부분(신규 가드 3종·spec·fixture·e2e 케이스)은 테스트/CI 전용 정적 분석 코드로, 전부 파일당 선형 AST 순회이고 프로덕션 요청 경로와 무관하다. N+1 쿼리, 블로킹 I/O, 불필요한 대규모 메모리 할당, 캐싱 누락 등 성능 관점의 실질적 결함은 발견되지 않았다. 유일하게 언급할 만한 사소한 점은 신규 spec 파일 하나가 단일 소형 fixture 를 3회 재파싱하는 것인데, 실측 비용이 무시할 수준이라 INFO 로 기록했다.

## 위험도

NONE
