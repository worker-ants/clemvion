# API 계약(API Contract) 리뷰 — `patch-null-validation`

## 발견사항

- **[INFO]** API 규약 §5.4 PATCH tri-state 서술("`null`=초기화")의 적용 범위가 "선언된 nullable 필드"인지 "모든 PATCH 필드"인지 문면상 불명확해, 이번 43필드 null 거부와 글자 그대로는 충돌해 보일 수 있다.
  - 위치: `spec/5-system/2-api-convention.md` §5.4 (이 프롬프트 번들에는 포함되지 않음) / 근거 문서 `plan/in-progress/patch-null-validation.md:29`(처방 3번째 불릿, "null 을 «기본값으로 초기화» 로 해석하지 않는다")
  - 상세: 실제 필드별 동작(§2.3.1 매트릭스·nullable 컬럼 선언·프런트가 43필드 중 어디에도 null 을 보내지 않음)과는 충돌이 없고, 이 PR 이 다루는 필드는 전부 OpenAPI 가 `nullable` 을 선언하지 않은 축이라 §5.4 예시(`llmConfigId` 등 `nullable: true` 필드)와는 반대편이다. 다만 §5.4 원문 자체는 "PATCH 부분 업데이트는 tri-state 가 각각 의미를 갖는 별개 계약" 이라고만 적어 이 구분을 명시하지 않는다.
  - 이미 처리됨: 같은 세션의 `--impl-prep` consistency check(`review/consistency/2026/09/27/17_14_44/cross_spec.md` WARNING, `SUMMARY.md` WARNING #2)가 동일 항목을 발견해 CRITICAL 미승격(현재 이 조건에 의존하는 소비자 없음) 상태로 `plan/in-progress/spec-draft-nullable-notation-followups.md`(6acc4dbc5 이후 보강분, planner 항목 (10))에 등재했다. 이 리뷰는 **API 계약 관점에서 같은 결론에 독립적으로 도달**했음을 확인하는 차원으로만 기록하며, 새 조치를 추가로 요구하지 않는다(planner 턴 대기 중).
  - 제안: 별도 조치 불필요 — 기존 트래커 항목이 처리를 담당한다.

- **[INFO]** `triggers.endpointPath` 는 DB 컬럼 자체는 nullable 이지만(plan §D-2), 비즈니스 계약상 webhook 트리거의 수신 경로를 지울 수 없어 API 레벨에서 `null` 을 400 으로 막는다 — DB 제약과 API 계약이 의도적으로 어긋나는 자리다.
  - 위치: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts:66`(`@IsOptionalNonNull()` / `endpointPath`)
  - 상세: 결함이 아니라 설계 의도(JSDoc 주석 `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts:49-57`에 명시)로 확인됨. 종전엔 `null` 전송 시 200 으로 경로가 조용히 삭제되는 실제 결함이 있었고, 이번 수정으로 400 `VALIDATION_ERROR`(details[].field=`endpointPath`)로 막혀 계약이 명확해졌다.
  - 제안: 조치 불필요 — 기록용.

## 평가 근거 (발견사항 없음 확인용)

- **하위 호환성**: 대상 43필드 모두 종전엔 `null` 전송 시 500(31건) · 엉뚱한 409(노드 `label`) · 조용한 데이터 삭제(200, 트리거 `endpointPath`)였다(`test/patch-null-rejection.e2e-spec.ts` 로 수정 전 코드 기준 실측, `plan/in-progress/patch-null-validation.md:97-109`). 즉 이 입력으로 "성공"을 얻던 기존 클라이언트가 있을 수 없으므로 400 으로의 전환은 실질적 breaking change 가 아니다. 프런트 소비처 grep 결과도 43필드 중 null 전송 지점 0건(plan §범위).
- **버전 관리**: 신규 엔드포인트·URL 변경 없음. 기존 PATCH 라우트의 입력 검증 강화(버그 수정)이며 버전 승격 대상 아님.
- **응답 형식**: 전부 기존 확립된 형식 `400 { error: { code: 'VALIDATION_ERROR', details: [{ field, ... }] } }` 로 수렴 — 신규 에러 코드·신규 응답 스키마 없음. `IsOptionalNonNull` 의 커스텀 메시지("$property must not be null — omit the field to keep the current value")도 class-validator 표준 메시지 치환 방식을 그대로 따른다(`optional-non-null.spec.ts` 로 검증됨).
- **에러 응답**: 500→400(31건) · 409→400(`nodes.label`) · 200(데이터 유실)→400(`triggers.endpointPath`) 전환 — 모두 더 적절한 상태 코드로 개선. `IsDefined` + 타입 검증기가 동시에 도는 것(예: `name: ['isDefined', 'isString']`)은 `details[].field` 존재 여부만 API 계약이 보장하면 되므로 문제 없음(e2e 는 `fields.toContain(field)` 만 검증).
- **요청 검증**: 신규 공용 데코레이터 `IsOptionalNonNull`(`codebase/backend/src/common/utils/optional-non-null.ts`)은 `class-validator`의 `IsOptional` 구현 패턴(`ValidateIf`)을 그대로 따르되 스킵 조건을 `undefined` 로만 좁혀 `null` 이 후속 타입 검증기까지 도달하게 한다. `whitelist: true` 하에서도 데코레이터가 등록돼 있어 필드가 제거되지 않음을 확인. 43필드 표는 단위 테스트(`src/repo-guards/__tests__/patch-null-rejection.spec.ts`)로 전수 고정되고, 대표 12라우트/33케이스는 e2e 로 이중 확인된다. nullable 컬럼(값 삭제 의미의 `null`)에는 데코레이터를 적용하지 않아 범위가 정확히 갈렸다(`description`·`parentId`·`ipWhitelist`·`containerId`·`toolOwnerId`·`authConfigId` 등 grep 대조로 확인).
- **URL/경로 설계**: 변경 없음(기존 PATCH 경로 그대로).
- **페이지네이션**: 해당 없음(목록 API 변경 없음).
- **인증/인가**: 변경 없음 — 이번 PR 은 요청 바디 검증 계층만 건드리며 가드/인터셉터 순서에 영향 없음.

## 요약

이번 변경은 PATCH 요청에서 NOT NULL 컬럼(또는 null 이면 서비스가 깨지는 값)에 대응하는 43개 필드에 대해 `@IsOptional()` → `@IsOptionalNonNull()` 로 바꿔, 종전 500/엉뚱한 409/조용한 데이터 삭제(200)를 일관된 `400 VALIDATION_ERROR` + `details[].field` 로 교정하는 순수 방어적 계약 강화다. nullable 컬럼(값 삭제 의미)의 필드들은 의도적으로 손대지 않아 범위가 정확하며, 단위(43필드 전수) + e2e(대표 33케이스) + 뮤테이션(M1~M4 KILLED)으로 검증됐다. 유일하게 남는 것은 API 규약 §5.4 PATCH tri-state 문장의 적용 범위 모호성인데, 이는 같은 세션의 consistency check 가 이미 발견해 planner 트래커에 등재했고 현재 이 모호성에 의존하는 실제 소비자가 없어 즉시 깨지는 계약은 없다. 하위 호환성·응답 형식·에러 코드·요청 검증 모든 축에서 breaking change 없이 기존 결함을 계약대로 교정한 변경으로 판단한다.

## 위험도

LOW
