# Code Review 통합 보고서 (polish batch)

리뷰 대상: Channel Web Chat — polish batch (2-sdk resetSession·1-widget §2·5-admin Overview/R5→R2·EmbedConfigDto JSDoc·configFromQuery 하드닝)
일시: 2026-06-28 14:49:11 (base origin/main)

## 전체 위험도
**LOW — Critical 0, Warning 0.** 7 reviewer 전원 INFO 만(testing LOW=INFO 3). 차단 요인 없음.

## Critical / 경고
없음.

## 참고 (INFO) — 처리 방침

| # | 분류 | 항목 | 처리 |
|---|------|------|------|
| 1 | SPEC-DRIFT | safeApiBaseFromQuery http(s) 검증 spec 미명세 | **본 후속에서 4-security §1 에 anchor 추가**(SPEC-DRIFT 재발 방지) |
| 2·3·4 | Testing | data: 스킴·빈 문자열 케이스·console.warn 호출 단언 누락 | **본 후속에서 추가**(보안 함수 커버리지) |
| 5·10 | Doc/Maint | EmbedConfigDto JSDoc ↔ @ApiProperty.description 중복 drift | **유지** — swagger.md §1-1 이 JSDoc+@ApiProperty 병기를 규정(중복은 컨벤션) |
| 6·11 | Doc/Maint | safeApiBaseFromQuery @param/@returns·`u`→`url` | **본 후속 polish** |
| 7 | Doc | plan --impl-prep 체크박스 | **본 후속 갱신** |
| 8 | Security | 반환값을 `new URL(raw).origin` 만으로 | **미적용(부적절)** — apiBase 는 path(`/api`) 포함이 정상이라 origin-only 면 경로 유실. 스킴 검증이 적정 레벨 |
| 9 | Security | isEmbedAllowed fail-open | spec 의도(4-security §3-①) — 무조치 |

## 에이전트별 위험도
security NONE · requirement NONE · scope NONE · side_effect NONE · maintainability NONE · testing LOW(INFO만) · documentation NONE. 전원 Critical/Warning 0.

## 권장 조치사항(본 후속 반영)
1. 4-security §1 에 apiBase http(s) 검증 anchor(SPEC-DRIFT #1).
2. safeApiBaseFromQuery data:/빈문자열/warn-호출 단언 테스트(#2~4).
3. @param/@returns JSDoc·`u`→`url`(#6·11) · plan 체크박스(#7).
4. #8(origin-only)·#5/#10(JSDoc 컨벤션) 미적용 — 근거 상기.
