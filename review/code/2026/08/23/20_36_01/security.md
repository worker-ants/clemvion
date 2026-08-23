# 보안(Security) 코드 리뷰 결과

## 대상
- `codebase/backend/src/modules/executions/dto/re-run.dto.spec.ts` (신규)
- `codebase/backend/src/modules/executions/dto/re-run.dto.ts` (수정)
- `plan/in-progress/rerun-dto-shorthand.md` (신규)
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (체크박스 상태만 변경)

## 변경 요약
`ReRunRequestDto.inputOverride` 의 `@ApiPropertyOptional` 메타데이터를 축약형(`type: Object`)에서
명시형(`type: 'object', additionalProperties: true`)으로 바꾸고, 생성되는 OpenAPI 문서가 이를
열린 map 으로 광고하는지 고정하는 캐너리 테스트를 추가했다. 나머지 두 파일은 plan 트래킹
문서의 체크박스/서술 갱신이다.

### 발견사항

없음.

- **[INFO]** 순수 OpenAPI 문서 메타데이터 변경 — 런타임 영향 없음
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:28-29` (변경 후 게이트 기준)
  - 상세: `type`/`additionalProperties` 는 `@nestjs/swagger` 의 `ApiPropertyOptional` 데코레이터
    옵션으로, Swagger/OpenAPI 문서 생성(및 그로부터 파생되는 클라이언트 SDK 스키마) 에만
    영향을 준다. 실제 요청 바디 검증은 그대로 `@IsOptional()` + `@IsObject()`(class-validator,
    `re-run.dto.ts:31-32`) 가 수행하며 이번 diff 로 전혀 바뀌지 않았다. `inputOverride` 는
    원래도 임의 키를 허용하는 "열린 map" 설계이므로(EIA §R17, Manual Trigger 스키마 호환)
    문서 표현을 실제 동작에 맞춘 것이며 검증 완화나 인가 범위 확장이 아니다.
  - 제안: 없음(정보성).
- **[INFO]** 마스킹 마커 재제출 거부 로직은 이 diff 범위 밖
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:21` (description 문자열,
    변경 없음)
  - 상세: description 에 언급된 `MASKED_VALUE_RESUBMITTED` 400 거부는 최근 커밋
    (`4287cdd5b`, `b677564e0`, `3f8543eae`)에서 서버 측 가드로 이미 구현·강제된 것으로 보이며,
    이번 diff 는 그 로직을 건드리지 않는다. 새 캐너리 테스트(`re-run.dto.spec.ts` 65-68행)는
    해당 캐비엇 문구가 생성된 OpenAPI `description` 필드에 그대로 노출되는지만 확인하는
    문서 회귀 테스트다.
  - 제안: 없음(정보성) — 실제 마커 거부 로직 자체는 별도 PR(#1188/#1189)에서 이미 리뷰된
    범위이므로 본 리뷰에서 재검증하지 않음.
- **[INFO]** 신규 테스트 파일은 격리된 프로브 모듈 사용 — 부작용 없음
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.spec.ts` (전체)
  - 상세: `ProbeController`/`ProbeModule` 을 별도로 만들어 `SwaggerModule.createDocument` 를
    돌리는 순수 문서-생성 테스트다. 외부 I/O, 시크릿, 사용자 입력 처리 경로가 없다.
  - 제안: 없음.
- **[INFO]** plan 문서 2건은 트래킹/서술 텍스트 변경만
  - 위치: `plan/in-progress/rerun-dto-shorthand.md` (신규), `plan/in-progress/spec-sync-external-interaction-api-gaps.md:384,1077-1090` (체크박스 `[ ]`→`[x]` + 근거 서술 추가)
  - 상세: 코드 실행 경로에 영향 없는 마크다운 문서. 하드코딩된 시크릿·인증정보·URL 자격증명
    등 민감정보 포함 여부를 확인했으나 없음.
  - 제안: 없음.

## 요약
이번 변경은 `ReRunRequestDto.inputOverride` 의 Swagger/OpenAPI 문서 메타데이터를 축약형에서
명시형(`type: 'object' + additionalProperties: true`)으로 교정하고 이를 고정하는 문서-생성
캐너리 테스트를 추가한 것이 전부이며, 나머지 두 파일은 plan 트래킹 문서의 체크박스/서술
갱신이다. 런타임 입력 검증(`class-validator`)·인증/인가·마스킹 마커 거부 로직·암호화·에러
처리·의존성 어느 것도 변경되지 않았고, 인젝션 벡터·하드코딩된 시크릿·평문 전송 등도 발견되지
않았다. 보안 관점에서 실질적 리스크가 없는 문서/테스트 정합성 개선 커밋이다.

## 위험도
NONE
