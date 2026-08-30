# Rationale 연속성 검토 결과

target: `plan/in-progress/spec-draft-raw-query-results.md`

## 검증 방법

prompt 에 번들된 관련 spec Rationale 발췌뿐 아니라, target 이 참조하는 1차 출처
(`spec/conventions/node-cancellation.md`, `spec/conventions/migrations.md`,
`plan/in-progress/update-returning-tuple-shape.md`,
`plan/in-progress/retry-turn-terminal-guard.md`,
`plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`,
`spec/5-system/3-error-handling.md`, `spec/data-flow/2-auth.md`)를 워크트리에서 직접 읽어
target 의 "기각한 대안"·"소급 각주"·수치 정정 주장이 실제 이력에 근거하는지 대조했다.

## 발견사항

- **[WARNING]** `OAUTH_STATE_MISMATCH`(400) 를 §1.2 "인증/인가 에러" 메인 표에 직접 등재하면
  기존에 확립된 status-code 분리 원칙과 충돌할 수 있다
  - target 위치: §C. 카탈로그 등재 — `OAUTH_STATE_MISMATCH` (라인 209~223)
  - 과거 결정 출처: `spec/5-system/3-error-handling.md` `## Rationale` §1.9
    ("워크스페이스 멤버 직접 추가 코드 등재") — "**§1.2(401/403/423)에 409 를 섞지 않고
    status 열 서브섹션으로 둔 것은 §1.5~§1.8 선례**"
  - 상세: `spec/5-system/3-error-handling.md` §1.2 메인 표(라인 40~50)를 실측하면 현재
    등재된 코드는 전부 401/403/423 뿐이다(`AUTH_REQUIRED` 401 · `FORBIDDEN` 403 ·
    `ACCOUNT_LOCKED` 423 등). 400/503 등 그 범위를 벗어나는 코드는 이미 §1.2.1(2FA/
    WebAuthn/재인증, 400/401/403/503 혼재)이라는 **별도 서브섹션**으로 분리돼 있고, 409
    코드(`ALREADY_A_MEMBER` 등)도 §1.9 로 분리됐다 — 이것이 Rationale 이 명시한 "메인
    §1.2 표는 401/403/423, 그 밖의 status 는 서브섹션" 패턴이다. `OAUTH_STATE_MISMATCH` 는
    400 이고, §1.2.1(2FA/WebAuthn/재인증 전용, OAuth 로그인 state 와 무관한 도메인)에도
    자연스럽게 속하지 않는다. target 은 "§1.2 인증/인가 에러에 등재" 라고만 적어, 이를
    문자 그대로 메인 표 한 행으로 넣으면 이 확립된 분리 원칙을 위반한다. (참고: target
    자신도 §C 말미에서 §1.9 항목을 "위임 배치" 로 다루면서 정작 같은 문서가 세워둔 이
    분리 규칙은 언급하지 않았다.)
  - 제안: planner 턴에서 실제로 문서를 고칠 때, `OAUTH_STATE_MISMATCH` 를 §1.2 메인 표에
    직접 추가하지 말고 (a) 신규 서브섹션(예: "§1.2.2 OAuth 로그인 코드")을 만들거나
    (b) 기존 §1.2.1 과 마찬가지로 "도메인 spec 참조" 패턴을 따르는 별도 서브섹션에
    두고, 왜 메인 401/403/423 표가 아닌지(400 이라서) 한 줄로 근거를 남긴다. 메인 표에
    그대로 넣기로 결정한다면 §1.9 Rationale 의 분리 원칙에 대한 명시적 예외 근거를
    함께 적어야 한다.

- **[INFO]** node-cancellation.md §2.4 "3·4번째 불릿" 캐비어트가 구조적으로 다른 두
  가드 메커니즘을 한 문구로 묶는다
  - target 위치: §B 소급 각주 표 6번 행 (라인 146)
  - 과거 결정 출처: `spec/conventions/node-cancellation.md` `## Rationale`
    "왜 취소 시각 보존 메커니즘이 두 가지인가" — "이 표를 보고 새 guarded-cancel 경로를
    만들 때 무조건 skip 을 기본으로 가정하지 말 것" / "자매와는 진입점만 같고 극성이
    반대다"
  - 상세: node-cancellation.md §2.4 의 3번째 불릿("park↔resume 짝 전이 terminal 가드")은
    본문에서 **`SELECT … FOR UPDATE` 잠금 + 명시적 비-terminal 확인**으로 서술되고,
    4번째 불릿("retry 재진입 종결 경로 terminal 가드")은 **조건부 UPDATE affected=0 →
    skip** 으로 서술된다 — 문서 자신이 두 메커니즘을 다른 극성/다른 매커니즘으로
    명시적으로 구분해 놓았고, 그 구분을 지키라고 Rationale 에 직접 경고까지 남겼다.
    target 의 §B row 6 은 이 둘을 "종결 직전 재조회 후 '0행이면 skip' — 항상 참" 이라는
    단일 캐비어트로 묶어 붙일 위치로 지정한다. (기저 코드 위치상 `failFirstSegmentSetup`·
    `finalizeFailedExecution` 이 12곳 리스트에 포함돼 있어 3번째 불릿도 raw-tuple 버그의
    영향권 안에 있다는 점은 사실로 확인되나, 캐비어트 **문구**가 "0행이면 skip" 으로
    통일되면 §2.4 본문이 애써 구분한 두 메커니즘의 차이가 다시 뭉개질 위험이 있다.)
  - 제안: 실제 spec 편집 시 3번째 불릿에는 "잠금 확인 우회"쪽 실제 부호를, 4번째
    불릿에는 "조건부 UPDATE 0행→skip" 부호를 각각의 메커니즘 서술에 맞게 분리 기술한다
    (또는 최소한 "두 불릿 모두 `updateExecutionStatus` 반환값에 의존하는 하위 경로가
    있다" 는 한 문장으로 두 메커니즘의 차이를 보존한다).

## 그 외 확인된 항목 (문제 없음)

- §A "기각한 대안 — `migrations.md` 확장" / "기각한 대안 — 타입 경계 래퍼로 강제": 후자는
  `plan/in-progress/update-returning-tuple-shape.md` 라인 314~331 에 실제 검토·기각 이력이
  남아 있다(지어낸 근거 아님, MEMORY 의 "Rationale 기각된 대안은 실제 이력 필수" 기준
  충족). `migrations.md` 는 실제로 `## Rationale` 섹션 자체가 없고 스키마 변경 절차에
  국한된 문서라 "축이 다르다" 는 target 의 신규 문서 근거와 충돌하지 않는다.
- §B 12곳/3파일 수치 정정: `plan/in-progress/spec-update-node-cancellation-shutdown-
  classification.md` 라인 625 · `plan/in-progress/retry-turn-terminal-guard.md` 라인
  26~48 이 "11곳" 이 stale 하고 `finalizeCancelledExecution` 재분류로 12가 됨을 이미
  자체 기록하고 있어, target 의 "트래커 갱신" 주장은 지어낸 것이 아니라 실제 선행 기록의
  후속이다.
- §B #7 (§6 "mutation 6/6·13/13 검증" 범위 caveat): `update-returning-tuple-shape.md` 의
  "[planner 위임] 소급 각주" 5번째 항목은 §2.4 caveat 배치만 지시하고 §6 표의 "검증"
  범위 caveat 은 지시하지 않아, target 의 "이번에 checker 가 되찾았다" 는 주장과 정합.
  새 caveat 문구도 함께 제공돼 "결정의 무근거 번복" 에 해당하지 않는다.
- §D `pending_plans:` 추가: `update-returning-tuple-shape.md` 라인 450~451 및 자매 티켓
  라인 664 양쪽에 동일 지시가 이미 있어 target 의 "충돌 아님" 주장과 일치.
- §Rationale "기각한 대안 — §2.4 caveat 을 12곳에 개별 부착": 트래커 자체의 "실제 소비
  경로 단위로 적을 것" 지시(라인 413~416)를 문자 그대로의 "위치 나열" 이 아니라
  "메커니즘 단위" 로 해석해 만족시키는 합리적 정제이며, 두 접근의 trade-off 를 새
  Rationale 로 명시했다.
- 새 불변식 (a)/(b) 는 `spec/1-data-model.md`·`spec/0-overview.md` 의 기존 DB/마이그레이션
  Rationale 과 충돌하지 않는다(raw `.query()` 사용 자체를 금지하는 기존 원칙 없음).

## 요약

target 문서는 이례적으로 촘촘하게 출처를 남긴다 — "기각한 대안"·수치 정정·caveat 배치
결정 대부분이 워크트리 안의 실제 plan/tracker 이력(`update-returning-tuple-shape.md`,
`retry-turn-terminal-guard.md`, 자매 티켓)으로 검증 가능했고, 지어낸 Rationale 이나
근거 없는 번복은 발견되지 않았다. 다만 두 지점에서 기존 spec 이 **이미 명문화한 구조적
원칙**과 마찰이 있다: (1) `OAUTH_STATE_MISMATCH`(400)를 §1.2(401/403/423 전용으로
확립된 메인 표)에 그대로 등재하려는 계획이 error-handling.md §1.9 Rationale 이 세운
"status 불일치 코드는 서브섹션으로 분리" 원칙과 부딪힐 수 있고, (2) node-cancellation.md
§2.4 3·4번째 불릿에 붙이려는 단일 caveat 문구가 그 문서 자신이 명시적으로 경고한 "두
guarded-cancel 메커니즘을 동일시하지 말라" 는 caution 과 어긋날 소지가 있다. 둘 다
CRITICAL 수준의 기각된 대안 재도입은 아니며, planner 가 실제 spec 파일을 쓰는 단계에서
문구를 조정하면 해소되는 WARNING/INFO 급이다.

## 위험도

LOW
