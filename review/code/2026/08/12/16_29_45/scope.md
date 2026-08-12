# 변경 범위(Scope) 리뷰

## 검토 대상 5개 파일

1. `CHANGELOG.md`
2. `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
3. `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
4. `plan/in-progress/backend-lint-gate-broken-on-main.md`
5. `spec/data-flow/15-external-interaction.md`

## 변경 의도

Spec EIA §R8("캐시 대상은 2xx·409·410 의 닫힌 목록, 400 VALIDATION_ERROR 만 예외")과 어긋난
선재 결함 — `idempotency.interceptor.ts` 의 캐시 제외 조건이 `statusCode >= 400` 이라
409·410 까지 함께 캐시에서 빠지던 것을 `2xx || 409 || 410` 닫힌 목록으로 정정.

## 발견사항

### 검토한 항목 (문제 없음)

- **`idempotency.interceptor.ts` 핵심 로직 변경**: `if (statusCode >= 400) return;` →
  `isCacheable = (2xx) || 409 || 410` 3줄 조건 교체가 이 PR 의 유일한 런타임 동작 변경이다.
  위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (`cacheTapped`
  메서드, `tap` 콜백 내부). 함께 수정된 JSDoc(클래스 상단 캐시 대상 설명 + `cacheTapped` 메서드
  docstring + `IdempotencyEntry.responseJson` 필드 주석 + error 분기 인라인 주석)은 모두 방금
  해소한 선재 결함 설명("선재 결함이다", "여기서 구현이 Spec 보다 넓다")을 정정 후 상태로
  갱신하는 것으로, 코드 변경과 1:1 대응한다 — 무관한 주석 정리가 아니다.
- **`idempotency.interceptor.spec.ts` 테스트 변경**: 기존 "409 도 캐시되지 않는다 — R8 위반
  상태를 고정하는 캐너리" 테스트 1건을 제거하고, 정합 동작을 검증하는 4건("409 는 캐시된다",
  "410 도 캐시된다", "5xx 는 캐시하지 않는다", "401·404 같은 다른 4xx 도 캐시하지 않는다")으로
  교체했다. 4건 모두 §R8 의 닫힌 목록 경계(양쪽 오답 후보 `>= 400`/`=== 400`)를 각각 다른
  케이스로 가르는 회귀 테스트로, 스코프를 벗어나지 않는다. 다른 describe 블록(W-4 provider 경로,
  캐시 히트, Redis 런타임 장애 fail-open)은 무변경.
- **`CHANGELOG.md`**: diff 는 `@@ -1,5 +1,24 @@` 한 덩어리 — 파일 맨 위에 이번 변경을 설명하는
  새 절 하나만 삽입했다. 나머지 방대한 본문(웹채팅·auth guard·감사 로깅 등)은 기존 항목이며 이
  diff 의 일부가 아니다(전체 파일 컨텍스트로만 표시됨 — 오인 주의). 신규 절 자체의 서술 분량은
  이 리포지토리의 기존 CHANGELOG 항목들과 동일한 컨벤션(배경·spec 근거·클라이언트 영향 서술)을
  따른다.
- **`plan/in-progress/backend-lint-gate-broken-on-main.md`**: 이 PR 이 처분한 백로그 체크박스
  1건을 `[ ]` → `[x]` 로 바꾸고 완료 근거(뮤테이션 실측 표 포함)를 인용구로 추가했을 뿐, 다른
  체크박스·섹션은 무변경. `developer` 역할의 `plan/**` 쓰기 권한 범위 내 정상 추적 갱신이다.
- **`spec/data-flow/15-external-interaction.md`**: 표 한 행에서 "⚠️ 현행 구현은 `statusCode >=
  400` 전체를 제외해 409·410 이 재현되지 않는다 (선재 갭)" 캐비트 문구만 삭제했다 — 갭이
  해소됐으므로 SoT 를 실제 상태와 동기화하는 것이 정확한 처사다. 표의 다른 행·본문은 무변경.

### 포맷팅 · 임포트 · 설정

- import 변경 없음, 포맷팅-only 변경 없음, 설정 파일(`.env.example`, `package.json`, lint
  config 등) 변경 없음. 5개 파일 모두 diff 가 이번 목적과 직결된 최소 hunk 로 구성돼 있다.

## 요약

5개 파일(소스 1·테스트 1·CHANGELOG 1·plan 추적 1·spec SoT 1) 모두 "idempotency 캐시가 Spec EIA
§R8 의 닫힌 목록(2xx/409/410)과 어긋나던 선재 결함 수정" 이라는 단일 의도에 정확히 대응한다.
소스의 조건식 교체는 3줄, 나머지는 그 변경을 정합하게 설명·추적·검증하기 위한 문서·테스트
동기화이며 무관한 리팩토링·기능 확장·드라이브바이 수정은 발견되지 않았다.

## 위험도

NONE
