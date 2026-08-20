# RESOLUTION — 16_51_19

대상 SUMMARY: `review/code/2026/08/20/16_51_19/SUMMARY.md` (위험도 **LOW**, Critical **0**, WARNING **2**, INFO 8)

**처분: WARNING 1건 수정 · 1건 트래커 이월(기등재).** 병행 consistency(`16_52_12`)는
**BLOCK: NO**, 5 checker 전원 **위험도 NONE**, WARNING **0**.

---

## WARNING 1 — 노드 레벨 캐너리만 `inputData` 표면을 안 본다 (testing) — **수정**

**같은 작업 안에서 "자매 중 하나만" 이 또 나왔다.** 직전 라운드(`15_59_17` W6)에서
`ExecutionsService` 의 ingestion 마커 보존 캐너리 ⑥ 을 카브아웃 폐지에 맞춰 `inputData`
표면까지 확장했는데, **노드 레벨인 `background-runs.service.spec.ts` 는 빼먹었다.**
두 표면 모두 12-webhook §5.3 의 같은 계약을 진다.

> 이 저장소가 반복해 겪는 형태다 — 하드닝·확장을 **한쪽에만** 적용하고 자매를 안 세는 것.
> 직전 라운드의 RESOLUTION 에 *"자매를 전수로 세라"* 는 취지를 써 놓고, 바로 그 라운드에
> 확장한 캐너리의 자매를 못 셌다. 규칙을 적는 것으로는 안 잡힌다.

### 재검증 (뮤테이션)

`sanitize-error-message.ts:284` 의 마커 보존 제거
(`r = isMaskedMarker(v) ? v : VALUE_MASK_MARKER` → `r = VALUE_MASK_MARKER`):

| 단계 | 결과 |
| --- | --- |
| 뮤턴트 + `outputData` 단언 무력화 | **RED** — `Expected "[REDACTED]" / Received "***"` at `:339` (**`inputData` 단언**) |
| 원복 | 마스커 파일 `git diff` 무변경 확인 |

**앞 단언을 일부러 무력화하고 측정했다.** 그러지 않으면 `outputData` 단언이 먼저 죽어
신규 `inputData` 단언의 유효성은 검증되지 않은 채 남는다 — 직전 라운드에서 같은 함정을
한 번 겪은 지점이다.

- `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts`

## WARNING 2 — `inputData` 내용 계약 반전 (api_contract) — **트래커 이월** (3라운드 연속)

응답 *내용*이 원문→마스킹으로 바뀌었으나 OpenAPI 타입은 무변경이라 스키마 기반 계약
테스트로 감지되지 않는다. 남은 것은 **저장소 밖 소비자 존재 여부 조사**로, 코드가 아니라
운영 정보다 — 이 PR 안에서 확인할 수 있는 성질이 아니다. 기등재 트래커 항목
(`spec-sync-external-interaction-api-gaps.md`)이 그 조사와 릴리스 공지를 담고 있고,
저장소 안 프런트 3소비처는 이 PR 이 가드했다.

---

## 미반영 INFO (8건)

전부 이전 라운드가 이미 판정한 트래커 등재분 또는 defer 확정분이다:

- 1(서버측 마커 거부) · 8(inputData 반전, W2 와 동일 사안) — 트래커
- 2(`touchedMaskedKeys` 이름) · 4(제목 셈법 차이) — 이전 라운드 defer 유지
- 5·6·7(목록 마스킹 비용 · 에디터 디바운스 · `Set` 복사) — 리뷰어 스스로 "조치 불요"
- **3(넷째 조건 추가 시 표 갱신 포인터)** — 이미 그 형태로 들어가 있다. JSDoc 표 위에
  *"조건을 넷째로 늘릴 때는 이 표와 아래 술어를 같은 편집에서 고친다"* 가 있고, 각 행에
  *"이 조건이 빠지면 뚫리는 경로"* 열을 둬 표 자체가 갱신 필요성을 드러낸다.

## consistency `16_52_12` (BLOCK: NO, WARNING 0)

INFO 3건 전부 조치 불요 판정 — AI Assistant 별도 마스킹 경로와의 의도적 병존(기문서화) ·
backend↔frontend 동명 미러(의도) · `isStructuredType` 이 무관한 `isStructured` 들과
형용사를 공유(스코프 무충돌, 한 파일에서 함께 다룰 때 재고).

## 검증

TEST WORKFLOW 4단계 PASS —

| 단계 | 결과 |
| --- | --- |
| lint | PASS (53s) |
| unit | PASS — backend jest **427 suites / 8,832** · frontend vitest **286 files / 6,068** · web-chat **23 / 451** |
| build | PASS (147s) + backend 타입체크 ratchet **199건/38파일 baseline 일치** |
| e2e | PASS (238s) — backend supertest **276** · playwright **51** (로그 `51 passed (55.9s)` 실측) |

이번 라운드는 테스트 단언만 늘려 총계는 그대로다(같은 `it` 안에 단언 2줄 추가).
