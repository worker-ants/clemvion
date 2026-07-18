# RESOLUTION — review/code/2026/07/18/12_06_58 (§F: mermaid-lint 취약점 + Dependabot)

전체 위험도 **MEDIUM, Critical 0, WARNING 2.** 취약점 패치 자체는 6 reviewer 전원이 실측 재현으로
정확 확인. WARNING 2건 처리:

| # | 분류 | 조치 |
|---|---|---|
| W1 | 코드 fix | side_effect MEDIUM. 마커가 lockfile 을 안 봐서 **이미 bootstrap 된 checkout 은 이 보안 픽스가 머지돼도 재설치 안 돼 취약 버전 잔존**, 게다가 **모든 미래 Dependabot 보안 PR(lockfile-only)마다 구조적 재발**. 직접 검증(마커 = 빈 파일, `[ ! -f marker ]` 게이트). → **마커 content 를 package-lock.json 해시에 결속**, 불일치 시 재설치. 해시 도구 부재 시 presence-only 폴백. 테스트 2건 + presence-only 뮤턴트 비-vacuity. |
| W2 | 문서 fix | documentation LOW. PROJECT.md 의존성 거버넌스 절이 pnpm audit 만 서술 → 신설 Dependabot npm 경로(pnpm 밖 독립 트리 커버) 1문장 추가. |
| I1 | 확인(무변경) | dependency: CVE 해소 실측 재현·integrity 정상·breaking 없음. 조치 완료. |
| I2 | 문서 fix | dependabot 주석이 "security update" 라 했으나 실제는 version-update 스키마. 스케줄 vs repo security-updates 토글 구분해 정밀화. |
| I3 | defer | requirement: e2e.yml `paths-ignore` 에 `.github/**` 누락(선재 정책-구현 drift). diff 밖 → plan §F 잔여 등록. |
| I4~I9 | 무변경 | scope·CHANGELOG·package.json `"*"` range·frontmatter worktree 불일치 등 리뷰어가 "조치 불요"/"정당"/"선재" 표기. |

## 핵심 — F 를 반쪽에서 온전하게

W1 이 없었다면 F 는 **fresh install 만 고치고 기존 checkout·미래 보안 PR 은 못 미치는** 반쪽 픽스였다.
마커-해시 결속이 그걸 닫는다: lockfile 이 바뀌면(dep bump = 모든 보안 PR 의 형태) 다음 SessionStart 가
재설치한다. F 의 진짜 목표("deps 를 안전하게 **유지**")와 일치하는 확장이라 같은 PR 에 포함.

## 테스트
- harness 303 통과(신규 2건). plan-frontmatter 통과. e2e 면제(`.github/**`·`.claude/**`·`plan/**`).
