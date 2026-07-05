# Rationale 연속성 검토 결과

검토 대상: `spec/4-nodes/4-integration/` (특히 `1-http-request.md` §8.3 신설, `2-database-query.md` Rationale 갱신) — impl-done 모드, diff-base `origin/main`, HEAD 워크트리 `/Volumes/project/private/clemvion/.claude/worktrees/ssrf-error-generalize-7e1091`.

## 발견사항

검토 관점 1~4 (기각된 대안 재도입 / 합의 원칙 위반 / 무근거 번복 / 암묵적 가정 충돌) 전체에 대해 분석한 결과, target 변경분에서 문제로 지목할 항목을 찾지 못했다. 근거는 다음과 같다.

- **[INFO] 이번 변경은 과거 Rationale 이 예고한 후속 작업의 정식 이행** — 오히려 연속성이 강화된 사례
  - target 위치: `spec/4-nodes/4-integration/1-http-request.md` §8.3 (신설), `2-database-query.md` `## Rationale` → `DB_HOST_BLOCKED` 항목 메시지 일반화 문단
  - 과거 결정 출처: `spec/4-nodes/4-integration/2-database-query.md` `## Rationale` § `DB_HOST_BLOCKED` 전용 SSRF 차단 코드 신설(2026-06-12) — 변경 전 문구가 "동일 원칙을 HTTP/Email SSRF 메시지 일반화 follow-up 과 공유한다" 로 **HTTP/Email 이 아직 일반화되지 않았음을 명시적으로 예고**하고 있었다.
  - 상세: 이번 변경(`1-http-request.md §8.3`, 코드 `http-request.handler.ts`)은 그 예고된 follow-up 을 그대로 이행한 것이다 — `HTTP_BLOCKED` 의 `output.error.message` 를 `DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED` 와 동일하게 host/IP 미노출 일반화 문구로 통일하고, `database-query.md` 쪽 Rationale 도 "HTTP 는 2026-07-05 동일 일반화 완료" 로 대칭 갱신했다. 과거 Rationale 이 참조한 대상 문서(`1-http-request.md`)의 앵커까지 정확히 갱신됨.
  - 검증: `git diff origin/main` 확인 결과 코드(`http-request.handler.ts`)의 `SSRF_BLOCKED_CLIENT_MESSAGE = 'Request blocked by SSRF policy.'` 상수 도입, `logger.warn` 을 통한 원본 상세 서버 로그 보존, Usage 로그 message 도 일반화 적용, redirect hop SSRF 를 `IntegrationError(HTTP_BLOCKED)` 로 승격해 바깥 catch 에서 `HTTP_TRANSPORT_FAILED`/`EMAIL_SEND_FAILED` 류로 오분류되지 않도록 한 부분이 모두 spec 서술과 1:1 대응한다. `http-safety.ts` 의 원본 메시지 포맷(`SSRF_BLOCKED: hostname "..." resolves to a restricted network range`)도 실재해 §8.3 "문제" 서술이 근거 있음을 확인.
  - 제안: 조치 불필요. 참고로 향후 유사 "예고형 Rationale"(과거 문서가 미래 변경을 예고하는 패턴)을 남길 때 이번처럼 이행 완료 시점에 예고 문구를 대칭 갱신하는 관행을 유지할 것.

- **[INFO] D4/§8.2 의 기존 invariant 와 완전히 정합**
  - target 위치: `1-http-request.md` §6 에러 코드 표 (`HTTP_BLOCKED (D4)` 행), §8.3
  - 과거 결정 출처: `1-http-request.md` §8.2 "SSRF 가드 전 인증 방식 적용"(2026-06-11), §4 SSRF opt-out callout(`ALLOW_PRIVATE_HOST_TARGETS`), D4 결정("모든 실패는 `port:'error'` 로 라우팅, throw 경로 폐기")
  - 상세: §8.3 은 (a) SSRF 가드 적용 범위(전 인증 공통)를 그대로 유지, (b) `ALLOW_PRIVATE_HOST_TARGETS` opt-out 플래그를 신설하지 않고 재사용, (c) D4 의 "모든 실행 실패는 `error` 포트로" 라우팅 모델을 유지한 채 redirect hop SSRF 의 오분류만 정정 — 기존에 D4/§8.2 가 확립한 어떤 원칙도 뒤집지 않고 그 위에 메시지 노출 정책만 추가했다. `기각된 대안` 섹션(`output.error.details` 로 옮기는 안, message 를 빈 문자열로 두는 안)도 실질적 근거와 함께 명시되어 판단 과정이 투명하다.
  - 제안: 없음.

- **[INFO] DB/Email 대칭성 확인 — 기존 코드명·플래그 원칙 재사용**
  - target 위치: `2-database-query.md` `## Rationale` (`DB_HOST_BLOCKED` 항목), `1-http-request.md` §8.3
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` `## Rationale` § "SMTP SSRF 가드를 http/db 와 동일 `ALLOW_PRIVATE_HOST_TARGETS` 로 통일"
  - 상세: 세 노드(HTTP/DB/Email) 모두 동일 플래그·동일 메시지 일반화 원칙을 공유한다는 기존 합의가 이번 변경으로 완성됐다(이전엔 HTTP 만 원본 노출로 비대칭). 별도 플래그·별도 코드 체계를 신설하지 않고 기존 명명 규칙(`{DOMAIN}_HOST_BLOCKED`/`HTTP_BLOCKED`) 을 그대로 따름 — 합의된 원칙(§Rationale "노드별로 플래그가 갈리는 혼란을 막는다")을 위반하지 않는다.
  - 제안: 없음.

## 요약

target 변경(`spec/4-nodes/4-integration/1-http-request.md` §8.3 신설 및 `2-database-query.md` Rationale 대칭 갱신, 대응 코드 `http-request.handler.ts`)은 Rationale 연속성 관점에서 문제가 없다. 오히려 이번 변경은 `2-database-query.md` 의 과거 Rationale(2026-06-12) 이 명시적으로 "HTTP/Email SSRF 메시지 일반화는 follow-up" 이라 예고해 둔 부채를 정확히 그 예고대로 상환한 사례이며, D4/§8.2 가 확립한 기존 invariant(전 인증 공통 SSRF 가드, `ALLOW_PRIVATE_HOST_TARGETS` 단일 플래그, D4 error-port 라우팅 모델)를 하나도 위반하지 않고 그 위에 메시지 노출 정책(정찰 면 축소)만 추가했다. 기각된 대안(`output.error.details` 이동, 빈 message)도 근거와 함께 명시돼 있어 결정 과정이 투명하다. 관련 문서 간 상호 참조(앵커 포함)도 양방향으로 정확히 갱신되었다.

## 위험도

NONE
