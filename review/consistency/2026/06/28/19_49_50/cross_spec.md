# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/webhook-spec-pointer-cleanup.md`
검토 모드: `--spec`
검토 일시: 2026-06-28

---

## 발견사항

### 발견사항 없음 — 충돌 없음

P-1, P-2, P-3, P-4 의 각 변경이 기존 spec 과 충돌하는지 항목별로 검토한 결과:

**P-1 `spec/5-system/2-api-convention.md §5.3` — CWE-209 echo 금지 포인터 추가**
- target 위치: `api-convention.md §5.3 에러 응답`
- 충돌 대상 후보: `spec/5-system/3-error-handling.md §1.3`
- 상세: CWE-209 echo 금지 규칙은 이미 `error-handling.md §1.3 PAYLOAD_TOO_LARGE` 항목과 `error-handling.md Rationale §4xx http-error message 고정 문구` 절에 SoT 로 선명하게 기술돼 있다. `api-convention.md §5.3` 에는 현재 해당 규칙 언급이 없으므로, 이 절에서 `error-handling §1.3` 을 단방향 포인터로 가리키는 것은 두 문서 사이의 정보 중복이나 모순을 만들지 않는다. INFO 급 동기화 강화이며 충돌 없음.

**P-2 `spec/7-channel-web-chat/4-security.md §4 + R3` — Guard 의 trigger DB 조회 실패 시 fail-open + error 레벨 로깅 언급 추가**
- target 위치: `4-security.md §4` 및 `R3`
- 충돌 대상 후보: `spec/5-system/12-webhook.md §6`(구현 파일 구조)·`§Rationale "공개 webhook throttle Guard — 조회 실패 시 fail-open + error 로깅"`
- 상세: `12-webhook.md §6` 에 이미 "Guard 의 trigger 조회 실패 시에도 fail-open(통과)하되, 이는 공개 webhook 보호를 일시 무력화하므로 `error` 레벨로 로깅해 장기 DB 장애로 인한 보호 우회 지속을 모니터링이 조기 탐지하게 한다"고 명시돼 있다. `Rationale §공개 webhook throttle Guard — 조회 실패 시 fail-open + error 로깅` 절도 전체 근거를 서술한다. `4-security.md §4 blockquote` 는 현재 "Redis 미가용 시 fail-open"만 기술하고 DB 조회 실패 경로를 누락하고 있으므로, 여기에 "trigger DB 조회 실패 시에도 동일하게 fail-open + error 로그" 를 추가하는 것은 `12-webhook.md §6` SoT 의 역참조로서 일관성을 높이는 INFO 급 동기화다. 모순 없음.
- 주의: `4-security.md §4` 는 SoT 가 아니라 `12-webhook.md §6` 이 SoT 다(plan 본문 "SoT 는 12-webhook §6"). 따라서 `4-security.md §4` 의 기술이 `12-webhook.md §6` 의 정책을 넘어서거나 달리 기술하면 모순이 되므로, 추가 문구가 SoT 의 범위 안에서만 요약해야 한다. plan 에 기술된 변경 내용("Guard 의 trigger DB 조회 실패 시에도 동일하게 적용되며 error 레벨 로깅으로 모니터링한다")은 `12-webhook.md §6` 의 내용을 그대로 요약하므로 충돌 없음.

**P-3 `spec/5-system/1-auth.md Rationale 2.3.B m-3` — `extractClientIpFromHeaders` 함수명·경로 명시 + `12-webhook.md §7e·§8b` 역참조 링크 추가**
- target 위치: `1-auth.md Rationale 2.3.B m-3` 와 `12-webhook.md §7e·§8b`
- 충돌 대상 후보: `spec/5-system/1-auth.md §2.3 클라이언트 IP 행`, `spec/1-data-model.md Execution §source_ip`, `spec/2-navigation/6-config.md §소스 IP 캡처 경로`
- 상세: `1-auth.md §2.3 클라이언트 IP` 테이블 행은 이미 `extractClientIpFromHeaders` 직접 호출과 `auth/utils/client-ip.ts`(`extractClientIp`) 를 구분해 기술하며 "Rationale 2.3.B" 를 참조 키워드로 언급한다. `1-data-model.md §2.18 Execution.source_ip` 와 `6-config.md §소스 IP 캡처 경로` 모두 `extractClientIpFromHeaders` 를 명칭으로 사용하고 `1-auth.md §2.3·Rationale 2.3.B` 를 역참조하거나 동일 규칙을 서술한다. plan 이 추가하려는 내용(함수명 `extractClientIpFromHeaders`(`auth/utils/client-ip.ts`) 명시 + `12-webhook.md §7e·§8b` 에서 `1-auth Rationale 2.3.B m-3` 역참조 링크)은 이미 분산 기술된 사실을 명문화·링크화하는 것이다. 기존 어느 spec 의 정의와도 모순되지 않는다. 충돌 없음.
- 추가 확인: `12-webhook.md §7` 처리 흐름 step 8b(기존 경로, `extractClientIpFromHeaders 결과 — 인증 IP whitelist 검증과 공용`) 에는 현재 `1-auth` 역참조가 없고 `6-config.md §A.3` 만 링크된다. 역참조 링크 추가는 INFO 급 개선이며 모순 없음.

**P-4 `spec/5-system/3-error-handling.md` — `## Overview` 절 추가**
- target 위치: `3-error-handling.md` 서두
- 충돌 대상 후보: `spec/0-overview.md §8 문서 컨벤션`, CLAUDE.md 3섹션 구성 규약
- 상세: `spec/0-overview.md §8` 컨벤션은 "단일 spec 파일 영역(예: webhook, graph-rag)은 본문 상단에 `## Overview (제품 정의)` 섹션을 직접 둔다"라고 기술한다. `3-error-handling.md` 는 단독 파일 영역 spec 이며 현재 `## Overview` 절이 없어(첫 섹션이 바로 `## 1. 에러 분류`) 컨벤션 미준수 상태다. Overview 절을 추가하는 것은 컨벤션과 일치하게 만드는 교정이며 다른 spec 과 충돌하지 않는다. 충돌 없음.

---

## 요약

`plan/in-progress/webhook-spec-pointer-cleanup.md` 가 명시한 P-1~P-4 의 spec 변경은 모두 기존 `spec/**` 의 정의와 직접 모순되지 않는다. P-1 은 `api-convention §5.3` 에 없는 CWE-209 포인터를 `error-handling §1.3` SoT 로 연결하는 INFO 급 동기화이고, P-2 는 `web-chat/4-security §4` 의 fail-open 기술이 `12-webhook §6` SoT 의 DB 조회 실패 경로를 누락한 부분을 보완하는 역참조이며, P-3 은 이미 여러 spec 에 분산 서술된 `extractClientIpFromHeaders` 규칙을 `1-auth Rationale 2.3.B m-3` 에서 명시화하고 `12-webhook §7e·§8b` 에서 역참조 링크를 추가하는 명문화 작업이고, P-4 는 `3-error-handling.md` 에 컨벤션이 요구하는 `## Overview` 절이 없는 사전(pre-existing) 결손을 교정하는 것이다. 네 변경 모두 단방향 포인터·역참조·절 보강에 그치고 SoT 신설이 없으므로 데이터 모델·API 계약·상태 전이·RBAC 모델 어느 관점에서도 충돌이 발생하지 않는다.

---

## 위험도

NONE
