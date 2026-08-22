# 변경 범위(Scope) 리뷰

## 검증 방법

프롬프트에 실린 unified diff 외에 `git diff --stat origin/main...HEAD`, `git show --stat`
(3개 커밋: `ad3157a71`, `3f1e30c3f`, `23840323c`) 로 changeset 전체를 직접 대조해 프롬프트에
빠진 파일이 없는지, 각 커밋이 실제로 무엇을 건드렸는지 확인했다.

## 발견사항

없음.

- **[INFO]** changeset 은 정확히 3개 커밋(`ad3157a71` 테스트 추가, `3f1e30c3f` plan+consistency
  산출물, `23840323c` 리뷰 fix)·22개 파일로 구성되며, 프로덕션/구현 코드
  (`reject-masked-resubmission.ts` 등)는 전혀 포함되지 않았다.
  - 위치: 전체 changeset (`git diff --stat origin/main...HEAD` = 22 files changed,
    1151 insertions, 3 deletions)
  - 상세: (1) 테스트 파일 1개 — `.spec.ts` 에 `it` 블록 1개(+43/-0, 순수 추가, import 변경
    없음). (2) plan 문서 2개 — 신규 `masked-marker-test-gaps.md`(101줄) + 정본 트래커
    `spec-sync-external-interaction-api-gaps.md` 의 plan 이 예고한 항목(①/②/③/조건부 항목)만
    갱신. (3) `review/code/2026/08/22/21_15_53/**` 11개 파일 + `review/consistency/2026/08/22/
    20_57_25/**` 8개 파일 — CLAUDE.md 가 강제하는 "구현 완료 후 자동 `/ai-review` +
    Critical/Warning fix"·"`consistency-check --impl-prep`" 산출물이며, `review/code/**`·
    `review/consistency/**` 는 규약상 커밋 대상(gitignore 안 됨)이다.
  - 제안: 없음(문제 아님, 근거 기록용).

- **[INFO]** fix 커밋(`23840323c`)의 diff 를 직접 열어 확인한 결과, 실제 코드 변경은
  `masked-marker-test-gaps.md` 6줄(±)뿐이다 — 이전 라운드 리뷰가 지적한 stale 줄 번호 인용
  2건(`L868`→앵커 문구, `L826-827`→앵커 문구)만 정확히 고쳤다. 나머지는 그 리뷰 라운드
  자신의 산출물(`review/code/21_15_53/**`) 커밋일 뿐 별도 코드 수정이 아니다. 리뷰가 낸
  INFO(`allReasons` 헬퍼 추출, `ExecutionsService.reRun` 리팩터)는 커밋 메시지에 사유를 남기고
  둘 다 손대지 않았다 — "PR 이 선언한 범위 밖" 이라는 스스로의 판단을 실제로 지켰다.
  - 위치: `plan/in-progress/masked-marker-test-gaps.md` (`git show 23840323c --stat`)
  - 제안: 없음(정상, scope 규율이 잘 지켜진 사례로 기록).

## 관점별 확인

1. **의도 이상의 변경**: 없음. `masked-marker-test-gaps.md` 가 선언한 두 항목(① phase 경계
   캐너리 추가, ② 유예 근거 교체)만 정확히 집행됐다. ③(`ExecutionsService.reRun` 리팩터)은
   plan 이 "이 PR 밖"으로 명시했고 실제로 `executions.service.ts` 는 diff 에 없다 — 실측값
   (141줄) 만 트래커에 반영했다.
2. **불필요한 리팩토링**: 없음. 기존 테스트·헬퍼(`rejectedFields`) 무변경, 신규 `it` 블록
   1개만 파일 끝(기존 마지막 테스트 앞)에 삽입. maintainability 리뷰가 낸 "reasons 추출
   헬퍼화" 제안도 rule-of-three 미달·범위 밖 사유로 명시적으로 보류했다(RESOLUTION.md).
3. **기능 확장(over-engineering)**: 없음. 구현 코드(`reject-masked-resubmission.ts`)는
   changeset 에 없다. `spec_impact: none` 과 일치.
4. **무관한 수정**: 없음. `spec-sync-external-interaction-api-gaps.md` 의 편집 hunk 4개
   (①/②/③/조건부 항목 `#1194` 머지 확인)를 전수 대조했고 전부 plan 이 예고한 항목이다.
   트래커의 다른 미해결 항목(`result.outputs` emit, SSE fan-out 등)은 건드리지 않았다.
5. **포맷팅 변경**: 없음. `.spec.ts` diff 는 순수 추가(append)이며 기존 줄 재포맷·공백 변경이
   없다(`git diff` 확인, `-` 라인 0개).
6. **주석 변경**: 신규 테스트에 14줄 docstring 이 붙었으나 같은 파일의 기존 캐너리 테스트들이
   이미 동일한 길이·형식의 rationale 주석을 갖고 있어(유지보수성 리뷰가 위치까지 특정해
   확인함) 파일 하우스 스타일과 일치. 기존 주석 수정·삭제 없음.
7. **임포트 변경**: 없음. 신규 테스트가 쓰는 `VALUE_MASK_MARKER`,
   `TriggerParameterValidationException`, `resolveTriggerParametersRejectingMasked`,
   `TriggerParameterDefinition` 모두 파일 상단 기존 import 재사용(`sed -n '1,20p'` 로 직접
   확인). 신규 import 없음.
8. **설정 변경**: 없음. `tsconfig`/`package.json`/lint 등 어떤 설정 파일도 changeset 에 없다.

## 요약

changeset 은 계획서(`masked-marker-test-gaps.md`)가 선언한 두 항목만 정확히 집행한 신규
캐너리 테스트 1건(순수 추가, import·포맷·주석 이질성 없음)과 그 결정을 기록하는 plan/트래커
갱신, 그리고 프로젝트 규약상 필수인 `/consistency-check`·`/ai-review`+fix 산출물로 구성된다.
직전 라운드 scope 리뷰가 이미 NONE 판정을 냈고, 이번 라운드에 새로 추가된 fix 커밋
(`23840323c`)도 diff 를 직접 열어 대조한 결과 리뷰가 지적한 정확히 그 결함(stale 줄 번호
인용 2건)만 고치고 비차단 INFO 제안(헬퍼 추출)과 plan 이 "이 PR 밖"으로 못박은 리팩터는
손대지 않아 scope 규율이 이어지고 있다. 범위 이탈 신호가 발견되지 않았다.

## 위험도

NONE
