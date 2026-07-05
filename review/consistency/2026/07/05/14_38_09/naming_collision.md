# 신규 식별자 충돌 검토 — spec/2-navigation/ (folder-depth-cycle-guard)

## 발견사항

- **[INFO]** `MAX_NESTING_DEPTH` 상수명이 서로 무관한 두 모듈에서 동일하게 사용됨
  - target 신규 식별자: `codebase/backend/src/modules/folders/folders.service.ts:10` `const MAX_NESTING_DEPTH = 5;` (워크플로우 폴더 계층 최대 중첩 깊이 — 본 target 이 검증 로직을 신설·강화한 대상)
  - 기존 사용처: `codebase/frontend/src/components/editor/expression/variable-picker.tsx:28` `const MAX_NESTING_DEPTH = 5;` (표현식 변수 피커의 JSON 트리 UI 펼침 깊이 — 폴더와 무관한 프론트엔드 전용 로컬 상수, 기존 코드)
  - 상세: 두 상수는 파일 스코프 `const`로 export 되지 않아 실제 import 충돌이나 런타임 혼선은 없다. 값도 우연히 동일(5)하지만 의미는 완전히 다르다(하나는 DB 엔티티 계층 깊이 제한, 다른 하나는 UI 트리 렌더 깊이 제한). spec 문서 어디에도 이 상수명이 노출되지 않으므로 API 계약·클라이언트 분기에는 영향이 없다. 다만 코드베이스 전체 grep 시(`grep -rn MAX_NESTING_DEPTH`) 두 도메인이 같은 이름으로 뒤섞여 나타나 검토자·신규 기여자가 순간적으로 오인할 여지가 있다.
  - 제안: 실질 위험은 낮으므로 변경을 강제할 필요는 없다. 다만 향후 리팩터 시 `FOLDER_MAX_NESTING_DEPTH` 처럼 도메인 접두어를 붙이면 grep 모호성이 해소된다. 이번 target 범위(backend 폴더 API)에서는 조치 불필요.

- **[INFO]** 폴더 계층 위반 에러코드는 프로젝트의 "시스템 전역 공용 코드" 예외 범주를 정확히 재사용 — 신규 세부 코드 미도입은 의도된 설계
  - target 신규 식별자: `folders.service.ts` 의 `VALIDATION_ERROR`(깊이 초과·자기부모·자손이동 등 3종 위반 전부에 재사용) — 신규 cycle 전용 코드는 만들지 않음
  - 기존 사용처: `spec/conventions/error-codes.md §1`(라인 41-43, `VALIDATION_ERROR` 는 prefix 없는 시스템 전역 공용 코드로 명시적 예외 범주) · `spec/5-system/3-error-handling.md`(`CYCLE_DETECTED` = 워크플로우 **그래프** 순환, `spec/1-data-model.md §2.6` `CONTAINER_CYCLE` = **Node** 컨테이너 체인 순환)
  - 상세: 코드 내 주석(`folders.service.ts:104-107`)이 명시적으로 "신규 cycle 코드를 도입하지 않아 `CONTAINER_CYCLE`(노드)·`CYCLE_DETECTED`(그래프)와의 혼동을 피한다"고 밝히고 있어, 이는 실수가 아니라 의도된 네이밍 회피다. 실제로 `CYCLE_DETECTED`는 workflow-assistant/shadow-workflow 도메인, `CONTAINER_CYCLE`은 노드 컨테이너 도메인으로 완전히 분리되어 있고 폴더 도메인이 이 두 코드 중 어느 것도 재사용하거나 새 유사 코드를 만들지 않아 충돌이 없다.
  - 제안: 조치 불필요. 오히려 모범 사례로 볼 수 있다 — 참고용으로만 기록.

- **[INFO]** `RESOURCE_NOT_FOUND` / `RESOURCE_CONFLICT` 재사용도 기존 카탈로그와 정합
  - target 신규 식별자: `folders.service.ts:32` `RESOURCE_NOT_FOUND` (폴더 미존재), spec §3.1 `RESOURCE_CONFLICT`(동일 부모 아래 이름 중복 409)
  - 기존 사용처: `spec/5-system/3-error-handling.md:58` `RESOURCE_NOT_FOUND` 카탈로그 등재, `spec/conventions/error-codes.md` 시스템 전역 공용 코드 범주
  - 상세: 둘 다 이미 카탈로그에 정의된 범용 코드이며 폴더 도메인이 새 의미를 부여하지 않고 정의 그대로 사용한다. 충돌 없음.
  - 제안: 조치 불필요.

## 요약

target(`spec/2-navigation/1-workflow-list.md §3.1` 및 `spec/1-data-model.md §2.5 Folder`)이 구현하는 폴더 깊이·순환 가드는 신규 요구사항 ID, 엔티티/DTO명(`Folder`/`FolderDto`/`CreateFolderDto`/`UpdateFolderDto`), API endpoint(`/api/folders*`), 에러 코드(`VALIDATION_ERROR`/`RESOURCE_CONFLICT`/`RESOURCE_NOT_FOUND`) 중 어느 것도 기존 spec·코드의 다른 의미와 충돌하지 않는다. 특히 순환(cycle) 관련 신규 세부 코드를 의도적으로 만들지 않고 기존 `CONTAINER_CYCLE`(노드)·`CYCLE_DETECTED`(그래프)와의 네임스페이스 혼동을 코드 주석으로 명시하며 회피한 점은 충돌 예방 관점에서 바람직하다. 유일하게 눈에 띄는 것은 `MAX_NESTING_DEPTH` 라는 파일-로컬 상수명이 무관한 프론트엔드 UI 모듈(표현식 변수 피커)과 우연히 동일한데, export 되지 않는 private const 라 실질적 충돌은 없고 grep 상 혼동 가능성만 있는 INFO 수준이다.

## 위험도

NONE
