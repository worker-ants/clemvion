# 아키텍처(Architecture) Review

## 발견사항

- **[INFO]** 두 keyset 커서 디코더의 실패 계약 비대칭이 이 배치로 오히려 굳어진다
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:61` (`if (!isUuidShaped(id)) return null;`) / `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:178-180` (`if (!isUuidShaped(parsed.i)) { throw new Error(...) }`)
  - 상세: 같은 개념(keyset 커서의 id 성분 검증)에 대해 한쪽은 "무시하고 1페이지"(silent degrade), 다른 쪽은 "400 INVALID_CURSOR"(fail fast)로 응답한다. `spec/2-navigation/9-user-profile.md` 계열 API 컨벤션(`2-api-convention.md §8.2`)이 커서 페이지네이션을 opaque base64 + 실패 시 400 단일 표준으로 서술하는 것과도 어긋난다. 이번 diff는 이 비대칭을 **해소하지 않고 오히려 각 경로에 검증을 추가해 강화**했다 — 두 디코더가 이제 "제 계약대로 더 견고하게" 동작하므로 향후 통일 리팩터링의 관성 비용이 커진다.
  - 제안: 코드 자체는 문제없으나(둘 다 `plan/in-progress/keyset-cursor-uuid-validation.md §C`와 `spec-draft-nullable-notation-followups.md`에 planner 항목으로 이미 등재돼 있음), 이 리뷰에서도 가시성 확보 차원에서만 기록. 추가 조치 불요 — 이미 트래킹됨.

- **[INFO]** `isUuidShaped` 호출부 ↔ 회귀 캐너리 1:1 불변식이 도구가 아니라 산문(JSDoc + grep 안내)으로만 유지된다
  - 위치: `codebase/backend/src/common/utils/uuid.ts:16-58` (JSDoc, 특히 33-38행 "캐너리를 닫힌 목록으로 적지 않는다" 문단) / `codebase/backend/src/common/utils/uuid.spec.ts:49-77` (grep 명령이 담긴 docstring)
  - 상세: "새 소비처가 생기면 그 자리에 캐너리도 함께 둔다"는 불변식을 강제하는 장치가 없다 — CI가 `isUuidShaped(` 호출부 수와 캐너리 테스트 수를 대조하지 않는다. 실제로 이 배치 이전에 "호출부는 한 곳뿐"이라는 동일한 종류의 서술이 이미 한 번 낡아 반증됐고(§B 소비처가 3곳으로 늘며), 이번에도 재검증용 grep 명령 자체가 최초 실행에서 오류였다(`00_13_51` requirement WARNING). population이 작을 때(현재 3)는 사람이 감당할 수 있지만, 소비처가 늘수록 이 패턴은 반복적으로 stale해질 구조적 소지가 있다.
  - 제안: 이미 인지된 사안이며(`keyset-cursor-uuid-validation.md §"가드는 만들지 않는다"`) 정적 스캐너 도입은 population 2~3에서는 비용 대비 낮다고 판단해 의도적으로 보류함 — 타당한 트레이드오프. 다만 population이 이후 더 늘면(예: 4~5곳) 간단한 카운트 대조 스크립트(`grep -c` 두 곳 비교) 정도는 재고할 만하다는 점만 남겨둔다. 지금 라운드에서 조치 불요.

- **[INFO]** 공용 cursor 디코딩 로직이 여전히 두 서비스에 손으로 각각 구현돼 있다 (기존 구조, 이번 diff로 검증 로직만 추가)
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:45-63` (`decodeCursor` 모듈 레벨 함수, 파이프 구분 인코딩) / `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:149-188` (`decodeCursor` private 클래스 메서드, base64+JSON 인코딩)
  - 상세: 두 디코더가 인코딩 형식(파이프 구분 vs base64 JSON)뿐 아니라 정의 위치(모듈 함수 vs 클래스 private 메서드)까지 다르다. `isUuidShaped` 재사용으로 검증 로직 자체의 중복은 피했지만, "커서 디코드→검증→바인딩"이라는 동일한 책임을 진 두 구현체가 서로 다른 형태로 존재해 향후 세 번째 keyset 커서가 추가될 때 어느 패턴을 따를지 판단 기준이 없다.
  - 제안: `keyset-cursor-uuid-validation.md §C`에 "두 디코더가 손으로 각각 구현돼 있다"로 이미 등재되어 있고, 인코딩 차이 때문에 단순 추출이 아니라는 이유로 이번 배치 범위 밖으로 명시적으로 미뤄졌다 — 합리적 스코프 관리. 추가 조치 불요.

## 요약

이번 변경은 keyset 커서의 id 성분이 검증 없이 Postgres `uuid` 컬럼에 바인딩되어 SQLSTATE 22P02 → 500 마스킹으로 이어지던 두 입구(`login-history.service.ts`, `background-runs.service.ts`)에 공용 유틸리티(`isUuidShaped`)를 재사용해 조기 검증을 추가한 방어적 코딩이다. 계층 배치(공용 `common/utils` → 도메인 서비스, 순환 의존 없음), 의존 방향, SRP·OCP 관점에서 새로운 위반은 없다. `GlobalExceptionFilter`에 전역 22P02→400 분기를 넣는 대안을 검토했으나 "필터는 값의 출처를 모른다"는 기존 spec 원칙(`3-error-handling.md §1`, `12-workspace.md` UUID 검증 강도 비대칭 Rationale)에 근거해 기각하고 각 입구에서 개별 방어하는 저장소의 기존 전략을 일관되게 따른 점이 눈에 띈다. 유일한 구조적 아쉬움은 두 디코더의 실패 계약(무시 vs 400)이 통일되지 않은 채 이번 검증 추가로 오히려 굳어진다는 점과, 소비처-캐너리 1:1 불변식이 툴링이 아닌 산문으로만 유지된다는 점인데, 둘 다 이미 plan(`keyset-cursor-uuid-validation.md`, `spec-draft-nullable-notation-followups.md`)에 planner 항목으로 명시적으로 등재·추적되고 있어 이번 라운드에서 추가 조치를 요구하지 않는다.

## 위험도

LOW
