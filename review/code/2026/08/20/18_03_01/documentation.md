STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

`git diff origin/main...HEAD --stat -- codebase spec CHANGELOG.md plan`으로 실 변경분(34개
파일, +1684/-232)을 확정하고, 프롬프트가 diff를 생략한 파일(`executions.service.ts`,
`executions.service.spec.ts`, `background-runs.service.spec.ts`, `masked-markers.ts`,
`masked-markers.test.ts`, `rerun-modal.tsx`, plan 3개)은 `Read`로 직접 열어 대조했다. 이
브랜치는 이미 code-review 8라운드(`14_08_45`~`17_38_33`) + consistency 다회를 거쳤고, 그중
`14_44_08`/`15_10_25` documentation 라운드가 지적한 WARNING(구 결론을 현재형으로 단언하는
소제목·주제문 방치)이 이번 최종 상태에서 실제로 수정돼 있는지를 중심으로 재확인했다.

## 발견사항

- **[INFO]** plan 제목과 CHANGELOG 제목이 "소비처 개수"를 다른 기준으로 세어 나란히 읽으면
  숫자가 어긋나 보인다 (기존 라운드가 반복 확인한 조치-불요 항목, 최종 상태에도 그대로 남음)
  - 위치: `plan/in-progress/eia-inputdata-marker-guard.md:2` (frontmatter `title`, "재제출
    소비처 **2곳**에 마커 가드 선행") vs `CHANGELOG.md:3` ("재제출 소비처 **3곳**에 마커 가드")
  - 상세: plan은 "이 작업이 새로 추가하는 소비처"(Re-run 모달·에디터 히스토리 로드) 2곳만
    세고, CHANGELOG는 "닫는 조건을 충족한 총 소비처"(#1181 폼 프리필 포함) 3곳을 센다. 각
    문서 본문 안에서는 내적으로 일관되고 실제 모순은 아니다. 이미 `14_44_08` documentation
    라운드가 같은 항목을 INFO로 판정하며 "조치 불요에 가깝다"고 명시했고, 그 이후 라운드들도
    수정하지 않았다 — 의도적 defer로 보인다.
  - 제안: 조치 불요. 굳이 닫으려면 plan 제목에 "(총 3곳 중 나머지 2곳)" 같은 짧은 한정어를
    붙인다.

검증해 반증되지 않은 항목 (선행 라운드가 지적·수정한 것을 최종 diff에서 재확인):

- `executions.service.spec.ts:1107,1131` describe/JSDoc 소제목 — `14_44_08` W7이 지적한
  "구 결론을 현재형으로 단언"이 최종본에서 `## 두 레벨 모두 마스킹 대상이다`로 정정돼 있고,
  구 결론은 `> 2026-08-20 이전에는 ...` blockquote로 내려가 있다.
- `executions.service.ts:100-115` `ResponseExecution` JSDoc 주제문 — `15_10_25` W1이 지적한
  "두 컬럼"이 `` `error` · `inputData` · `outputData` `` 세 컬럼으로 정정돼 있다.
- `CHANGELOG.md:106-109` 기존 #1180 블록의 "`Execution.inputData` 만 마스킹하지 않는다 (의도)"
  단언 — `15_32_34` W2가 지적한 자기모순을 후방 참조 caveat(`> 이 카브아웃은 2026-08-20에
  닫혔다`)으로 해소해 두었다.
- `spec/3-workflow-editor/3-execution.md:549` — `15_32_34` consistency W1이 지적한
  "WebSocket 이벤트에는 inputData가 포함되지 않음" 오서술이 실측 기반으로 정정돼 있다.
- `spec/5-system/14-external-interaction-api.md:1638-1649` "레벨이 가른다" 비교표 — 
  `12_29_59` rationale_continuity WARNING이 지적한 누락이 `Execution.inputData (REST) | 함`
  으로 갱신돼 있고, 판단 기준 문단도 2축으로 재정의돼 표와 정합한다.
- `rerun-modal.tsx:368-391` `blockedByMaskedInput` JSDoc — `14_44_08` W8이 지적한 "연속된
  두 JSDoc 블록 분리"가 하나의 표 포함 블록으로 병합돼 있고, `touchedMaskedKeys` →
  `touchedKeys`로 이름도 정밀화돼 있다(`17_13_19`/`14_44_08` INFO 반영).
- `masked-markers.ts`, DTO 2개, `background-runs.service.ts`/`.spec.ts`, spec 7개 전체를
  교차 대조한 결과 `MASKED_INPUT_DATA_REASON` 앵커 잔존 인용은 코드베이스에 0건이고, i18n
  키(`editor.runWithInputMasked`, `history.rerun.maskedInputBlocked`)는 ko/en 양쪽·호출부
  경로가 정확히 일치한다.

## 요약

이 changeset은 `Execution.inputData` egress 마스킹 카브아웃 폐지라는 단일 결정을
CHANGELOG·backend DTO/서비스·spec 7개·유저 가이드 MDX 4개(ko/en)·신규 `masked-markers.ts`
유틸·다수 테스트에 걸쳐 반영했고, 이미 8라운드의 code-review와 다회의 consistency-check를
거치며 문서화 관점의 실질적 결함(주제문 방치·비교표 누락·CHANGELOG 자기모순·오래된 주석 등)이
전부 식별·수정된 상태다. 이번 최종 diff를 직접 열어 재확인한 결과 그 수정들이 모두 반영돼
있음을 확인했고, 새로 재발한 결함은 발견하지 못했다. 유일하게 남은 것은 plan/CHANGELOG 간
"소비처 개수" 셈법 차이(INFO, 이미 세 차례 조치-불요로 판정된 항목)뿐이다.

## 위험도

NONE
