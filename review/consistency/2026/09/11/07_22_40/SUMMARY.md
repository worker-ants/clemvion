# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 위배 없음

## 전체 위험도
**LOW** — 두 checker(convention_compliance, cross_spec) 모두 CRITICAL/WARNING 없음, cross_spec 이 INFO 3건(저비용 후속 권장) 제시

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `data-flow/14-chat-channel.md` PATCH 행이 신규 두 400 차단 분기를 반영하지 않음 (data-flow 문서 scope 상 필수는 아님) | `spec/data-flow/14-chat-channel.md:151` vs target A3(`15-chat-channel.md` §5.4.1 신규 2행) | 이번 턴 조치 불필요. 후속 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md` 류)에 "PATCH 행에 §5.4.1 신규 2 분기 각주 추가" 로 저비용 등재 권장 |
| 2 | cross_spec | 신규 `chatChannel` 사후부착/`provider` 전환 차단 2행이 "Bot Token 변경 single-path 정책" 표(§5.4.1) 제목과 주제가 어긋나 향후 탐색 시 중복 정의 위험 | `15-chat-channel.md` §5.4.1 표 (표 제목: Bot Token 정책, 신규 내용: chatChannel/provider 정책) | 표 제목 아래 scope 확장 안내 한 줄 추가 또는 별도 소제목(`#### chatChannel 필드·provider 불변성`)으로 분리 — 낮은 우선순위, naming_collision/plan_coherence 소관과 겹칠 수 있음 |
| 3 | cross_spec | 신규 400 두 분기가 `details.code` 를 발행하지 않아 `error-handling.md §1` 카탈로그 미등재 — 문면상 예외 없는 등재 요구처럼 읽히나 기존 `botTokenRef` 등 선례와 동일한 비대칭을 그대로 계승 | `2-api-convention.md` "도메인 세부 사유를 어디에 싣는가" 절 vs target D-2 | 이번 턴 조치 불필요. 기존 `details[].code` 부재 후속 등재 항목과 함께 일괄 정리 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| convention_compliance | NONE | `2-api-convention.md §5.3/§5.4`·`error-codes.md`·`secret-store.md §2.1` 인용 전수 정확, D-1(형태 갈래 인정)·D-2(신규 코드 미신설) 모두 기존 규약·선례와 정합. 파일:줄·카운트(10곳 `store()`, tracker 라인 등) 전수 재현 일치 |
| cross_spec | LOW | 프롬프트 절단으로 누락된 6개 spec_impact 파일을 worktree 실물로 직접 대조, target 의 3대 실측(details.field 값-의존 두 갈래, 신규 400 두 분기, `store()`→`rotate()` 10곳) 전부 정확. CRITICAL 급 모순 없음, INFO 3건은 scope/후속 정리 성격 |

## 권장 조치사항
1. (필수 아님, 저비용 후속) `data-flow/14-chat-channel.md` PATCH 행에 §5.4.1 신규 2 분기 각주 추가를 후속 트래커에 등재.
2. (필수 아님) §5.4.1 표에 신규 2행의 scope(bot token 외 chatChannel/provider 정책 포함)를 명시하는 안내 문구 또는 소제목 분리 검토.
3. (필수 아님) `details[].code` 미발행 분기들의 `error-handling.md §1` 카탈로그 등재 여부를 기존 `botTokenRef` 등 선례와 함께 일괄 재검토하는 후속 항목 유지.
