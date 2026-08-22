# RESOLUTION — 14_26_47

대상 SUMMARY: `review/code/2026/08/22/14_26_47/SUMMARY.md` (위험도 **LOW**, Critical **0**, **WARNING 0**, INFO 11)

**처분: 수렴.** WARNING 0. 값싼 INFO 2건만 조치했다.

---

## 수렴 판정

| 라운드 | Critical | Warning | 성격 |
|---|---|---|---|
| `14_02_49` | 0 | 2 | **소비처를 하나만 보고 pathspec 삭제** · 핵심 불변식이 수동 실측뿐 |
| `14_26_47` | 0 | **0** | INFO 만 — 대부분 "확인 기록" 또는 향후 확장 참고 |

직전 라운드 WARNING 2건이 **코드와 자동 회귀 테스트로 해소됐음을 리뷰어가 소스 대조·테스트
실행(뮤테이션 재현 포함)으로 재확인**했다(INFO 8). `documentation` 은 실질 발견 0건이다.

## 조치한 INFO

### INFO 1 — plan 체크박스가 라운드1 정정과 **반대로** 서술돼 있었다 (maintainability·scope)

*"pathspec 을 되돌리고 주석도 함께 지운다"* 로 적힌 항목이 `[x]` 인데, 라운드1 W1 정정으로
실제로는 **pathspec 을 유지하고 근거만 교체**했다. 체크박스는 실제 상태여야 한다.

문구를 사실대로 고치고, **왜 지웠다가 되돌렸는지**(소비처를 하나만 보고 판단 →
`typescript-toolchain-guard.ts:173` 실측으로 반증)를 그 자리에 남겼다.

### INFO 2 — `REPO_GUARDS_MUST_COVER` 가 손 목록 (maintainability)

삭제된 `resolveScanDirs` 주석이 세운 *"손 목록 지양"* 원칙과 반대 방향이라는 지적. 다만
**여기서는 손 목록이 옳다** — 파생하면 `codebase/**` 와 같은 소스를 보게 돼 *"pathspec 이
스택을 덮는가"* 를 자기 자신에게 묻는 꼴이 되고 항상 참이 된다. 그 이유와 "새 스택이 생기면
함께 늘려라" 를 주석으로 남겼다.

> 리뷰어도 실패 방향이 **검증 범위 축소(fail-open 아님)** 라 안전하다고 판정했다.

## 미조치 INFO (9건)

전부 "조치 불요·기처분·문서화된 트레이드오프·긍정 확인". 크로스스택 가드가 frontend 트리에
사는 것 · `repo-guards.yml` 이 잡 하나 전용 골격인 것 · 중복 실행 · `checkout@v7` 태그 고정 ·
파일명 관례 · 리뷰 산출물 포함.

## 검증

TEST WORKFLOW 4단계 PASS + ratchet + 하네스 —

| 단계 | 결과 |
| --- | --- |
| lint | PASS (50s) |
| unit | backend jest **430 suites** · frontend **287 files** |
| build | PASS (112s) |
| 타입체크 ratchet | **199건 / 38파일 baseline 일치** |
| e2e | PASS (205s) — backend supertest **276** · playwright **51** |
| 하네스 | **OK** (17건) |
