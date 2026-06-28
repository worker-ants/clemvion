# RESOLUTION — extractClientIp 통합 + filter/guard 정리 review (19_00_30)

원 SUMMARY: ai-review RISK=LOW, CRITICAL=0, **WARNING=3**.
동반 `--impl-done`(review/consistency/2026/06/28/19_00_30) **BLOCK:NO**, 전 checker NONE/LOW.

## 조치 항목

| # | 출처 | 카테고리 | 발견 | 조치 |
|---|---|---|---|---|
| W1 | ai-review / impl-done Cross-Spec I2 | SPEC-DRIFT | `1-auth.md §2.3` 표 "클라이언트 IP" 행이 webhook/rate-limit 경로의 헤더 전용(req.ip 폴백 없음) 동작을 구분 안 함 | **FIXED**: §2.3 표 행에 "4단계 폴백은 세션·감사 경로 한정, webhook/rate-limit/ip_whitelist 는 헤더 기반(CF-gated→XFF)만·req.ip/socket 폴백 없음(`extractClientIpFromHeaders` 직접 호출)" 명시. Rationale 2.3.B 와 정합. |
| W2 | ai-review Documentation | Documentation | `hooks.service` 2번째 호출부(`handleChatChannelWebhook`)에 req.ip 폴백 후속 컨텍스트 한 줄뿐 (1번째는 4줄+plan 링크) | **FIXED**: 2번째 호출부에 1-auth §2.3·Rationale 2.3.B + plan 링크 주석 추가(설명 균형화). |
| W3 | ai-review Documentation | Documentation | 플랜의 `12-webhook.md §6·WH-SC-05` 참조 유효성 미검증 | **확인 완료(유효)**: `grep "WH-SC-05" spec/5-system/12-webhook.md` → L69 에 존재(Rate limiting 요구사항). 참조 정상 — 플랜 수정 불요. |
| I2 | ai-review Testing | Testing | `UNKNOWN_ERROR_MESSAGE`(비-Error throw) 경로 테스트 미커버 | **FIXED**: filter.spec 에 `catch('a raw string thrown')` 케이스 추가 — 500·INTERNAL_ERROR·`'An unexpected error occurred'` 단언(UNHANDLED 경로와 구분). |

## 보류·후속 항목 (비차단 INFO)

- **I13 (Scope, plan branch 불일치)**: 리뷰어 오판. 실제 작업 브랜치 = `claude/webhook-extractip-consolidation`(plan frontmatter 와 일치, `git rev-parse` 확인). 조치 불요.
- **I14 (Scope, ReqShape export 제거 breaking)**: grep 확인 — 외부 소비자 0(guard.spec 내부 전용). 저위험.
- **I3/I4 (Testing, QueryFailedError·nested error shape 커버리지 갭)**: 본 PR 무관 **기존** 갭. http-exception.filter 의 409·nested 분기 테스트는 별도 보강 plan.
- **I5/I6 (Testing, `__publicWebhookTrigger` 첨부·makeGuard configService 반환 단언)**: 기존 갭, nice-to-have.
- **I7 (Maintainability, `getActiveExecutionStatus` private 브래킷 접근)**: 본 PR 무관 기존 코드. `ExecutionsService` 공개 메서드화는 별도 리팩터.
- **I8 (Maintainability, `?? undefined` 4회 반복)**: `extractClientIpFromHeaders` 반환형 `string|null`→`string|undefined` 통일 시 제거 가능 — 공유 유틸 시그니처 변경이라 별도 검토(소비자 전수 확인 필요).
- **I9 (Maintainability, 상수명 유사성)**: JSDoc 으로 차이 명시 — 현행 허용.
- **I10 (Testing, env 스냅샷 중복 선언)**: 파일 레벨 헬퍼(`withEnvSnapshot`) 추출은 nice-to-have.
- **side-effect I1 (process.env 참조 교체 방식)**: 대상 함수가 매 호출 동적 read 라 실질 문제 없음(리뷰어도 명시). 후속 `jest.replaceProperty` 검토.
- **impl-done I3/I4/I5 (1-auth §1.5.4 주석·`## Overview (제품 정의)` 헤딩·WH-SC-09 포인터)**: 본 PR 무관 pre-existing. C-scope spec 정리.
- **보안/아키텍처 reviewer 출력 디스크 미기록(워크플로 write 차단)**: 두 reviewer 는 success 반환했으나 output 파일이 디스크에 없어 SUMMARY 미반영. → 본 조치 후 **fresh `/ai-review --route=all`** 로 전 reviewer 재수집(security·architecture 포함)하여 커버리지 보강.

## TEST 결과

- lint·unit·build·e2e(225) 통과 (`*-190930`·`*-191020`·`*-191121`·`*-191311`).
