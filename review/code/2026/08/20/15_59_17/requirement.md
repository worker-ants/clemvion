STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 코드 리뷰 — eia-inputdata-marker-guard (15_59_17)

## 검토 방법

이 changeset(`origin/main...HEAD`)은 `Execution.inputData` egress 마스킹 카브아웃 폐지 +
재제출 소비처(폼 프리필·Re-run 모달·에디터 히스토리 로드) 3곳 마커 가드 신설을 다룬다. 이미
4라운드(`14_08_45`→`14_44_08`→`15_10_25`→`15_32_34`)의 requirement 리뷰·fix 를 거쳐 CRITICAL
2건·WARNING 다수가 해소된 상태다. 이번 라운드는 (a) 직전 라운드 requirement.md 를 먼저 읽어
"재확인 통과" 로 이미 검증된 항목을 반복 조사하지 않고, (b) 4라운드 requirement 리뷰가 다루지
않은 각도 — **round4 자체의 fix 커밋(`38b4669bd`, "무효 JSON 으로 마스킹 차단이 풀렸다")이
spec 본문까지 동반 갱신했는가** — 를 `git show`/`Read`/`grep` 으로 직접 재구성해 대조했다.
핵심 코드(`rerun-modal.tsx`, `masked-markers.ts`, `editor-toolbar.tsx`,
`executions.service.ts`)는 전문을 다시 읽었다.

## 발견사항

- **[WARNING] [SPEC-DRIFT]** Re-run 모달 차단 판정에 세 번째 조건(구조 필드 coerce-실패 가드)이
  코드·테스트엔 있는데, 그 조건을 명세하는 spec 3곳 + CHANGELOG 1곳은 여전히 "두 조건의 합"만
  서술한다
  - 위치(코드, 구현·SoT): `codebase/frontend/src/components/executions/rerun-modal.tsx:364-371`
    (`blockedByMaskedInput` — `maskedKeys.some((k) => !touchedMaskedKeys.has(k) ||
    hasMaskedMarkerLeaf(paramValues[k]) || (isStructuredField(k) && typeof paramValues[k] ===
    "string"))`, 세 번째 `||` 절)
  - 위치(spec, 갱신 필요):
    - `spec/5-system/14-external-interaction-api.md:1571` — §R17 "닫는 조건" 표의 Re-run 모달
      행: `"...제출 차단**(두 조건의 합 — 값만 보면 타입 캐스팅에, 터치만 보면 되돌린 마커에
      뚫린다)..."`
    - `spec/5-system/13-replay-rerun.md:353-364` — §10.2 캐비엇: `"...사용자가 그 필드를
      채우고 그 값에 마커가 남아 있지 않을 때까지 Re-run 제출을 막는다..."` (두 조건만 서술)
    - `CHANGELOG.md:19-25` — `"**차단 판정은 두 조건의 합이다** — ...값만 보면.../터치만
      보면..."` (두 항목만 열거)
  - 상세: `rerun-modal.tsx` 의 `blockedByMaskedInput` JSDoc(`:329-357`) 자체는 이 세 번째
    조건을 정확히 설명한다 — *"object/array 필드를 무효 JSON 으로 깨면
    `hasMaskedMarkerLeaf` 의 정확 일치에 안 걸려 차단이 조용히 풀린다(`15_32_34` W1, 리뷰어가
    재현). **선언된 필드 타입**이 object/array 인데 현재 값이 문자열이면 파싱 실패 상태이므로
    무조건 막는다"*. `git show 38b4669bd`(라운드4 RESOLUTION 커밋)로 확인한 결과 이 조건은
    `rerun-modal.tsx` 코드와 `rerun-modal.test.tsx` 캐너리(`:706`
    `"[캐너리] object 필드를 무효 JSON 으로 만들어도 계속 막는다"`, 뮤테이션으로 고정)에는
    반영됐지만, 같은 커밋이 건드린 spec/CHANGELOG 변경은 `spec/5-system/13-replay-rerun.md`
    §10.4 i18n 카탈로그에 신규 키 행 1줄과 `spec/3-workflow-editor/3-execution.md` §8
    WS 서술 정정뿐이었다 — **§R17 "닫는 조건" 표·§10.2 캐비엇·CHANGELOG 본문의 차단 조건
    서술 자체는 건드리지 않았다.** 세 문서 모두 지금도 "값만 보면 타입 캐스팅에 뚫린다 /
    터치만 보면 되돌린 마커에 뚫린다"는 **두 우회 경로만** 열거하고, 라운드4 가 실제로 재현해
    막은 **세 번째 우회(무효 JSON → raw 문자열 폴백 → 정확 일치 미스)** 는 어디에도 나오지
    않는다. 이 spec 3곳만 읽는 독자(코드를 안 보는 다음 개발자·planner)는 차단 판정이
    "터치 AND 마커부재"의 이항 AND 라고 오해하게 되고, 이 조건을 나중에 리팩터할 때 세 번째
    가지를 실수로 빠뜨릴 위험이 생긴다 — 이 저장소가 반복 겪은 "부분 편집이 인접 자리를
    놓친다" 결함 클래스의 재발이다(단, 이번엔 코드가 아니라 spec/CHANGELOG 쪽 자리).
    **방향 판정**: 코드는 명백히 옳다(리뷰어가 실제 우회를 재현했고, 과잉 차단 1차 시도를
    되돌린 이력이 있으며, 뮤테이션 테스트로 고정돼 있다) — spec 이 그 뒤를 따라가지 못한
    전형적 SPEC-DRIFT 다.
  - 제안: (코드 변경 불요) `spec/5-system/14-external-interaction-api.md:1571` 의 Re-run
    모달 행을 "두 조건의 합" → "세 조건의 합"으로 바꾸고 세 번째 우회 경로("선언 타입이
    object/array 인데 값이 파싱 실패 상태(문자열)이면 무조건 막는다")를 추가한다.
    `spec/5-system/13-replay-rerun.md:360-364` 캐비엇에도 같은 조건을 한 문장 보강한다.
    `CHANGELOG.md:19-25` 목록에 세 번째 항목("**object/array 필드가 무효 JSON 이면** — 파싱
    실패 상태를 값 검사가 못 잡아 정확 일치 미스로 조용히 풀린다")을 추가한다. 이 PR 을 막을
    사안은 아니다 — 지금까지 4라운드가 CRITICAL 을 전부 해소한 뒤 남은 문서 정합성 항목이므로
    `plan/in-progress/eia-inputdata-marker-guard.md` 트래커에 등재 후 별도 턴에서 반영하는
    경로도 가능하다.

## 재확인 — 이전 라운드가 이미 검증했고 이번 재검토에서도 유효

아래는 4라운드 requirement 리뷰가 CRITICAL/WARNING 으로 잡아 fix 했고, 이번 라운드에서
`Read`/`grep` 으로 직접 재확인해 여전히 해소돼 있음을 확인한 것들이다(재지적하지 않는다):

- `hasMaskedMarkerLeaf` 가 Re-run 모달 object/array 파라미터에도 적용(`splitMaskedParameters`,
  `rerun-modal.tsx:116-138`) — 값은 지우지 않고 제출만 차단.
- 차단 판정의 "터치 AND 마커부재" 두 조건(`blockedByMaskedInput`) — 이번 라운드에서 실제로는
  **세 조건**으로 확장돼 있음을 위 발견사항에서 짚었다(코드는 맞고 문서만 stale).
- `ExecutionDto.inputData`/`NodeExecutionSummaryDto.inputData`/`ResponseExecution`(백엔드)
  JSDoc 주제문이 모두 현재형("세 컬럼"·"같은 정책")이고 옛 서술은 `> 2026-08-20 이전에는...`
  blockquote 로 내려가 있음(`execution-response.dto.ts:52`,
  `executions.service.ts:101-102`) — 3회 재발했던 "주제문 방치" 패턴이 이번엔 전 자리에서
  해소됨.
- `executions.service.spec.ts` describe 소제목 갱신, `MASKED_INPUT_DATA_REASON` 앵커
  전수 삭제(코드베이스 grep 0건, 이번 라운드 재확인) 확인.
- backend 마스킹 관문 4표면(`toResponseExecution`·`toExecutionDto`·`findById` 의
  `nodeExecutions[]` map·`background-runs.service.ts`)이 모두 `inputData` 를 포함 — 코드
  재확인.
- frontend `MASKED_MARKERS`(`lib/utils/masked-markers.ts`) ↔ backend
  `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 리터럴 일치, i18n ko/en parity
  (`runWithInputMasked`, `maskedInputBlocked`) — 재확인.
- 에디터 히스토리 로드(`editor-toolbar.tsx:100-119`)는 spec §2.2(`3-execution.md:91`)와
  line-level 로 일치 — JSON 파싱 실패와 마커 검사를 분리해 사유를 한 번만 말한다.

## Spec fidelity 교차검증 — 위 SPEC-DRIFT 1건 외 문제 없음

- `spec/1-data-model.md` — `Execution.input_data`/`NodeExecution.input_data` 두 행 모두
  "응답·emit 시 자격증명 값-패턴 마스킹"으로 갱신, 구현과 일치.
- `spec/5-system/6-websocket-protocol.md` — "레벨이 가른다" 축 폐기, 구현과 일치.
- `spec/5-system/12-webhook.md` §5.3 — ingestion 층이 여전히 유일한 방어인 경계(`$trigger.headers`
  는 egress 를 안 탐)를 정확히 유지.
- `spec/4-nodes/1-logic/12-background.md` §8.2 — 노드 레벨 `nodeExecutions[].inputData` 마스킹
  서술이 "두 레벨 모두"로 갱신, `background-runs.service.ts` 구현과 일치.
- `spec/3-workflow-editor/3-execution.md` §8/§2.2 — WS `inputData` flip-flop 서술 정정,
  히스토리 로드 마커 차단 서술 모두 구현과 일치.
- `spec/5-system/14-external-interaction-api.md` §R17 — "닫는 조건 충족" 표의 소비처 3곳·시점
  서술은 정확하나, 위에서 지적한 대로 Re-run 모달 행의 조건 개수만 stale.

## 요약

4라운드에 걸친 선행 requirement 리뷰가 CRITICAL 2건·WARNING 다수를 이미 해소했고, 핵심
요구사항(카브아웃 폐지, 3개 소비처 마커 가드, object/array leaf 처리, 터치+값 AND 판정,
backend 표면 정합)은 코드·테스트·spec 세 층위에서 견고하게 구현·검증돼 있다. 이번 라운드에서
새로 발견한 것은 **round4 자체가 낸 fix**(무효 JSON 우회 차단 — 세 번째 블록 조건)가 코드·
테스트에는 정확히 반영됐으나 그 조건을 서술하는 spec 3곳(§R17 표·§10.2 캐비엇)과 CHANGELOG
1곳은 여전히 "두 조건" 시절 문구에 머물러 있다는 것 — SPEC-DRIFT(코드가 옳고 문서가 못 따라감)
1건이다. 기능적 위험은 없다(코드가 실제로 세 조건을 다 집행하고 뮤테이션 테스트로 고정돼
있음) — 다음에 이 로직을 spec 만 보고 리팩터하는 사람이 세 번째 가지를 실수로 빠뜨릴 문서적
위험만 남는다.

## 위험도

LOW
