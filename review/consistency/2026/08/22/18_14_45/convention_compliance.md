# 정식 규약 준수 검토 — egress 마스킹 좌표계 spec draft

대상: `plan/in-progress/spec-draft-egress-masking-convention.md` (검토 모드: `--spec`)

## 발견사항

- **[WARNING]** 인입 포인터 체크리스트가 Rationale 이 스스로 명시한 3개 표면 중 하나(WS)를 누락
  - target 위치: `## 작업` 섹션 3번째 항목 — `"인입 포인터 — EIA §R17 · node-output.md 의 egress 마스킹 콜아웃에서 본 문서 참조"`
  - 위반 규약: 문서 구조 규약 — cross-reference 완결성 (CLAUDE.md 의 "결정의 배경·근거" SoT 원칙, `execution-context.md` ↔ `node-cancellation.md` 상호 참조 선례와 동형)
  - 상세: target 의 `## Rationale`(기각한 대안 "EIA §R17 을 확장해 거기에 적는다")은 신설 문서가 덮는
    표면을 **EIA·WS(`6-websocket-protocol.md`)·node-output 세 곳**이라고 스스로 명시한다
    (`"WS(6-websocket-protocol.md)와 노드 출력(node-output.md)까지 걸치는 좌표계를 거기 넣으면..."`).
    좌표계 표의 행 4(`MAX_SANITIZE_DEPTH`, 소비처 `sanitizePayloadForWs` — WS emit)도 WS 표면
    전용 불변식이다. 그런데 `## 작업` 의 인입 포인터 항목은 EIA·node-output 두 곳만 열거하고
    WS 표면(`spec/5-system/6-websocket-protocol.md §4.1`)을 빠뜨렸다. 실측 결과 `6-websocket-protocol.md
    §4.1` 은 이미 "값-패턴 마스킹" 콜아웃을 상세히 갖고 있고 근거로 `EIA §R17` 만 가리키는데,
    신설 문서가 정확히 이 절이 다루는 깊이 상한(`MAX_SANITIZE_DEPTH`, `>` 비교)의 SoT 가 되므로
    이 절에도 참조가 없으면, 이 PR 시리즈가 방금 제거한 "같은 사실을 여러 파일이 따로 적는" 패턴이
    문서 레이어에서 그대로 재발한다(코드 주석 2곳이 방어 문장을 반복했다는 target 자신의 진단과
    동일 구조).
  - 제안: `## 작업` 의 인입 포인터 항목에 `spec/5-system/6-websocket-protocol.md §4.1` (값-패턴
    마스킹 콜아웃)을 세 번째 진입점으로 추가한다.

- **[WARNING]** 정본 트래커가 명시한 `code:` frontmatter 등재 지시가 작업/검증 기준에 구체화되지 않음
  - target 위치: `## 작업` 4번째 항목, `## 검증 기준` 2번째 항목
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2`(frontmatter 스키마) · §3(`status` 라이프사이클별
    `code:` 검증 의무) · §4(`spec-code-paths.test.ts`)
  - 상세: 정본 트래커(`plan/in-progress/spec-sync-external-interaction-api-gaps.md:849-850`)는
    *"신설 시 `spec-impl-evidence` 패턴대로 frontmatter `code:` 에 네 파일 등재"* 라고 구체적으로
    지시했다. target 은 이 트래커 항목을 직접 인용해 처분하는 문서인데도, `## 검증 기준` 은
    `"code: frontmatter 의 파일이 전부 실재하고 spec-code-paths.test.ts 를 통과한다"` 는 일반
    서술만 두고 (a) `id`/`status` 값이 무엇이 될지, (b) `code:` 에 등재할 파일 목록(트래커가 지목한
    "네 파일" — target 본문상 `@workflow/masked-markers/src/index.ts` · `sanitize-error-message.ts` ·
    `websocket.service.ts` · `interaction.service.ts` 로 추정되나 target 이 직접 확정하지 않음)을
    명시하지 않는다. `spec-code-paths.test.ts` 는 `status ∈ {partial, implemented}` 일 때 `code:`
    글로브가 **≥1 파일 매치**를 강제하므로, 이 좌표계 문서처럼 "소유하는 파일이 없다"는 성격의
    문서일수록 `status`/`code:` 선택을 구현 단계로 미루면 가드 실패로 재작업할 위험이 커진다.
  - 제안: `## 작업` 또는 `## 검증 기준` 에 `id: egress-masking`, `status: implemented`(이미 코드에
    존재하는 불변식을 문서화하는 것이므로), `code:` 에 트래커가 지목한 네 파일(또는 이보다 정확한
    최신 목록)을 명시한다.

- **[INFO]** 작업 체크리스트의 "문서 가드" 항목이 `spec-frontmatter.test.ts` 를 명시하지 않음
  - target 위치: `## 작업` 5번째 항목 — `"문서 가드(spec-links · spec-code-paths · plan-frontmatter) 통과"`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §4` (frontmatter-evidence 가드 4건 표)
  - 상세: `spec/conventions/**.md` 는 §1 inclusive list 대상이라 `spec-frontmatter.test.ts`(§1 대상
    spec 에 frontmatter 존재 + `id`/`status` 유효 필드 검사)도 강제 대상이다. `spec-code-paths.test.ts`
    는 `code:` 글로브 매치만 보고 `id`/`status` 자체의 존재·유효성은 별도 가드다. 나열이 완전하지
    않아도 실행 시 자동으로 걸리지만(빌드 가드는 파일 대상 스캔이라 체크리스트 누락과 무관하게
    작동), 체크리스트를 정본 근거로 참조하는 문서라면 완전성이 낫다.
  - 제안: 사소하므로 원하면 `spec-frontmatter` 를 목록에 추가. 강제성 낮음(빌드 가드 자체는 이미
    전수 스캔이라 실질적 위험은 없음).

## 요약

target 문서는 정식 규약 준수 관점에서 전반적으로 견고하다 — 파일명(`egress-masking.md`)은 형제
conventions 파일들(`error-codes.md`·`node-output.md`·`node-cancellation.md`·`execution-context.md`)과
동일한 kebab-case 패턴을 따르고, `§Overview/본문/§Rationale` 3섹션 구성을 명시적으로 커밋했으며,
"마커 리터럴을 적지 않고 이름으로만 부른다"는 자체 규율은 코드베이스의 "리터럴을 박지 말고 상수를
import" 관행을 문서 레이어에 정확히 이식한 것이다. `EIA §R17`·`error-codes.md §4.2`·`node-output.md`
교차 참조는 전부 실측으로 검증됐고(대상 절·표 항목이 실제로 존재하고 내용이 일치), plan frontmatter
(`worktree`/`started`/`owner`/`spec_impact` 리스트 형식)도 `plan-lifecycle.md` §4·Gate C 스키마를
정확히 따른다. `node-cancellation.md`↔`execution-context.md` SoT 분리 선례를 든 것도 근거가 실재한다.
다만 두 가지 WARNING — (1) Rationale 이 스스로 인정한 3개 표면(EIA/WS/node-output) 중 WS 인입
포인터 누락, (2) 정본 트래커가 명시적으로 지시한 `code:` frontmatter 등재 세부사항 미확정 — 은
신설 시점에 반영하지 않으면 이 시리즈가 막 제거한 "같은 사실이 여러 곳에 흩어지는" 패턴이나
`spec-code-paths.test.ts` 재작업을 유발할 수 있어 실행 단계 전에 보완할 가치가 있다.

## 위험도

LOW
