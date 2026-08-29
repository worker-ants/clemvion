# 변경 범위(Scope) 리뷰 — `eia-failopen-observability-18dc47`

## 방법

`git merge-base HEAD origin/main` (= `c8728b647`) 기준 전체 diff(31 파일, +1863/-14)를 대상 diff 뿐
아니라 실제 저장소(`git diff`, `git show --stat` 개별 커밋)로 직접 재대조했다. 프롬프트의 diff 생략
구간(파일 8, 10)은 `git diff -M20%` 로 rename 여부를 별도 확인했다.

## 발견사항

- **[INFO]** 프로덕션 로직 변경은 정확히 1줄(주석)뿐임을 직접 대조 확인
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:92-93`
  - 상세: `git diff`로 `http-exception.filter.ts`·`code.handler.ts`·`expression-resolver.service.ts`
    (비-spec 원본)를 확인한 결과 이 세 파일 중 실제로 바뀐 것은 `secret-resolver.service.ts`의
    "형제 3곳"→"형제 4곳" 주석 문구 1줄뿐이다. 나머지 프로덕션 로직·시그니처·분기는 무변경.
    나머지 실질 변경은 전부 `.spec.ts`/신규 가드 파일(테스트·정적 정합성 검사)에 국한된다.
    SUMMARY.md(파일 13)의 "프로덕션 로직 변경은 주석 1줄" 서술과 일치함을 직접 검증했다.
  - 제안: 없음(양호 확인).

- **[INFO]** 두 독립 plan 트래커(`backend-lint-gate-broken-on-main.md`,
  `deps-peer-gating-and-eslint10.md`)를 한 PR 에서 동시 갱신 — 실측상 정당함을 확인
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md`(개정),
    `plan/in-progress/deps-peer-gating-and-eslint10.md` → `plan/complete/deps-peer-gating-and-eslint10.md`
    (git mv, `git diff -M20%`으로 rename 확인)
  - 상세: `deps-peer-gating-and-eslint10.md`의 "열린 항목(§2 후속)" 3건(`cause` 비노출 계측 지점 ·
    secret-resolver 형제 3→4곳 · 근거 서술 중복 정리)이 이번 브랜치의 커밋 `48cef83af`/`4dbc6ee39`가
    실제로 닫은 항목과 정확히 일치함을 diff로 직접 대조했다. `backend-lint-gate-broken-on-main.md`
    쪽 갱신(Redis fail-open 재실측 + 카탈로그 가드 완료 기록)도 신규 가드 파일(`redis-fail-open-catalog*.ts`)
    커밋과 1:1 대응한다. plan 자신이 "spec-linked 파일 공유로 인한 수렴 예외"로 근거를 명시하고
    있고, 직전 라운드(`19_17_28`) scope 리뷰도 동일 결론(INFO, 조치 불요)이었다. 은폐된 확장이
    아니라 두 트래커의 실제 완료 항목을 정직하게 반영한 것으로 판단.
  - 제안: 없음(재확인 완료).

- **[INFO]** `spec-sync-external-interaction-api-gaps.md`에 이번 PR 범위 밖 항목 1건 신규 등재
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:1986-2003` (게이트 숫자 기준)
  - 상세: consistency-check(`19_45_22`)가 발견한 `15-external-interaction.md §4` Redis 각주와
    `redis-keys.md` 등재 간 불일치를 새 미체크(`- [ ]`) 항목으로 추가했다. 코드는 건드리지 않았고
    본문에 "이번 PR 범위 밖(pre-existing)"이라고 명시했다. 이 저장소 관례상("미룬 항목은 그 턴에
    plan/ 에 적어라") 적절한 처리이며 코드 변경 스코프에는 영향 없음.
  - 제안: 없음(문서 등재만, 조치 불요).

- **[INFO]** `review/code/**`, `review/consistency/**` 산출물 전체(19개 파일) 커밋 포함
  - 위치: `review/code/2026/08/29/19_17_28/*`, `review/consistency/2026/08/29/19_45_22/*`
  - 상세: 직전 `/ai-review` + consistency-check 세션의 라운드 산출물 전체(SUMMARY/RESOLUTION/각
    reviewer .md/meta.json/retry state 등)가 커밋에 포함돼 있다. CLAUDE.md 권한표가 최근
    `review/**/RESOLUTION.md` → `review/**`로 넓혀졌고(본 PR의 plan 갱신에도 그 배경이 적혀
    있음) 이 저장소의 확립된 관례(수백 건의 선례)와 일치한다. scope 관점의 이상 없음.
  - 제안: 없음.

- **[INFO]** import·포맷팅·불필요 리팩토링 없음
  - 상세: 신규 가드 파일(`redis-fail-open-catalog-guard.ts`, `redis-fail-open-catalog.spec.ts`)의
    import(`fs`/`path`/`ts`/`os`)는 전부 실사용 확인. 기존 파일(`expression-resolver.service.spec.ts`,
    `code.handler.spec.ts`, `error-shape.spec.ts`) diff는 주석 블록 교체만이고 코드 로직·공백·
    줄바꿈 변경은 없음(순수 텍스트 diff로 직접 확인). drive-by 리팩토링·auto-format 흔적 없음.
  - 제안: 없음.

## 검증용 뮤테이션

이 리뷰에서는 별도 뮤테이션을 넣지 않았다(스코프 판단은 diff 대조·`git show --stat`·`git log`
만으로 충분히 결론 가능했음). 저장소 파일은 건드리지 않았고 `git status --short`는 이 리뷰
세션 산출물 디렉터리(`review/code/2026/08/29/19_53_43/`) 외 미커밋 변경 없음을 확인했다.

## 요약

`merge-base` 대비 diff 31파일 중 프로덕션 로직 실질 변경은 1줄(주석)뿐이고, 나머지는 (1) 신규
테스트/정적 가드 파일, (2) 기존 spec 파일의 주석 정리(중복 근거를 단일 정본으로 위임), (3) 그
작업이 실제로 완료한 항목에 대응하는 plan 트래커 갱신(수렴 예외로 자기 근거 명시), (4) 직전
리뷰/consistency-check 세션 산출물 커밋(확립된 저장소 관례)으로 구성된다. 두 개의 plan 트래커를
동시에 건드리는 부분은 겉보기엔 스코프 확장처럼 보이지만, 각 항목이 이번 브랜치의 실제 커밋과
1:1 대응함을 diff로 직접 대조해 정당성을 확인했다. 의도 이상의 변경, 요청받지 않은 기능 확장,
무관한 파일·영역 수정, 의미 없는 포맷팅/임포트/설정 변경은 발견되지 않았다.

## 위험도
NONE
