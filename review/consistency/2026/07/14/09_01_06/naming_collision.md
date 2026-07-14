# 신규 식별자 충돌 검토 — naming_collision

## 검토 대상
- 검토 모드: `--impl-done` (scope=`spec/5-system/14-external-interaction-api.md`, diff-base=`origin/main`)
- 변경 diff 요약: `@nestjs/swagger` 11.2.7 → 11.4.5 버전 bump 에 따라 deep-import 차단된
  `SchemaObject`(`@nestjs/swagger/dist/interfaces/open-api-spec.interface`)를 공개 타입
  `ApiResponseSchemaHost['schema']` 로 파생하는 로컬 `type SchemaObject = ...` alias 를
  3개 파일에 도입:
  - `codebase/backend/src/common/swagger/api-wrapped.ts`
  - `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts`
  - `codebase/backend/src/modules/external-interaction/dto/responses/interact-ack-response.dto.spec.ts`

## 확인한 사실 (워크트리 절대경로 기준)

- `SchemaObject` 는 세 파일 각각에서 **파일-로컬(비-export) type alias** 로만 선언됨.
  `api-wrapped.ts` 는 `wrapDataSchema` 등 여러 함수를 `export` 하지만, `SchemaObject`
  자체는 export 목록에 없음 (`export function ...): SchemaObject` 형태로 반환 타입에만
  쓰이고, 타입 자체의 재-export 는 없음).
- 저장소 전체(`codebase/frontend`, `codebase/packages`, `codebase/channel-web-chat`)에
  `SchemaObject` 식별자가 다른 용도로 쓰이는 곳 없음 — grep 결과 0건.
- `spec/`, `plan/` 코퍼스에서 `SchemaObject` 를 다른 의미(엔티티·DTO·요구사항 용어 등)로
  정의한 문서 없음 — 유일한 언급은 `plan/in-progress/pnpm-migration-followups.md:46,49,53`
  로, 이번 구현이 후속 조치한 바로 그 defer 항목(동일 배경 설명)이며 본 diff 와 정합.
- target spec 문서(`spec/5-system/14-external-interaction-api.md`)는 이번 diff 가 다루는
  요구사항 ID·엔티티명·endpoint·이벤트명·ENV var·파일 경로 신설과 무관 — 이 diff 는 스웨거
  타입 파생 방식만 바꾸는 내부 리팩터이며 spec 문서 자체에 새 식별자를 추가하지 않음.

## 발견사항
없음. 검토 관점 1~6 (요구사항 ID / 엔티티·타입명 / API endpoint / 이벤트명 / 환경변수·설정키 /
파일 경로) 중 어느 것도 이번 변경으로 새로 영향받지 않음. `SchemaObject` alias 는:

- TypeScript 모듈 스코프상 각 파일에 격리되어 있어 파일 간 충돌 불가능(원래도 그렇게 3개
  파일 각각 import 하던 것을 로컬 재선언으로 대체한 것뿐).
- export 되지 않으므로 다른 모듈에서 이 alias 를 import 해 원래 `@nestjs/swagger` 의
  `SchemaObject` 와 혼동할 경로도 없음.
- 이름 자체가 원본 라이브러리 타입명을 그대로 계승한 것으로, 오히려 기존 코드베이스
  전반의 사용 관례(동일 이름으로 이해)와 일치 — 새로운 의미 부여가 아님.

## 요약
이번 diff 는 `@nestjs/swagger` 11.4.x 로 버전을 올리며 차단된 deep-import 를 공개 타입에서
파생한 로컬(비공개) `SchemaObject` type alias 로 대체하는 순수 내부 타입 시스템 대응이다.
alias 는 3개 파일 각각에 격리되어 export 되지 않으므로 요구사항 ID·엔티티/타입명·API
endpoint·이벤트명·환경변수·파일 경로 등 어떤 관점에서도 기존 사용처와 충돌하지 않는다.
spec/plan 코퍼스에서도 동일 이름이 다른 의미로 쓰인 사례가 없다.

## 위험도
NONE
