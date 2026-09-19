# 테스트(Testing) 리뷰 — entity-schema-declaration-drift (2차: 헬퍼 추출 리팩터 포함)

## 조사 방법 메모

`codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 전문을 직접 `Read` 했고,
`git show ffd58da4e` / `git show 6e18aa4d8` 로 원본 커밋과 헬퍼-추출 리팩터 커밋의 diff 를
각각 대조했다. `docker ps` 로 이 워크트리 전용 e2e 스택(`clemvion-e2e-entity-index-drift-4c8e21-*`)이
이미 떠 있는 것을 확인했지만, **병렬 리뷰어가 같은 워크트리·같은 DB 를 동시에 쓸 수 있다는 규약상
경고 때문에 직접 재실행하지는 않았다** — 대신 `plan/in-progress/entity-schema-declaration-drift.md`
체크리스트에 실린 RED/GREEN 개수·뮤턴트 예측/실측 표(정확히 8곳 → 4/4 GREEN → 뮤턴트 10개 전부
예측과 일치)와 리팩터 커밋 메시지("가드 4/4 GREEN, 판정 분기 뮤턴트 10개 모두 리팩터 전과 같은 RED")를
근거 자료로 대조 확인했다. 저장소 트리에는 아무것도 쓰지 않았다(`git status --short` 로 확인, 조사
전후 동일).

## 발견사항

- **[INFO]** `checked` 카운터가 완전한 커버리지 소실만 잡고 부분 축소는 못 잡는다 (1차 리뷰 INFO#2 이월, 미해소)
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — `expect(checked).toBeGreaterThan(0)` 세 곳 (인덱스/유니크 테스트, `@Check` 테스트; FK 테스트도 동일 패턴)
  - 상세: 이번 리팩터는 판정 골격(`reportMatch`)과 라벨 포맷터만 추출했고 이 하한 검증 방식은 그대로 남겨 뒀다. `ROOT_ENTITIES` 에서 엔티티 몇 개가 빠지거나 특정 엔티티의 `@Index`/`@Check` 선언이 통째로 삭제돼도 `checked > 0` 은 여전히 참이라 조용히 통과한다 — 이 PR 이 고친 원래 결함(«몇 곳을 놓쳤는지 아무도 몰랐다»)과 같은 형태로 가드 자신이 약해질 수 있는 경로다.
  - 제안: 1차 리뷰가 이미 제안한 대로 하한을 실측치(plan 이 적은 104, 또는 인덱스 24·유니크 14·CHECK 2·FK 64 각각의 실측치)로 상향하거나 `ds.entityMetadatas.length` 를 `ROOT_ENTITIES.length` 와 대조하는 카디널리티 단언을 추가. 급하지 않음(1차 리뷰에서도 "선택" 으로 분류됨) — 이번 라운드에서 새로 발생한 문제는 아니다.

- **[INFO]** 개발 중 검증한 뮤턴트 10개 중 다수가 회귀 테스트로 영속화되지 않았다 (1차 리뷰 INFO#3 이월, 리팩터 후에도 유효)
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — `it('정규화 비교가 표기 차이는 같다고 …')` (판별력 대조군, 182~296행대) vs 나머지 세 `it()` (일반 순회 루프)
  - 상세: `plan/in-progress/entity-schema-declaration-drift.md` 체크리스트의 뮤턴트 표(Workspace unique:true→false, 인덱스/CHECK/Unique 이름 오기, WorkspaceMember 컬럼 순서, FK 대상·onDelete 변경 등 10건)는 사람이 손으로 코드를 고쳤다 되돌리며 확인한 것이라 CI 에 영속적으로 남지 않는다. 리팩터 커밋(`6e18aa4d8`)이 같은 10개를 재실행해 리팩터 전후 동일 RED 를 확인한 것은 이 리팩터 자체의 무결성 증거로는 충분하지만, **다음에 누군가 `reportMatch`/`describeIndexDecl` 등을 다시 건드릴 때는 이 표가 다시 사람 손을 거쳐야** 한다 — "지금 실제로 drift 가 있을 때만" 잡는 일반 루프에 이 판정 분기별 커버리지가 의존한다는 구조는 그대로다.
  - 제안: 이번 PR 이 고친 결함 클래스와 겹치는 뮤턴트(예: 컬럼 순서 뒤바꿈, 이름 불일치, `where`/CHECK 정규형 불일치, FK `onDelete` 불일치) 중 1~2개씩을 판별력 대조군 `it()` 에 영구 케이스로 추가하는 것을 고려. 급하지 않음.

- **[INFO]** 헬퍼 추출 리팩터(`6e18aa4d8`) 자체는 관측 가능한 회귀 없음 — 긍정 관찰
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 전체 (`reportMatch`, `describeIndexDecl`, `describeDbIndex`, `describeForeignKeyDecl`, `describeDbForeignKey`, `nameOrNone`, `fkActions`)
  - 상세: `git show 6e18aa4d8` 로 대조한 결과 세 판정 분기(인덱스/유니크/CHECK)의 "매치 없음"·"이름이 다르다" 로직이 `reportMatch` 로 정확히 동일하게 옮겨졌고, FK 판정은 헬퍼 추출 대상이 아니라 원래 로직 그대로다(구조상 FK 는 "이름 불일치" 개념이 없어 `reportMatch` 시그니처와 안 맞는다는 점을 정확히 인지하고 별도로 남긴 것으로 보인다). 라벨 포맷터들의 타입(`IndexDecl = EntityMetadata['indices'][number]`, `ForeignKeyDecl = EntityMetadata['foreignKeys'][number]`)도 `any` 없이 정확히 좁혀져 있다. 커밋 메시지가 리팩터 전후 뮤턴트 10개 전부 동일 RED 를 재확인했다고 적었고, 이는 "리팩터가 판정 문구·판정 결과를 바꾸지 않았다"는 주장에 대한 구체적 반증 시도(뮤턴트) 결과라 신뢰할 수 있는 형태의 증거다.
  - 제안: 조치 불요. 참고 사항으로만 기록.

- **[INFO]** 한 가지 사소한 비효율 — "실패 메시지" 문자열이 이제 매치 성공 시에도 매번 계산된다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — 인덱스 루프의 `const others = real.map(describeDbIndex).join(' · ');` (307번째 줄 근방, `reportMatch` 호출 직전), CHECK 루프의 `const others = rows.map(...).join(' · ');` (381번째 줄 근방)
  - 상세: 리팩터 전에는 이 문자열이 `if (matches.length === 0)` 분기 안에서만(즉 실패했을 때만) 조립됐다. 리팩터 후에는 `reportMatch` 호출 인자로 넘기기 위해 매치 성공 여부와 무관하게 매번 미리 계산한다. 배열이 작아(테이블당 인덱스/CHECK 개수) 실질적 성능 영향은 없지만, 테스트 실행 시간에 민감한 변경이 이 파일에 반복적으로 들어올 경우 누적될 수 있는 패턴이라 인지해 둘 만하다.
  - 제안: 조치 불요(동작·정확성에 영향 없음). 원한다면 `missing` 파라미터를 값 대신 thunk(`() => string`)로 바꿔 지연 평가하는 선택지가 있으나 가독성 대비 이득이 작다.

## 요약

이번 라운드의 실질 diff 는 (a) 여섯 엔티티 파일의 인덱스·유니크·CHECK·FK 선언 정정(순수 메타데이터, `synchronize:false` 라 동작 불변)과 (b) 신규 e2e 가드(`entity-schema-declarations.e2e-spec.ts`)를 1차 리뷰 WARNING(판정 로직 3중 반복, 240자 라벨 줄)에 따라 `reportMatch`·포맷 헬퍼로 DRY 리팩터한 것이다. 엔티티 정정 자체는 별도 유닛 테스트가 필요한 종류가 아니라(TypeORM 데코레이터를 개별 단위 테스트하는 관례가 이 저장소에 없음) 새 e2e 가드가 적절한 계층에서 이를 커버한다 — RED-먼저(정확히 8건, 표와 1:1) → 정정 후 4/4 GREEN → 판정 분기 10개 뮤턴트로 각 실패 메시지 문구까지 검증(예측=실측) → 리팩터 후 같은 10개 뮤턴트 재확인이라는 워크플로는 이 프로젝트 메모리가 요구하는 "설계 근거는 뮤턴트로 반증" 원칙을 문자 그대로 따랐다. 판별력 대조군 테스트(정규화 비교가 표기 차이는 같다고 판정하고, 컬럼 이름이 된 식은 생성 자체가 실패한다고 판정하는지)도 별도로 존재해 vacuous 위험을 낮췄다. 리팩터 커밋 자체는 정적 대조 결과 판정 로직·메시지를 그대로 보존하는 기계적 추출이며 관측 가능한 회귀가 없다. 남은 지적은 전부 1차 리뷰에서 이미 "선택/급하지 않음"으로 분류된 항목의 이월(하한이 약한 `checked` 카운터, 뮤턴트 10개 중 대다수가 회귀 테스트로 영속화되지 않음)이며 이번 리팩터가 새로 만든 결함은 없다.

## 위험도
LOW
