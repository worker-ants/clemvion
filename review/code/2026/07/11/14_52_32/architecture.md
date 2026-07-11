# 아키텍처(Architecture) 리뷰

## 개요

본 변경은 `external-interaction` 모듈의 응답 DTO를 flat `dto/responses.dto.ts` 단일 파일에서 `dto/responses/*-response.dto.ts` 서브디렉토리 구조로 분리하는 순수 리팩터다 (`ExecutionStatusDto` 계열, `InteractAckDto`, `RefreshTokenResponseDto` 3개 파일 + 스키마 회귀 가드 spec 1개). 컨트롤러(`interaction.controller.ts`)·서비스(`interaction.service.ts`)·기존 controller spec 의 import 표면만 갱신됐고, 런타임 로직·DTO 필드 정의는 변경되지 않았다.

## 발견사항

- **[INFO]** God-file 해소 — 기존 convention 정합화
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/*.ts` (신규 3파일)
  - 상세: 이전에는 `ExecutionStatusDto`/`CurrentNodeDto`/`WaitingContextBaseDto`/`ButtonsContextDto`/`NodeOutputContextDto`/`InteractAckDto`/`RefreshTokenResponseDto` 7개 클래스가 서로 무관한 책임(상태 조회 응답 / 인터랙션 ack / 토큰 갱신 응답)을 한 flat 파일에 뒤섞고 있었다. `swagger.md §5-1` 이 규정하고 이미 25개 모듈이 따르는 `dto/responses/*-response.dto.ts` 1-파일-1-DTO(-family) 패턴으로 옮겨 응집도를 올렸다. `git diff --stat origin/main...HEAD` 확인 결과 옛 `dto/responses.dto.ts` 참조는 코드베이스 전체에서 0건 — 마이그레이션이 부분적으로 남지 않고 완결됐다(레거시 import 경로 잔존 없음, 죽은 파일 없음).
  - 제안: 없음 (이미 올바르게 완결).

- **[INFO]** `WaitingContextBaseDto` 를 통한 DTO 계층 구성 — 의도된 예외, LSP 위반 아님
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts:436-460, 463, 479`
  - 상세: `abstract class WaitingContextBaseDto` 를 `ButtonsContextDto`/`NodeOutputContextDto` 가 `extends` 하는 구조다. 순수 구조적 타이핑 목적(서비스 계층 조립 코드에서 object literal 을 분기 전 annotate)이면 TS `interface` 가 더 가벼운 선택으로 보일 수 있으나, `@nestjs/swagger` 는 데코레이터 메타데이터를 클래스 상속으로만 전파한다 — `interface` 로는 `@ApiProperty` 메타데이터가 자식에 상속되지 않는다. 따라서 class 상속은 프레임워크 제약에 따른 타당한 선택이며, base 는 `@ApiExtraModels` 에 등록하지 않아 OpenAPI 문서에 phantom 스키마가 생기지 않도록 명시적으로 설계돼 있다(주석·spec 양쪽에 근거 기재). 서브타입이 base 의 필드를 좁히거나 의미를 바꾸지 않고 순수 확장만 하므로 리스코프 치환 관점에서도 문제없다.
  - 제안: 없음. 다만 `execution-status-response.dto.spec.ts` 는 base 클래스가 `components.schemas` 에 등재되지 않는다는 것(phantom 스키마 부재)을 직접 단언하지 않는다 — 향후 회귀 가드로 `expect(schemas.WaitingContextBaseDto).toBeUndefined()` 1줄 추가를 검토할 만하다(비차단, 저비용).

- **[INFO]** plan 체크박스가 본 diff 의 실제 작업을 반영하지 않음
  - 위치: `plan/in-progress/eia-context-schema-followups.md:16`
  - 상세: 이 항목 — "`external-interaction` 모듈 응답 DTO 위치 정규화... `dto/responses/` 서브디렉토리로 이관 + import 표면 갱신" — 은 본 diff(커밋 `31bbbac31 refactor(external-interaction): 응답 DTO 를 dto/responses/ 서브디렉토리로 정규화 (swagger §5-1)`)가 정확히 수행한 작업이다. 그런데 diff 에 포함된 plan 파일 변경(파일 8)은 이 항목이 아니라 무관한 두 항목(C2, W-spec-link-ci)만 `[x]` 로 정정한다 — 정작 이 diff 가 완료한 항목은 여전히 `[ ]` 로 남아 있다. 프로젝트 컨벤션(`plan 체크박스 = 실제 상태`)과 어긋나는 추적 갭이다.
  - 제안: 같은 PR 또는 팔로업 커밋에서 line 16 항목을 `[x]` 로 갱신하고 완료 근거(커밋 해시)를 남길 것.

- **[INFO]** oneOf 닫힌 union 확장 시 다중 지점 동기화 필요 (사전 존재 설계, 본 diff 로 도입된 것 아님)
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts:497, 541-547` / `codebase/backend/src/modules/external-interaction/interaction.service.ts:1802-1835`
  - 상세: `context` 의 판별자 없는 2-variant `oneOf` 모델은 향후 3번째 인터랙션 표면이 추가되면 (a) 신규 subclass DTO, (b) `@ApiExtraModels` 등록, (c) `oneOf` 배열 + TS union 타입, (d) `interaction.service.ts` 의 `getStatus()` 조립 분기, (e) 클라이언트(SDK/위젯) 타입까지 총 5곳을 수동 동기화해야 하는 "shotgun surgery" 패턴이다. 이는 본 diff 가 새로 만든 설계가 아니라 이전 PR(EIA context oneOf 스키마화, PR #904)에서 이미 확정된 것이고, 본 diff 는 파일 위치만 옮겼을 뿐 그 설계를 변경하지 않았다.
  - 제안: 조치 불요(참고용). 신규 variant 추가 시 이 5곳 체크리스트를 diff 리뷰 시 명시적으로 확인할 것.

## 요약

순수 파일 이동/분리 리팩터로, 기존 `swagger.md §5-1` 컨벤션(25개 타 모듈이 이미 따르는 `dto/responses/*-response.dto.ts` 1-파일-1-책임 패턴)에 `external-interaction` 모듈을 정합화한다. 이전의 flat `dto/responses.dto.ts` God-file 이 해소돼 응집도가 올라갔고, 컨트롤러/서비스의 import 표면이 필요한 것만 정확히 가져오는 형태로 좁아져 결합도 관점에서도 개선이다. `git diff --stat origin/main...HEAD` 및 전체 코드베이스 grep 으로 옛 경로 잔존 참조가 0건임을 확인했고, `WaitingContextBaseDto` 의 abstract-class 상속 패턴은 NestJS/Swagger 데코레이터 메타데이터 상속 제약상 타당한 선택으로 LSP 위반이 없다. 순환 의존성·레이어 경계 위반·모듈 경계 침범은 발견되지 않았다. 유일한 실질 발견은 코드 자체가 아니라 추적 문서 — 본 diff 가 수행한 작업을 서술한 plan 체크박스(line 16)가 갱신되지 않은 채 남아 있는 프로세스 갭이다.

## 위험도
NONE
