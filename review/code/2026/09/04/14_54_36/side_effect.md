# 부작용(Side Effect) 리뷰 — 응답 DTO 83필드 `required` false→true 일괄 전환

## 검토 범위 확인

`git show --stat 499675277`(HEAD)로 대조한 결과, 이 diff 는 정확히 다음 22개 파일에
한정된다: `CHANGELOG.md` · 응답 DTO 20개(`codebase/backend/src/modules/*/dto/responses/*.dto.ts`)
· `plan/in-progress/spec-draft-nullable-notation-followups.md`. 컨트롤러·서비스·엔티티 등
런타임 로직 파일은 **0건** 포함됐다 — 변경이 데코레이터·타입 선언 레이어에만 국한된다는
주장이 실측과 일치한다.

패턴은 전 파일에서 동일: `@ApiPropertyOptional({ nullable: true }) field?: T | null` →
`@ApiProperty({ nullable: true }) field: T | null`. `nullable: true` 는 그대로 보존되고
"필드가 값을 가질 수 있는가"(nullable)와 "키가 항상 존재하는가"(required)를 분리해
후자만 뒤집었다.

## 발견사항

- **[INFO]** 공개 인터페이스 변경 — OpenAPI `required` 83필드 false→true
  - 위치: `codebase/backend/src/modules/**/dto/responses/*.dto.ts` 20개 파일 전역 (예:
    `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:25`,
    `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:19`)
  - 상세: OpenAPI 스키마로 타입을 생성하는 클라이언트 입장에서 이 83필드는 이제 응답 바디에
    "항상 존재"로 문서화된다(런타임 wire 자체는 불변 — `@ApiProperty`/`@ApiPropertyOptional`
    은 `@nestjs/swagger` 전용 문서화 데코레이터이며 `class-validator`/`class-transformer` 와
    달리 런타임 직렬화·검증에 관여하지 않으므로 서버가 실제로 내려보내는 바이트는 그대로다).
    이는 리뷰 관점 #5(인터페이스 변경)에 해당하는 실질적 side effect 이지만, `CHANGELOG.md`
    Unreleased 항목에 영향 범위(`required: false → true`, "생성 타입이 좁아지므로
    optional-check 없이 접근 가능")를 명시적으로 고지했고 커밋 본문에도 동일 내용이 있다.
    생성 클라이언트가 좁아진 필드에 optional-check 없이 접근하게 되는 방향의 변경이라
    (넓어지는 방향이 아니라) 하위 호환 파괴 위험은 낮다.
  - 제안: 별도 조치 불요 — 의도된, 문서화된, 검증된(아래 시그니처 항목 참고) 변경.

- **[INFO]** TS 필드 시그니처 협소화 — `field?: T | null` → `field: T | null`
  - 위치: 위와 동일 20개 DTO 파일 전역 (개별 필드 83곳)
  - 상세: 클래스 필드 선언에서 `?` 를 제거해 TS 레벨에서 필드가 optional → required 로
    좁아진다. 커밋 본문은 "83곳 뒤집고 타입체크 결과 비-spec 오류 0건"이라고 주장하는데,
    직접 확인한 결과 (1) import 정리가 일어난 12개 파일 전부에서 `ApiPropertyOptional` 참조가
    깨끗이 제거돼 orphan 심볼이 없고(`grep -c ApiPropertyOptional` 전부 0), (2)
    `codebase/frontend`·`codebase/packages` 어디에도 이 백엔드 DTO 클래스를 직접 import 하는
    코드가 없다(`executions.ts:145` 의 매치는 경로를 언급하는 주석일 뿐 실제 import 아님) —
    즉 이 시그니처 협소화의 blast radius 는 백엔드 패키지 내부로 완전히 국한되고,
    cross-package 타입 결합으로 인한 숨은 컴파일 실패 경로는 없다.
  - 제안: 별도 조치 불요. 단, 이 검증(tsc 0 non-spec 오류)은 **현재의 객체 리터럴 조립 경로**
    에 대한 정적 검증이며, 향후 `plainToInstance`/spread/`as` 캐스트로 DTO 를 조립하는 코드가
    추가되면 그 경로는 tsc 가 "항상 채워짐"을 보증하지 못할 수 있다는 점만 유의(신규 코드
    리뷰 시 참고용 — 이번 diff 자체에는 그런 패턴이 없음을 확인함).

- **[INFO]** 부수 정리 — 12개 파일의 미사용 `ApiPropertyOptional` import 제거
  - 위치: `codebase/backend/src/modules/{alerts,audit-logs,auth-configs,dashboard,edges,folders,notifications,schedules,statistics,users,workflow-versions,workspaces}/dto/responses/*.dto.ts` 상단 import 문
  - 상세: 커밋 본문에 "부수로 ApiPropertyOptional 사용이 0이 된 12파일의 import 를
    정리했다"고 명시적으로 고지된 변경이다. 실제로 여전히 `ApiPropertyOptional` 을 쓰는 필드가
    남아있는 파일(예: `execution-response.dto.ts` 의 `NodeExecutionSummaryDto.nodeLabel?`,
    `integration-response.dto.ts` 의 `TestConnectionResultDto.latencyMs?` 등)에서는 import 가
    올바르게 보존되어 있음을 확인했다.
  - 제안: 별도 조치 불요 — 고지됨 + 검증됨.

## 점검했으나 문제 없음으로 확인된 항목

- 전역 변수 도입/수정: 없음(순수 클래스 필드 선언·데코레이터 인자 변경).
- 파일시스템 부작용: diff 는 소스 트리 내 텍스트 변경뿐, 빌드 산출물(예: 커밋된
  `openapi.json`/생성 SDK)이 저장소에 없어 stale 아티팩트 drift 위험도 없음.
  (`find codebase -iname "openapi*.json" -o -iname "swagger*.json"` 결과 0건.)
- 환경 변수: 읽기/쓰기 없음.
- 네트워크 호출: 없음.
- 이벤트/콜백: 없음 — 데코레이터 메타데이터만 바뀌므로 런타임 흐름·이벤트 발행 지점 불변.
- `WorkspaceInvitationDto.invitedBy`(파일 21)·`AuthConfigDto.ipWhitelist`(파일 4)는 plan 문서가
  "형제 plan 이 이 세션에 만든 2건 — drift 배치의 첫 두 건"이라 명시한 필드로, 이번
  `fix(dto)` 커밋(드리프트 배치 그 자체)에 포함된 것이 plan 서술과 일치한다(별도 PR 에서
  누락되지 않았음을 대조 확인).

## 검증용 뮤테이션 관련

가설을 반증하기 위한 코드 뮤테이션은 수행하지 않았다(`grep`/`git show`/`Read` 로 충분히
검증 가능한 범위였음). 저장소 트리에는 어떤 것도 쓰지 않았다 — `git status --short` 로
직접 확인하지는 않았으나 Read/Bash grep 외 쓰기 동작을 수행하지 않았으므로 잔여물 없음.

## 요약

이 변경은 20개 응답 DTO 파일에서 "상시 존재하는 nullable 필드"의 Swagger/TS 선언을
`ApiPropertyOptional`+optional → `ApiProperty`+required 로 일괄 전환하는 기계적 리팩터링이다.
런타임 동작(서버가 실제로 내려보내는 값)은 데코레이터 변경의 영향을 받지 않으며, 유일한
실질 부작용은 OpenAPI 스키마의 `required` 플래그 변화(생성 클라이언트 타입이 좁아짐)와 그에
대응하는 TS 필드 시그니처 협소화인데, 둘 다 CHANGELOG·커밋 본문·plan 문서에 명시적으로
고지됐고 blast radius 도 실측으로 확인했다(cross-package 직접 import 없음, orphan import
없음, diff 범위가 DTO 파일 22개로 정확히 국한됨). 숨겨진 전역 상태·파일시스템·환경변수·
네트워크·이벤트 부작용은 발견되지 않았다.

## 위험도

LOW
