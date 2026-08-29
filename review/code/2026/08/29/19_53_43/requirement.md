# 요구사항(Requirement) 리뷰

## 검증 방법

- 저장소 뮤테이션 없이 read-only 로 검증 (`git status --short` 시작/종료 모두 확인, 리뷰 세션
  산출물 디렉터리 외 변경 없음).
- 대상 spec/test 를 직접 실행: `npx jest src/repo-guards/__tests__/redis-fail-open-catalog.spec.ts
  src/common/filters/http-exception.filter.spec.ts` → **29/29 PASS**.
- `secret-resolver.service.ts` 의 "형제 4곳" 주장을 `git grep -n "C1 —"` 로 재실측 — 정확히 4개
  파일(`expression-resolver.service.ts`/`.spec.ts`, `code.handler.ts`/`.spec.ts`)에서만
  `C1 — … C2 — …` 형식이 나타남을 확인.
- `redis-fail-open-catalog-guard.ts` 의 정규식(`` /`component`\s*\(([^)]*)\)/ ``)을 실제 spec 행
  문자열(`spec/5-system/_product-overview.md:88`)로 노드에서 직접 실행 — `idempotency` 만
  뽑히고 `reason (...)` 그룹과 섞이지 않음을 확인.
- `business-metrics.service.ts` 의 `RedisFailOpenComponent` 유니온(`'idempotency'` 단일값)과
  `idempotency.interceptor.ts` 의 4개 호출부(`METRICS_COMPONENT` 상수 경유)를 직접 열어 가드가
  읽는 대상과 spec 카탈로그 행 3자를 대조 — 일치.
- `packages/expression-engine/src/__tests__/error-shape.spec.ts` 를 열어 "이 파일이 정본" 문단이
  실제로 존재하는지 확인 — 존재, `expression-resolver.service.spec.ts`/`code.handler.spec.ts` 의
  위임 주석과 대응.
- `http-exception.filter.spec.ts` 전체 신설 블록(226~377행 부근)을 읽어 이전 라운드
  WARNING#1(fix commit `4dbc6ee39`)이 실제로 `it.each` 4개 분기 전부에
  `expect(JSON.stringify(bodyOf(json))).not.toContain(CAUSE_MARKER)` 를 적용했는지 확인 — 적용됨,
  코드 자체가 라인 주석으로도 "4개 분기 전부에 값 누출 부재 단언을 함께 건다" 고 명시.
- `plan/complete/deps-peer-gating-and-eslint10.md` 를 열어 scope 리뷰어가 지적한
  `worktree:` 필드 ↔ 17행 산문 불일치(INFO#4)가 실제로 정정됐는지 확인 — 정정 문단이
  추가돼 있고 frontmatter `status: complete` 로 `plan/complete/` 규약 준수.

## 발견사항

- **[INFO]** 이번 라운드(`review/code/2026/08/29/19_53_43`)의 리뷰 대상 diff 대부분이 신규
  프로덕션 코드가 아니라 **직전 코드 리뷰 라운드(`19_17_28`)의 산출물 자체**(RESOLUTION.md,
  SUMMARY.md, 각 서브에이전트 리포트, `_retry_state.json` 등)와 그 라운드가 낳은 fix commit
  (`4dbc6ee39`), 그리고 그 뒤의 consistency-check 산출물이다. "요구사항 충족" 관점에서 실제로
  검토할 실질 표면은 (1) `http-exception.filter.spec.ts` 의 `cause` 비노출 `it.each` 값-누출
  단언 보강, (2) `secret-resolver.service.ts` 주석의 "형제 3곳→4곳" 수치 정정, (3) 3개 spec
  파일의 정본 위임 주석 정리, (4) 신규 `redis-fail-open-catalog-guard.ts`/`.spec.ts` 3자 정합
  가드(이는 그 앞 커밋 `48cef83af` 에서 이미 신설된 것으로, 이번 diff 범위엔 원본이 없고
  전체 파일 컨텍스트로만 언급됨), (5) plan 문서 갱신 — 이 다섯으로 좁혀진다.
  - 위치: 없음(스코프 서술) — `git log --oneline -5` 로 확인
  - 상세: 문제라기보다 리뷰 스코프에 대한 관측이다. 리포트 산출물(md/json) 자체에는 검증할
    "기능"이 없으므로 요구사항 충족 여부는 위 다섯 항목의 실질 코드/spec 정합으로만 판단했다.
  - 제안: 해당 없음(정보성).

- **[INFO]** WARNING#1(전 라운드) 및 INFO#4(전 라운드 scope) 재검증 — 둘 다 실측상 완전히
  해소됨.
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts` (신설
    `describe('` `cause` 비노출 불변식 (계측 지점)` `)` 안 `it.each` 블록), `plan/complete/deps-peer-gating-and-eslint10.md:22-27`
  - 상세: `it.each` 4개 분기(매핑 안 된 Error·http-error 4xx·HttpException·QueryFailedError)
    전부가 이제 `not.toContain(CAUSE_MARKER)` 를 공유 바디에서 실행하며, 직접 실행해 29/29
    PASS 를 확인했다. `deps-peer-gating-and-eslint10.md` 도 frontmatter `worktree:` 재변경과
    산문이 같은 커밋에서 함께 갱신됐다.
  - 제안: 없음 — 확인 완료.

## 교차검증 결과 (spec fidelity, 문제 없음)

- `RedisFailOpenComponent = 'idempotency'`(단일값) ↔ `spec/5-system/_product-overview.md:88`
  카탈로그 행 `` `component` (idempotency) `` ↔ 실제 호출부(`idempotency.interceptor.ts` 4곳,
  `METRICS_COMPONENT` 상수 경유) — 3자 정확히 일치, 가드의 정규식·AST 파서 로직도 실측상
  올바르게 동작.
- `spec/5-system/3-error-handling.md` §6.3.1 C1 AND C2 기준 ↔ `secret-resolver.service.ts` 의
  "C1 이 거짓이라 C2 판정 불요" 서술 — spec 취지와 일치(비부착 사례의 형식이 형제 4곳과
  다른 이유가 정확히 설명됨). "형제 4곳" 수치는 `git grep` 실측과 정확히 일치(정정 전
  "3곳"은 오기였고, 이번 diff 로 4곳으로 바로잡힘 — spec 자체의 문제가 아니라 코드 주석의
  자기 정정).
- `error-shape.spec.ts` 를 "enumerable own key" 근거의 정본으로 지정하고 backend 쪽 3개
  spec(`expression-resolver.service.spec.ts`, `code.handler.spec.ts`)이 그쪽을 가리키도록
  바꾼 것 — 실제로 그 문단이 `error-shape.spec.ts` 에 존재함을 확인. 중복 서술을 한 곳으로
  모아 drift 를 줄이는 방향이며 spec 본문과 상충하지 않음(이 근거 자체는 spec 문서가 아니라
  코드 내부 규약이라 spec fidelity 판정 대상은 아님).
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 신설된
  "`15-external-interaction.md §4` Redis 각주" 항목 — `spec/data-flow/15-external-interaction.md`
  §4 각주("EIA 계열 키는 그 표에 아직 미등재")와 `conventions/redis-keys.md` §3 실제 등재
  상태 사이의 불일치를 정확히 짚었고, PR 범위 밖(pre-existing)·CRITICAL/WARNING 아님을
  올바르게 명시하며 `spec/` 직접 수정 없이 planner 턴으로 위임했다 — 이 저장소의 권한 분리
  규약(`developer` 는 spec read-only)을 정확히 따른 처분이다.

TODO/FIXME/HACK/XXX 주석 없음. 신규/변경 함수(가드 파서 3종, 필터 spec)가 모든 경로에서
명시적 throw 또는 정상 반환을 가진다 — 특히 `readCatalogComponents`/`readUnionMembers` 가
빈 배열로 조용히 통과하는 대신 throw 하도록 설계된 부분은 직접 코드를 읽고 실측(node 상의
정규식 재현)으로 의도대로 동작함을 확인했다.

## 요약

이번 diff 는 신규 런타임 동작을 추가하지 않고, 전 라운드 코드 리뷰(`19_17_28`)가 지적한
WARNING/INFO 를 해소한 fix 커밋과 그 산출물(RESOLUTION.md 등 리포트), 뒤이은 consistency-check
산출물, plan 문서 갱신으로 구성된다. 실질 코드 표면인 `cause` 비노출 `it.each` 값-누출 단언
보강(4개 분기 전부 적용, 29/29 PASS 로 재검증), `secret-resolver.service.ts` "형제 4곳" 수치
정정(grep 재실측 일치), `redis-fail-open-catalog-guard.ts`/`.spec.ts` 3자 정합 가드(spec 카탈로그·
유니온·실배선 전부 정확히 일치)를 모두 독립적으로 재검증했고 전부 spec/코드 line-level 정합을
확인했다. plan 문서의 worktree 필드 불일치(전 라운드 scope INFO#4)도 실제로 정정됨을 확인했다.
CRITICAL 은 없으며, 유일하게 남은 것은 §4 Redis 각주 모호성(pre-existing, PR 범위 밖)을 올바른
절차로 다음 트래커에 위임한 INFO 성격의 처분뿐이다.

## 위험도
NONE
