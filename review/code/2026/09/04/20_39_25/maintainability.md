# 유지보수성(Maintainability) 리뷰

## 리뷰 범위와 방법

`meta.json` 기준 실질 코드/문서 변경은 5개 파일이다(나머지 33개는 `19_43_18`·`20_16_17`
코드 리뷰, `20_05_42` consistency-check 산출물이 신규 파일로 커밋된 것으로, 이번 diff 의
"코드"가 아니라 과거 라운드의 기록이다):

- `CHANGELOG.md` — 신규 Unreleased 섹션 1건
- `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` — `threshold`
  타입 정정
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — 신규 함수
  `findNumericAsNumber` + 헬퍼
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 함수의 저장소
  전수 테스트 + 대조군
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — planner 트래커 갱신

`origin/main...HEAD` 로 실제 diff 를 재확인했고(38 파일, 앞의 5개가 실질 변경), 저장소는
읽기만 했다(`git status --short` 뮤테이션 없음 확인).

이 changeset 은 이미 코드 리뷰 2라운드(`19_43_18`, `20_16_17`)를 거쳤고, `20_16_17`
`maintainability.md` 가 지적한 WARNING 2건(정규식 회귀·경로 정규화 누락)은 `RESOLUTION.md`
에 따라 AST 재작성 + `toPosixPath` 적용으로 닫혔다. 아래는 그 상태를 소스 대조로 재확인하고,
두 라운드가 놓친 자리를 추가로 찾은 결과다.

## 발견사항

- **[WARNING]** `readStringOption` 이 `readBooleanOption` 을 거의 그대로 복제했다 — 마지막
  한 분기만 다르다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:62`-`77`
    (`readBooleanOption`), `:80`-`95`(`readStringOption`, 이번 diff 신규)
  - 상세: 두 함수는 시그니처(`call, key, sf`)·순회 구조(`for (const arg of call.arguments)` →
    `isObjectLiteralExpression` → `for (const prop of arg.properties)` →
    `isPropertyAssignment` → `prop.name.getText(sf) !== key` 로 continue)가 **한 글자도
    다르지 않게** 12줄 반복된다. 차이는 마지막 두 줄뿐이다 — `readBooleanOption` 은
    `TrueKeyword`/`FalseKeyword` kind 를 boolean 으로 매핑하고, `readStringOption` 은
    `isStringLiteralLike` 를 string 으로 매핑한다. 이 저장소는 바로 이 디렉터리
    (`repo-guards/`)에서 "동일 보일러플레이트 사본을 통합" 하는 작업을 최근에 했다
    (`b79dafdf9` "repo-guard walker 사본 5개 통합") — 그 판단 기준과 같은 자리다: 순회
    골격은 완전히 동일하고 갈리는 지점은 "이니셜라이저를 어떻게 읽을지" 한 곳뿐이라, 두
    함수를 유지하는 것은 향후 세 번째 옵션 타입(예: 숫자 리터럴)이 필요해질 때 같은 12줄을
    또 복제할 유인을 만든다.
  - 제안: 공통 골격을 `findOptionInitializer(call, key, sf): ts.Expression | undefined` 로
    뽑고, `readBooleanOption`/`readStringOption` 은 그 결과의 `kind`/타입만 분기하는 3~4줄
    래퍼로 줄인다. 또는 `readOption<T>(call, key, sf, pick: (init: ts.Expression) => T |
    undefined): T | undefined` 형태의 단일 제네릭 헬퍼로 합쳐도 된다.

- **[INFO]** 신규 `numeric` 축 테스트가 파일이 이미 세운 `judge`/`axes` 헬퍼 패턴을 따르지
  않아, 같은 6줄 보일러플레이트가 6곳에 반복된다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts:301`-`418`
    (`describe('[대조군] 술어가 실제로 무는가', ...)` 내부 `it`/`it.each` 6곳), 대조 대상은
    같은 파일 `:50`-`60`(`judge(source)`/`axes(source)` 헬퍼 — presence·null 축 테스트가
    쓰는 패턴)
  - 상세: presence·null 축 대조군은 픽스처 소스를 `judge()`/`axes()` 헬퍼에 넣고 결과만
    비교하도록 정리돼 있다. 반면 새 `numeric` 축의 6개 테스트(`305`, `320`, `357`(`it.each`),
    `372`, `391`, `405`행)는 매번
    `withFiles({ 'entities/probe.entity.ts': …, 'dto/responses/probe-response.dto.ts': … },
    (paths) => { expect(findNumericAsNumber(Object.values(paths)))… })` 형태를 그대로
    반복한다. 각 테스트가 무엇을 검증하는지는 픽스처 소스와 기대값만 봐도 분명해 당장
    가독성을 해치지는 않지만, 파일 내에서 "같은 축의 반복 판정은 헬퍼로 뽑는다"는 확립된
    관례와는 어긋난다.
  - 제안: `judgeNumeric(entitySource: string, dtoSource: string) => withFiles({ 'entities/
    probe.entity.ts': entitySource, 'dto/responses/probe-response.dto.ts': dtoSource },
    (paths) => findNumericAsNumber(Object.values(paths)))` 정도의 로컬 헬퍼를 추가하면 6곳
    모두 `expect(judgeNumeric(ENTITY, 'export class ProbeDto {\n  amount: number;\n}\n')).
    toEqual([...])` 한 줄로 줄고, 파일 내부 스타일도 통일된다.

- **[INFO]** `20_16_17` 라운드가 지적한 두 WARNING 은 소스 대조로 재확인 결과 실제로 닫혔다
  (회귀 아님, 참고용)
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:252`-`273`
    (`collectNumericFields` — AST 기반, `readStringOption`/`callDecorators` 사용),
    `:316`-`320`(`findNumericAsNumber` — `toPosixPath(file)` 로 정규화 후 `ENTITY_DIR`/
    `RESPONSE_DTO_DIR` 판별)
  - 상세: `20_16_17` `maintainability.md` W1(정규식이 파일 자신의 "AST-only" 원칙을 어김)·
    W2(경로 미정규화로 윈도우에서 조용히 위반 0건)가 지적한 자리 그대로다. 현재 소스는 둘 다
    AST/`toPosixPath` 로 수정돼 있고, `swagger-dto-contract.spec.ts:340`-`370` 의 `it.each`
    4형태(중첩 객체·같은 줄 선언·접근 제한자·인접 데코레이터) 음성 대조군이 정규식 회귀를
    캐너리로 고정한다. 새로 지적할 사항 없음.
  - 제안: 없음(확인용).

- **[INFO]** `@ApiProperty({ type: String, … })` 명시가 같은 파일의 다른 `string` 필드와
  스타일이 다른 상태가 유지된다 (이전 라운드에서 이미 INFO 로 기록, 이번 diff 로 변경 없음)
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:28`
  - 상세: `19_43_18` `maintainability.md` INFO 항목과 동일 상태. `RESOLUTION.md` 의 조치
    대상(WARNING 1~4)에 포함되지 않았던 INFO 라 미해결이 정상이다. 새 결함이 아니다.
  - 제안: 조치 불요 — 다음에 이 필드를 다시 만질 때 함께 정리.

## 요약

이번 changeset 의 실질 코드는 `AlertRuleDto.threshold` 타입 정정(문서화 정정, 구조 변경
없음)과, 그 결함의 재발을 막는 신규 가드 축 `findNumericAsNumber` + 헬퍼 2개
(`collectNumericFields`/`collectDtoFieldTypes`) + 저장소 전수 테스트다. 앞선 두 라운드가
지적한 정규식 회귀·경로 미정규화 WARNING 은 AST 재작성과 `toPosixPath` 적용으로 실제로
닫혀 있음을 소스 대조로 재확인했다. 이번 라운드에서 새로 발견한 것은 (1) 이번 diff 가
새로 추가한 `readStringOption` 이 기존 `readBooleanOption` 을 옵션 값 추출 한 분기만 빼고
그대로 복제한 것(WARNING) — 저장소가 같은 디렉터리에서 최근에 "동일 보일러플레이트 통합"
작업을 했던 것과 같은 성격의 자리다 — 과 (2) 신규 numeric 축 테스트가 파일이 세운
`judge`/`axes` 헬퍼 관례를 따르지 않아 6곳에 같은 판정 보일러플레이트가 반복되는 것(INFO)
이다. 둘 다 기능 결함이 아니라 다음 축(세 번째 옵션 타입, 세 번째 테스트 판정 패턴)이
추가될 때 복제가 더 늘어날 구조적 여지다.

## 위험도

LOW
