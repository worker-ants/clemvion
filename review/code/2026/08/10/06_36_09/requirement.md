# 요구사항(Requirement) 리뷰 — auth-guard-reflection-hardening 후속 (값 유일성 가드 + nil-UUID 캐너리 SoT 통합)

## 발견사항

- **[INFO]** `assertAllUnique(ALL_WS)` 는 로드 시점 런타임 검사이며, 그 로드베어링성을 실제로 뮤테이션 검증했다.
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:78` (함수 `assertAllUnique`), `:88` (로드 시점 호출)
  - 상세: 직접 재현 검증(`OTHER_WS` 값을 `VICTIM_WS` 와 동일하게 치환 후 `jest common/__test-utils__` 실행)에서 `workspace-id-fixtures.spec.ts` 스위트가 정확히 문서화된 메시지("고유 6 / 전체 7")와 함께 `Test suite failed to run` 으로 실패함을 확인했다. plan(`plan/in-progress/auth-guard-reflection-hardening.md:306-307`)의 뮤테이션 주장과 실측이 정확히 일치한다. `assertAllUnique` 는 모든 입력 경로(중복 없음/중복 있음/빈 배열/단일 원소)에서 적절한 값(반환 또는 throw)을 낸다.
  - 제안: 조치 불요 — 정보성 확인.

- **[INFO]** `workspace-id-fixtures.spec.ts` 의 "ALL_WS 가 export 된 UUID 상수 전부를 담는다" 테스트가 하드코딩 목록 방식의 이전 vacuous 실패(값이 우연히 7개로 일치)를 실제로 닫는다.
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.spec.ts:50-71`
  - 상세: `Object.values<unknown>(fixtures)` 로 네임스페이스를 순회해 UUID-shaped string 만 `flatMap` 으로 추출하는 방식은 새 상수가 추가돼도 spec 을 갱신할 필요가 없다는 주석의 의도와 실제 구현이 일치한다. `typeof v === 'string'` 가드로 `ALL_WS`(배열)와 `assertAllUnique`(함수)를 올바르게 배제하는 것도 확인했다(`jest` 로 14/14 통과 실측).
  - 제안: 조치 불요.

- **[INFO]** nil-UUID 캐너리 근거의 SoT 통합(`uuid.ts` docstring 으로 일원화) — line-level 로 정확하다.
  - 위치: `codebase/backend/src/common/utils/uuid.ts:16-41` (SoT), `codebase/backend/src/common/utils/uuid.spec.ts:49-58`, `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:47-51`
  - 상세: `uuid.ts` docstring 의 "앵커 정정(2026-08-09, `#1112`)" 문단이 `system-status.e2e-spec.ts` 대신 `uuid.spec.ts`·`workspace-context.util.spec.ts` 두 단위 테스트를 캐너리로 정확히 지목하고, 실제 프로덕션 호출부(`workspace-context.util.ts:74`)가 `isUuidShaped` 의 유일한 호출부임을 grep 으로 재확인했다(`common/utils/workspace-context.util.ts` 외 프로덕션 호출부 없음). `uuid.spec.ts` 에 남긴 "이 둘이 유일한 방어선" / "roles.guard.spec.ts 는 방어선으로 세면 안 된다" 문장은 SoT 에 없는 사실이라는 plan 의 주장(`plan/in-progress/auth-guard-reflection-hardening.md:311-314`)과도 부합한다 — 실제로 `uuid.ts` docstring 에는 이 두 문장이 없다.
  - 관련 spec: `spec/data-flow/12-workspace.md:375-405` (§"UUID 검증 강도 비대칭") 및 `spec/5-system/1-auth.md:405` 가 `isUuidShaped`/`isValidUuid` 비대칭·회귀 캐너리(두 단위 테스트)를 정확히 같은 내용으로 서술하고 있어 spec 본문과 코드 docstring/테스트가 line-level 로 일치한다. 불일치 없음.
  - 제안: 조치 불요.

- **[INFO]** plan 체크리스트(`auth-guard-reflection-hardening.md`)의 두 완료 항목 서술이 실제 diff·실측과 일치한다.
  - 위치: `plan/in-progress/auth-guard-reflection-hardening.md:303-314`
  - 상세: "값 유일성 단언 추가"·"nil-UUID 캐너리 SoT 통합" 두 `[x]` 항목의 서술(추가된 위치, 남긴/삭제한 문장, 뮤테이션 결과)을 코드와 대조해 과장·누락 없음을 확인했다. 남은 두 `[ ]` 항목(메모이제이션, `__test-utils__` 3곳째 exclude)은 명시적으로 조건부 defer 로 남아 있고 이번 diff 범위 밖이다.
  - 제안: 조치 불요.

## 요약

이번 changeset 은 순수 백엔드 테스트/문서 위생 변경으로, (1) 공용 픽스처 모듈에 로드 시점 값-유일성 가드(`assertAllUnique`)와 이를 겨냥한 5개 유닛테스트를 신설하고, (2) nil-UUID 회귀 캐너리 근거/앵커의 중복 서술을 `uuid.ts` docstring 한 곳(SoT)으로 통합했다. 직접 재현한 뮤테이션 테스트(`OTHER_WS`↔`VICTIM_WS` 값 충돌)로 신설 가드의 로드베어링성을 실측 확인했고, `jest`로 대상 두 스위트(14 테스트) 전부 통과함을 확인했다. `isUuidShaped` 의 유일 프로덕션 호출부(`workspace-context.util.ts:74`)와 spec 본문(`spec/data-flow/12-workspace.md`, `spec/5-system/1-auth.md`)의 캐너리 지목이 코드 docstring/테스트 제목과 line-level 로 정확히 일치함을 확인했다. TODO/FIXME/HACK/XXX 없음, 반환값·경계값(빈 배열/단일 원소) 처리 명시적으로 테스트됨, 함수명·주석과 구현 간 괴리 없음. CRITICAL/WARNING 발견사항 없음.

## 위험도

NONE
