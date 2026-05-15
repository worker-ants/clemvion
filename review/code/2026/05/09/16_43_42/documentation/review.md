### 발견사항

- **[WARNING]** `truncateArrayForOutput` JSDoc의 계획 문서 경로 참조가 곧 구식이 됨
  - 위치: `truncate-body.util.ts` — `truncateArrayForOutput` 함수 JSDoc
  - 상세: JSDoc 주석에 `plan/in-progress/engine-raw-config-followups.md` 경로를 하드코딩. `engine-raw-config-followups.md` 문서 하단의 "후속 작업"에 "ai-review 결과 처리 후 본 문서를 `plan/complete/`로 `git mv`"가 명시되어 있으므로, 이번 리뷰 처리 후 경로 이동 시 JSDoc 참조가 즉시 구식이 됨.
  - 제안: `plan/` 경로 대신 아이디어만 남기거나, 경로가 바뀌어도 의미가 유지되는 표현으로 교체. 예: `(결정 근거: engine-raw-config-followups.md Follow-up 2 참조)` 또는 경로 제거 후 날짜·의사결정 근거만 인라인 서술.

---

- **[WARNING]** `truncateBodyForOutput` JSDoc의 계획 문서 경로가 이미 구식
  - 위치: `truncate-body.util.ts` (기존 함수) — `truncateBodyForOutput` 함수 JSDoc
  - 상세: 본 diff에서 수정된 파일이지만, 기존 JSDoc에 `plan/in-progress/engine-raw-config-exposure.md`가 참조되어 있음. 해당 문서는 이미 `plan/complete/engine-raw-config-exposure.md`로 이동 완료된 상태임 (커밋 히스토리 및 followups 문서 배경 섹션에서 확인).
  - 제안: `plan/complete/engine-raw-config-exposure.md` 로 경로 수정, 또는 경로를 제거하고 결정 요지만 문장으로 남김.

---

- **[INFO]** AI Agent spec 문서의 echo 필드 목록에 `mode` 누락
  - 위치: `spec/4-nodes/3-ai/1-ai-agent.md` — 새로 추가된 blockquote
  - 상세: `$node["X"].config.{model, systemPrompt, userPrompt, maxTurns, maxToolCalls, knowledgeBases, conditions, responseFormat}` 열거에 `mode`가 빠져 있음. 구현체 `buildMultiTurnConfigEcho`는 `mode`를 항상 `echo.mode`에 포함하므로 (`(raw.mode as string | undefined) ?? 'multi_turn'`), 스펙과 구현이 불일치.
  - 제안: 필드 목록에 `mode`를 선두에 추가. `$node["X"].config.{mode, model, systemPrompt, ...}`.

---

- **[INFO]** `0-common.md`의 Output size cap 설명이 단일 장문 문장으로 가독성 낮음
  - 위치: `spec/4-nodes/6-presentation/0-common.md` §4 — 새 bullet point
  - 상세: cap 값, 초과 시 동작, array 형태 유지 이유, `rendered` 제외 이유, integration cap과의 비교까지 모두 한 문장에 담겨 있어 파싱이 어려움. 스펙 문서는 다른 노드 문서에서 참조하는 SSOT이므로 가독성이 중요함.
  - 제안: 핵심 규칙 1행 + 하위 bullet 3~4개로 분리. 예:
    ```
    - **Output size cap (1MB)**: Carousel `output.items` / Table `output.rows` 는 직렬화 후 1MB 초과 시 tail-drop 처리됨.
      - 초과 시 `{itemsTruncated|rowsTruncated}: true` + `{itemsTotalCount|rowsTotalCount}` (잘리기 전 수) 포함.
      - 잘린 결과도 **array 형태 유지** — 다운스트림 ForEach / Map / `[i]` 접근 정상 동작.
      - `rendered` HTML 은 cap 대상 외 (자르면 UX 파괴, items 가 줄면 자동으로 함께 작아짐).
      - integration 노드 256KB cap 대비 4× — Presentation 은 사용자 가시 surface.
    ```

---

- **[INFO]** `carousel.md`·`table.md`의 1MB cap 참조 앵커가 동일 섹션을 두 번 가리킴
  - 위치: `spec/4-nodes/6-presentation/1-carousel.md` §4, `2-table.md` §4
  - 상세: 추가된 문장에서 "공통 §4 출력 포맷"과 "공통 §4 의 1MB cap" 두 링크가 모두 `#4-출력-포맷-principle-11--43--45`로 동일 앵커를 가리킴. 1MB cap 설명이 추가된 위치가 그 섹션이라 기술적으로 맞지만, 독자가 "cap을 더 자세히 보려면 여기"가 첫 번째 링크와 다른 곳을 가리킨다고 기대할 수 있음.
  - 제안: 두 번째 링크 텍스트를 "공통 §4 Output size cap" 등으로 바꾸거나, `0-common.md`에 `#### output-size-cap` 등 별도 앵커를 추가해 직접 링크.

---

- **[INFO]** 테스트 파일 내 CONVENTIONS 원칙 참조 주석이 명세 문서보다 더 상세함
  - 위치: `ai-agent.handler.spec.ts` — 세 번째 추가 테스트 내 주석 블록
  - 상세: 테스트 코드 내 주석이 "CONVENTIONS Principle 7 — when context.rawConfig carries the raw user-authored values..."로 동작 이유를 서술하는데, 이는 스펙 문서의 blockquote와 내용이 일부 중복되면서 동기화 대상이 2곳으로 늘어남. 테스트 주석이 스펙과 어긋나면 오독 가능성 있음.
  - 제안: 테스트 주석을 "CONVENTIONS Principle 7 — spec/4-nodes/3-ai/1-ai-agent.md §7 참조"처럼 스펙 문서를 가리키는 포인터로 단순화해 중복 서술을 줄임. (현재 내용 자체는 정확하므로 필수 변경은 아님)

---

### 요약

전반적으로 문서화 수준이 높다. 공개 함수에는 JSDoc이 작성되었고, 주석은 "왜"를 설명하며, 스펙 문서와 구현이 일치한다. 주요 위험은 두 곳의 **plan 문서 경로 하드코딩**으로, `truncateArrayForOutput` JSDoc은 이번 리뷰 완료 후 파일 이동 시, `truncateBodyForOutput` JSDoc은 이미 경로가 구식이다. AI Agent spec의 `mode` 필드 누락과 `0-common.md`의 장문 bullet은 스펙 가독성·정확성 측면의 경미한 결함이다. 라이프사이클 비교·결정 이유·레거시 폴백 패턴 등 미래 독자에게 필요한 맥락이 적절히 기록되어 있다.

### 위험도

LOW