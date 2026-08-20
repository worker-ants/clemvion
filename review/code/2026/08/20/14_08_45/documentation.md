STATUS=success documentation review complete — 1 CRITICAL, 3 WARNING, 1 INFO
===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 리뷰 — `Execution.inputData` 카브아웃 폐지 + 마커 가드

## 발견사항

- **[CRITICAL]** `ExecutionDto.inputData` JSDoc 이 여전히 "마스킹 안 함"을 단언 — 같은 파일 안에서 자기모순
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:49-62` (특히 52행, 57-58행)
  - 상세: 이번 PR 의 핵심 변경은 `Execution.inputData` 를 마스킹 대상으로 전환하는 것이고, 실제로
    `executions.service.ts` 의 `toExecutionDto`(이 DTO 를 조립하는 함수, 목록 응답 경로)는
    `inputData: redactStoredDataForResponse(execution.inputData)` 로 이미 바뀌었다(파일 6 diff,
    1005-1009행 부근). 그런데 이 DTO 자신의 JSDoc 은 손대지 않은 채 남아 있다:
    - 52행: `**값-패턴 마스킹 대상이 아니다** (형제 outputData/error 와 다르다)` — 지금은 거짓이다.
    - 57-58행: `**이 카브아웃은 Execution 레벨 한정이다** — nodeExecutions[].inputData 는 재제출
      소비처가 없어 마스킹된다(2026-08-17 정정)` — 이 카브아웃 자체가 이번 PR 로 폐지됐으므로
      "Execution 레벨만 예외" 라는 전제가 통째로 사라졌다.
    diff 를 보면 이 블록은 55행(`ExecutionsService` 의 `MASKED_INPUT_DATA_REASON` → `.toResponseExecution`
    인용 교체) 딱 한 줄만 고쳐졌고, 바로 위·아래의 실질적 주장(52행·57-58행)은 그대로 방치됐다.
    더 결정적으로, 바로 아래 `NodeExecutionSummaryDto.inputData` 의 JSDoc(172-184행, 이번 PR 이
    올바르게 갱신함)은 `"상위 ExecutionDto.inputData 와 **같은 정책**이다. 2026-08-20 이전에는
    그쪽만 원문이었다"` 라고 명시한다 — **같은 파일 안에서 두 JSDoc 블록이 정반대로 말하는 상태**다.
    이 파일은 Swagger(`@ApiPropertyOptional`) 로도 노출되는 공개 API DTO 라 개발자·API 소비자
    모두가 이 주석을 신뢰할 표면이다. 이전 라운드 naming_collision checker(review/consistency/2026/08/20/12_08_46/naming_collision.md)
    가 정확히 이 파일(`execution-response.dto.ts:55,179`)을 "6개 참조처 중 하나, 전부 동시 갱신
    필요"로 지목했는데, 55행만 고치고 52·57-58행이 누락된 형태로 그 우려가 실현됐다.
  - 제안: 52행을 "**응답·emit 시 자격증명 값-패턴 마스킹**(DB 는 원문 보존, 2026-08-20 부터)"
    식으로 뒤집고, 57-58행의 "카브아웃은 Execution 레벨 한정" 문단을 삭제하거나 과거형
    ("2026-08-20 이전에는 Execution 레벨만 예외였다")으로 재작성한다. `NodeExecutionSummaryDto.inputData`
    JSDoc 이 이미 올바른 새 서술을 갖고 있으므로 그 문구를 참고해 대칭을 맞출 것.

- **[WARNING]** `executions.service.ts` 692행 인라인 주석 — `{@link}` 만 제거되고 그 문장의 핵심 주장은 그대로 남아 stale + 문장이 깨짐
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:692` (인접 693-694행 포함)
  - 상세: 현재 내용은 `// **노드 레벨 inputData 는 마스킹한다** — 카브아웃은 Execution 레벨
    한정이다` (692행, diff 밖 — 변경되지 않은 컨텍스트 줄) 다음에 `// 여기엔 재제출 소비처가
    없고, 안 걸면 WS emit` (693행, 이번 PR 이 `({@link MASKED_INPUT_DATA_REASON}). ` 부분만
    지우고 남긴 줄)이 붙는다. 두 가지 문제가 있다: (1) "카브아웃은 Execution 레벨 한정이다" 는
    현재형 주장인데 이 카브아웃 자체가 이번 PR 로 폐지됐으므로 지금은 거짓이다 — 같은 파일의
    112행("재제출 카브아웃이 닫히면서 마스킹 대상이 됐다")·1008행("카브아웃 폐지")·1073행("카브아웃이
    닫혔다")은 전부 과거형/폐지형으로 정확히 고쳐졌는데 이 자리만 빠졌다. (2) `{@link ...}` 를
    가리키던 괄호 문장 전체가 통째로 사라지면서 "한정이다" 뒤에 마침표 없이 "여기엔" 으로 바로
    이어지는 비문이 됐다 — 편집이 그 자리의 실질 내용은 남기고 인용 참조만 지웠다는 신호다.
  - 제안: `background-runs.service.ts:304`(이번 PR 이 올바르게 고친 자매 주석 — "2026-08-20 부터
    Execution 레벨도 마스킹한다 — 두 레벨이 같은 규칙이다")과 같은 톤으로 "카브아웃은 Execution
    레벨 한정이었고(2026-08-20 폐지), 이 표면엔 애초에 재제출 소비처가 없다" 식으로 재작성.

- **[WARNING]** `spec/5-system/14-external-interaction-api.md` 의 굵은 소제목이 자신이 서술하는 본문과 모순
  - 위치: `spec/5-system/14-external-interaction-api.md:1631`
  - 상세: `- **"input"/"inputData" 의 마스킹 여부는 "레벨" 이 가른다** (2026-08-17 정정):` 라는
    소제목 자체는 이번 diff 에서 **변경되지 않은 컨텍스트 줄**이다. 그런데 바로 아래 본문은
    이번 PR 로 "**2026-08-20 에 카브아웃이 닫히면서 그 축은 사라졌다**"·"세 줄이 같은 규칙을
    공유한다" 로 다시 쓰였고, 표의 세 행이 전부 `함`(마스킹)으로 통일됐다 — 즉 "레벨이 가른다"
    라는 축이 본문 안에서 명시적으로 폐기 선언됐는데, 그 폐기를 요약하는 소제목만 옛 문구를
    그대로 유지하고 있다. 자매 문서 `spec/5-system/6-websocket-protocol.md`(파일 59 diff)는
    같은 종류의 문장을 정확히 "그 축은 폐기됐다" 로 갱신해 대비된다.
  - 제안: 소제목을 `**"input"/"inputData" 는 두 레벨 모두 마스킹한다** (2026-08-20, "레벨이
    가른다" 축 폐기)` 등으로 갱신해 본문과 맞춘다.

- **[WARNING]** CHANGELOG.md 미갱신 — 동일 보안 마스킹 주제의 직전 5개 커�밋과 관례가 어긋남
  - 위치: `CHANGELOG.md` (루트) — 이번 커밋(`37da9b593`) 변경 파일 목록에 없음
  - 상세: `git log --oneline -5`로 보면 바로 직전 5개 커밋(#1177~#1186, `89c3f3c53`·`c9cc2a923`·
    `89a816ab9` 등)이 전부 정확히 같은 마스킹/카브아웃 주제를 다루며 각각 "## Unreleased — …"
    형식의 CHANGELOG 항목을 남겼다(왜 샜는지·범위·받아들이는 트레이드오프를 서술하는 확립된
    패턴). 이번 커밋은 그 시리즈의 정점(`Execution.inputData` 카브아웃 완전 폐지, 프런트 3개
    소비처에 마커 가드 신설)인데도 CHANGELOG 항목이 없다. 보안에 민감한 동작 변경(이전엔
    마스킹 안 하던 필드가 이제 마스킹되고, Re-run/에디터에 새 차단 UI 가 생김)이라 릴리즈
    노트 관점에서 누락 리스크가 크다.
  - 제안: 직전 5개 항목과 같은 톤으로 "## Unreleased — `Execution.inputData` 카브아웃을 닫았다"
    항목을 추가하고, 왜 지금 닫혔는지(마커 가드 3곳 완성)·잔여(트리거 파라미터 자유 텍스트)를 요약한다.

- **[INFO]** `background-runs.service.spec.ts` 의 인라인 테스트 주석도 같은 종류의 stale 서술을 갖고 있음 (낮은 파급)
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts:265`
  - 상세: `// 노드 레벨은 inputData 도 마스킹 — 카브아웃은 Execution 레벨 한정.` — 이 줄은 이번
    diff 에 포함되지 않은(즉 이번 PR 이 건드리지 않은) 기존 테스트 주석이며, 위 CRITICAL/WARNING
    항목과 동일하게 "카브아웃은 Execution 레벨 한정" 을 현재형으로 서술해 지금은 낡았다. 같은
    파일 221-224행(파일 1 diff)의 자매 JSDoc 주석은 정확히 과거형으로 고쳐졌는데 이 단문
    인라인 주석만 누락됐다. 테스트 내부 주석이라 파급은 작지만 grep 검색 시 오정보를 남긴다.
  - 제안: "노드 레벨은 `inputData` 도 마스킹 — 카브아웃(Execution 레벨 한정)은 2026-08-20 폐지,
    지금은 두 레벨 모두 마스킹." 정도로 짧게 정정.

## 검증한 것 (문제 없음 — 참고)

- `codebase/frontend/src/lib/utils/masked-markers.ts`(신규): `MASKED_MARKERS`·`isMaskedMarker`·
  `hasMaskedMarkerLeaf` 세 export 모두 "왜 필요한가·보장의 경계·왜 옮겼는가"를 갖춘 JSDoc 이 매우
  꼼꼼하다. backend SoT 미러라는 사실, 정확 일치만 잡는 설계 의도, 순환 참조 불필요 근거까지
  기록돼 있어 이 파일 자체는 모범적이다.
- `codebase/frontend/src/components/executions/rerun-modal.tsx`: 신규 `splitMaskedParameters`·
  `blockedByMaskedInput`에 "왜 필요한가"·"토글 ON 이면 막지 않는 이유" 를 설명하는 JSDoc 이
  붙어 있고, 실제 로직과 일치한다.
- `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx`: `jsonError` 안의 신규
  분기(파싱 실패 시 마커 검사 skip, 마커 leaf 시 차단)에 인라인 주석이 정확히 붙어 있다.
- i18n 신규 키(`editor.runWithInputMasked`, `history.rerun.maskedInputBlocked`) en/ko 양쪽 모두
  추가됐고, 실제 사용처(`editor-toolbar.tsx:118`, `rerun-modal.tsx:485`)와 키 이름이 정확히 일치한다.
  두 언어 문구도 의미가 대응된다(직역은 아니지만 "마스킹된 값이 남아 있으니 실제 값으로 바꿔라"
  는 내용이 동일).
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:304`·
  `dto/background-run-response.dto.ts:51`·`background-runs.service.spec.ts:224` 세 곳은 카브아웃
  폐지를 정확히 과거형/폐지형으로 재서술했다(모범 사례 — 위 WARNING/CRITICAL 항목과 대비됨).
- `spec/1-data-model.md`·`spec/4-nodes/1-logic/12-background.md`·`spec/5-system/12-webhook.md`·
  `spec/5-system/13-replay-rerun.md`·`spec/5-system/6-websocket-protocol.md` 5개 spec 문서는
  카브아웃 폐지를 일관되게(과거형 + "2026-08-20" 타임스탬프 + 근거) 반영했다 — 직전 consistency
  라운드(12_08_46 → 12_29_59 → 12_41_29 → 12_58_14)가 지적한 spec_impact 누락(12-webhook.md,
  6-websocket-protocol.md)이 이번 diff 에서 실제로 해소된 것으로 확인된다.
- `codebase/backend/src/modules/executions/executions.service.ts`: `MASKED_INPUT_DATA_REASON`
  상수와 그 JSDoc 앵커 전체가 깨끗이 삭제됐고(`void MASKED_INPUT_DATA_REASON;` 관용구 포함),
  코드베이스 전체(`codebase/`·`spec/`)에 잔존 참조가 0건임을 grep 으로 확인했다 — naming_collision
  checker 가 우려한 "이름 재사용 반전" 경로가 아니라 "폐기" 경로를 택했고 깔끔하게 집행됐다.

## 요약

핵심 로직 변경 파일들(신규 `masked-markers.ts`, `rerun-modal.tsx`, `editor-toolbar.tsx`, 5개
spec 문서)은 "왜 이 결정을 했는가·왜 다른 대안이 아닌가"까지 담는 이 저장소 특유의 상세한
JSDoc/spec 서술 관례를 잘 따르고 있고, `MASKED_INPUT_DATA_REASON` 앵커 폐지도 전 코드베이스에서
깨끗이 정리됐다. 다만 이 PR 이 정확히 "이전엔 마스킹 안 하던 필드를 마스킹하게 바꾼다"는
반전(flip)이라는 성격 때문에, **반전 이전 서술을 지우지 않고 남겨 둔 자리**가 최소 세 곳
발견됐다 — 그중 하나(`ExecutionDto.inputData` JSDoc)는 같은 파일 안 인접 DTO 의 정정된 JSDoc과
정반대로 말하는 자기모순이라 Swagger 로 노출되는 공개 API 문서 표면에서 CRITICAL 로 판단했다.
이전 consistency 라운드(naming_collision checker)가 "6개 참조처 전수 동시 갱신"을 명시적으로
요구했는데, 그중 정확히 이 자리가 부분 적용(참조 인용만 교체, 실질 주장은 방치)으로 남은 형태다.
CHANGELOG 누락은 기능적 결함은 아니지만 직전 5개 커밋이 세운 확립된 관례에서 벗어난다.

## 위험도

MEDIUM — 코드 동작 자체는 올바르게 마스킹하고 있어 보안 결함은 아니다. 그러나 공개 API DTO의
JSDoc 이 실제 동작과 정반대로(같은 파일 안에서 자기모순으로) 서술돼 있어, 이후 개발자가 이
주석을 근거로 "Execution.inputData 는 마스킹되지 않는다"는 잘못된 전제로 재발(regression)을
만들 위험이 실재한다 — 이 저장소가 이미 여러 차례 겪은 "오래된 주석이 동작과 모순" 재발 패턴과
정확히 같은 형태다.
