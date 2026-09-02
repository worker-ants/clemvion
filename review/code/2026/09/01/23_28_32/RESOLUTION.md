# RESOLUTION — A 블록 리뷰 4라운드

대상 SUMMARY: 위험도 **LOW** · Critical **0** · Warning **3**(1건은 이미 유예 등재) · INFO 5

**신규 WARNING 2건 조치 + INFO 1건 조치 + 근본 원인 1건 등재.**

## W1 (maintainability) — 타입 오류가 게이트 사각지대로 들어왔다

`collectScanTargets` 가 `SCAN_ROOTS`(`as const` → `readonly string[]`)를 `walkTree` 의
`bases: string[]` 에 그대로 넘긴다. **TS2345** 다.

**직접 재현했다** — 리뷰어 주장을 받아쓰지 않았다. 격리 파일에 같은 시그니처를 놓고
`tsc --noEmit --strict`:

| | 종료코드 |
|---|---|
| 종전 `bases: string[]` | **2** (`TS2345`) |
| 수정 `bases: readonly string[]` | **0** |
| 수정본에 기존 `string[]` 호출부도 함께 | **0** (호환 확인) |

**왜 안 잡혔나**: `tsconfig.json` 이 `src/**/__tests__/**` 와 `src/**/*.test.ts` 를 exclude
하고, `vitest run` 은 타입을 strip 한다. lint·build·vitest **셋 다 초록**이었다.

`walkTree` 쪽을 넓혔다(호출부 얕은 복사가 아니라). 본체는 `bases` 를 순회만 하고 변형하지
않으므로 안전하고, `string[]` 은 `readonly string[]` 에 대입 가능하므로 **6개 호출부가 전부
그대로 통과**한다. 호출부 복사는 이 자리만 막고 다음 `as const` 호출부에서 또 난다.

> 검증 중 `npx tsc … | head; echo $?` 로 **head 의 종료코드**를 읽을 뻔했다. 파이프를 떼고
> 다시 쟀다 — 이 세션에서 같은 함정을 두 번째로 밟았다(앞은 `eslint … | tail`).

## W2 (documentation) — 이 PR 자신이 만든 stale 줄번호

`spec-conventions-engine-error-code-surface.md:58` 이 `error-codes.ts:114-115` 를 가리키는데,
**이 PR 이 같은 파일 최상단에 JSDoc 6줄을 넣어** 대상이 `:122` 로 밀렸다. 작성 시점엔 옳고
커밋 시점엔 틀린 인용이다.

번호를 갱신하는 대신 **앵커 문구로 바꿨다**(`**엔진 레이어** 에러 코드`). 번호를 고치면 다음
편집에서 또 밀린다 — 이 저장소가 반복해 데인 실패라 축을 바꿨다.

전수 확인: `plan/**`·`.claude/docs/**` 에서 `error-codes.ts:<줄>` 형태 인용은 **이 1건뿐**
이다(grep). 하나만 보고 "고쳤다" 고 하지 않기 위해 셌다.

## I4 (testing) — fixture 가 검증하는 폭이 실제 스코프보다 좁았다

`skipDir` 은 **경로가 아니라 basename** 을 본다 — `archive` 라는 이름이면 어디든 제외된다.
그런데 fixture 는 `plan/complete/archive/` 한 자리에만 있었다. 통과해도 "그 한 경로만
제외되는 것" 과 "이름이면 어디든 제외되는 것" 이 안 갈린다.

`spec/archive/` 를 두 번째 자리로 심었다. 뮤턴트(`skipDir` 을 `relPath.startsWith("plan/complete/archive")`
로 좁힘) → **RED 1**. 이제 fixture 가 실제 계약을 덮는다.

## W1 의 근본 원인 — 등재

W1 은 인스턴스이고 병은 **frontend 테스트가 어떤 게이트에서도 타입체크되지 않는 것**이다.
backend 에는 이미 처방이 있다(`backend-checks.yml` 의 `typecheck-ratchet` + baseline JSON,
증가·감소 둘 다 실패). `frontend-checks.yml` 에는 **대응 잡이 없다** — 같은 병에 한쪽만 약을
먹었다.

**실측**: `src/lib/docs/__tests__/` 26파일 → **실제 오류 0건**(W1 수정 후). ad-hoc 호출에서
나온 `TS2307` 4건은 `paths` 를 안 넘긴 탓의 alias 미해결이라 진짜 오류가 아니다. 이 디렉터리는
**baseline 0 으로 바로 잠글 수 있다.**

**잰 범위를 명시한다** — `src/lib/docs/__tests__/` 뿐이고 **frontend 테스트 전체는 안 쟀다.**
착수 시 전체 규모를 먼저 재도록 등재문에 적었다.

이번 PR 에서 안 하는 이유: CI 워크플로 신설은 이 changeset 의 성격(가드 위생)을 벗어나고,
전체 규모를 재지 않은 채 잡을 넣으면 baseline 이 실제보다 헐거워진다.

## W3 · I3 · I5 — 무조치

- **W3**(SoT 미등재) — 1R·2R·3R 에 이어 4번째 재확인. 리뷰어도 *"즉시 조치 불요, 이미 유예
  등재됨"*. 재개 신호는 다음 harness 가드 추가 시.
- **I3**(역할 축 번들) — 4라운드 연속 재확인, 새 이탈 없음. PR 본문에 두 축 표를 넣었다.
- **I5**(`plan-stale-audit.sh` drift) — 2R 에서 방향까지 적어 등재 완료.
- **I1·I2**(테스트 재순회·비스트리밍 읽기) — 리뷰어 스스로 조치 불요로 판정.

## 검증

lint **PASS** · docs 가드 **21 files / 3137** · 격리 tsc **대조군 exit 2 → 수정 exit 0** ·
뮤테이션 `skipDir` 경로-좁힘 **RED 1**.
