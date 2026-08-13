# 요구사항(Requirement) 리뷰 — `update-returning-tuple-shape` 누적 diff (`23_07_11`)

## 검토 방법

핵심 코드 파일 9개(`update-returning-rows.ts`/`.spec.ts`, `auth-oauth.service.ts`/`.spec.ts`,
`execution-engine.service.ts`/`.spec.ts`, `knowledge-base.service.ts`/`.spec.ts`,
`assert-row-array.spec.ts`)를 diff 뿐 아니라 **현재 워킹트리 소스를 직접 `Read`/`Bash`로 열어**
독립 재검증했다 (prior 라운드 `20_36_35`/`22_45_24` RESOLUTION 이 이미 검토했으나, 그 문서들의
주장을 그대로 믿지 않고 다시 셌다 — 이 세션 자체가 "검증 없이 완료 선언" 을 반복해 걸린 전례가
있어서다). 구체적으로:

- `updateReturningRows()` 튜플 판별 로직을 코드로 직접 추적 (`Array.isArray(result[0])`)
- `assert-row-array.spec.ts`/`update-returning-rows.spec.ts` 의 구조적 가드 수치를 Python 으로
  독립 재계산 → 소스 실측과 **전부 일치** (`execution-engine`: queries=3/guards=1,
  `updateReturningRows(` 호출 execution-engine=2·knowledge-base=5·auth-oauth=1, 소비 지점 총수
  execution-engine=3·knowledge-base=10·auth-oauth=0)
- 관련 jest 스위트 5개 직접 실행 → `update-returning-rows.spec.ts`+`assert-row-array.spec.ts`+
  `auth-oauth.service.spec.ts` 35 passed, `execution-engine.service.spec.ts`+
  `knowledge-base.service.spec.ts` 502 passed. `eslint --max-warnings 0` 5개 변경 소스 파일 clean.
- spec 본문 4곳(`spec/5-system/4-execution-engine.md` §8, `spec/data-flow/2-auth.md` §OAuth
  callback, `spec/5-system/8-embedding-pipeline.md` §7.3, `spec/5-system/10-graph-rag.md` 동시
  호출 표)을 line-level 로 대조.

## 발견사항

- **[WARNING]** `knowledge-base.service.ts` 의 `retryFailedDocuments` embedding 분기가 여전히
  실제 shape(튜플)과 반대인 거짓 제네릭 `.query<{ id: string }[]>()` 를 달고 있다 — **동일
  이슈가 이미 두 차례(`20_36_35` documentation WARNING 2, `22_45_24` documentation WARNING)
  지적됐는데도 이번 diff 의 최종 상태에서도 미수정으로 남아 있음**을 소스를 직접 열어 확인했다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` — 함수
    `retryFailedDocuments`, `scope === 'embedding'` 분기(`const rows = await
    this.dataSource.query<{ id: string }[]>(...)`). (diff 밖 — 이번 프롬프트 diff 는 이 줄을
    포함하지 않아 게이트 번호가 없다. `Read` 로 현재 소스 offset 533 에서 직접 확인.)
  - 상세: 33줄 아래 짝인 `graph` 분기(`scope === 'graph'`)는 `const rows: unknown = await
    this.dataSource.query(...)` 로 이미 정정됐는데, `embedding` 분기만 여전히 "행 배열"이라고
    주장하는 제네릭을 달고 있다 — 바로 두 줄 뒤 `updateReturningRows<{ id: string }>(rows, ...)`
    가 그 값을 튜플로 언랩하는 것과 모순된다. 런타임 동작 자체는 `updateReturningRows` 가 두
    shape 을 모두 안전하게 처리하므로 기능 버그는 아니다(잘못된 값이 큐잉되지 않는다). 다만
    이 diff/PR 이 존재하는 근본 이유가 정확히 "타입 선언이 실제 shape 과 다른데 아무도
    검증하지 않았다" 는 것이고, `20_36_35/RESOLUTION.md` 는 "7곳을 `unknown` 으로 바꿨다"고
    완료를 선언했지만 실측은 6곳이다 — 세 번째로 같은 미검증 완료 선언이 반복된 셈이다.
  - 제안: `knowledge-base.service.ts` 의 해당 줄을 `: unknown` 애너테이션으로 통일해 나머지
    지점들과 맞춘다. RESOLUTION 류 문서에 "N곳 수정" 을 적을 때는 이번 라운드에서 반복 지적된
    패턴("검증 없이 개수를 쓴다")을 피하기 위해 grep 으로 재확인 후 기재할 것.

- **[INFO]** (긍정 확인) 이 diff 가 수정하는 4개 동작 모두 **spec 본문과 line-level 로 일치**하고,
  spec 자체는 처음부터 옳았다 — 버그는 순수 구현(드라이버 shape 오독) 문제였다.
  - 위치/대조:
    - `codebase/backend/src/modules/auth/auth-oauth.service.ts:150-160`(`OAUTH_STATE_MISMATCH`,
      400) ↔ `spec/data-flow/2-auth.md:128`("row 없으면(미존재·만료·이미 소비) 400
      OAUTH_STATE_MISMATCH. row.provider ≠ :provider 도 거부") — 정확히 일치.
    - `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:731-734`
      (`KB_REEMBED_IN_PROGRESS`, 409) ↔ `spec/5-system/8-embedding-pipeline.md:264`("결과가
      0행이면 409 KB_REEMBED_IN_PROGRESS") — 일치.
    - `knowledge-base.service.ts:349-352`(`KB_REEXTRACT_IN_PROGRESS`, 409) ↔
      `spec/5-system/10-graph-rag.md:565`("409 KB_REEXTRACT_IN_PROGRESS") — 일치.
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2913-2952`
      (advisory-lock + 조건부 UPDATE admission gate) ↔ `spec/5-system/4-execution-engine.md:1138`
      ("admission gate 원자성(TOCTOU)" 절, per-workspace `pg_advisory_xact_lock` + 조건부
      UPDATE) — 구조·원자성 보장 서술과 일치.
  - 상세: `plan/in-progress/update-returning-tuple-shape.md` 가 `spec_impact: none` 으로 둔
    판단도 확인됨 — 이 PR 은 spec 이 이미 정확히 서술한 동작을 실제로 구현에 반영하는
    correctness fix 이지 spec 변경이 아니다. spec drift 없음.
  - 제안: 없음(확인 완료).

- **[INFO]** (긍정 확인) TODO/FIXME/HACK/XXX 신규 미완성 마커 없음. `git diff` 대상 5개 소스
  파일 전수 grep 결과 0건.

- **[INFO]** (긍정 확인) `updateReturningRows()` 의 엣지 케이스 처리가 정확하고 테스트로 고정돼
  있다: 0행 튜플(`[[], 0]` → `[]`, CAS 락/admission 이 실제로 거절하는 판별자), 직접 행 배열
  0건(`[]` → `[]`), 비배열 입력 3종(`undefined`/`null`/객체 → `detail` 포함 메시지로 throw).
  `codebase/backend/src/common/utils/update-returning-rows.spec.ts` 가 4가지 분기 전부를
  `it`/`it.each` 로 커버하며, 직접 실행 결과 전부 GREEN.

- **[INFO]** (기록 목적, 조치 불요) 아래 항목들은 이전 두 라운드(`20_36_35`/`22_45_24`)가 이미
  발견·평가해 INFO/낮은 우선순위로 넘긴 것이며, 이번 재검증에서도 같은 평가에 동의해 재상향하지
  않는다: (1) `updateReturningRows` 의 선택적 `detail` 인자가 8개 호출부 중 5곳
  (`knowledge-base.service.ts`)에서 생략됨 — 기능 영향 없음, 로그 진단 컨텍스트만 감소.
  (2) `knowledge-base.service.ts` 5개 소비 지점 중 실측 튜플 shape 전용 단위 테스트가 있는 곳은
  `reExtractAll`/`reEmbedAll` CAS 락 2곳뿐 — 나머지 3곳(embedding/graph 재큐, reset)은 헬퍼
  자체의 exhaustive 단위 테스트 + 구조적 grep 가드에만 의존. 런타임 동작은 직접 소스 대조로
  정확함을 재확인했다. (3) CHANGELOG Unreleased 미기재는 plan 후속 체크리스트에 명시적으로
  추적 중.

## 요약

핵심 fix(`updateReturningRows()` 헬퍼 도입 + 8개 소비 지점 교체)는 의도한 기능을 완전히
구현한다 — TypeORM 0.3.31+pg 가 `UPDATE`/`DELETE ... RETURNING` 에만 `[rows, rowCount]` 튜플을
돌려주는 실제 드라이버 동작을 정확히 처리하고, 그 결과 admission 게이트(execution-engine)·
CAS 락(KB 재추출/재임베딩)·OAuth state 소비(소셜 로그인)가 처음으로 spec 이 항상 서술해 온
그대로 동작하게 된다. 구조적 회귀 가드(정규식 기반 소비-지점 개수 대조)를 Python 으로 독립
재계산해 소스 실측과 전수 일치를 확인했고, 관련 jest 스위트 537개 테스트가 모두 통과하며 lint
도 clean 하다. spec 4곳(admission gate·OAuth state·KB CAS 락 2건)과 line-level 로 대조한 결과
모두 일치 — spec 은 원래부터 옳았고 버그는 순수 구현 문제였으므로 spec drift 도 없다. 유일한
잔여 문제는 `knowledge-base.service.ts` 의 `retryFailedDocuments` embedding 분기 제네릭
타입이 두 차례 지적에도 이번 최종 상태까지 미수정으로 남아 있다는 점(WARNING, 런타임 버그
아님) — 이 PR 의 존재 이유("타입 선언과 실제 shape 불일치를 검증하지 않았다")와 정확히 같은
패턴이 같은 diff 안에 흔적으로 남아 있다는 점에서 사소하지 않은 문서적 일관성 결함이다.

## 위험도

LOW
