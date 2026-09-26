# 유지보수성(Maintainability) 리뷰 — forbidden-helper-sentences

## 발견사항

- **[INFO]** `forbiddenWithService(guard, service)` 는 두 인자가 모두 `string` 이라 순서를 바꿔 호출해도 타입체커가 잡지 못한다
  - 위치: `codebase/backend/src/common/swagger/forbidden-descriptions.ts:47` (`export function forbiddenWithService(guard: string, service: string): string`)
  - 상세: JSDoc(43~45행)이 "`guard` 는 위 두 헬퍼의 결과, `service` 는 호출자가 쓴 문장"이라고 순서를 문서화하지만, 강제하는 타입 경계는 없다. 지금은 13개 호출부 전부가 올바른 순서를 지키고(단위 테스트도 이 순서로 값을 고정) 있어 실질 위험은 낮다. 다만 향후 호출부가 늘어나면 인자 순서를 실수로 바꿔도 컴파일은 통과한다.
  - 제안: 지금 규모(호출부 13곳, 신규 헬퍼 1개)에서는 과설계가 될 수 있어 즉시 조치가 필요하진 않다. 굳이 강화한다면 `guard`/`service` 를 브랜드 타입으로 감싸거나, 최소한 헬퍼 자체의 단위 테스트에 "순서가 바뀌면 실패하는" 케이스 하나를 추가해 회귀를 문서화하는 정도로 충분하다.

- **[INFO]** `integrations.controller.ts` 의 두 모듈 상수가 같은 서비스 문장 텍스트를 그대로 반복한다 (리팩터 대상 밖, 사전에 알려진 상태)
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts:96-103` — `FORBIDDEN_MEMBER_OR_ORG_ADMIN` 과 `FORBIDDEN_EDITOR_OR_ORG_ADMIN` 이 둘 다 ``Organization 통합의 변경에 Admin 이상 권한 필요(${ROLE_REQUIRED.admin.code})`` 를 그대로 반복해서 쓴다.
  - 상세: 이 중복은 이번 diff 가 새로 만든 게 아니라 리팩터 이전 코드(`, 또는` 이음 시절)에도 이미 있던 것이고, plan 문서(`plan/in-progress/forbidden-helper-sentences.md` "안 하는 것" 절)가 "서비스 문장 표기의 전면 통일은 이번 PR 스코프 밖"이라고 명시적으로 defer 했다. 즉 의도된 스코프 좁히기이며 이번 리뷰가 새로 지적할 결함은 아니다.
  - 제안: 조치 불요. 다음에 이 두 상수 중 하나라도 다시 손댈 일이 생기면 서비스 문장 텍스트를 `const ORG_ADMIN_REQUIRED = ...` 같은 지역 상수로 뽑아 두 곳에서 참조하도록 하면 좋다는 정도의 참고 사항.

## 그 외 확인한 항목 (문제 없음)

- **네이밍**: `forbiddenForRole`(camelCase 함수) / `FORBIDDEN_NOT_A_MEMBER`(UPPER_SNAKE_CASE 상수) / `forbiddenWithService`(camelCase 함수) — 기존 파일의 명명 관례(동사형 함수·상수는 대문자)를 그대로 따른다. 새 식별자 `forbiddenWithService` 는 `forbidden<수식어>` 계열과 자연스럽게 어울린다.
- **함수 길이·복잡도**: `forbiddenWithService` 본문은 1줄 템플릿 리터럴이며 분기 없음 — 순환 복잡도 1. `forbidden-descriptions.ts` 전체가 여전히 50줄 이하로, 책임(가드 문장 생성 + 서비스 문장 이음)이 명확히 분리돼 있다.
- **중복 코드 제거**: 이번 diff 의 핵심 가치가 바로 이 항목이다 — 8곳에서 손으로 쓰던 ``${A}, 또는 ${B}`` 패턴과, 3곳에서 손으로 보간하던 가드 문장을 각각 `forbiddenWithService` / `forbiddenForRole` · `FORBIDDEN_NOT_A_MEMBER` 호출로 수렴시켰다. `auth.controller.ts`(다중 라인 문자열 리터럴 제거), `executions.controller.ts`(더 이상 안 쓰는 `NOT_A_MEMBER`·`ROLE_REQUIRED` import 제거)도 함께 정리돼, 죽은 참조를 남기지 않았다.
- **가독성**: 컨트롤러 쪽 호출부(`forbiddenWithService(forbiddenForRole('editor'), '...')`)는 구 코드의 백틱 보간 한 줄짜리 문자열보다 "가드 부분 + 서비스 부분"이 인자로 시각적으로 분리돼 있어 의도가 더 명확해졌다.
- **일관성**: 모듈 스코프 상수로 뽑는 패턴(`FORBIDDEN_OWNER_OR_PERSONAL`, `FORBIDDEN_EDITOR_OR_NOT_OWNER`, `FORBIDDEN_MEMBER_OR_ORG_ADMIN` 등)과 라우트에 인라인으로 쓰는 패턴이 공존하지만, 이는 "같은 문장을 여러 라우트가 재사용하는지"에 따른 기존 관례를 그대로 유지한 것이라 새로운 비일관성이 아니다.
- **테스트**: `forbidden-descriptions.spec.ts` 에 추가된 두 개의 `expect` 블록이 (1) 역할 문장 + 서비스 문장 조합, (2) 비멤버 상수 + 서비스 문장 조합을 모두 `toBe` 로 정확한 문자열 매칭한다 — 헬퍼의 이음 동작을 회귀 없이 고정한다.
- **매직 넘버/문자열**: 새로 추가된 코드에 의미 불명 상수는 없다. 서비스 문장에 남는 도메인 코드 문자열(`RR-PL-06`, `FORBIDDEN` 등)은 리팩터 이전부터 있던 것으로 이번 변경 범위 밖이다.
- **plan/review 산출물(파일 9~21)**: `plan/in-progress/forbidden-helper-sentences.md` 등은 애플리케이션 코드가 아닌 작업 추적·리뷰 산출물이며, 저장소 컨벤션(`review/**` 커밋 포함)에 따른 정상적인 부속 파일이라 유지보수성 관점에서 별도로 지적할 사항이 없다.

## 요약

이번 diff 는 "가드 문장은 손으로 안 쓴다 · 서비스 문장 이음은 한 곳에서 정한다"는 `spec/conventions/swagger.md` §5-4 규칙에 어긋나 있던 13개 자리를 공용 헬퍼(`forbiddenWithService`)로 수렴시킨, 스코프가 좁고 목적이 분명한 리팩터다. 새로 추가된 코드는 짧고(1줄 본문) 테스트로 뒷받침되며, 기존 네이밍·모듈 상수 관례를 그대로 따르고, 죽은 import 까지 함께 정리했다. 남은 지적은 두 건 모두 INFO 수준으로 — (1) 두 `string` 파라미터라 호출 순서를 타입이 강제하지 않는다는 이론적 위험, (2) `integrations.controller.ts` 의 서비스 문장 텍스트 중복은 plan 문서가 명시적으로 defer 한 기존 상태 — 실질적으로 병합을 막을 이유가 없다.

## 위험도

LOW
