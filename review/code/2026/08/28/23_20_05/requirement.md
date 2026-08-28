# 요구사항(Requirement) 리뷰

## 검증 방법

- `pnpm vitest run src/lib/repo-guards/__tests__/eslint10-unblock.test.ts` 를 실제 저장소
  `pnpm-lock.yaml`(6MB, 실측 데이터) 대상으로 실행 — **12/12 통과**.
- `pnpm-lock.yaml`·`pnpm-workspace.yaml`·`ef3617a79` 커밋을 직접 열어 가드/plan 이 주장하는
  4개 차단자의 peer 값·override 핀·근거 주석 부재 주장을 각각 대조.
- `codebase/frontend/eslint.config.mjs`, `codebase/channel-web-chat/eslint.config.mjs` 를 열어
  plan 이 "해제 조건과 실측 표의 SoT" 라 선언한 위치의 현재 내용을 확인.

## 발견사항

- **[WARNING]** plan/guard 가 새로 확정한 "차단자는 4개(react-hooks 포함)" 정정이, plan 자신이
  지명한 SoT 문서(`codebase/frontend/eslint.config.mjs` 헤더)에는 반영되지 않았다.
  - 위치: `codebase/frontend/eslint.config.mjs` (헤더 주석, 현재 라인 1~19대 — 이번 diff 에
    포함되지 않은 파일이라 게이트 번호 없음. 함수/블록: 파일 최상단 헤더 주석 표).
    관련 plan 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md:185`("### ⚠️ 정정
    (2026-08-28 후속 턴) — 우리 트리의 차단자는 셋이 아니라 넷이다"). 관련 guard 위치:
    `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts:14`(BLOCKERS 헤더
    docstring, "우리 트리 기준 4개").
  - 상세: plan 문서 원문(`deps-peer-gating-and-eslint10.md:183`, 이번 diff 로 바뀌지 않은
    기존 문장)은 "해제 조건과 실측 표의 SoT: `codebase/frontend/eslint.config.mjs` 헤더" 라고
    명시한다. 그런데 이번 PR 이 그 SoT 문서 바로 아래에 "차단자가 셋이 아니라 넷"이라는 정정을
    추가하면서도(§파일 3 diff), 정작 SoT 로 지명한 `eslint.config.mjs` 헤더는 건드리지 않았다.
    실제로 열어보면 그 헤더는 지금도 다음과 같이 **3개짜리 옛 이해**를 그대로 담고 있다:
    ```
    //   eslint-plugin-react      7.37.5  peer eslint `^3 || … || ^9.7`
    //   eslint-plugin-jsx-a11y   6.10.2  peer eslint `^3 || … || ^9`
    //   eslint-plugin-import     2.32.0  peer eslint `^2 || … || ^9`
    //   eslint-plugin-react-hooks 7.1.1  peer eslint `… || ^10.0.0`   ← 이것만 10 지원
    //
    // 즉 셋은 **eslint 10 을 지원하는 버전이 아직 존재하지 않는다**(latest 조차).
    ```
    이 표는 `eslint-plugin-react-hooks` 를 **registry latest(7.1.1)** 기준으로만 재서
    "이미 10 지원 → 차단자 아님" 이라고 결론짓는다 — 이번 PR 의 guard/plan 이 정확히
    반증한 바로 그 원래 오류(우리 트리는 `pnpm-workspace.yaml` 의 exact 핀 `7.0.1` 때문에
    실제로는 peer 상한이 `^9.0.0` 이라 여전히 차단자다)를 그대로 두고 있다. 새 guard
    (`eslint10-unblock.test.ts`)의 실패 메시지는 정확히 이 헤더 표를 함께 정리하라고
    안내하는데(`eslint10-unblock.test.ts:91` "codebase/frontend/eslint.config.mjs 헤더의
    실측 표와 이 가드를 정리하라"), 그 안내가 가리키는 문서 자체가 이미 새 이해와
    불일치한 상태로 남아 있다. 이 저장소가 같은 PR 체크리스트 안에서 "PROJECT.md 가 자기
    2-place 편집 계약을 스스로 어겼다"(Critical)로 이미 잡았던 것과 같은 클래스의
    미러 drift다.
  - 제안: `codebase/frontend/eslint.config.mjs` 헤더의 표에 4번째 행(또는 각주)을 추가해
    "registry latest(7.1.1)는 `^10.0.0` 을 지원하지만, `pnpm-workspace.yaml` 의 exact
    override 핀(`7.0.1`)이 걸려 있어 우리 트리에서는 여전히 차단자"라는 사실을 반영한다.
    이 파일은 `spec/` 이 아니라 코드베이스 헤더 주석이므로 developer 권한으로 바로 고칠 수
    있는 범위다(별도 planner 턴 불필요).

- **[INFO]** `readPeerRanges` 는 동일 패키지명이 `packages:` 절에 두 번 이상(다른 버전으로)
  등장할 경우 `Map.set` 이 마지막 항목으로 조용히 덮어쓴다.
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts:127`
    (`out.set(current.name, { version: current.version, eslintPeer: range });`)
  - 상세: 현재 실제 `pnpm-lock.yaml` 은 4개 차단자 각각 정확히 한 버전만 해소하고 있어(직접
    grep 으로 확인: `eslint-plugin-{react,jsx-a11y,import,react-hooks}` 각 1건) 지금은 문제를
    일으키지 않는다. 다만 향후 동일 패키지의 서로 다른 버전이 동시에 해소되는 상황이 오면
    (드물지만 pnpm 이 peer 불일치로 복수 버전을 만들 수 있다), 이 함수는 그중 하나만
    조용히 반환하고 나머지는 버린다 — 문서화된 계약도, 이를 감지하는 테스트도 없다.
    가드 전체가 "해석 불가·전제 붕괴는 throw" 라는 fail-closed 철학을 명시적으로 표방하는
    점(`allowsEslint10` 의 docstring)과 비교하면, 이 지점만 조용한 덮어쓰기라 다소
    비일관적이다.
  - 제안: 급하지 않음(현재 데이터로는 미관측 시나리오). 재발 시 대비해 중복 버전 발견 시
    throw 하거나 최소 주석으로 "단일 버전 가정" 을 명시하면 다음 사람이 놀라지 않는다.

- **[INFO]** 관련 `spec/` 본문 부재 — `spec/` 전체에서 `eslint10-unblock` 관련 문서를 찾지
  못했다(grep 0건). 이 세 파일(가드·테스트·plan)은 CI 툴체인/의존성 관리 영역으로,
  `spec/` 이 다루는 제품 요구사항이 아니라 `plan/in-progress/deps-peer-gating-and-eslint10.md`
  자체가 SoT 역할을 한다. spec fidelity 관점에서는 해당 없음(결함 아님).

## 요약

새로 추가된 `eslint10-unblock-guard.ts`/`eslint10-unblock.test.ts` 는 목적("frontend·
channel-web-chat 의 eslint 9 잔류가 아직 필요한가"를 lockfile 실측으로 감시하는 캐너리)을
충실히 구현한다 — 실제 저장소 `pnpm-lock.yaml`(6MB)을 대상으로 12/12 테스트가 통과했고,
4개 차단자(`eslint-plugin-react`·`jsx-a11y`·`import`·`react-hooks`)의 peer 값·
`pnpm-workspace.yaml` 의 exact 핀·근거 주석 부재 주장을 모두 git 이력/lockfile 로 직접
대조해 사실과 일치함을 확인했다. `allowsEslint10` 의 fail-closed 파싱(해석 불가 시 throw)과
`readPeerRanges` 의 라인 기반 파서는 실제 lockfile 의 `packages:`/`overrides:`/`importers:`/
`snapshots:` 각 섹션 형태에 대해 오탐 없이 정확히 동작함을 라인 단위로 추적 검증했다. 유일한
실질적 결함은 기능이 아니라 **문서 동기화 누락**이다 — 이번 정정이 새로 확립한 "차단자는 4개"
라는 사실이, plan 문서 자신이 지명한 SoT(`codebase/frontend/eslint.config.mjs` 헤더)에는
반영되지 않아, 그 SoT 만 보는 다음 사람은 여전히 옛 3개-차단자 결론(react-hooks 는 이미 풀렸다)
을 믿게 된다. 이 저장소가 같은 라운드에 "PROJECT.md 2-place 편집 계약 위반"을 Critical 로 잡은
것과 정확히 같은 실패 클래스이므로 WARNING 으로 등재한다.

## 위험도

LOW
