STATUS=success documentation review complete — 0 CRITICAL, 2 WARNING, 1 INFO
===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 리뷰 — `inputOverride` 마스킹 마커 서버측 거부 (EIA §R17)

## 검토 방법

diff 41개 파일(백엔드 코드 6 + 신규 유닛/스펙 테스트 3 + spec 7 + plan 2 + 과거 consistency-check
산출물 22)을 프롬프트 게이트 번호로 대조했다. 코드 쪽은 게이트가 잘려 문맥이 부족한 곳(특히
`executions.service.ts`·`workflows.controller.ts`·`sanitize-error-message.ts`·
`trigger-parameter.types.ts`)을 `Read` 로 직접 열어 실제 소스와 대조했고, `spec/5-system/14-external-interaction-api.md` 는 diff 전후 문맥(§R17 "닫는 조건" 표 전체)을 직접 읽어 확인했다. `CHANGELOG.md`
관행 확인을 위해 최근 5개 커밋의 CHANGELOG 항목도 대조했다.

## 발견사항

- **[WARNING]** EIA §R17 "닫는 조건" 표의 신규 행 라벨이 바로 아래 캐비엇과 서로 다른 그림을 그린다
  - 위치: `spec/5-system/14-external-interaction-api.md:1573` (표 행 `| **서버 (재제출 API)** | 재제출 경로 두 곳(...)에서 값 leaf 가 마커와 정확히 일치하면 거부 | ...` )
  - 상세: 바로 아래 블록쿼트(`:1575-1580`)는 *"**가드의 범위 — Manual 실행 경로 전체다** (재제출만이
    아니다)... **후자는 재제출 전용이 아니다** — 같은 엔드포인트가 에디터 JSON 에디터의 자유 편집도
    받고, 값이 히스토리에서 온 것인지 방금 타이핑한 것인지 구분할 플래그가 없다"* 라고 명시적으로
    "재제출" 프레이밍을 정정한다. 그런데 그 프레이밍을 정정당한 표 행 자신의 라벨(`서버 (재제출 API)`)과
    설명 문구(`재제출 경로 두 곳`)는 그대로 남아 있다. 이 표는 폼 프리필·Re-run 모달·에디터 히스토리
    로드 세 행이 **실제로 재제출(read-then-resubmit)에만** 적용되는 것과 나란히 놓인 표라, 스캔하며
    읽는 독자는 서버 가드도 같은 성격(재제출 한정)으로 오독하기 쉽다 — 실제로는 `POST
    /workflows/:id/execute` 를 통한 **fresh 타이핑 입력도** 거부 대상이다. 이 정확한 프레이밍 문제는
    2026-08-20 `23_33_00` consistency 라운드의 cross_spec WARNING #1(`review/consistency/2026/08/20/23_33_00/cross_spec.md`)
    이 이미 지적했고, 그 라운드가 제시한 두 안 중 (b)("범위를 있는 그대로 정정하고 3-execution.md
    'JSON 에디터' 행에 제약 명시")가 채택돼 블록쿼트와 `spec/3-workflow-editor/3-execution.md` 의
    "JSON 에디터" 행(정확한 프레이밍으로 갱신됨, diff 파일 36)은 고쳐졌다. 다만 **정정의 출발점이었던
    이 표 행 자체의 라벨/설명은 갱신에서 빠졌다** — 같은 섹션 안에서 표는 옛 프레이밍, 캐비엇은 새
    프레이밍을 말하는 상태로 남았다.
  - 제안: 표 행 라벨을 `서버 (재제출 API)` → `서버 (Manual 실행 경로)` 등으로, 설명 문구의 "재제출
    경로 두 곳"도 "Manual 실행 경로 두 곳(재제출 포함, fresh 입력도 대상)"처럼 정정해 바로 아래
    블록쿼트와 같은 그림을 그리게 한다.

- **[WARNING]** `CHANGELOG.md` 에 이번 변경 항목이 없다 — 같은 마스킹 시리즈의 직전 5개 커�밋 전부가 항목을 남긴 것과 다르다
  - 위치: `CHANGELOG.md` (이 diff 에 포함되지 않음 — `git diff origin/main...HEAD --stat` 로 41개
    파일 중 부재 확인)
  - 상세: 이 저장소는 `CHANGELOG.md` 를 "## Unreleased — <한줄요약>" 형태로 PR 단위로 적극 유지한다.
    직전 5개 커밋(`45ba37792`·`c9cc2a923`·`89c3f3c53`·`f5351e9c2`·특히 **직접 선행 커밋
    `b677564e0`("`Execution.inputData` 카브아웃을 닫았다 — 재제출 소비처 3곳에 마커 가드", #1188)**)
    모두 CHANGELOG 항목을 갖는다. 그중 `b677564e0` 의 CHANGELOG 항목 자체가 *"서버측 거부는 트래커
    항목(`spec-sync-external-interaction-api-gaps.md`)으로 남겼고, 착수 시 planner 턴으로 §R17 에
    범위를 명문화하는 것까지 함께 한다"* 고 **이번 PR 이 정확히 무엇을 닫는지**를 예고까지 해 뒀다.
    즉 이번 diff 는 그 CHANGELOG 항목이 명시적으로 예고한 후속 작업의 완결편인데, 그 사실이
    CHANGELOG 에 반영되지 않아 히스토리를 훑는 사람이 "트래커 항목으로 남겼다"는 예고가 실제로
    닫혔는지 CHANGELOG 만으로는 알 수 없다.
  - 제안: `## Unreleased — inputOverride 마스킹 마커 재제출을 서버가 거부한다 (EIA §R17 서버측 2층)`
    형태의 항목을 추가하고, 선행 항목(`b677564e0`)이 남긴 예고를 이 항목이 닫는다는 점·`errors`→`details`
    봉투 교정(선존 버그)도 함께 언급.

- **[INFO]** `trigger-parameter.types.ts` 의 기존 주석이 `reason` 값 종류를 두 개만 예시한다 — 이번 diff 로 넷이 됐다
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:68`
    (`toTriggerParameterErrorDetails` 함수 상단 JSDoc — 이 diff 의 변경 hunk 밖, 게이트 없음. 직접
    `Read` 로 확인한 실제 줄 번호)
  - 상세: *"The lowercase `reason` values (`missing_required`/`coerce_failed`) are internal
    classification strings"* 라고 두 값만 예시하는데, 이 diff 로 `reason` 유니온은
    `missing_required`/`coerce_failed`/`invalid_schema`/`masked_value_resubmitted` 네 값이 됐다(이미
    `invalid_schema` 도 예시에서 빠져 있어 이 diff 이전부터 있던 사소한 불완전함이지만, 이번에 파일을
    열어 편집하는 김에 고칠 수 있는 자리였다). 기능에는 영향 없음.
  - 제안: 필수 아님. 예시를 지우고 "internal lowercase classification strings" 처럼 일반화하거나
    네 값을 모두 나열.

## 잘 된 점 (참고)

- `reject-masked-resubmission.ts` 의 함수 상단 JSDoc 이 "왜 필요한가 / 범위 / 판정 기준 / 경계 두
  가지(정확 일치·깊이 상한) / 순서가 왜 중요한가"를 전부 근거와 함께 서술 — 이 리뷰가 흔히 지적하는
  "왜"가 빠진 코드 주석과 대비된다.
- `reject-masked-resubmission.spec.ts` 의 각 캐너리/경계 테스트가 "왜 이 경계인가"를 JSDoc 으로
  남겨(`MAX_REDACT_DEPTH` off-by-one=fail-open, 정확 일치 vs substring, 스택 회귀 크기 근거 #1188
  실측치) 테스트 자체가 회귀 방지 문서 역할을 한다.
- spec 7개 파일이 `spec_impact`/"spec 변경" 목록에 맞춰 정합적으로 갱신됐고(수 라운드의 consistency
  체크로 반복 검증됨), 각 파일 간 참조(§R17 ↔ §1.7 ↔ §8.1 ↔ §6)도 상호 링크로 연결돼 있다.
- 인라인 주석(`executions.service.ts`·`workflows.controller.ts`)이 "왜 이 두 호출부만 검사하는가",
  "왜 details 로 바꿨는가"를 근거·spec 절 인용과 함께 남겨 코드만 보고도 설계 이유를 추적할 수 있다.

## 요약

이 diff 의 문서화 수준은 전반적으로 이 저장소의 평균 이상이다 — 신규 유틸리티 함수·테스트·인라인
주석 전부가 "무엇을" 이 아니라 "왜" 를 근거와 함께 남기고, 관련 spec 7곳도 정합적으로 갱신됐다(이미
5라운드의 consistency-check 를 거치며 실질 결함들이 처분된 상태). 다만 두 가지가 남아 있다: (1)
EIA §R17 "닫는 조건" 표의 신규 행 라벨이, 그 프레이밍을 스스로 정정한 바로 아래 블록쿼트와 다른
말을 하고 있어 표만 훑는 독자를 오도할 수 있고, (2) 이 시리즈의 모든 직전 커밋이 남긴 CHANGELOG
항목이 이번 PR 에는 없다 — 특히 직접 선행 커밋(#1188)이 "트래커 항목으로 남겼다"고 예고한 바로 그
작업을 이 PR 이 닫는데, 그 연결고리가 CHANGELOG 에서 끊긴다. 둘 다 국소적이고 값싸게 고칠 수 있는
수정이라 WARNING 수준으로 등재한다.

## 위험도

MEDIUM
