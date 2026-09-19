# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-assistant-i18n-table-sync.md`

## 실측 방법
번들에 포함되지 않은 다음 파일을 절대경로로 직접 Read/grep 했다: 대상 spec
(`spec/3-workflow-editor/4-ai-assistant.md` §13 표 727~798행, §3.2 표 531~570행, §6
596~605행, Rationale 1330~1363행), 실제 사전(`dict/{ko,en}/assistant.ts` 전문), 보간기
(`lib/i18n/core.ts` `INTERPOLATION_RE`/`interpolate()`), 렌더 컴포넌트
(`assistant-message.tsx` `autoResume` 블록), 규약(`spec/conventions/i18n-userguide.md`
Principle 3-C·6, `_glossary.md` §2·§5), 그리고 비대상 근거
(`workflows.service.ts`·`save-canvas.dto.ts`·`version-history-panel.tsx` 등의
`changeSummary` grep). 이 검토는 spec/** 전역이 아니라 이 draft 가 건드리는
`spec/3-workflow-editor/4-ai-assistant.md` 한 파일 및 그 파일이 인용하는 convention
문서에 스코프를 좁혀 정밀 대조했다(다른 112개 생략 파일은 이 draft 의 변경 대상과
겹치는 엔티티·API·요구사항 ID가 없어 판정에 직접 관련되지 않는다 — grep 결과 §13 키·
"엣지"·"워크플로"[우 없이] 문자열이 4-ai-assistant.md 밖에서 재사용되지 않음을 확인).

## 판정 요약 (프롬프트가 요구한 4개 항목)

1. **13행의 "현재"/"바꿀 값" 문면 일치** — 13행 전부 한 글자 단위로 확인. spec 의
   "현재" 값은 실제 spec 727~773행 문면과 정확히 일치하고, "바꿀 값"은
   `dict/ko/assistant.ts`·`dict/en/assistant.ts` 의 실제 값과 정확히 일치한다
   (773행 `executionNotInScope` 의 "워크플로"→"워크플로우"까지 포함). 불일치 없음.
2. **13행 외 잔여 불일치 없음** — §13 표 41행 전체를 `assistant.ts` 45개 키와
   대조했다. 45(dict) − 4(표에 없음: `continueAfterBudget`·
   `continueAfterBudgetButton`·`exampleArrange`·`autoResumedHintShort`) = 41(표
   행수) 로 정합하고, 13행을 제외한 28행은 이미 사전과 문자 단위로 동일하다(예:
   744 `planApproveConfirm` 은 "…해 주세요." 톤이 사전과 이미 같아 이번 수정
   대상이 아님 — 표 항목 누락이 아니라 값이 이미 일치하는 정상 케이스). 남는
   불일치 없음.
3. **B(신규 행)·C(divider 두 문장) 가 실제 동작과 일치** — `assistant-message.tsx`
   145~153행: `message.autoResume.max !== undefined` 이면 `autoResumedHint`
   (attempt/max), 아니면 `autoResumedHintShort`(attempt만) 를 쓰고, 회전 아이콘
   (`RotateCw`, `aria-hidden`)은 문구와 별개 엘리먼트로 렌더된다. draft 의 B·C 문안은
   이 코드와 정확히 부합한다. `INTERPOLATION_RE = /\{\{\s*(\w+)\s*\}\}/g` 도 확인
   — 단일 중괄호는 보간되지 않는다는 draft 의 근거가 맞다. `Principle 3-C`
   (i18n-userguide.md 124행)가 "`core.ts` 의 `interpolate()` + `{{name}}` 이중
   중괄호 컨벤션을 재사용" 이라고 명시하므로, 이중 중괄호 근거 인용도 정확하다
   (Principle 3-C 표제는 backend 동적 메시지용이지만 본문이 기존 dict 이중 중괄호
   컨벤션을 그대로 인용하는 조항이라 draft 의 원용이 타당하다).
4. **비대상 처분 타당성** — §13 표 밖 사전 키 셋(`continueAfterBudget` 등)과
   `0-canvas.md` §8.1 은 grep 으로 실측 확인했다(아래 WARNING 참고, 이 항목 자체는
   타당하나 **같은 논리를 이 draft 파일 안에서 놓친 자리**가 있다).

## 발견사항

- **[WARNING] 이 draft 가 고치는 §3.2 divider 서술과 같은 파일의 §5.3/§6 서술이 정정 후 서로 어긋난다**
  - target 위치: 계획 항목 C (§3.2 154행, Rationale 1346행 정정)
  - 충돌 대상: 같은 파일 `spec/3-workflow-editor/4-ai-assistant.md` §5.3 536행(`auto_resume`
    이벤트 표), §5.3.2 570행, §6 605행 — 이 draft 의 diff 범위 밖
  - 상세: draft 는 "🔄 는 문자열이 아니다"·"attempt/max 유무로 두 문구
    (`autoResumedHint`/`autoResumedHintShort`)가 갈린다" 는 사실을 §3.2 표
    154행과 Rationale 1346행 **두 곳**에서 정정한다(근거: "한 사실을 세 곳이
    적고 있어 한 곳만 고치면 문서 안에서 모순이 생긴다"). 그런데 같은 사실을
    말하는 자리가 실제로는 최소 두 곳 더 있다.
    - 570행(§5.3.2): "메시지 목록 rehydrate 시에도 `autoResumed=true` row 앞에
      **동일 divider** 가 자동으로 렌더된다" — draft 적용 후 §3.2 는 "실시간
      경로(`attempt/max`)"와 "재수화 경로(`autoResumedHintShort`, 순번만)"가
      **다른 문구**라고 명시하게 되므로, 570행의 "동일 divider" 는 정정된 §3.2
      와 정면으로 모순되는 문장으로 남는다.
    - 536행(§5.3 `auto_resume` 이벤트 표): "새 버블 앞에는 `autoResumedHint`
      divider 를 렌더" — 이 행은 SSE 실시간 이벤트만 다루므로(`auto_resume` 은
      항상 `max` 를 포함, 566~568행) 문면 자체는 여전히 참이지만,
      `autoResumedHintShort` 존재를 모르는 채로 남아 §3.2 와 서술 완성도가
      어긋난다.
    - 605행(§6): "프론트는 rehydrate 시 `autoResumed=true` row 앞에 §3.2 의
      divider 를 렌더" — "§3.2 의 divider" 로 뭉뚱그려 어느 변형인지 특정하지
      않아, 정정된 §3.2 를 읽지 않으면 재수화 시에도 `autoResumedHint`(진행도
      포함)가 쓰인다고 오독할 여지가 남는다.
  - 제안: 이번 턴에 함께 정정하거나(같은 클래스의 사실이므로 draft 자신의
    "표 전체를 훑는다" 원칙을 §13 표 밖으로도 한 번 더 적용), 정정하지 않는다면
    "비대상" 절에 570행의 "동일 divider" 모순을 명시적으로 등재해 다음 라운드가
    재검출하지 않도록 트래킹.

- **[INFO] 773행 근거 인용이 §2 이지만 실제 금지어 표는 §5**
  - target 위치: draft 표 A, 773행 근거 칸 "글로서리 §2 «Workflow → 워크플로우»"
  - 충돌 대상: `codebase/frontend/src/content/docs/_glossary.md` §5 "금지어·지양어"
    표(66~67행)는 "작업 흐름"→"워크플로우" 만 명시하고, "워크플로"(우 탈락형)를
    금지어로 직접 나열하지 않는다. §2 표(15행)는 "Workflow → 워크플로우, "작업
    흐름" 금지" 로만 되어 있어 draft 의 인용 자체는 §2 존재와 부합하지만, 결론
    ("워크플로"도 고쳐야 함)의 직접 근거는 §2/§5 어느 쪽에도 문자 그대로 있지
    않고 "사전이 이미 워크플로우로 통일했다"는 정황 근거(방법론 문단)로
    보강되는 구조다.
  - 상세: 결론 자체(사전 쪽으로 맞춘다)는 타당하고 사전 실측과도 일치하지만,
    "글로서리 §2" 한 줄 인용만으로는 "워크플로"가 금지어라는 결론이 안 나온다.
  - 제안: 근거 칸에 "사전이 이미 워크플로우로 통일 (원칙 문단 참고)" 를 §2 인용에
    덧붙이면 다음 검토자가 §5 표에서 "워크플로"를 찾다가 헛수고하지 않는다.

## 요약

이 draft 는 §13 표 13행의 "현재"/"바꿀 값"을 spec·사전 실물과 한 글자 단위로 대조했고
전부 일치했다. 표 41행 전수 비교로 13행 외 잔여 불일치가 없다는 주장도 45개 사전
키 − 4개(비대상 3 + 신규 추가 1) = 41 산술로 재확인됐다. B(신규 행)·C(divider 문구
정정)는 `assistant-message.tsx`·`core.ts` 의 실제 코드와 정확히 부합하고, 인용한
convention 조항(Principle 3-C 의 이중 중괄호 재사용 규정, Principle 6/글로서리 §2 금지어)도
실재한다. 다만 draft 가 스스로 세운 "같은 사실이 여러 곳에 적혀 있으면 전부 고쳐야
모순이 안 생긴다"는 원칙을 §3.2/Rationale 두 곳에는 적용했지만, 같은 파일의 §5.3.2
570행("동일 divider")·§6 605행에는 적용하지 못해 — 이 draft가 착지하면 그 570행이
정정된 §3.2 와 직접 모순되는 새 결함이 생긴다. 기능·API·데이터모델·요구사항ID·RBAC
차원에서 다른 spec 영역과의 충돌은 발견되지 않았다.

## 위험도
LOW
