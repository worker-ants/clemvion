STATUS=success ISSUES=3

===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 코드 리뷰 — eia-inputdata-marker-guard (15_59_17)

## 컨텍스트

이 changeset 은 이미 code review 4라운드(`14_08_45` CRITICAL2/WARNING7 → `14_44_08`
CRITICAL0/WARNING8 → `15_10_25` CRITICAL0/WARNING2 → `15_32_34` CRITICAL0/WARNING2)와
consistency review 여러 라운드를 거쳐 수렴했고, 앞선 라운드가 반복 지적했던 "주제문 방치"
패턴(DTO JSDoc·spec.ts 소제목·`ResponseExecution` 주제문)은 실측상 전부 해소돼 있음을
`Read`/`grep`으로 직접 재확인했다 — 재지적하지 않는다.

이번 라운드는 **가장 마지막 커밋**(`38b4669bd`, `15_32_34` W1 — 무효 JSON 우회 fix, 세 번째
차단 조건 `isStructuredField` 추가)이 아직 어느 documentation 리뷰도 검토하지 않은 신규
코드라는 점에 집중했다. 그 결과 같은 "주제문 방치" 패턴이 **이 PR 안에서 실질적으로 4번째로**
재발한 것을 발견했다 — 이번엔 헤딩이 아니라 **CHANGELOG·plan·spec §R17 세 곳에 동시에 미러된
핵심 서술**에서다.

## 발견사항

- **[WARNING]** "차단 판정은 두 조건의 합" 서술이 세 SoT 문서에 그대로 남아 마지막 커밋이
  추가한 **세 번째 조건**(object/array 필드의 coerce 실패)을 반영하지 못한다
  - 위치: `CHANGELOG.md:19-25` (`## Unreleased — Execution.inputData 카브아웃을...` 항목 안,
    `**차단 판정은 두 조건의 합이다**` 문단), `plan/in-progress/eia-inputdata-marker-guard.md:125-128`
    (`> **차단 판정은 두 조건의 합이다**(리뷰 2라운드에 걸쳐 좁혔다)` 캐비엇),
    `spec/5-system/14-external-interaction-api.md:1571` (§R17 판단 기준 표, `Re-run 모달` 행 —
    `"...(두 조건의 합 — 값만 보면 타입 캐스팅에, 터치만 보면 되돌린 마커에 뚫린다)"`)
  - 상세: `codebase/frontend/src/components/executions/rerun-modal.tsx` 의
    `blockedByMaskedInput` 은 이제 `!touchedMaskedKeys.has(k) || hasMaskedMarkerLeaf(paramValues[k]) || (isStructuredField(k) && typeof paramValues[k] === "string")`
    로, **세 조건의 OR**(차단 관점) — 즉 해제하려면 "건드렸다" **그리고** "마커가 없다" **그리고**
    "coerce 실패 상태가 아니다" 세 조건을 모두 만족해야 한다. 이 세 번째 조건은 커밋
    `38b4669bd`(리뷰 `15_32_34` WARNING 1 처분: 무효 JSON 으로 `hasMaskedMarkerLeaf` 가 정확
    일치만 보는 경계를 우회해 차단이 조용히 풀리는 문제)에서 새로 추가됐고, 그 커밋 안에서
    `rerun-modal.tsx` 자신의 JSDoc(`### 세 번째 조건 — object/array 필드의 coerce 실패`, 소스
    329~357행)은 정확히 갱신됐다. 그런데 같은 논리를 요약해 미러하던 CHANGELOG·plan·spec §R17
    세 곳은 그 커밋에서 손대지 않아 여전히 "두 조건"(값 vs 터치)만 나열한다 — 실제로 존재하는
    세 번째 우회 경로(무효 JSON)에 대한 언급이 세 문서 어디에도 없다. 이 PR 자신의 plan
    체크리스트(`:151-160` 부근)가 *"문서 쪽은 같은 패턴이 3번 재발했다 — 아래에 캐비엇만
    덧붙이고 위 주제문은 안 건드리는 형태"* 라고 스스로 명명한 바로 그 결함 클래스가, 이번엔
    헤딩이 아니라 **여러 문서에 미러된 핵심 서술 자체**에서 4번째로 재발한 것이다. 부수적으로
    `plan/in-progress/eia-inputdata-marker-guard.md:151`(`` `/ai-review` **3라운드** ``)·`:159`
    (`` `--impl-done` **3라운드** ``)도 `15_32_34`/`15_33_05` 라운드(이 fix 를 유발한 라운드)를
    아직 반영하지 않은 카운트로 보인다.
  - 제안: 세 곳 모두 "세 조건의 합"으로 갱신하고, 세 번째 조건("선언된 필드 타입이
    object/array 인데 현재 값이 파싱 실패 상태의 문자열")과 그 우회 경로(무효 JSON)를 한 줄씩
    추가한다. plan 체크리스트의 라운드 카운트도 `15_32_34`/`15_33_05` 를 반영해 갱신한다.

- **[WARNING]** 새로 삽입된 헬퍼 선언이 기존 JSDoc 블록과 그 설명 대상 선언 사이에 끼어들어,
  큰 설명 블록이 시각적으로 잘못된(더 작은) 선언에 붙어 보인다
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx:329-371`
    (`/**` 블록 329행 시작 ~ `*/` 357행 종료 → 바로 다음 줄 358행에 별도의 1줄 JSDoc
    `/** 선언된 타입이 object/array 인가... */` → 359~362행 `isStructuredField` 선언 →
    364~371행 `blockedByMaskedInput` 선언). 프롬프트 diff 는 이 파일에 대해 생략돼 있어
    `Read`/`grep` 으로 직접 열어 확인한 실제 소스 줄 번호다.
  - 상세: 329~357행의 JSDoc 은 표·"세 번째 조건" 소절 전체를 포함해 명백히
    `blockedByMaskedInput`(364행) 하나를 설명하는 블록이다. 그런데 이번 커밋이 그 사이에
    `isStructuredField` 헬퍼(358~362행)를 새로 끼워 넣으면서, 소스를 위에서부터 읽는 사람은
    "판정이 왜 3조건의 합인가"를 설명하는 큰 블록 바로 다음 줄에서 `isStructuredField` 라는
    한 줄짜리 관계없는 헬퍼 선언을 만나고, 그 다음에야 실제 `blockedByMaskedInput` 선언을
    만난다 — 큰 블록과 그것이 설명하는 상수 사이에 별개 선언 하나가 끼어든 형태다. 이 저장소가
    같은 파일에서 이미 한 번 겪고 고친 "연속된 두 JSDoc 블록이 하나의 선언 위에 분리돼 있다"
    (`14_08_45` WARNING 8, `blockedByMaskedInput` 바로 이 자리)와 같은 결함 클래스의 재발이다 —
    이번엔 두 블록이 아니라 큰 블록 + 무관한 선언 + 작은 블록 + 그 선언의 순서로 더 헷갈리게
    꼬였다. `isStructuredField` 자신의 1줄 JSDoc(358행)은 정확하지만, 바로 위 329~357행의
    존재감(길이·표·소제목) 때문에 독자·IDE 어시스턴트 모두 그 큰 블록을 `isStructuredField`
    설명으로 오독하기 쉽다.
  - 제안: `isStructuredField` 헬퍼를 `blockedByMaskedInput` 선언보다 **위쪽**(329행 JSDoc
    블록보다도 위, 예: `setParam` 근처)으로 옮기거나, `blockedByMaskedInput` 선언 **바로 위**로
    옮겨 큰 JSDoc 블록이 여전히 그 상수 바로 위에 붙도록 한다. 또는 `isStructuredField` 자체를
    329행 JSDoc 안의 "세 번째 조건" 소절에서 `{@link isStructuredField}` 로 참조하고 헬퍼는
    파일 하단 유틸 섹션으로 이동하는 방법도 있다.

- **[INFO]** 신규 i18n 카탈로그 행이 이 표의 기존 관례(리터럴 문자열 그대로 기재)를 깨고
  요약·주석을 섞어 넣는다
  - 위치: `spec/5-system/13-replay-rerun.md:405` (§10.4 i18n 키 표,
    `history.rerun.maskedInputBlocked` 행)
  - 상세: 이 표의 다른 모든 행(예: `:414` `permissionDenied` — `"Re-run 권한이 없습니다
    (정책 RR-PL-06)"`)은 `codebase/frontend/src/lib/i18n/dict/{ko,en}/history.ts` 의 실제
    문자열을 **그대로**(괄호 안 정책 번호까지 포함해) 옮겨 적어 왔다(`grep` 으로 대조
    확인). 그런데 이번에 추가된 `maskedInputBlocked` 행은
    `자격증명으로 판별돼 가려진 입력이 있어요… (§10.2 마커 가드)` /
    `Some inputs were masked as credentials…` 로, 실제 dict 값(`dict/ko/history.ts:12-13`,
    `dict/en/history.ts:14-15` — 전체 문장이 `"...켜 주세요."` / `"...Use original input\"."`
    로 끝나며 `…` 로 잘리지 않고, `(§10.2 마커 가드)` 문구도 실제 문자열에 없음)과 다르다.
    이 표는 앞선 라운드(consistency `15_33_05`)가 i18n parity 확인 목적으로 신설한 행인데,
    실제 값과 다르면 이 표만 보고 문구를 대조하는 번역 QA·감사 작업이 오도될 수 있다.
  - 제안: 다른 행과 같은 방식으로 실제 dict 리터럴 전체를 그대로 옮겨 적는다(스펙 섹션
    참조가 필요하면 그 문장과 별도로, 예: "SoT: §10.2" 각주 형태로 표 밖에 둔다).

## 확인했으나 재지적하지 않은 것 (실측상 이미 해소됨)

- `execution-response.dto.ts`(`ExecutionDto`/`NodeExecutionSummaryDto` JSDoc), `executions.service.spec.ts`
  describe 소제목, `executions.service.ts` 의 `ResponseExecution` JSDoc 주제문 — 모두 현재형
  주제문 + 과거 서술은 blockquote caveat 패턴으로 정확히 반영돼 있다(라운드 1~3 해소 확인).
- `CHANGELOG.md:105-107` — 이 PR diff 범위 밖이던 기존 `#1180` `Unreleased` 블록과의
  자기모순도 후방 참조 caveat 로 해소돼 있다(`15_32_34` WARNING 1 해소 확인).
- 유저 가이드 MDX 4파일(ko/en × run-results/running-a-workflow) + i18n dict(`editor.ts`,
  대부분의 `history.ts` 키) — 신규 UX 를 정확히 반영하고 ko/en parity 확보.
- `codebase/backend/src/shared/utils/sanitize-error-message.ts` 의 프런트 미러 위치 주석 —
  `dynamic-form-ui.tsx` → `lib/utils/masked-markers.ts` 로 정확히 갱신됨.
- `spec/5-system/6-websocket-protocol.md`·`12-webhook.md`·`spec/4-nodes/1-logic/12-background.md`
  — "레벨이 가른다" 축 폐기, ingestion 층 이중 방어 서술이 현재형으로 정확히 갱신됨.

## 요약

이번 라운드에서 새로 짚은 문제는 전부 **가장 마지막 커밋**(`38b4669bd`, 라운드4 W1 처분)이
`rerun-modal.tsx` 에 세 번째 차단 조건(coerce 실패)을 추가하면서 그 파일 자신의 JSDoc은
정확히 갱신했지만, 같은 판정 로직을 요약 미러하던 `CHANGELOG.md`·plan 체크리스트·spec §R17
비교표 세 곳은 손대지 않아 "두 조건의 합"이라는 이제는 부정확한 서술이 SoT급 문서 세 곳에
그대로 남았다는 점이다. 이 PR 스스로가 plan 에 "같은 패턴이 3번 재발했다"고 기록한 바로 그
결함 클래스(주제문/핵심 서술은 안 고치고 캐비엇만 덧붙이거나 아예 손대지 않음)의 4번째
사례다. 부수적으로 같은 커밋에서 새 헬퍼(`isStructuredField`)가 기존 큰 JSDoc 블록과 그
설명 대상 상수(`blockedByMaskedInput`) 사이에 끼어들어 문서-선언 대응이 시각적으로 어긋났고,
i18n 카탈로그 신규 행 하나가 이 표의 리터럴-그대로 기재 관례를 깼다. 세 건 모두 기능·테스트
자체에는 영향이 없는 순수 문서 결함이고, 이 PR 이 이미 4라운드에 걸쳐 반복 정착시킨 "주제문을
현재형으로, 과거 서술은 caveat 로" 패턴을 그대로 적용하면 되는 낮은 비용의 수정이다.

## 위험도

LOW
