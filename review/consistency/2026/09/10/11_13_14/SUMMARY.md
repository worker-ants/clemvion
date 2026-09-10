# Consistency Check 통합 보고서

**BLOCK: NO**

> **이 파일은 호출자(main)가 썼다.** `consistency-summary` sub-agent 의 Write 는 하네스 훅에
> `SUMMARY.md` basename 정확 일치로 차단됐다(`Subagents should return findings as text, not
> write report files.` — [`subagent-call-contract.md §7`](../../../../../.claude/docs/subagent-call-contract.md)).
> 아래 본문은 그 sub-agent 가 반환한 전문이며, 끝의 「호출자 반영 결과」 절만 main 이 덧붙였다.

**집계 (감사용, 5개 checker 리포트 원문을 직접 세어 산출)**: Critical **0**건 / Warning **0**건 /
(실행가능) INFO **14**건(중복 1건 통합 후) — checker별: `cross_spec` 2, `naming_collision` 4,
`convention_compliance` 1, `rationale_continuity` 1, `plan_coherence` 7 (합 15, 그중
`convention_compliance`·`rationale_continuity` 각 1건이 동일 사안 → 1건으로 통합해 14).
이 외에 `convention_compliance` 의 "정보 확인 — 문제 없음" 5건(구조 적합성 검증)과
`naming_collision` 의 커버리지 갭 처리 기록 1건은 target 결함이 아니라 **검증 절차 자체의
기록**이라 위 INFO 집계에서 제외하고 아래 표에 별도로 남겼다. Critical 이 0건이므로 `BLOCK: NO`.

## 전체 위험도

**LOW** — Critical/Warning 0건. checker 자체 위험도는 `cross_spec`/`naming_collision`/
`convention_compliance` NONE, `rationale_continuity`/`plan_coherence` LOW. 실행 가치가 있는
항목은 사실상 1건(아래 「세션의 단일 실행 항목」)뿐이며 나머지는 기록·검증 목적 INFO 다.

## Critical 위배 (BLOCK 사유)

없음 — 5개 checker 전원 Critical 0건.

## planner 인계 (권한 밖 Critical)

없음.

## 세션의 단일 실행 항목 (2개 checker 독립 수렴)

`rationale_continuity` 와 `convention_compliance` 가 **서로 다른 각도로 같은 결함**에 도달했다.
독립된 두 checker 가 같은 지점을 지목했다는 사실 자체가 등급 라벨(둘 다 INFO)보다 무게가
크므로 별도로 뽑아 적는다.

- **지목 대상**: D-1(`3-schedule.md §4`)·D-2(`2-trigger-list.md §3`)가 `workflow` 필드 키-생략의
  사유로 "프런트엔드가 생성(`create`) 응답을 아예 읽지 않는다"(`schedulesApi.create`/
  `triggersApi.create` 가 `Promise<void>` 로 바디를 버리고 `queryKey` 무효화로 재조회)는 사실을
  §5.4 기준 (b)("선택적 부가 컨텍스트라 소비자가 부재를 정상 경로로 다룰 때")보다 "더 강한
  근거"로 제시한다.
- **`convention_compliance` 의 관점**: 이 사실 자체는 실측(`schedules.ts:66`/`triggers.ts:174`)과
  일치하고 결론("(b) 위반 아님")도 방어 가능하지만, "왜 이것이 (b) 를 만족하는가"를 잇는
  문장이 스펙 텍스트에 없어 다음 사람이 되짚어야 한다.
- **`rationale_continuity` 의 관점**: "더 강한 사실" 이라 부르는 것은 실제로는 (b) 의 **대체
  근거가 아니라**, (b) 가 요구하는 안전판(`?? ""` 폴백)이 현재 코드 경로에서 사실상
  미사용(dead fallback)이라는 관찰이다. target 문구("진짜 근거는 …다. spec 에는 후자를 적는다")가
  이 위계 — 대체물이 아니라 보조 근거 — 를 흐리게 읽힐 소지가 있다.
- **공통 결론**: 둘 다 CRITICAL/WARNING 이 아니라고 명시한다 — §5.4 위반이 아니고 (b) 인용도
  표에 그대로 유지되기 때문. 다만 두 checker 모두 "연결 문장 한 줄 추가"를 권한다.
- **제안(통합)**: D-1/D-2 문구에 다음 취지의 한 문장을 추가한다 — *"(응답이 읽히지 않으므로
  (b) 의 '정상 경로로 다룬다' 를 자명하게 충족하는 보조 근거이며, 향후 `create` 응답을 실제로
  소비하게 되면 이 판정을 재검토할 것)"*.

## 경고 (WARNING)

없음 — 5개 checker 전원 Warning 0건.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | `rationale_continuity` + `convention_compliance` (독립 수렴) | §5.4 기준 (b) 근거 연결 문장 부재 — 위 「세션의 단일 실행 항목」 참조 | D-1(`3-schedule.md §4`), D-2(`2-trigger-list.md §3`) | 위 통합 제안 문구 추가 |
| 2 | `cross_spec` | "기존 인용 2건" 이 실제보다 과소 집계(실측 4건: `2-trigger-list.md:170,198`, `3-schedule.md:112`, `12-webhook.md:514`) | draft §"앵커를 한 번 잘못 짚었다" 각주 | 계획 문서 각주일 뿐 spec 본문 아님 — 원하면 "2건"→"4건" |
| 3 | `cross_spec` | "사유 (b)" 배경 서술의 파일 인용이 `schedules/page.tsx:571,580` 근거를 누락(당시 `triggers/page.tsx:262·303` 만 인용, 그중 `:262` 는 create 가 아니라 toggle 핸들러) | draft §"사유 (b) 의 근거가 DTO 주석보다 강하다" | 계획 문서 다듬을 때 추가 인용 |
| 4 | `naming_collision` | **커버리지 갭 처리 기록**: 프롬프트 번들의 spec 서브코퍼스가 예산 절단으로 `spec/1-data-model.md` 1개만 남아 target 이 실제 편집·인용하는 3개 문서가 번들에 없었음. checker 가 이 갭을 **디스크에서 직접 읽어 닫음** — `2-trigger-list.md`·`3-schedule.md`·`5-system/2-api-convention.md` | 프롬프트 번들 spec 서브코퍼스 | 처리 완료 — 갭이 열린 채 남지 않았음 |
| 5 | `naming_collision` | 앵커 5개(`#291-…`·`#54-…`·`#검증-층-…`·`#3-api`·`#4-api`) 전부 대상 heading 이 파일 내 정확히 1건 — github-slugger `-1` 접미사 충돌 조건 없음 | D-1/D-2/D-3 전체 링크 | 조치 불요 |
| 6 | `naming_collision` | `workflow` 필드명이 저장소 전체에서 3가지 다른 shape 로 존재(`ScheduleTriggerWorkflowRefDto`/`TriggerWorkflowRefDto`/`WorkflowDto`). 세 번째(`CanvasSaveResultDto.workflow`)는 target 범위 밖 | 코드베이스 전역(target 비관련) | target 이 만드는 혼선 아님 |
| 7 | `naming_collision` | 스케줄/트리거 측 참조 이름 유사성(접두어 하나 차이)은 이미 코드 JSDoc 이 "갈아 끼우지 말 것" 으로 경고 중 — target 이 동일 문구·상호링크로 nav-spec 에 대칭 이식 | D-1, D-2 | 새 위험 아님 |
| 8 | `naming_collision` | D-1 은 `ScheduleDto` 클래스명 명시, D-2 는 `TriggerDto` 미명시 — 도입부 표기 스타일 비대칭(사소) | D-1 vs D-2 도입부 | 스타일 차원 |
| 9 | `convention_compliance` | **세션 내 최강 증거**: 신규 앵커 6개를 문서 가드가 실제로 쓰는 알고리즘(remark `mdast-util-from-markdown` + `github-slugger`)을 재현해 대상 문서 전체 heading 과 대조 — **6/6 정확 일치**, 중복 접미사 없음 | D-1/D-2/D-3 의 6개 링크 | `spec-link-integrity.test.ts` 통과 확정 |
| 10 | `convention_compliance` | 구조 적합성 4건 — (a) D-1/D-2 배치 절이 §5.4 "문서화하는 절" 요건상 유일 후보, (b) blockquote 안 GFM 표는 저장소 10곳 이상 검증된 패턴, (c) 상대 링크 방향 전부 정확, (d) D-3 데이터-출처 열이 §2.1 자매 행 선례와 동일 패턴 | D-1/D-2/D-3 | 위반 없음 |
| 11 | `plan_coherence` | tracker(W1/W2) 원문 스코프와 draft 스코프 대조 — 누락·과잉 없이 정확히 일치 | draft 전체 | 조치 불요 |
| 12 | `plan_coherence` | D-3 은 tracker 명시 요구가 아니나 draft 스스로 "§5.4 요구는 D-1/D-2 로 충족, D-3 은 별도 판단" 이라 경계를 밝힘 | draft D-3 "왜 넣나" 절 | 은폐 아님 |
| 13 | `plan_coherence` | 미선택 대안(`1-data-model.md §2.9.1`)은 건드리지 않되 D-1 이 NOT NULL 근거로 인용 — dangling 아니라 참조로 닫혀 있음 | draft "무엇을 하지 않나" + D-1 | 조치 불요 |
| 14 | `plan_coherence` | 자매 항목(`TriggerDto.workflow`, W2)이 D-2 로 완전 커버 — half-open 아님 | draft D-2 | 조치 불요 |
| 15 | `plan_coherence` | `--impl-done` 발화 여부를 정본 게이트에 위임하는 disposition — SKILL 및 tracker 내 선례(C-4)와 상충 없음 | draft 체크리스트 | 조치 불요 |
| 16 | `plan_coherence` | 동일 spec 파일을 건드리는 다른 in-progress plan(`spec-sync-auth-gaps.md`)은 이미 완료(2026-08-06)이고 겨냥 절도 달라 실질 충돌 없음 | 횡단 확인 | 조치 불요 |
| 17 | `plan_coherence` | Gate C — `spec_impact` 두 경로 모두 실재하며 draft 실제 편집 범위와 일치, 제3 spec 파일 미편집 | draft frontmatter | Gate C 충족 |

## Checker별 위험도

| Checker | 위험도 | Critical/Warning/INFO | 핵심 발견 |
|---------|--------|------------------------|-----------|
| `cross_spec` | NONE | 0/0/2 | 요청받은 5개 실증 주장 전부 코드·기존 spec 과 정확히 일치. 사소한 인용 부정확 2건만 |
| `naming_collision` | NONE | 0/0/4(+갭 처리 기록 1) | 예산 절단을 대상 3문서 직접 읽기로 해소. 앵커 5개 유일 해석 확인, 신규 식별자 충돌 없음 |
| `convention_compliance` | NONE | 0/0/1(+무결점 확인 5) | 앵커 6개를 docs-guard 알고리즘 재현으로 6/6 검증. 정식 규약 위반 없음 |
| `rationale_continuity` | LOW | 0/0/1 | §5.4 (b)·wire/DB 경계·참조 비대칭·`#1303` §9.1 선례 네 축 모두 실제 이력과 일치 |
| `plan_coherence` | LOW | 0/0/7 | tracker 스코프 정확 재현, 미해결 결정 우회·dangling·half-open 전부 없음. Gate C 충족 |

---

## 호출자 반영 결과 (main, 2026-09-10)

SUMMARY 의 권장 3건은 **spec 반영 시점에 전부 적용**했다. 선택 항목이었지만 셋 다 내 실측
오류이거나 위계 오류였으므로 남길 이유가 없었다.

| 권장 | 처분 |
|---|---|
| 1. §5.4 (b) 연결 문장 | **반영.** D-1/D-2 를 재작성해 (b) 의 기준(`?? ""` 폴백을 읽는 자리)을 **먼저** 세우고, "생성 응답을 안 읽는다" 를 *"읽히지 않는 응답에는 부재를 다뤄야 할 코드 경로 자체가 없으니 (b) 를 자명하게 충족한다"* 는 **극단적 인스턴스 + 재검토 신호**로 강등했다 |
| 2. "기존 인용 2건" → 4건 | **반영.** 전수 grep 으로 4건 확인(`2-trigger-list.md` 2 · `3-schedule.md` 1 · `12-webhook.md` 1). 내가 한 파일만 세고 저장소 전수를 세지 않았다 |
| 3. `schedules/page.tsx` 인용 추가 | **반영.** 두 `createMutation` 을 `triggers/page.tsx :300→:303` · `schedules/page.tsx :571→:580` 으로 정확히 인용. `:262` 가 create 가 아니라 `isActive` toggle 핸들러였음도 함께 기록 |

### SUMMARY 밖에서 main 이 추가로 실측한 것 2건

- **트리거 축에 캐너리가 없다.** `ScheduleTriggerRefDto.workflow` 는 e2e 4건(양성 3 + 생성 음성
  대조 1)으로 고정되는데 `TriggerDto.workflow` 는 **0건**이다(`relations: ['workflow']` 를 단언하는
  테스트 없음 — 유일 등장은 무관한 가드의 fixture). 이 축은 PATCH chatChannel 재조회에서 한 번
  깨졌던 자리이고(리뷰 `review/code/2026/09/06/01_13_50` W4) 구현으로만 닫혔다. D-2 註가 그
  비대칭을 명시하고, 고정은 `spec-draft-nullable-notation-followups.md` 의 신규 developer 항목으로
  넘겼다.
- **`3-schedule.md` frontmatter `code:` 에 e2e 가 없었다.** §4 註가 *"e2e 가 고정한다"* 고 주장하는데
  `schedule-trigger.e2e-spec.ts` 가 spec-linked 가 아니었다 — 보장의 근거가 추적 불가였다. 등재했다
  (선례: `slack.md`·`discord.md`·`15-chat-channel.md`).

### 세션 준비 단계의 하네스 결함 (별도 등재)

이 세션은 **기본 예산으로 한 번 준비했다가 폐기**했다. `cross_spec` 번들이 `spec/1-data-model.md`
하나만 싣고(적재 1 / 생략 112) 편집 대상 3파일을 전부 떨궜다 — 기본 `CONSISTENCY_MAX_CONTEXT_SIZE`
262,144 × `corpus` 0.40 = 104,857자인데 그 파일이 112,225자로 **몫보다 크다**. 랭킹은 정상
동작했고(4파일 전부 tier 1) 자연순 1번 파일이 tier 를 굶긴 것이다. 예산 800,000 으로 재생성해
네 파일 전부 적재를 확인한 뒤 진행했고, 폐기 세션 `11_08_19` 은 삭제했다(부분 세션이 게이트를
거짓 통과시킨다). 결함은 `plan/in-progress/harness-review-gate-followups.md` 에 등재했다 —
2026-08-10 에 닫힌 항목은 *순서*를 고쳤지만 *생존*은 아무도 단언하지 않아 기존 회귀 테스트
(`TheDocumentBeingEditedIsNeverOmittedTest`)가 이 케이스를 전부 통과한다.
