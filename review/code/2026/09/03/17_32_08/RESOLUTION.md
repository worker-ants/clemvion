# RESOLUTION — entity nullable 배치 2 리뷰 3R (최종)

대상 SUMMARY: 위험도 **LOW** · Critical **0** · Warning **0** · INFO 4

**코드 조치 없음 — 수렴.** 7개 reviewer 전원이 1R·2R 의 WARNING 7건 해소를 각자 실측으로
재확인했다. documentation reviewer 는 특히 *"허위 완료 주장 2건 포함 전부 실측 재확인 —
**이번엔 주장과 실물 일치**"* 로 적었다.

## 라운드 추이

| 라운드 | Critical | Warning | 성격 |
|---|---|---|---|
| 1R | 0 | 4 | 내 서술 진위 3 · **내 분석 오류** 1 |
| 2R | 0 | 3 | **허위 완료 주장** 1 · 가드 사각지대 2 |
| 3R | 0 | **0** | — |

## INFO#1 — 내가 만든 불일치, 그러나 라운드를 더 돌지 않는다

이번 배치가 재포맷한 `@Column` 4곳 중 `notification.entity.ts` 의 `resourceType` 만 키 순서가
다르다(`name → type → **length → nullable**` vs 형제 3곳 `name → type → **nullable → length**`).
**내가 만든 불일치가 맞다.**

그런데 이걸 고치면 `codebase/` 가 바뀌어 **Critical 0 · Warning 0 인 라운드를 다시 돌아야
한다.** reviewer 도 *"순수 cosmetic, 이번 배치를 막을 사유 아님"* 으로 적었다. 배치 3 이 엔티티
데코레이터를 어차피 만지므로 그때 통일한다.

> **plan 에 실제로 등재했다** — 이 세션에서 "추적된다" 를 확인 없이 쓴 것이 세 번이라,
> 이번엔 문장을 쓰기 전에 자리를 먼저 만들었다. (`grep '키 순서'` → 1건)

## 미조치 (판단 유지)

- **INFO#2** `redactNodeExecutionRowForResponse` 제네릭 제약이 `inputData` 까지 `| null` 로 요구 —
  실제 엔티티(non-null)보다 넓다. 2R 에서 유예한 판단을 유지한다: 되돌리면 제네릭의 의미가
  줄고 구조적 서브타이핑상 호출부는 안전하다. **배치 3 에서 `inputData` 가 대상이 되는지 먼저
  보고** 정밀화한다.
- **INFO#3** `spec/1-data-model.md:260` — 선재 오류, planner 후속으로 등재됨.
- **INFO#4** `@Column type:` 메타데이터 변경의 위험 표면 — side_effect reviewer 가 LOW 를 준
  근거다. 배치 1 에서 같은 클래스가 **실제 부팅 실패**를 냈으므로 정당한 경계다. 이번 배치는
  `synchronize: false` + 신규 마이그레이션 부재 + DB `information_schema` 대조로 닫혀 있고,
  가드가 상시 적용된다. 배치 3 에서도 같은 절차를 반복한다.

## 검증

lint · unit(backend **9,250**) · build · e2e(**292**) **PASS** · backend ratchet **198/37** ·
`tsc` 비-spec 오류 **0** · `--impl-done` **BLOCK: NO · Critical 0 · Warning 0**.

reviewer 들이 독립 재현한 수치도 일치했다 — 관련 스위트 115/115, 엔티티 소유 모듈 975/976,
backend 전체 9,250/9,251, `null as unknown as` 잔존 스윕 **0건**.
