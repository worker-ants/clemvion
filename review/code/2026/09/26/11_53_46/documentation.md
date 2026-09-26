# 문서화(Documentation) 리뷰 — `forbidden-desc-codes`

## 발견사항

- **[INFO]** `lowestRequiredRole` 시그니처가 `readonly string[]`(WorkspaceRoleName 아님)인 이유가 JSDoc에서 암묵적
  - 위치: `codebase/backend/src/common/constants/workspace-roles.ts:36` (함수 시그니처), 관련 문서: `:27`-`:35` (JSDoc)
  - 상세: JSDoc은 "`@Roles(...)` 가 `WorkspaceRoleName` 만 받아 컴파일에서 막힌다" 고 설명하는데, 정작 `lowestRequiredRole` 자신의 매개변수 타입은 `WorkspaceRoleName[]`이 아니라 더 넓은 `readonly string[]`이다. 실제로는 두 번째 호출자인 `forbidden-response-codes-guard.ts:127`의 `guardRejectionCodes`가 `Reflect.getMetadata(ROLES_KEY, ...)`로 읽은, 타입 소거된 `string[]`을 넘기기 때문에 넓은 타입이 필요하다(그 호출부는 `Object.hasOwn(ROLE_REQUIRED, threshold)`로 서열 밖 결과를 방어한다). 이 이유가 JSDoc에는 나타나지 않아, 읽는 사람이 "컴파일에서 막힌다"는 문장과 실제 시그니처가 왜 다른지 한 번 더 소스를 뒤져야 한다. 코드 자체는 정확하고 두 호출자·테스트(`lowestRequiredRole(['admin', 'superadmin'])`)가 이 넓은 계약을 검증하고 있어 결함은 아니다.
  - 제안: JSDoc에 "reflection 소비처(`forbidden-response-codes-guard.ts`)는 타입 소거된 문자열을 넘기므로 시그니처를 `string[]`으로 넓혔다" 한 문장을 추가하면 다음 독자가 타입 불일치를 재차 의심하지 않아도 됨. 선택 사항(현재도 오독 소지는 낮음).

## 점검 결과 요약 (근거)

- **독스트링/JSDoc**: `lowestRequiredRole`, `forbiddenForRole`, `FORBIDDEN_NOT_A_MEMBER`, `ROLE_SHORTFALL`, 신설 가드 `forbidden-response-codes-guard.ts`의 모든 export(`loadControllers`, `collectRouteHandlers`, `guardRejectionCodes`, `scanForbiddenResponseCodes` 등) 전부 목적·분기·예외 조건을 설명하는 JSDoc을 갖춤. `roles.guard.ts`의 `RolesGuard` 클래스독스트링도 `lowestRequiredRole` 도입에 맞춰 갱신되어 있다(§"거부 코드" 절이 `EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED` 산출 규칙을 그대로 반영). 위 INFO 1건 외 누락 없음.
- **README 업데이트**: 이 변경은 문서 문장(403 설명)만 바꾸고 신규 기능·설정이 아니므로 README 업데이트 대상 아님. 실제로 README 변경 없음 — 적절.
- **API 문서**: 이번 변경 자체가 API 문서(OpenAPI `@ApiForbiddenResponse` description) 갱신이 본체다. `spec/conventions/swagger.md` §5-4 본문이 "가드가 낼 수 있는 거부 코드를 전부 싣는다"는 새 규칙과 헬퍼 사용법으로 갱신되었고, §Rationale에 "§5-4 403 설명의 거부 코드 — 왜 두 코드이고 왜 가드로 세는가 (2026-09-26)" 섹션이 신설되어 두 후보안((가)/(나)) 비교와 실측 수치(157곳 중 129곳)까지 기록됨. `spec/data-flow/12-workspace.md`의 "가드 거부의 오류 코드" 앵커도 실재해 상호 참조가 깨지지 않는다. 129곳 컨트롤러 전수를 직접·grep으로 대조해 모두 헬퍼로 치환되었고 stale한 로컬 상수(`workspaces`의 `FORBIDDEN_*_ROUTE`, `integrations`의 `FORBIDDEN_MEMBER`)도 제거되어 잔존 문서 불일치 없음.
- **주석 정확성**: 코드-주석 일치 여부를 중점적으로 대조함 — `roles.guard.ts`의 `assertMember` 내 "서열 0 인 미등록 문자열은 문턱이 될 수 없어 threshold 는 늘 등록된 역할이다" 주석은 `@Roles()`가 컴파일 타임에 `WorkspaceRoleName[]`만 받는다는 전제와 정확히 부합(호출 경로 추적으로 확인). `forbidden-response-codes-guard.ts`의 대응 주석("서열 밖 문자열이 문턱이면 가드는 요구를 충족한 것으로 본다")도 리플렉션으로 읽은 타입 소거된 문자열에 대한 방어적 분기와 일치. `integrations.controller.ts`의 "거부 코드는 공유 거부 표의 `.code` 를 보간한다" 주석도 헬퍼 도입 후에도 여전히 유효(부분적으로 헬퍼가 그 보간을 대신 수행). 33개 파일 diff 전수를 살펴본 결과 stale comment(치환 전 리터럴 문자열을 언급하는 주석)가 하나도 남지 않음.
- **인라인 주석**: `lowestRequiredRole`/가드 스캐너의 복잡한 분기(`@Public` 예외, 경로 파라미터 워크스페이스, 클래스-핸들러 메타데이터 우선순위, viewer=멤버십 특수 케이스)마다 근거 있는 인라인 주석 또는 JSDoc이 붙어 있음. `forbidden-response-codes.spec.ts`의 "모델 캐너리"(실제 `RolesGuard` 를 fixture 에 돌려 모델과 대조)에 대한 설명도 왜 필요한지(F7 뮤턴트 생존 이력)까지 포함해 상세함.
- **변경 이력(CHANGELOG)**: `CHANGELOG.md`에 이번 변경에 대응하는 두 항목이 이미 존재 — "403 응답 설명이 가드 거부 코드를 싣는다 (129개 라우트)"와 "저장소 가드: 403 설명이 가드가 낼 수 있는 거부 코드를 담는다". 두 항목 모두 CHANGELOG 상단 기준(제품 동작 변화·개발 흐름 가드 신설)에 해당하고, 실제 diff 내용(129곳 교체, 헬퍼 도입, reflection 가드 신설, 베이스라인 0)과 수치·서술이 일치함. 누락 없음.
- **설정 문서**: 새 환경변수·설정 옵션 없음 — 해당 사항 없음.
- **예제 코드**: `forbidden-descriptions.spec.ts`(4개 테스트)와 `forbidden-response-codes.spec.ts`(대조군 fixture 컨트롤러 2개 + 모델 캐너리)가 헬퍼·가드의 사용법을 보여주는 예제 역할을 충분히 수행. `workspace-roles.spec.ts`에 추가된 `lowestRequiredRole` 테스트도 순서 무관성·서열 밖 문자열 케이스를 포함해 계약을 명확히 보여줌.

## 요약

문서화 관점에서 이 변경은 모범적인 수준이다. 새로 추가된 함수·상수·가드 전부에 목적·근거·예외를 설명하는 JSDoc이 있고, `spec/conventions/swagger.md` §5-4 본문과 신설 Rationale 섹션, `spec/data-flow/12-workspace.md`와의 상호 참조가 모두 실재하며 코드와 정합한다. CHANGELOG는 제품 동작 변화와 가드 신설 두 항목을 정확한 수치와 함께 이미 담고 있다. 129곳의 컨트롤러 치환 전수를 대조했을 때 stale 주석이나 미치환 잔존 상수가 없다. 유일한 지적은 `lowestRequiredRole`의 매개변수 타입이 JSDoc의 "컴파일에서 막힌다" 서술보다 넓은 이유(리플렉션 소비처 존재)가 JSDoc에 명시되지 않은 INFO 수준의 사소한 설명 공백이며, 결함이 아니라 가독성 개선 여지다.

## 위험도

NONE
