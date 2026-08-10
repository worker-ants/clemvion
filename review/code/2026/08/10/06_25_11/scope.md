# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 구현이 plan 에 적힌 "1줄 추가" 스케치보다 넓다 (순수 함수 + 커스텀 에러 메시지 + 신규 spec 파일 6 케이스)
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:78`(`assertAllUnique` 함수 정의), `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.spec.ts` 전체(신규 파일)
  - 상세: `plan/in-progress/auth-guard-reflection-hardening.md` 의 원래 항목(취소선 처리된 옛 버전, 예: "값 유일성 단언(`new Set([...]).size === 7`) 1줄 추가")은 인라인 1줄을 상정했으나, 실제 구현은 (1) `ALL_WS` export, (2) `assertAllUnique` 순수 함수 + 상세 에러 메시지, (3) 로드 시점 호출, (4) 이를 단위 테스트하는 신규 spec 파일(6 개 `it` 블록: 정상/중복/경계/배선-존재/ALL_WS 완전성)까지 확장했다.
  - 판단: scope-creep 이 아니라 **문서화된 의도적 확장**이다. 함수 docstring(`workspace-id-fixtures.ts:73-77`)과 spec 파일 상단 주석이 "인라인으로 두면 판정 로직 자체를 겨누는 테스트를 쓸 수 없다"는 근거를 명시하고, plan 체크리스트도 갱신된 문구로 이를 반영했다(`auth-guard-reflection-hardening.md:303-307`). 이 저장소의 기존 관례(부트 캐너리 등에서 "헬퍼 존재 ≠ 호출" 배선 검증 패턴)와도 일치한다.
  - 제안: 조치 불필요. 참고용 기록.

## 검증한 항목 (문제 없음)

- **changeset 완전성**: `git diff --stat origin/main...HEAD` 로 실측한 결과 이 PR 의 변경 파일은 정확히 프롬프트에 주어진 4개(`workspace-id-fixtures.spec.ts` 신규, `workspace-id-fixtures.ts`, `uuid.spec.ts`, plan md)뿐이다. `common/utils/uuid.ts`(두 파일이 SoT 로 지목하는 docstring 소유 파일)는 diff 에 없다 — 이번 PR 이전에 이미 존재하는 SoT 를 참조만 하는 것이라 무관한 파일 수정이 아니다.
- **plan 대응**: 두 파일 변경 모두 `plan/in-progress/auth-guard-reflection-hardening.md` 의 사전 등재된 두 개 후속 체크리스트 항목("공용 픽스처 모듈에 값 유일성 단언 추가", "nil-UUID 캐너리 정정 문단을 SoT 한 곳으로 모으기")과 1:1 대응한다. 두 항목 모두 이전 라운드에서 "Critical 0 로 수렴한 리뷰를 stale 시키지 않기 위해" 명시적으로 미뤄뒀던 것으로, 이번 diff 가 그 이행이다.
- **주석/문서 변경(`uuid.spec.ts`, `workspace-id-fixtures.ts` NIL_WS docstring)**: 중복 산문을 지우고 SoT 포인터로 축약한 것은 plan 항목 2 그 자체이며, 임의 삭제가 아니라 선별적이다(plan 은 "`uuid.spec.ts` 블록에 SoT 에 없는 사실 둘은 남겼다"고 명시하고, 실제 diff 도 "이 둘이 유일한 방어선" · "roles.guard.spec.ts 는 방어선으로 세면 안 된다" 문장을 보존하고 있음을 확인).
- **임포트**: 신규 spec 파일의 `node:fs`/`node:path` 임포트는 소스 파일을 직접 읽어 "로드 시점에 실제로 호출되는지"를 배선 검증하는 데 필요하며, 무관한 정리성 임포트가 아니다.
- **설정 파일**: 변경 없음(diffstat 확인).
- **포맷팅**: diff 훅이 실질 콘텐츠 변경과 일치하며 공백/개행만 바뀐 무의미 hunk 는 없다.

## 요약

이 변경은 이전 라운드(`auth-guard-reflection-hardening` plan)에서 명시적으로 등재·연기해 둔 정확히 두 개의 후속 항목("픽스처 모듈 값 유일성 단언", "nil-UUID 캐너리 정정 SoT 통합")만을 구현한다. `git diff --stat origin/main...HEAD` 로 확인한 changeset 4개 파일이 프롬프트에 주어진 4개와 정확히 일치해 숨은 파일 변경이 없고, 각 파일의 diff 내용도 plan 체크리스트 문구와 1:1 대응한다. 유일한 특이점은 구현이 plan 원문의 "1줄 스케치"보다 풍부(순수 함수 추출 + 전용 spec 파일)하다는 점인데, 이는 코드·plan 양쪽에 근거가 명시된 의도적 확장이라 scope 위반으로 보지 않는다.

## 위험도

NONE
