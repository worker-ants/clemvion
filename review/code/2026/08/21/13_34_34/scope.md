# 변경 범위(Scope) 검토 — masked-marker-contract-7d2e14 (13_34_34, 누적 6개 커밋)

## 검토 방법

`git diff origin/main...HEAD` 를 직접 실측했다 — 109개 파일, `+8137/-140`. 이 중 실질 코드/스펙/플랜
변경은 **24개 파일**(`+1358/-140`)뿐이고, 나머지 85개는 이전 5개 리뷰 라운드
(`11_27_29`/`11_53_49`/`12_25_15`/`12_50_37`/`13_14_29`)와 2개 consistency-check 라운드
(`10_45_52`/`10_58_25`)가 같은 브랜치에 커밋한 `review/**` 산출물 자체다. 이 저장소는 리뷰
산출물을 push 전까지 브랜치에 누적 커밋하는 것이 표준 워크플로(각 라운드가 fix→재리뷰를 반복)이므로,
이 85개 파일은 "무관한 추가 변경"이 아니라 이 PR 의 리뷰 이력 그 자체다 — 스코프 위반으로 보지 않는다.

target 은 단일 목표를 가진다: `MASKED_MARKERS`/`isMaskedMarker`/깊이 상한(`MAX_REDACT_DEPTH`/
`MAX_MARKER_SCAN_DEPTH`)의 backend↔frontend 손-복제를 `@workflow/masked-markers` 공유 패키지로
추출하고, 미러 재발을 잡는 repo-guard 를 신설한다(근거: `plan/in-progress/masked-marker-shared-package.md`,
체크리스트 전항목 `[x]`, `/ai-review` 만 미완).

## 발견사항

- **[INFO]** `pnpm-lock.yaml` 에 목표와 무관한 `eslint-config-next` peer-dependency 해석 그래프
  재정렬이 섞여 있다 (5라운드 연속 동일 판정, 이번 라운드도 실측 재확인)
  - 위치: `pnpm-lock.yaml` — `eslint-config-next@16.3.0(...)` 의 peer 서명 축소 및
    `eslint-import-resolver-typescript`/`eslint-module-utils`/`eslint-plugin-import` variant 재구성
    (`git diff origin/main...HEAD -- pnpm-lock.yaml` 확인, 126줄 diff 중 신규 workspace 등록
    섹션 외 나머지가 이 재정렬)
  - 상세: `@workflow/masked-markers` workspace 패키지 추가로 `pnpm install` 이 전체 의존성 그래프를
    재해석한 부수 효과이며, `eslint-config-next` 버전 자체(`16.3.0`)는 불변이다. 이 PR 의 의도와
    직접 관련 없으나 불가피한 lockfile 재해석 노이즈다.
  - 제안: 조치 불필요. 이미 5개 리뷰 라운드가 동일하게 판정한 항목이라 재론 불요.

- **[INFO]** `developer` 역할이 `spec/5-system/14-external-interaction-api.md` 를 직접 편집했다 —
  CLAUDE.md 상 `developer` 는 `spec/` read-only 이고 원칙적으로 `project-planner` 위임 대상
  (이미 2회 리뷰·재확인된 의도적 선택 — 신규 지적 아님)
  - 위치: `spec/5-system/14-external-interaction-api.md:1622-1631`(R17 SoT 서술 정정) 및
    frontmatter `code:` 목록 `:16`(`codebase/packages/masked-markers/src/index.ts` 추가),
    커밋 `bf0618a7d`
  - 상세: `plan/in-progress/masked-marker-shared-package.md` 의 작업 체크리스트는 이 편집을
    "`11_27_29` W3 처분에서 집행, 별도 planner 턴 대신 `--impl-done` 검증으로 같은 턴에 처리"라고
    명시적으로 남겨 뒀고, `12_50_37` RESOLUTION(WARNING 2, requirement 관점)과 `13_14_29`
    RESOLUTION(WARNING 1, scope 관점)이 각각 독립적으로 "내용이 구현과 정확히 일치하고
    SPEC-DRIFT 가 아니므로 되돌릴 필요 없음"이라고 재확인했다. 편집 범위 자체도 2줄
    (R17 문장 + frontmatter 1행)로 작아 role 위반의 실질 파급은 제한적이다. 다만 CLAUDE.md 의
    명시 규약("구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임")을 문언 그대로
    따르지 않은 것은 사실이며, 그 선택이 결정으로 굳어지는 근거(선례·되돌릴 필요 없음 판정)가
    `RESOLUTION.md`/`plan/` 에만 있고 CLAUDE.md 자체의 예외 조항으로는 반영되지 않았다는 점은
    남아 있다 — RESOLUTION 도 "CLAUDE.md 에 예외 조항을 추가하는 것은 이 PR 과 무관한 별도
    planner 턴"이라고 스스로 선을 그어 뒀다.
  - 제안: 이번 라운드에서 추가 조치는 불요(이미 2회 독립 판정·재확인, 결정을 번복할 새 근거 없음).
    다만 이 패턴(developer 턴이 스코프상 정당하다고 판단해 spec 을 직접 고치는 것)이 앞으로도
    반복될 조짐이면, CLAUDE.md 예외 조항화 여부를 별도 planner 턴에서 한 번 정리하는 편이
    "매 PR 마다 RESOLUTION 에서 재론"하는 비용보다 쌀 수 있다 — 이 PR 의 범위는 아니다.

## 스코프 내로 확인한 항목 (참고 — 문제 없음)

- **"실질" 24개 파일** 전부가 목표(공유 패키지 추출 + 등록 8곳 + 미러 소멸 가드)와 1:1 대응한다.
  `git diff --stat` 로 직접 분류 확인 — CI/Docker/package.json 등록 표면 8곳, 패키지 신규 소스
  6개, backend/frontend 재export 소비처 2개, repo-guard 신규 4개(backend/frontend × 구현/스펙),
  plan 문서 2개, spec 문서 1개, lockfile 1개. 무관한 파일이 섞여 있지 않다.
- **repo-guard 의 스캔 범위 확장**(`resolveScanDirs` 가 `codebase/<stack>/src` +
  `codebase/packages/<pkg>/src` 2단계로, `frontend-checks.yml` pathspec 에 `channel-web-chat`
  추가)은 기능 확장이 아니라 "이 가드가 서술하는 커버리지를 실제로 채운다"는 동일 목표의
  버그 수정이다 — 신규 `codebase/channel-web-chat/**` 소스 파일은 diff 에 전혀 없음을
  `git diff --name-only` 로 확인(트리거 배선만 추가).
- **`plan/in-progress/spec-sync-external-interaction-api-gaps.md`** diff 는 `:373`·`:757`
  두 트래커 항목만 `[x]` + 대체 근거로 정정하며 다른 무관 항목은 건드리지 않는다.
- **`SOT_DIR` 접두 경계**(backend `=== SOT_DIR || startsWith(SOT_DIR + '/')`)가 최종적으로
  frontend 쌍둥이(`sotPrefix` 변수)에도 대칭 반영돼 있음을 직접 `grep` 으로 재확인 — 여러
  라운드에 걸친 수정이 이번 최종 diff 에서 실제로 수렴했다.
- **신규 패키지 보일러플레이트**(`package.json`/`tsconfig.json`/`eslint.config.mjs`/`README.md`)는
  기존 `@workflow/ai-end-reason` 형제 패키지와 동일 틀이며 과잉 설정이 없다.
- **`review/consistency/**`·`review/code/**` 산출물 85개**는 CLAUDE.md 가 강제하는
  `/consistency-check`(spec/plan 쓰기 전)·`/ai-review`(구현 완료 후) 의무 절차의 표준 산출물이며,
  같은 작업의 리뷰 이력이다 — 별도 무관 작업의 혼입이 아니다.

## 요약

이번 라운드(13_34_34, 누적 6커밋)까지 포함해도 이 PR 은 "마스킹 마커 계약을 공유 패키지로
추출한다"는 단일 목표에 계속 타이트하게 수렴한다. `git diff origin/main...HEAD` 실측 기준 실질
변경은 24개 파일뿐이고 전부 등록 표면·재export 전략·미러 소멸 가드·트래커 정정이라는 계획된
작업 항목과 1:1 대응하며, 무관한 리팩터·기능 확장·포맷팅 노이즈·불필요한 주석/임포트 변경은
발견되지 않았다. 나머지 85개 파일은 이 저장소의 표준 리뷰 워크플로가 남긴 이전 라운드의
review/consistency 산출물이라 스코프 위반이 아니다. 발견된 두 건은 모두 INFO 수준 — 하나는
5라운드 연속 동일하게 확인된 `pnpm-lock.yaml` 의 무관한 lockfile 재해석 노이즈, 다른 하나는
`developer` 가 `spec/` 를 직접 편집한 역할 경계 건인데 이미 2개 독립 리뷰 라운드(requirement·scope)가
각각 "되돌릴 필요 없음"으로 재확인했고 이번 재검토에서도 그 결론을 바꿀 새 근거가 없다. 차단 사유는
없다.

## 위험도
LOW
