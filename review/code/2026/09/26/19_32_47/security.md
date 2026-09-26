# 보안 리뷰 — request-body-guard

## 검토 범위

이번 변경은 런타임 요청 처리 로직을 사실상 건드리지 않는다. 실질은 다음 세 가지다.

1. `codebase/backend/src/common/pipes/validation.pipe.ts` — `toValidate()` 내부에 있던 비검증 설계 타입 목록(`String, Boolean, Number, Array, Object`)을 동일한 값 그대로 `export const UNVALIDATED_METATYPES`로 끌어올린 **순수 리팩터**(`!types.includes(metatype)` → `!UNVALIDATED_METATYPES.includes(metatype)`). 검증 로직·값 집합 모두 변경 없음.
2. `codebase/backend/src/repo-guards/__tests__/request-body-advertised{-guard,}.ts` — 신규 **저장소 가드(Jest 기반 정적 검사)**. `@Body()` 파라미터의 설계 타입(`design:paramtypes`)이 클래스가 아닌데 `@ApiBody`가 없는 라우트를 reflection으로 찾아 테스트 실패시킨다. 프로덕션 요청 경로에서 실행되지 않는다.
3. `spec/conventions/swagger.md` / `CHANGELOG.md` / `plan/**` / `review/consistency/**` — 문서·규약·plan·이전 consistency 리뷰 산출물. 코드 실행과 무관.

`codebase/backend/src/shared/testing/swagger-probe.ts`도 테스트 전용 헬퍼(`bodyArgIndexes` 추출)로, 프로덕션 코드에서 import되지 않는다.

## 발견사항

- **[INFO]** 이 가드는 "문서화 커버리지"만 보장하고 "입력 검증"을 보장하지 않는다 — 기존에 이미 존재하던 설계 결정
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.ts` (`UNVALIDATED_METATYPES`, `toValidate`), `spec/conventions/swagger.md` §5-4 신설 절("왜 클래스로 받게 강제하지 않고…")
  - 상세: `@Body()` 파라미터의 설계 타입이 `Object`/`String`/`Number`/`Boolean`/`Array`(인라인 객체 타입·인터페이스·`unknown`·원시 타입)이면 전역 `CustomValidationPipe`가 `class-validator` 검증을 **완전히 건너뛰고 원시 값을 그대로 통과**시킨다(`transform()`의 `if (!metatype || !this.toValidate(metatype)) return value;`). 이번 PR이 추가하는 가드(`request-body-advertised`)는 이런 라우트에 `@ApiBody`로 스키마를 "광고"하도록만 강제할 뿐, 검증을 강제하지 않는다 — Rationale·spec 양쪽에 의도적 트레이드오프로 명시돼 있고(계약 변경 회피), 목록 자체도 이번 PR 이전부터 동일했다(순수 리팩터). 따라서 **새로 도입된 취약점은 아니다.** 다만 OpenAPI에 스키마가 "광고"되면 다음 개발자가 "문서화됐으니 검증도 된다"고 오인할 위험이 있다는 점은 기록해 둘 가치가 있다 — 실제로 `unknown` + `@ApiBody({ schema: {} })`로 광고되는 웹훅 수신 라우트(`receiveWebhook`)는 본문이 검증 없이 그대로 통과한다는 뜻이다. 이 라우트들이 이후 그 원시 본문 값을 SQL/커맨드/경로 조합 등에 그대로 사용하는지는 이번 diff 범위 밖이라 확인하지 않았다.
  - 제안: 코드 변경 요구는 없음(스코프 밖 사전 결정, spec Rationale 근거 있음). 다만 `@ApiBody({ schema: {} })`로 면제된 라우트들(웹훅 수신 등)의 다운스트림 처리가 실제로 검증/새니타이즈를 별도로 하는지는 별도 후속 감사 대상으로 남겨둘 만하다.

- **[INFO]** 신규 가드·헬퍼는 순수 reflection/메타데이터 판정이며 사용자 입력을 다루지 않음 — 인젝션·인증 우회 표면 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts` (`scanRequestBodyAdvertised`), `codebase/backend/src/shared/testing/swagger-probe.ts` (`bodyArgIndexes`)
  - 상세: `Reflect.getMetadata` 호출 대상은 전부 소스 코드 내 컨트롤러 클래스/메서드(빌드 타임에 고정된 값)이며, 외부 입력이나 네트워크 요청과 무관한 Jest 전용 코드다. 프로덕션 번들에 포함되지 않는다(`__tests__/` 경로, `*.spec.ts` 소비처).
  - 제안: 조치 불필요. 참고용 기록.

- **[INFO]** 하드코딩된 시크릿·자격증명 없음
  - 위치: 전체 diff(`CHANGELOG.md`, `validation.pipe.ts`, `request-body-advertised{-guard,}.ts`, `request-body-advertised.spec.ts`, `swagger-probe.ts`, `plan/**`, `review/consistency/**`, `spec/conventions/swagger.md`)
  - 상세: API 키·비밀번호·토큰·인증서 패턴 없음. `SWAGGER_API_PARAMETERS` 등 상수는 `@nestjs/swagger` 내부 메타데이터 키 문자열(`'swagger/apiParameters'` 등)이며 시크릿이 아니다.
  - 제안: 조치 불필요.

## 요약

이번 PR은 런타임 요청 처리를 변경하지 않는다 — 기존 검증 로직(비검증 설계 타입 목록)을 값 변경 없이 상수로 추출했고, 나머지는 OpenAPI 문서 커버리지를 검사하는 Jest 전용 정적 가드·spec 문서·plan/리뷰 산출물이다. 인젝션, 하드코딩 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 노출 등 전형적 취약점 표면이 이번 diff에 새로 생기지 않았다. 유일하게 기록해 둘 점은, 신설 가드가 "문서화 존재"만 강제하고 "입력 검증"은 강제하지 않는다는 기존(비변경) 설계 결정이 이 PR로 명문화된다는 것 — 인라인/`unknown` 타입 본문(`@ApiBody`로 광고되지만 class-validator를 건너뛰는 라우트)의 다운스트림 처리가 안전한지는 이번 diff 범위 밖이라 별도 확인이 필요할 수 있다.

## 위험도

NONE
