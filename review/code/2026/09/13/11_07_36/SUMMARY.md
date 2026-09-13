# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 은 0건이나, 이 PR 이 새로 도입한 "노드 종류별 에러 코드 표"가 spec §1.4 카탈로그 대비 5개 실재 코드(그중 둘은 SSRF 방어용 `*_HOST_BLOCKED`)를 누락해 이 PR 자신의 핵심 취지("사용자가 실제로 마주칠 코드를 어디서도 못 찾음")를 한 단계 좁은 스코프에서 재현한다. 강제 화이트리스트(forced) 7개 reviewer 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | 신규 노드-종류별 에러 코드 표가 spec §1.4 카탈로그 대비 5개 실재 코드를 누락 — Database `DB_HOST_BLOCKED`, Email `EMAIL_HOST_BLOCKED`(둘 다 SSRF 방어, 실제 발행·전용 테스트 존재), AI·LLM `MAX_COLLECTION_RETRIES_EXCEEDED`, Sub-workflow 2종(`WORKFLOW_FORBIDDEN_WORKSPACE` 등). 신규 가드는 "가이드→코드 존재"만 검사하고 "코드→가이드 완전성"(누락 방향)은 설계상 검사하지 않아 이 결함을 못 잡는다 | `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx:186-192`, `run-results.en.mdx:174-180` | 5개 코드를 표에 추가해 spec §1.4 와 완전 미러링. 재발 방지를 원하면 `guide-sanitized-message-parity.test.ts` 와 같은 "SoT→표 누락 방향" 양방향 대조를 이 표에도 추가 |
| 2 | requirement, documentation | MakeShop 에러 코드 설명 문장이 실재 11종 중 7종만 나열 — 누락 4종(`MAKESHOP_UNKNOWN_OPERATION`·`MISSING_FIELDS`·`INVALID_SHOP_UID`·`UNRESOLVED_PATH_PARAM`)은 "호출 실패 방식"이 아니라 "요청 구성 사전 검증 실패"라 의도적 curation 일 수 있어 판단이 필요 | `codebase/frontend/src/content/docs/02-nodes/integrations.mdx:301`, `integrations.en.mdx:290` | 의도적 배제라면 그 경계("호출 실패 코드"와 "설정 검증 실패 코드"는 별도)를 문장에 한 줄 명시, 아니라면 11종으로 표 확장 |
| 3 | architecture | 신규 `assertMatchesContract` 계약 검사기는 "선언에 없는 키가 나간다" 방향만 잡고 "선언은 있는데 결코 나가지 않는 키"(유령 필드) 방향은 원리적으로 못 봄 — 바로 이 방향의 결함(`latencyMs`)이 **같은 PR 안에서 서로 다른 두 DTO 에 독립적으로** 발생한 뒤에도 이 비대칭을 구조적으로 닫는 자동 가드는 여전히 없음(현재는 수동 grep 으로만 방어) | `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts:52-56`, `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:459-462` | 이번 스코프는 막을 사유 아님(이미 grep 으로 제거·plan 등재됨). 세 번째 재발 시 DTO 선언 vs 서비스 return 리터럴을 대조하는 정적 스캐너를 백로그에 등재 권고 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability, architecture | 구조적으로 유사한 두 "연결 테스트 결과" DTO(`TestConnectionResultDto` / `ModelTestConnectionResultDto`)가 공용 베이스 없이 독립 존재 — 이번 PR 이 그 대가(동일 유령 필드 `latencyMs` 를 양쪽에서 독립적으로 겪음, shotgun surgery)를 실측으로 치름 | 위 두 DTO 파일 | 즉시 통합 불요. 세 번째 유사 결함 발생 시 공용 `ConnectionTestResultDto` 도입 검토 |
| 2 | maintainability | "`latencyMs` 생산자 0건" 동일 사실이 CHANGELOG 2곳 + 두 DTO 인라인 주석에 사실상 반복 서술 — 향후 정정 시 3~4곳 동기화 필요 | `CHANGELOG.md:25,31`, 두 DTO 파일 주석 | 소스 주석은 1~2줄 요약만 남기고 조사 상세는 CHANGELOG/plan 한 곳으로 유지 |
| 3 | testing | plan 체크리스트의 `.claude/tools/run-test-all.sh` 항목이 미체크 상태 — 표적 `jest`/`vitest` 실행은 전부 GREEN 이나 lint/build/e2e 전체를 종료 코드 기준으로 확인한 명시적 증거는 plan 안에 없음 | `plan/in-progress/guide-error-code-truth.md` 체크리스트 | push 전 `run-test-all.sh` 실행해 체크박스를 실제 상태로 갱신 |
| 4 | testing | `guide-error-code-existence.test.ts` 의 "실재" 판정이 원시 텍스트 스캔이라 주석·죽은 코드에 남은 토큰도 "실재"로 셈 — 오늘 실측상 영향 0이나, 향후 코드 은퇴 시 주석에만 문자열이 남으면 은퇴 코드 재유입을 못 잡는 구조적 사각지대 | `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts:154-165` | 급하지 않음. 파일 상단 트레이드오프 표에 이 축 추가, 또는 코드 은퇴 시 체크리스트에 "주석 잔존 확인" 명시 |
| 5 | performance | 신규 가드(`guide-error-code-existence.test.ts`)가 `backend/src`+`packages` 전체를 동기 `fs.readFileSync` 로 매 테스트 로드마다 전량 스캔 — 기존 `spec-links.ts` 의 스캔과 중복(캐시 미공유). 알고리즘은 선형이라 현재 규모(1,300여 파일)에서 병합 차단 사유는 아님 | `guide-error-code-existence.test.ts:46-51`, `spec-links.ts:463-478` | 후속 가드 추가 전 `walkTree` 결과 모듈 레벨 캐시 공유 리팩터를 근거로 남겨둠(차단 아님) |
| 6 | dependency | `guide-sanitized-message-parity.test.ts` 가 frontend 테스트에서 backend 소스를 import 대신 `fs.readFileSync` 텍스트 스캔으로 읽음(패키지 경계 유지 의도) — soft coupling 이라 파일 이동/개명 시 조용히 무의미해질 수 있으나 vacuity floor 로 방어됨 | `guide-sanitized-message-parity.test.ts` | 없음 — 설계 의도·안전장치 확인됨 |
| 7 | side_effect | `LlmService.testConnection` 의 `error`→`message` 리네임은 저장소 내 소비처와는 정합하나, 저장소 밖 3rd-party API 소비자가 `.error` 를 직접 파싱했다면 이번 변경으로 깨질 수 있음(코드로 완전 배제 불가) | `codebase/backend/src/modules/llm/llm.service.ts` (`testConnection`) | CHANGELOG 가 이미 "⚠️ 배포 시 확인" 으로 명시 고지 — 추가 조치 불요 |
| 8 | testing | UI 실패-토스트 대조군 테스트가 `message` "키 생략"(undefined) 경로만 덮고 DTO 가 허용하는 명시적 `null` 경로는 미커버 — 오늘 프로덕션상 `null` 발행 케이스는 없음 | `model-config-manager.test.tsx` "[대조군]" 케이스 | 필요 시 `message: null` 케이스 한 줄 추가해 `??` 분기 양쪽 고정 |
| 9 | scope | 형제 도메인(Integrations) DTO 까지 손댄 것은 원 트래커 제목("가이드 에러 코드")보다 넓으나, 코드 주석·CHANGELOG(별도 절)·plan(§A~§H) 전 층에서 일관되게 disclosure 됨 | `integration-response.dto.ts`, CHANGELOG | 없음 — 스코프 확장이 은닉되지 않아 차단 사유 아님 |
| 10 | api_contract | Integrations `TestConnectionResultDto` 의 MCP 전용 필드(`capabilities`/`serverInfo`/`preview`)는 여전히 미선언, 성공 경로 계약 배선도 아직 없음 — 이번 PR 스코프 밖이며 plan 에 이미 등재됨 | `integration-response.dto.ts:469-471`, `integrations.service.spec.ts:693-695` | 후속 PR 에서 DTO 신설 + 성공 경로 배선 추적 |
| 11 | requirement | `spec/2-navigation/6-config.md §3` 이 `POST /api/model-configs/:id/test` 실패 응답 shape 을 문서화하지 않는 spec 갭 — developer 권한 밖이라 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 백로그로 정확히 위임됨 | `spec/2-navigation/6-config.md:281` | 없음 — 절차 적절, 병합 후 planner 턴에서 추적 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 필드 rename/제거/추가 전부 정보 노출 관점 안전, `assertMatchesContract` 배선이 오히려 과다노출 방지를 강화 |
| performance | NONE | 실질 코드 변경은 필드 정리 수준, 유일 관찰(가드 중복 스캔)은 기존 관찰의 재확인 |
| architecture | LOW | 유령 필드 방향 계약 검사 비대칭이 같은 PR 에서 2회 재발(WARNING #3), 그 외 직전 라운드 지적 사항 해소 확인 |
| requirement | MEDIUM | 신규 에러 코드 표 자체가 spec 대비 5종 누락(WARNING #1), MakeShop 코드 4종 누락(WARNING #2) |
| scope | LOW | 스코프가 원 트래커보다 넓어졌으나 전 층에서 일관 disclosure, 위반 없음 |
| side_effect | LOW | `error`→`message` rename 의 저장소 밖 3rd-party 영향 가능성(CHANGELOG 로 고지됨) 외 문제 없음 |
| maintainability | LOW | 동일 사실 반복 서술, 두 유사 DTO 의 shotgun-surgery 실증 |
| testing | LOW | 표적 테스트 전부 GREEN 실측 확인, run-test-all.sh 체크 미완료 등 경미한 갭 |
| documentation | NONE | 정량 주장 전수 재검증 일치, MakeShop 목록 완결성 여지(INFO)만 |
| dependency | NONE | 신규 외부 의존성 0건, soft coupling 은 안전장치 있음 |
| database | NONE | DB 관련 코드 변경 없음 |
| concurrency | NONE | 동시성 상태를 다루는 변경 없음 |
| api_contract | NONE | 직전 라운드 WARNING(형제 엔드포인트 `code` 미선언) 해소 확인, 잔여 갭은 스코프 밖·등재됨 |
| user_guide_sync | NONE | 매트릭스 4개 trigger 전부 같은 changeset 내 동반 갱신 완료 확인 |

## 발견 없는 에이전트

database, concurrency, user_guide_sync (해당 없음/발견 없음으로 명시 판정)

## 권장 조치사항

1. `run-results{,.en}.mdx` 노드-종류별 에러 코드 표에 누락된 5개 실재 코드(`DB_HOST_BLOCKED`, `EMAIL_HOST_BLOCKED`, `MAX_COLLECTION_RETRIES_EXCEEDED`, Sub-workflow 2종)를 추가해 spec §1.4 와 완전히 미러링한다 (developer 권한 내, `codebase/frontend/**`).
2. MakeShop 에러 코드 설명 문장의 4종 누락이 의도적 curation 인지 판단하여, 의도적이면 경계를 한 줄 명시하고 아니면 11종으로 확장한다.
3. `assertMatchesContract` 가 못 잡는 "유령 필드"(선언은 있으나 미발행) 방향의 재발이 이미 같은 PR 안에서 2회 있었다는 점을 plan 백로그에 등재하고, 세 번째 재발 시 정적 스캐너 도입을 검토한다.
4. push 전 `.claude/tools/run-test-all.sh` 를 이 changeset 기준으로 실행해 plan 체크박스를 실제 상태로 갱신한다.
5. (급하지 않음) CHANGELOG/DTO 주석의 "latencyMs 생산자 0건" 반복 서술을 한 곳으로 정리, 두 유사 DTO 의 공용 베이스 도입은 세 번째 재발 시 재검토.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 전체 14개 reviewer 실행.
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음).
- **실행**: 전체 14명 (security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync)
- **제외**: 없음