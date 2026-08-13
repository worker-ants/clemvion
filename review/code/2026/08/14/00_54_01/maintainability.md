# 유지보수성(Maintainability) 리뷰 결과

이 PR 은 이미 4 라운드(`20_36_35`→`22_45_24`→`23_07_11`→`23_46_00`)의 ai-review 를 거쳐 CRITICAL·WARNING
전량을 조치했고, 그 조치 과정 자체가 diff 에 포함돼 있다(`updateReturningRows` 헬퍼 신설, 8개 소비 지점
통일, `detail` 필수화, `it.each` placeholder 네이밍 정정, `EXPECTED` 주석-타입 불일치 정정, embedding 재큐
분기의 stale 제네릭 제거 등). 실제 소스(`update-returning-rows.ts`/`.spec.ts`,
`execution-engine.service.ts`, `knowledge-base.service.ts`, `auth-oauth.service.ts`, 각 `.spec.ts`,
`auth-oauth-callback.e2e-spec.ts`)를 직접 열어 확인한 결과 이전 라운드에서 지적된 항목들은 모두 반영돼
있음을 확인했다.

## 발견사항

- **[INFO]** 같은 헬퍼(`updateReturningRows`)의 언랩 결과를 담는 지역 변수 이름이 파일 안에서 통일돼 있지 않다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:544`(`const rowsOut = updateReturningRows<{ id: string }>(rows, ...)`, embedding 재큐 분기), `:578`(`const rowsOut = ...`, graph 재큐 분기) vs `:751`(`const resetRows = updateReturningRows<{ id: string }>(reset, ...)`, reEmbedAll 의 reset 분기)
  - 상세: 세 지점 모두 "UPDATE...RETURNING 원시 결과(`rows`/`reset`)를 헬퍼로 언랩해 그 결과를 `.length`/`.map((r) => r.id)` 로 소비한다"는 동일한 역할인데, 두 곳은 `rowsOut`(용도를 드러내지 않는 범용 이름), 한 곳은 `resetRows`(분기 의미를 담은 이름)로 갈려 있다. 기능에는 영향이 없으나, 같은 PR 안에서 같은 패턴에 서로 다른 네이밍 컨벤션을 쓰면 다음에 이 헬퍼를 쓰는 사람이 어느 쪽을 따라야 할지 판단 기준이 없어진다.
  - 제안: `embeddingRows`/`graphRows`/`resetRows` 처럼 분기 의미를 담아 통일하거나, 셋 다 범용 `rowsOut` 으로 맞춘다. 우선순위는 낮음(INFO) — 이번 PR 핵심 로직(튜플 shape 언랩)의 정확성에는 영향 없음.

이전 라운드에서 지적됐던 항목들의 현재 상태(재확인, 신규 발견 아님):

- `assert-row-array.spec.ts`/`update-returning-rows.spec.ts` 의 `SRC`/정규식 카운팅 보일러플레이트 중복(`22_45_24`/`23_07_11` INFO) — 여전히 존재하지만 두 라운드 연속 "급하지 않음"으로 명시적으로 유예된 항목이라 재상정하지 않음.
- `it.each` placeholder 이름 불일치(`_l, v` vs `_label, value`, `22_45_24`/`23_07_11` INFO) — `update-returning-rows.spec.ts` 주석에 "placeholder 이름도 자매와 맞췄다"고 명시돼 있고 실제로 `(_label, value) =>` 로 통일됨을 확인. **해소됨.**
- `EXPECTED` 주석이 3-tuple 을 예고하는데 타입은 2-tuple(`22_45_24` INFO) — 주석이 "2-tuple 이다. 종전 주석은 3항목을 예고했는데 타입은 2항목이었다"로 정정돼 있음을 확인. **해소됨.**
- `retryFailedDocuments` embedding 분기의 stale `query<{ id: string }[]>` 제네릭이 옆 graph 분기(`unknown`)와 어긋남(`23_07_11` WARNING) — 현재 `knowledge-base.service.ts:533` 도 `const rows: unknown = ...` 로 통일돼 있음을 확인. **해소됨.**
- KB 5개 호출부의 `detail` 인자 누락(`22_45_24` WARNING) — 현재 5곳 전부(`KB re-extract CAS 락`, `KB embedding 재큐`, `KB graph 재큐`, `KB re-embed CAS 락`, `KB re-embed reset`) `detail` 문자열을 전달함을 확인. **해소됨.**

## 요약

`updateReturningRows` 헬퍼는 JSDoc 이 실측 근거·설계 의도·과거 관용구 3종과의 관계를 명시적으로 문서화하고 있고, 단일 책임(튜플/행-배열 언랩)만 수행하는 짧은 함수라 가독성이 높다. 8개 소비 지점(execution-engine 2·knowledge-base 5·auth-oauth 1) 전부가 SELECT(제네릭 유지)와 UPDATE/DELETE(`unknown` + 헬퍼)를 정확히 구분해 적용했고, `assertRowArray`/`updateReturningRows` 두 헬퍼의 책임 분담(SELECT vs UPDATE/DELETE)도 주석과 구조적 회귀 가드(`assert-row-array.spec.ts`/`update-returning-rows.spec.ts`)로 고정돼 있다. 여러 라운드에 걸쳐 지적된 네이밍·주석-타입 불일치·stale 제네릭·detail 누락 항목은 실제 파일을 직접 열어 확인한 결과 모두 반영돼 있다. 남은 것은 `knowledge-base.service.ts` 안에서 동일 목적 변수의 이름이 `rowsOut`/`resetRows` 로 갈린 사소한 네이밍 흔들림 하나뿐이며, 기능적 위험은 없다.

## 위험도

LOW
