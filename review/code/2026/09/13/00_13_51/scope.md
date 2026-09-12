# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 두 커서 디코더에 근거 주석(22P02→500 마스킹 메커니즘, `isUuidShaped` 선택 이유, spec Rationale 인용)이 거의 동일하게 ~12줄씩 복제됨
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:53-64`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:165-177`
  - 상세: 검증 로직 자체(한 줄 `isUuidShaped` 호출)는 공용 유틸 재사용이라 중복이 아니지만, 산문 설명 블록은 두 파일에 사실상 동일하게 들어갔다. 다만 이는 저자가 이미 자각하고 있다 — `plan/in-progress/keyset-cursor-uuid-validation.md` 체크리스트(2라운드 `/ai-review` 처분표 #4)와 `plan/in-progress/spec-draft-nullable-notation-followups.md`(신규 항목 "두 keyset 커서 디코더에 같은 근거 주석이 복제됐다")에 INFO 로 이미 등재돼 있고, "주석-only 라 이번 배치 수렴 기준(동작·커버리지·계약)에 안 걸린다"는 처분 근거도 함께 적혀 있다.
  - 제안: 별도 조치 불필요 — 이미 트래커에 등재되어 있으므로 중복 지적으로 취급하지 않는다.

- **[INFO]** `codebase/backend/src/common/utils/uuid.spec.ts` 의 docstring 이 변경됨
  - 위치: `codebase/backend/src/common/utils/uuid.spec.ts:53-69` (교체 전 원문은 diff 상 게이트 없음 — 삭제된 줄)
  - 상세: 테스트 로직(assertion)은 변경 없이 주석만 확장됐다. 그러나 이 변경은 본 PR 자체가 `isUuidShaped` 소비처를 1곳→3곳으로 늘렸기 때문에 발생한 필연적 결과다 — 기존 docstring 이 "호출부는 한 곳뿐"이라고 못박아 뒀는데 이 PR 의 코드 변경이 그 문장을 거짓으로 만들었으므로, 정정하지 않으면 문서가 코드보다 좁아진다. 새 docstring 은 하드코딩된 개수 대신 `grep` 재현 명령을 남겨 향후 드리프트를 스스로 경고하게 했다.
  - 제안: 조치 불필요 — 진단용 주석 변경이 diff 범위(신규 호출부 2곳 추가)에 직접 종속돼 있다.

- **[INFO]** `login-history.service.spec.ts` 의 기존 테스트 fixture 값 변경(`'cursor-id'` → `CURSOR_UUID`)
  - 위치: `codebase/backend/src/modules/auth/login-history.service.spec.ts:152-160` (변경 전 값은 게이트 없는 삭제 줄)
  - 상세: 요청 범위를 벗어난 "정리성" 변경처럼 보일 수 있으나, 인접 주석(148-150행)이 근거를 명시한다 — 이 fixture 가 비-UUID 값을 `lh.id`(uuid 컬럼)에 바인딩하는 것을 "정상"으로 고정하고 있었고, 새 검증 로직 도입 후에는 이 fixture 자체가 새로 추가된 검증에 의해 걸러져 원래 테스트 의도(커서 필터링 검증)를 수행할 수 없게 되므로 값 교체가 필연적이다. 새로운 로직과 직접 결합된 최소 수정이다.
  - 제안: 조치 불필요.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 신규 백로그 항목 5건이 이번 diff 로 함께 추가됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:3168-3211` (계약 비대칭·주석 복제·디코더 중복·에러코드 카탈로그 갭 2건·§1.6 각주 불일치)
  - 상세: 실제 코드/스펙을 고치는 대신 "등재만" 하는 항목들이며, 각 항목에 `(developer, 2026-09-12 등재 …)` 로 출처와 판단 근거가 명시돼 있다. 프로젝트 컨벤션(`developer` 는 spec 변경 불가 → planner 항목으로 위임)에 정확히 부합하는 절차이므로 스코프 일탈이 아니라 오히려 스코프를 지키기 위한 필요 조치다.
  - 제안: 조치 불필요.

## 요약

핵심 변경은 두 keyset 커서 디코더(`login-history.service.ts`, `background-runs.service.ts`)의 id 성분에 대해 기존에 이미 존재하던 `isUuidShaped` 유틸을 재사용해 검증을 추가하는 것으로, 각 서비스 파일 diff 는 import 1줄 + 검증 1줄 + 근거 주석으로 국한돼 있고 새 유틸리티나 가드를 만들지 않기로 한 결정 근거까지 plan 문서에 명시돼 있다. 나머지 파일 변경(테스트 4개 파일, e2e 2개 파일, CHANGELOG, plan 문서 2개)은 전부 이 두 줄짜리 핵심 변경을 회귀 테스트로 고정하거나, 관측 가능한 동작 변경을 문서화하거나, 착수 시점 트래커 항목을 실측 결과에 맞춰 정정(취소선 보존)하는 데에 국한된다. 무관한 파일 수정, 임포트 불필요 추가, 포맷팅 드리프트, 요청 범위를 넘는 리팩토링이나 기능 확장은 발견되지 않았다. 유일하게 언급할 만한 점(주석 복제)은 저자 스스로 이미 트래커에 INFO 로 등재하고 처분 근거까지 남겨 두었으므로 추가 조치가 필요 없는 수준이다.

## 위험도

NONE
