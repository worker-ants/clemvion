# 문서화(Documentation) 리뷰 — egress-masking-convention

## 검토 범위 메모

이번 변경분은 **애플리케이션 코드를 전혀 건드리지 않는다** — `plan/**` 계획 문서 2건,
`review/consistency/**` 세션 산출물(자동 생성, 18건), `spec/**` 문서 4건(신설 1 + 포인터 추가 3)뿐이다.
따라서 "독스트링/JSDoc"·"주석 정확성(코드-대비)" 항목은 코드 diff가 없어 직접 대상이 없고,
대신 신설 `spec/conventions/egress-masking.md` 가 **불변 코드를 정확히 서술하는지**를 실제 소스와
대조해 검증했다(아래 "실측 검증" 참조). `README`·API 문서·환경변수 문서·CHANGELOG 는 동작 변경이
없으므로 업데이트 대상이 아니다(이 저장소 CHANGELOG.md 관행은 breaking/behavior change 전용이며,
본 PR은 그런 변경이 없다).

## 실측 검증 (신설 문서 vs 실제 소스)

`spec/conventions/egress-masking.md` §1 좌표계 표의 모든 셀을 코드와 직접 대조했다 — 전부 일치함을 확인:
- `MAX_MASK_DEPTH = 10` (`codebase/packages/masked-markers/src/index.ts:81`)
- `MAX_REDACT_DEPTH = MAX_MASK_DEPTH`, `depth >= MAX_REDACT_DEPTH` (`sanitize-error-message.ts:128,270`)
- `MAX_SANITIZE_DEPTH = 10`(독립 선언), `depth > MAX_SANITIZE_DEPTH` (`websocket.service.ts:80,119`)
- `hasMaskedLeaf`: 값 검사 먼저 → `depth >= MAX_REDACT_DEPTH` (`reject-masked-resubmission.ts:132-135`)
- `hasMaskedMarkerLeaf`(`scanForMarker`): 값 검사 먼저 → `depth >= MAX_MASK_DEPTH` (`masked-markers.ts:98-101`)
- `stripExternalOnlyFields`: `depth > maxDepth` (`strip-external-only-fields.ts:106`), 호출부
  `interaction.service.ts:112`(`MAX_REDACT_DEPTH`), `websocket.service.ts:418-426`
  (`toFanoutEnvelope`: `maskWireEnvelope → stripExternalOnlyFields → attachRoutingContext` 순서 확인)
- `code:` frontmatter 6개 파일 전부 실재 확인
- "마커 리터럴 0회(이름으로만 5회 인용)" 자체 검증 claim — grep 결과 `VALUE_MASK_MARKER`×3,
  `DEPTH_MASK_MARKER`×2 = 5회, 리터럴(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`) 0건 — **정확**
- "절대 라인 인용 0건" claim — grep 결과 `:숫자` 패턴 0건 — **정확**
- 신설 문서→`14-external-interaction-api.md §R17`·`6-websocket-protocol.md`·`node-output.md`
  왕복 상대경로 링크(`../conventions/egress-masking.md`, `./egress-masking.md`) 전부 해석 정확

이미 `/consistency-check --spec` 가 2라운드 돌며(`18_14_45` BLOCK:YES → 정정 → `18_27_11` BLOCK:NO)
좌표계 표의 "값=1" 오독 CRITICAL 과 WARNING 3건(WS 인입 포인터 누락·`code:` exhaustive-consumer·
W4 상호참조)을 잡아 전부 반영했음을 확인했고, 위 실측 결과 그 수정이 실제로 반영돼 있다.

## 발견사항

- **[WARNING]** plan 문서 자체의 파일 개수 표기가 실제 나열과 어긋난다 — "4파일" vs 실제 6개
  - 위치: `plan/in-progress/spec-draft-egress-masking-convention.md:148`
  - 상세: `## 작업` 체크리스트 항목이 `` frontmatter: `id: egress-masking` · `status: implemented` · `code:` **4파일** — ``
    라고 적은 뒤, 바로 다음 줄(149~154)에 **6개** 파일(`masked-markers/src/index.ts` ·
    `sanitize-error-message.ts` · `strip-external-only-fields.ts` · `websocket.service.ts` ·
    `reject-masked-resubmission.ts` · `masked-markers.ts`)을 나열한다. 이 항목은
    `18_27_11` 라운드 convention_compliance WARNING #1("`code:` 가 정의처 4곳만 담아 좌표계 표가
    경고하는 두 스캐너 함수의 정의 파일이 증거 목록 밖에 남는다")을 반영해 2개 파일
    (`reject-masked-resubmission.ts`, `masked-markers.ts`)을 **추가한 이력**을 남기는 자리인데,
    개수 라벨("4파일")만 갱신에서 빠졌다. 실제 `spec/conventions/egress-masking.md` frontmatter
    `code:` 는 6개 파일을 모두 담고 있어(실측 확인) 문서 본문(spec)은 정확하지만, **이 결정을
    기록하는 plan 체크리스트 자체가 스스로의 개수를 잘못 세고 있다** — 이 PR 전체의 주제가
    "숫자·좌표계의 정밀성"인 것을 고려하면 아이러니한 잔존 오류다.
  - 제안: `148행의 "**4파일**"을 "**6파일**"로 정정한다(또는 "4곳 정의처 + 2곳 exhaustive-consumer
    추가 = 6파일"처럼 이력을 남기는 표기로 바꾼다).

- **[INFO]** 신설 문서 §1.1 의 "값 검사가 깊이 검사보다 먼저" off-by-one 설명이 좌표계 표 3행
  (`hasMaskedMarkerLeaf`)에만 명시적으로 귀속되고, 같은 이유로 같은 순서를 쓰는 2행의 두 번째
  소비처(`hasMaskedLeaf`)에는 표에서도 §1.1 본문에서도 언급이 없다
  - 위치: `spec/conventions/egress-masking.md:42-62` (§1 좌표계 표 2행 "비교" 열 `` `depth >= N` ``,
    §1.1 "3 이 `>=` 이면서 값 검사를 깊이 검사보다 먼저 하는 것도 이 한 칸 때문이다" 문장)
  - 상세: 실측 결과 backend `hasMaskedLeaf`(`reject-masked-resubmission.ts:132-135`)도 frontend
    `hasMaskedMarkerLeaf`(`masked-markers.ts:98-101`)와 **동일하게** `isMaskedMarker` 값 검사를
    깊이 검사보다 먼저 수행한다(코드 주석도 두 파일이 각각 "값 검사가 먼저 — 상한 지점에 놓인
    치환 마커를 놓치지 않기 위해" 를 거의 동일 문구로 반복). 그러나 표의 2행 "비교" 열은
    `deepRedactSecrets`(writer, 값 검사 없이 depth 만 봄)와 `hasMaskedLeaf`(reader, 값 검사
    선행)를 `` `depth >= N` `` 한 표기로 뭉뚱그리고, §1.1 은 이 순서 규율을 3행에만 명시적으로
    붙인다. 문서 자체가 "이름 한 글자 차이인 두 스캐너(`hasMaskedLeaf`/`hasMaskedMarkerLeaf`)를
    혼동하지 말라"고 별도 콜아웃(54행)까지 두는 만큼, 두 스캐너가 **공유하는 이 순서 규율**도
    비대칭 없이 함께 언급하면 "한쪽만 고치고 양쪽 고쳤다고 적는 사고"(문서가 스스로 경계하는
    실패 모드)를 순서 규율 쪽에서도 예방할 수 있다.
  - 제안: §1.1 문장을 "2 의 `hasMaskedLeaf`, 3 의 `hasMaskedMarkerLeaf` 모두 `>=` 이면서 값 검사가
    깊이 검사보다 먼저" 식으로 두 소비처를 함께 인용하도록 확장(강제 아님, 완전성 개선).

- **[INFO]** 신설 규약 문서에 "새 소비처를 추가할 때 어느 상한을 상속해야 하는가"를 보여주는
  사용 예시가 없다
  - 위치: `spec/conventions/egress-masking.md` 전체(특히 §1 말미, §3 "이 문서는 기계가 지키지
    않는다" 앞)
  - 상세: 이 문서의 §1 은 "표면마다 자매 sanitizer 와 어긋나면 strip 이 닿지 않는 층에 마스킹만
    걸리거나 그 반대가 된다"는 위험을 서술하지만, 실제로 6번째 소비처가 추가될 때 "이 표의 어느
    행을 보고 `maxDepth` 인자를 무엇으로 넘겨야 하는지" 절차적 예시는 없다. 좌표계 표 자체가
    레퍼런스이므로 필수는 아니지만, §3 이 "기계가 지키지 않는다"고 명시적으로 인정한 문서이므로
    사람이 실수하지 않도록 짧은 절차(예: "새 REST 소비처를 추가하면 `MAX_REDACT_DEPTH` 를,
    새 WS emit 경로를 추가하면 `MAX_SANITIZE_DEPTH` 를 넘긴다")를 한두 줄 추가하면 향후 6번째
    소비처 추가 시 좌표계 오귀속 위험을 낮출 수 있다.
  - 제안: 선택 사항. 강제하지 않음.

## 요약

이번 변경은 순수 문서(spec/plan) PR로, 신설 `spec/conventions/egress-masking.md` 는 이미
`/consistency-check --spec` 2라운드(BLOCK:YES→정정→BLOCK:NO)를 거쳤고, 본 리뷰가 좌표계 표의
모든 셀·호출 순서·자체 검증 claim(마커 리터럴 0회·절대 라인 인용 0회)·`code:` frontmatter 6개
파일 실재·상대경로 링크를 실제 소스와 직접 대조한 결과 **전부 정확**함을 확인했다. 유일한 실질
결함은 plan 체크리스트 자체의 파일 개수 라벨("4파일" vs 실제 6개, `spec-draft-...md:148`)이 이력
갱신에서 빠진 잔존 오류이며, spec 본문(신설 문서)에는 영향이 없다. 그 외 INFO 2건은 완전성
개선 제안으로 강제성이 낮다. `review/consistency/**` 18개 세션 산출물은 orchestrator 가 자동
생성한 로그성 파일이라 문서화 관점의 별도 조치가 필요 없다.

## 위험도

LOW
