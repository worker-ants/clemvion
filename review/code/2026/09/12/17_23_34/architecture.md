# 아키텍처(Architecture) 리뷰 — chat-channel-rules-cleanup (라운드 4 / 17_23_34)

## 점검 방법

이전 세 라운드(`16_17_57` CRITICAL 1·WARNING 3 → `16_39_18` WARNING 3 → `17_02_19` 신규 결함
0·LOW)의 `RESOLUTION.md`·`architecture.md` 를 먼저 읽어 무엇이 이미 검증됐는지 확인했다.
`git log`/`git diff --stat`로 라운드 3(`17_02_19`, 커밋 `e07521a27`까지) 이후의 실제 변경분을
확인한 결과, **프로덕션 코드(`chat-channel-input-rules.ts` 등 7개 파일)는 라운드 3 이후 한 줄도
바뀌지 않았다** — 이번 라운드의 유일한 신규 코드 변경은 커밋 `3c9f4dd12`
(`test(repo-guards): DTO 클래스명 중복을 가드로 고정한다`)가 추가한 5개 파일뿐이다:

- `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts` (신규, 순수 로직)
- `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision.spec.ts` (신규, 소비 테스트)
- `codebase/backend/src/repo-guards/__tests__/fixtures/dto-class-collision/{alpha,beta,decoy}.dto.ts` (신규 fixture 3종)

따라서 이번 라운드는 이 신규 가드 모듈의 아키텍처를 집중 검토했고, 프로덕션 7개 파일에 대해서는
라운드 3 architecture 리뷰(`review/code/2026/09/12/17_02_19/architecture.md`, LOW·신규 결함 0)의
판정을 재확인만 했다(무변경이므로 재분석 불필요).

이 신규 가드 모듈을 저장소의 기존 형제 가드 8종(`audit-action-binding-*` · `dto-jsdoc-citation-*` ·
`swagger-dto-contract-*` · `endpoint-path-conflict-wrap-*` · `nullable-type-lie-cast-*` ·
`redis-fail-open-catalog-*` · `user-entity-exposure-*` · `eslint-unicorn-peer-*`)와 구조·의존
방향·스캔 대상 결정을 직접 `Read`/`grep` 으로 대조했다. 저장소 파일은 조회만 했다
(`git status --short` 로 뮤테이션 없음 확인, 원복 불필요).

## 발견사항

- **[INFO]** 스캔 루트가 `['modules', 'common']` 로 닫힌 열거이며, 향후 `src` 최상위에 새
  디렉터리가 생기고 그 안에 `*.dto.ts` 가 생기면 조용히 스캔 밖에 남는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision.spec.ts` —
    `SCAN_ROOTS` 상수 정의 및 그 바로 위 주석(파일 상단부, `const SCAN_ROOTS = ['modules',
    'common'].map(...)` 줄과 그 직전 실측 주석).
  - 상세: 근거(`*.dto.ts` 114개가 `modules/`(111)·`common/`(3)에만 있다는 실측)는 **현재
    시점 실측**이지 구조적 보장이 아니다. 형제 가드 `swagger-dto-contract.spec.ts` 의 주 단언
    (`findNumericAsNumber(collectTsFiles(SRC_ROOT))`)은 `SRC_ROOT` 전체를 스캔해 이런 폐쇄
    열거 문제가 없는 반면, 이 신규 가드의 유일한 실질 단언(`export class 이름은 유일하다`)은
    이 두 디렉터리 밖의 `.dto.ts` 를 원리적으로 보지 못한다. 이 가드가 막으려는 결함
    클래스(“구현 중에 태어난 이름이 사전 게이트를 피해간다”) 자체가 “아무도 안 지키는 자리”를
    다루는 것이므로, 스캔 루트 자체가 닫힌 목록인 것은 같은 패턴의 축소된 재발이다 — 지금
    당장은 저장소 컨벤션상 위험이 낮지만(전 DTO 가 `modules/`·`common/` 아래), 이 폐쇄 열거는
    코드 리뷰로만 감시된다.
  - 제안: 급하지 않음(NestJS 컨벤션상 `modules/`·`common/` 밖에 DTO 가 생길 가능성은 낮음).
    다만 `collectTsFiles(SRC_ROOT)` 전체 스캔 + 결과에서 `fixtures/` 경로만 필터링하는 형제
    가드(`swagger-dto-contract.spec.ts` 519행 패턴)로 바꾸면 이 폐쇄 열거 자체가 사라진다 —
    재발 시 이 방식으로 전환 검토.

- **[INFO]** `exportedClassNames` 는 파일의 최상위 `source.statements` 만 순회해 `export class`
  를 찾는다 — `namespace`/`declare module` 로 감싸인 클래스 선언이나 `export { X as Y }` 형태의
  재-export 는 집계하지 않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts:25-41`
    (`exportedClassNames` 함수, `for (const stmt of source.statements)` 루프).
  - 상세: 이 저장소의 `*.dto.ts` 는 전부 파일 최상위에 `export class` 를 직접 선언하는
    관례(형제 가드들이 전제하는 것과 동일)라 지금은 이 스코프 제한이 실제 결함을 만들지
    않는다 — 정규식 대신 AST 를 쓰기로 한 결정(주석·문자열 오탐 방지)과 균형이 맞는 적절한
    추상화 수준으로 판단된다. 다만 다음 사람이 이 함수를 "모든 export 클래스를 센다"로
    오독하면 네임스페이스로 감싼 자리에서 false negative 가 생길 수 있어 기록해 둔다.
  - 제안: 조치 불요 — 현재 관례 범위 내에서는 과설계보다 낫다. JSDoc 에 "최상위 선언만
    본다"는 스코프를 한 줄 명시하면 다음 사람의 오독 위험이 줄어든다(선택 사항).

## 확인했으나 문제 없음

- **DRY/모듈 경계 — 형제 가드 패턴과 정확히 일치**: 신규 파일 2개(`*-guard.ts` 순수 로직 +
  `*.spec.ts` 소비 테스트)는 저장소의 기존 8개 repo-guard 쌍과 이름·역할 분리 패턴이 동일하다.
  스캔·상대경로 유틸(`collectTsFiles`/`toPosixRelative`)도 새로 만들지 않고
  `common/__test-utils__/source-scan.ts` 를 그대로 재사용해 이 저장소가 이미 확정한 "세 번째
  가드가 생겨도 여기만 고치면 된다"는 DRY 원칙을 지킨다.
- **의도적으로 재사용을 피한 지점이 오히려 옳다**: 형제 가드 `dto-jsdoc-citation-guard.ts` 는
  `swagger-dto-contract-guard.ts` 의 `isResponseDtoFile`(경로에 `/dto/responses/` 포함 여부만
  참으로 보는 좁은 술어)을 재사용하는데, 신규 가드는 이를 재사용하지 않고 `file.endsWith('.dto.ts')`
  로 **모든** DTO 파일(요청+응답)을 스캔한다. 이것은 DRY 위반이 아니라 **올바른 판단**이다 —
  이번 세션이 라운드 1에서 실제로 낸 CRITICAL 충돌은 요청 DTO(`dto/chat-channel-config.dto.ts`,
  `/dto/responses/` 밖)와 응답 DTO 사이였다. `isResponseDtoFile` 로 좁혔다면 요청 DTO 쪽이
  스캔에서 빠져 이 가드가 **자신이 막으려는 바로 그 결함 클래스에 대해 vacuous** 해졌을
  것이다 — 술어 재사용 여부를 의미(요청 vs 응답이 아니라 "이름이 스키마 키가 되는 모든
  클래스")로 먼저 판별한 뒤 정확한 술어를 새로 정의한 것으로 판단된다.
- **순환 의존성 없음**: `dto-class-name-collision-guard.ts` → `common/__test-utils__/source-scan`
  단방향 참조뿐이고, 그 반대 방향 참조는 없다. fixture 3종(`alpha`/`beta`/`decoy.dto.ts`)은
  프로덕션 코드를 참조하지 않는 격리된 대조군이며, 형제 가드가 이미 문서화한 "fixture 는 스캔
  범위 밖에 둔다"(`swagger-dto-contract.spec.ts`)는 교훈을 `SCAN_ROOTS` 를 `modules`/`common`
  으로 좁혀 그대로 계승했다 — 자기-오탐 재발 없음.
- **추상화 수준**: `DtoClassCollision` 인터페이스·`exportedClassNames`/`findDtoClassCollisions`
  두 함수 분리는 "파일 하나에서 이름 뽑기"와 "전체에서 충돌 찾기"라는 서로 다른 두 책임을
  정확히 나눈다. 과도한 계층화(팩토리·전략 패턴 등)를 시도하지 않아 문제 크기에 맞는
  추상화다.
- **테스트-대-소비 계약**: `findDtoClassCollisions([], SRC_ROOT)` 를 빈 배열과 대조하는 주
  단언은 "vacuous 방지" 단언(스캔 대상 100개 이상)과 "대조군이 실제로 잡는다" 단언(fixture
  2건) 세 개가 세트로 존재해, 이 세션이 반복해서 지적한 "GREEN 이 아무것도 안 세서 나온
  GREEN 인지 구별 안 됨" 패턴을 스스로 차단한다 — 아키텍처 관점에서도 이 가드 자체가
  자기 실패 모드(회귀 감시자가 무력화되는 경로)를 설계 단계에서 닫아 둔 점이 긍정적이다.
- **프로덕션 코드 무변경 확인**: `chat-channel-input-rules.{ts,spec.ts}` ·
  `chat-channel-rejection-messages.const.ts` · `dto/chat-channel-config.dto.ts` ·
  `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` · `dto/trigger-dto-validation.spec.ts` ·
  `triggers.controller.ts` · `triggers.service.ts` 는 라운드 3(`17_02_19`, LOW·신규 결함 0)
  이후 `git diff` 상 변경분이 없다 — 그 라운드의 SOLID·결합도·레이어·순환의존성·확장성 판정이
  그대로 유효하다.

## 요약

이번 라운드의 유일한 신규 변경은 라운드 1이 낸 CRITICAL(swagger 스키마 이름 충돌)의 재발
방지용 repo-guard 테스트 모듈이다. 저장소가 이미 8종의 형제 가드로 확립해 둔 "순수 로직 +
소비 테스트" 분리, 공유 스캔 유틸 재사용, fixture 기반 대조군 3종(정탐·오탐 방지·AST vs 정규식)
패턴을 그대로 따르며, 형제 가드의 좁은 술어(`isResponseDtoFile`)를 무비판적으로 재사용하지
않고 이 가드의 목적에 맞는 넓은 술어를 새로 정의한 판단도 타당하다. 순환 의존성·레이어 침범·
과잉/과소 추상화는 발견되지 않았다. 남은 관찰(스캔 루트가 `modules`/`common` 로 닫힌 열거,
최상위 선언만 인식)은 현재 저장소 관례 안에서는 위험이 낮은 스코프 제한이며 CRITICAL/WARNING
급이 아니다. 프로덕션 코드 7개 파일은 라운드 3 이후 변경이 없어 그 라운드의 LOW 판정이 그대로
유효하다.

## 위험도

LOW
