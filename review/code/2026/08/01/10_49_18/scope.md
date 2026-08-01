STATUS=success 변경 범위(Scope) 검토 완료 — WARNING 1건 (CRITICAL 없음)
===REPORT_MARKDOWN_BELOW===
# 변경 범위(Scope) 코드 리뷰 — audit-logging (workflow/trigger/schedule/model_config CRUD 감사 로깅, 2차 리뷰)

## 검토 방법

이번 리뷰(`10_49_18`)는 1차 스코프 리뷰(`review/code/2026/08/01/10_05_53/scope.md`) 이후 조치 커밋 2개
(`f77c1e0de` C1 fix, `a92f53df6` C2·W5·W6·W9·W10·W2 fix)가 추가된 뒤의 **재검토**다. `git log --oneline`,
`git diff origin/main...HEAD --stat`(45개 파일, `646a0bad4` feat → `24d0db60a` test → `65087584b` style →
`f77c1e0de` fix(C1) → `a92f53df6` fix(C2 등) 총 5개 커밋)로 전체 변경 파일을 확인했고, 프롬프트에서 diff 가
생략된 파일(`model-config.service.spec.ts`, `triggers.service.spec.ts`, `workflows.service.ts` 등)은
`git diff origin/main...HEAD -- <file>` 로 워크트리에서 직접 대조했다. 1차 리뷰가 지적한 WARNING(무관 파일
유입)·INFO(죽은 코드)가 이번 조치 커밋에서 실제로 해소됐는지를 `git show --stat`/`grep`/`git diff -w` 로
재검증하는 데 집중했다.

## 발견사항

- **[WARNING]** 1차 스코프 리뷰가 지적한 무관 파일 변경이 이번 라운드에도 그대로 남아 있고, `RESOLUTION.md`·
  `plan/` 어디에도 추적되지 않은 채 조용히 누락됨
  - 위치: `codebase/backend/src/modules/triggers/dto/notification-config.dto.ts:105`
  - 상세: `65087584b`("style(backend): eslint --fix 포맷 정정") 커밋이 감사 로깅과 무관한 이 파일의
    `@IsIn(NOTIFICATION_EVENT_TYPES as unknown as string[], { each: true })` 를
    `@IsIn(NOTIFICATION_EVENT_TYPES, { each: true })` 로 바꿨다(타입 단언 제거, `NOTIFICATION_EVENT_TYPES`/
    `NotificationConfigDto` 모두 이 파일 안에서만 정의·사용되어 감사 로깅 4모듈과 무관함을 확인). 이 hunk 는
    1차 리뷰 `review/code/2026/08/01/10_05_53/SUMMARY.md` Warning #11("스코프" 카테고리, 권장조치 #9
    "별도 독립 커밋으로 분리하거나 되돌리기, 향후 `lint:fix` 실행 범위를 diff 파일 목록으로 한정")로 이미
    지적됐으나, 두 조치 커밋(`f77c1e0de`, `a92f53df6`) 어느 쪽도 이 파일을 건드리지 않아(`git show --stat`
    양쪽 확인) 여전히 미해결이다. 더 문제인 것은, 같은 라운드에서 함께 조치되지 않은 다른 5건(W1 SPEC-DRIFT·
    W3·W4·W7·W8)은 `review/code/2026/08/01/10_05_53/RESOLUTION.md` 의 "미조치 — 근거" 표에 사유가 명시적으로
    남았는데, 이 W11 항목만 그 표에도 `plan/in-progress/spec-sync-auth-gaps.md` 의 "§4.1 구현 후속" 목록에도
    전혀 등장하지 않는다 — 고쳐지지도, 의도적으로 보류하기로 결정되지도 않은 채 추적에서 완전히 누락됐다
    (`grep -n "notification-config\|IsIn" RESOLUTION.md` 0건). 런타임 위험은 없다(동일 `as const` 배열
    참조를 그대로 넘기는 순수 타입 단언 제거, 트랜스파일 후 JS 동일) — 이 점은 1차 리뷰와 동일하게 재확인했다.
  - 제안: 이번 라운드에서 (a) 이 1-hunk 를 되돌리거나 별도 커밋으로 분리, 또는 (b) `RESOLUTION.md`
    "미조치 — 근거" 표에 W11 을 명시적으로 추가해 의도적으로 이월한다는 근거를 남길 것. 두 선택지 모두
    "그냥 다시 안 건드림"보다 낫다 — 추적 없이 반복 이월되면 다음 리뷰에서 같은 항목이 3번째로 재발견된다.

## 점검했으나 문제 없음으로 판단한 지점

- **조치 커밋 2개(`f77c1e0de`, `a92f53df6`)의 스코프**: `f77c1e0de`(C1 — 기존 spec 호출부 70곳에 `userId`
  더미 인자 추가)는 5개 spec 파일에 대해 기계적으로 `, 'u-spec'`/`, 'u-1'` 인자만 추가했고 다른 로직 변경이
  없음을 diff 전문으로 확인. `a92f53df6`(C2·W5·W6·W9·W10·W2)도 커밋 메시지가 선언한 항목(누락 테스트 8곳
  추가, 감사 기록을 커밋 직후로 이동, `recordAudit` 이중호출 통합, `try/finally` mock 복원, 죽은 코드 삭제,
  CHANGELOG 추가)에 diff 가 정확히 대응한다. 두 커밋 모두 신규 `import` 변경 0건
  (`git diff f77c1e0de~1 a92f53df6 -- codebase/backend | grep -E "^\+import|^-import"` 공백 확인).
- **`triggers.service.spec.ts` 의 죽은 코드(1차 리뷰 INFO)**: `const idx = ... as unknown as never; void idx;`
  4줄이 `a92f53df6`(W10)에서 실제로 삭제됐음을 `grep -n "void idx"` 로 재확인(매치 0건) — 정상 해소.
- **`workflows.service.ts` `duplicate()` 대규모 재인덴트**: 이번 라운드에도 그대로 남아 있는 형태이나,
  `git diff origin/main...HEAD` 전문을 직접 대조한 결과 실질 변경은 (1) 트랜잭션 반환값을
  `const duplicated =` 로 캡처, (2) 커밋 뒤 `recordAudit({ ..., details: { duplicatedFrom: id } })` 호출,
  (3) 그로 인한 콜백 재래핑 들여쓰기뿐이며 노드/엣지 복제 로직 자체는 토큰 단위로 동일 — 1차 리뷰 결론과 일치.
- **`plan/in-progress/spec-sync-auth-gaps.md`, `review/code/2026/08/01/10_05_53/**`,
  `review/consistency/2026/08/01/09_11_58/**` 신규 파일**: `CLAUDE.md` 가 명시하는 impl-prep
  consistency-check·구현 후 code-review·RESOLUTION 기록 프로세스의 정상 산출물이며 `developer` 의
  `plan/**`, `review/**/RESOLUTION.md` 쓰기 권한 범위 안. 스코프 위반 아님(1차 리뷰와 동일 결론, 이번
  라운드도 재확인). `plan/**` 변경도 `spec-sync-auth-gaps.md` 1개 파일에 한정됨을 재확인.
- **임포트·설정 파일**: `git diff origin/main...HEAD --stat -- '*.json' '*.yml' '*.yaml' 'package.json'
  'eslint*' 'tsconfig*' ':!review/**'` 공백 확인 — 관점 7(임포트)·8(설정) 위반 없음.
- **frontend/spec 변경 0건**: `git diff origin/main...HEAD --stat -- codebase/frontend
  codebase/channel-web-chat spec/` 공백 확인.
- **신규 파일 전수**: `git diff origin/main...HEAD --diff-filter=A --name-only` 결과 23개 모두
  `review/code/10_05_53/**` 또는 `review/consistency/09_11_58/**` 산출물이며, 예상 밖의 신규 소스 파일은 없음.

## 요약

1차 스코프 리뷰 이후 적용된 두 조치 커밋(C1 타입에러 복구, C2·W5·W6·W9·W10·W2 회귀 테스트·불변식 정정)은
각자의 커밋 메시지가 선언한 범위를 정확히 지켰다 — 기계적 인자 추가, 선언된 테스트 추가, 선언된 리팩토링
(이중 호출 통합·커밋 순서 이동) 외의 부수 변경이 없고 신규 import·config 변경도 0건이다. 1차 리뷰의
INFO(죽은 코드)는 실제로 해소됐다. 그러나 1차 리뷰가 WARNING 으로 지적한 유일한 항목 — 감사 로깅과 무관한
`notification-config.dto.ts` 의 타입 단언 제거가 "포맷 전용" 커밋에 섞여 유입된 건 — 은 이번 라운드에도
전혀 손대지 않았고, 심지어 그 사실이 `RESOLUTION.md`/`plan/` 어디에도 "의도적으로 보류함"으로 기록되지 않아
추적에서 통째로 빠졌다. 런타임 위험은 없지만, 같은 항목이 근거 없이 반복 이월되는 것 자체가 이번 라운드가
잡아야 할 스코프 위생 문제다.

## 위험도

LOW
