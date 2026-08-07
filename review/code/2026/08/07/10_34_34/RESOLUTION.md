# RESOLUTION — spec-link 가드 미선언 의존 (10_34_34)

리뷰어 14/14. **CRITICAL 0 / WARNING 1 / RISK LOW.**

## W1 — 내 churn 해명이 틀렸다 (side_effect + scope)

지적이 정확했다. 커밋 메시지에 lockfile churn 을 "버전 변화 없음, ts-jest·jest 의 peer 접미사
재정규화뿐" 이라고 적었는데, 실제로는 **`libc:` 플랫폼 메타데이터 57줄이 함께 사라졌다.**

원인은 내 측정이 프록시였다는 것이다 — `version:` 으로 시작하는 라인만 세어 "버전 증가 4,
감소 0" 을 확인하고 결론을 냈다. `libc:` 는 그 정규식에 걸리지 않는다. **바뀐 라인 전체를 보지
않고 한 필드만 본 셈이다.**

영향이 가설이 아닌 이유: 이 저장소는 backend·frontend 둘 다 **`node:24-alpine`(musl)** 로
빌드한다. `libc: [glibc]`/`libc: [musl]` 은 optional 네이티브 바이너리(lightningcss·sharp·
@next/swc·@tailwindcss/oxide 등)의 variant 선택 근거다.

### 재현과 처분

`pnpm add` 탓이 아니었다. lockfile 을 origin/main 상태로 되돌리고 `pnpm install --lockfile-only`
만 돌려도 **61 → 4** 로 같은 57줄이 사라진다. 즉 이 환경(macOS, pnpm 10.23.0)에서의 재생성
자체가 원인이라 "다시 생성" 으로는 해결되지 않는다.

그래서 재생성 대신 **origin/main 의 lockfile 에 이번 추가분만 얹었다.** `difflib` 로 opcode 를
돌려 `insert` 는 채택하고, `delete` 중 전부 `libc:` 인 청크는 되돌렸다. 검증:

- `libc:` 라인 **61개**(origin/main 과 동일)
- `libc` 외의 삭제·치환 **0건** — 즉 되돌린 것이 정확히 그 필드뿐임이 실측으로 확인된다
- 최종 diff: **15 insertions(+), 0 deletions** (종전 264줄 churn 도 함께 사라졌다 —
  그건 `pnpm add` 의 전체 재해소 부산물이었고 `--lockfile-only` 경로에는 없다)
- `pnpm install --frozen-lockfile` **워크스페이스 전체 exit 0** — pnpm 이 이 lockfile 을
  일관된 것으로 받아들인다
- 대상 테스트 13 passed · harness 862 tests OK

리뷰어가 권고한 "Linux 에서 `--frozen-lockfile` 재현 확인" 은 이제 **diff 에 deletion 이 0** 이라
origin/main 대비 플랫폼 메타데이터가 한 줄도 달라지지 않는다. 그래도 이 PR 의 CI(`e2e` 가
Alpine 이미지를 실제로 빌드한다)가 최종 확인이다.

## INFO 처분

- **I8** (plan 부록 항목 5·7 에 추적 번호 없음) — 항목 5 는 실제로 별도 브랜치에서 처리 중이라는
  지적이 맞다. 표에 브랜치·PR 을 보강했다.
- **I3·I4** (같은 결함 클래스 전수조사 · import-vs-manifest 가드 부재 · 최종 확인은 CI 그린) —
  plan 이 이미 "미확인" 으로 명시한 defer 항목. 유지.
- **I5**(`@aws-sdk/core` deprecated 메타 노출) — 이번 재작성으로 diff 에서 사라졌다.
- **I7**(devDeps 오삭제 방지 주석) · **I9**(plan 파일 누적) — 선택 항목, 미처분.
- **I6** (override 하한 침식) — 별도 트랙으로 이미 분리 명시.
