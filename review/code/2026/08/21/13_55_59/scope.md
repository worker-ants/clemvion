# 변경 범위(Scope) 검토 — masked-marker-contract-7d2e14 (라운드 7, 13_55_59)

## 검토 방법

target 은 "backend/frontend 에 손으로 복제된 마스킹 마커 상수·판정 로직·깊이 상한을
`@workflow/masked-markers` 공유 패키지로 추출한다"는 단일 목표를 가진 PR이다
(근거: `plan/in-progress/masked-marker-shared-package.md`). 이번이 6라운드 fix→review
사이클을 거친 뒤의 7번째(최종) 코드 리뷰이며, 프롬프트에 실린 123개 변경 파일 중
대다수(파일 24~122)는 이전 6개 코드 리뷰 라운드(`11_27_29`~`13_34_34`)와 2개
consistency-check 라운드(`10_45_52`, `10_58_25`)의 산출물 자체다.

`git diff --stat origin/main...HEAD -- . ':!review/**'` 로 review 산출물을 제외한
"실질 변경 24개 파일"만 추려 재확인했고, 이는 프롬프트의 파일 1~23·123과 정확히 일치한다.
이 24개가 이번 스코프 판정의 실질 대상이다.

## 발견사항

- **[WARNING]** `spec/` 편집이 developer/RESOLUTION 턴에서 직접 이뤄졌다 — CLAUDE.md 가 명시한
  역할 경계("`developer` 는 `codebase/**`, `plan/**`, `review/**/RESOLUTION.md` 쓰기, `spec/`
  read-only" / "구현 중 spec 변경 필요 시 `developer` 는 멈추고 `project-planner` 위임")를
  벗어난다
  - 위치: `spec/5-system/14-external-interaction-api.md:1625`("마커 집합과 깊이 상한의 SoT 는
    **공유 패키지 `@workflow/masked-markers`** 다")
  - 상세: `git log --oneline -- spec/5-system/14-external-interaction-api.md` 로 확인한 결과
    이 R17 문장 정정은 `bf0618a7d`("fix(guard): 없애려던 경로 게이팅을 가드 배치로 재도입했다 +
    spec R17 정정 — 라운드1 처분")에서 developer 워크플로 안에서 직접 커밋됐다. 이는 별건 planner
    턴이 아니다. 이 사실 자체는 은폐돼 있지 않다 — `review/code/2026/08/21/11_27_29/RESOLUTION.md`
    "WARNING 3"이 "별도 `--spec` 라운드 대신 push 게이트가 요구하는 `--impl-done` 으로 검증한다…
    선택을 숨기지 않고 여기 적는다"고 명시적으로 자인했고, 이후 `review/code/2026/08/21/12_50_37/
    RESOLUTION.md` "WARNING 2"와 `review/code/2026/08/21/13_14_29/RESOLUTION.md` "WARNING 1"에서
    같은 role-boundary 지적이 **반복**됐으며, 매번 "리뷰어 판정 그대로 되돌릴 필요 없음… CLAUDE.md
    예외 조항 추가는 이 PR 과 무관한 별도 planner 턴"으로 처분됐다(즉 "고친다"가 아니라 "이번
    PR 에서는 그대로 둔다"는 의사결정이 세 라운드 연속 재확인됐다). 내용 자체는 구현과 정확히
    일치하고 SPEC-DRIFT 는 아니라는 점도 세 라운드가 공통으로 확인했다.
  - 제안: 이번 라운드에서 새로 발견된 사항이 아니라 이미 3라운드에 걸쳐 의도적으로 수용된 위험이므로
    이 PR 안에서 추가 조치는 불필요하다. 다만 "developer 가 예외적으로 spec 1줄을 고칠 수 있는
    조건"을 CLAUDE.md 에 규정할지는 이 PR 과 무관한 별도 governance 결정이라는 점을 재확인차 기록한다
    (SUMMARY 가 6라운드 동안 누적된 이 판단을 한 번 더 무시하지 않도록 하기 위함).

- **[INFO]** `pnpm-lock.yaml` 에 목표(마커 패키지 추출)와 무관한 `eslint-config-next` peer-dependency
  해석 그래프 재정렬이 섞여 있다
  - 위치: `pnpm-lock.yaml` (프롬프트에 diff 미실림 — 게이트 없음. 이전 6라운드 전부가 동일 hunk를
    `git diff origin/main...HEAD -- pnpm-lock.yaml` 로 직접 대조해 동일하게 판정)
  - 상세: 신규 workspace 패키지 등록에 필요한 추가분(`codebase/packages/masked-markers:` 섹션 +
    workspace 링크)과는 별개로, `eslint-config-next@16.3.0` 의 peer-dependency variant 가 하나로
    합쳐지며 그 아래 `eslint-import-resolver-typescript`/`eslint-module-utils`/`eslint-plugin-import`
    스냅샷 키가 연쇄 재작성된다. 버전 자체는 불변이라 `pnpm install` 의 정상 부산물이며, 6개 라운드
    전부(`11_27_29`~`13_14_29`) 동일 판정을 냈다.
  - 제안: 조치 불요(선례와 일치, 6라운드 연속 동일 결론).

- **[INFO]** consistency-check 산출물 `rationale_continuity.md`(`10_58_25` 세션) 상단에 sub-agent
  중간 추론 텍스트가 그대로 남아 있다 — target 코드와 무관, 6라운드 동안 미정리
  - 위치: `review/consistency/2026/08/21/10_58_25/rationale_continuity.md:1`, `:3`
  - 상세: `"Confirmed accurate — this matches the target's table exactly..."`,
    `"Based on this extensive verification, I have sufficient grounds for my findings."` 두 문장이
    본문 `## 발견사항` 앞에 그대로 남아 있다. 라운드1 `scope.md` 가 이미 동일 항목을 INFO 로 지적했고
    (`"이 PR 의 리뷰 산출물(생성 아티팩트)에 국한된 흠"`), 이후 6라운드 동안 정리되지 않았다 — 하지만
    target 코드의 실질 변경이 아니므로 스코프 판정에는 영향 없다.
  - 제안: 조치 불요(생성 로그 후처리 이슈, 차단 사유 아님).

## 스코프 내로 확인한 항목 (참고 — 문제 없음)

- **핵심 소스 변경 2곳**(backend `sanitize-error-message.ts`, frontend `masked-markers.ts`)은
  상수·함수를 삭제하고 패키지에서 import 후 재export 하는 최소 변경이며, 소비처 import 경로를
  바꾸지 않는다. 6라운드 내내 "추출된 값 자체"(마커 3종·`isMaskedMarker`·`MAX_MASK_DEPTH`)에는
  단 한 건의 지적도 없었다 — 모든 지적은 그것을 지키는 가드(`masked-marker-mirror-guard.ts`) 쪽이었다.
- **등록 표면 8곳**(`test-stages.sh` · `packages-checks.yml` pathspec/matrix/주석 · backend/frontend
  `package.json` · 세 Dockerfile 의 COPY)은 신규 패키지 등록에 필요한 기계적 배선이며 기존 형제
  패키지(`@workflow/ai-end-reason`)와 형태가 동일하다.
- **`.github/workflows/frontend-checks.yml` 의 `codebase/channel-web-chat/**` pathspec 추가**
  (게이트 44-48)는 언뜻 "마커 패키지 추출"과 무관해 보이지만, 이 PR 이 신설한 미러 소멸 가드가
  `codebase/*/src` 전체를 스캔하도록 설계됐고 `frontend-checks` 잡이 그 가드를 호스팅하므로, 세 번째
  스택(web-chat) 변경 시에도 가드가 실제로 실행되게 하려면 필요한 변경이다(`review/code/.../11_53_49/
  RESOLUTION.md` WARNING 1 에서 실측 근거와 함께 도입). 신설한 기능(가드)의 커버리지를 완성하는
  종속 변경이라 범위 이탈이 아니다.
- **`masked-marker-mirror-guard.ts`/`.spec.ts`/`.test.ts`(신규, backend+frontend)**는 최초 커밋
  (`7cc64fa35`)부터 포함된 설계 요소다(계약 테스트가 CI 경로 게이팅에 막혀 값 자체를 옮기기로
  결정하면서, "미러가 되살아나지 않는지"를 정적으로 잡는 안전망으로 함께 도입). 이후 라운드에서
  추가된 것이 아니라 최초 스코프에 포함된 항목이며, 리뷰 6라운드에 걸쳐 이 가드 자체의 결함(경로
  게이팅 재도입·감시 목록 자체가 미러·스캔 파생이 얕음 등)을 잡아 온 것이지 "요청 밖 기능 추가"가
  아니다.
- **plan 문서 2건**은 `spec-sync-external-interaction-api-gaps.md` 의 관련 백로그 항목 2건만
  `[x]` + 대체 근거로 정정하고 다른 무관 항목은 건드리지 않는다.
- **`review/code/**`·`review/consistency/**` 산출물 다수**는 이 저장소가 review 산출물을
  gitignore 하지 않고 committed 아티팩트로 남기는 표준 워크플로의 부산물이며(6회 fix→review
  사이클의 정본 기록), "무관한 파일 수정"이 아니라 이 changeset 의 리뷰 이력 그 자체다.

## 요약

실질 변경 24개 파일(review 산출물 제외)은 "마스킹 마커 계약을 공유 패키지로 추출한다"는 단일
목표에 여전히 타이트하게 수렴하며, 6라운드에 걸친 fix 커밋들도 전부 그 목표를 지키는 가드 자체의
결함을 좁혀 가는 방향이었지 요청 밖 기능을 넓히는 방향이 아니었다(추출된 값 자체는 6라운드 내내
무결점). 유일한 실질 스코프 이탈은 `spec/5-system/14-external-interaction-api.md` R17 정정을
developer/RESOLUTION 턴이 직접 수행해 `spec/` read-only 역할 경계를 벗어난 것인데, 이는 은폐되지
않았고 3라운드(`11_27_29`/`12_50_37`/`13_14_29`)에 걸쳐 반복 검토된 뒤 "내용은 정확하므로 되돌리지
않되, CLAUDE.md 예외 조항화는 이 PR 과 무관한 별도 판단"으로 이미 확정된 상태다 — 새로 발견된
문제가 아니라 기존 처분의 재확인이다. 나머지 두 건(pnpm-lock 노이즈, 리뷰 산출물 잔여 텍스트)도
6라운드 동안 반복 확인된 무해한 INFO 다.

## 위험도
LOW
