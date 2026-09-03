# 정식 규약 준수 검토 — `spec-draft-change-password-code-alignment.md`

대상: `plan/in-progress/spec-draft-change-password-code-alignment.md` (검토 모드: `--spec`)

## 검토 방법

target 문서가 인용하는 실제 spec 라인(1-auth.md:337/339/521/750, 3-error-handling.md:50/66/67/70,
9-user-profile.md:147)과 참조 규약(`error-codes.md` §1~§5, `audit-actions.md`)을 저장소 원본과
직접 대조했다. 라인 앵커는 전부 실측과 일치했고(드리프트 없음), 제안된 코드명·등급 분류·§5 사용자
결정 요건도 규약 본문과 일치했다.

## 발견사항

- **[INFO] §5 "대체 코드" 열의 1→N 매핑이 표 행에만 기록되고 헤드노트/Rationale 산문에는 일반화되지 않음**
  - target 위치: 변경안 표 #10 (`error-codes.md §5 표`)
  - 위반 규약: `spec/conventions/error-codes.md` §5 헤드노트("아래 코드는 흡수 조건을 충족해 교체했다")
    및 등급 A/B 설명 산문
  - 상세: 기존 §5 행은 전부 구 코드 1개 → 신 코드 1개의 교체다. 이 변경은 구 코드 1개
    (`INVALID_PASSWORD`) → 조건별 신 코드 2개(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`)로,
    표의 첫 "1→2" 사례다 — target 스스로 이를 인지하고 있다(`--spec INFO#1` 인용). 다만 처리
    방식이 "그 행의 셀 안에 조건을 함께 적는다"에 그쳐, §5 헤드노트나 등급 설명 산문에는 이
    표가 조건부 분기 매핑도 담을 수 있다는 일반 규칙이 추가되지 않는다. 변경안 #11b(§5
    헤드노트에 레이어 caveat 한 문장 추가)와 대칭적으로, 1→N 매핑도 헤드노트에 한 문장을
    더하면 다음 사람이 유사 사례를 만들 때 "행 하나가 선례였다"가 아니라 "규칙이 그렇게
    쓰여 있다"를 근거로 쓸 수 있다.
  - 제안: #11b 처럼 §5 헤드노트에 "일부 교체는 조건별로 신 코드가 여럿일 수 있으며, 이때 대체
    코드 셀에 조건을 함께 적는다"는 한 문장을 추가하거나, 이 갭이 사소하다고 판단되면
    "규약 갱신 대신 행 자체의 self-description으로 충분"이라는 판단을 Rationale에 남겨 다음
    검토자가 재지적하지 않게 한다.

- **[INFO] §5 `PR` 열에 병합 전 임시값(plan 링크)을 넣는 관례가 문서화되지 않음**
  - target 위치: 변경안 표 #10 ("PR 열은 병합 전이라 결정 plan 링크를 두고, PR 생성 직후 번호로 갱신")
  - 위반 규약: `spec/conventions/error-codes.md` §5 표 (컬럼 정의 없음 — cafe24-api-catalog
    `_overview.md` §2와 달리 §5는 컬럼 스펙 절이 없다)
  - 상세: 기존 §5 `PR` 열 값은 전부 짧은 토큰이다(`PR4b`, `#1193`, `#566`). 이번 제안은 병합 전
    상태를 표현하기 위해 그 칸에 상대경로 markdown 링크(plan 문서)를 넣는 첫 사례다 — target도
    이를 INFO#2로 자각하고 있다. `cafe24-api-catalog`는 이런 미확정 상태에 `?` 라는 명시적
    placeholder 토큰을 §3에 정의해 두는데(§3 "planned 행의 method/path/scope는 `?` 허용"),
    `error-codes.md` §5는 그런 placeholder 규약이 없어 이번이 즉흥적으로 만드는 첫 형식이 된다.
    §5 표는 사람이 읽는 용도이고 machine-parse 가드가 없어(cafe24-catalog의
    `catalog-sync.spec.ts`와 대비) 위반이라기보다 형식 공백이다.
  - 제안: 급하지 않으면 그대로 진행해도 무방하나, 후속 PR에서 실제 PR 번호로 갱신할 때 §5에
    "PR 미정 시 plan 링크로 임시 기재, PR 생성 즉시 갱신"이라는 placeholder 관례를 한 줄
    남기면 다음 "spec+impl 동시 PR" 사례가 같은 즉흥 판단을 반복하지 않는다.

- **[INFO] 결정 서사(decision narrative)가 두 plan 문서에 상당 부분 중복**
  - target 위치: "배경", "왜 지금 고치나"(실측 표), "왜 초판 권장 B를 거부했는가" 섹션
  - 위반 규약: CLAUDE.md "정보 저장 위치(단일 진실 원칙)" 표 — "결정의 배경·근거는 해당 spec
    문서 끝의 `## Rationale`"
  - 상세: 같은 실측 표(FE 게이트 부재·에러 표시 경로·노출 문구)와 "PASSWORD_NOT_SET 기각 사유"
    서사가 `plan/in-progress/auth-change-password-oauth-only-code-split.md`(결정 기록 절)와
    본 target 양쪽에 거의 동일하게 실려 있다. 두 문서는 역할이 다르다 — 전자는 "결정
    plan"(무엇을 왜 결정했는가), 후자는 "spec draft"(그 결정을 spec 라인 단위로 어떻게
    반영하는가) — 이는 project-planner SKILL(§ "draft 작성")이 규정한 결정→draft 2단계
    워크플로 자체이고, 저장소에 이미 다수 선례가 있는 패턴이라(`spec-draft-*` 68건+) CRITICAL/
    WARNING으로 볼 사안은 아니다. 다만 원인·배경 산문을 통째로 재작성하는 대신 결정
    plan 쪽으로 링크 요약(예: "실측 표는 [결정 plan](...) §왜 지금 고치나 참조")했다면 SSoT
    중복이 더 적었을 것이다.
  - 제안: 필수 수정 아님. 향후 유사 draft 작성 시 "왜" 서사는 결정 plan을 링크로 참조하고
    draft 본문은 "무엇을 어떻게"(변경안 표)에 집중하는 편이 단일 진실 원칙에 더 가깝다는
    점만 기록해 둔다.

## 검증된 준수 사항 (긍정 확인)

- **명명**: 제안 코드 `PASSWORD_REQUIRED`/`PASSWORD_INVALID`는 이미 활성 상태인 형제 코드를
  재사용하며 `UPPER_SNAKE_CASE`(§1)를 만족한다. 신규 코드를 만들지 않아 §1의 "구현 세부·전이적
  맥락을 이름에 박지 않는다" 원칙과 "근접 명명 3종→4종 증식 방지" 취지에 부합한다.
  `PASSWORD_NOT_SET`을 신설하지 않은 판단은 그 문자열이 이미 `login_history.failure_reason`
  감사값으로 존재한다는 실측(`auth.service.ts:330`)에 근거하며, 신설 시 `INVALID_PASSWORD`가
  겪는 wire/audit 동명 충돌을 재생산했을 것이라는 점을 정확히 짚었다.
- **§2 rename 정책**: "이름 정확성 향상만을 위한 rename은 하지 않는다"는 §2 규정과 어긋나지
  않는다 — 새 코드를 만드는 대신 기존 형제 코드로 흡수하는 방식이라 rename도 신설도 아니다.
- **§5 등급 B 요건**: `POST /users/me/change-password`가 워크스페이스 JWT로 호출 가능한 내부
  REST라는 근거로 등급 A가 아닌 B로 정확히 분류했고, §5가 요구하는 "사용자 결정"이
  `auth-change-password-oauth-only-code-split.md`의 "## 결정 기록 (2026-09-02)" 절에 실제로
  기록돼 있음을 확인했다(D안 채택, 표·체크박스 확인).
- **§5 헤드노트 caveat(변경안 #11b)**: "코드베이스에서 완전 제거"라는 §5 전제가 이 행에는
  성립하지 않는다는 지적(감사값 존속)은 실측(`login_history.failure_reason` 값 존속,
  `spec/1-data-model.md:710`·`spec/data-flow/2-auth.md:76`)과 일치하며, 규약 자체의 정확성을
  올바르게 개선하는 방향이다.
- **audit-actions.md와의 경계**: 이번 변경은 `AuditLog.action`(audit-actions.md 관할)이 아니라
  `login_history.failure_reason`(별도 컬럼, DB 미제약 자유 문자열)을 다루므로 audit-actions.md
  규약 적용 대상이 아니라고 올바르게 스코프를 좁혔다.
- **문서 구조**: project-planner SKILL이 규정한 spec-draft 형식("변경안 작성 + 본문 끝
  `## Rationale`")을 따른다 — spec 문서용 Overview/본문/Rationale 3섹션 요건은 draft 자체가
  아니라 draft가 편집 대상으로 삼는 spec 문서(`error-codes.md` 등)에 적용되며, 그 문서들은
  이미 그 구조를 갖추고 있다.
- **frontmatter**: `worktree`/`started`/`owner` 3필드 스키마 충족, `spec_impact` 목록이 실제
  변경안 표의 대상 spec 파일 4개와 정확히 일치한다.
- **라인 앵커 정합성**: 인용된 모든 spec 라인 번호(1-auth.md:337/339/521/750,
  3-error-handling.md:50/66/67/70, 9-user-profile.md:147)를 저장소 원본과 대조한 결과 전부
  정확했다 — 드리프트 없음.

## 요약

target은 `error-codes.md`의 명명 원칙(§1)·rename 금지(§2)·등급 B 요건(§5)을 정확히 이해하고
적용한 spec draft다. 신규 코드를 만들지 않고 기존 형제 코드를 재사용해 근접 명명 증식을 막았고,
§5의 "완전 제거" 전제가 깨지는 지점(감사값 존속)을 스스로 발견해 헤드노트 caveat까지 제안했다.
발견된 사항은 전부 INFO 등급으로, ①§5 표가 최초로 다루는 1→N 코드 매핑을 헤드노트 산문으로도
일반화할지, ②§5 `PR` 열의 병합 전 placeholder 형식을 규약에 명문화할지, ③결정 서사가 자매
plan 문서와 상당 부분 중복되는 점을 향후 SSoT 관점에서 어떻게 다룰지에 관한 것이며, 어느 것도
기존 정식 규약의 invariant를 깨뜨리지 않는다.

## 위험도

LOW
