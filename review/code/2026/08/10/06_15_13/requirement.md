# 요구사항(Requirement) 리뷰 — auth-guard-reflection-hardening 잔여 2건

## 리뷰 범위

- `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts` — nil-UUID 근거 SoT 통합(문서 축약) + `ALL_WS` 값 유일성 로드타임 가드 신설
- `codebase/backend/src/common/utils/uuid.spec.ts` — 같은 근거를 `uuid.ts` 로 포인터 축약(테스트 로직 자체는 무변경)
- `plan/in-progress/auth-guard-reflection-hardening.md` — 위 2건을 체크박스 완료로 갱신

이번 changeset 은 **테스트/문서 위생**(comment consolidation + 신설 런타임 유일성 가드)이며 프로덕션 동작 변경이 없다. `spec_impact: none` frontmatter 와 부합한다.

## 검증한 사실 (재현)

- `common/utils/uuid.ts` 를 직접 열어 확인 — `isUuidShaped` docstring 에 `#1112` 앵커 정정 문단이 실제로 존재하며, 두 파일이 포인터로 가리키는 SoT 내용과 정확히 일치한다.
- `workspace-id-fixtures.ts` 전체 파일을 열어 `ALL_WS` 배열이 모듈이 export 하는 7개 상수(`HEADER_WS`/`TOKEN_WS`/`VICTIM_WS`/`OTHER_WS`/`DECOY_WS`/`SAME_WS`/`NIL_WS`) 전부를 빠짐없이 포함함을 확인 — 락스텝 누락 없음.
- `isUuidShaped` 의 프로덕션 호출부를 전수 grep — `workspace-context.util.ts:74` 한 곳뿐임을 재확인(주석의 "유일한 방어선" 주장과 일치).
- **뮤테이션 재현**: `OTHER_WS` 값을 `VICTIM_WS`(`cccccccc-...`)와 동일하게 바꾼 뒤 관련 4개 spec(`uuid.spec.ts`, `workspace.decorator.spec.ts`, `roles.guard.spec.ts`, `workspace-context.util.spec.ts`) 실행 → 3개 suite 가 정확히 plan 이 적은 메시지("고유 6 / 전체 7")로 RED. 원상복구(`git checkout --`) 후 4개 suite 67 tests 전부 GREEN 재확인.
- `tsc --noEmit -p tsconfig.build.json` 통과 — `__test-utils__` 가 build 타입체크 대상에서 빠지지 않는다는 plan 의 전제(jest 타입 비의존)와 일치.
- `find ... __test-utils__` — 정확히 2곳(`common/__test-utils__`, `modules/integrations/__test-utils__`)만 존재, plan 이 미체크로 남긴 "3곳째 생기면" 트리거 미충족 판단과 일치.

## 발견사항

- **[INFO]** 유일성 가드는 `throw`(모듈 로드 시점)로 구현돼 있어 이 픽스처 모듈을 import 하는 모든 스위트가 값 충돌 시 동시에 실패한다 — 의도된 설계(주석에 명시)이고 실측으로도 확인됐다. 별도 조치 불요.
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:73`
  - 상세: fail-fast 설계라 어느 소비 스위트를 먼저 돌려도 즉시 드러난다는 장점이 있고, 에러 메시지가 "고유 N / 전체 M" 형태로 개수를 노출해 원인 좁히기를 돕는다(plan 주장과 실측 일치).
  - 제안: 조치 불요.

- **[INFO]** `uuid.spec.ts` 주석 축약 시 SoT(`uuid.ts`)에는 없는 사실 2가지("이 둘이 유일한 방어선" · "roles.guard.spec.ts 는 전역 라우트라 방어선으로 세면 안 된다")를 그대로 남겨둔 선별적 축약 — 삭제가 아니라 근거 중복만 제거한 것으로 확인됨.
  - 위치: `codebase/backend/src/common/utils/uuid.spec.ts:49-58` (게이트 50-57)
  - 상세: plan 체크리스트가 "전량 삭제가 아니라 선별이다" 라고 명시적으로 주장하는데, diff 를 line-level 로 대조한 결과 그 주장이 정확하다.
  - 제안: 조치 불요.

## 요약

세 파일 모두 실제 코드/문서 상태와 plan 체크리스트 서술이 line-level 로 일치한다. 신설된 값 유일성 가드는 뮤테이션 재현으로 실증된 대로 동작하며(값 충돌 시 정확한 메시지로 즉시 실패), 문서 SoT 통합도 정보 손실 없이(선별적으로) 이뤄졌다. 프로덕션 코드 변경이 없어 spec fidelity 관점에서 위반 소지가 없고(`spec_impact: none` 과 부합), TODO/FIXME 류 미완성 표식도 없다. 관련 4개 테스트 스위트(67 tests) 및 backend 전체 타입체크가 통과한다. 기능 완전성·에러 시나리오·반환값·엣지 케이스 모두 이 changeset 의 성격(테스트/문서 위생)에 비례해 적절히 처리됐다.

## 위험도

NONE
