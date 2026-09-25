# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-workspace-path-guard.md`

## 발견사항

- **[CRITICAL] 예정 동작을 "이미 구현됨"처럼 현재형으로 서술 — 이 저장소 자신의 선례·`spec-impl-evidence.md` 위반**
  - target 위치: `## C. spec 변경` 전체(C-1 ~ C-9). 특히 C-1(c)「정정: 워크스페이스를 경로로
    받는 파라미터는 `@WorkspaceParam('<name>')` 로 바인딩한다. `RolesGuard` 는 … 인식하고 …」,
    C-2「`RolesGuard` 의 `@Roles('editor')` 미달」행 신설, C-3「§1.5.4 … 코드: `forbidden` →
    `ADMIN_REQUIRED`」, C-7「… 403 `ADMIN_REQUIRED`」, C-8 표, C-9「`RolesGuard` 의 멤버십·역할
    거부는 기본값이 아니라 전용 코드를 갖는다」.
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §3 `status` 라이프사이클(`implemented`
    = "모든 약속 구현 완료") 및 Overview 가 명시한 존재 이유("spec 약속 vs 구현 부재 갭을
    build-time 가드로 차단"). 대상 파일은 전부 §1 inclusive list(`5-system/**`·`2-navigation/**`·
    `conventions/**`) 소속이며 `data-flow/12-workspace.md` 만 frontmatter 의무 예외다.
  - 상세: 이 draft 는 스스로 "이 draft 는 spec 만 바꾼다 — 구현은 후속 developer PR 이 한다"
    (§D 서두)고 명시한다. 즉 C 절이 적는 `@WorkspaceParam` 인식·경로 라우트 가드 검사·
    `EDITOR_REQUIRED`/`OWNER_REQUIRED`/경로용 `NOT_A_MEMBER` 발행은 **이 draft 가 merge 되는
    시점에는 존재하지 않는 동작**이다. 그런데 C 절 문장은 전부 서술형 현재시제("…를 검증한다",
    "…발행되는", "…코드를 갖는다")로 쓰여 있어, 이미 배포된 사실처럼 읽힌다.
    대상 파일들의 frontmatter `status`(`3-error-handling.md`=implemented,
    `2-api-convention.md`=implemented, `13-replay-rerun.md`=implemented,
    `6-config.md`=implemented, `error-codes.md`=implemented, `swagger.md`=implemented,
    `1-auth.md`/`9-user-profile.md`=partial)는 모두 "이미 구현됨"을 전제하는 값이고, 이 draft
    는 그 값을 건드리지 않는다(§C 어디에도 frontmatter `status`/`pending_plans` 갱신 지시가
    없다).
    **정확히 같은 상황에 대한 이 저장소 자신의 확립된 처방이 이미 존재한다** — 이 draft 가
    편집하는 바로 그 파일들 안에 실례가 여럿이다:
    - `spec/5-system/3-error-handling.md:326` "위 표의 … 세분화 코드는 **계획(Planned)** 이며
      미구현이다."
    - `spec/5-system/3-error-handling.md:449,458` "**계획(Planned), 미구현**"
    - `spec/5-system/1-auth.md:113,439,457` "*(미구현 · Planned)*" / "**Planned (미구현 — 목표
      커버리지)**" / "**계획(Planned)** 이며 미구현"
    - `spec/2-navigation/9-user-profile.md:260,311` "미구현(Planned)" / "**미구현 (Planned)**"
    - `spec/2-navigation/6-config.md:334` "미구현(Planned) 항목을 … 구현 승격한다"
    이 저장소는 "아직 코드가 없는 promise 를 implemented-status 문서에 넣을 때는 **계획(Planned)/
    미구현** 을 명시한다"는 관행을 이미 반복적으로 지켜 왔다. 이 draft 의 C 절은 그 표식을
    단 한 곳에도 쓰지 않는다 — 신설되는 `EDITOR_REQUIRED`/`OWNER_REQUIRED`(C-2), 경로 라우트의
    가드 인식(C-1(c)), 코드 변경(C-3·C-6·C-7·C-8) 모두 "이미 그렇다"로 적힌다. 이대로 머지되면
    (a) 문서를 읽는 다음 사람·checker 는 실제로는 안 나는 `EDITOR_REQUIRED`/`OWNER_REQUIRED`
    (경로 라우트분)가 이미 나간다고 믿고, (b) `spec-coverage`(reverse 모드)·`consistency-check`
    가 "spec 약속 vs 구현" 판정을 할 근거를 잃는다 — 정확히 `spec-impl-evidence.md` Overview 가
    "닫으려는" 갭(텔레그램 chat-channel 영구 누락류)이 반대 방향(구현 없는 promise)으로 재현된다.
  - 제안: C-1 ~ C-9 각 항목에 "(2026-09-25 결정 — **계획(Planned)**, 후속 developer PR 구현
    전까지 미구현)" 식의 명시적 마커를 붙이거나, 최소한 각 spec 변경 서두에 한 문단으로
    "이 절이 서술하는 `RolesGuard` 경로-파라미터 인식·신규 코드는 `plan/in-progress/
    spec-draft-workspace-path-guard.md`(또는 후속 developer plan) 구현 전까지 미구현이다" 를
    명시한다. 대안으로 이 draft 자신을 `pending_plans:` 대상으로 남기려면(§D 항목이 이 draft
    자체 후속이라면) 손댄 파일 중 `partial` 전이가 합리적인 것은 frontmatter `status: partial` +
    `pending_plans: [plan/in-progress/spec-draft-workspace-path-guard.md]` 로 전이하는 것도
    검토한다 — 다만 각 파일의 "이미 구현된" 나머지 내용까지 `partial` 로 낮추는 비용이 크므로,
    이 저장소 선례(계획/미구현 인라인 마커, 전체 status 는 유지)를 따르는 쪽이 더 가볍고 일관적이다.

- **[WARNING] C-3 편집이 같은 절의 인접 각주(`forbidden`·`rate_limited` 예외 설명)를 갱신하지
  않아 `error-codes.md §3` 교차참조가 낡는다**
  - target 위치: `## C-3. spec/5-system/1-auth.md` 첫 항목("§1.5.4 … 코드: `forbidden` →
    `ADMIN_REQUIRED`").
  - 위반 규약: `spec/conventions/error-codes.md` §3 historical-artifact 예외 레지스트리 —
    본 문서가 SoT 로 인용되는 문장이 `1-auth.md` §1.5.4 표 바로 아래에 있다.
  - 상세: 실제 `spec/5-system/1-auth.md` §1.5.4 표 바로 아래 각주는 "위 코드들은 …
    `UPPER_SNAKE_CASE` 규약과 달리 `lower_snake_case` 다 … **특히 `forbidden`·`rate_limited`
    는 일반 명칭이라 다른 도메인에서는 `FORBIDDEN`·`RATE_LIMITED`(UPPER) 를 쓰며, 본 lowercase
    표기는 초대 흐름 전용 한정 예외다**" 라고 `forbidden` 을 이름으로 지목한다. C-3 이 표의
    `forbidden` 행을 `ADMIN_REQUIRED`(UPPER_SNAKE_CASE)로 바꾸면, 이 각주는 더 이상 표에 없는
    코드를 "위 코드들" 의 예시로 계속 지목하는 진술이 되어 stale 해진다. C-4 가 `error-codes.md`
    §3 레지스트리에서 `forbidden` 을 빼는 것과 대칭적으로, `1-auth.md` 쪽의 이 각주 문장도 함께
    정정해야 두 SoT 가 동시에 갱신된다 — C-3 지시에는 이 각주 수정이 빠져 있다.
  - 제안: C-3 에 "같은 표 아래 각주 — «특히 `forbidden`·`rate_limited` 는 …» 문장에서
    `forbidden` 언급을 제거(또는 `rate_limited` 단독 예시로 축소)" 항목을 추가한다.

- **[INFO] C-4 의 `admin_required` 註 삽입 위치가 3-코드 합병 행 안이라 편집 정밀도가 낮다**
  - target 위치: `## C-4. spec/conventions/error-codes.md` 두 번째 항목("`admin_required` 에
    註: …").
  - 위반 규약: 없음(직접 위반은 아님) — 다만 `error-codes.md` §3 표의 실제 해당 행은
    `workspace_not_found` · `user_not_found` · `admin_required` **세 코드를 한 행에 묶어**
    선언한다(코드·HTTP·이유·진실·근거 5열이 전부 세 코드 공용). "註를 `admin_required` 에만
    붙인다"는 지시가 이 병합 행 구조와 어떻게 상호작용할지(행을 쪼갤지, 진실/근거 셀에
    `admin_required` 만 겨냥한 문장을 끼워 넣을지)가 명시돼 있지 않다.
  - 제안: C-4 에 "그 행을 쪼개지 않고 註는 '진실' 셀 끝에 `admin_required` 한정 문구로 추가"
    처럼 편집 형태를 한 줄 더 명시한다.

## 요약

target 문서는 인용 정확도가 매우 높다 — `spec/5-system/3-error-handling.md`·
`spec/5-system/1-auth.md`·`spec/5-system/2-api-convention.md`·`spec/conventions/swagger.md`·
`spec/data-flow/12-workspace.md`·`spec/2-navigation/6-config.md`·`9-user-profile.md`·
`13-replay-rerun.md` 의 모든 인용 문구를 실제 파일과 대조했을 때 전부 정확히 일치했고,
`OWNER_REQUIRED`/`forbidden` 미발행 등 실측 주장도 grep 으로 재현됐다. 신규 에러 코드
명명(`NOT_A_MEMBER`·`EDITOR_REQUIRED`·`ADMIN_REQUIRED`·`OWNER_REQUIRED`)과 `@WorkspaceParam`
데코레이터 설계(`ROUTE_ARGS_METADATA` 팩토리 identity)는 `error-codes.md` §1 의미 기반 명명·
기존 `@WorkspaceId()` 패턴과 정확히 정합한다. 다만 **핵심 결함 하나가 있다**: 이 draft 는 스스로
"spec 만 먼저 바꾸고 구현은 후속 PR" 이라고 선언하면서도, C 절 전체를 이미 구현된 것처럼 현재형
서술로 적어 이 저장소가 같은 파일들 안에서 이미 반복 확립한 "계획(Planned)/미구현" 표식 관행을
따르지 않는다 — `spec/conventions/spec-impl-evidence.md` 가 막으려는 "spec 약속 vs 구현 부재"
갭을 그대로 재현할 위험이 있다. 이 CRITICAL 하나를 해소하면(각 절에 Planned/미구현 마킹 추가)
나머지는 WARNING 1 건(인접 각주 미동기화)·INFO 1 건(편집 정밀도)뿐인, 전반적으로 견고한 draft다.

## 위험도
HIGH
