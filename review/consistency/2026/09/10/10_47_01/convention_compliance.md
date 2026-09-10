# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-integration-dto-pointer.md`

## 검토 범위 및 방법

target 은 `spec/2-navigation/4-integration.md §9.1` (`GET /api/integrations/:id` 행)에 넣을
경계 문장 + `1-data-model.md §2.10` 포인터를 제안하는 planner 턴 spec draft다. 아래를 실측으로
대조했다.

- `spec/2-navigation/4-integration.md` 795행 (대상 테이블 행), 844행 §9.4, frontmatter
- `spec/1-data-model.md §2.10` (285~314행) — 5필드 실존 확인
- `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` 143~167행
- `spec/conventions/swagger.md`, `spec/conventions/spec-impl-evidence.md` 전문

## 발견사항

- **[WARNING] 제안 삽입 텍스트가 markdown 표 셀 안에서 줄바꿈된 채로 그대로 적용될 위험**
  - target 위치: `plan/in-progress/spec-draft-integration-dto-pointer.md` "변경안" 섹션의
    ```markdown ... ``` 코드펜스 (11줄에 걸쳐 word-wrap 됨)
  - 위반 규약: 직접 대응하는 `spec/conventions/*` 항목은 없음 — 이는 GFM 표(table) 구문 자체의
    제약(표 행은 반드시 물리적으로 한 줄)에서 비롯된 실행 리스크다. 굳이 연결짓자면 "출력
    포맷 규약"(점검 관점 2/3)의 취지 — 산출물이 실제 렌더링·가드 파이프라인과 어긋나지 않게
    한다는 정신 — 에 걸린다.
  - 상세: 실측 결과 대상 행(`4-integration.md` 795행)은 물리적으로 **2,052자짜리 단일 라인**이다
    (표 셀은 리터럴 줄바꿈을 가질 수 없다 — GFM 표 규칙). 그런데 draft 의 "변경안" 코드펜스는
    가독성을 위해 11줄로 word-wrap 되어 있고, 이걸 그대로 복붙해 넣으면 표가 깨진다(각 줄이
    `|` 로 시작하지 않아 표 밖 loose 텍스트로 렌더링되거나 표 파싱이 중단됨). 체크리스트
    항목("§9.1 GET /:id 행에 경계+포인터+캐비엇")은 *무엇을* 넣을지는 명시하지만 *한 줄로
    이어붙여야 한다*는 실행 지시가 없다 — 다음 사람(또는 developer 자신)이 코드펜스를 그대로
    옮기면 조용히 문서를 깨뜨릴 수 있다.
  - 제안: 체크리스트에 "삽입 시 word-wrap 을 제거하고 기존 행과 동일한 물리적 한 줄로 이어붙일
    것 — 표 셀은 리터럴 개행을 허용하지 않는다"를 한 줄 추가한다. (또는 실제 적용 커밋에서
    `sed`/스크립트로 이어붙이고 `git diff` 로 대상 행이 여전히 단일 라인인지 확인.)

## 준수 확인 (위반 아님 — 근거를 남겨 둔다)

아래는 규약 위반이 의심됐으나 실측으로 반증된 항목들이다. 다음 리뷰 라운드의 중복 조사를
막기 위해 적어 둔다.

- **5필드 실존·§2.10 커버리지 5/5**: draft 의 표(mallId 1회·lastUsedAt/consecutiveNetworkFailures
  0회 등)를 `4-integration.md` 전체 재검색으로 재현했고, `1-data-model.md` 285~314행에서 5개
  컬럼(`mall_id`/`consecutive_network_failures`/`token_expires_at`/`last_used_at`/
  `last_rotated_at`) 전부 확인됨 — draft 의 "포인터 대상이 참이다" 주장은 실측과 일치한다.
- **anchor `#210-integration` 유효성**: `spec-link-integrity.test.ts` 가 쓰는
  `rehype-slug`(github-slugger) 규칙으로 `### 2.10 Integration` → `210-integration` 슬러그가
  나오며, 이미 `4-integration.md`·`0-common.md`·`5-makeshop.md`·`11-mcp-client.md`·
  `cafe24-restricted-scopes.md` 5곳에서 동일 anchor 로 링크돼 있다(`grep` 확인). 새 포인터가
  이 anchor 를 재사용하는 것은 `spec-impl-evidence.md §4.2` 링크 무결성 가드와 충돌하지 않는다.
- **SoT 이중화 회피 원칙 준수**: draft 가 "§2.10 을 복제하지 않는다"고 명시한 것은
  `swagger.md §1-4`(닫힌 union 을 열린 map 으로 뭉개지 않되, "SoT 이중화 회피" 사유로 여는 예외는
  Rationale 에 근거를 남긴다)와 `spec-impl-evidence.md R-1`(글로브 stale 위험을
  `/spec-coverage` 로 보완하되 문서 자체는 중복 SoT 를 만들지 않는다)이 반복해 강조하는
  원칙과 정확히 같은 방향이다. 위반이 아니라 오히려 이 저장소의 반복 교훈(중복 SoT → drift)을
  올바르게 적용한 사례.
- **§9.4 vs §9.1 책임 경계 판단**: `4-integration.md §9.4`(844행)를 직접 열어 확인한 결과
  실제로 envelope(`{ data }`/`{ code, message, details }`)와 에러 코드 카탈로그만 다루고 있어,
  DTO 필드 인벤토리를 `GET /:id` 행(§9.1)에 두겠다는 draft 의 판단은 실제 문서 구조와 일치한다.
- **DTO JSDoc 과의 정합**: `integration-response.dto.ts` 159~167행의
  `consecutiveNetworkFailures` JSDoc 이 이미 "프런트엔드 참조 0곳" 캐비엇을 담고 있어, draft 가
  "DTO 와 spec 양쪽이 같은 말을 한다"고 주장한 것도 실측과 일치한다. (이 JSDoc 자체가
  `swagger.md §3`(2026-09-05)의 "내부 서사는 `//` 로, 소비자용은 JSDoc 으로" 분리 원칙을
  완전히 지키는지는 별건 — 기존 코드이며 이번 draft 의 변경 대상이 아니므로 본 검토 범위 밖.)
- **명명·데코레이터 규약**: 이번 draft 는 DTO/컨트롤러 코드를 전혀 건드리지 않으므로 점검 관점
  1(명명)·4(API 문서 데코레이터)에 해당하는 신규 표면이 없다 — 위반 가능성 자체가 없음.
- **plan frontmatter**: `spec_impact` 가 리스트 형식(`- spec/2-navigation/4-integration.md`)으로
  선언돼 있어 Gate C(`spec-impl-evidence.md` 밖이지만 `CLAUDE.md`/메모리에 반복 지적된 "bare
  string 금지" 규칙)를 준수한다.

## 요약

target draft 는 `spec/2-navigation/4-integration.md §9.1` 의 인벤토리 주장을 좁히고
`1-data-model.md §2.10` 으로 포인터를 놓는 순수 문서 정정으로, 사실관계(5필드 실존·§2.10
커버리지·anchor 유효성·§9.4 책임 경계)를 모두 실측으로 재확인했고 전부 draft 의 주장과
일치했다. 명명·API 데코레이터·금지 패턴 등 코드측 정식 규약은 이번 변경 범위 밖이라 저촉될
표면이 없고, SoT 이중화 회피 판단은 오히려 이 저장소가 반복 강조하는 원칙(중복 SoT → drift)에
정확히 부합한다. 유일한 실질적 리스크는 규약 문서 자체의 조항 위반이 아니라 **실행 시 GFM
표 구문이 깨질 수 있는 운영적 함정**(word-wrap 된 삽입 텍스트를 그대로 옮기면 표가 손상)이며,
체크리스트에 "한 줄로 이어붙일 것" 한 줄만 보강하면 해소된다.

## 위험도

LOW
