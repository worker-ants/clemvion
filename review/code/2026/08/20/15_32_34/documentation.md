STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 코드 리뷰 — eia-inputdata-marker-guard (15_32_34)

## 컨텍스트

이 changeset 은 이미 code review 3라운드(`14_08_45` CRITICAL2/WARNING7 → `14_44_08`
CRITICAL0/WARNING8 → `15_10_25` CRITICAL0/WARNING2, LOW)와 consistency review 5라운드를
거쳐 수렴했다. 앞선 라운드가 지적한 문서화 결함(자매 DTO JSDoc 방치, `executions.service.spec.ts`
describe 소제목 stale, `ResponseExecution` 주제문 stale, CHANGELOG AND-조건 서술 등)은
실측상 전부 반영돼 있음을 `Read`/`grep`으로 직접 확인했다 — 재지적하지 않는다. 이번 라운드는
그 위에서 아직 아무도 짚지 않은 지점을 찾는 데 집중했다.

## 발견사항

- **[WARNING]** `CHANGELOG.md` 안에서 이번 PR 이 뒤집은 결정을, **이 PR 이 건드리지 않은 더
  아래쪽의 기존 `Unreleased` 항목**이 여전히 정반대로 단언한다 — 같은 파일 안에서 최상단
  신규 항목과 정면으로 모순된다
  - 위치: `CHANGELOG.md:103` (`**⚠️ \`Execution.inputData\` 만 마스킹하지 않는다 (의도)** — 초안은 두 컬럼을 함께 닫았다가 **되돌렸다.**`) 및 그 아래 blockquote `:105-109`("카브아웃은 `Execution` 레벨 한정이다"), 본문 `:110-115`("회귀 캐너리로 비대상임을 고정했다"). 대비 대상은 이 PR 이 신설한 `CHANGELOG.md:3`(`## Unreleased — \`Execution.inputData\` 카브아웃을 닫았다 (재제출 소비처 3곳에 마커 가드)`).
  - 상세: `git blame -L 103,109 CHANGELOG.md` 로 확인한 결과 이 블록은 커밋 `89c3f3c53`(#1180, `origin/main` 에 이미 병합돼 이 PR 의 diff 범위 밖)이 쓴 것이고 이번 PR 은 이 줄들을 전혀 수정하지 않았다. 문제는 이 PR 이 바로 그 문서(§R17)가 기술하던 카브아웃 결정을 **뒤집었다는 점**이다 — `MASKED_INPUT_DATA_REASON` 은 코드에서 전수 삭제됐고(실측: `grep -rn MASKED_INPUT_DATA_REASON codebase/` 0건), `Execution.inputData` 는 이제 `toResponseExecution`/`toExecutionDto` 양쪽에서 마스킹되며, 캐너리 4건도 반전됐다(plan 체크리스트 `[x] 캐너리 4건 반전`). 그 결과 `CHANGELOG.md:103`의 "**의도**", ":105"의 "**카브아웃은 `Execution` 레벨 한정이다**", ":115"의 "**회귀 캐너리로 비대상임을 고정했다**" 서술이 전부 지금 코드 상태와 어긋나는데, 이 오래된 블록에는 이를 정정하거나 위쪽 신규 항목을 가리키는 전방/후방 참조가 전혀 없다. `CHANGELOG.md` 는 이 저장소에서 `Unreleased` 헤더 여러 개가 아직 릴리스되지 않은 채 누적되는 관행(같은 파일에 `## Unreleased —` 가 다수 존재, 실측 확인)이라, 릴리스 전까지는 한 파일 안에서 시간순으로 서로 다른 결정을 기록한 항목들이 공존한다. 그런데 이번처럼 **뒤 항목이 앞 항목의 결정을 명시적으로 뒤집는 경우**, 위에서부터 읽는 사람(릴리스 노트 작성자·감사자)은 3행 만에 반대되는 두 "의도적" 단언을 만나 어느 쪽이 최종본인지 판단할 근거가 본문에 없다 — 이 세션이 검토한 앞선 8라운드(code 3 + consistency 5) 리뷰 중 어느 것도 diff 범위 밖의 이 구간까지는 대조하지 않아 그동안 놓쳐 왔다.
  - 제안: `CHANGELOG.md:103-115` 블록에 "**→ 2026-08-20 에 이 카브아웃은 닫혔다(위 최신 Unreleased 항목 참조)**" 형태의 짧은 후방 참조 caveat 를 추가하거나(이 저장소가 spec 문서에서 이미 쓰는 "해소(YYYY-MM-DD)" 관용구), 릴리스 전이라는 전제를 활용해 이 오래된 문단 자체를 최신 결정으로 축약 병합한다. `spec/5-system/13-replay-rerun.md` §10.2 나 `execution-response.dto.ts` 처럼 "과거 서술은 `>` blockquote 로 내려보내고 주제문은 현재형" 패턴을 이미 이 PR 다른 파일들이 일관되게 쓰고 있으므로 같은 패턴을 여기에도 적용하면 된다.

- **[INFO]** plan 제목과 CHANGELOG 제목이 "소비처 개수"를 다른 기준으로 세어 나란히 읽으면
  숫자가 어긋나 보인다 (반복 지적 — 이전 라운드가 이미 조치 불요로 판정한 항목, 재확인 목적)
  - 위치: `plan/in-progress/eia-inputdata-marker-guard.md:2` (frontmatter `title`, "재제출 소비처 **2곳**에 마커 가드") vs `CHANGELOG.md:3` ("재제출 소비처 **3곳**에 마커 가드")
  - 상세: `review/code/2026/08/20/14_44_08/documentation.md`(이전 라운드)가 이미 같은 불일치를 INFO 로 지적했고 `RESOLUTION.md`(14_44_08)가 "리뷰어가 조치 불요로 판정"으로 명시적으로 defer 했다. 이번 라운드에도 두 파일 모두 그대로다 — plan 은 "이 작업이 새로 세우는" 가드 2곳(Re-run 모달·에디터 히스토리 로드)만 세고, CHANGELOG 는 #1181 폼 프리필까지 포함한 총 3곳을 센다. 각자 문서 내부에서는 일관되므로 실질 모순은 아니다.
  - 제안: 이전 라운드 판정대로 조치 불요. 다만 plan 제목에 "(총 3곳 중 나머지 2곳)" 같은 짧은 한정어를 붙이면 두 문서를 나란히 볼 때의 혼동을 없앨 수 있다는 제안은 여전히 유효하다.

## 확인했으나 재지적하지 않은 것 (실측상 이미 해소됨)

- `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` 의
  `ExecutionDto.inputData`/`NodeExecutionSummaryDto.inputData` JSDoc — 주제문이 현재형으로
  올바르게 재작성돼 있고(`**값-패턴 마스킹 대상이다**`), 옛 서술은 `> 2026-08-20 이전에는 …`
  blockquote 로 이동됨(`14_08_45` C2 해소 확인).
- `codebase/backend/src/modules/executions/executions.service.spec.ts` 의 describe 소제목 —
  `## 두 레벨 모두 마스킹 대상이다` 로 갱신돼 있음(`14_44_08` W7 해소 확인).
- `codebase/backend/src/modules/executions/executions.service.ts` 의 `ResponseExecution`
  JSDoc 주제문 — "마스킹 대상 **세 컬럼**"으로 정정돼 있음(`15_10_25` WARNING1 해소 확인).
- `codebase/frontend/src/components/executions/rerun-modal.tsx` 의 `blockedByMaskedInput`
  JSDoc — 두 조건(합)의 근거가 표로 병합된 단일 블록으로 정리돼 있음(`14_44_08` W8 해소 확인).
- `MASKED_INPUT_DATA_REASON` 앵커 — `codebase/`·`spec/` 전수 grep 0건으로 완전히 삭제 확인
  (plan 이 주장한 "6곳 전수 삭제"와 실측 일치).
- `spec/5-system/14-external-interaction-api.md` §R17 "판단 기준" 비교표·`spec/1-data-model.md`
  §2.13/NodeExecution 대비 문장·`spec/5-system/6-websocket-protocol.md` "레벨이 가른다" 축·
  `spec/5-system/12-webhook.md` "유일한 방어" 문구 — 전부 이 PR 의 diff 로 갱신돼 새 결론과
  정합함을 실측 확인(consistency `12_29_59`/`12_41_29` 라운드가 지적한 갭이 실제로 메워짐).
- 유저 가이드 MDX 4파일(ko/en × run-results/running-a-workflow) + i18n dict 4파일(ko/en ×
  editor/history) — 신규 UX(마커 남아있는 동안 Run/재실행 비활성)를 반영하고 ko/en parity 확보.

## 요약

이번 changeset 은 `Execution.inputData` egress 마스킹 카브아웃 폐지라는 단일 결정을 CHANGELOG·
plan·spec 7개 파일·backend DTO/서비스·유저 가이드 4개·신규 `masked-markers.ts` 유틸·다수
테스트에 걸쳐 반영했고, 이미 8라운드(code 3 + consistency 5)의 검토를 거치며 "주제문은 안 고치고
캐비엇만 덧붙이는" 반복 결함 패턴을 실측상 전부 해소했다. 이번 라운드에서 새로 찾은 유일한
실질 문제는 `CHANGELOG.md` 최상단(이 PR 신규 추가분)과, 이 PR 이 건드리지 않은 더 아래쪽의
기존 `Unreleased` 항목(#1180, `origin/main` 에 이미 존재) 사이의 **미해소 자기모순**이다 — 이 PR
자신의 diff 범위 밖이라 앞선 어떤 리뷰 라운드도 대조하지 않았던 사각지대다. 코드 동작에는
영향이 없고(스캔 대상은 순수 문서), 릴리스 전 `Unreleased` 섹션이라 정정 비용도 낮다.

## 위험도

LOW
