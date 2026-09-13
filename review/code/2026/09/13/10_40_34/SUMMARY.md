# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 3건은 전부 "이번 PR 이 처리한 핵심 결함(3층 필드명 불일치)"이 아니라 그 처리 과정에서 함께 건드린 **형제 도메인(Integrations `TestConnectionResultDto`)의 후속 정리 미흡**에 관한 것으로, 병합을 막을 사유는 아니다. router 는 이번 세션에서 미사용(`routing=skipped`)이었고, forced(router_safety) 지정 7개 reviewer(documentation, maintainability, requirement, scope, security, side_effect, testing) 를 포함해 **14개 reviewer 전원이 정상 실행되어 결과를 확보**했다 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | scope / documentation | 라운드 1 지적(api_contract) 대응으로 `TestConnectionResultDto`(Integrations 도메인)에 `code` 필드 신설 + `meta` 필드 제거가 추가됐는데, CHANGELOG 의 "⚠️ 배포 시 확인 — 응답에서 사라지는 필드" 절(제목이 "필드 **2종** 제거"로 못박혀 있음)이 `meta` 제거를 누락한다 | `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (게이트 460~490행), `CHANGELOG.md` (게이트 19~26행) | CHANGELOG 해당 절 제목·목록에 `meta` 제거(및 `code` 신설)를 추가하거나 "라운드 2 에서 형제 엔드포인트로 범위가 확장됐다"는 한 줄을 보강 |
| 2 | testing | 같은 형제 DTO(`TestConnectionResultDto`, integrations)의 `code` 신규 선언·`meta`/`latencyMs` 제거에 대해, 이 PR 이 LLM 쪽(`ModelTestConnectionResultDto`)에 정확히 배선한 것과 같은 급의 런타임 계약 검사(`assertMatchesContract`)가 없다 — 이 필드가 다시 어긋나도 이 스위트는 계속 GREEN | `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (`TestConnectionResultDto`), `codebase/backend/src/modules/integrations/integrations.service.ts` (`testConnection`) | `integrations.service.spec.ts` 또는 신규 `integrations.controller.spec.ts` 에 `assertMatchesContract(result, await contractForDto(TestConnectionResultDto))` 최소 1곳 배선. plan 후속 항목으로 등재 적합 |
| 3 | user_guide_sync | 이번 라운드가 신설한 두 번째 가드(`guide-sanitized-message-parity.test.ts`)가, 이미 존재하던 planner 백로그 항목("`user-guide-evidence.md §2.1` 관계표에 새 가드가 빠져 있다" — 첫 번째 가드 `guide-error-code-existence.test.ts` 만 지목)에 반영되지 않았다. planner 가 그 노트만 보고 처리하면 관계표에 가드 1건이 빠진 채 등재된다(3건→5건이어야 하는데 4건으로 마감될 위험) | `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts` (신규), `plan/in-progress/spec-draft-nullable-notation-followups.md` (~3234행) | 같은 PR 안(developer 쓰기 권한 범위인 `plan/**`)에서 그 백로그 항목 본문에 `guide-sanitized-message-parity.test.ts` 를 병기하고 "가드 2건 등재 대상"으로 갱신 |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/2-navigation/6-config.md §3`(및 `spec/5-system/7-llm-client.md`)이 `POST /api/model-configs/:id/test` 의 **실패** 응답 shape(`{ success:false, message }`)을 문서화하지 않는다 — 성공 케이스만 표에 있다. 코드는 이미 `message` 필드로 정정됐고 `assertMatchesContract` 로 런타임 고정됐으므로 코드가 맞고 spec 표만 낡은 상태다 | `spec/2-navigation/6-config.md` §3 표 (281행 부근) | developer 권한 밖 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 명의 항목으로 정확히 등재됨. planner 턴에서 표에 실패 shape(`message`, 8갈래 고정 문장 SoT = `sanitize-error.util.ts`) 반영 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `testConnection` 실패 응답이 `message` 로 처음 사용자에게 노출되지만, `sanitizeLlmErrorMessage` 는 8갈래 고정 문구만 반환해 provider 원문·API 키·내부 엔드포인트가 새로 유출되지 않음(직접 확인) | `codebase/backend/src/modules/llm/llm.service.ts:352-354`, `sanitize-error.util.ts` | 없음 |
| 2 | performance | 신규 가드(`guide-error-code-existence.test.ts`)가 backend+packages 전체(1,354파일)를 매 테스트 실행마다 동기 로드하는데, **이미 동일 디렉터리를 독립적으로 재순회하는 자매 가드**(`spec-link-integrity.test.ts`/`spec-links.ts::collectCodebaseSources`)가 존재함을 실측 확인 — 캐싱 부재로 최소 2회 중복 I/O | `guide-error-code-existence.test.ts:46-49`, `spec-links.ts:462-478` | 지금 규모에서 블로킹 아님. 후속 가드 추가 전 `walkTree` 결과를 모듈 레벨 캐시로 공유하는 정리 고려 |
| 3 | architecture | 라운드 1 이 지적한 아키텍처 갭 2건(문구 정확성 무가드, 형제 DTO `code` 미선언)이 각각 양방향 parity 가드·DTO 필드 백필로 해소됨을 확인. 서비스 반환 타입과 OpenAPI DTO 가 타입 수준 통합 대신 런타임 계약 검사로 묶인 것은 이 저장소가 실측 끝에 선택한 의도된 트레이드오프 | `guide-sanitized-message-parity.test.ts`, `integration-response.dto.ts` | 없음 |
| 4 | testing | `message: null` 경계값(DTO 는 `nullable: true` 로 허용)이 UI 토스트 테스트 어디에도 명시적으로 단언되지 않음(`??` 처리상 안전할 가능성 높으나 대조군 없음) | `model-config-manager.test.tsx` | 급하지 않음 — 원하면 `message: null` 케이스 대조군 추가 |
| 5 | documentation | 라운드 1(`10_12_19`) maintainability WARNING#1("근거 주석이 함수 시그니처를 끊는 자리에 있다")을 이번 라운드가 재확인한 결과 **부정확한 서술**이었음(실제로는 JSDoc 블록 안, 정상 leading 위치) — 리뷰 산출물 자체의 위치 인용 오류 사례로 기록 | `llm.service.ts:299-326` | 후속 검토자는 이 과거 WARNING 을 근거로 재작업하지 말 것 |
| 6 | requirement | `ModelTestConnectionResultDto.message` 가 `nullable: true` 로 선언돼 있으나 서비스는 `message` 를 절대 `null` 로 채우지 않음(§5.4 판정표상 위반 아님, 기존 상태 유지) | `model-config-response.dto.ts:57` | 블로킹 아님, 이번 배치 스코프 밖 |
| 7 | dependency | `package.json`/lockfile 변경 0건, 신규 외부 의존성 0건 — 신규 파일이 쓰는 모든 심볼은 기존 설치 패키지 또는 diff 밖 기존 내부 모듈 재사용 | 저장소 루트 (`git diff --stat`) | 없음 |
| 8 | scope | 이번 라운드의 Integrations DTO 확장(`code`/`meta`)은 원 스토리(LLM 도메인)가 받은 것과 같은 급의 테스트 보강 없이 이뤄졌으나, 백로그에 "assertMatchesContract 배선" 이 이미 후속 할 일로 명시돼 은닉되지 않음(WARNING#2 와 동일 근거, 중복 기록) | `integration-response.dto.ts` | 없음 — WARNING#2 참고 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | provider 원문 미노출 확인, 인가 메타데이터 불변 확인 |
| performance | NONE | 필드 rename/제거뿐, 알고리즘 영향 없음. 신규 가드 중복 I/O 는 INFO |
| architecture | LOW | 라운드1 아키텍처 갭 2건 해소 확인, 새 결함 없음 |
| requirement | NONE | 핵심 결함 정정 검증 완료, SPEC-DRIFT 1건 절차상 정상 위임 |
| scope | LOW | CHANGELOG 가 `meta` 필드 제거 고지 누락(WARNING) |
| side_effect | LOW | 응답 shape 변경이나 소비처 전수 확인·CHANGELOG 고지로 커버됨 |
| maintainability | NONE | 라운드1 WARNING 2건 해소 확인, carry-over INFO만 |
| testing | LOW | 66/66, 54/54 GREEN 실측. 형제 DTO 계약 테스트 미배선(WARNING) |
| documentation | NONE | 라운드1 문서 WARNING 전부 해소 확인, 8갈래 문장 글자 단위 일치 재검증 |
| dependency | NONE | 신규 외부 의존성 0건 |
| database | NONE | 해당 없음 — DB 관련 코드 변경 0건 |
| concurrency | NONE | 해당 없음 — 병렬/공유상태/락 변경 0건 |
| api_contract | NONE | 라운드1 WARNING(형제 DTO `code` 미선언) 해소 재확인 |
| user_guide_sync | LOW | MDX ko/en 쌍·에러코드 전수 정합 확인. 신규 가드 백로그 미반영(WARNING) |

## 발견 없는 에이전트

database, concurrency — 이번 diff 범위에 해당 관심사(DB/동시성) 코드 변경이 없음("해당 없음"으로 명시 처리).

## 권장 조치사항

1. `integrations` 도메인의 `TestConnectionResultDto` 에 `assertMatchesContract` 계약 테스트를 최소 1곳 배선한다 (WARNING #2) — LLM 도메인과 동일한 회귀 방지 수준을 형제 엔드포인트에도 적용.
2. `CHANGELOG.md` 의 "배포 시 확인 — 응답에서 사라지는 필드" 절에 `meta` 필드 제거를 추가 기재한다 (WARNING #1).
3. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 기존 백로그 항목 본문을 갱신해 `guide-sanitized-message-parity.test.ts` 를 함께 등재 대상으로 병기한다 (WARNING #3) — developer 쓰기 권한 범위 내에서 지금 처리 가능.
4. (planner 턴, 비블로킹) `spec/2-navigation/6-config.md §3` 표에 `testConnection` 실패 응답 shape(`message`)를 반영해 SPEC-DRIFT 를 닫는다.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용. forced(router_safety) 지정 7개 reviewer(documentation, maintainability, requirement, scope, security, side_effect, testing) 포함 **전체 14개 reviewer 실행**됨, 전원 결과 확보 확인.