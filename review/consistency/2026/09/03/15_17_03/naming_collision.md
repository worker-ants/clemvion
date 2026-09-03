# 신규 식별자 충돌 검토 — spec/5-system (impl-done)

## 검토 전제

- `spec/5-system` scope 델타: **0개 파일** — 이 PR 은 spec 을 변경하지 않는다. 즉 신규 요구사항 ID·엔티티/DTO 명·API endpoint·이벤트명·env var·spec 파일 경로 중 **spec 이 직접 새로 부여하는 식별자는 없다**.
- 구현 diff: 14개 파일 (backend, `null as unknown as X` 이중 캐스트 제거 + nullable 컬럼 타입 정합화 + 신규 가드/테스트 2개 파일). 이 diff 가 도입하는 코드 레벨 신규 식별자를 아래 6개 관점으로 개별 확인했다.

## 관점별 확인 내역

1. **요구사항 ID 충돌** — 신규 ID 없음(spec 미변경). 해당 없음.
2. **엔티티/타입명 충돌** — `User`, `Schedule` 엔티티에 신규 엔티티/타입 도입 없음. 기존 컬럼(`passwordHash`, `twoFactorSecret`, `emailVerifyToken`, `emailVerifyExpiresAt`, `passwordResetToken`, `passwordResetExpiresAt`, `lockedUntil`, `nextRunAt`)의 TS 타입을 `X` → `X | null` 로 넓힌 것뿐이며 컬럼명·의미는 불변. 신규 export 함수/상수(`countNullAsUnknownAsCasts`, `hasNullAsUnknownAsCast`, `SRC_ROOT`, `CastOffender`, `collectScanTargets`, `findCastOffenders`, `UntypedNullableColumn`, `findUntypedNullableColumns`)는 `codebase/backend/src/repo-guards/__tests__/` 및 `common/__test-utils__/source-scan.ts` 스코프의 내부 식별자다. 형제 가드 파일(`masked-reject-callers-guard.ts`, `audit-action-binding-guard.ts`, `redis-fail-open-catalog-guard.ts`, `engine-error-code-anchor-guard.ts`)의 export 목록을 grep 대조한 결과 이름 충돌 없음 — 각 가드는 파일 스코프 import 로만 소비되어 전역 네임스페이스 충돌 여지도 없다.
3. **API endpoint 충돌** — 신규/변경 endpoint 없음. diff 는 서비스 내부 대입문·엔티티 컬럼 타입·테스트만 건드린다.
4. **이벤트/메시지명 충돌** — 신규 webhook/queue/SSE 이벤트명 없음.
5. **환경변수·설정키 충돌** — 신규 ENV var·config key 없음.
6. **파일 경로 충돌** — 신규 파일 2개:
   - `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts`
   - `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts`

   기존 관례(`<주제>-guard.ts` + `<주제>.spec.ts` 쌍, 예: `masked-reject-callers-guard.ts`/`masked-reject-callers.spec.ts`, `engine-error-code-anchor-guard.ts`/`engine-error-code-anchor.spec.ts`)를 그대로 따르며 기존 파일과 이름이 겹치지 않는다. `plan/in-progress/entity-nullable-column-type-mismatch.md` 참조도 실재 확인됨(dangling 아님).

## 발견사항

없음 — 이 diff 가 도입하는 모든 식별자(함수/상수/파일 경로)는 기존 사용처와 겹치지 않으며, spec 델타가 0이라 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·env var 관점에서 애초에 신규 식별자 자체가 spec 레벨로 도입되지 않았다.

## 요약

본 PR 은 `spec/5-system` 을 변경하지 않는 코드 전용 리팩터(`null as unknown as X` 캐스트 제거 + nullable 컬럼 타입 정합화 + 신규 가드/테스트 2파일)이며, 신규로 도입된 코드 레벨 식별자(함수명·상수명·파일 경로)를 형제 가드 파일들과 대조한 결과 이름 충돌이나 명명 컨벤션 이탈이 발견되지 않았다. 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·환경변수 관점에서는 애초에 신규 도입이 없어 충돌 가능성이 원천적으로 없다.

## 위험도

NONE
