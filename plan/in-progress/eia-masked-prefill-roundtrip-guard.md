---
worktree: eia-masking-round2-53afc8
started: 2026-08-17
owner: developer
branch: claude/eia-masking-round2-53afc8
status: in-progress
priority: P1
pending_plans:
  - plan/in-progress/spec-sync-external-interaction-api-gaps.md
spec_impact:
  - spec/4-nodes/1-logic/12-background.md
  - spec/5-system/14-external-interaction-api.md
  - spec/5-system/15-chat-channel.md
---

# 마스킹된 값이 폼 프리필로 되돌아와 실제 입력이 된다 — #1180 의 살아있는 잔여

## 발견 경위 — "점검" 항목이 진짜 결함을 냈다

정본 트래커의 **"WS 대기-재개 경로에도 같은 '마스킹된 값의 재사용' 이 있는지 점검"**
(`23_50_03` side_effect W2 로 등재)을 집행하다 찾았다.

**그 항목을 등재할 때 나는 이미 한 번 얕게 봤다.** 2라운드 리뷰가 이 클래스를 짚었을 때
`resumeFromButtons` 만 확인하고 *"버튼 재개는 payload 를 재제출하지 않으니 무해"* 로 정리한 뒤
form/conversation 경로를 끝까지 보지 않았다. 트래커에 *"form/conversation 재개까지 전수로
훑는 것이 값싸다"* 고 적어 둔 것은 **미루는 근거가 아니라 지금 했어야 할 일**이었다.
그래서 게이트 7라운드가 이걸 못 잡았다.

## 무수정 프로브 — 이미 살아있다

`89c3f3c53`(#1180 머지) 상태에서 production 코드 변경 0으로 관측:

```text
emitExecutionEvent(waiting_for_input, { formConfig: { fields: [...] } })
=== wire formConfig ===
  { name: 'apiToken', defaultValue: 'token=sk-live-XYZ' }  → 무변화 (아직 패턴 갭)
  { name: 'auth',     defaultValue: 'Bearer sk-live-ABC' } → "***"   ← 왕복 오염 성립
  { name: 'note',     defaultValue: '평범한 기본값' }        → 무변화
```

## 체인 (전부 실측)

| 단계 | 근거 |
|---|---|
| `formConfig` 가 `waiting_for_input` payload 안에 있다 | 위 프로브 |
| #1180 의 `maskWireEnvelope` 가 그 payload 전체를 마스킹 | `websocket.service.ts` |
| 프런트가 `field.defaultValue` 로 폼을 **프리필** | `dynamic-form-ui.tsx:325` `initialValueFor` |
| 사용자가 손대지 않고 제출 → 그 값이 **실제 폼 값** | `submitForm(formData)` |

Re-run 모달 CRITICAL 과 **글자 그대로 같은 클래스**다 — *읽혀서 되쓰이는 값에 마스킹을 걸면
가시성이 아니라 데이터 무결성 문제가 된다*.

**심각도는 Re-run 보다 낮다**: 워크플로 작성자가 폼 기본값에 자격증명을 넣어 둔 경우에만
발생하고(AI `render_form` 은 LLM 생성이라 더 드묾), 사용자가 그 필드를 편집하면 정상이다.
그래도 **조용히 잘못된 값이 제출되는** 성질은 같다.

## 왜 carve-out 이 아니라 마커 가드인가

`Execution.inputData` 때는 carve-out(마스킹 제외)으로 풀었다. **여기서는 안 된다** —
두 값의 외부 노출이 다르다:

| 값 | 외부 노출 | 그래서 |
|---|---|---|
| `Execution.inputData` | **없음** (외부 `getStatus` 미노출, 실측) | carve-out 이 안전했다 |
| `formConfig` | **있음** (`waiting_for_input` → SSE · notification webhook) | carve-out 하면 **외부 누출이 열린다** |

그래서 마스킹은 유지하고 **소비 쪽에서 마커를 감지해 재입력을 강제**한다.

> **덤**: 이 가드는 트래커가 `Execution.inputData` 의 *"닫는 조건"* 으로 적어 둔 바로 그
> 메커니즘이다 — 여기서 세우면 그 항목도 함께 풀린다.

## 마커 상수 미러 — 이 파일의 기존 관용구를 따른다

프런트는 backend NestJS 모듈을 import 할 수 없다. `dynamic-form-ui.tsx` 는 이미 같은 이유로
`DEFAULT_FILE_*` 를 복제하며 *"변경 시 spec + 양쪽 미러를 함께"* 라는 **동기화 의무**를 적어
뒀다. 마커 상수도 같은 방식으로 둔다.

## 작업 체크리스트

- [x] `/consistency-check --impl-prep` (`11_38_00`) — **BLOCK: NO**, CRITICAL 0 · WARNING 5
- [x] 프런트 마커 감지 유틸(`isMaskedMarker`) + 동기화 의무 주석(양쪽 미러 명시).
      이름은 backend SoT(`MASKED_MARKERS`/`isMaskedMarker`)와 **일치**시켰다 — 미러 동기화를
      grep 으로 하는 이상 이름이 다르면 다음 사람이 못 찾는다 (리뷰 W6)
- [x] `initialValueFor` — 마스킹 마커면 프리필하지 않고 타입별 빈 초기값으로
- [x] hint (KO/EN) — `editor.runResults.formMaskedDefaultHint`
- [x] 회귀 테스트 5건 — 마커 3종 프리필 차단 · 마커 아닌 값 보존(`a***b`) · **부분-매치 캐너리**
      (`postgres://***@db` 는 계속 프리필 = 정확 일치 경계 고정) · 안내 노출/부재 · **제출
      payload 에 마커 없음**. **뮤테이션 검증**: 가드 제거 → RED(오염 재현) ·
      `type="button"` → 14 RED · 힌트 조건 `true &&` → 2 RED (리뷰 W1·W2 vacuity 해소 확인)
- [x] spec — §R17 "닫는 조건" 갱신 + "프리필 왕복" 불릿 신설
      (**판단 기준 명문화**: 외부로도 나가면 마커 가드, 안 나가면 carve-out)
- [x] **impl-prep W1** — `12-background.md` §8.2 에 `outputData`/`inputData` 마스킹 + 노드
      레벨엔 카브아웃 미적용임을 명시
- [x] **impl-prep W2** — `15-chat-channel.md` §R-CC-15 `nodeName` → `nodeLabel`
- [x] 저비용 마무리 — 마커 JSDoc 을 `MASKED_MARKERS` 바로 위로(+ 프런트 미러 상호참조) ·
      유저가이드 Error 탭 캐비엇(KO/EN)
- [x] 트래커 갱신 — "WS 대기-재개 점검" **종결**(발견 1건 기록 + 왜 놓쳤는지) + 저비용 2건 체크
- [x] TEST WORKFLOW 4단계 PASS — lint / unit(백엔드 **427 suites · 8,812** · 프런트 **6,026**)
      / build / e2e **276** + playwright **51**
- [x] `/ai-review` (`12_06_12`) — CRITICAL **0**, WARNING **6** (MEDIUM) → **6건 전부 조치**
      (코드·테스트 5 + 설계 경계 문서화 1). RESOLUTION 은 `review/code/2026/08/17/12_06_12/`
- [x] 재-리뷰 (`12_33_36`) — CRITICAL **0**, WARNING **1** (LOW). 내 CHANGELOG fix 가 죽은
      포인터를 만든 것 → 자매 선례대로 **이 PR 의 `## Unreleased` 절 신설**로 해소.
      INFO 는 1건만 반영(fixture 를 구현 상수에서 파생 + 리터럴 대조 테스트 신설), 나머지
      4건은 트래커 등재. **testing reviewer 가 내 뮤테이션 결과를 독립 재현**해 vacuity
      해소를 확인했다
- [x] `--impl-done` (`12_34_24`) — **BLOCK: NO**, CRITICAL 0. WARNING 1(frontmatter `code:`
      증거 2건 누락) + INFO 2건(표기 혼용 · stale blockquote)까지 같은 턴에 반영
- [ ] 코드 동결 → 최종 게이트 → push

> **`token=` 패턴 확장은 이 PR 에 넣지 않는다** — 사용자가 순서를 택했다. 그 확장은 마스킹
> 대상을 넓혀 **이 왕복 오염 범위도 함께 넓히므로**, 가드가 선 뒤에 하는 것이 맞다.
