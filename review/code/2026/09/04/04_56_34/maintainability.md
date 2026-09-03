# 유지보수성(Maintainability) 리뷰

## 스코프 메모

프롬프트에 나열된 120개 파일 중 실제 코드/문서 변경은 파일 1~10
(`codebase/backend/src/common/__test-utils__/source-scan.{ts,spec.ts}`, 5개 repo-guard 파일
쌍, `plan/in-progress/entity-nullable-column-type-mismatch.md`)이고, 나머지 110개는
`review/code/2026/09/04/{01_48_39 … 04_37_28}/` 하위의 이전 리뷰 라운드 산출물(9라운드분
SUMMARY·RESOLUTION·개별 reviewer 리포트·meta.json)이다. 이 저장소 관례상 `review/`는
gitignore 대상이 아니라 정상적으로 커밋되는 워크플로 부산물이며, 코드가 아니라 생성된
리포트이므로 가독성·네이밍 등 코드 유지보수성 기준 적용 대상이 아니다 — 이번 리뷰에서 제외.

파일 1~10의 현재 상태는 리포지토리에서 직접 읽어 확인했다(프롬프트가 크기 제한으로 일부
diff를 생략했으므로). 9라운드에 걸친 이전 리뷰(1R~9R)에서 제기된 Warning은 모두 해당 라운드
안에서 조치가 확인됐다 — `RESOLUTION.md` 이력과 현재 소스를 대조해 재확인했다(예: `withFiles`/
`withFixture` 통합, `stripLiterals` 전용 테스트, `isNullableType` 표기 변형 캐너리 양쪽 동기,
정렬 분기 캐너리, JSDoc orphan 재정렬, `findStaleSpecCasts` 이름 충돌 제외, plan 체크박스 동기,
`collectTsFiles` 중복 스캔 제거).

## 발견사항

- **[INFO]** `COLUMN_DECL`과 `WIDENED_DECL`이 "데코레이터(괄호 균형 1단계) + 뒤따르는 필드
  선언"을 파싱하는 거의 같은 모양의 정규식을 각각 손으로 유지한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:77-78`
    (`COLUMN_DECL`), `:168-169`(`WIDENED_DECL`)
  - 상세: `COLUMN_DECL`은 `@Column(...)` 하나만, `WIDENED_DECL`은 `@Column|@ManyToOne|@OneToOne`
    에 옵션인 추가 데코레이터 한 겹까지 매치한다는 점에서 완전한 중복은 아니고 각자 존재
    이유가 다르다(전자는 `type:` 누락 검사용, 후자는 넓혀진 필드명 수집용). 다만 "괄호
    균형을 맞춰 데코레이터 인자를 건너뛰고 `\s*(\w+)\s*:\s*([^;]+);`로 필드 선언을 잡는다"
    는 핵심 패턴 구조는 동일하며, 이 파일이 다른 곳(`source-scan.ts`)에서는 "세 번째 가드가
    생겨도 여기만 고치면 되도록" 이라는 명시적 DRY 원칙을 두고 있는 것과 대비된다. 예컨대
    향후 데코레이터 인자의 괄호 균형 규칙(`(?:[^()]|\([^()]*\))*`)을 2단계 중첩까지 넓혀야
    하는 날이 오면 두 곳을 각각 고쳐야 하고, 한쪽만 고치는 사고는 이 파일 자체가 8R에서
    실제로 겪은 패턴이다(`isNullableType` 공유는 됐지만 매치 정규식 자체는 공유되지 않았다).
  - 제안: 지금 당장 통합할 필요는 낮다(두 정규식이 잡는 데코레이터 집합·후행 옵션 데코레이터
    허용 여부가 실제로 다르고, 무리한 파라미터화가 오히려 각 정규식의 의도를 흐릴 수 있다).
    다음에 이 두 정규식 중 하나의 "괄호 균형" 부분을 고칠 일이 생기면, 그 부분만이라도 공유
    헬퍼(`decoratorArgsPattern` 같은 빌더 문자열)로 뽑아내는 것을 고려할 만하다.

- **[INFO]** `collectTsFiles` 위임 1줄 래퍼가 4개의 서로 다른 이름(`collectSourceFiles`·
  `listSourceFiles`·`collectScanTargets`·`listProductionSources`)으로 남아 있고, 한 곳
  (`engine-error-code-anchor-guard.ts`)은 래퍼 없이 직접 호출한다
  - 위치: `audit-action-binding-guard.ts:47-48`, `masked-reject-callers-guard.ts:48-52`,
    `nullable-type-lie-cast-guard.ts:38-40`, `redis-fail-open-catalog-guard.ts:93-94`,
    `engine-error-code-anchor-guard.ts:157`
  - 상세: 리팩터 전에는 다섯 walker가 실제로 미묘하게 달랐고(`.d.ts` 제외 여부, 정렬 여부 등
    `source-scan.ts:231-245`의 실측 표 참고) 지금은 전부 `collectTsFiles`의 동의어인데, 이름이
    통일되지 않아 처음 읽는 사람은 네 함수가 여전히 다른 로직을 가진다고 오인하기 쉽다. 이미
    2R(`02_12_38`)·9R(`04_37_28`) 라운드에서 각각 지적되고 "각 가드의 spec이 이미 그 이름을
    참조하므로 이번 diff 범위에서 통일하지 않는다"는 판단으로 명시적으로 유예가 확정된
    항목이라 이번 라운드에서 새로 발견한 것은 아니다 — 상태 변화 없음을 재확인하는 차원에서만
    기록한다.
  - 제안: 조치 불필요(이미 유예 결정 완료). 다음에 이 5개 가드 파일을 다른 이유로 만질 때
    한 번에 통일 검토.

## 요약

이 changeset은 `repo-guards/__tests__/` 5곳에 거의 동일하게 흩어져 있던 재귀 디렉터리
walker(각 10~20줄)를 `source-scan.ts`의 `collectTsFiles` 하나로 성공적으로 통합했고, 리팩터
전후 동작 불변을 축별 실측표로 근거를 남겼다. 그 위에 신설한 "넓혀진 nullable 필드를 겨눈 낡은
`.spec.ts` 캐스트" 가드(`widenedEntityFields`/`findStaleSpecCasts`)는 9라운드에 걸친 리뷰에서
제기된 실질 결함(정렬 회귀 커버리지 부재, 이름 충돌로 인한 오탐, 자매 함수 간 하드닝 비대칭,
JSDoc orphan, 저장소 중복 스캔, plan 체크박스 stale 등)이 전부 소스 레벨에서 조치됐음을 직접
파일을 열어 확인했다. 신규 공개 함수마다 "왜 필요한가"·"왜 오탐이 없는가"·"한계"·"과거에 이
자리에서 어떤 실패가 있었는가" 절을 갖춘 JSDoc이 있어 이 파일군이 확립한 문서화 관례를
일관되게 따르고, 함수 길이·중첩 깊이·순환 복잡도 모두 낮은 수준이다. 남은 흠은 둘 다 INFO
수준이며 하나는 이번에 새로 관찰한 것(두 정규식의 구조적 유사성, 통합 필요성은 낮음), 다른
하나는 이미 반복 지적·유예 확정된 항목(래퍼 이름 4종 불일치)이다. 코드를 바꾸지 않고 넘어가도
무방하다.

## 위험도

LOW
