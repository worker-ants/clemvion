# 부작용(Side Effect) Review

## 검증 방법

diff 만으로는 "new file" 로 표기된 4개 dto 파일이 실제로 순수 리네임/분할인지, 내용이 달라졌는지 판단하기 어려워
`git diff -M origin/main HEAD` (rename detection) 로 재확인했다. 결과: `dto/responses.dto.ts` → 4개 파일로의
**순수 기계적 분할**이며, `dto/responses.dto.spec.ts` → `dto/responses/execution-status-response.dto.spec.ts` 도
동일하게 rename 으로 잡힌다 (import 경로 1줄 + JSDoc 상대링크 깊이(`../` 1단 추가) 외 클래스/데코레이터 내용 diff 없음).
구 경로(`dto/responses.dto`, `./responses.dto`)에 대한 잔존 참조는 backend 트리 전체에서 0건 (`grep -rln "responses\.dto" codebase/backend` 결과 없음).

## 발견사항

- **[INFO]** 순수 파일 재배치 리팩터 — 런타임 동작 변경 없음
  - 위치: `execution-status-response.dto.ts`, `interact-ack-response.dto.ts`, `refresh-token-response.dto.ts`, `interaction.controller.ts`, `interaction.service.ts`
  - 상세: `git diff -M` 로 대조한 결과 클래스 정의·`@ApiProperty`/`@ApiPropertyOptional` 데코레이터 값·`@ApiExtraModels` 등록 목록·`export abstract class WaitingContextBaseDto` 선언 모두 이관 전과 동일하다. 변경분은 (1) import 경로를 `./dto/responses.dto` → `./dto/responses/*-response.dto` 3개로 분리, (2) JSDoc 내 spec 상대링크 깊이가 파일이 한 단계 더 깊은 디렉토리로 이동한 만큼 `../` 1개씩 추가된 것뿐이다. `interaction.controller.ts`/`interaction.service.ts` 의 함수 시그니처·공개 API·HTTP 계약은 변경되지 않았다.
  - 제안: 조치 불필요. (참고용 기록)

- **[INFO]** 구 경로(`dto/responses.dto`) 잔존 참조 없음 — 배선 누락 없음 확인
  - 위치: 전체 `codebase/backend/src`, `codebase/backend/test`
  - 상세: `grep -rln "responses\.dto" codebase/backend` 결과 0건, `ExecutionStatusDto`/`InteractAckDto`/`RefreshTokenResponseDto`/variant DTO 를 참조하는 다른 파일(`execution.entity.ts` JSDoc, `external-interaction.e2e-spec.ts`/`execution-park-resume.e2e-spec.ts` 주석)도 모두 구 경로가 아닌 주석 언급뿐이라 import 갱신 누락은 없다. nest-cli.json/tsconfig 등 파일 경로를 하드코딩하는 설정도 없다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 스키마 회귀 테스트가 격리된 in-memory NestJS 앱을 생성·정리
  - 위치: `execution-status-response.dto.spec.ts` `buildDocument()` (L71-82), `beforeAll` (L89-93)
  - 상세: `Test.createTestingModule` 로 스텁 컨트롤러만 등록한 격리 모듈을 만들고 `app.init()` → `SwaggerModule.createDocument()` → `finally` 블록에서 `app.close()` 로 정리한다. 외부 DB/네트워크/전역 상태에 접근하지 않고, 실패 시에도 `finally` 가 앱을 닫으므로 프로세스 핸들 누수 우려 없음. `beforeAll` 1회만 실행해 모든 `it` 이 동일 문서를 재사용 — 부작용 없음.
  - 제안: 조치 불필요.

- **[INFO]** `interaction.service.ts`/`interaction.controller.ts`/`interaction.controller.spec.ts` 변경은 import 경로만
  - 위치: 각 파일 diff hunk
  - 상세: 3개 파일 모두 `import { ... } from './dto/responses.dto'` → 개별 파일 경로로 바뀌는 것 외에 로직 라인 변경이 없다. `getStatus`/`interact`/`cancel`/`refreshToken` 의 시그니처, 반환 타입, 호출 순서, DB 쿼리, redaction 호출(`deepRedactSecrets`, `redactThreadForPublic`) 모두 diff 범위 밖 — 그대로 유지.
  - 제안: 조치 불필요.

- **[INFO]** plan 문서 체크박스 갱신 — 코드 영향 없는 문서 변경
  - 위치: `plan/in-progress/eia-context-schema-followups.md`
  - 상세: 이전 PR(#913)에서 완료된 두 항목을 `[ ]` → `[x]` 로 정정하는 문서 편집. 코드 부작용과 무관.
  - 제안: 조치 불필요.

## 요약

리뷰 대상 8개 파일은 `dto/responses.dto.ts` 플랫 파일을 `swagger.md §5-1` 규약에 맞춰 `dto/responses/*-response.dto.ts` 서브디렉토리로 나누는 **순수 기계적 리팩터**다. `git diff -M`(rename 추적)로 대조한 결과 클래스 정의·데코레이터·export 표면·함수 시그니처·HTTP 계약 어느 것도 실질적으로 바뀌지 않았고, 변경은 import 경로 재배선과 JSDoc 상대링크 깊이 보정뿐이다. 구 경로에 대한 잔존 참조도 없어 배선 누락 위험이 없으며, 신규 추가된 OpenAPI 스키마 회귀 테스트는 격리된 in-memory NestJS 앱을 `try/finally` 로 안전하게 정리한다. 전역 상태·환경 변수·파일시스템·네트워크·이벤트/콜백 관점에서 부작용을 유발할 변경은 발견되지 않았다.

## 위험도

NONE
