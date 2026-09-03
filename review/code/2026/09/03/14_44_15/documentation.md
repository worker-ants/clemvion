# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `collectScanTargets` docstring 의 "테스트 fixture 캐스트는 전부 정당하다(12건)" 근거가 같은 PR 의 타입 확장으로 부분적으로 낡았다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:27`
  - 상세: docstring 은 `*.spec.ts` 를 스캔 대상에서 뺀 근거로 "테스트 fixture 가 부분 객체를 엔티티로 캐스트하는 것은 정당하고 (2026-09-03 실측 12건)" 이라고 적는다. 저장소를 실제로 세어 보면 오늘 날짜 기준 `null as unknown as` 패턴이 `*.spec.ts` 에 정확히 12건 있어 숫자 자체는 맞다. 그런데 그중 `codebase/backend/src/modules/auth/auth.service.spec.ts:58` 의 `lockedUntil: null as unknown as Date` 는 바로 이 PR 이 `User.lockedUntil` 을 `Date | null` 로 넓히면서 **더 이상 필요 없는 캐스트**가 됐다 — `mockUser: Partial<User>` 이므로 이제 캐스트 없이 `lockedUntil: null` 만 써도 타입체크를 통과한다. 나머지 11건은 대상 필드/파라미터가 여전히 non-null 타입이라 캐스트가 그대로 정당하지만, 이 1건은 "정당한 fixture 캐스트" 목록에 포함된 채로 남아 docstring 의 "12건 모두 정당하다" 는 문구를 정확히 반증한다.
  - 제안: `auth.service.spec.ts:58` 의 캐스트를 `lockedUntil: null,` 로 정리하거나(사소한 후속 커밋), 그럴 여유가 없다면 docstring 에 "일부는 이번 배치의 타입 확장으로 이미 불필요해졌을 수 있다 — 개별 감사는 하지 않았다" 정도의 각주를 남겨 향후 배치 작업자가 12건을 맹신하지 않게 한다.

- **[INFO]** 이번 배치(타입 확장 8건 + 회귀 가드 신설)는 CHANGELOG 에 반영되지 않았다
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:71` (## 배치 1 — 캐스트를 강제하던 8필드 (완료))
  - 상세: 저장소 CHANGELOG.md 는 유사한 선례 — `Execution.error` 를 `nullable: true` 에 맞춰 `| null` 로 정정한 변경 — 를 다른 항목의 "부수로" 문단으로 남긴 전례가 있다. 이번 배치도 같은 클래스(엔티티 nullable 컬럼 vs TS 타입 불일치)를 8건 정정하고, 회귀를 막는 신규 가드(`nullable-type-lie-cast-guard.ts`/`.spec.ts`)까지 추가했다. 다만 이번 변경은 wire 응답 스키마·동작에 영향이 없는 순수 내부 타입 정합화라, CHANGELOG 의 기존 관례(주로 wire-facing/동작 변화를 기록)상 필수는 아니다.
  - 제안: 필수는 아니나, 이 batch 가 별도 PR 로 나간다면 "부수로" 한두 줄(예: "User/Schedule 의 nullable 컬럼 타입 8건을 정정하고, `null as unknown as X` 이중 캐스트 재발 방지 가드를 추가했다")을 남기는 것도 고려할 만하다 — 정확히 같은 클래스의 이전 정정이 CHANGELOG 에 남아 있어 독자가 "왜 이번엔 안 남겼지" 라고 물을 수 있다.

## 검증 메모 (뮤테이션/저장소 변경 없음)

이번 리뷰는 저장소 상태를 바꾸지 않고 `grep`/`python3 -c "json.load(...)"` 읽기 전용 검증만 수행했다. 확인한 수치·주장은 전부 코드와 일치했다:
- `common/__test-utils__/source-scan.ts` 의 "37파일 중 비-spec 0개" → `scripts/backend-typecheck-baseline.json` 의 `files` 37건, 전부 `.spec.ts` (실측 일치).
- `nullable-type-lie-cast-guard.ts` 의 "2026-09-03 실측 12건" → `*.spec.ts` 내 `null as unknown as` 패턴 정확히 12건 (실측 일치, 단 그중 1건은 위 INFO 참고).
- `source-scan.ts` docstring 의 "8건(User 7 · Schedule 1)" → `user.entity.ts` 7필드 + `schedule.entity.ts` 1필드 = 8, diff 와 정확히 일치.
- `secret-resolver.service.ts` 의 "종전의 `as unknown as string` 은…" 정리 이력 주석 실재 확인.
- `schedule-response.dto.ts` 의 `nextRunAt?: string | null` 은 이미 nullable 로 선언돼 있어, 이번 entity 타입 정정과 API 응답 계약 사이에 새로운 불일치가 생기지 않았다.
- `plan/in-progress/entity-nullable-column-type-mismatch.md` 가 배치 2 후보로 언급한 "`user.entity.ts` 잔여 3건"은 `avatarUrl`·`oauthProvider`·`oauthProviderId` 로 실제 일치 — 의도적으로 범위 밖에 남겨 둔 것이며 문서화도 정확하다.

## 요약

새로 추가된 `countNullAsUnknownAsCasts`/`hasNullAsUnknownAsCast`(source-scan.ts)와 신규 가드 `nullable-type-lie-cast-guard.ts`/`nullable-type-lie-cast.spec.ts`는 "왜 필요한가 · 왜 이 위치인가 · 무엇을 못 보는가"를 촘촘히 남긴, 이 저장소 관례에 부합하는 고품질 문서화다. 인용된 수치(37파일 비-spec 0개, 12건, 8건=User 7+Schedule 1)를 전부 실측 대조했고 전부 정확했다. `auth.service.ts`/`totp.service.ts`/`schedule-runner.service.ts`/`schedules.service.ts`/`users.service.ts`의 캐스트 제거는 순수 타입 표기 정리라 별도 주석이 필요 없고 기존 주석과도 충돌하지 않는다. 유일한 흠은 신규 가드 docstring 이 "spec fixture 캐스트 12건이 전부 정당하다"고 단언하는데 그중 1건(`auth.service.spec.ts:58`)이 같은 PR 의 타입 확장으로 이미 불필요해졌다는 점 — 기능에는 영향 없는 문서 정밀도 문제다. CHANGELOG 미기재도 저장소 관례상 필수는 아니어서 정보성으로만 남긴다. API 문서·README·설정 문서는 변경 범위(순수 내부 타입 정합화)상 갱신 대상이 아니다.

## 위험도

LOW
