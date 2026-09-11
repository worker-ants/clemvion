# RESOLUTION — `review/code/2026/09/11/12_00_40` (3라운드, `--route=all`)

**입력**: CRITICAL 0 · WARNING 2 · RISK LOW · reviewer 14/14 결과 확보 · forced 누락 0 ·
unfinished 0.

**결론**: `codebase/**` 수정 **0**. 두 WARNING 은 **둘 다 `spec/` 결정 사안**이라 developer
PR 에서 닫을 수 없고, 뒤따르는 **project-planner 턴**으로 넘긴다. 이 라운드가 선언된 종료
조건(*"`codebase/**` 수정 0 으로 끝나는 라운드"*)이다.

---

## WARNING 1 — `authConfigId` 자리의 top-level 특화 코드 + generic `details.code` 병기

**분류**: 유예 (planner 결정 대기). 코드 되돌림 불요 — additive 이고 하위 호환 파괴 없음.

### 실측

`code: ErrorCode.INVALID_FIELD` 를 실은 13자리의 top-level `code` 를 전수 확인했다:

| top-level | 자리 |
|---|---|
| `VALIDATION_ERROR` (400 상태 기본값) | **12곳** — `type` · `botTokenRef` · `inboundSigningRef` · `inboundSigning` · `botToken` · `inboundSigningPlaintext` ×5 · `chatChannel` · `provider` |
| **`AUTH_CONFIG_NOT_FOUND`** (도메인 특화) | **1곳** — `assertAuthConfigInWorkspace` |

reviewer 지적은 **정확하다.** 그리고 그것은 **내가 만든 것**이다 — 한 줄 형태의 13자리에
정규식을 일괄 적용하면서 **각 자리의 top-level 을 확인하지 않았다.** 「자리」를 보고 「형태」를
보지 않은 그 결함 클래스다.

### 왜 이 PR 에서 고치지 않나 — 판정 자체가 spec 사안이다

`2-api-convention.md §5.3` 의 택일 기준표는 *"top-level `code` 교체"* 와 *"`details[].code`"*
를 갈라 쓰라고 하고 **"둘을 겹쳐 쓰지 않는다"** 고 적는다. 그 금지 조항의 문면은
*"top-level 을 특화 코드로 바꾸면서 **같은 사유**를 `details[].code` 에도 넣으면"* 이다.

그런데 `INVALID_FIELD` 는 `AUTH_CONFIG_NOT_FOUND` 와 **같은 사유가 아니다** — 전자는
*"이 필드가 잘못됐다"* 는 generic 표지, 후자는 도메인 사유다. 즉 **이 자리가 금지 조항에
걸리는지 자체가 판정 사안**이고, 그 판정은 §5.3 을 고치는 **planner 결정**이다.

양쪽 다 실질 근거가 있어 developer 가 단독으로 정하면 안 된다:

- **제거 쪽**: 같은 파일의 선례 `rethrowEndpointPathConflict` 는 top-level 을 상태 기본값
  (`RESOURCE_CONFLICT`)으로 두고 특화 코드를 `details.code` 에 싣는다 — 내 자리는 그 **반대
  모양**이다.
- **유지 쪽**: `details.field` + generic `code` 는 *"이 필드가 필드 검증으로 거부됐다"* 를
  **모든 4xx 에서 균일하게** 알려 준다. 이 자리만 벗기면 소비자가 `authConfigId` 를 특례로
  처리해야 하고, 그것은 이 PR 이 사려던 상호운용성을 깎는다.

**주석-only 수정도 하지 않았다.** 동작 변화가 0인 `codebase/**` 편집이 리뷰를 stale 시켜
라운드를 무한히 늘리는 지렛대다(`#1287` 8라운드, `#1308`). planner 턴이 §5.3 에 *"top-level 이
이미 특화 코드인 경우"* 갈래를 명문화하고, **같은 결정으로 코드 처분(주석 유지 / `code` 제거)
까지 정한다.**

### 후속 (트래커 등재 완료)

- planner: `2-api-convention.md §5.3` 에 그 갈래 명문화 + 이 PR 이 신설한 *「`field` 를 실으면
  `code` 도 싣는다 — 형태 무관」* 의 **과도한 넓이** 정정(carve-out 필요).
- pre-existing 부수 발견: `AUTH_CONFIG_NOT_FOUND` 자체가 `3-error-handling.md §1` 카탈로그에
  **미등재**다(이 PR 이 만든 것 아님). §5.3 이 등재 의무를 걸고 있으므로 같은 planner 턴 후보.

---

## WARNING 2 — `[SPEC-DRIFT]` `15-chat-channel.md` 의 배선-전 시제

**분류**: planner 인계 (developer 권한 밖). 코드는 옳다 — spec 시제만 낡는다.

자기-반증형 소정정은 **쓸 수 없다**: 그 문장들은 `#1316` **planner 턴이 썼고**, 역할은 blame
이 아니라 **diff 스코프·게이트 종류·plan owner** 로 갈린다(조건 1 불성립). 규약이
*"조건 1 이 깨지면 예외 말고 두 PR 로 분리"* 라 적으므로 planner PR 을 뒤이어 낸다.

### 잔존 범위 — 술어를 갈라 확정했다

2·3라운드에서 reviewer 둘이 **다르게 보고**했다(`requirement`: *"§5.4.1.2 만"* /
`documentation`: *"세 곳"*). 직접 재측정하니 **서로 다른 술어**를 재고 있었다:

| 술어 | 자리 | 배선 후 |
|---|---|---|
| ① *"배선 전 관측값"* 라벨 | §5.4.1 · §5.4.1.1 — **2곳** | **거짓은 아니다** (그 측정은 실제로 배선 전이었다). 현재형으로 읽혀 낡아 보인다 |
| ② 명시적 시한 절 — *"그 PR 이 머지되기 전까지 이 문단은 「아직 안 실린다」를 서술할 뿐"* | §5.4.1.2 — **1곳** | **명백히 거짓**이 된다 |

→ `requirement` 는 ②에 대해 맞고, `documentation` 은 ①까지 세어 맞다. **2라운드에서 내가
*"documentation 이 맞고 requirement 는 틀렸다"* 고 단정한 것은 너무 단호했다** — 정정한다.

planner PR 은 **②를 필수로, ①을 일관성으로** 고친다.

---

## 유예한 INFO (전부 트래커 등재)

I1(공백 전용 trim 정책) · I2(`SecretResolver.rotate`/`store` 빈 값 가드) ·
I4(`rejectBlocked(field)` 헬퍼로 예외 보일러플레이트 축소) · I5(`it.each` 병합 — CI 시간만) ·
I6(상수 `Readonly`/`Object.freeze`) · I7(`triggers.mdx` 인접 문장 + provider 6파일 `code` 표기) ·
I8(*"`field` 없는 진단 payload 는 `code` 를 안 싣는다"* 회귀 캐너리) ·
I9(`AUTH_CONFIG_NOT_FOUND` 카탈로그 미등재) · I10(메시지 문체 통일).

## 검증 상태

4단계 전부 PASS (마지막 코드 커밋 `2d0270fbd` 기준) — lint · unit(backend **9,568** /
454 suite, 로그 전수 grep) · build(**타입체크 ratchet 둘 포함**, baseline 197 / 52 일치) ·
e2e(supertest 305 + **playwright 51**, 로그 `N passed (…s)` 확인).

뮤테이션: `code` 15자리 **개별 RED** · `Record` 양방향 **tsc 2방향** · fixture 집합 캐너리 1 ·
`ErrorCode` 스왑 1.

## 리뷰어 계약 이탈 1건 (판정 무영향)

`code-review-summary` 가 `summary_status` 에 `STATUS=` 라인 대신 산문을 반환했다. SUMMARY
전문·`risk`·`critical_count` 는 정상이고 main 이 디스크에 영속화했다(14/14 · forced 누락 0).
