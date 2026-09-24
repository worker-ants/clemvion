# 문서화(Documentation) 리뷰

## 검토 대상 요약

핵심 코드/설정 변경은 여전히 `PROJECT.md`, `codebase/backend/jest.config.ts`,
`codebase/backend/package.json`, `codebase/backend/test/jest-e2e.json`,
`codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` 5개이고, 나머지 70여 파일은
plan 문서(`jest-esm-native-load.md`·`nestjs-v12-coordinated-upgrade.md`·`spec-draft-nullable-notation-followups.md`
백로그 1건)와 1~3라운드(`14_24_10`·`15_26_17`·`16_02_28`) 리뷰/consistency 산출물의 사후 커밋이다.

이전 세 라운드의 documentation reviewer가 이미 이 diff를 반복 검증했고(1라운드 Critical 1건·
Warning 1건, 2라운드 Warning 1건이 각각 조치·재확인됨), 직접 파일을 열어 대조한 결과 그
조치들은 현재 워킹트리에도 그대로 유지되어 있다 — 재발 없음. 이번 라운드에서 새로 발견한 것은
**3라운드의 RESOLUTION 커밋(`a49b62108`)이 가드 스펙만 고치고, 그 가드를 설명하는 plan 문서의
뮤테이션 표는 갱신하지 않은 것** 1건이다(WARNING).

## 발견사항

- **[WARNING]** plan 문서의 「불변식 가드」 뮤테이션 표가 3라운드에 추가된 뮤턴트 2건(M8·M9)을
  반영하지 않아, 가드의 실제 보호 범위보다 좁게 서술한다
  - 위치: `plan/in-progress/jest-esm-native-load.md:113-122` (`**뮤테이션 — 넷 다 예측=실측:**`
    표, M1~M4만 나열) — 대조 대상은 `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts:83-105`
    (현재 파일의 순서·존재 이중 단언, `it('jest 를 띄우는 script 전부가 같은 플래그·진입점을 쓴다', …)`)
    와 commit `a49b62108`("test(backend): 3라운드 — 내 가드가 「존재 검사 ≠ 정합 검사」를 스스로 범했다")
  - 상세: `git log --oneline -- plan/in-progress/jest-esm-native-load.md
    codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`로 확인하면, 3라운드 리뷰가 지적한
    "census 가드가 플래그·진입점의 **존재**만 보고 **순서**는 안 본다"는 Warning을 고친 커밋
    `a49b62108`는 `esm-native-load.spec.ts` **한 파일만** 바꿨고(`git show --stat a49b62108` →
    `1 file changed`), `plan/in-progress/jest-esm-native-load.md`는 그 이후로 한 번도 수정되지 않았다.
    그 결과 plan 문서의 "**뮤테이션 — 넷 다 예측=실측**" 절은 여전히 M1~M4(플래그 제거·허용목록
    복원·e2e 발산·canary 공허성)만 나열하고, 정확히 이 가드가 이후 자기 자신에게서 재현한 "존재
    검사 ≠ 정합 검사" 결함과 그 수정(M8 순서 뒤집기·M9 플래그 완전 제거 시 존재 단언이 잡는지)은
    plan 문서 어디에도 없다 — 오직 `review/code/2026/09/24/16_02_28/RESOLUTION.md`에만 기록돼 있다.
    이 plan 문서는 이 작업의 SoT이자 향후 `plan/complete/`로 이동할 문서이므로, 리뷰 산출물
    (`review/code/**`)로만 남기고 plan 자체를 갱신하지 않으면 다음에 이 가드의 커버리지를 확인하려는
    사람이 review 세션 히스토리를 다시 뒤져야 한다. 내용 자체가 틀린 것은 아니지만("넷 다
    예측=실측"이라는 서술은 그 넷에 대해서는 참이다), 가드가 실제로 지키는 불변식의 개수·성격을
    plan만 보고 판단하면 **과소평가**하게 된다.
  - 제안: `plan/in-progress/jest-esm-native-load.md`의 해당 표에 M8·M9 행을 추가하고("넷 다"를
    "여섯 다"로 정정), 이 수정이 3라운드 자체 리뷰에서 나온 후속 조치임을 한 줄로 남길 것. 이
    plan을 `complete/`로 옮기기 전에 처리하면 비용이 가장 낮다.

- **[INFO]** 나머지 항목은 1~3라운드가 이미 검증·재확인함 — 재-flag 없음
  - 위치: `codebase/backend/jest.config.ts:3-11`(헤더)·`:19-41`(`transformIgnorePatterns` 인라인 주석),
    `PROJECT.md`의 "테스트 프레임워크 이원화" 문단, `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`
    전체, `plan/in-progress/spec-draft-nullable-notation-followups.md`의 신규 백로그(12개 전수 목록),
    `codebase/backend/README.md:21-23`
  - 상세: 직접 재확인한 결과 (a) `jest.config.ts` 헤더·인라인 주석은 여전히 현재 설정과 정확히
    일치한다(허용목록 부재가 의도적임을 설명, 게이트가 Node 버전이 아니라
    `--experimental-vm-modules` 플래그라는 점, 두 변경이 "한 쌍"이라는 불변식, `import.meta.url`
    downlevel 불가 사례를 전부 포함). (b) `PROJECT.md` 정책 문단의 트리거 발화 기록은 반증이
    아니라 사실 보강이고 "backend만 검증, packages/*는 미검증"이라는 경계도 여전히 정확하다.
    (c) `spec-draft-nullable-notation-followups.md`의 pathspec 목록은 2라운드에서 8개→12개로
    자기 정정됐고, `sed -n '/pathspecs: |/,/^      relevant/p' .github/workflows/frontend-checks.yml`로
    재확인해도 12개와 일치한다. (d) `README.md`의 스크립트 표는 `npm run test` 등 스크립트 *이름*만
    나열하고 이름은 이번 PR로 바뀌지 않아 갱신 불요라는 판단이 유효하다. (e) CHANGELOG 미갱신
    판정("빌드/테스트 tooling 변경은 제품 동작·배포 의존성 불변")과 그 판정 기준 자체가
    `PROJECT.md`에 성문화돼 있지 않다는 메타 이슈는 이미 `spec-draft-nullable-notation-followups.md`에
    별도 백로그(2026-09-24 등재, "간단하지 않은 이유"까지 포함)로 정확히 등재돼 있어 중복 지적하지
    않는다.
  - 제안: 없음(이미 추적됨).

## 요약

이번 diff의 문서화 완성도는 3라운드에 걸친 반복 검증을 통과할 만큼 예외적으로 높다 —
`jest.config.ts`/가드 스펙/`PROJECT.md`의 인라인 문서는 실제 설정·측정과 정확히 일치하고,
README·CHANGELOG 갱신 불요 판정도 근거가 있으며 그 판정 기준의 미문서화 자체도 이미 백로그에
등재돼 있다. 이번 라운드의 유일한 새 발견은 3라운드 자체 리뷰가 만든 후속 커밋(`a49b62108`,
가드의 순서 검증 누락 수정)이 가드 스펙 파일만 고치고 그 가드를 서술하는 plan 문서의 뮤테이션
표(M1~M4)는 갱신하지 않아, plan만 읽으면 가드가 실제로 지키는 불변식 수를 과소평가하게 되는
점이다(WARNING 1건, blocking 아님). 새로운 CRITICAL은 없다.

## 위험도
LOW
