# 요구사항(Requirement) 리뷰

## 검증 방법 (직접 재현)

- `pnpm vitest run src/lib/repo-guards/__tests__/eslint10-unblock.test.ts` — **15/15 통과** (실측, `codebase/frontend` 에서 실행).
- `pnpm vitest run src/lib/repo-guards/__tests__/` (형제 가드 전체) — **5 files / 117 tests 통과**.
- `pnpm-workspace.yaml` 의 `eslint-plugin-react-hooks: 7.0.1` exact 핀, `pnpm-lock.yaml` 의 `eslint-plugin-react-hooks@7.0.1` peer(`^3.0.0 || … || ^9.0.0`)를 직접 grep/Read 로 대조 — guard·plan·eslint.config.mjs 헤더의 주장과 **일치**.
- `git show ef3617a79 -- pnpm-workspace.yaml` 로 "그 핀에는 근거 주석이 없다"는 주장을 대조 — 해당 커밋은 "보안핀 정규화" 일괄 목록의 한 항목일 뿐 개별 근거 주석 없음, 주장과 **일치**.
- `git log --oneline --all | grep 1219` 로 `#1219` 참조(`eslint10-unblock-guard.ts` 헤더 docstring)를 대조 — `1b17701aa build(deps): eslint 9 → 10 상향 … (#1219)` 확인, **일치**.
- **뮤테이션 재검증(RESOLUTION.md 의 표를 직접 재현)**:
  - `termMajorFloor` 정규식에서 `~` 제거 → `` `~` 항도 major 고정으로 읽는다 `` 케이스 **RED** (재현 확인 후 원복, `git status` 로 clean 복귀 확인).
  - `readPeerRanges` 의 `if (!inPackagesSection) continue;` 무력화 → `snapshots:` 오염 방지 케이스 2건 **RED** (재현 확인 후 원복).
  - 두 뮤턴트 모두 RESOLUTION.md 가 주장한 정확히 그 결과를 재현했다 — 조치가 vacuous 하지 않고 실제로 회귀를 잡는다.
- `spec/` 전체에서 `repo-guards`·`eslint10` 관련 문서를 검색 — 관련 spec 없음(이 영역은 CI 툴체인/의존성 관리이며 `plan/in-progress/deps-peer-gating-and-eslint10.md` 자체가 SoT).

## 발견사항

이번 라운드(`23_43_33`)의 diff 는 직전 라운드(`23_20_05`)가 지적한 3건의 WARNING 을 전부 해소한 결과물이다. 각각을 실측으로 재확인했다.

- **[정보성 확인 — 결함 아님]** 이전 WARNING #1(SoT drift: `codebase/frontend/eslint.config.mjs` 헤더가 "차단자 3개" 옛 결론을 유지)이 이번 diff 로 해소됨을 확인.
  - 위치: `codebase/frontend/eslint.config.mjs:11`(게이트 — `← registry 는 10 지원`로 문구 수정), `:17`-`:26`(신규 경고 단락 — "우리 트리의 차단자는 넷이다").
  - 상세: 실제 파일(`Read` 로 직접 확인)에 `pnpm-workspace.yaml` exact 핀·`ef3617a79` 유입 근거·해제 레버 2종(상류 대기 vs 우리 override)·캐너리 위치(`eslint10-unblock.test.ts`)가 모두 반영돼 있다. `pnpm-lock.yaml`/`pnpm-workspace.yaml` 실측과 문구가 정확히 일치한다.
  - 결론: 조치 완료, 재지적 불필요.

- **[정보성 확인 — 결함 아님]** 이전 WARNING #2(`readPeerRanges` 가 `packages:` 전용이라는 주석 주장이 코드로 강제되지 않음 — `snapshots:` 섹션 오염 가능)가 구조적으로 해소됨을 확인.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts:108`,`113-121`(`inPackagesSection` 추적), 회귀 케이스: `eslint10-unblock.test.ts:181-212`.
  - 상세: `if (!inPackagesSection) continue;` 를 무력화하는 뮤테이션을 직접 넣어 재현 — 회귀 케이스 2건이 정확히 RED 로 전환됨을 확인(위 "검증 방법" 참고). 우연한 안전이 구조적 보장으로 바뀌었다.

- **[정보성 확인 — 결함 아님]** 이전 WARNING #3(`termMajorFloor` 의 `~` 분기가 어떤 테스트로도 도달하지 않음)이 해소됨을 확인.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock.test.ts:125-131`(`` `~` 항도 major 고정으로 읽는다 ``).
  - 상세: 정규식에서 `~` 를 제거하는 뮤테이션을 직접 넣어 재현 — 해당 케이스가 정확히 RED 로 전환됨을 확인.

- **[INFO]** RESOLUTION.md 가 명시적으로 보류한 INFO 항목(`Map.set` 중복 덮어쓰기 등)은 이번 라운드에도 그대로 남아 있으나, 현재 실제 lockfile 기준 4개 차단자 각각 정확히 1개 버전만 해소되어 미관측 상태이고 개발자가 "동작 결함 아님·재무장 방지" 사유로 명시 보류했다 — 새로운 지적 대상 아님.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts:145`(`out.set(current.name, …)`, 최종 라인 번호는 섹션 스코핑 추가로 기존 리뷰가 지목한 `:127` 에서 이동).

- **[INFO]** 관련 `spec/` 본문 부재 — grep 결과 `eslint10-unblock`/`repo-guards` 를 다루는 `spec/` 문서가 없다. 이 영역은 제품 요구사항이 아니라 CI 툴체인 게이트이며 `plan/in-progress/deps-peer-gating-and-eslint10.md` 자체가 SoT 로 기능한다 — spec fidelity 관점에서 해당 없음(결함 아님).

## 요약

이번 diff(`eslint.config.mjs` 헤더 수정, `eslint10-unblock-guard.ts`/`eslint10-unblock.test.ts` 신규, `plan/in-progress/deps-peer-gating-and-eslint10.md` 정정 + 직전 리뷰 라운드 산출물 커밋)는 직전 라운드가 지적한 3건의 WARNING(SoT 문서 drift, `packages:` 섹션 스코핑 부재, `~` 연산자 테스트 커버리지 부재)을 모두 실제로 해소했다. RESOLUTION.md 가 주장한 두 건의 뮤테이션 재검증 결과(제거 시 RED)를 이 리뷰에서 직접 재현해 조치가 vacuous 하지 않음을 확인했고, `eslint.config.mjs` 헤더·`BLOCKERS` 배열·plan 정정 블록의 "차단자 4개" 주장을 `pnpm-lock.yaml`/`pnpm-workspace.yaml`/`git log` 실측으로 전수 대조해 모두 사실과 일치함을 확인했다. TODO/FIXME/HACK 류 미완성 표식 없음. 관련 `spec/` 문서는 없으며(CI 툴체인 영역, plan 자체가 SoT), spec fidelity 이슈도 발견되지 않았다. 새로운 Critical/Warning 발견사항 없음.

## 위험도

NONE
