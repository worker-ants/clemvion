# 문서화(Documentation) 리뷰 — nestjs12-upgrade (`@nestjs/typeorm` 12 범프)

## 발견사항

- **[WARNING]** `nestjs-v12-coordinated-upgrade.md` frontmatter `worktree:` 가 본문 서술과 어긋난다
  - 위치: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` frontmatter 5번째 줄
    (`worktree: (unstarted)` — 이번 diff 의 context 줄, 값 자체는 이번 커밋에서 갱신되지 않음)
  - 상세: `.claude/docs/plan-lifecycle.md` §4 는 `(unstarted)` 를 "아직 worktree 가 없는 **미착수**
    plan" 전용 sentinel 로 명시하고, "착수 시 실제 `<task>-<slug>` 로 교체" 하라고 규정한다. 그런데
    이번 커밋이 다시 쓴 본문 §0 은 "전 패키지를 12 로 올리고 `pnpm install` → `run-test.sh build`
    까지 **실제로 돌려 본 결과**", "`@nestjs/*` 전면 12 업그레이드를 **착수했다가** 세 벽에 막혀
    **되돌렸다**" 라고 명시적으로 서술한다 — 즉 본문은 실측(Docker 빌드 실패 로그, `--traceResolution`
    추적 등)까지 동반한 실제 착수·롤백을 기술하는데, frontmatter 는 여전히 "착수 전" 상태를
    주장한다. 같은 diff 의 형제 문서(`plan/in-progress/deps-typeorm12.md`)는 `worktree:
    nestjs12-upgrade` 로 올바르게 채워져 있어, 이번 세션이 실제로 그 worktree 에서 작업했다는
    사실과도 대조된다.
  - 이 필드는 순수 장식이 아니다 — `plan-lifecycle.md` §3 "연결 판정" 이 push-gate(`plan_guard.py`)
    에서 "in-progress plan frontmatter 의 `worktree:` 가 현재 worktree 디렉토리와 매칭되는 plan"
    을 찾는 데 이 값을 그대로 쓰고, `plan-stale-audit.sh` 도 이 값으로 살아있는 worktree 인지
    판정한다. 지금 상태로는 이 plan 이 실제로 언제·어느 worktree 에서 착수·롤백됐는지 그 흔적이
    frontmatter 에 남지 않는다(다만 같은 커밋의 `deps-typeorm12.md` 가 올바른 worktree 를 갖고
    있어 push-gate 연결 판정 자체는 이 세션에서 우회 없이 통과한다 — 차단 위험은 없고, 문서
    정확성 문제로만 남는다).
  - 제안: 실제로 착수·롤백이 일어난 worktree 이름(추정컨대 이 세션 `nestjs12-upgrade` 자신, 혹은
    그 이전 세션의 이름)으로 `worktree:` 를 갱신하거나, "착수했다가 전량 롤백해 커밋된 코드가
    없으므로 의도적으로 `(unstarted)` 를 유지한다" 는 취지를 본문에 한 줄 남겨 sentinel 값과
    서술이 왜 어긋나 보이는지 설명할 것.

- **[INFO]** `pnpm-lock.yaml` 의 drive-by 잡음이 plan 문서의 "한 줄" 서술과 규모 차이가 크다
  - 위치: `pnpm-lock.yaml` (diff 다수 hunk — `@css-inline/*`·`@img/sharp-*`·`@napi-rs/canvas-*`·
    `@next/swc-*`·`@parcel/watcher-*`·`@rolldown/binding-*`·`@tailwindcss/oxide-*`·
    `@unrs/resolver-binding-*`·`lightningcss-*` 의 `libc:` 필드 제거 다수 + `eslint-plugin-import`/
    `eslint-import-resolver-typescript` peer 해석 문자열 변경 2곳)
  - 상세: `deps-typeorm12.md` §B 는 "`@nestjs/typeorm`: `^11.0.3` → `^12.0.1`. 그 외 `@nestjs/*`
    는 11 유지... 그래서 이 PR 은 한 줄이다" 라고 서술하는데, 실제 `pnpm-lock.yaml` diff 는
    `@nestjs/typeorm` 과 무관한 십수 개 optional-native 패키지의 `libc:` 필드 제거·eslint 관련
    peer 해석 문자열 변경까지 포함한다(전형적인 `pnpm install` 재해석 잡음으로 보이며, 실제 결함
    신호는 아닌 것으로 판단됨). 문서의 "한 줄이다" 는 `package.json` 소스 선언 기준으로는 정확하지만,
    lockfile 전체 footprint 를 두고 보면 다음 사람이 diff 크기에 놀라 원인을 재조사할 수 있다.
  - 제안: `deps-typeorm12.md` §B 에 "lockfile 에는 `@nestjs/typeorm` 과 무관한 optional-native
    패키지 `libc:` 필드 제거 등 pnpm 재해석 잡음이 동반된다 — 의도한 변경이 아니며 별도 조치
    불필요" 한 줄만 추가해도 충분하다.

## 그 외 확인한 항목 (문제 없음)

- `codebase/backend/package.json`: 단일 캐럿 버전 변경(`^11.0.3` → `^12.0.1`), 별도 독스트링/README
  갱신 불필요. `engines.node` (`>=24`) 는 `@nestjs/typeorm@12.0.1` 의 `engines.node
  '>=20.19.0'` 요구보다 넓어 문제 없음.
- `deps-typeorm12.md`·`nestjs-v12-coordinated-upgrade.md` 본문: peer 표·기준값·검증 절차 서술이
  실제 `pnpm-lock.yaml` diff·`plan/complete/jest-esm-native-load.md` 존재 여부와 대조해 전부
  일치함을 확인(`@nestjs/typeorm@12.0.1` peer `^10||^11||^12`, `@nestjs/common@11.1.27` 위에
  얹힘, `#1387`/`0b5b226b3` 가 main 에 실재).
- `spec/5-system/1-auth.md` §Rationale 의 `^11.0.1` 캐럿 인용 stale 화 — 이미 이번 diff 에 포함된
  `review/consistency/.../plan_coherence.md` WARNING 과 `SUMMARY.md` WARNING #3 이 선행 발견했고,
  `deps-typeorm12.md` "후속" 절이 "이 PR 은 `@nestjs/common` 을 건드리지 않으므로 그 문장은
  여전히 참" 이라 정확히 서술하며 planner 턴으로 명시 이관했다 — 중복 지적 불필요.
- `review/consistency/2026/09/24/17_31_27/**` 8개 산출물: 프로젝트 컨벤션(`review/consistency/<날짜>/`)
  대로 생성된 감사 산출물이며 자체 진술이 소스(줄 번호·peer 값 등)와 대조해 정확함.
- `CHANGELOG.md` 미변경: 선행 사례(`0b5b226b3` jest-ESM 빌드 커밋)도 CHANGELOG 를 건드리지 않은
  순수 `build(backend)` 범주 커밋이라 이번 무동작-회귀 의존성 범프에도 CHANGELOG 항목이 없는 것이
  이 저장소 관행과 일치한다.

## 요약

실질 코드 변경은 `package.json` 한 캐럿 버전 범프뿐이라 독스트링·API 문서·예제 코드 관점에서는
다룰 대상이 없고, plan 문서(`deps-typeorm12.md`, `nestjs-v12-coordinated-upgrade.md`) 는 실측
수치·peer 표·전/후 검증표를 갖춘 이례적으로 높은 품질의 문서화다. 다만 (1) 코디네이트 plan 의
`worktree` frontmatter 가 "착수했다가 롤백했다" 는 본문 서술과 모순되는 `(unstarted)` 로 남아
있고, (2) `pnpm-lock.yaml` 의 무관한 drive-by 잡음이 "한 줄" 이라는 plan 서술 규모와 어긋난다.
둘 다 차단 사유는 아니며 한두 문장 보완으로 해소된다.

## 위험도

LOW
