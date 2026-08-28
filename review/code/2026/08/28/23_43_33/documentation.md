# 문서화(Documentation) 리뷰

## 컨텍스트

이 diff 는 직전 리뷰 라운드(`review/code/2026/08/28/23_20_05`)의 SUMMARY.md 가 지적한
Warning #1(SoT drift)·#2(`packages:` 섹션 미한정)·#3(`~` 연산자 미커버)에 대한 조치 커밋이다.
아래는 그 조치 자체와, 조치로 새로 추가/수정된 문서·주석·독스트링을 검증한 결과다.

## 검증 방법

- `codebase/frontend/eslint.config.mjs` 헤더(SoT)와 `eslint10-unblock-guard.ts` 의 `BLOCKERS`
  배열(차단자 4개)이 일치하는지 대조.
- 새 가드 파일(`eslint10-unblock-guard.ts`, `eslint10-unblock.test.ts`)이 인용하는 형제 파일
  (`typescript-toolchain.test.ts`, backend `eslint-unicorn-peer.spec.ts`, `_shared.ts` 의
  `ROOT` export)이 실제로 존재·export 되는지 `Read`/`grep` 으로 확인.
- 주석이 인용하는 커밋 해시(`ef3617a79`)·PR 번호(`#1219`)를 `git log` 로 실측.
- `plan/in-progress/deps-peer-gating-and-eslint10.md` 를 전체 `Read` 하여 diff 로 실리지 않은
  본문(§범위 실측 표, 체크리스트 §2)과 정정 블록의 정합성 확인.
- `RESOLUTION.md`/`SUMMARY.md` 가 인용한 줄 번호·테스트 개수(`15/15`)를 `vitest run` 실행 결과와
  대조 — **실측: `Test Files 1 passed / Tests 15 passed`**, 문서 기재값과 일치.
- `termMajorFloor` 정규식에 `~` 가 포함돼 있는지 소스 확인(조치 완료 확인).

## 발견사항

- **[INFO]** `plan/in-progress/deps-peer-gating-and-eslint10.md` 의 §2 체크리스트 항목(`- [x] §2 eslint 10 상향 — 11개 중 9개 완료...`)은 여전히 차단자를 "react/jsx-a11y/import" 세 플러그인으로만 서술한다.
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md` 238행 부근(`eslint-config-next 의 react/jsx-a11y/import 플러그인이 latest 조차 eslint 9 상한이다`)
  - 상세: 4번째 차단자(`eslint-plugin-react-hooks`, 우리 트리 exact 핀)를 밝히는 정정 블록은 같은 문서 185행(`### ⚠️ 정정 (2026-08-28 후속 턴)`)에 별도로 존재하고, §범위 실측 표 바로 뒤에 붙어 있어 실제로 stale 하지는 않다. 다만 체크리스트 항목만 훑는 독자는 3개짜리 옛 결론만 보고 넘어갈 수 있다. 같은 문서 296~300행의 "완료(2026-08-28)" 항목은 "차단자 4개"라고 정확히 적어 두었으므로 문서 내부적으로는 모순 없이 갱신돼 있다.
  - 제안: 급하지 않음. 원한다면 §2 체크리스트 항목 끝에 "(→ 4번째 차단자는 아래 정정 참고)" 한 구절만 추가하면 완전히 닫힌다.

## 긍정적으로 확인된 사항 (참고)

- 이전 라운드 Warning #1(SoT drift) — `codebase/frontend/eslint.config.mjs` 헤더가 이번 diff 에서 "차단자는 넷"으로 정정됐고, `eslint10-unblock-guard.ts` 의 `BLOCKERS` 배열(4개)과 항목·근거(react-hooks 의 `ours`/exact pin/`ef3617a79`)가 정확히 일치한다. `#1219`, `ef3617a79` 커밋 참조 모두 `git log` 로 실측 확인됨.
- 이전 라운드 INFO #8(`readLockfile()` JSDoc 누락) — 한 줄 JSDoc 이 추가됐다. 파일 내 모든 export 가 이제 문서화돼 있다.
- 새 가드 파일 두 개(`eslint10-unblock-guard.ts`, `eslint10-unblock.test.ts`)의 헤더·함수 JSDoc 은 "왜"(lockfile 을 읽는 이유, `packages:` 섹션 한정이 구조적으로 필요한 이유, fail-closed 로 던지는 이유)를 실측과 함께 상세히 남겨 이 저장소의 repo-guard 관례와 일치한다.
- 형제 파일 교차 참조(`typescript-toolchain.test.ts`, backend `eslint-unicorn-peer.spec.ts`, `_shared.ts` 의 `ROOT`)가 전부 실재 확인됨 — 죽은 링크 없음.
- 새 코드는 테스트 전용 repo-guard + plan 문서 갱신이라 README·API 문서·CHANGELOG 갱신 대상이 아니다. `CHANGELOG.md` 는 런타임/운영 영향이 있는 변경만 기록하는 확립된 관례(전 항목이 사용자·운영 영향 서술)이고, 이번 변경은 devDependency 툴체인 내부 가드일 뿐이라 이 관례상 항목 추가 불요.
- `RESOLUTION.md` 의 테스트 개수 주장("이 파일 15/15")을 `vitest run` 으로 재현 — 정확히 일치.

## 요약

직전 리뷰가 지적한 세 건(SoT drift, `packages:` 섹션 미한정, `~` 연산자 미커버)에 대한 조치가 모두 코드·문서·주석 수준에서 정확하게 반영됐다. 새로 추가된 두 파일의 JSDoc/헤더 주석은 이 저장소의 repo-guard 관례에 맞게 "왜"를 실측과 함께 충실히 남겼고, 상호 참조(형제 파일·커밋 해시·PR 번호)가 전부 실재를 확인했다. 유일한 잔여 사항은 plan 문서의 체크리스트 한 항목이 옛 "3개 차단자" 서술을 유지하고 있다는 INFO 수준 지적으로, 바로 아래(근접) 정정 블록이 이미 존재해 실질적 오도 위험은 낮다.

## 위험도

NONE
