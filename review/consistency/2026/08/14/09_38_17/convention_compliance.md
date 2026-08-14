# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-eia-62-waiting-payload.md`

## 검토 방법
prompt_file 에는 `spec/conventions/**` 본문이 예산 초과로 대부분 생략되어 있었다. 판정에 필요한
정식 규약 파일을 직접 `Read` 했다: `spec/conventions/error-codes.md`, `spec/conventions/node-output.md`,
`spec/conventions/interaction-type-registry.md`, `spec/conventions/execution-context.md`,
`spec/conventions/conversation-thread.md`, `spec/5-system/2-api-convention.md`,
`spec/5-system/3-error-handling.md`, `spec/5-system/6-websocket-protocol.md`,
`spec/5-system/14-external-interaction-api.md`(target 이 인용하는 실제 절 전문), `spec/1-data-model.md`,
`spec/0-overview.md`, `.claude/docs/plan-lifecycle.md`, 그리고 build guard
`codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` 의 `hasValidSpecImpact`/`makeSpecExists` 구현.

## 발견사항

- **[CRITICAL] frontmatter `spec_impact` 경로가 실존하지 않는 파일을 가리킨다**
  - target 위치: frontmatter L8-10 (`spec_impact:` 리스트의 두 번째 항목 `spec/5-system/1-data-model.md`)
  - 위반 규약: `.claude/docs/plan-lifecycle.md §4 Gate C`("리스트 항목은 실존 spec 파일이어야 한다 — dangling 금지",
    build guard `spec-plan-completion.test.ts`) + `spec/0-overview.md` L145 의 명명 규약("`spec/0-overview.md` /
    `spec/1-data-model.md` / `spec/6-brand.md` (루트 레벨) — `spec/` 루트에 위치하는 cross-cutting 진입 문서.
    `0-`/`1-`/`6-` 등 정수 prefix 로 정렬하며 영역 폴더 위에서 직접 참조한다")
  - 상세: 실제 파일은 `spec/1-data-model.md` (저장소 루트, `5-system/` 하위 아님) 다.
    `spec/5-system/1-data-model.md` 는 존재하지 않는다(`find spec -iname '1-data-model.md'` → `spec/1-data-model.md` 1건뿐).
    `1-data-model.md` 는 `0-overview.md`·`6-brand.md` 와 함께 spec 루트 레벨 cross-cutting 문서로 명시적으로
    분류된 정식 명명 패턴이며, `5-system/` 등 영역 폴더 하위로 옮기는 것 자체가 이 문서의 명명 규약 위반이다.
    build guard(`plan-scan.ts` `makeSpecExists`)는 `path.resolve` 후 `spec/` 하위 실존 파일인지 확인하므로,
    이 항목은 `plan/complete/` 이동 시점(Gate C, `spec-plan-completion.test.ts`)에 **dangling 판정으로 fail** 한다.
    흥미롭게도 target 문서 **본문**은 이미 올바른 형태를 쓴다 — 변경 제안 (5)의 제목(L83)과 Overview 서술(L107)
    은 모두 `1-data-model.md`(bare, `5-system/` 접두 없음)로 정확히 인용한다. 즉 frontmatter 만 본문과
    모순되는 경로를 담고 있다. 같은 EIA 트랙의 자매 plan (`eia-terminal-payload.md`,
    `spec-update-node-cancellation-shutdown-classification.md`)도 모두 `spec/1-data-model.md`(prefix 없이)로
    정확히 인용해, 이 오류가 저장소 전반의 관행이 아니라 이 문서 고유의 오타임을 뒷받침한다.
  - 제안: frontmatter L10 을 `spec/5-system/1-data-model.md` → `spec/1-data-model.md` 로 정정. in-progress
    단계라 지금 당장 게이트가 발화하지는 않지만(§4: "in-progress 단계에선 의무 아님"), 고치지 않은 채
    `complete/` 로 이동하면 build fail 이 확정적이고, 지금 정정하지 않으면 "spec 반영 (6항목)" 체크리스트
    수행자가 잘못된 경로에 새 파일을 만들 위험도 있다.

- **[WARNING] `error.code` "옵셔널화" 제안이 §5.4 `null` vs 키 생략 규약의 선택 기준을 명시하지 않는다**
  - target 위치: `## 변경 제안 (4) error.code 를 옵셔널로 (§6.4 + 필드 집합 표)` (L75-81)
  - 위반 규약: `spec/5-system/2-api-convention.md §5.4 "부재 표현 — null vs 키 생략"`
  - 상세: §5.4 는 "값이 없음"을 표현하는 두 방식(①`null`-키 present, ②키 생략)을 정의하고 **기본은 `null`**
    이며, 키 생략은 (a) 다른 표면(SSE/WS wire)과 형식을 일치시켜야 할 때 또는 (b) 선택적 부가 컨텍스트라
    소비자가 부재를 정상 경로로 다룰 때만 쓰되 **"그 필드를 문서화하는 절에 사유를 명시"**하도록 강제한다.
    target 의 (4)는 "코드 없음은 부재로 전달하는 편이 정직하다"고만 적어, `null`(키 유지) 인지 **키 생략**
    인지를 정하지 않았고 (a)/(b) 중 어느 기준에 해당하는지도 적지 않았다. 같은 `error` 객체의 형제 필드
    `nodeId` 는 이미 `"uuid" | null` 로 §5.4 의 `null` 표현을 쓰고 있어(§6.4 현재 예시, L736), `code` 를
    `null` 대신 키 생략으로 바꾸면 **같은 객체 안에서 두 표현이 섞이고**, §5.4 는 이를 허용하되
    "필드별로 근거가 있어야 한다"고 명시한다. 이 근거 문구가 실제 spec 반영 시 누락되면 §5.4 위반이다.
  - 제안: 실제 spec 반영(체크리스트 "spec 반영 (6항목)") 시 §6.4 예시·필드 집합 표에 `code` 표현 방식을
    `null`(키 유지, §5.4 default) 또는 **키 생략**(§5.4 근거 (a)/(b) 중 어느 것인지 명시) 중 하나로 확정하고
    그 사유 문장을 §6.4 절에 남길 것. `interact` 계열 API 는 아니지만 outbound notification 도 같은 문서의
    §5 대상 규약 적용 대상이라는 점을 §6 서두에 이미 준용하고 있으므로 예외로 보기 어렵다.

- **[INFO] (5)의 `1-data-model.md` §2.14 갱신 범위가 (4)의 `code` 변경과 동기화되지 않을 위험**
  - target 위치: `## 변경 제안 (5)` (L83-85) vs `(4)` (L75-81)
  - 위반 규약: 직접 규약 위반은 아니나, EIA §6 서두가 이미 명시한 SoT 분산 방지 원칙("같은 필드를 여러
    문서에 나열하면 그 각각이 두 번째 SoT 가 되고, 실제로 그렇게 됐다" — `14-external-interaction-api.md`
    L559-560)과 같은 계열의 리스크.
  - 상세: `spec/1-data-model.md` §2.14 는 `Execution.error` 구조를 `{ nodeId: "uuid", code: "ERROR_CODE",
    message: "에러 설명" }` 로 적어 EIA §6.4 와 사실상 같은 구조체를 이중 서술한다. (5)는 `nodeId` nullable
    화만 언급하고 (4)의 `code` optional 화를 이 표에도 반영할지 언급하지 않는다 — 반영하지 않으면
    data-model.md 와 EIA §6.4 가 다시 어긋나며, 이는 이 plan 이 애초에 고치려는 "여러 SoT" 문제의 축소
    재발이다.
  - 제안: spec 반영 시 (5)의 §2.14 갱신에 `code` 표현 방식(위 WARNING 항목의 결정)도 동반 반영.

## 요약
target plan 문서 자체는 실측 기반 근거가 충실하고(4개 emit 지점·fanout 변환·참조 구현 소비 키 직접 확인),
L472/L673 의 `Conversation Thread §4.4.6` 오귀속 지적은 `conversation-thread.md` 자신이 같은 앵커를
`6-websocket-protocol.md` 소속으로 인용하는 것과 대조해 정확함을 확인했다. `interaction` 블록을 삭제 대신
Planned 로 남기는 방식도 문서가 이미 쓰고 있는 `durationMs`/`result.outputs` Planned 표기 선례를 그대로
따른 것으로 규약상 문제가 없다. 다만 frontmatter `spec_impact` 의 `spec/5-system/1-data-model.md` 는
`spec/0-overview.md` 가 명시한 루트 cross-cutting 문서 명명 규약 및 Gate C 실존-파일 요구를 직접 위반하는
dangling 경로이고(본문은 올바른 경로를 쓰고 있어 frontmatter 만의 self-contradiction), `error.code`
옵셔널화 제안은 `2-api-convention.md §5.4` 의 `null` vs 키 생략 선택·근거 명시 요구를 아직 충족하지 못한다.
두 항목 모두 지금 시점에 빌드를 막지는 않지만 spec 반영·plan 완료 단계에서 각각 build fail 과 규약 위반
문서로 이어질 수 있어 이번 라운드에서 정정하는 편이 싸다.

## 위험도
MEDIUM
