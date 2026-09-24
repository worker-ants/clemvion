# 변경 범위(Scope) 리뷰 — jest ESM 네이티브 로드 전환 (4라운드, 최종 상태)

## 검토 방법

`git diff origin/main...HEAD --stat` 로 전체 75개 파일을 재확인하고, 프롬프트가 생략한
파일(4·6·9·10·11·19 등)은 `git show`/`git diff`로 직접 열어 대조했다. 이전 3라운드
(`14_24_10`, `15_26_17`, `16_02_28`)의 scope.md 를 모두 읽었고, 그 결론이 이번 라운드의
신규 커밋에서도 유지되는지를 `git diff d184b10d2..HEAD --stat` (직전 라운드 커밋 대비
델타)로 별도 검증했다. 원 작업 의도는 `plan/in-progress/jest-esm-native-load.md`: "막힌
dependabot PR(`#1339` `@nestjs/typeorm`)이 CJS jest 로는 로드 불가능한 ESM-only 패키지에
막혀 있었고, jest 를 `--experimental-vm-modules` 네이티브 ESM 로더로 전환하면서 손으로
유지하던 `transformIgnorePatterns` 허용목록을 걷어낸다."

## 이번 라운드(4라운드)의 실제 델타

직전 커밋(`d184b10d2`) 대비 `HEAD`는 딱 두 종류만 바뀌었다 — 그 밖의 파일은 전부 3라운드
이전에 이미 존재했다.

1. `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (+21/-2) —
   3라운드 자신의 리뷰가 지적한 W1("존재 검사만 하고 순서는 안 봤다 — 플래그를 진입점
   뒤로 옮겨도 통과한다")에 대한 직접 수정. `flagIdx < entryIdx` 순서 비교 1건과, 그 비교가
   플래그 부재 시 `-1 < entryIdx`로 공허하게 통과하는 것을 막는 존재 단언 1건이 추가됐다.
   커밋 메시지에 뮤테이션 2건(M8 순서 위반, M9 완전 제거)의 예측=실측이 기록돼 있다. 이
   파일은 이미 확립된 이 PR 자신의 가드 스펙이므로 스코프 내 수정이다.
2. `review/code/2026/09/24/16_02_28/**` (18개 파일, 신규) — 3라운드 자체의 `/ai-review`
   산출물(SUMMARY·RESOLUTION·에이전트별 리포트 14개·meta.json·`_retry_state.json`)이
   커밋된 것. 코드 변경 없이 산출물만 영속화됐다.

두 델타 모두 "이 PR 목적 자체를 더 정확히 지킨다" 또는 "이 저장소가 명문화한 강제
review/fix 워크플로의 산출물을 보존한다"는 목적에 정확히 수렴하며, 무관한 리팩터링·
포맷팅·임포트 정리·기능 확장·설정 변경은 이번 델타에 없다.

## 발견사항

없음 — CRITICAL/WARNING 급 범위 이탈을 발견하지 못했다. 이전 3라운드가 이미 상세히
검증한 항목(핵심 코드 변경 4개 파일의 단일 목적 수렴, `test:debug` 진입점 통일의 정당성,
`PROJECT.md` 자기-반증형 소정정의 국소성, `spec-draft-nullable-notation-followups.md`
백로그 추가의 관행 정합성, 대량 review 산출물의 절차적 정당성)은 이번 라운드에서 재확인
결과 그대로 유지된다. 아래는 참고용 INFO다.

- **[INFO]** 실질 코드/설정 변경은 이번 PR 전체를 통틀어 여전히 4개 파일뿐이다
  - 위치: `codebase/backend/jest.config.ts`, `codebase/backend/package.json`,
    `codebase/backend/test/jest-e2e.json`,
    `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`
  - 상세: `git diff origin/main...HEAD --stat` 전체 75개 파일 중 `dependencies`/
    `devDependencies`/`pnpm-lock.yaml` 변경은 0건이고, `package.json` diff 는 `scripts`
    블록 10줄에 국한된다(`@nestjs/typeorm`은 diff 전체에서 `^11.0.3` 그대로). 나머지
    71개 파일은 plan 문서 3건(`jest-esm-native-load.md`·`nestjs-v12-coordinated-upgrade.md`
    ·`spec-draft-nullable-notation-followups.md` 추가분)과 `review/code/**`·
    `review/consistency/**` 절차 산출물이다.
  - 제안: 없음.

- **[INFO]** `nestjs-v12-coordinated-upgrade.md`(신규 plan 스텁, 73줄)는 실제 구현이
  아니라 이 PR 을 선행 조건으로 참조하는 후속 작업의 기록일 뿐이다
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` (전체)
  - 상세: `status: in-progress`이지만 본문 제목이 스스로 "스텁 — `jest-esm-native-load`가
    들어간 뒤 착수한다"고 명시하고, `worktree:` frontmatter도 `(unstarted)` sentinel이라
    (3라운드에서 legacy placeholder CRITICAL이 정정된 상태 유지 확인) 아직 어떤 코드도
    이 문서를 근거로 작성되지 않았다. `--impl-prep` consistency-check(`plan_coherence`
    W3)가 요구한 후속 plan 등재에 대한 대응으로 생성된 것으로 보이며, 코드 스코프 확장이
    아니라 "다음에 할 일"의 기록이다.
  - 제안: 없음.

- **[INFO]** 대량 파일 수(75개)의 대부분은 이 저장소가 명문화한 강제 review/fix
  워크플로의 정규 산출물이다
  - 위치: `review/code/2026/09/24/{14_24_10,15_26_17,16_02_28}/**` (46개),
    `review/consistency/2026/09/24/{12_57_36,13_55_20}/**` (14개)
  - 상세: `CLAUDE.md`의 "구현 완료 후 자동 review/fix는 상시 승인된 강제 의무" 조항과
    developer의 `review/**` 쓰기 권한에 따른 산출물이며, 코드 변경 4개 파일 대비 산출물
    파일 수가 압도적으로 많아 보이지만 이는 절차 준수의 부산물이지 스코프 이탈이 아니다.
    이전 3라운드가 각자 독립적으로 같은 결론(NONE)에 도달했다.
  - 제안: 없음.

## 위험도 판단에 영향 없는 참고 (재확인만)

- `PROJECT.md`의 자기-반증형 소정정 문장(§버전·도구 정책)은 이번 델타에서 추가로 손대지
  않았다 — 3라운드까지의 상태(원문 유지 + 정정문 이어붙임, 인접 서술 불변)가 그대로다.
- `test/jest-e2e.json`·`jest.config.ts`의 `transformIgnorePatterns` 원복은 이번 델타에
  포함되지 않았다 — 3라운드까지 확정된 내용 그대로다.

## 요약

4라운드 최종 상태(75개 파일)를 원 작업 의도 기준으로 재검증한 결과, 이 changeset은 여전히
"막힌 dependabot PR을 jest 네이티브 ESM 로딩 전환으로 푼다"는 단일 목적에 수렴한다. 이번
라운드가 직전 라운드(`d184b10d2`) 대비 추가한 것은 (1) 자신의 가드 스펙이 스스로의 W1
지적(순서 미검사)을 놓쳤던 것을 고치는 21줄짜리 최소 수정과 (2) 3라운드 자체의 review
산출물 18개 파일 커밋뿐이며, 둘 다 이 PR의 목적 또는 저장소가 강제하는 review/fix 절차에
정확히 수렴한다. 무관한 리팩터링·기능 확장·포맷팅 뒤섞임·불필요한 임포트·의도치 않은 설정
변경은 발견되지 않았다. Critical/Warning 급 범위 이탈 없음.

## 위험도

NONE
