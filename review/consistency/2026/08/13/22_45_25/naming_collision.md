# 신규 식별자 충돌 검토

## 검토 범위에 대한 선행 확인

prompt_file 이 지목한 target(`spec/5-system/`, diff-base `origin/main`)을 실제 워킹트리에서
직접 재확인했다:

```
git diff --stat origin/main...HEAD -- spec/5-system/   → (출력 없음, 변경 0줄)
git merge-base origin/main HEAD                        → 598dca9ab (= origin/main tip)
```

`spec/5-system/` 에는 diff-base 대비 **변경이 전혀 없다.** 실제 diff(31 files, +1666/-36)는
전부 다음 세 영역이다:

- `codebase/backend/src/common/utils/update-returning-rows.{ts,spec.ts}` (신규 유틸)
- `codebase/backend/src/modules/{auth,execution-engine,knowledge-base}/*.service.ts` (기존
  raw SQL 소비 지점을 신규 유틸로 배선한 버그 수정)
- `plan/in-progress/update-returning-tuple-shape.md` (신규 plan, frontmatter
  `worktree: eia-r8-cache-scope-4ae434` — 이 워크트리 디렉터리가 원래 다른 task 용으로 만들어졌다가
  현재 branch `claude/raw-query-audit-followups` 로 재사용되고 있음을 시사)
- `review/code/2026/08/13/20_36_35/**`, `review/consistency/2026/08/13/20_36_36/**` (선행 라운드
  산출물)

즉 이번 라운드는 **spec 신규 식별자를 전혀 도입하지 않는다.** 아래는 그럼에도 실제 diff 가
"신규 식별자 충돌" 관점에 해당하는 요소를 갖는지 코드 레벨에서 점검한 결과다.

## 발견사항

- **[INFO]** target 메타데이터(`spec/5-system/`)와 실제 diff 범위 불일치
  - target 신규 식별자: 없음 (spec/5-system/ 변경 0줄)
  - 기존 사용처: N/A
  - 상세: orchestrator 가 이 checker 에 넘긴 "구현 대상 spec 영역"이 `spec/5-system/` 인데,
    실제 diff 는 `codebase/backend` 버그 수정 + 신규 plan 문서 1건뿐이다. worktree 재사용
    (`eia-r8-cache-scope-4ae434` 디렉터리에서 다른 branch/task 진행)으로 인한 stale 라벨로
    추정된다. 신규 식별자 충돌이라는 이 checker 의 관점에서는 실질 영향이 없으나(검토 대상
    자체가 없음), SUMMARY 통합 단계에서 "target 영역과 실 diff 범위가 다르다"는 사실은
    별도로 인지해 둘 필요가 있다.
  - 제안: 조치 불요(naming_collision 관점 한정). scope 정합성은 다른 관점(plan_coherence 등)
    또는 orchestrator 자체 점검 대상.

- **[INFO]** 신규 함수 `updateReturningRows` — 충돌 없음 확인
  - target 신규 식별자: `updateReturningRows()` (`codebase/backend/src/common/utils/update-returning-rows.ts`)
  - 기존 사용처: 같은 디렉터리의 `assertRowArray()` (`assert-row-array.ts`)와 역할이
    다르다 — `assertRowArray` 는 SELECT 결과 방어, `updateReturningRows` 는 UPDATE/DELETE
    RETURNING 튜플 해석 전담(주석·spec 파일에도 "두 헬퍼의 분담" 으로 명시). 저장소 전체
    grep 결과 `updateReturningRows` 라는 이름의 기존 사용처는 없다(신규 도입 전 0건).
  - 상세: 이름 충돌·의미 충돌 없음. import 배선 3곳(`auth-oauth.service.ts`,
    `execution-engine.service.ts`, `knowledge-base.service.ts`) 모두 동일 함수를 참조하며
    일관적이다.
  - 제안: 조치 불요.

- **[INFO]** 파일 경로 신규성 확인
  - target 신규 식별자: `codebase/backend/src/common/utils/update-returning-rows.ts`,
    `update-returning-rows.spec.ts`, `plan/in-progress/update-returning-tuple-shape.md`
  - 기존 사용처: 없음(신규 파일, 기존 파일과 경로 겹침 없음). 명명 컨벤션도 인접 파일
    `assert-row-array.ts`(kebab-case util) 및 `plan/in-progress/*.md` 컨벤션과 일치.
  - 상세: 충돌 없음.
  - 제안: 조치 불요.

- **[INFO]** 에러 코드/이벤트/ENV/엔드포인트 — 신규 도입 없음
  - diff 에서 참조되는 에러 코드 `KB_REEXTRACT_IN_PROGRESS`, `KB_REEMBED_IN_PROGRESS`,
    `OAUTH_STATE_MISMATCH` 는 모두 기존 코드에서 이미 쓰이던 것을 그대로 재사용(신규 정의
    아님). 신규 API endpoint·webhook/queue/sse 이벤트명·ENV var·config key 는 diff 어디에도
    없다. plan 본문이 언급하는 `RR-PL-05`(chain 깊이 32 제한)는
    `spec/5-system/13-replay-rerun.md` 에 이미 정의된 기존 ID 를 참조만 할 뿐 재정의하지
    않는다(`grep -n RR-PL-05 spec/` 로 확인, 유일 정의처 유지).
  - 제안: 조치 불요.

## 요약

target 으로 지목된 `spec/5-system/` 은 diff-base(`origin/main`) 대비 실제 변경이 0줄이라
신규 식별자 충돌을 검토할 대상 자체가 존재하지 않는다. 실제 diff 는 backend 버그 수정
(`updateReturningRows` 유틸 신규 도입 + `auth-oauth`/`execution-engine`/`knowledge-base` 3개
소비 지점 배선)과 plan 문서 1건으로, 신규 도입된 유일한 식별자인 `updateReturningRows` 는
기존 `assertRowArray` 와 역할이 명확히 분리되어 충돌하는 기존 사용처가 없고, 파일 경로·
에러 코드·API endpoint·이벤트명·ENV/설정키 어느 축에서도 신규 정의나 기존과의 충돌이
발견되지 않았다(기존 에러 코드는 재사용, `RR-PL-05` 는 기존 spec ID 를 참조만 함). 다만
prompt_file 의 target 라벨(`spec/5-system/`)과 실제 diff 범위(backend 코드) 간 불일치는
naming_collision 관점 밖의 별도 확인 사항으로 남긴다.

## 위험도
NONE
