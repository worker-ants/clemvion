# 유지보수성(Maintainability) 코드 리뷰

## 리뷰 범위

실질 코드/문서 변경은 6개 파일이다. 나머지(파일 7~78)는 이전 리뷰 라운드
(`19_43_18`/`20_16_17`/`20_39_25`/`21_10_30`/`21_25_50`)와 consistency-check
(`20_05_42`)의 산출물(`RESOLUTION.md`/`SUMMARY.md`/`*.md`/`meta.json`)로, 이 저장소의
확립된 관례(`review/` 는 gitignored 아님, 산출물을 커밋)에 따라 새로 추가된 report 파일이다.
report 파일 자체는 코드 구조 관점(함수 길이·중첩·복잡도)의 대상이 아니라 이번 리뷰에서는
제외하고, 실 코드/문서만 분석했다.

1. `CHANGELOG.md` — 신규 Unreleased 항목 1건
2. `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` — `threshold: number → string` 정정
3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — 세 번째 가드 축(`findNumericAsNumber`/`scanNumericExposure`) 신설 + `readOption<T>` 제네릭 추출
4. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 축의 대조군/캐너리 테스트
5. `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` — 신규 e2e
6. `plan/in-progress/spec-draft-nullable-notation-followups.md` — plan 트래커 갱신

## 발견사항

- **[INFO]** `collectNumericFields` / `collectDtoFieldTypes` 두 함수가 "클래스 선언을 찾아
  순회한다" 는 거의 동일한 트리워커 뼈대를 각각 손으로 반복한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:296`-`317`
    (`collectNumericFields`) 및 같은 파일 `:320`-`339` (`collectDtoFieldTypes`)
  - 상세: 두 함수 모두 `const visit = (node) => { if (ts.isClassDeclaration(node) && node.name) { ... } ts.forEachChild(node, visit); }; visit(sf);` 형태의 순회 골격이 문자 그대로 같고,
    클래스를 찾은 뒤 멤버를 도는 내부 루프만 다르다(전자는 `@Column` 데코레이터를 읽고,
    후자는 타입 텍스트를 읽는다). 이 저장소는 같은 날(`b79dafdf9`, "repo-guard walker 사본
    5개 통합")에 정확히 이런 종류의 "구조는 같고 내용만 다른 walker 사본"을 하나로 모으는
    작업을 했다 — 다만 그 리팩터는 **파일 수집**(`readdirSync` 기반) 축이었고 이번 중복은
    **AST 클래스 순회** 축이라 같은 헬퍼로 바로 흡수되진 않는다. 규모(각 15~20줄)가 크지
    않아 지금 당장 급한 결함은 아니지만, 세 번째 유사 스캐너가 추가되면 패턴이 굳어지기
    전에 `walkClasses(sf, (cls, node) => …)` 류의 공유 순회 헬퍼로 뽑아낼 가치가 있다.
  - 제안: 즉각 조치 불요. 다음에 같은 형태(클래스 선언을 찾아 멤버를 스캔)의 축이 하나 더
    생기면, 순회 골격(`ts.isClassDeclaration` 판별 + `forEachChild` 재귀)만 공유 헬퍼로
    추출하고 멤버별 콜백만 주입하는 리팩터를 고려한다.

- **[INFO]** `@ApiProperty({ type: String, ... })` 의 명시적 `type: String` 이 같은 파일의
  다른 `string` 필드들과 여전히 스타일이 다르다 (이전 라운드 `19_43_18` maintainability
  INFO 에서 이미 지적, 이번 라운드에서도 미해결 상태로 남음)
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:28`
  - 상세: `id`/`workspaceId`(`format: 'uuid'`)·`createdAt`/`updatedAt`(`format: 'date-time'`)
    등 다른 `string` 필드는 `type:` 을 명시하지 않고 리플렉션 추론에 맡기는데, `threshold`
    만 `type: String` 을 명시한다. `number` 에서 `string` 으로 막 바뀐 필드라 리플렉션 추론이
    타입 캐시·빌드 순서에 따라 애매해질 가능성을 차단하려는 의도로 읽히지만, 그 이유가
    코드에 없어 다음 사람이 "왜 이 필드만 명시적인가"를 다시 추적해야 하는 점은 그대로다.
    위험도는 낮다 — 실제 결함이 아니라 파일 내부 일관성 문제다.
  - 제안: 필요하다면 JSDoc 에 "타입 정정 직후라 리플렉션 추론에 기대지 않고 명시했다" 한
    줄만 남기거나, 굳이 아니라면 다른 필드처럼 `type:` 을 생략해 스타일을 통일한다.

## 개선으로 확인된 점 (참고, 조치 불요)

- 이전 라운드(`19_43_18`)의 maintainability INFO — "`threshold` JSDoc 이 같은 파일의 다른
  필드보다 5배 길고, CHANGELOG 와 서사를 중복 서술한다" — 가 이번 diff 에서 실제로 해소됐다.
  `alert-rule-response.dto.ts:20`-`23` 의 `//` 라인 주석에 "정정 경위"(내부 서사, `nest-cli.json`
  swagger 플러그인이 JSDoc 을 공개 `description` 으로 내보내므로 여기 두면 안 됨)를 분리하고,
  `:24`-`27` JSDoc 은 "지금 무엇을 지켜야 하는가"(문자열로 내려간다, 왜, 쓰기는 number)만
  남겼다. `swagger.md` 에 이 분리 가이드를 성문화하자는 후속 항목도
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재돼 있어(§`21_10_30`
  INFO#3), 코드와 규약 트래커가 같은 방향을 가리킨다.
- `readOption<T>`(`swagger-dto-contract-guard.ts:69`-`85`) 로 `readBooleanOption`/
  `readStringOption` 의 순회 로직을 통합한 것은 정당한 DRY다 — 두 함수가 "데코레이터 인자
  객체에서 key 를 찾아 리터럴이 나올 때까지 훑는다" 는 동일한 뼈대를 공유했고, 추출 후에도
  기존 boolean 동작이 뮤테이션 테스트(`21_10_30` W1, "리터럴이 아니면 계속 훑는다" 분기를
  캐너리로 고정)로 보존됨이 확인됐다.
- 신규 가드 축(`findNumericAsNumber`/`scanNumericExposure`)은 디렉터리 판별을 매직 문자열
  대신 명명 상수(`ENTITY_DIR`/`RESPONSE_DTO_DIR`, `:261`-`262`)로 뽑아 두었고, `<Entity>Dto`
  이름 관례 의존이라는 알려진 한계를 코드 주석과 대조군 테스트(`swagger-dto-contract.spec.ts:473`)
  양쪽에 명시해 후임자가 다시 발견할 필요가 없게 해 두었다.
- `alerts-threshold-wire-type.e2e-spec.ts` 는 파일명·디렉터리(`test/*.e2e-spec.ts`) 컨벤션이
  형제 e2e 스펙들과 일치하고, 단일 `it` 블록이 POST→GET→PATCH→GET 순차 흐름을 다루긴 하지만
  각 단계에 "왜 다시 읽는가"(in-memory 값 vs DB 재조회) 주석이 붙어 있어 길이에 비해 읽기
  어렵지 않다.

## 요약

이번 changeset 의 실질 코드는 DTO 필드 타입 정정 1건과 그것을 재발 방지하는 정적 가드 축
1개, 그리고 그 축을 보강하는 e2e 1건이다. 함수 길이·중첩 깊이·순환 복잡도 관점에서 과도한
곳은 없고, `readOption<T>` 추출은 정당한 중복 제거이며 이전 라운드가 지적한 JSDoc verbosity
문제도 이번 diff 가 직접 해소했다. 유일하게 눈에 띄는 것은 신규 가드 파일 안에서 두 개의
AST 클래스 순회 함수가 뼈대를 반복하는 소규모 중복(이 저장소가 같은 날 다른 종류의 walker
중복을 정리한 전례가 있어 언급할 가치는 있으나 규모상 지금 조치할 정도는 아님)과, 이전
라운드부터 남아 있는 `@ApiProperty({ type: String })` 스타일 비일관성(저위험, 미해결)이다.
구조적 유지보수성 리스크는 없다.

## 위험도

LOW
