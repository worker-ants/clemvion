# 보안(Security) 코드 리뷰

## 검토 범위

이번 변경분은 전부 **문서/plan/리뷰 산출물**(`plan/complete/*.md`, `plan/in-progress/*.md`,
`review/consistency/**/*.md|*.json`, `spec/5-system/3-error-handling.md`)이며, 애플리케이션
코드(`codebase/backend`·`codebase/frontend`)의 변경은 포함되지 않는다. 내용은 에러 코드
카탈로그 정합화 두 건이다:

1. `ACCOUNT_LOCKED` 카탈로그의 HTTP status 오기 정정 — `423` → `401` (구현 `UnauthorizedException`
   과 일치시킴, 코드는 불변)
2. `ALERT_RULE_NOT_FOUND`(404)를 중앙 카탈로그(`spec/5-system/3-error-handling.md` §1.3)에 신규 등재
   — 이미 `alerts.service.ts:49,66` 이 발행 중이던 코드를 문서 SoT 로 미러링

## 발견사항

- **[INFO]** 커밋된 산출물에 리뷰 실행자의 로컬 절대경로(홈 디렉터리·사용자명)가 그대로 포함됨
  - 위치: `review/consistency/2026/08/31/11_05_44/_retry_state.json:2` (`session_dir`), 동일 파일
    `:4`(`summary_output_file`), `:9`(`prompt_file`) 등 — `/Users/gehrig/orca/workspaces/clemvion/doliolid/...`
  - 상세: 세션 상태 파일(`_retry_state.json`)이 로컬 사용자명(`gehrig`)과 로컬 워크스페이스
    디렉터리 구조를 절대경로로 담은 채 저장소에 커밋됐다. 이 저장소가 이미 확립한 harness
    산출물 관례(`review/**`에 orchestrator 상태 파일을 남기는 것)의 일부로 보이며, 자격증명이나
    비밀값은 아니어서 심각도는 낮다. 다만 사용자명·로컬 디렉터리 레이아웃 노출은 사소한
    정보 노출(information disclosure)에 해당하고, 공개 저장소라면 내부 인프라 구조를 외부에
    드러내는 부수효과가 누적될 수 있다.
  - 제안: 이 harness 상태 파일의 경로를 저장소 상대경로 또는 익명화된 placeholder 로 기록하도록
    orchestrator 스크립트를 조정할지 검토(기능상 필요라면 유지해도 되나, 신규 세션마다 사용자명이
    반복 노출되는 점은 인지해 둘 가치가 있다). 보안 크리티컬은 아니므로 이번 PR 을 막을 사유는 아니다.

- **[INFO]** `ALERT_RULE_NOT_FOUND` 등재 내용이 기존 anti-enumeration 패턴을 올바르게 문서화함(긍정적 확인)
  - 위치: `spec/5-system/3-error-handling.md:83`(신규 카탈로그 행)
  - 상세: `alerts.service.ts` 가 `where: { id, workspaceId }` 로 조회해 **타 워크스페이스 소유
    규칙에 접근해도 같은 404** 를 반환한다는 사실을, 기존 `MODEL_CONFIG_NOT_FOUND` 의 cross-kind
    차단(존재 누설 방지)과 동일 패턴이라고 명시적으로 문서화했다. IDOR(Insecure Direct Object
    Reference) 방지 관점에서 바람직한 기존 구현을 정확히 반영한 문서 정정이며, 코드 변경이
    없으므로 회귀 위험도 없다.
  - 제안: 없음(현행 유지 권장).

## 요약

이번 변경은 코드 실행 경로를 건드리지 않는 순수 문서 정정 3종(spec 카탈로그 오기 수정, 신규
에러 코드 등재, plan/consistency 리뷰 산출물)으로, 인젝션·인증/인가 우회·하드코딩 시크릿·안전하지
않은 암호화·민감정보 노출 등 OWASP Top 10 관점의 실질적 취약점은 발견되지 않았다. `ACCOUNT_LOCKED`
423→401 정정은 API 계약을 바꾸지 않고(코드는 무변경, 구현은 이미 401을 반환) 문서를 실제 동작에
맞추는 것이며, `ALERT_RULE_NOT_FOUND` 등재는 이미 구현된 워크스페이스 스코프 기반 존재-누설 방지
동작을 카탈로그에 정확히 반영한 것이라 보안 태세를 약화시키지 않는다. 유일한 지적 사항은 커밋된
harness 상태 파일에 로컬 사용자명·디렉터리 경로가 노출된 것으로, 자격증명 노출은 아니며 정보
노출 수준의 낮은 위험이다.

## 위험도

NONE
