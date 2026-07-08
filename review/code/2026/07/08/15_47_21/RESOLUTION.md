# RESOLUTION — 알림 설정 API (§6.2)

SUMMARY 위험도 LOW, Critical 0. WARNING 2건 fix, INFO 수용.

## FIX
- **W1 (8-notifications §1.1 SPEC-DRIFT)**: `execution_failed`/`schedule_failed` 행의 "channel=both(§5.1)" 를 "both 기본, 수신자별 `<type>Email===false` 면 in_app(opt-out, `resolveOptOutEmailChannels`)" 로 갱신 — 코드(caller-side opt-out)와 정합.
- **W2 (helper 배치 문서화)**: 8-notifications §1 code 설명 + "channel 계산은 호출자 책임" 문구에 `resolveOptOutEmailChannels` 를 명시 — "발사원이 호출해 채널 계산, notify/createMany 적재 경로는 pref-blind"(integration=인라인, failures=헬퍼, 둘 다 caller-orchestrated). 불변식 문언과 신규 구현 정합.

## 수용 (미조치)
- **I (null 우회)**: `@IsOptional`+`@IsBoolean` 이 `null` 을 통과시켜 JSONB 에 null 저장 가능하나, `resolveSettings`(`??`)·`resolveOptOutEmailChannels`(`===false`) 가 null 을 unset 과 동일 취급 → 기능/보안 무영향(security reviewer 확인). class-validator 기지 동작.
- updateSettings RMW 경쟁(workspace-settings 동일 패턴, 개인 토글이라 실사용 충돌 낮음)·user-not-found 방어(JwtStrategy 가 선차단, 도달불가).

## 후속 (plan 등록)
- in_app 채널 뮤팅 · 이메일 일일 요약 job+토글 · marketplace_update 발사 시 opt-in enforcement · §5.1↔4-integration §11.3 문구 통일(planner). — spec-sync-user-profile-gaps.md 에 등록.

## impl-done consistency-check 추가 fix (review/consistency/2026/07/08/15_58_06)
- **USER_NOT_FOUND shape**: `updateSettings` 예외를 nested `{error:{...}}` → **flat `{code,message}`** (코드베이스 다른 5개 발행처와 통일, interaction-filter 우연 의존 제거).
- **@ApiNotFoundResponse**: PATCH /settings 에 추가(swagger.md §2-4, sibling updateMe 대칭).
- **doc**: §5.1 각주 정정(기본값은 4-integration §11.2 와 이미 정합, 남은 건 필드명) · §5.4 stale ref 정정 · tracker 후속 스코프를 "4-integration 필드명 동기화"로.

## 재검증 (최종)
unit(notifications 36 재실행 + 모듈 426)·lint·build·e2e(243)·doc guards(253). impl-done consistency BLOCK: NO. BLOCK: NO.
