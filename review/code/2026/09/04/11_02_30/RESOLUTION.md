# RESOLUTION — review/code/2026/09/04/11_02_30

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W1 | 코드 | `27d85e74c` | `effectiveRequired` 의 `@nestjs/swagger` 비공개 별칭 가정을 없애지 않고, 그 가정이 깨지면 즉시 RED 가 되는 캐너리로 고정 — 실제 `ApiPropertyOptional()`/`ApiProperty({required:false})` 를 호출해 `Reflect` 메타데이터를 비교 |
| W2 | 코드(문서) | `90db4b0f4` | 자매 커밋(`invitedBy`·`ipWhitelist`)과 같은 포맷으로 `CHANGELOG.md` 항목 추가. 8필드(required 방향 반전)와 `llmConfigId`(OpenAPI 출력 불변)를 구분해 기재 |
| W3 | 코드 | `59f83058e` | 경로 정규화 — **지적 범위보다 넓게 고침**(아래 "W3 확장 수정" 참조) |
| W4 | 코드 | `a3111ab57` | `withFiles` 가 async/thenable 콜백을 받으면 조용히 레이스를 내는 대신 즉시 명시적 에러로 실패하도록 변경. `temp-fixture.spec.ts` 신설로 정상/예외/async-오용 경로 고정 |
| W5 | 코드(테스트) | `27d85e74c` | `ContractMismatch.line`/`.file` 을 직접 단언하는 대조군 추가 — `node.getStart(sf)` 가 데코레이터 줄을 반환한다는 사실을 픽스처로 고정 |

INFO 26건은 자동 수정 대상이 아니다 — 전부 "급하지 않음"으로 명시된 항목이며, 별도 후속
추적 없이 각 리뷰 문서(`architecture.md`·`documentation.md`·`maintainability.md`·
`side_effect.md`·`testing.md`)에 남아 있다.

## W3 확장 수정 — 지적 범위보다 넓게 고친 이유

리뷰어(maintainability)는 `swagger-dto-contract-guard.ts:125` 한 곳만 지목했다. 그러나
형제 파일 `nullable-type-lie-cast-guard.ts` 안에 **같은 결함이 세 곳 더** 있었다
(`findCastOffenders`·`findUntypedNullableColumns`·`findStaleSpecCasts` — 각각
`path.relative(SRC_ROOT, file)` 만 쓰고 `.split(path.sep).join('/')` 정규화가 없음).
정규화를 하는 형제는 `masked-reject-callers-guard.ts:140` 과
`production-build-devdep-guard.ts:119` 다.

지적된 한 자리만 고치면 같은 저장소 관례 이탈이 세 곳 그대로 남는다 — "형제 가드 관례를
따르라" 는 지적의 본질이 그 자리 하나가 아니라 클래스 전체이므로, 네 자리를 한 커밋에서
동시에 고쳤다. 기존 단언(`nullable-type-lie-cast.spec.ts`)은 `.file` 문자열 값을 직접
비교하지 않고(`toEqual([])`/`.field` 만 확인) `path.sep` 정규화가 로컬(POSIX)에서는
no-op 이라 회귀 없이 통과한다.

## TEST 결과

- lint  : 통과
- unit  : 통과 (backend 445 suites / 9310 passed, 1 skipped — 신규 3파일 포함)
- build : 미실행 (본 세션은 lint+unit+e2e 만 요구, 코드 변경이 빌드 구성을 건드리지 않음)
- e2e   : 통과 (292/292, duration=256s, `_test_logs/e2e-20260904-112456.log`)

e2e 는 사전 지시에 따라 다른 e2e 실행과 겹치지 않는지 확인(`docker ps`에 프로젝트 compose
컨테이너 없음) 후 단독 실행했다.

## 보류·후속 항목

없음 — SUMMARY 의 Critical(0건)·Warning(5건) 전부 코드 수정으로 처리했고 spec 변경은
0건이다. INFO 26건은 각 리뷰 문서에 남아 있으며 전부 "급하지 않음"으로 명시돼 자동 처리
대상이 아니다.
