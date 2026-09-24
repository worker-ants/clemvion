# 변경 범위(Scope) 리뷰 — jest ESM 네이티브 로드 전환

## 검토 방법

리뷰 대상 13개 파일(코드/설정 3 · plan 문서 2 · consistency-check 산출물 8)을 전부 대조했다.
`plan/in-progress/jest-esm-native-load.md`(파일 4)에 적힌 작업 의도 — 「막힌 dependabot PR
(`#1339` `@nestjs/typeorm`)이 CJS jest 로는 로드 불가능한 ESM-only 패키지에 막혀 있었고,
그 해법으로 jest 를 `--experimental-vm-modules` 로 네이티브 ESM 로더로 전환하면서 손으로
유지하던 `transformIgnorePatterns` 허용목록을 걷어낸다」 — 를 기준으로 각 파일 변경이
그 범위 안에 있는지 대조했다.

## 발견사항

- **[INFO]** `jest.config.ts` 의 신규 주석 블록이 23줄로 길다
  - 위치: `codebase/backend/jest.config.ts:17-38`
  - 상세: `transformIgnorePatterns` 를 허용목록에서 기본값(`['/node_modules/']`)으로 되돌리는
    실질 변경은 한 줄인데, 그 근거를 설명하는 주석이 23줄이다. 다만 이 파일 자신의 헤더
    주석(`codebase/backend/jest.config.ts:3-9`, 변경 전부터 존재)이 "JSON 은 주석을 못 담으니
    이 파일에 그 근거를 적는다"고 이미 명시하고 있고, 주석 내용도 (a) 게이트가 Node 버전이
    아니라 플래그라는 실측, (b) 두 변경(이 파일 + `package.json`)이 되돌릴 수 없는 쌍이라는
    경고처럼 다음 사람이 부분 되돌리기를 하다 망가뜨리는 것을 막는 정보다. 범위 이탈이라기
    보다는 이 저장소의 기존 관행(설정 파일에 실측 근거를 남기는 것)을 그대로 따른 것으로
    판단해 CRITICAL/WARNING 이 아닌 INFO 로 남긴다.
  - 제안: 없음 (조치 불요, 참고용 기록).

- **[INFO]** `plan/in-progress/nestjs-v12-coordinated-upgrade.md` 는 이번 PR 이 하지 않는
  후속 작업의 스텁이다
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` 전체(신규 파일)
  - 상세: 이 plan 문서는 `@nestjs/*` 전체 12.x 동반 업그레이드(별도 PR)를 다루며, 이번
    diff 의 실제 코드 변경(jest 로더 전환)과는 직접 관련이 없다. 다만 frontmatter 가
    `worktree: (미정 — 착수 시 생성)` 로 아직 시작되지 않은 스텁임을 명시하고, 동봉된
    `review/consistency/2026/09/24/13_55_20/plan_coherence.md` WARNING(`@nestjs/common`
    동반 업그레이드 후속 plan 미등재)에 대한 직접 대응으로 생성됐다는 인과가 파일 4·6·12에서
    확인된다. 즉 코드를 건드리지 않고 "다음에 할 일"을 기록만 한 것이라, 기능 확장이나
    작업 범위 이탈이 아니라 정합성 게이트가 요구한 후속 조치로 판단된다.
  - 제안: 없음 (조치 불요, 참고용 기록).

- **[INFO]** 리뷰 대상 diff 밖에서 관측된 미커밋 잔여물 — `review/consistency/2026/09/24/12_57_36/`
  - 위치: 조립 프롬프트 대상 파일 목록에는 없음(diff 밖) — 대화 시작 시점 `git status`
    스냅샷에 `?? review/consistency/2026/09/24/12_57_36/` 로 잡힘
  - 상세: `plan/in-progress/nestjs-v12-coordinated-upgrade.md`(파일 5) §C 는 이 경로를
    "`--impl-prep` `review/consistency/2026/09/24/12_57_36` `plan_coherence` W3" 로 인용하고
    있어 실제로 존재했던 검토 세션으로 보이는데, 이번 diff 에는 `13_55_20` 세션 산출물만
    포함되고 `12_57_36` 은 포함돼 있지 않다. diff 자체의 범위 이탈은 아니지만(참조만 하고
    수정하지 않음), 인용된 근거 문서가 이 changeset 에 영속화되지 않은 상태라는 점은
    참고로 남긴다 — Scope 관점의 결함은 아니고 완전성 관점의 관찰이다.
  - 제안: 필요 시 해당 세션도 커밋에 포함할지 확인.

## 요약

3개 실질 코드/설정 변경(`jest.config.ts`, `package.json` 스크립트 5곳, `test/jest-e2e.json`)은
전부 "jest 를 `--experimental-vm-modules` 네이티브 ESM 로더로 전환하고 그와 짝을 이루는
`transformIgnorePatterns` 허용목록을 걷어낸다"는 단일 목적에 정확히 수렴하며, 무관한 리팩터링·
포맷팅·임포트 정리·의존성 버전 변경은 발견되지 않았다. 함께 추가된 2개 plan 문서와 8개
consistency-check 산출물은 이 저장소의 명문화된 워크플로(구현 착수 전 `--impl-prep` 의무,
`plan/**`·`review/**` 는 developer 소유 산출물)가 요구하는 정규 절차 결과물이지 요청 범위를
벗어난 부가 작업이 아니다. 후속 NestJS 12 동반 업그레이드 plan 스텁도 실제 구현이 아니라
consistency-check WARNING 에 대한 직접 대응으로 생성된 기록물이다. 전반적으로 범위 이탈·
과잉 엔지니어링·무관한 수정 신호가 없는, 매우 좁고 일관된 변경이다.

## 위험도

NONE
