STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

`git diff origin/main...HEAD --stat`(274개 파일, 대부분은 이전 라운드들의 review/consistency
산출물 스냅샷)로 전체 범위를 확인하고, 실제 코드/문서 변경분(CHANGELOG·backend DTO·spec
7개·frontend 컴포넌트·i18n·plan)은 `Read`로 직접 열어 대조했다. 이 브랜치는 이미 code-review
10라운드(`14_08_45`~`18_03_01`) + consistency 9라운드를 거쳤고, 직전 documentation 라운드
(`18_03_01`)가 확인한 수정 사항이 최종 상태에도 유지돼 있는지, 그리고 그 이후의 마지막 커밋
(라운드10, `2c628f6ac`)이 새로 추가한 4개 파일(`CHANGELOG.md`·`rerun-modal.tsx`·
`rerun-modal.test.tsx`·plan)에 새로운 문서화 결함이 없는지를 중심으로 재확인했다.

## 발견사항

- **[WARNING]** plan 파일에 같은 blockquote 문단이 통째로 두 번 반복된다 (라운드10 편집 실수)
  - 위치: `plan/in-progress/eia-inputdata-marker-guard.md:176-182`
  - 상세: 176~177행의 `> **"자매 중 하나만" 이 이 브랜치에서 네 번** 나왔다 — 마커 보존
    캐너리 · 양성 단언 · 노드 레벨 vacuous 단언 · swagger JSDoc 형식. 매번 **내가 한쪽만
    고친** 것이다.` 문장이 181~182행에 **글자 그대로 다시** 나온다. 라운드10 커밋
    (`2c628f6ac`)이 `18_03_01` 라운드 결과를 반영하며 기존 blockquote(현재 181행부터) 바로
    **앞에** 새 문장 4줄(176~180행: 같은 오프닝 2줄 + 새 내용 2줄)을 삽입했는데, 오프닝 2줄을
    기존 오프닝과 병합하지 않고 그대로 복제해 넣은 것으로 보인다(`git show 2c628f6ac`의 diff
    에서 `+`로 추가된 176~180행 바로 뒤에 동일 텍스트로 시작하는 기존 181행이 컨텍스트 줄로
    이어지는 것으로 확인). 그 결과 176~180행은 *"고치는 편집이 새 결함을 만든다"* 는
    라운드10 회고로 끝나고, 곧바로 이어지는 181~184행은 같은 오프닝을 반복한 뒤 *"워크트리의
    `11_01_55`는 이 작업이 아니다"* 라는 무관한 다음 내용으로 넘어가, 같은 주장을 두 번 읽게
    된다.
  - 제안: 176~177행(신규)과 181~182행(기존)의 중복된 오프닝 문장을 하나로 합치고, 178~180행
    (라운드10 회고)과 183~184행(`11_01_55` 무관 설명) 이하를 그 아래에 순서대로 이어 붙인다.

- **[INFO]** plan 제목과 CHANGELOG 제목이 "소비처 개수"를 다른 기준으로 세어 나란히 읽으면
  숫자가 어긋나 보인다 (기존 라운드들이 반복 확인한 조치-불요 항목, 최종 상태에도 그대로 남음)
  - 위치: `plan/in-progress/eia-inputdata-marker-guard.md:2` (frontmatter `title`, "재제출
    소비처 **2곳**에 마커 가드 선행") vs `CHANGELOG.md:3` ("재제출 소비처 **3곳**에 마커
    가드")
  - 상세: plan은 "이 작업이 새로 추가하는 소비처"(Re-run 모달·에디터 히스토리 로드) 2곳만
    세고, CHANGELOG는 "닫는 조건을 충족한 총 소비처"(#1181 폼 프리필 포함) 3곳을 센다. 각
    문서 본문 안에서는 내적으로 일관되고 실제 모순은 아니다. `14_44_08`·`18_03_01` 두
    documentation 라운드가 이미 같은 항목을 INFO/조치-불요로 판정했고 이후 라운드들도
    의도적으로 손대지 않았다 — 새로 지적하는 항목이 아니라 최종 상태 재확인 차원에서만
    기록한다.
  - 제안: 조치 불요.

검증해 반증되지 않은 항목 (선행 라운드가 지적·수정한 것을 최종 상태에서 재확인, 신규 아님):

- `executions.service.spec.ts:1106-1131` describe/JSDoc 소제목 — 구 결론("의도적으로 대상이
  아니다")을 현재형으로 단언하던 문제가 `## 두 레벨 모두 마스킹 대상이다`로 정정돼 있고, 구
  결론은 `> 2026-08-20 이전에는 ...` blockquote로 내려가 있다.
- `executions.service.ts:100-115` `ResponseExecution` JSDoc 주제문 — "두 컬럼"이 `error` ·
  `inputData` · `outputData` 세 컬럼으로 정정돼 있고, `MASKED_INPUT_DATA_REASON` 앵커는
  코드베이스 전체에서 grep 0건으로 실제로 삭제돼 있다.
- `CHANGELOG.md:106-118` 기존 `Unreleased` 블록의 "`Execution.inputData` 만 마스킹하지
  않는다 (의도)" 단언 — 후방 참조 caveat(`> 이 카브아웃은 2026-08-20에 닫혔다`)으로 해소돼
  있다. 최상단 새 블록도 "차단 판정은 **세 조건**의 합" 으로 최종 판정과 일치한다.
  라운드10이 덧붙인 "닫힌 범위를 정확히 적는다 — UI 정상 흐름이다" caveat도 서버측 거부 트래커
  항목(`spec-sync-external-interaction-api-gaps.md:322`)과 정확히 교차 참조된다.
- `spec/5-system/14-external-interaction-api.md` §R17, `spec/5-system/6-websocket-protocol.md`,
  `spec/3-workflow-editor/3-execution.md`, `spec/5-system/12-webhook.md`,
  `spec/4-nodes/1-logic/12-background.md`, `spec/1-data-model.md`, `spec/5-system/13-replay-rerun.md`
  §10.2 — "레벨이 가른다" 축 폐기, 두 레벨 모두 마스킹, "닫는 조건 충족" 서술이 서로 정합하고
  코드(`rerun-modal.tsx`의 `blockedByMaskedInput`) 판정과도 일치한다(spec은 해제 조건을
  AND로, 코드는 차단 조건을 OR로 쓰는 드모르간 쌍대 관계까지 코드 JSDoc이 명시).
- `rerun-modal.tsx:169-177,307-332` 라운드10에서 새로 추가된 `inferTypeFromValue` 함수와
  `fields` JSDoc의 후속 caveat — orphan 필드는 "값의 모양", 그 외는 "선언된 타입"으로
  판정한다는 예외를 정확히 설명하고, 그 경계가 왜 반대인지(orphan엔 선언이 없음)까지 근거를
  남겨 두었다. 대응하는 회귀 테스트(`rerun-modal.test.tsx` 신규 `it`)에도 같은 근거가
  JSDoc으로 붙어 있다.
- `codebase/frontend/src/lib/utils/masked-markers.ts` — `hasMaskedMarkerLeaf`/`scanForMarker`
  의 "값 검사가 깊이 검사보다 먼저"라는 JSDoc 불변식이 실제 구현 순서와 일치하고, `backend
  MAX_REDACT_DEPTH`(10)와 프런트 `MAX_MARKER_SCAN_DEPTH`(10)도 grep으로 대조해 동일함을
  확인했다.

## 요약

이번 changeset은 `Execution.inputData` egress 마스킹 카브아웃 폐지라는 단일 결정을
CHANGELOG·backend DTO/서비스·spec 7개·유저 가이드 MDX 4개(ko/en)·신규 `masked-markers.ts`
유틸·다수 테스트에 걸쳐 반영했으며, 이미 10라운드의 code-review와 9라운드의 consistency-check
를 거치며 문서화 관점의 실질적 결함(주제문 방치·비교표 누락·CHANGELOG 자기모순·오래된 주석
등)이 전부 식별·수정된 상태다. 최종 diff를 직접 열어 재확인한 결과 이 수정들은 모두 유지돼
있다. 마지막 커밋(라운드10)이 다룬 4개 파일 중 `CHANGELOG.md`·`rerun-modal.tsx`·
`rerun-modal.test.tsx`는 새 로직(orphan 타입 추론, 서버 API 직접 호출 시 UI 가드 우회
범위)의 근거를 충실히 남겼지만, `plan/in-progress/eia-inputdata-marker-guard.md`의 체크리스트
회고 문단을 편집하며 기존 blockquote 앞에 새 내용을 삽입하는 과정에서 오프닝 문장을 그대로
복제해 같은 문장이 연속으로 두 번 나오는 편집 실수가 남았다(WARNING). 기능·spec·테스트에는
영향이 없는 내부 추적 문서 자리이므로 위험도는 낮다.

## 위험도

LOW
