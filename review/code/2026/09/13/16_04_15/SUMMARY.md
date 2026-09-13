# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. 신규 코드(`guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`, 유저 가이드가 인용하는 UPPER_SNAKE 식별자의 실재성 검증용 vitest 정적 스캐너)는 순수 함수·동기 파일 읽기로만 구성돼 보안·DB·동시성·API 계약·의존성 관점에서 위험이 없다. 남은 WARNING 4건은 전부 이 가드 자신의 정밀도·자기검증·트래킹 문서 갱신에 관한 것으로 프로덕션 동작에는 영향이 없다. forced 화이트리스트 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 강제 목록 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `CODE_FIELD` 축의 왼쪽 경계 `(?<![A-Za-z])`가 알파벳만 배제하고 언더스코어는 배제하지 않아, `error_code:`/`http_code:` 같은 스네이크케이스 키가 여전히 오매칭된다(직접 재현 확인). 라운드4 커밋의 "전부 소문자로 code 로 끝나는 키" 결론이 근거보다 넓다. 오늘 코퍼스(가이드 MDX)엔 `_code:` 형태가 없어 현재 판정에 영향은 없는 latent 갭 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` `CODE_FIELD` 정의 | `(?<![A-Za-z])`를 `(?<![A-Za-z_])`로 넓히거나, 의도적으로 `_code` 접미사를 대상으로 남긴다면 주석의 "전부" 문구를 정정. 판별 fixture 한 줄 추가 권장 |
| 2 | maintainability | "정규식 `lastIndex` 리셋 + while-exec" 보일러플레이트가 서로 다른 3개 함수(`scanIdentifierCitations`/`collectSourceTokens`/`collectEnvDeclarations`)에 걸쳐 4곳에서 복제됨 — 리셋 누락 시 두 번째 반복부터 매치가 조용히 누락되는데 이를 겨냥한 테스트가 없음 | `guide-identifier-scan.ts:152-158, 178-184, 211-217, 219-225` | `String.prototype.matchAll` 로 전환하거나 `collectMatches(texts, rx)` 공유 헬퍼로 추출해 리셋 로직을 한 곳에 통합 |
| 3 | testing | `collectSourceTokens`만 유일하게 합성 입력 대조군이 없다 — `\b` 단어 경계를 제거하는 뮤테이션을 직접 걸어도 26/26 GREEN 유지(재현·원복 확인). 형제 두 함수(`scanIdentifierCitations`/`collectEnvDeclarations`)는 이미 라운드 2·4에서 동일 클래스 결함에 합성 대조군을 얻었는데 세 번째 함수만 누락된 불균등 처리. 이 boundary 는 `basis`(기준집합)를 부풀리는 방향이라 없으면 부분 문자열 오판(거짓 PASS)이 가능 | `guide-identifier-scan.ts:175-186` (`collectSourceTokens`) | `collectEnvDeclarations — 분기별 대조군`과 같은 패턴으로 합성 대조군 추가: 경계 안쪽 포함 형태(`xMY_TOKEN`), 밑줄 이어진 부분 문자열(`FOO_BAR_BAZ` 안 `BAR_BAZ`), 중복 제거 등 |
| 4 | documentation | `plan/in-progress/guide-identifier-existence.md`의 라운드-표가 라운드 4 완료(커밋 `6b4c03af6`, `codebase/` 실제 수정 포함)를 반영하지 않고 "진행 중" 플레이스홀더로 멈춰 있음 — 이 PR 자신이 "두 PR 연속 같은 거짓 체크"를 막으려 도입한 장치가 한 라운드 뒤 다시 어긋남. `run-test-all.sh` "3회 실행" 서술도 라운드4의 4번째 실행을 반영 못해 stale | `plan/in-progress/guide-identifier-existence.md:162-163, 173` | 라운드 4 행을 라운드 1~3과 같은 형식(`/ai-review` 결과·`--impl-done` 결과·codebase 수정 여부)으로 채우고, 이번 라운드(`16_04_15`)를 라운드 5로 추가. 162행 실행 횟수 갱신 |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` `spec/conventions/user-guide-evidence.md §2`가 여전히 "Build-time 가드 (3건)"으로 서술해, 이 PR 이 유지·확장한 `guide-identifier-existence.test.ts`(전신 `guide-error-code-existence.test.ts`)와 별도 존재하는 `guide-sanitized-message-parity.test.ts`가 SoT 표에 없음 — 코드가 옳고 spec 문서만 낡음. 신규 발견 아님(통산 8회째 확인), `developer` 는 `spec/` 쓰기 권한 밖이라 이번 diff 범위에서 조치 불가 | `spec/conventions/user-guide-evidence.md:68` (`## 2. Build-time 가드 (3건)`) | 코드 되돌리기 아님 — `plan/in-progress/spec-draft-nullable-notation-followups.md`, `plan/in-progress/guide-identifier-existence.md §D`에 이미 파일명·표까지 완결된 형태로 등재된 planner 백로그가 처리. 새 등재 불요 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | performance | `collectEnvDeclarations`의 env/compose 병합이 오늘 코퍼스에서는 어떤 판정에도 기여하지 않는 계산(JSDoc 자체가 뮤테이션 실측으로 명시). 대상 파일이 작아 비용은 무시할 만함 | `guide-identifier-scan.ts:205-227` | 조치 불요 — 병합원이 늘어나면 캐싱/공유 헬퍼 고려 |
| 2 | performance | 가드별로 backend/packages 소스 전체(500+ 파일)를 각자 독립 재적재 — 형제 가드들과 동일한 기존 패턴, 전 라운드에서 이미 disposition 됨 | `guide-identifier-existence.test.ts:45-48` | 즉각 조치 불요 — 가드가 더 늘면 `describe`-scope 캐시/`globalSetup` 공유 fixture 고려 |
| 3 | architecture | 라운드4의 `CODE_FIELD` 왼쪽 경계 추가는 기존 3축 구조·export 표면·순수 함수 설계를 확장하지 않고 동일 축의 정밀도만 좁힌 것 — 구조적 영향 없음(긍정 관찰) | `guide-identifier-scan.ts:115-118` | 없음 |
| 4 | requirement | 기준집합(basis)이 `codebase/channel-web-chat`(임베드형 웹채팅 SPA) 소스와 그 `.env.example`을 포함하지 않음. 오늘 가이드엔 그 도메인 식별자 인용이 0건이라 영향 없음 | `guide-identifier-existence.test.ts:34-48` | 즉각 조치 불요 — 향후 위젯 전용 식별자가 가이드에 인용되면 기준집합 확장 필요, JSDoc 한 줄 언급 권장 |
| 5 | maintainability | 같은 파일의 다른 vacuity-floor 단언들은 실측값을 `// 실측 N` 주석으로 병기하는데 `byAxis("field-table"/"code-field"/"backtick")` 세 단언만 그 관례가 빠짐 | `guide-identifier-existence.test.ts:112-118` | 세 단언 옆에 실측 축별 카운트 주석 병기 |
| 6 | maintainability | 테스트 파일이 정의한 `FIELD_TABLE_NAME`(과거 패턴 스냅샷)이 `scan.ts`의 모듈-비공개 동명 상수와 이름이 충돌해 grep 시 혼동 소지 | `guide-identifier-existence.test.ts:187` vs `guide-identifier-scan.ts:102` | `LEGACY_FIELD_TABLE_NAME` 등으로 개명해 "과거 스냅샷"임을 이름에서 드러내기 |
| 7 | dependency / scope | 신규 외부 패키지·lockfile 변경 없음, 라운드1이 지적한 sibling stale 참조·`composeTexts` 과다 수집 범위(`pnpm-lock.yaml` 784KB 포함)는 라운드2에서 이미 해소된 채 유지 확인(회귀 없음) | `guide-sanitized-message-parity.test.ts:16`, `guide-identifier-existence.test.ts:55-58` | 없음(재확인) |
| 8 | scope | 라운드4 이후 실 코드 변경은 커밋 `6b4c03af6` 뿐이며 직전 라운드 WARNING에 1:1로 결속(스코프 이탈 없음). `2253d27a4`(plan 체크박스 정정)도 단일 파일 하우스키핑에 국한 | `guide-identifier-scan.ts`, `plan/in-progress/guide-identifier-existence.md` | 없음 |
| 9 | documentation | 라운드4 신규 코드의 주석·테스트 설명이 리뷰어의 틀린 예시와 실제 위험 형태를 명확히 구분해 다음 사람의 오탐-기각을 방지 — 긍정 관찰 | `guide-identifier-scan.ts:104-118`, `guide-identifier-existence.test.ts:283-295` | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 시크릿/인젝션/ReDoS 없음, 네트워크·DB·인증 코드 없음 |
| performance | NONE | 정적 스캐너 O(선형), 프로덕션 경로 무관. INFO 2건(비기여 계산·재적재 패턴) |
| architecture | NONE | 3축 구조 보존, 구조적 리스크 없음. INFO 2건(정밀도 개선·이전 WARNING 재발 없음) |
| requirement | LOW | WARNING(CODE_FIELD `_code` 잔여 갭), SPEC-DRIFT(가드 카탈로그 미갱신, 이미 등재됨) |
| scope | LOW | 변경 전량 요청 범위 내, 회귀 없음(재확인 다수) |
| side_effect | NONE | 순수 함수 + read-only fs, 전역 상태/네트워크/이벤트 없음 |
| maintainability | LOW | WARNING(lastIndex 보일러플레이트 4중 복제), INFO 2건(주석 관례 이탈·이름 충돌) |
| testing | LOW | WARNING(`collectSourceTokens` 합성 대조군 부재, 뮤턴트 생존 재현). 나머지 회귀는 실측 재검증 완료 |
| documentation | LOW | WARNING(plan 라운드-표 stale), SPEC-DRIFT 재확인(조치 불요), 긍정 관찰 1건 |
| dependency | NONE | 신규 패키지/lockfile 변경 없음, 이전 지적 2건 해소 확인 |
| database | NONE | DB 관련 코드 없음 |
| concurrency | NONE | async/Promise/락/공유 가변 상태 없음, 전부 동기 단일 스레드 |
| api_contract | NONE | HTTP/컨트롤러/DTO 등 API 표면 자체가 없음 |
| user_guide_sync | NONE | doc-sync-matrix 19개 trigger 전수 대조 매칭 0건 — 가드 인프라 자체 변경일 뿐 원본 콘텐츠/코드 아님 |

## 발견 없는 에이전트

security, side_effect, database, concurrency, api_contract, user_guide_sync

## 권장 조치사항

1. `CODE_FIELD` 왼쪽 경계를 `(?<![A-Za-z_])`로 넓히거나(또는 의도 명시), 커밋 주석의 "전부" 단정을 정정 — 오늘 코퍼스엔 영향 없지만 latent 갭이므로 다음 identifier 추가 전에 정리 권장 (requirement WARNING#1)
2. `collectSourceTokens`에 `collectEnvDeclarations`와 동등한 합성 대조군을 추가해 `\b` 경계 뮤턴트를 실제로 겨냥 — 세 exported 함수 중 유일하게 자기검증이 없는 상태 (testing WARNING#3)
3. `plan/in-progress/guide-identifier-existence.md`의 라운드-표를 라운드4 실측 결과(codebase 수정 있었음 → 수렴 아님)로 갱신하고 이번 라운드(16_04_15)를 라운드5로 추가 (documentation WARNING#4)
4. `lastIndex` 리셋 보일러플레이트를 `matchAll` 또는 공유 헬퍼로 통합해 재발 표면을 4곳→1곳으로 축소 (maintainability WARNING#2)
5. (developer 권한 밖, 참고용) `spec/conventions/user-guide-evidence.md §2` 가드 카탈로그 갱신은 이미 planner 백로그에 등재돼 있으므로 별도 조치 불요 — 다음 spec 작업 세션에서 일괄 반영

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 14개 reviewer 실행.
- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명, 전원 success·전문 확보)
- **제외**: 없음
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨(누락 없음)