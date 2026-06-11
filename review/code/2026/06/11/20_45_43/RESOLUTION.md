# RESOLUTION — 20_45_43

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드 (Testing) | f0589e29 | `pipe`/`metadata` 를 describe 스코프 const → `beforeEach` 인스턴스화로 이동해 테스트 격리 완전 보장 |
| #2 | 코드 (Testing) | f0589e29 | `page` 기본값(1), `sort`/`order` 기본값, `kind: 123` 타입 거부 검증 케이스 추가 |
| #3 | 코드 (Testing) | f0589e29 | `kind=''` 빈 문자열 엣지 케이스 명시 — `@IsString` 통과 후 `parseKind !kind` falsy 분기 `BadRequestException` 경로 커버 |

## TEST 결과

- lint  : 통과 (duration=112s)
- unit  : 통과 (40 passed, duration=69s)
- e2e   : 통과 (188/188, duration=96s)

## 보류·후속 항목

INFO 항목은 자동 수정 대상 아님 (추적용):

- INFO #1 (Maintainability): `ListModelConfigsQueryDto` `@ApiPropertyOptional` 누락 — 의도적 설계(컨트롤러 `@ApiQuery` 단일 소스), JSDoc 명시. 현행 유지.
- INFO #2 (Maintainability): `limit: 100` 하드코딩 — 파일 수준 상수 추출은 선택적 개선. 현행 유지 가능.
- INFO #3 (Testing): 프론트엔드 `modelConfigsApi.list()` `limit: 100` 단위 테스트 미작성 — 선택적 개선.
- INFO #4 (Testing): 백엔드 e2e 테스트 `test/model-configs.e2e-spec.ts` 부재 — 중장기 구조 개선 과제.
- INFO #5 (Requirement): `ListModelConfigsQueryDto` 전용 DTO 패턴 spec 미명시 — spec 위반 아님, 필요 시 `spec/5-system/2-api-convention.md`에 일반 지침 추가 가능.
- INFO #6 (Requirement): `[SPEC-DRIFT]` 프론트엔드 `limit: 100` — spec 준수 확인됨, 추가 조치 불필요.
- INFO #7 (API Contract): `kind` 이중 검증 레이어 — 의도적 설계(`MODEL_CONFIG_INVALID` 에러 코드 보존), 현행 유지.
- INFO #8 (Side Effect): `modelConfigService.findAll` 타입 확장 — 리스코프 치환 원칙 만족, 이슈 없음.
- INFO #9 (Scope): 변경 범위 버그 수정 직접 범위 내 완전 부합, 현행 유지.
