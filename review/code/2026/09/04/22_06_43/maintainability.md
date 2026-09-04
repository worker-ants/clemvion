# 유지보수성(Maintainability) 리뷰

## 리뷰 범위와 방법

`git diff --stat origin/main...HEAD -- codebase/` 로 실측한 결과, 이번 changeset 에서 **실제
코드 구조가 있는 변경은 4개 파일**로 한정된다.

- `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts`
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts`
- `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts`

프롬프트 번들의 나머지 파일(`CHANGELOG.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`,
`review/code/2026/09/04/{19_43_18,20_16_17,20_39_25,21_10_30,21_25_50,21_45_58}/**`,
`review/consistency/2026/09/04/20_05_42/**`)은 마크다운/JSON 문서이거나 이전 리뷰 라운드의
산출물이 커밋된 것이라 함수 길이·중첩·순환 복잡도 관점의 코드 구조 리스크가 없다.

이 4개 코드 파일은 이미 **동일 changeset 안에서 코드 리뷰 6라운드**
(`19_43_18`→`20_16_17`→`20_39_25`→`21_10_30`→`21_25_50`→`21_45_58`)를 거쳤고, 매 라운드
maintainability 관점이 포함되어 있었다. 각 라운드 `RESOLUTION.md` 를 대조한 결과, 발견된
WARNING(정규식→AST 전환, 경로 정규화, `<Entity>Dto` 이름 관례 한계, `readOption<T>` 제네릭화,
캐너리 보강 등)은 전부 조치 완료됐고, 남은 INFO 는 **의도적으로 미조치 처리**되어 있음을
`RESOLUTION.md` 서술과 함께 확인했다. 저장소 파일은 읽기 전용으로만 확인했다
(`git status --short` 로 뮤테이션 없음 확인, 신규 산출물 디렉터리 외 변경 없음).

## 발견사항 — 신규 없음, 기존 INFO 재확인만

이번 라운드에서 4개 코드 파일을 직접 열어 재검토한 결과, **새로 발견된 유지보수성 결함은
없다.** 아래는 이전 라운드가 이미 짚고 명시적으로 "미조치" 로 처분한 항목을 독립적으로
재확인한 결과다 — 새 지적이 아니라 처분의 타당성 확인이다.

- **[INFO]** `collectNumericFields`/`collectDtoFieldTypes` 가 "클래스 선언을 찾아 순회" 하는
  뼈대(`const byClass = new Map(); const visit = (node) => { if (ts.isClassDeclaration...) {...}
  ts.forEachChild(node, visit); }; visit(sf); return byClass;`)를 그대로 반복한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:296`-`317`
    (`collectNumericFields`), `:320`-`339` (`collectDtoFieldTypes`)
  - 상세: `21_45_58` 라운드가 동일 지적을 했고(`RESOLUTION.md` 항목 7), "지금 스캐너가 둘뿐인
    상태에서 `walkClasses` 헬퍼를 뽑으면 추상화가 사례보다 앞선다" 는 근거로 미조치 처리했다.
    이번 라운드에도 스캐너는 여전히 둘뿐이라(`findSwaggerContractMismatches` 는 프로퍼티 선언을
    도는 별개 모양) 그 판단을 뒤집을 새 근거가 없다.
  - 제안: 조치 불요(재확인). 세 번째 유사 스캐너가 추가되는 시점에 재고할 것.

- **[INFO]** `swagger-dto-contract.spec.ts` 의 "정규식 위음성 4형태" `it.each` (`:423`-`453`)와
  "포지셔널 `@Column` 2형태" `it.each` (`:461`-`483`) 콜백 본문이 완전히 동일하다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:423`-`483`
  - 상세: `21_25_50` 라운드가 병합을 제안했으나, 각 블록이 서로 다른 리뷰 라운드(`20_16_17` W1 ·
    `20_39_25` W1)의 회귀를 각각 겨냥한다는 이유로 분리 유지가 선택됐다(RESOLUTION 미기재 —
    코드 상태로 확인: 두 블록은 지금도 분리돼 있음). 콜백 본문 중복은 실재하지만, 각 블록
    바로 위 JSDoc 이 서로 다른 사건을 인용하므로 병합 시 그 추적성이 흐려질 수 있다는 트레이드
    오프가 있다.
  - 제안: 조치 불요(재확인). 순수 가독성 사안이며 검출력에 영향 없음.

- **[INFO]** `threshold` 필드만 `@ApiProperty({ type: String, ... })` 로 타입을 명시하고, 같은
  파일의 다른 `string` 필드(`id`/`workspaceId`/`createdAt`/`updatedAt` 등)는 리플렉션 추론에
  맡긴다 — 이유가 코드에 없다
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:28`
  - 상세: `21_45_58` RESOLUTION 항목 8 이 "방금 `number`→`string` 으로 정정한 자리라 명시가
    의도" 이며 "그 의도가 코드에 안 적혀 있다는 지적은 맞다" 고 인정하면서도 "다음에 이 자리를
    건드릴 때 한 줄 남긴다" 는 조건부로 미조치 처리했다. 이번 changeset 은 이 필드를 다시
    건드리지 않았으므로 그 조건이 발동하지 않았다 — 정합적인 미조치.
  - 제안: 조치 불요(재확인). 다음에 `threshold` 필드를 편집할 때 명시 이유를 한 줄 남길 것.

## 요약

실질 코드 변경 4개 파일(`AlertRuleDto.threshold` 타입 정정, `swagger-dto-contract-guard.ts` 의
`findNumericAsNumber`/`scanNumericExposure` 신규 축, 대응 단위·e2e 테스트)은 같은 changeset
안에서 코드 리뷰 6라운드를 거치며 정규식→AST 전환, 경로 정규화, 옵션 리더 제네릭화(`readOption<T>`),
이름 관례 한계 문서화, 캐너리 보강(boolean/string 인스턴스 각각) 등 실질적인 유지보수성 개선을
이미 마쳤다. 함수는 대체로 단일 책임을 지키고(`readOption`/`readBooleanOption`/`readStringOption`
/`readColumnType` 분리, `callDecorators`/`hasTopLevelNull` 분리), 매직 넘버는 전부 도메인 의미가
주석으로 설명되어 있으며(`numeric(12,4)` scale 을 채운 `12.3456`/`7.0625` 등), 중첩 깊이·순환
복잡도도 AST 순회 특성상 불가피한 수준을 넘지 않는다. 남은 INFO 3건(스캐너 뼈대 소규모 중복,
`it.each` 콜백 중복, `type: String` 명시 이유 미기재)은 전부 이전 라운드가 이미 식별해 "지금은
조치 규모에 못 미친다" 는 근거와 함께 명시적으로 미조치 처리한 항목이며, 이번 재확인에서도 그
판단을 뒤집을 새 사실은 없었다. 신규 유지보수성 결함은 발견되지 않았다.

## 위험도

NONE
