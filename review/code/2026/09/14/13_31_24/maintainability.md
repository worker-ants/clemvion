# 유지보수성(Maintainability) 리뷰

## 검토 범위

이번 라운드(`review/code/2026/09/14/13_31_24`)는 `trigger-canary-hardening` 배치의 누적 diff
(`origin/main...HEAD`, 코드 6개 TS 파일 + plan 문서 4개 + 이전 라운드 `review/**` 산출물 다수)를
대상으로 한다. 실질 코드 변경은 여전히 다음 6개 파일이다.

- 신규 repo-guard 쌍: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts`
  (순수 AST 파싱 로직) + `trigger-secret-columns.spec.ts` (소비 spec)
- `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` — 헤더 docstring 표기 정리
  (원문자→아라비아 숫자, "다섯 자리" 수치 서술을 SoT 단일화로 대체)
- `codebase/backend/test/{chat-channel-trigger-create,schedule-trigger,trigger-workflow-ref}.e2e-spec.ts`
  — 주석 정정 + 기존 헬퍼 `expectTriggerWorkflowRef` 호출 3곳 추가

직전 라운드(`review/code/2026/09/14/13_04_49`)에서 이미 6명(maintainability 포함) NONE, WARNING 1건
(documentation, `trigger-workflow-ref.spec.ts` 의 자리 수 불일치)만 있었고, 그 후 커밋
(`7420cede1`, 라운드 5)이 실제로 건드린 코드는 다음 두 곳뿐이다(`git diff 7420cede1^ 7420cede1 --
codebase/` 로 직접 확인).

1. `trigger-secret-columns.spec.ts` — `tmp: string` 을 `string | undefined` 로 바꾸지 않기로 한
   판단을 설명하는 주석 8줄 추가(로직 변경 없음).
2. `trigger-workflow-ref.spec.ts` — 헤더 docstring 에서 "다섯 자리" 수치를 제거하고 e2e 파일을
   SoT 로 가리키는 문장 6줄 추가(로직 변경 없음).

두 변경 모두 **주석/문서 전용**이라 함수 길이·중첩·순환 복잡도에 영향이 없다. `plan/**` 4개
문서와 `review/code/**`·`review/consistency/**` 다수 파일은 코드가 아니라 이전 라운드들의 계획·
리뷰 산출물이라 코드 메트릭이 적용되지 않는다.

## 발견사항

- **[INFO]** 리뷰 세션 ID를 프로덕션 테스트 코드 주석에 직접 인용하는 밀도가 계속 누적되고 있다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts` (예:
    `readStringArrayConst` 소비부 60~71행 부근 vacuity 케이스 주석, 116~124행 `tmp` 관련 주석),
    `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` (헤더 docstring 전역).
  - 상세: `` `/ai-review` `review/code/2026/09/14/{11_27_40,11_52_13,12_17_14,12_37_01,13_04_49}` `` 등
    5개 세션 ID가 두 파일에 걸쳐 반복 인용된다. 이 저장소가 이미 채택한 관례(회귀를 주석으로
    고정해 재발을 막는 방식, 예: `review/code/2026/09/06/01_13_50` W6 인용)와 일관되므로 새로운
    일탈은 아니고, 지금까지 라운드들도 동일하게 INFO/조치 불요로 처분해 왔다. 다만 세션 ID
    인용이 이번 배치에서만 6개까지 늘어난 것은, 다음에 이 파일을 열 사람이 "왜 이 함수가 이런
    형태인가"를 이해하려면 5개의 과거 리뷰 라운드 맥락을 함께 따라가야 한다는 뜻이라 가독성
    비용이 없지는 않다. 결함으로 등재하지 않음 — 기존 관례 준수이자 이미 여러 라운드에서
    검토·수용된 사안의 재확인.
  - 제안: 없음(현행 관례 유지). 향후 이런 인용이 더 늘어나면 "왜 이 분기가 이렇게 생겼는가"를
    설명하는 최소 결론 문장만 남기고 세션 ID는 커밋 히스토리(`git blame`)로 위임하는 것도
    고려할 만하지만, 지금 당장 액션이 필요한 수준은 아니다.

- **[INFO]** 라운드 5 수정이 "자리 수를 다시 세지 않는다"는 원칙을 `trigger-workflow-ref.spec.ts`
  헤더에서만 적용했고, 본문의 `## 가드 3·5` 케이스 헤딩·가드 목록(1~11)은 여전히 숫자를 명시
  나열한다.
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` (헤더 docstring
    "가드는 **11개**다: 1 … → 11 …" 목록, 및 하위 `## 가드 3·5` 헤딩).
  - 상세: 이는 이번 라운드가 새로 만든 문제가 아니라 기존 설계(가드 실행 순서를 문서화해
    `grep '가드 [0-9]'` 로 찾을 수 있게 하는 것이 목적)이고, 라운드 5의 "수를 SoT 로 안 세운다"
    처방은 오직 "자리 개수"(e2e 파일과 중복되는 수치)에만 적용된 것으로 보인다 — 가드 목록
    자체는 이 파일의 존재 이유이자 SoT라 다른 성격이다. 혼동 여지가 있어 참고로 기록하되,
    실제로 두 수치(가드 11개 vs 자리 개수)는 서로 다른 것을 세고 있어 모순은 아니다.
  - 제안: 없음(정보성 확인).

- **[INFO]** `trigger-secret-columns-guard.ts`/`.spec.ts` 는 형제 repo-guard(`redis-fail-open-
  catalog-guard.ts`, `user-entity-exposure-guard.ts`)와 구조·네이밍·JSDoc 스타일이 일관되고,
  `readStringArrayConst`(약 60줄, 지역 함수 `unwrap`/`visit` 포함)의 중첩 깊이도 3단 이내로
  과도하지 않다. `unwrap`/AST-언랩 루프가 `user-entity-exposure-guard.ts` 에 이미 유사한 형태로
  존재해 "규칙-of-3 미달 상태의 2번째 독립 구현"이라는 점은 라운드 5 이전 라운드에서 이미
  INFO로 지적·처분(통합 보류, 3번째 등장 시 재고)됐고 이번 diff 는 그 부분을 변경하지 않았다 —
  재등재하지 않음.

## 요약

이번 라운드에서 실제로 바뀐 코드(라운드 5 fix commit)는 순수 주석 추가 2건뿐이고 로직·구조
변경은 없다. 두 주석 모두 이전 라운드(WARNING/INFO)에서 지적된 "문서한 것과 실측이 다르다"는
결함을 정정하는 목적에 정확히 부합하며, 새로운 가독성·네이밍·중첩·매직 넘버·중복·복잡도 문제를
들여오지 않았다. 신규 repo-guard 쌍은 이미 5라운드에 걸쳐 vacuity·분기-대조군 누락 등 자체
결함을 스스로 발견·수정했고, 남은 관찰 사항(리뷰 세션 인용 밀도, AST 언랩 로직의 2번째 독립
구현)은 전부 이 저장소가 이미 채택한 관례 안에 있거나 이전 라운드에서 이미 처분된 사안의
재확인이다. 유지보수성 관점에서 새로 차단할 사유는 없다.

## 위험도

NONE
