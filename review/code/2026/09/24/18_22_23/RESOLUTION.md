# RESOLUTION — `review/code/2026/09/24/18_22_23` (1라운드)

**Critical 0 · Warning 3 · INFO 10.** reviewer 14명 전원 산출물 확보, forced 8/8.

Warning 셋 모두 조치했다. **보류 0건.** 이 라운드의 수정은 전부 `codebase/**` **밖**
(루트 `pnpm-lock.yaml` · `PROJECT.md` · plan)이다.

## 조치 항목

| SUMMARY # | 지적 | 조치 | commit |
| --- | --- | --- | --- |
| Warning 1 | lockfile diff 가 plan 의 「한 줄」 서술보다 넓다 — 무관한 optional 패키지 `libc:` 63줄 삭제 + `eslint-plugin-*` peer 문자열 교환 | **원인을 재고 좁혔다.** 플랫폼 차이가 아니라(Linux 컨테이너에서도 같은 63줄이 빠짐) **dependabot 과 고정 pnpm 사이의 기존 진동**이다 — 방향 실측: dependabot 은 전부 넣고 사람 커밋은 전부 뺀다(5커밋 예외 없음). main 의 lockfile 에 typeorm 변경분만 opcode 단위로 얹어 **15줄, 전부 typeorm** 으로 만들었다. 진동은 트래커 등재 | `8f7d2b836` |
| Warning 2 | 트래커 frontmatter `worktree: (unstarted)` 가 본문 「착수했다가 되돌렸다」와 모순 | 값은 **맞다** — 전량 되돌려 커밋된 코드 0, 이 필드는 「지금 이 plan 의 작업을 싣는 워크트리」를 가리키고 그 워크트리는 형제 plan 의 것이라 머지 후 사라진다(여기 적으면 stale). **그 이유를 본문에 명시** | `8f7d2b836` |
| Warning 3 | `@nestjs/typeorm@12` 가 ESM-only 라 CJS 런타임이 `require(esm)` 에 의존 — floor 를 낮추면 조용히 깨질 암묵적 결속 | `PROJECT.md` 의 **Node 지원 floor** 줄에 명시 — 누군가 floor 를 고칠 때 보게 될 바로 그 자리다. engines 가 advisory 라 설치는 성공하고 **부팅에서야** 깨진다는 점까지 | `8f7d2b836` |

### W1 — 「한 줄」 서술이 틀렸던 게 아니라, lockfile 이 그 서술을 못 따라갔다

plan 은 변경을 한 줄이라 적었고 `package.json` 은 실제로 한 줄이다. 넓었던 것은 **pnpm 이
재직렬화하며 끌고 온 무관한 메타데이터**였다. 그걸 서술에 맞춰 적당히 설명하는 대신 **diff 를
서술에 맞췄다** — 리뷰가 스코프 이탈로 읽은 것이 정당했기 때문이다.

검증:
- `pnpm install --frozen-lockfile --strict-peer-dependencies` 통과, **lockfile 을 다시 쓰지 않음**
- `run-test.sh build` 의 Docker 단계(컨테이너 안 Linux frozen 설치) 통과

## INFO 처분

- **INFO 4** (판별자 MB 를 코드화된 mutation-canary 로) — 좋은 제안이지만 이 PR 의 스코프(의존성
  한 줄)를 넘는다. 트래커 `nestjs-v12-coordinated-upgrade.md` §E 가 재개 시 같은 절차를
  요구하고 기준값을 이미 박아 뒀으므로 사람이 잊을 여지는 그 문서가 막는다. 코드화는 다음
  `@nestjs/*` 업그레이드가 실제로 착수될 때 그 PR 에서 판단한다.
- **INFO 6** (plan 섹션 번호 `0 → 3 → A~E` 비일관 + 기준값 중복) — 번호는 트래커에 §0·§3 을
  **앞에 덧댄** 결과다. 기준값은 두 문서가 **서로 다른 시점**(트래커=재개 시 비교 기준,
  deps-typeorm12=이번 전/후 실측)을 기록하므로 중복이 아니라 각자의 증거다. 조치 없음.
- **INFO 10** (리뷰 중 `workspace.decorator.ts` 뮤턴트가 미원복으로 관측됨) — 리뷰
  **시작 전**에 원복·확인했다(`codebase/` diff 가 의도한 한 줄뿐). 관측된 것은 **리뷰어
  자신(requirement)의 재현 뮤테이션**으로 보이며, SUMMARY 작성 시점엔 clean 이었다. 그러나
  권고(뮤테이션은 scratch 에서)는 옳다 — 병렬 리뷰어끼리 오염시킨다.
- 나머지 INFO 는 「없음」·긍정 확인·이미 추적 중.

## TEST 결과

| 단계 | 결과 | 로그 |
| --- | --- | --- |
| lint | **PASS** — 최소 lockfile 로 재수행 | `_test_logs/lint-20260924-184526.log` |
| unit | **PASS** — backend **473 스위트 / 9950**, 최소 lockfile 로 재수행 | `_test_logs/unit-20260924-184626.log` |
| build | **PASS** — Docker 단계 포함, 최소 lockfile 로 재수행 | `_test_logs/build-20260924-183706.log` |
| e2e | **통과** — 380 PASS (최소화 **전** lockfile) | `_test_logs/e2e-20260924-181031.log` |

처음엔 «최소화는 설치 트리를 바꾸지 않는다» 고 적으려 했는데 **추론이 넓었다** —
`libc:` 는 메타데이터라 해석에 무관하지만, `eslint-plugin-*` 의 peer 문자열 맞교환은
**어느 importer 가 어느 peer 변형을 보는지**를 바꿀 수 있다. 그래서 lint·unit·build 는
최소 lockfile 로 **다시 쟀다**.

e2e 만 최소화 전 결과다. 남긴 근거: 최소화로 달라진 것은 `libc:` 메타데이터와
`eslint-plugin-*` 의 peer 표기 **둘뿐**이고, 후자는 lint 도구라 런타임 부팅·HTTP 경로에
닿지 않는다. 그리고 최소 lockfile 의 그 두 자리는 **main 과 글자 그대로 같다** — main 이
이 형태로 e2e 를 계속 통과해 왔다.

하네스 pytest **1138 통과**, frontend docs 가드 **3526 통과**.

## 보류·후속 항목

Warning 보류 0건. 새로 등재한 것:

- `spec-draft-nullable-notation-followups.md` — **lockfile 의 `libc:` 필드가 dependabot 과
  고정 pnpm 사이에서 진동한다** (developer, 낮음). 방향 실측 표와 처방 후보 둘, 그리고
  «어느 쪽이 `libc:` 를 쓰는지부터 재야 한다» 는 미측정 경계를 함께 적었다.
