# 요구사항(Requirement) 리뷰

## 검토 범위 확인
`git diff origin/main --stat` 결과 이 PR 은 정확히 5개 파일만 건드린다: `codebase/backend/package.json`,
`.../expression-resolver.service.spec.ts`, `.../code.handler.spec.ts`,
`plan/in-progress/deps-peer-gating-and-eslint10.md`, `pnpm-lock.yaml`. 프로덕션 소스
(`expression-resolver.service.ts`, `code.handler.ts`) 자체는 이 PR 에서 **변경되지 않는다** —
`git diff origin/main` 결과 두 파일 모두 빈 diff. 즉 `cause: err` 부착은 이전 PR(`#1219`)에서
이미 커밋됐고, 이번 PR 은 그 위에 회귀 테스트 2건 + devDependency 정리 + plan 문서 갱신만 얹는다.

## 실측 검증

1. **소스-테스트 정합성**: `expression-resolver.service.ts:317`(`cause: err`)·
   `code.handler.ts:454`(`cause: err`)가 실제로 존재하며 신규 테스트 두 건의 단언과 정확히
   일치한다.
2. **뮤테이션 실측 재현** — plan 문서가 주장한 "두 곳의 `cause: err` 제거 시 신규 2건 RED,
   기존 131건 GREEN"을 직접 재현했다: 두 파일에서 `cause: err` 를 제거한 뮤턴트를 적용해
   `jest`를 돌리자 정확히 신규 케이스 2건만 실패(`expression-resolver` 는
   `toBeInstanceOf(Error)` 에서, `code.handler` 는 `toBeDefined()` 에서)하고 기존 131건은
   GREEN 이었다(`Tests: 2 failed, 131 passed, 133 total`). 뮤턴트는 `git checkout --` 로 원복,
   `git status --short` 로 작업트리 클린 확인 완료.
3. **devDependency 제거 정합성**: `@eslint/eslintrc` 가 backend 코드베이스 전체(`import`,
   `FlatCompat`, `.eslintrc*`)에서 사용처 0건임을 grep 으로 재확인. 제거 후 대상 4개 파일에
   `eslint --max-warnings 0` 을 직접 돌려 위반 0건 확인.
4. **lockfile 정합성**: `pnpm-lock.yaml` 에서 `@eslint/eslintrc` 스냅샷 엔트리가 여전히 남아
   있음을 확인 — frontend/channel-web-chat 이 아직 eslint 9 를 쓰므로 그쪽 경로로 계속
   유입된다는 plan 의 설명과 일치. `pnpm-workspace.yaml`의 CVE 수용 주석(`@eslint/eslintrc >
   minimatch@3.1.5 > brace-expansion@1.1.18`)도 이 경로가 살아있는 한 계속 유효하므로
   "건드리지 않았다"는 plan 서술과 모순 없음.
5. **비대칭 처리(secret-resolver) 확인**: `secret-resolver.service.ts` 는 `cause: err` 를 달지
   않고 `eslint-disable-next-line preserve-caught-error` + SS-SE-05 근거 주석만 있음을 확인 —
   plan 이 설명하는 "message 가 원문을 이미 담고 있는가"라는 처분 기준과 일치(암호화 실패
   메시지는 의도적으로 원인을 감추므로 cause 부착이 안전하지 않음).
6. **eslint rule 존재 확인**: `preserve-caught-error` 규칙이 실제로 `@eslint/js@10` 의
   `eslint-recommended.js` 에 `"error"` 로 등록돼 있음을 확인 — 테스트 주석의 기술적 근거가
   사실에 부합.
7. TODO/FIXME/HACK/XXX 신규 도입 없음(diff grep 0건).
8. 신규 테스트 둘 다 vacuity 방지 단언(`expect(thrown).toBeInstanceOf(Error)`)을 먼저 두어,
   예외가 던져지지 않는 경우에도 통과해버리는 결함을 차단함.

## 발견사항

- **[INFO]** spec fidelity — 이 PR 이 다루는 `cause` 체이닝은 순수히 eslint 10
  `preserve-caught-error` 규칙 대응을 위한 내부 구현 디테일이며, `spec/5-system/5-expression-language.md`
  등 관련 spec 문서 어디에도 에러 `cause` 체계약을 규정하는 본문이 없다(grep 0건). 사용자
  대면 계약(에러 메시지 포맷 `Expression error in config.${path}: ...`, `code has a syntax
  error: ...`)은 이 PR 이전과 동일하게 유지되므로 spec 위반이 아니다 — 애초에 spec 이 침묵하는
  회색지대.
  - 위치: `spec/5-system/5-expression-language.md` (해당 없음), `codebase/backend/src/nodes/data/code/code.handler.ts` (spec 문서 부재)
  - 제안: 조치 불요. plan 자체도 "판별 기준 명문화는 여전히 planner 턴" 이라고 명시해 뒀으므로
    향후 `spec/conventions/`에 반영될 때 함께 정리하면 됨.

- **[INFO]** `pnpm-lock.yaml` diff 중 `@jest/core@30.4.2` / `jest-config@30.4.2` 비-매개변수화
  스냅샷 엔트리가 삭제되고 매개변수화 엔트리(`...(ts-node@10.9.2(...))`)로 대체되는 구간이
  있다. 이는 `@eslint/eslintrc` 제거로 인한 `pnpm install` 재해석의 부수 효과로 보이며 —
  실제 패키지 버전 변경은 없고 해시 키 형태만 바뀐 것으로, 이 PR 의 목적(devDependency 정리)
  범위 밖의 collateral 이지만 기능적 영향은 없어 보인다(테스트 133/133 GREEN, lint clean).
  - 위치: `pnpm-lock.yaml` (diff 상단 `@@ -11739,42 +11736,6 @@` 부근)
  - 제안: 조치 불요, 참고용 기록. 향후 유사 lockfile diff 리뷰 시 "의도한 변경 외 collateral
    dedup" 패턴으로 인지해 두면 편함.

발견된 CRITICAL/WARNING 없음.

## 요약

이 PR 은 실질적으로 프로덕션 동작을 바꾸지 않는다 — `cause: err` 부착은 이전 PR 에서 이미
반영됐고, 이번 PR 은 (1) 그 계약을 잠그는 회귀 테스트 2건 추가, (2) 사용처 0건인 backend
devDependency(`@eslint/eslintrc`) 제거, (3) 그 결정을 기록한 plan 문서 갱신, (4) 그에 따른
lockfile 갱신으로 구성된다. 소스-테스트 정합성, 뮤테이션 유효성(신규 2건만 RED), devDependency
무사용 근거, lockfile 상의 frontend 경로 잔존 근거를 모두 직접 재현·검증했으며 전부 plan 문서의
주장과 정확히 일치했다. TODO/FIXME 없음, vacuity 방지 처리됨, 에러 시나리오·엣지케이스는 이미
기존 테스트가 폭넓게 덮고 있고 신규 테스트는 그 위에 좁고 정확한 계약(cause 보존)만 추가한다.
관련 spec 문서는 이 내부 구현 디테일에 대해 침묵하므로 spec fidelity 위반도 없다(INFO 처리).
요구사항 충족 관점에서 결함 없음.

## 위험도

NONE
