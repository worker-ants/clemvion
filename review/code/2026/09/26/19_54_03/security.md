# 보안(Security) 리뷰 — request-body-guard

## 검토 범위

이번 diff 는 실질적으로 다음 세 가지로 좁혀진다 — 나머지(`plan/**`, `spec/conventions/swagger.md`, `CHANGELOG.md`, `review/code/2026/09/26/19_32_47/**`, `review/consistency/2026/09/26/{18_59_58,19_09_17}/**`)는 문서·plan·이전 리뷰 라운드의 산출물로 실행 코드가 아니다.

1. `codebase/backend/src/common/pipes/validation.pipe.ts` — `toValidate()` 내부 지역 배열이었던 비검증 설계 타입 목록(`String, Boolean, Number, Array, Object`)을 값·순서·비교 방식 그대로 모듈 top-level `export const UNVALIDATED_METATYPES`(`Object.freeze` 로 동결)로 승격한 **순수 리팩터**. `transform()`/`toValidate()` 의 런타임 분기 자체는 바뀌지 않았다(직접 대조 완료).
2. `codebase/backend/src/repo-guards/__tests__/request-body-advertised{-guard,}.ts`, `codebase/backend/src/shared/testing/swagger-probe.ts`(`bodyArgIndexes` 신규 export) — 신규 **저장소 가드(Jest 기반 정적 검사, reflection)**. `@Body()` 자리의 `design:paramtypes` 가 비클래스인데 `@ApiBody` 가 없는 라우트를 찾아 CI 를 실패시킨다. `__tests__/`·테스트 헬퍼 경로이며 프로덕션 요청 경로에서 실행되지 않는다.
3. `spec/conventions/swagger.md` §5-4 체크리스트 한 줄 + Rationale 절, `CHANGELOG.md`, `plan/in-progress/{request-body-guard,spec-draft-swagger-request-body}.md` — 규약·근거 문서화.

직전 라운드(`review/code/2026/09/26/19_32_47/security.md`, 위험도 NONE)가 지적한 W1(`UNVALIDATED_METATYPES` 런타임 가변)은 `8bc7e8f19` 에서 `Object.freeze` + `Object.isFrozen` 단언(`validation.pipe.spec.ts`)으로 조치됐음을 실제 파일(`validation.pipe.ts:18-24`, `validation.pipe.spec.ts` `UNVALIDATED_METATYPES` describe 블록)로 직접 확인했다.

## 발견사항

- **[INFO]** 신설 가드는 "OpenAPI 문서화 존재"만 강제하고 "입력 검증"은 강제하지 않는다 — 기존(비변경) 설계 결정의 명문화
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.ts:34-40`(`transform` 의 `if (!metatype || !this.toValidate(metatype)) return value;`), `:18-24`(`UNVALIDATED_METATYPES`), `spec/conventions/swagger.md:750-766`(신설 Rationale 절)
  - 상세: `@Body()` 파라미터의 설계 타입이 `Object`/`String`/`Number`/`Boolean`/`Array`(인라인 객체 타입 · 인터페이스 · `unknown` · 원시 타입)이면 전역 `CustomValidationPipe` 가 `class-validator` 검증을 완전히 건너뛰고 원시 값을 그대로 통과시킨다. 이 동작은 이번 PR 이전부터 동일했고(순수 리팩터로 값 불변 확인), 이번에 추가되는 가드(`request-body-advertised`)는 그런 라우트에 `@ApiBody` 로 스키마를 "광고"하도록만 강제한다 — 검증을 강제하지 않는다. `@ApiBody({ schema: {} })` 로 면제되는 웹훅 수신류 라우트(`unknownDocumented` 픽스처가 그 패턴을 대표)는 광고 이후에도 본문이 검증 없이 그대로 통과한다는 뜻이다. 이는 spec Rationale(`swagger.md:755-766`)에 "클래스로 강제하면 계약이 깨진다(`INVALID_BOT_TOKEN` → `VALIDATION_ERROR`)"는 근거와 함께 명시적으로 채택된 트레이드오프이며, 새로 도입된 취약점이 아니다. 다만 "OpenAPI 에 스키마가 광고되니 검증도 된다"는 오인 위험은 신규 가드가 만드는 표면이므로 기록해 둔다.
  - 제안: 코드 조치 불요(스코프 밖, spec 근거 있음). `@ApiBody({ schema: {} })` 로 면제된 실제 라우트(웹훅 수신 등)의 다운스트림 처리가 원시 본문을 SQL/커맨드/경로 조합 등에 그대로 쓰지 않는지는 이번 diff 범위 밖이므로 별도 후속 감사 대상으로 남겨 둘 만하다.

- **[INFO]** 신규 가드·헬퍼는 소스 코드 내 리플렉션 메타데이터만 다루며 사용자 입력·네트워크 요청과 무관 — 인젝션/인증 우회 표면 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts`(`scanRequestBodyAdvertised`, `isExcluded`, `advertisesBody`), `codebase/backend/src/shared/testing/swagger-probe.ts`(`bodyArgIndexes`)
  - 상세: `Reflect.getMetadata` 대상은 전부 빌드 타임에 고정된 컨트롤러 클래스/메서드이고, Jest 전용 코드로 프로덕션 번들에 포함되지 않는다. `SWAGGER_API_PARAMETERS`/`SWAGGER_EXCLUDE_ENDPOINT`/`SWAGGER_EXCLUDE_CONTROLLER` 문자열 상수는 `@nestjs/swagger` 내부 메타데이터 키이며 시크릿이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** 하드코딩된 시크릿·자격증명 없음
  - 위치: 전체 diff(`CHANGELOG.md`, `validation.pipe.ts`, `validation.pipe.spec.ts`, `request-body-advertised{-guard,}.ts`, `swagger-probe{.ts,.spec.ts}`, `plan/**`, `spec/conventions/swagger.md`)
  - 상세: API 키·비밀번호·토큰·인증서 패턴을 찾지 못했다. 문자열 리터럴은 전부 리플렉션 메타데이터 키 · 에러 메시지 · 문서 텍스트다.
  - 제안: 조치 불필요.

- **[INFO]** `Object.freeze` 는 얕은 동결이나 이 경우 충분하다
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.ts:18-24`
  - 상세: 배열 원소가 전부 전역 생성자 함수 참조(`String`/`Boolean`/`Number`/`Array`/`Object`)이므로 얕은 freeze 로도 배열 자체에 대한 `.push`/`.splice`/인덱스 재할당을 전부 막는다 — 원소가 가변 객체였다면 얕은 freeze 로 불충분했겠지만 여기선 해당하지 않는다. `validation.pipe.spec.ts` 의 `Object.isFrozen` 단언과 파이프가 목록의 각 항목을 실제로 건너뛴다는 단언이 회귀를 잡는다.
  - 제안: 조치 불필요.

## 요약

이번 diff 는 런타임 요청 처리 로직을 사실상 바꾸지 않는다. 유일한 프로덕션 코드 변경(`validation.pipe.ts`)은 값 · 순서 · 비교 방식이 동일한 순수 리팩터이며, 직전 라운드에서 지적된 전역 가변 상태 우려(W1)도 `Object.freeze` + 회귀 테스트로 이미 조치됐다. 나머지는 OpenAPI 문서화 커버리지를 검사하는 Jest 전용 정적 가드(reflection, 프로덕션 미포함)와 spec/CHANGELOG/plan 문서다. 인젝션, 하드코딩 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 노출 등 전형적 취약점 표면은 이번 diff 에 새로 생기지 않았다. 유일하게 기록해 둘 점은 "본문 스키마를 광고"하는 것이 "본문을 검증"하는 것과 다르다는, 이미 spec Rationale 에 의도적으로 문서화된 기존 설계 트레이드오프이며 — `@ApiBody({ schema: {} })` 로 면제된 라우트의 다운스트림 처리가 안전한지는 이번 diff 범위 밖이라 별도 확인 대상으로 남는다.

## 위험도
NONE
