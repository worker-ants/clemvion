# RESOLUTION — 12_50_37

대상 SUMMARY: `review/code/2026/08/21/12_50_37/SUMMARY.md` (위험도 **MEDIUM**, Critical **0**, WARNING **3**, INFO 6)

**처분: W1·W3 수정, W2 는 기록만.** 직전 라운드 미검증분(`requirement`)도 이번엔 결과 확보됐다.

---

## WARNING 1 — **"고쳤다" 가 거짓이었다** (reviewer 7명 중복 지적) — **수정**

라운드3 에서 `SOT_DIR` 접두 경계를 명시했다고 커밋 메시지와 RESOLUTION 에 적었다. 실측:

```
backend  : if (relPath === SOT_DIR || relPath.startsWith(`${SOT_DIR}/`)) continue;   ← 고쳐짐
frontend : if (relPath.startsWith(SOT_DIR.split(path.sep).join("/"))) continue;      ← 그대로
```

**backend 만 고쳐졌다.** 원인은 명확하다 — 치환 스크립트가 `relPath.startsWith(SOT_DIR)` 를
찾았는데 frontend 의 실제 표현은 `SOT_DIR.split(path.sep).join("/")` 였다. **매치 수를
단언하지 않은 치환이 조용한 no-op** 이 됐고, 나는 그 위에 완료형 서술을 얹었다.

> 같은 턴의 다른 편집들은 `assert s.count(old) == 1` 을 걸었는데 이 한 줄만 빠뜨렸다.
> 이번 수정은 **전부 매치 단언을 걸었고**, 실제로 frontend 픽스처 하나가 그 단언에 걸려
> 잡혔다(따옴표 일괄 치환이 문자열을 중첩시켰다).

### 그리고 캐너리가 이 비대칭을 못 봤다

기존 접두 겹침 캐너리는 **심볼 이름**(`MAX_MASK_DEPTH_OLD`)만 봤다. **경로 접두 겹침**을
보는 단언이 없어, 두 사본이 갈려도 테스트는 GREEN 이었다.

합성 fixture 로 `codebase/packages/masked-markers-extra/src/x.ts` 를 만들어 *"SoT 와 접두가
겹치는 형제는 탐지 대상"* 을 양쪽에 단언했다. **뮤테이션 실증**: frontend 를 옛 무경계
형태로 되돌리니 **그 캐너리 1건만 정확히 RED**(19 passed) — 라운드3 에서 놓친 상태를 이제
기계가 잡는다.

> "탐지 로직 중복은 값 미러와 달리 안전하다" 고 내가 헤더에 적었는데, **이번 사건이 그
> 전제의 비용을 처음 실증했다.** 두 사본이 실제로 갈렸다. 전제가 완전히 틀린 건 아니다(각
> 사본이 자기 트리거에서 계속 동작했다) — 다만 *로직 결함은 동시에 고쳐야 하고, 그것을
> 기계가 확인하지 않으면 한쪽만 고쳐진다*. 그 확인이 이제 캐너리로 있다.

## WARNING 3 — 함수 선언 분기가 한 번도 행사되지 않았다 (testing) — **수정**

심볼별 캐너리가 전부 `const X = 1` 픽스처만 썼다. 그런데 `isMaskedMarker` 는 이관 전 실제로
`export function isMaskedMarker(...)` 였다 — **"함수로 되살아나는 것" 이 이 가드가 막아야 할
가장 현실적인 회귀 형태**인데 그 분기가 깨져도 스위트는 GREEN 이었다.

`export function isMaskedMarker() { ... }` 픽스처를 양쪽에 추가했다. (클래스 선언 분기는
현재 어떤 SoT 심볼도 클래스가 아니라 우선순위 낮음 — 리뷰어도 INFO 로 판정.)

## WARNING 2 — 역할 경계 (requirement) — **기록만**

`spec/` 편집을 developer/RESOLUTION 턴이 직접 했다. 리뷰어 판정 그대로 **내용은 구현과 정확히
일치**하고 SPEC-DRIFT 가 아니며 되돌릴 필요가 없다. plan 에도 이 선택을 명시해 뒀다.

CLAUDE.md 에 예외 조항을 추가하자는 제안은 **이 PR 에서 하지 않는다** — 저장소 전역 규약
변경이라 별건이고, 규약을 내 편의에 맞춰 넓히는 방향이라 더더욱 별도 판단이 필요하다.

## 미조치 INFO (6건)

전부 리뷰어 스스로 "조치 불요·범위 밖" 판정. `pnpm-lock` 노이즈(4라운드 연속 동일) · 리뷰
산출물 잔여 텍스트 · 탐지 로직 재추출 검토(위 W1 해소로 당장의 불일치는 사라짐) · `license`
필드(형제 패키지도 동일) · backend 깊이 경계(이미 plan 등재) · stale 주석.

## 검증

TEST WORKFLOW 4단계 PASS + ratchet —

| 단계 | 결과 |
| --- | --- |
| lint | PASS (48s) |
| unit | backend jest **431 suites / 8,916 passed**(1 skipped) · frontend **287 files** |
| build | PASS (141s) |
| 타입체크 ratchet | **199건 / 38파일 baseline 일치** |
| e2e | PASS (215s) — backend supertest **276** · playwright **51 passed (55.7s)** |

두 미러 가드가 각각 **20건**으로 일치한다 — 이번엔 그 일치를 숫자로 확인하고 적는다.
