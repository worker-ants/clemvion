# RESOLUTION — 18_03_01

대상 SUMMARY: `review/code/2026/08/20/18_03_01/SUMMARY.md` (위험도 **LOW**, Critical **0**, WARNING **3**, INFO 6)

**처분: 신규 WARNING 1건 수정 · 2건 트래커 이월(SUMMARY 가 "머지를 막을 사유 아님" 으로 명시)
· INFO 2건 추가 조치.** 병행 consistency(`18_03_37`)는 **BLOCK: NO**, CRITICAL·WARNING **0**.

---

## WARNING 1 — 내 fix 가 이 PR 이 막으려던 오염을 재현했다 (architecture) — **수정**

직전 라운드의 W3 fix(스키마 드리프트 orphan 되살리기)에서 orphan 을 전부 `"string"` 으로
넣었다. 원래 값이 object/array 였으면 `displayValue` 가 `String(value)` 로 떨어져
**`[object Object]`** 를 렌더한다. 무수정 프로브로 실증했다:

```
ORPHAN_VALUE= "[object Object]"
```

그대로 제출하면 그 문자열이 새 실행의 실제 입력이 된다 — **이 PR 이 막으려는 오염과 정확히
같은 형태**가 내 fix 안에서 되살아난 것이다. 불변식 하나(차단 키는 렌더된다)를 세우면서
다른 하나(렌더된 필드 타입은 값 shape 을 반영한다)를 깼다.

### 여기서만 값의 모양으로 판정하는 이유

`isStructuredField` 에는 *"값의 모양이 아니라 **선언된 타입**으로 판정한다"* 고 못박아
뒀는데(라운드4에서 과잉 차단으로 한 번 데였다) 여기는 반대다 — **orphan 에는 선언이 없다.**
스키마에서 사라진 키라 참조할 타입이 아예 없고 값의 모양이 남은 유일한 신호다. 그리고
추론된 타입은 `fields` 에 실리므로 `isStructuredField` 도 같은 값을 쓴다 — 두 곳이 갈리지
않는다. 이 논거를 JSDoc 에 적어 뒀다.

**재검증**: `inferTypeFromValue(...)` → `"string" as const` 로 되돌리면 **신규 캐너리만
정확히 RED**(31 passed). 캐너리는 세 가지를 한 테스트에서 고정한다 — JSON 으로 렌더된다 ·
중첩 마커가 남아 있으면 막힌다 · 유효 JSON 으로 고치면 풀린다(구조 필드로 취급돼 coerce
조건도 함께 만족).

- `codebase/frontend/src/components/executions/rerun-modal.tsx` + 테스트

## WARNING 2 · 3 — 트래커 이월 (SUMMARY 가 비차단으로 명시)

- **W2** 서버측 `inputOverride` 마커 리터럴 거부 — security 리뷰어가 이번 라운드에
  INFO→WARNING 으로 올렸는데, **그 이유가 내가 직전 라운드에 스스로 정정한 "유예 근거가
  과장이었다"** 였다. 그럼에도 리뷰어의 **처분 자체는 내 것과 같다** — *"다음 PR 에서
  추가하고, 동시에 planner 턴으로 §R17 에 범위를 명문화"*. spec 표면이라 `developer`
  권한 밖이다.
- **W3** `inputData` 응답 시맨틱 반전 — 저장소 밖 소비자 조사는 코드가 아니라 운영 정보.

두 건 모두 SUMMARY 권장사항 2번이 *"이번 PR 의 머지를 막을 사유는 아니다"* 로 명시했다.

### 다만 **헤드라인이 실제보다 넓었다** — 이건 고쳤다

security 리뷰어가 *"이 PR 의 헤드라인 주장('카브아웃을 닫았다')이 UI 정상 흐름에 한정된
닫힘"* 이라고 재확인했다. 그건 문서 문제이고 내 권한 안이다. CHANGELOG 최상단에 **닫힌
범위**를 명시했다 — 가드는 프런트 렌더 경로에 있으므로 API 직접 호출은 서버가 여전히
받는다, 기밀성이 아니라 호출자 자신의 실행에 한정된 무결성 문제다, 서버측 거부는 트래커에
있고 착수 시 planner 턴을 함께 한다.

> 문서한 보장이 구현보다 넓으면 안 된다. 안 닫은 방향을 먼저 적는다.

## INFO 조치 (1건)

### INFO-5 — spec 은 AND, 코드는 OR (requirement) — **주석 추가**

`13-replay-rerun.md` §10.2 는 *해제* 조건을 AND 로, 구현은 *차단* 조건을 OR 로 짠다.
드모르간 쌍대라 동치이고 기능 결함이 아니지만, 대조할 때마다 뒤집어 읽어야 한다.
`blockedByMaskedInput` JSDoc 에 한 줄 적어 다음 대조 비용을 줄였다.

## consistency `18_03_37` (BLOCK: NO, CRITICAL·WARNING 0)

INFO 3건 전부 조치 불요. 그중 **§R17 헤딩 날짜 미갱신**(INFO-1)은 checker 스스로
*"08-16/08-17 갱신 때도 헤딩을 안 건드린 관례라 새 결함 아님 · 강제 아님"* 으로 판정했고,
spec 편집이라 planner 턴이 필요하다 — 선택 항목 한 줄에 planner 턴을 다시 여는 것은
비례가 맞지 않아 그대로 둔다. 직전 라운드의 swagger.md §3 WARNING 은 `d446ab7ad` 로
해소 확인됐다.

## 미반영 INFO (5건)

1(마커 미러 계약 테스트) — 기등재 트래커. 2(`beforeEach` 복제) · 3(배경 서사 중복) ·
4(제목 셈법 차이) — 3라운드 연속 defer 판정 유지. 6(`setParam` 로컬 부작용) — 기록용.

## 검증

TEST WORKFLOW 4단계 PASS —

| 단계 | 결과 |
| --- | --- |
| lint | PASS (53s) |
| unit | PASS — backend jest **427 suites / 8,832** · frontend vitest **286 files / 6,072** · web-chat **23 / 451** |
| build | PASS (116s) + backend 타입체크 ratchet **199건/38파일 baseline 일치** |
| e2e | PASS (195s) — backend supertest **276** · playwright **51** (로그 `51 passed (57.7s)` 실측) |

frontend 는 6,071 → **6,072** (orphan 구조값 회귀 1건).
