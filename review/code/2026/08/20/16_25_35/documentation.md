STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 코드 리뷰 — eia-inputdata-marker-guard (16_25_35)

## 컨텍스트

이 changeset 은 이미 code review 5라운드(`14_08_45` → `14_44_08` → `15_10_25` → `15_32_34` →
`15_59_17`)와 consistency review 다수 라운드(impl-prep 3회, `--spec` 2회, impl-done 4회)를
거쳐 수렴했다. 앞선 라운드들이 반복 지적했던 "주제문 방치" 패턴(DTO JSDoc·`executions.service.spec.ts`
소제목·`ResponseExecution` 주제문·CHANGELOG/spec/plan 의 "두 조건" 잔존)이 최종 diff 상태에서
실제로 해소돼 있는지 `Read`/`grep` 으로 직접 재확인했다:

- `executions.service.spec.ts` describe 소제목 — `## 두 레벨 모두 마스킹 대상이다`로 갱신 확인 (fixed)
- `executions.service.ts` `ResponseExecution` 주제문 — "**세 컬럼**" 으로 갱신 확인 (fixed)
- `CHANGELOG.md` 최상단 항목과 기존 `#1180` 블록의 자기모순 — 후방 참조 caveat 추가로 해소 확인 (fixed)
- `spec/5-system/6-websocket-protocol.md`·`14-external-interaction-api.md` §R17 비교표 — "함"으로 갱신, "레벨이 가른다" 축 폐기 서술 확인 (fixed)
- `rerun-modal.tsx` `blockedByMaskedInput` JSDoc — 세 조건 표로 병합, `isStructuredField` 헬퍼가 JSDoc 앞으로 재배치되어 선언 인접성 확보 확인 (fixed)
- `CHANGELOG.md`·`spec/5-system/13-replay-rerun.md` §10.2·§R17 표 — "세 조건의 합"(coerce 실패 포함)으로 갱신 확인 (fixed)
- `MASKED_INPUT_DATA_REASON` 앵커 — 코드베이스(`codebase/`) 전수 grep 0건, 완전 삭제 확인 (fixed)
- `spec/5-system/13-replay-rerun.md` §10.4 i18n 카탈로그 — `maskedInputBlocked` 행이 실제 ko/en 리터럴 전문으로 반영 확인 (fixed)

이 항목들은 재지적하지 않는다. 이번 라운드는 그 위에서 **아직 검토되지 않은 나머지 표면**
(특히 `plan/in-progress/eia-inputdata-marker-guard.md` 의 리뷰 라운드 카운트 — 5라운드에
걸친 fix 이력을 요약하는 부분이라 매 라운드 사후에 갱신이 필요한 자리)에 집중했다.

## 발견사항

- **[WARNING]** plan 체크리스트의 리뷰 라운드 카운트가 실제 라운드 수보다 낮게 멈춰 있다 — 이 diff 의 마지막 커밋(`e1607c737`, 커밋 메시지 자체가 "라운드5 처분")이 반영되지 않았다
  - 위치: `plan/in-progress/eia-inputdata-marker-guard.md:153-162` (`- [x] \`/ai-review\` **3라운드**` 항목 153~161행, `- [x] \`--impl-done\` **3라운드**` 항목 162행)
  - 상세: 153행은 `` `/ai-review` **3라운드** `` 라고 못박고 `14_08_45`→`14_44_08`→`15_10_25` 세 라운드만 나열한다. 그런데 실제로는 이 diff 안에 `15_32_34`(RESOLUTION.md, WARNING 2건 처분)와 `15_59_17`(RESOLUTION.md, WARNING 9건 처분)까지 **총 5라운드**가 포함돼 있다 — `15_32_34` 는 159행에 각주처럼 `` (`15_32_34` W1) `` 로만 인용되고, `15_59_17` 은 plan 파일 어디에도 이름조차 등장하지 않는다. 이 diff 의 마지막 커밋 메시지(`git log`: `e1607c737 fix(review): 마커 보존 캐너리가 inputData 표면을 안 보고 있었다 — 라운드5 처분`)가 스스로 "라운드5"라고 부르는 그 라운드가 plan 헤딩엔 반영되지 않은 것이다. 162행의 `` `--impl-done` **3라운드** 전부 **BLOCK: NO** (`14_44_42` · `15_10_56`) `` 도 같은 형태로 어긋난다 — 이 diff 에 포함된 impl-done(`--impl-done, scope=spec/5-system/`) consistency 라운드는 `14_44_42`·`15_10_56`·`15_33_05`·`15_59_50` **4건**인데(각 `review/consistency/2026/08/20/<ts>/meta.json` 의 `mode` 필드로 실측 확인), 헤딩은 "3라운드"라 이미 세는 것과 인용 개수(2개)가 서로도 안 맞고 실제 건수(4개)와도 안 맞는다. 160행의 `` **문서 쪽은 같은 패턴이 3번** 재발했다 `` 도 `15_59_17` 의 RESOLUTION.md 가 스스로 기록한 값(4번째 재발 발견 후 grep 전수 스캔으로 5곳 추가 발견, 총 9곳)보다 낮다.
    이 저장소는 정확히 이런 종류의 결함(핵심 서술을 캐비엇으로만 덧붙이고 위 주제문·헤딩은 옛 값에 방치)을 이 PR 안에서만 5번 넘게 스스로 잡아 온 만큼(`14_08_45`→`15_59_17` RESOLUTION 이력), 감사증적(audit trail) 성격의 이 카운트 라인도 같은 리스크에 노출돼 있다 — push 이후 이 plan 이 `plan/complete/` 로 이동하면 "3라운드에 CRITICAL 2→0으로 수렴했다"는 부정확한 요약이 영구 기록으로 남는다.
  - 제안: 153행을 `` `/ai-review` **5라운드** `` 로 바꾸고 `15_32_34`(WARNING 2, 무효 JSON 우회 fix)·`15_59_17`(WARNING 9, 마지막 문서 미러 정리 + JSDoc 인접성 + 캐너리 커버리지)을 나열에 추가한다. 162행도 `` **4라운드** (`14_44_42`·`15_10_56`·`15_33_05`·`15_59_50`) `` 로 갱신한다. 160행의 "3번"도 최종 확정치로 정정한다.

- **[INFO]** (재확인, 조치 불요) plan 제목과 CHANGELOG 제목의 소비처 개수 표기가 여전히 다르다 — 직전 라운드(`14_44_08` documentation.md)가 이미 지적하고 "조치 불요에 가깝다"로 판정한 항목이 그대로 남아 있다
  - 위치: `plan/in-progress/eia-inputdata-marker-guard.md:2` (frontmatter `title`, "재제출 소비처 **2곳**에 마커 가드 선행") vs `CHANGELOG.md:3` ("재제출 소비처 **3곳**에 마커 가드")
  - 상세: plan 은 "이 작업이 새로 세우는 소비처"(Re-run 모달·에디터 히스토리 로드) 2곳을 세고, CHANGELOG 는 "닫는 조건을 충족한 총 소비처"(#1181 폼 프리필 포함) 3곳을 센다 — 각자 내적으로는 일관되고, 직전 라운드가 이미 "조치 불요에 가깝다"로 명시적으로 defer 했다. 재지적하지 않되, 두 문서를 나란히 보는 사람을 위해 존재를 기록만 남긴다.
  - 제안: 없음(직전 라운드 판정 유지).

## 요약

이번 changeset 은 `Execution.inputData` egress 마스킹 카브아웃 폐지라는 단일 결정을 CHANGELOG·plan·spec 7개 파일·backend DTO 2개·유저 가이드 4개(ko/en×2)·신규 `masked-markers.ts` 유틸·다수 테스트 파일에 걸쳐 반영했고, 5라운드의 code review 가 반복 잡아낸 "주제문 방치"(헤딩·토픽 문장은 옛 결론에 두고 캐비엇만 아래에 덧붙이는) 패턴이 최종 diff 상태에서는 실측상 전부 해소돼 있다 — 이번 라운드가 직접 `Read`/`grep` 으로 9곳 이상을 재대조해 확인했다. 유일하게 남은 문제는 그 반복적 fix 사이클 자체를 요약하는 plan 체크리스트의 라운드 카운트(`/ai-review` 3→실제 5, `--impl-done` 3→실제 4)가 diff 의 마지막 두 라운드(`15_32_34`·`15_59_17`)를 반영하지 못한 것이다 — 코드·spec·CHANGELOG 자체의 정확성에는 영향이 없지만, 이 plan 이 `plan/complete/` 로 이동해 영구 기록이 되기 전에 정정할 가치가 있다.

## 위험도

LOW
