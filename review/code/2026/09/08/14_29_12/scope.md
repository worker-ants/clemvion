# 변경 범위(Scope) 리뷰

## 사전 확인

이번 라운드(`14_29_12`)는 이 PR의 4번째 `/ai-review` 라운드다. `git diff --stat origin/main...HEAD`
(브랜치 `claude/spec-followups-batch-b-7c31ad`, 5커밋: `03f665c63`·`9ab43690a`·`05b899d1f`·
`d80583700`·`ead63d797`, 110개 파일 — 프롬프트 번들의 파일 1~110과 1:1 대조 완료, 누락 없음)을
직접 열어 확인했다.

핵심은 **직전 라운드 이후 새로 생긴 diff가 정확히 어디까지인가**다 — `git show --stat ead63d797`
로 마지막 커밋만 분리해서 봤다:

```
codebase/backend/src/common/__test-utils__/source-scan.ts       |  32 +-
plan/in-progress/spec-draft-nullable-notation-followups.md      |  28 ++
plan/in-progress/spec-followups-batch-b.md                      |  21 +-
review/code/2026/09/08/14_01_56/**                               (신규 리뷰 산출물 20파일)
review/consistency/2026/09/08/14_01_57/**                        (신규 컨시스턴시 산출물 7파일)
scripts/check-backend-typecheck-ratchet.py                      |   6 +-
scripts/check-frontend-typecheck-ratchet.py                     |   6 +-
```

실질 코드/plan 변경은 **3개 파일(총 81줄)** 뿐이고, 나머지는 리뷰/컨시스턴시 산출물이다. 이 3개
파일 각각을 커밋 메시지(`review/code/2026/09/08/14_01_56/RESOLUTION.md` 요약)와 대조했다:

| 실제 diff | 커밋이 주장하는 대응 항목 | 대조 결과 |
|---|---|---|
| `source-scan.ts` — `enclosingScopeName`의 `functionVar`/`isFn` 분기 제거, `isPropertyDeclaration` 지원도 함께 제거해 형제 원본(`enclosingName`) 알고리즘으로 완전히 되돌림 | W1: 뮤테이션이 실측한 죽은 코드 삭제("두 가드가 실제로 검증한 알고리즘(형제 원본) 하나만 남긴다") | **일치**. `isPropertyDeclaration` 제거는 커밋 메시지에 문구로는 안 나오지만 "형제 원본만 남긴다"는 선언과 정확히 부합한다 — 삭제된 `user-entity-exposure-guard.ts`의 옛 `enclosingName`도 `isVariableDeclaration`만 검사했다(`isPropertyDeclaration` 없음). 즉 확대 삭제가 아니라 선언한 목표(형제 원본 복원) 그 자체다 |
| `spec-draft-nullable-notation-followups.md` +28줄 | W2 defer 사유를 상위 트래커에 재개 신호와 함께 등재 | **일치** — 새 체크박스 1건, 표 1개, defer 사유·재개 신호 명시 |
| `spec-followups-batch-b.md` +21/-4줄 | W3(스크립트 docstring) 반영 + W4(체크리스트를 3라운드 표로 갱신) + INFO#3(수치 정정 24→25 open) | **일치** — 새로 추가된 문장 전부 그 세 지적을 가리킨다 |
| `scripts/check-{backend,frontend}-typecheck-ratchet.py` 각 +4줄 | W3: 두 스크립트의 낡은 docstring("`run-test.sh` 4단계에는 없다") 취소선+정정 | **일치**. B-1(`.claude/test-stages.sh`/`PROJECT.md`)이 만든 계약 변경을 뒤늦게 두 스크립트에 반영한 것 — 새 기능이 아니라 문서 정합 |

이 3개 파일 밖에서 건드린 코드/설정은 없다. `git status --short`는 이번 세션이 새로 만든
`review/code/2026/09/08/14_29_12/`·`review/consistency/2026/09/08/14_29_13/`(현재 라운드 자신의
산출물) 외에 어떤 잔여물도 없음을 확인했다 — `grep -rn "MUTATION" codebase/backend/src` 0건으로
RESOLUTION의 INFO#9(리뷰어 뮤테이션 잔여물 확인) 주장도 재확인된다.

PR 전체(B-1~B-8, 5커밋) 스코프 자체는 직전 두 라운드(`review/code/2026/09/08/12_53_08/scope.md`,
`13_34_28/scope.md`)가 이미 파일 단위로 표를 만들어 `plan/in-progress/spec-followups-batch-b.md`
B-1~B-8과 1:1 매핑을 검증해 두었고, 이번 재확인에서도 그 매핑을 벗어난 파일은 발견되지 않았다.

## 발견사항

- **[INFO]** 4라운드째 fix→review 루프 — 이 저장소가 기록해 둔 패턴 그대로다
  - 위치: `plan/in-progress/spec-followups-batch-b.md` (`/ai-review` 체크리스트 항목, 3라운드 표)
  - 상세: `codebase/**`를 건드리는 fix가 나올 때마다 직전 리뷰가 stale이 되어 재실행되는 구조(`feedback_review_fix_stale_loop`)가 이번에도 재현됐다(1→2→3→4라운드). 다만 매 라운드 발견의 성격이 "동작 결함"에서 "그 라운드 자신의 fix가 만든 죽은 코드/낡은 문서"로 계속 낮아지고 있고(RESOLUTION.md 자체가 이를 표로 추적), 이번 4라운드의 실질 diff는 81줄(코드 32줄 + plan 49줄)에 그쳐 스코프가 발산하지 않고 수렴하는 중임을 확인했다. 스코프 이탈은 아니고, 이 프로젝트가 상시 승인한 강제 워크플로(CLAUDE.md "구현 완료 후 자동 review/fix")의 정상 반복이다.
  - 제안: 조치 불요 — 다음 라운드에서 Critical/Warning이 계속 0이고 새 코드 변경 없이 수렴하면(RESOLUTION.md가 이미 그 판단 기준을 표로 제시) 병합 준비 완료로 볼 수 있다.

- **[INFO]** `source-scan.ts`의 W1 수정이 커밋 메시지가 명시한 것(`isFn`/`functionVar` 분기)보다 한 항목 더 제거했다(`isPropertyDeclaration` 지원)
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` — `enclosingScopeName` 함수
  - 상세: 커밋 메시지는 "`isFn` 계산이 죽은 코드"라고만 서술하지만 실제 diff는 그와 함께 `ts.isPropertyDeclaration(cur)` 검사도 제거해 클래스 필드 선언(`private readonly x = …`)을 fallback 이름으로 쓰던 경로까지 없앴다. 다만 이는 확대 삭제가 아니다 — 커밋이 목표로 선언한 "형제 원본(`user-entity-exposure-guard.ts`의 옛 `enclosingName`) 하나만 남긴다"는 문장과 정확히 일치한다(형제 원본도 `isVariableDeclaration`만 검사했다). 소비 가드 두 곳(`user-entity-exposure-guard.ts`·`endpoint-path-conflict-wrap-guard.ts`) 스위트가 삭제 후에도 GREEN이었다는 것이 RESOLUTION.md에 기록돼 있어 회귀 위험도 낮다.
  - 제안: 조치 불요 — 커밋 메시지에 "`isPropertyDeclaration`도 함께 되돌렸다"를 한 줄 추가하면 다음 사람이 diff만 보고 의아해할 여지가 줄어들 뿐, 지금 병합을 막을 사안은 아니다.

## 요약

이번 라운드의 실제 신규 diff는 직전 라운드(`14_01_56`, Warning 4)의 RESOLUTION.md가 약속한 4건(죽은 분기 삭제, defer 사유 트래커 등재, 스크립트 docstring 정정, plan 체크리스트 갱신)에 정확히 대응하는 81줄뿐이며, 그 밖의 코드·설정·무관 파일을 건드리지 않았다. PR 전체(B-1~B-8)의 스코프는 `plan/in-progress/spec-followups-batch-b.md`가 사전에 선언한 범위와 계속 1:1로 일치하고, 리뷰/컨시스턴시 산출물이 파일 수의 과반을 차지하는 것은 프로젝트가 명시한 커밋 관례(`review/**` 커밋)일 뿐 스코프 이탈이 아니다. 4라운드째 이어지는 fix→review 루프는 이 저장소가 이미 알려진 패턴으로 문서화해 둔 것이고, 매 라운드 발견의 성격이 구조/문서 수준으로 수렴하고 있어 스코프가 발산하는 신호는 없다. 계획 외 리팩토링, 요청하지 않은 기능 확장, 무관한 파일 수정, 의미 없는 포맷팅, 불필요한 주석/임포트/설정 변경은 발견되지 않았다.

## 위험도

NONE
