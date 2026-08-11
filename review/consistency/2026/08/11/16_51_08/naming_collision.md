# 신규 식별자 충돌 검토 — External Interaction API §3.3 에러 코드 3종

대상: `spec/5-system/14-external-interaction-api.md` §3.3(에러 코드 표) · §5.5(토큰 갱신)

## 확인 항목별 결과

1. **세 에러 코드 문자열이 코드에 실재하는가**
   - `TOKEN_REFRESH_FORBIDDEN` — `codebase/backend/src/modules/external-interaction/interaction.service.ts:224` (`code: 'TOKEN_REFRESH_FORBIDDEN'`), 테스트 `interaction.service.spec.ts:489`
   - `TOKEN_REFRESH_NOT_IN_WINDOW` — `interaction.service.ts:236`, `interaction.controller.ts:147` (`@ApiBadRequestResponse`), 테스트 `interaction.service.spec.ts:470`
   - `TOKEN_REFRESH_FAILED` — `interaction.service.ts:244`
   - 철자 3종 모두 정확히 일치. spec 이 코드와 다른 이름을 적은 지점 없음.

2. **다른 레이어에서 같은 문자열이 다른 뜻으로 쓰이는가** (`TOKEN_INVALID`/`TOKEN_EXPIRED` 선례와 대비)
   - repo 전체 grep(`codebase/`, `spec/`, `plan/`, `review/`) 결과, 세 문자열의 모든 사용처가 EIA `/refresh-token` 표면(§5.5)과 의미가 일치한다.
   - `codebase/packages/sdk/src/client.ts:312` 의 `parseJsonOrThrow<RefreshTokenResult>(res, 'TOKEN_REFRESH_FAILED')` 는 클라이언트 SDK 가 `refreshToken()` 응답 파싱 실패 시 쓰는 fallback 기본 코드인데, 이 또한 "refresh 실패"라는 동일 의미라 서버 정의와 charter 가 어긋나지 않는다 — 별개 뜻으로 쓰이는 사례 아님.
   - `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `review/code/2026/07/11/*/security.md`, `review/consistency/2026/08/11/11_10_16/cross_spec.md` 등도 전부 동일 의미로 참조.
   - `TOKEN_INVALID`/`TOKEN_EXPIRED` 류의 "워크스페이스 JWT ↔ EIA 동철자 공존" 패턴은 이 3종에는 재현되지 않는다 — 결론: 충돌 없음.

3. **`IEXT_REFRESH_WINDOW_SEC` 실재 여부 및 값**
   - `codebase/backend/src/modules/external-interaction/interaction-token.service.ts:39`: `const IEXT_REFRESH_WINDOW_SEC = 30 * 60; // 30min` — spec 의 "30분" 인용과 정확히 일치.

4. **§5.5 주석 인용 심볼 실재 여부**
   - `refreshPerExecution` — `interaction-token.service.ts:276`(정의) + `interaction.service.ts:231`(호출) + 테스트 다수. 실재.
   - `GoneException` — `@nestjs/common` 표준 클래스, `interaction.service.ts` 상단 import 및 라인 253/431 에서 `throw new GoneException(...)`. 실재.
   - `@ApiGoneResponse` — `@nestjs/swagger` 표준 데코레이터, `interaction.controller.ts` import + 라인 85/121/149 사용. 실재.
   - `interaction.service.ts` / `interaction.controller.ts` — 둘 다 `codebase/backend/src/modules/external-interaction/` 에 실재.
   - 죽은 참조 없음.

## 발견사항

없음 — 4개 확인 항목 모두 spec 인용과 코드 실체가 정확히 일치했고, 다른 레이어와의 신규 식별자 충돌도 발견되지 않았다.

## 요약

§3.3 이 새로 등재한 에러 코드 3종(`TOKEN_REFRESH_FORBIDDEN`/`TOKEN_REFRESH_NOT_IN_WINDOW`/`TOKEN_REFRESH_FAILED`)은 `interaction.service.ts`·`interaction.controller.ts`에 정확한 철자로 구현되어 있고, 다른 레이어에서 다른 의미로 재사용되는 충돌도 없다(SDK 의 동명 fallback 코드도 같은 의미). 인용된 상수 `IEXT_REFRESH_WINDOW_SEC`(30분)와 심볼(`refreshPerExecution`/`GoneException`/`@ApiGoneResponse`/두 파일 경로) 역시 모두 실재해 죽은 참조가 없다. 신규 식별자 충돌 관점에서 이번 target 변경은 문제 없음.

## 위험도
NONE

STATUS: OK
BLOCK: NO
