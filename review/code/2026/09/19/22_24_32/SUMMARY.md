# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, WARNING 1건(트래커 문서의 미래 시점 경로 인용, 3회째 재발 패턴). 기능적 결함·회귀 없음. 3라운드 누적 리뷰이며 1·2라운드가 지적한 항목은 모두 코드 대조로 해소가 확인됐다. forced 화이트리스트(documentation, maintainability, requirement, scope, security, side_effect, testing) 7명 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation / Maintainability | 이번 라운드가 새로 등재한 트래커 항목이 아직 `plan/complete/`로 옮겨지지 않은 `plan/in-progress/ssrf-guard-integration-unify.md`를 `plan/complete/ssrf-guard-integration-unify.md`로 현재형 인용한다. 같은 클래스의 결함("아직 참이 아닌 상태를 현재형으로 서술")이 이 PR에서 1·2라운드에 이어 3번째로 재발(이전엔 `http-safety.ts` JSDoc의 "트래커에 따로 있다" 단언). 그 plan 자신의 체크리스트도 `/ai-review` 수렴·`--impl-done`·`plan/complete/` 이관 항목을 전부 `[ ]` 미완료로 남겨둔 상태다. | `plan/in-progress/spec-draft-nullable-notation-followups.md` 게이트 4892 | plan이 실제로 `plan/complete/`로 이관되기 전까지는 `plan/in-progress/ssrf-guard-integration-unify.md`(정확한 현재 경로)로 인용하거나 "마무리 커밋에서 이관 예정"처럼 예정형으로 수정. 그 plan을 닫는 마무리 커밋(트래커 두 항목 해소 커밋)에서 함께 정정하면 비용 최소. 병합 차단 사유 아님. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | SMTP usage 로그의 `api.path` 필드가 가드 판정과 무관하게 실제 host(차단된 사설/CGNAT 주소 포함)를 그대로 담아 `IntegrationUsageLog`/Activity API로 노출된다. 이번 diff가 만든 회귀가 아니라 기존(이월) 동작이며, `SSRF_BLOCKED_CLIENT_MESSAGE`의 CWE-209 방어("에러 메시지에 host 미노출")와는 별개 채널이다. | `codebase/backend/src/nodes/integration/send-email/send-email.handler.ts:167,215,240` | 이번 PR 스코프 밖. 후속으로 "가드가 차단한 요청"에 한해 `api.path`도 마스킹할지 제품/트래커 판단 필요. |
| 2 | Security | NAT64/SIIT/6to4 등 IPv4-embedded IPv6 표기는 의도적으로 미차단 — 실제 NAT64 게이트웨이가 있는 배포 환경에서는 우회 가능성 존재. plan·1라운드 RESOLUTION(W3)이 이미 실측·의도된 범위로 문서화. | `codebase/backend/src/nodes/integration/http-request/http-safety.ts` `mappedIPv4` | 조치 불요(트래커 인지·의도적 범위). self-host 배포 가이드의 "egress 방화벽이 최종 방어선" 문구가 이 케이스도 포함함을 재확인 권장. |
| 3 | Architecture / Side Effect / Testing | 리뷰 진행 중 이 워크트리의 `http-safety.ts`가 **다른 병렬 리뷰 세션**에 의해 커밋되지 않은 상태로 일시 변경되는 것이 관측됐다(CGNAT 상한 `100.127.255.255`→`100.126.255.255`, boundary mutation 검증으로 추정). 이 리뷰들 자신은 `git checkout`/`restore`로 원복하지 않았고, 보고서 마무리 시점엔 이미 다른 세션이 자체 원복해 clean 상태였다. 이번 PR의 결함이 아니다. | `codebase/backend/src/nodes/integration/http-request/http-safety.ts` (`PRIVATE_V4_RANGES` CGNAT 항목) | **통합 조율자는 병합 직전 `git diff origin/main -- <path>`로 CGNAT 상한이 `100.127.255.255`로 남아있는지 최종 재확인할 것.** |
| 4 | Architecture | `SsrfBlockedError` instanceof 판별 계약이 5개 소비자 중 `smtp-host-guard.ts` 1곳에만 적용됨(나머지 4곳은 blanket catch) — 2라운드 RESOLUTION이 동작 회귀 없음을 근거로 "수렴 예외"로 명시 처리, 트래커(`spec-draft-nullable-notation-followups.md` 게이트 4903~4907)에 등재 완료. 재지적 아님, 확인 기록. | `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:352`, `http-redirect.ts:24-29`, `database-query.handler.ts`, `database-connection-tester.ts` | 조치 불요 — 처분된 결정 유지. |
| 5 | Testing | CGNAT 상한 경계(`100.127.255.255`) 회귀 테스트가 대역표를 소유한 `http-safety.spec.ts`가 아니라 소비자 파일 `smtp-host-guard.spec.ts`에만 있다. 뮤테이션(상한을 1 낮춤)으로 실측 확인 — `smtp-host-guard.spec.ts`만 RED, `http-safety.spec.ts`는 54/54 GREEN(간접 경로로는 지금도 잡힘). `http-safety.spec.ts`만 실행하는 향후 타겟 테스트에서는 조용히 통과할 수 있음. | `codebase/backend/src/nodes/integration/http-request/http-safety.ts`(`PRIVATE_V4_RANGES`), 대응 테스트 `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.spec.ts` | `http-safety.spec.ts`의 `'public IP는 통과'` 대조군에 `100.127.255.255`(차단)/`100.128.0.0`(통과) 쌍 추가 권장. 차단 사유 아님. |
| 6 | API Contract | `testEmailTransport`의 `isSmtpHostBlocked` 호출이 여전히 try/catch 밖(1·2라운드부터 잔존) — `SsrfBlockedError`가 아닌 오류가 나면 `preview-test`/`:id/test` 응답이 구조화된 `{success:false,code,message}` 대신 미처리 500으로 나갈 이론적 지점. `send-email.handler.ts` 발송 경로는 넓은 try 안이라 이 비대칭이 연결 테스트 경로에만 있음. | `codebase/backend/src/modules/integrations/integrations.service.ts` (`testEmailTransport`) | 이번 PR 스코프 밖(1·2라운드와 동일 결론). 후속으로 발송 경로처럼 넓은 try로 감싸는 것을 권장, 재조치 요구 아님. |
| 7 | API Contract | CGNAT·IPv4-mapped host를 쓰던 기존 통합이 조용히 차단 전환되는 하위호환 변화 — `CHANGELOG.md`·`.env.example`에 이미 문서화(opt-out `ALLOW_PRIVATE_HOST_TARGETS=true` 안내 포함), 에러 코드·응답 봉투 불변. | `CHANGELOG.md`, `codebase/backend/.env.example:368-372` | 조치 완료 상태 유지, 추가 조치 불요. |
| 8 | User Guide Sync | `EMAIL_HOST_BLOCKED`가 `ERROR_KO` 매핑에 없음 — 기존(이번 PR 무관) 갭이며, `translateBackendError`의 프로덕션 호출부가 0건이라 매핑을 추가해도 사용자 화면에 영향 없음(트래커 기존 항목으로 이미 처분). | `codebase/frontend/src/lib/i18n/backend-labels.ts` | 조치 불요. |
| 9 | Scope / Side Effect | 문서(`.mdx` ko/en) 갱신, `backend-typecheck-baseline.json`(197→194) 변경, `spec-draft-nullable-notation-followups.md` 트래커 4항목 추가는 plan 본문에 직접 명시되진 않았으나 모두 1·2라운드 리뷰 WARNING에 대한 조치 또는 harness 표준 산출물로 확인됨 — 범위 이탈 아님. | `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management*.mdx`, `scripts/backend-typecheck-baseline.json`, `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요. |
| 10 | Requirement | spec(`2-navigation/4-integration.md` §5.5, 각 노드 spec §4/§8)과 line-level 대조 결과 에러 코드·opt-out 플래그·차단 대역·클라이언트 메시지 정책 모두 일치. spec이 옳고 코드가 그에 미달했던 것을 이번 PR이 바로잡은 사례(SPEC-DRIFT 아님, 코드 버그 수정 방향). | `spec/4-nodes/4-integration/{1-http-request,2-database-query,3-send-email}.md` ↔ 구현 | `spec_impact: none` 타당, 조치 불요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | usage 로그 host 노출(기존 동작)·NAT64 미차단(의도된 범위) INFO 2건, Critical/Warning 없음 |
| architecture | NONE | 병렬 세션 뮤테이션 일시 관측(원복 확인)·수렴 예외 재확인 INFO, 신규 순환/구조 위반 없음 |
| requirement | NONE | 1·2라운드 조치 전량 반영 확인, spec line-level 일치, 226 테스트 GREEN |
| scope | NONE | 54개 파일 diff 전부 plan 4항목+리뷰 조치에 대응, 범위 이탈 없음 |
| side_effect | LOW | 병렬 세션 CGNAT 상한 일시 변경 관측(원복 필요 없음, 병합 전 재확인 권고)이 LOW 판정 근거 |
| maintainability | NONE | 1·2라운드 WARNING 전부 해소 확인, 트래커 미래 경로 인용은 documentation WARNING과 중복 |
| testing | NONE | CGNAT 경계 테스트 소유권 갭(INFO, 기능적으론 간접 커버됨), 226 테스트 GREEN 재확인 |
| documentation | LOW | 트래커 항목의 `plan/complete/` 미존재 경로 현재형 인용(WARNING, 3회째 재발 패턴) |
| api_contract | LOW | 하위호환 차단 전환(문서화 완료)·try/catch 밖 가드 호출(잔존 INFO) |
| user_guide_sync | NONE | 유일 매칭 트리거(`integration-provider-change`)의 문서 갱신이 이미 diff에 포함, 갭 없음 |

## 발견 없는 에이전트

해당 없음 — 10개 에이전트 전원이 최소 1건 이상의 INFO/WARNING을 보고했다(순수 "문제 없음" 판정만 낸 에이전트는 없음).

## 권장 조치사항

1. `plan/in-progress/spec-draft-nullable-notation-followups.md` 게이트 4892의 `plan/complete/ssrf-guard-integration-unify.md` 인용을 현재 경로(`plan/in-progress/...`) 또는 예정형 문구로 정정 — 그 plan을 `complete/`로 이관하는 마무리 커밋에서 함께 처리 가능(WARNING #1).
2. 병합 직전 `codebase/backend/src/nodes/integration/http-request/http-safety.ts`의 CGNAT 상한(`100.127.255.255`)이 최종 커밋에 그대로인지 재확인 — 리뷰 중 다른 병렬 세션의 일시적 뮤테이션이 관측됐었다(INFO #3, 통합 조율자 액션).
3. (선택, 비차단) `http-safety.spec.ts`에 CGNAT 경계 대조 쌍(`100.127.255.255`/`100.128.0.0`) 추가해 대역표 소유 파일 자체의 테스트 판별력 확보(INFO #5).
4. 나머지 INFO 항목은 전부 조치 불요로 이미 확인됨(기존 이월 동작이거나 문서화된 의도적 범위).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 누락 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff와 무관 |
  | dependency | router 판단상 이번 diff와 무관 |
  | database | router 판단상 이번 diff와 무관 |
  | concurrency | router 판단상 이번 diff와 무관 |
