# Consistency Check 통합 보고서 (--plan, EIA ack shape + swagger §5-1)

- 대상: `plan/in-progress/eia-context-schema-followups.md` · diff-base `origin/main`
- checker 2종 실행(rationale_continuity · cross_spec). 변경이 **spec 사실 정정 + 규약 명문화**
  라 그 둘이 본령이다.

## BLOCK: NO

Critical 0 · WARNING 0.

## 전체 위험도

**NONE** — 두 checker 모두 NONE.

## Critical / 경고

없음.

## 참고 (INFO)

| # | checker | 발견사항 | 조치 |
|---|---------|----------|------|
| 1 | rationale | **"2필드 응답이 존재한 적 없다" 에 이력 뉘앙스** — 그 문구는 "한때 맞았다가 낡은" 게 아니라 **구현 이전 spec 초안(#228)에서 유래해 R16(#604)이 옮겨 적은** 것이다 | **반영** — 정정문에 그 경위를 적었다. 내 표현("코드 관점")과 배치되진 않으나 정확히 적는 편이 낫다 |
| 2 | rationale · cross_spec | 번들이 **이번 diff 의 target 문서 2건을 또 누락**했다(EIA spec · swagger.md) | 직전 티켓에서 이미 `harness-review-gate-followups.md` 에 등재 — **2연속 재현**이라 그 항목의 근거가 강해졌다 |
| 3 | cross_spec | `EIA_EXECUTION_STATUS_VALUES` 선언 순서가 `1-data-model.md` 서술 순서와 다르다(**값 집합은 동일**) | 조치 불요 — 코드 docstring 이 "의도된 divergence(로컬 리터럴이 wire SoT)" 로 명시 |
| 4 | rationale | swagger.md §5-1 신설 문단이 `## Rationale` 에 미러링되지 않았다 | 조치 불요 — 그 문서는 §1-4 처럼 본문 인라인 근거로 그치는 관행이 이미 혼재 |

## checker 별 결과

| checker | 위험도 | 핵심 |
|---------|--------|------|
| rationale_continuity | **NONE** | R16 편집이 **결정 번복이 아니라 사실 정정**임을 원문 대조로 확인(채택 문구는 글자 그대로 동일). 반증 시도 실패 — `cancel()` 이 파일 생성 이래 불변 |
| cross_spec | **NONE** | 다른 영역 spec 은 **이미 옳게** 적혀 있었고, npm SDK 가 **이미 새 shape 을 구현**하고 있었다. 불일치는 EIA 문서 내부에만 있었다 |

## 이 라운드에서 확인된 것

**1. 판정의 독립 증거가 셋 나왔다.**
`/cancel` 이 `InteractAckDto` 를 쓴다는 판정을 코드 한 곳으로 내렸는데, checker 들이 세 증거를
더 댔다 — (a) `interaction.service.ts` 의 `cancel()` 이 **파일 생성 커밋부터 불변**,
(b) `packages/sdk` 의 `cancel()` 이 `Promise<InteractAck>` 로 **이미 새 shape 구현·테스트**,
(c) `data-flow/15` 시퀀스와 `7-channel-web-chat §R5` 가 **이미 새 shape 참조**.

**2. 불일치의 범위가 좁았다.**
"spec 전체가 낡음" 이 아니라 **EIA 문서 내부(§5.1 vs §5.4/R16)에만** 있던 불일치였다.
이번 정정이 그걸 없애면서 나머지 영역과 정합을 이룬다 — 새 불일치를 만들지 않는다.

**3. 위젯은 영향권 밖이다.**
`channel-web-chat` 의 `interact()` 는 `Promise<void>` 라 **ack body 를 아예 파싱하지 않고**,
`/cancel` REST 도 호출하지 않는다(항상 `command:"cancel"` 로 `/interact`). 런타임 영향 0.

**4. §5-1 신설은 "사후 정식화" 였다.**
같은 plan 의 과거 항목이 이미 "§5-1 원칙" 을 근거로 엔티티 enum 파생을 거부했는데, **그때는
그 근거가 문서에 없었다.** 이번 편집이 그 갭을 메웠다 — 지어낸 근거가 아니라
`execution-status.literal.ts` docstring 에 실재하던 것을 규약으로 승격했다.
