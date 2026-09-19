# 문서화(Documentation) 리뷰

## 컨텍스트

이번 라운드는 1라운드(`review/code/2026/09/19/08_54_39`, Critical 0 · WARNING 3, 위험도 LOW)의 후속이다.
1라운드 documentation 리뷰의 WARNING("`plan/complete/entity-schema-declaration-drift.md` 선인용 — 마무리 커밋에서
plan 이동으로 해소 예정")과 INFO 2건(규칙의 `spec/conventions/` 미승격, CHANGELOG 미갱신 선례 일치)은 이번 라운드
diff(`6e18aa4d8`, 판정 골격·라벨 헬퍼 리팩터)와 무관하며 상태 변화가 없다 — `plan/in-progress/entity-schema-declaration-drift.md`
는 여전히 `in-progress`(체크리스트 마지막 항목 "트래커 반영 · `complete/` 이동" 미체크)이고, 이는 계획대로 마무리 커밋에서
닫힐 항목이라 재지적하지 않는다. 아래는 `6e18aa4d8` 이 새로 만든 결함이 있는지에 집중한 결과다.

## 발견사항

- **[INFO]** 리팩터로 새로 추출된 여섯 개 포맷팅 헬퍼에 JSDoc 이 없다 (짝인 `reportMatch` 만 문서화됨)
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — `nameOrNone`(55행) · `describeDbIndex`(59행) ·
    `describeIndexDecl`(65행) · `fkActions`(76행) · `describeForeignKeyDecl`(80행) · `describeDbForeignKey`(93행).
    같은 커밋이 추가한 `reportMatch`(101행)는 판정 규칙을 설명하는 JSDoc(97~100행)을 갖췄다.
  - 상세: 여섯 함수 모두 한 줄짜리 순수 포맷터이고 이름이 자기 서술적이라(`describeDbIndex` vs `describeIndexDecl`
    처럼 "실제 DB" / "선언" 을 이름으로 구분) 실질적으로 읽는 데 지장은 없다. 다만 `reportMatch` 만 JSDoc 을 받아 같은
    커밋 안에서 문서화 수준이 비대칭이고, 두 `describe*` 짝(선언 vs 실제)의 출력 포맷이 나중에 갈라지면(예: 한쪽만
    컬럼 순서를 바꾸는 리팩터) 어느 쪽이 "선언" 라벨이고 어느 쪽이 "DB" 라벨인지 함수 시그니처만으로는 한 번에
    안 드러난다.
  - 제안: 조치 불요에 가까움(테스트 전용 private 헬퍼, 공개 API 아님). 굳이 손댈 필요가 생기면 `reportMatch` 처럼
    "무엇을 반환하는 라벨인지" 한 줄만 얹으면 충분하다.

## 확인된 양호 사항 (참고 — 리팩터가 새 결함을 만들지 않았음을 실측)

- 상단 파일 JSDoc(1~25행 — 목적·`synchronize:false` 하에서의 단방향 검증·정규화 비교 방식·한계)은 리팩터 전후로 문구가
  바뀌지 않았고 여전히 코드와 일치한다.
- 새로 추가된 인라인 주석 두 곳 모두 대상 함수 바로 위에 정확히 붙어 있다: "아래 두 함수는 식을 이스케이프 없이 SQL 에
  이어 붙인다…"(`normalizedPredicate`/`normalizedCheck` 앞, 1라운드 INFO 대응) · "카탈로그를 읽기만 하므로 트랜잭션으로
  감싸지 않는다…"(FK 테스트의 `for` 루프 앞, 1라운드 INFO 대응) — 둘 다 실제 구현과 일치.
  `plan/in-progress/entity-schema-declaration-drift.md` 체크리스트 항목("판정 문구는 그대로 두었다… 뮤턴트 10개 모두
  리팩터 전과 같은 RED")과도 부합한다.
- `reportMatch` 로 추출된 판정 로직(인덱스·유니크·CHECK 세 곳)의 에러 메시지 문자열은 리팩터 전과 글자 그대로 동일 —
  기존 뮤턴트 검증이 여전히 유효하다는 plan 의 주장과 일치한다.
- 정정된 여섯 엔티티 파일(`edge`·`node`·`workspace`·`workflow-assistant-session`·`node-execution`·
  `integration-expiry-dispatch`)의 주석은 이번 라운드에도 변경이 없고, 실제 마이그레이션(V001·V009·V019·V095·V109)
  및 코드(`claimThreshold` 의 `ON CONFLICT DO NOTHING`, `entity.entity.ts` 의 `DESC` 미표현 관례)와 재대조해도 여전히
  정확하다 — 오래된 주석 없음.
- README/API 문서/설정 문서/CHANGELOG 관점은 1라운드 판단(해당 없음 · 기존 선례와 일치)에서 달라진 것이 없다 — 이번
  커밋은 순수 내부 리팩터(테스트 헬퍼 추출)라 사용자 가시 기능·설정·API 변경이 없다.

## 요약

1라운드에서 지적된 유지보수성 WARNING 2건(판정 로직 3중 반복, 240자 라벨 줄)을 고친 커밋 `6e18aa4d8`은 판정 문구·동작을
그대로 보존하면서(뮤턴트 10개 동일 RED 재확인) 순수 구조 개선만 수행했고, 문서화 관점에서 새로운 결함을 만들지 않았다.
1라운드 INFO 2건(SQL 조립 입력 출처, FK 테스트 트랜잭션 미사용 이유)에 대한 설명 주석도 정확한 위치에 추가돼 오히려
문서화 품질이 개선됐다. 유일한 신규 관찰은 리팩터로 뽑아낸 여섯 개 포맷 헬퍼 중 다섯 개(`reportMatch` 제외)가 JSDoc
없이 남았다는 점인데, 테스트 전용 한 줄짜리 순수 함수라 실질 위험은 없다. 1라운드에서 이미 열려 있던 `plan/complete/`
선인용(마무리 커밋에서 plan 이동으로 자동 해소 예정)은 이번 커밋과 무관해 재지적하지 않는다.

## 위험도
LOW
