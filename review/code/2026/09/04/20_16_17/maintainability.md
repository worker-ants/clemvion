# 유지보수성(Maintainability) 리뷰

## 리뷰 범위와 방법

이번 changeset 은 26개 파일로 구성되지만, 실질 애플리케이션/가드 코드 변경은 다음 두 파일뿐이다.
나머지는 문서(`CHANGELOG.md`, `plan/**`)이거나 이전 리뷰·consistency-check 라운드가 남긴 산출물
(`review/code/2026/09/04/19_43_18/**`, `review/consistency/2026/09/04/20_05_42/**`)이 신규 파일로
커밋된 것이라 함수·클래스 구조가 없다.

- `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` — `threshold` 필드 타입 정정 (이전 라운드에서 이미 리뷰됨, 상태 불변)
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — **신규 함수** `findNumericAsNumber` 추가 (이번 라운드의 신규 대상)
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 함수를 검증하는 신규 테스트 3건 + 회귀 테스트 1건

`findNumericAsNumber`(`swagger-dto-contract-guard.ts:219-269`)를 중심으로 분석한다. 저장소 파일은
수정하지 않았다(읽기 전용).

## 발견사항

- **[WARNING]** 신규 함수가 같은 파일이 스스로 문서화한 "정규식 금지" 원칙을 어기고, 그 정규식이 바로 그 문서가 경고한 것과 같은 종류의 함정(중첩 중괄호)에 취약하다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:216-217`(`NUMERIC_COLUMN` 정규식 선언), `:236-239`(그 정규식 사용처). 대조 대상 문서는 같은 파일 `:12-30`("## 왜 정규식이 아니라 AST 인가 — 정규식으로 세 번 틀렸다").
  - 상세: 이 파일의 헤더 JSDoc(12-30줄)은 "정규식으로 세 번 틀렸다"는 제목 아래, `[^;=]+?`/`.*?\)` 류의 blind 정규식이 **중첩된 문법**(객체 리터럴 안의 `;`, 데코레이터 인자 안의 `)`) 앞에서 조용히 잘못된 위치에서 멈췄다는 사례를 구체적으로 적어 두고, "패턴을 조금 넓히면 되는 문제가 아니다 — 중첩을 세지 않는 도구로 중첩된 문법을 읽으려 한 것이 원인" 이라고 결론짓는다. 그런데 바로 아래 추가된 `NUMERIC_COLUMN` = `/@Column\(\{[^}]*type:\s*'(?:numeric|decimal)'[^}]*\}\)\s*\n\s*.../g` 는 정확히 같은 함정을 갖는다 — `[^}]*` 는 `@Column({ type: 'numeric', transformer: { to: ..., from: ... } })` 처럼 데코레이터 인자 안에 중첩 객체(`transformer` 등)가 있으면 안쪽 `}` 에서 멈춰 뒤의 `type: 'numeric'` 를 놓치거나 필드명 캡처가 어긋난다. 또한 `\)\s*\n\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)` 는 "`@Column(...)` 다음 줄이 곧 필드 선언" 이라고 가정하므로, 그 사이에 `@Index()` 같은 두 번째 데코레이터나 필드 JSDoc 이 끼면 매칭이 실패해 그 필드가 `numericFields` 에서 **조용히 빠진다** — 예외를 던지지 않고 그냥 탐지 못 한 채 통과한다. 이 파일은 같은 문제(데코레이터-필드 연관)를 이미 AST 로 정확히 푸는 도구(`callDecorators`, `readBooleanOption`)를 갖고 있는데도, 신규 축만 그걸 재사용하지 않고 regex 로 되돌아갔다. 왜 이 축만 regex 가 안전한지에 대한 근거는 함수·주석 어디에도 없다.
  - 제안: `numericFields` 수집도 `visit` 이 이미 순회하는 AST 에서 `ts.isPropertyDeclaration` + `callDecorators(m, sf)` 로 `@Column` 데코레이터를 찾고, `readBooleanOption` 과 같은 패턴으로 `type` 문자열 인자를 읽어 `'numeric'|'decimal'` 인지 판정하도록 바꾼다. 그러면 이 파일이 스스로 세운 "정규식이 아니라 AST" 원칙과 정합해지고, 데코레이터-필드 인접성 가정도 사라진다.

- **[WARNING]** 신규 함수의 파일 역할 판별이 같은 파일의 기존 관례(`toPosixRelative`)를 쓰지 않아 구분자에 따라 조용히 아무것도 못 찾을 수 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:236`(`file.includes('/entities/')`), `:240`(`file.includes('/dto/responses/')`). 대조: 같은 파일 `:10`(`import { toPosixRelative } ...`), `:134-137`(`findSwaggerContractMismatches` 가 "크로스플랫폼 정규화 — 형제 가드와 동일 관례. `path.relative` 단독이면 윈도우에서 `\` 를 남긴다" 라고 명시하며 `toPosixRelative` 를 쓰는 자리).
  - 상세: `findNumericAsNumber` 는 `collectTsFiles()`(`common/__test-utils__/source-scan.ts`)가 돌려주는, `path.join` 으로 만들어진 **원본 절대경로**(플랫폼 구분자 그대로)를 받아 `file.includes('/entities/')` 로 역할을 가른다. 같은 파일이 정확히 이 문제 때문에 `toPosixRelative`/`toPosixPath` 를 import 해 쓰고 있고("`path.relative` 단독이면 윈도우에서 `\` 를 남긴다"고 그 이유까지 주석에 적어 뒀는데도), 신규 함수만 이 정규화를 거치지 않는다. 결과적으로 `path.sep` 가 `\` 인 환경에서는 `file.includes('/entities/')`가 항상 `false` 가 되어 `numericFields` 가 통째로 비고, 이 가드 축(존재 이유: `AlertRuleDto.threshold` 류 결함의 재발 방지)이 예외 없이 조용히 무력화된다 — 에러도, 실패 테스트도 없이 "위반 0건" 으로 보고된다.
  - 제안: 분류 전에 `toPosixPath(file)` 또는 이미 계산된 상대경로에 `toPosixRelative` 를 적용해 `/` 기준으로 판정한다. 최소한 이 함수가 왜 형제 함수와 다른 정규화 경로를 택했는지 주석으로 남겨야, 다음 사람이 실수로 빠뜨린 것인지 의도인지 구분할 수 있다.

- **[INFO]** 신규 함수가 이 파일의 다른 함수들과 달리 책임을 헬퍼로 쪼개지 않고 한 함수(약 50줄)에 모아, 파일 내 스타일이 갈린다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:219-269`
  - 상세: 같은 파일의 `findSwaggerContractMismatches` 는 `callDecorators`·`readBooleanOption`·`hasTopLevelNull` 세 헬퍼로 책임을 나누고 각각 짧은 JSDoc 을 붙였다. 반면 `findNumericAsNumber` 는 "엔티티 파일에서 numeric 컬럼 수집(regex)"·"DTO 파일에서 필드-타입 수집(AST)"·"두 맵을 이름으로 짝지어 교차 판정" 세 책임을 한 함수 안에, `visit` 클로저를 파일마다 재선언하는 형태로 인라인했다. 로직 자체는 각 분기가 짧아 당장 읽기 어렵진 않지만, 파일 내에서 "새 축을 추가할 때는 헬퍼로 쪼갠다"는 확립된 패턴과 어긋난다.
  - 제안: `collectEntityNumericFields(files)` / `collectDtoFieldTypes(files)` / `matchOffenders(entityFields, dtoFields)` 세 함수로 분리하면 기존 파일 스타일과 맞고, 위 두 WARNING 의 수정(AST 전환·경로 정규화)도 각 헬퍼 안에 자연스럽게 담긴다.

- **[INFO]** 파일 역할을 가르는 매직 문자열이 이 파일의 다른 상수화 관례와 어긋난다
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:236`, `:240`
  - 상세: 이 파일은 `API_DECORATORS`(41줄)·`NUMERIC_COLUMN`(216-217줄)처럼 반복 사용되는 값을 이름 붙은 상수로 뽑는 관례를 갖고 있다. `'/entities/'` 와 `'/dto/responses/'` 는 이 함수의 판정 로직 전체를 좌우하는 값인데도 리터럴로 인라인돼 있어, 두 문자열이 저장소의 실제 디렉터리 관례(`entities/`, `dto/responses/`)와 맞는지 한눈에 검증하거나 재사용하기 어렵다.
  - 제안: `const ENTITY_DIR = '/entities/'`, `const RESPONSE_DTO_DIR = '/dto/responses/'` 로 뽑아 상단에 둔다(위 경로 정규화 수정과 함께 적용).

- **[INFO]** `AlertRuleDto.threshold` JSDoc 이 같은 파일의 다른 필드 대비 여전히 5배 이상 길다 (이전 라운드에서 이미 지적된 상태, 이번 diff 로 변경 없음)
  - 위치: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:20-29`
  - 상세: `review/code/2026/09/04/19_43_18/maintainability.md` 가 이미 이 항목을 INFO 로 기록했고 이번 changeset 에도 동일 상태로 남아 있다(RESOLUTION.md 의 조치 대상은 WARNING #1-#4 뿐이라 INFO 는 애초에 필수 조치 대상이 아니었다). 새로운 결함이 아니라 미해결 상태를 재확인한 것이며, 위 원래 리뷰의 제안(정정 히스토리는 CHANGELOG 로 위임)이 여전히 유효하다.
  - 제안: 이전 리뷰와 동일 — 조치 불요(INFO), 다음에 이 필드를 또 만지게 되면 함께 정리.

## 요약

이번 changeset 의 실질 코드 변경은 `AlertRuleDto.threshold` 타입 정정(이전 라운드에서 이미 검토·저위험 확인)과, 그 결함을 재발 방지하는 신규 가드 함수 `findNumericAsNumber` 다. 후자가 이번 라운드의 핵심 검토 대상인데, 같은 파일이 몇 줄 위에서 "정규식으로 세 번 틀렸다"며 명시적으로 확립한 AST-only 원칙과 크로스플랫폼 경로 정규화 관례(`toPosixRelative`) 둘 다를 신규 함수만 따르지 않아, 파일 내부 일관성이 깨지고 특정 조건(중첩 중괄호를 가진 `@Column` 옵션, 데코레이터-필드 비인접, non-POSIX 경로 구분자)에서 이 가드 축이 예외 없이 조용히 무력화될 수 있는 구조다. 코드 자체는 짧고 각 분기는 읽기 쉬우나, 파일이 스스로 세운 원칙에 대한 예외 처리이므로 최소한 근거 주석이 필요하고, 가능하면 기존 AST 헬퍼 재사용·경로 정규화 적용으로 정합시키는 편이 낫다. 나머지 24개 파일은 문서 또는 이전 리뷰/consistency-check 산출물이라 함수 구조 관점의 리스크는 없다.

## 위험도

MEDIUM
