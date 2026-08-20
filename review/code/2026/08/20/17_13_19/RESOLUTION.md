# RESOLUTION — 17_13_19

대상 SUMMARY: `review/code/2026/08/20/17_13_19/SUMMARY.md` (위험도 **LOW**, Critical **0**, WARNING **1**, INFO 7)

**처분: WARNING 1건 수정 · INFO 3건 추가 조치.** 병행 consistency(`17_14_02`)는 **BLOCK: NO**,
5 checker 전원 **위험도 NONE**, WARNING **0**.

---

## WARNING 1 — 자매 표면의 단언 강도가 갈렸다 (testing) — **수정**

**또 내가 만든 비대칭이다.** 직전 라운드들에서 캐너리 `①`(`findById`)에는 음성+양성 단언
쌍을 넣었는데, 같은 diff 가 같은 방향으로 뒤집는 자매 `②`(`findByWorkflow`) ·
`⑧`(`getChain`) · `⑧-b`(`stop`)는 **음성 단언만** 남았다.

음성 단독(`not.toContain('admin:pw')`)은 **필드가 통째로 사라져도 통과한다** — 마스킹
함수가 배선 실수로 `null`/`{}`/필드 누락을 내도 GREEN 이다.

### 재검증 (뮤테이션)

마스킹을 걷어내는 대신 **필드를 비우는** 뮤턴트를 골랐다(`inputData: null`) — 음성 단독
단언이 왜 부족한지를 그대로 재현하는 변이여야 의미가 있다:

| 뮤턴트 | 결과 |
| --- | --- |
| `inputData: redactStoredDataForResponse(...)` → `inputData: null` (두 경로) | **RED 5건** — `①` `②` `⑥` `⑧` `⑧-b` |

수정 전이라면 `②`·`⑧`·`⑧-b` 세 건은 GREEN 이었을 자리다.

- `codebase/backend/src/modules/executions/executions.service.spec.ts`

---

## INFO 조치 (3건)

### INFO-6 — 리뷰어 전제는 **반증**됐고, 그 자리에 다른 구멍이 있었다 (testing) — **수정**

리뷰어는 *"배열 분기의 `depth + 1` 누락 뮤테이션을 못 잡는다"* 고 했다. **실측하니 잡는다** —
깊은 회귀 테스트가 `"[".repeat(5000)` 로 **배열**을 쌓으므로, 과소 계수는 상한이 늦게
걸리며 스택이 터져 RED 가 된다.

**그런데 반대 방향이 비어 있었다.** 같은 자리를 `depth + 2`(과다 계수)로 바꾸면 **17개가
전부 GREEN** 이다:

| 뮤턴트 | 수정 전 | 수정 후 |
| --- | --- | --- |
| 배열 분기 `depth + 1` → `depth` (과소) | RED (깊은 회귀) | RED |
| 배열 분기 `depth + 1` → `depth + 2` (**과다**) | **GREEN — 생존** | **RED** (신규 경계 테스트) |

과다 계수는 배열로 감싼 마커가 상한의 절반 깊이에서 이미 안 보이게 만든다 — **fail-open**
이다. 객체 경계 테스트는 객체 분기가 정상이므로 이걸 못 잡는다. 같은 경계를 **배열로도**
고정했다.

> 지적된 전제가 틀렸다고 항목을 기각하면 그 자리의 진짜 결함까지 함께 덮인다. 전제를
> 실측하는 비용이 그 차이를 만들었다.

- `codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts`

### INFO-3 — `touchedMaskedKeys` → `touchedKeys` 개명 (maintainability) — **수정**

이름이 *"마스킹된 키만 담는다"* 는 뜻인데 실제로는 **편집한 모든 키**가 들어간다. 선언부
JSDoc 도 같은 거짓을 말하고 있었다. **여러 라운드에 걸쳐 재지적된 항목**이라, 종전 유예
근거(*"최종 판정이 교집합만 보므로 무해하다"*)를 유지하는 대신 이름을 내용에 맞췄다.

유예 근거 자체는 옳았지만 — 그건 **왜 넓어도 되는가**의 설명이지 **이름이 거짓이어도
되는 이유**가 아니다. 그 사실은 이제 선언부 JSDoc 에 적혀 있다. 트래커의 옛 이름 참조도
함께 갱신했다.

### INFO-7 — 모달 재오픈 리셋 캐너리 (testing) — **추가**

차단 판정의 첫 조건이 *"건드렸는가"* 라, 그 기록이 재오픈 때 안 지워지면 **한 번 채운 적이
있다는 이유로 다음 실행에서도 영구 해제**된다 — 원본은 여전히 마커인데. 리셋은 `open` 을
보는 `useEffect` 한 줄이라 리팩터로 조용히 떨어져 나가기 쉽다.

**재검증**: 그 한 줄을 제거하면 **신규 캐너리만 정확히 RED**(29 passed).

## 미반영 INFO (4건)

1(서버측 마커 거부) · 2(inputData 계약 반전) — 트래커 등재분, 이 PR 범위 밖(후자는 코드가
아니라 운영 정보). 4(배경 서사 중복) · 5(제목 셈법 차이) — 이전 라운드가 이미 조치 불요로
판정했고 리뷰어도 그 판정을 확인했다.

## consistency `17_14_02` (BLOCK: NO, WARNING 0)

INFO 3건 전부 조치 불요 — 이전 라운드 지적의 해소 확인 · 트래커 신규 항목 등재 확인 ·
"잔여 ③" 범위 밖 유지 확인.

## 검증

TEST WORKFLOW 4단계 PASS —

| 단계 | 결과 |
| --- | --- |
| lint | PASS (55s) |
| unit | PASS — backend jest **427 suites / 8,832** · frontend vitest **286 files / 6,070** · web-chat **23 / 451** |
| build | PASS (147s) + backend 타입체크 ratchet **199건/38파일 baseline 일치** |
| e2e | PASS (222s) — backend supertest **276** · playwright **51** (로그 `51 passed (56.9s)` 실측) |

frontend 는 6,068 → **6,070** (배열 깊이 경계 1 · 재오픈 리셋 캐너리 1). backend 는 단언만
늘어 총계 불변.
