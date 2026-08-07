# RESOLUTION — override 하한 침식 (10_56_47)

리뷰어 14/14. **CRITICAL 0 / WARNING 1 / RISK LOW.**

## W1 — 존재하지 않는 커밋 해시 참조 (documentation)

지적이 정확했다. `pnpm-workspace.yaml` 의 overrides 블록 헤더가 "각 CVE 사유는 audit
커밋(`b2bbb49e`) 참조" 라고 적고 있는데 **그 해시는 저장소 어디에도 없다.**

실측: `git cat-file -e b2bbb49e` → `fatal: Not a valid object name`,
`git log --all` 전 브랜치 검색 **0건**.

리뷰어 지적대로 이건 사전 존재 결함이지만, **이번 diff 가 바로 그 블록이 관리하는
`fast-uri`/`hono`/`js-yaml`/`undici` 값을 실제로 바꾸므로** 근거를 재구성할 수 없는 상태가
지금 실질적으로 노출된다. `check-pnpm-security-config.py` 는 값의 동일성만 보므로 이
서술형 참조는 코드로 잡히지 않는다.

**처분 — 해시를 다른 해시로 바꾸지 않았다.** 리뷰어는 "실제 근거 커밋(예: `c8ad8de6b`)으로
교체" 를 제안했으나 그러면 **같은 결함이 다음 값 변경에서 재발한다.** 값이 바뀔 때마다 근거도
옮겨 가므로 단일 해시를 고정하는 방식 자체가 틀렸다. 추적 방법을 적는 쪽으로 바꿨다 —
`git log -p pnpm-workspace.yaml` 로 그 줄이 바뀐 커밋을 찾으면 된다. 왜 종전 방식이
실패했는지도 함께 남겼다.

## 같은 주석에서 발견한 두 건 (리뷰 밖, 내가 만든 것 포함)

W1 을 고치며 같은 문단을 읽다 두 가지를 더 찾았다.

1. **"backend 6.x 불변" 이 이번 변경으로 거짓이 됐다.** 내가 `codebase/backend/package.json`
   의 `undici` 를 `^6.21.3 → ^6.28.0` 으로 올렸으므로 그 서술은 더 이상 사실이 아니다.
   **내 변경이 만든 stale 이라 함께 고치는 것이 맞다.**
2. **전이 경로를 "frontend" 라고 적은 것이 틀렸다.** audit 실측상 7.x 취약 경로는
   `channel-web-chat > jsdom > undici` 다. 이건 사전 존재 오기다.

주석을 다시 쓰며 **왜 6.x 는 override 가 아니라 선언 상향인지**도 명시했다 — 직접 의존을
override 로 덮으면 매니페스트가 거짓말을 하게 된다.

## INFO 처분

- **I2**(`socket.io-parser` 가 `~` 인 것) · **I4**(2-place 중복이 의도된 가드) ·
  **I8**(spec 대상 아님) — 전부 "모범 사례 / 정상" 확인. 무처분.
- **I1**(`@aws-sdk/core` deprecated) · **I7**(`postcss`·`nanoid` 부수 patch 상향) — 이번
  변경이 만든 것이 아니고 취약점도 아니다. 무처분.
- **I3**(undici 상향의 런타임 미세 변화) · 권고 2(socket.io e2e green 확인) — 이 PR 의 CI 가
  실제로 e2e 를 돌리므로 그것이 확인 경로다.
- **I5**(`check-pnpm-security-config.py` 로직 unit test 부재) — plan 에 이미 의도된 결정으로
  기록돼 있고 이번 diff 는 데이터만 바꿨다. 무처분.
- **I6**(`socket.io-parser` 키만 따옴표) — 다른 레인지 키들도 따옴표를 쓰므로 스타일 혼재는
  기존부터다. 무처분.

## 검증 (주석 정정 후 재실행)

`check-pnpm-security-config.py` exit 0 · `check-override-floors.py` exit 0 ·
`pnpm install --frozen-lockfile` exit 0 · harness 862 tests OK.
