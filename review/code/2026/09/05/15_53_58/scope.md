# 변경 범위(Scope) Review

## 방법론 메모

이번 라운드(`15_53_58`)는 `origin/main..HEAD` 13개 커밋 전체를 대상으로 한다. 프롬프트는
컨텍스트 예산 초과로 다수 파일의 diff·전체 컨텍스트를 생략했으므로, 저장소를 직접 열어
재확인했다(뮤테이션 없음 — 검증 전/후 `git status --short` 동일, 이 세션의 산출물 디렉터리
`review/code/.../15_53_58/`·`review/consistency/.../15_53_59/` 외 변경 없음).

- `git log --oneline origin/main..HEAD`: 13개 커밋 확인. 최신 2개는 `6a6621ecd`(직전 라운드
  `15_31_41`/`15_31_43` 산출물 커밋, `review/**`만 포함)와 `5fcb5c625`(직전 라운드 W1·W2 fix).
- `git diff --stat origin/main...HEAD -- codebase/`: **정확히 9개 파일, 1101 insertions / 7
  deletions** — `audit-logs.service.ts`/`.spec.ts`, `response-contract.ts`/`.spec.ts`(신규),
  `execution-response.dto.spec.ts`(신규), 4개 e2e 스펙.
- `git diff --name-only origin/main...HEAD | grep -Ev '^(codebase/|plan/|review/|CHANGELOG.md)'`:
  **결과 0건** — `codebase/`·`plan/`·`review/`·`CHANGELOG.md` 밖의 파일은 이 브랜치 전체에서
  단 하나도 바뀌지 않았다.
- `git show --stat 5fcb5c625`: 4개 파일만 변경(`audit-logs.service.ts` 주석 정정 9줄,
  `execution-response.dto.spec.ts` 신규 150줄, plan 문서 2개) — 직전 라운드 consistency-check
  가 낸 WARNING W1·W2 와 정확히 1:1 대응하고 그 이상도 이하도 아니다.
- 신설 `execution-response.dto.spec.ts` 가 인용하는 선례 `execution-status-response.dto.spec.ts`
  가 실제로 저장소에 존재함(`codebase/backend/src/modules/external-interaction/dto/responses/`)을
  확인 — 근거 없는 패턴 인용이 아니다.

## 발견사항

- **[NONE]** 핵심 코드 변경 9개 파일에 범위 이탈이 없다
  - 상세: `audit-logs.service.ts` 는 `leftJoinAndSelect` → `leftJoin`+`addSelect` 전환과
    `AuditLogListItem` 타입 신설(및 그 근거 주석)로 좁게 유지되고, `response-contract.ts`/
    `.spec.ts` 는 §5.4 검증 헬퍼 신설, 4개 e2e 스펙은 각각 import 2줄 + 단언 호출 형태로
    배선됐을 뿐 무관한 리팩토링·포맷팅 변경·불필요한 import 정리는 보이지 않는다.
    `execution-response.dto.spec.ts` 신설은 직전 라운드 consistency-check WARNING(plan 이
    "2단계 착수 시 신설하라" 못 박은 트리거의 미이행)에 대한 직접 대응이며, 기존 자매 파일
    패턴(`execution-status-response.dto.spec.ts`)을 그대로 따른다.
  - 이 결론은 새로운 것이 아니다 — 이전 4개 라운드(`13_49_54`/`15_12_02`/`15_31_41` 의 scope.md,
    그리고 두 차례 consistency-check)가 이미 같은 코드 범위를 반복 검증했고 전부 NONE~LOW 로
    수렴했다. 이번 라운드에서도 `git diff --stat` 실측이 그 결론을 재확인한다.

- **[INFO]** `plan/**`·`review/**` 하위 82개 파일 중 대다수는 이전 리뷰/consistency 라운드의
  산출물이지 이번 라운드가 새로 만든 것이 아니다
  - 상세: `origin/main..HEAD` 전체는 82개 파일·7,156 insertions 인데, 그중 `codebase/` 는 9개
    파일(1,101줄)뿐이고 나머지는 `plan/in-progress/*.md` 3개 편집 + `review/code/**`·
    `review/consistency/**` 산출물이다. 이 구조는 CLAUDE.md 가 규정하는 "구현→`/ai-review`→
    fix→재리뷰" 다회 워크플로가 매 라운드마다 남기는 정상 산출물이며, 각 라운드의 scope.md 가
    이미 이 사실을 여러 차례 확인해 뒀다(3번째 반복 확인이면 재지적이 stale 루프가 된다는
    것이 이 저장소의 명시적 교훈이다). 새로운 지적이 아니라 이번 라운드에서의 재확인으로만
    기록한다.
  - 위치: `plan/in-progress/spec-conventions-engine-error-code-surface.md`,
    `plan/in-progress/spec-draft-nullable-notation-followups.md`,
    `plan/in-progress/spec-sync-auth-gaps.md` (3개 편집) + `review/code/2026/09/05/{13_49_54,
    14_39_31,15_12_02,15_31_41}/**`, `review/consistency/2026/09/05/{12_48_13,15_31_43}/**`
    (신규 산출물).
  - 제안: 조치 불요.

## 요약

이번 라운드가 검토하는 13개 커밋의 실제 코드 범위(`codebase/` 9개 파일, 1,101줄)는 감사 로그
응답의 `User` 전 컬럼 유출 수정과 §5.4 응답-계약 검증 헬퍼 신설·배선이라는 단일 축으로
일관되게 좁혀져 있으며, `codebase/`·`plan/`·`review/`·`CHANGELOG.md` 밖의 파일은 이 브랜치
전체에서 단 하나도 바뀌지 않았다. 최신 두 커밋(`5fcb5c625` fix, `6a6621ecd` docs)도 각각
직전 라운드 리뷰/consistency-check 가 낸 WARNING 에 정확히 1:1 대응하는 최소 diff 다. 이
결론은 이번 라운드가 처음 낸 것이 아니라 4차례의 이전 scope 리뷰가 이미 반복 확인한 것을
`git diff --stat` 실측으로 재확인한 것이며, CRITICAL/WARNING 급 범위 이탈은 이번 라운드에서도
발견되지 않았다.

## 위험도

NONE
