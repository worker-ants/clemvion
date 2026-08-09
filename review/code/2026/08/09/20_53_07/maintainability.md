# 유지보수성(Maintainability) 리뷰

## 대상 커밋

`9b775e878033c993322bbcbe1df1ccbcd4ec1393` — "반증된 앵커 정정: nil-UUID 회귀 캐너리는 system-status e2e 가 아니다". 4개 파일 모두 **주석/문서/JSDoc 텍스트 교정**이며 실행 코드 로직 변경은 없다.

### 발견사항

- **[INFO]** 같은 "진짜 회귀 캐너리는 `uuid.spec.ts` 경계 테스트와 `workspace-context.util.spec.ts` nil UUID 테스트다(system-status e2e 가 아니다)" 라는 정정 설명이 4곳(소스 3곳 + plan 1곳)에 거의 동일한 문단으로 각각 다시 기술됨.
  - 위치: `codebase/backend/src/common/utils/uuid.ts:27-33`, `codebase/backend/src/common/utils/uuid.spec.ts:53-63`, `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:53-59`, `plan/in-progress/auth-guard-reflection-hardening.md:92-98`
  - 상세: 이 커밋 자체가 "동일한(반증된) 문장이 `codebase/` 3곳에 복제돼 있었다"는 문제를 고치는 커밋인데, 교정 과정에서 새로 쓴 정정 설명 역시 사실상 같은 문단이 4곳에 재복제됐다. plan 파일 스스로도 "한 문서 안에서 같은 주장이 두 번 나오면 두 곳을 함께 갱신해야 한다(이 저장소가 반복 학습한 클래스)"라고 자각하고 있는데, 그 교훈이 "복제 자체를 줄이자"가 아니라 "복제된 곳을 전부 찾아 동시에 고치자"로만 적용됐다. 다음에 이 근거(예: `RolesGuard` 단축 순서)가 바뀌면 4곳을 모두 다시 찾아 고쳐야 하고, 하나라도 놓치면 이번과 동일한 클래스의 stale 주석이 재발한다.
  - 제안: 상세 근거(왜 `system-status.e2e-spec.ts` 가 캐너리가 아닌지, 왜 이 두 단위 테스트가 진짜 캐너리인지)는 프로덕션 호출부에 가장 가까운 한 곳(`uuid.ts` 또는 `workspace-context.util.ts:74` 인근)에만 상세히 남기고, 나머지는 그 위치를 가리키는 1줄 포인터로 축약해 SoT 를 하나로 모은다. 이 파일들이 이미 "이름은 역할이고 값은 불투명하다"처럼 어휘를 한 곳에 고정하는 원칙을 쓰고 있으므로 동일 원칙을 주석 내용에도 확장할 수 있다.

- **[INFO]** `uuid.ts` 는 "> **앵커 정정 (날짜, 이슈 실측).**" 형태의 인라인 정정-이력 블록을 JSDoc 본문 중간에 남기는 반면, `uuid.spec.ts`·`workspace-id-fixtures.ts` 는 이력 인용 없이 텍스트를 조용히 재작성하는 방식을 택해 같은 교정에 대해 3개 파일이 서로 다른 스타일을 쓴다.
  - 위치: `codebase/backend/src/common/utils/uuid.ts:27-33` (인용 블록 스타일) vs `codebase/backend/src/common/utils/uuid.spec.ts:53-63`, `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:53-59` (재작성 스타일)
  - 상세: `uuid.ts` 의 방식은 "이 문단은 원래 X 를 지목했으나 실측으로 반증됐다"는 정정 이력을 코드 docstring 자체에 영구히 남긴다. 이런 패턴이 반복되면(이번이 이미 최소 두 번째 앵커 교체) JSDoc 이 "현재 사실을 설명하는 문서"가 아니라 "정정 변경 로그"로 누적돼 가독성이 저하될 수 있다. 커밋 메시지가 이미 배경·근거를 매우 상세히 남기고 있어 git blame/log 로 이력 추적이 가능하므로, 프로덕션 소스 docstring 까지 이력을 이중으로 보존할 필요성은 낮다.
  - 제안: 프로덕션 소스(`uuid.ts`)의 JSDoc 은 "현재 무엇이 맞는가"만 간결히 서술하고, "왜 예전엔 틀렸었는가"의 서사는 커밋 메시지에 위임한다. 또는 이 인용-블록 스타일을 3개 파일에 일관되게 적용해 스타일 자체를 통일한다(현재는 목적별 방침이 명시돼 있지 않아 향후 편집자가 임의로 하나를 고를 여지가 있다).

- **[INFO]** 순수 주석/문서 교정이라 로직·네이밍·함수 길이·중첩·매직넘버·복잡도 항목은 해당 사항 없음. `NIL_WS`·`isUuidShaped` 등 기존 코드 구조는 변경되지 않았고, 정정 내용은 실측(커밋 메시지에 근거 명시)에 기반해 정확하다.

### 요약

이번 변경은 순수 문서/주석 교정으로, 이전 PR(#1108)에서 반증된 "system-status e2e 가 nil-UUID 회귀 캐너리다"라는 주장을 소스 3곳과 plan 1곳에서 바로잡는다. 코드 로직에는 영향이 없고 교정 내용 자체는 근거가 탄탄하다. 다만 이 커밋이 고치는 문제(같은 주장이 여러 파일에 복제돼 일부만 갱신되는 drift)와 동일한 구조적 취약점이 교정문 자체에도 남아 있다 — 동일한 상세 설명이 4곳에 재복제됐고, 정정 표기 스타일도 파일마다 다르다. Critical/Warning 급 결함은 없으며, 향후 같은 앵커가 다시 바뀔 때의 유지보수 부담을 줄이려면 상세 근거를 한 곳(SoT)에 모으고 나머지는 포인터로 참조하는 편이 낫다.

### 위험도

LOW
