
# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. forced whitelist(security/requirement/scope/side_effect/maintainability/testing/documentation) 전원 결과 확보됨(누락 없음). 이번 PR("DB=wire" 불변식 잔여 3항목: ①`finalizeCancelledExecution` guarded-UPDATE 반환 미확인 수정 ②retry-turn CANCELLED 재진입 RETURNING 도입 ③REST `durationMs` 추가)의 핵심 결함은 뮤테이션 테스트로 실제로 닫혔음이 실측 확인됐으나, 이번 diff 가 새로 만든 코드 자체가 어떤 테스트로도 보증되지 않는 커버리지 갭(`testing` MEDIUM)과 문서-코드 모순(JSDoc이 방금 뒤집힌 emit 조건을 여전히 "항상 emit"으로 서술) 이 반복 지적되어 WARNING 다수 발생.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | retry-turn CANCELLED 분기의 `finishedAt` 되쓰기(Date/string 분기)를 어떤 테스트도 커버하지 않음 — 해당 블록 전체 제거해도 44개 테스트 전부 GREEN(뮤테이션 실측) | `retry-turn.service.ts:668-677`, 테스트: `retry-turn.service.spec.ts:1308-1346` | `raw` mock 에 `finished_at` 값(문자열/Date)을 채워 되쓰기 결과를 단언하는 케이스 추가 |
| 2 | testing | `.returning(['duration_ms', 'finished_at'])` 빌더 호출 자체가 테스트로 보증되지 않음 — mock 의 `raw` 가 실제 `.returning()` 호출과 무관하게 하드코딩되어, 이 PR 이 고치는 원래 결함(DB≠wire)으로 회귀해도 못 잡음(뮤테이션 실측: 호출 제거해도 44/44 GREEN) | `retry-turn.service.ts:655`, mock: `retry-turn.service.spec.ts:1313-1325` | `returning` mock 을 스파이로 바꿔 `expect(returningSpy).toHaveBeenCalledWith(['duration_ms','finished_at'])` 단언 추가 (같은 describe 의 `set`/`where`/`andWhere`/`setParameter` 단언과 동형) |
| 3 | requirement, side_effect | `finalizeCancelledExecution` 함수 JSDoc 이 이번 diff 가 뒤집은 emit 조건("guarded UPDATE 0행이면 skip")을 반영 못 하고 여전히 "emit 은 반환값과 무관하게 항상 발행한다"고 서술 — 문서-코드 정면 모순 | `execution-engine.service.ts:4869-4871`(JSDoc) vs `:4891-4902`(신규 코드) | JSDoc 을 "emit 은 `updateExecutionStatus` 가 `true` 반환 시에만 발행 — `false`(동시 writer 선점) 시 재마킹·emit 모두 skip(2026-08-15)" 로 정정 |
| 4 | requirement | `EIA-IN-04` 요구사항 필드 목록(§3.2)이 구현/§5.3 예시/§6 필드표에는 반영된 `durationMs` 를 누락 — impl-prep 단계에서 이미 "한 커밋 동반 갱신" 권고됐던 항목이 반영되지 않음 | `spec/5-system/14-external-interaction-api.md:77` | L77 괄호 목록에 `durationMs` 추가(`... / result|error / durationMs / seq / updatedAt`) — spec 쓰기 권한은 planner 소관이므로 plan 체크리스트에 등재 |
| 5 | maintainability | `finalizeGuarded` CANCELLED 분기의 `RETURNING` 후처리가 중첩 5단으로 심화 | `retry-turn.service.ts:657-679` | `result.raw` → `{durationMs, finishedAt}` 변환을 별도 헬퍼로 추출해 평탄화 |
| 6 | maintainability | `finished_at` 파싱(Date/string 분기)이 인라인 재구현 — 자매 컬럼 `duration_ms` 는 이미 `toFiniteNumber` 헬퍼로 위임 중, "파싱은 한 곳에" 원칙과 불일치 | `retry-turn.service.ts:669-677` (대칭 헬퍼: `terminal-duration.ts:71-78` `toFiniteNumber`) | `toFiniteNumber` 와 대칭인 `toPersistedDate()` 헬퍼 추가해 인라인 분기 축약 |
| 7 | maintainability | `createQueryBuilder` mock 체인이 이번 diff 로 4곳 더 중복(파일 전체 15곳) — 자체 주석이 이 중복의 위험(#1171 vacuous 사고)을 이미 경고 중인데 반복 확대 | `retry-turn.service.spec.ts:79-87, 1253, 1313-1325, 1352-1361` | 공용 mock 팩토리(`makeGuardedQueryBuilderMock`) 도입해 신규 테스트부터 적용 |
| 8 | documentation | §6.5 "알려진 예외 1건" 해소 편집에서 핵심 클레임은 취소선으로 보존했지만, 바로 옆 트래커 링크+"왜 지우지 않고 옆에 적는가" 관행 근거 문장은 취소선 없이 완전 삭제 — 같은 PR 이 스스로 세운 보존 원칙과 모순, `node-cancellation.md` 정정(대비 사례)과 다른 처리 | `spec/5-system/14-external-interaction-api.md:816-818` (삭제된 원문은 구 파일 809-819행) | 삭제된 세 줄을 취소선 처리해 복원하거나 최소한 트래커 링크만이라도 "(해소, 상세 이력은 링크 참조)" 형태로 남길 것 |
| 9 | documentation | 테스트 인라인 주석의 "엔티티 타입-nullable 불일치, 트래커 등재"라는 주장이 실제 plan 파일 전수 검색으로 뒷받침되지 않음(등재된 곳 없음) | `interaction.service.spec.ts:95-97` (대조: `execution.entity.ts:56-63`, `plan/in-progress/eia-db-wire-invariant.md` "범위 밖" 절 4건에 미포함) | 실제 등재할 계획이면 plan 파일:섹션 명시 또는 "범위 밖(등재됨)" 절에 5번째 항목으로 추가, 아니면 "미등재"로 표현 낮출 것 |
| 10 | user_guide_sync | `GET /api/external/executions/:id` 응답에 `durationMs` 추가됐는데, 바로 이 엔드포인트를 "이벤트 유실 후 재조회 복구" 정본 경로로 문서화한 user-guide(`triggers.mdx`/`.en.mdx`)가 갱신되지 않음 | `execution-status-response.dto.ts:116-130`, `interaction.service.ts:434-438` / 문서: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:318`, `.en.mdx:307` | 재조회 안내 문장/FieldTable 에 `durationMs` 한 줄 언급 추가, 또는 의도적 생략이면 plan/PR 본문에 판단 근거 기록 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | scope | retry-turn `.returning()` 되읽기가 `duration_ms` 뿐 아니라 `finished_at` 도 함께 되쓴다 — plan 표제(`durationMs`)보다 한 컬럼 넓음(기존 COALESCE 대상의 완전한 되읽기, 스코프 위반 아님) | `retry-turn.service.ts:667-677` | 조치 불요, testing WARNING #1 로 이미 커버리지 갭 별도 등재됨 |
| 2 | scope | `review/consistency/2026/08/15/13_43_10/**` 6개 파일이 이 코드 PR 커밋에 함께 포함 — impl-prep 게이트 산출물로 정상 | — | 조치 불요 |
| 3 | testing | `interaction.service.ts` `durationMs: execution.durationMs ?? null` — `0`(falsy-but-valid) 경계값 테스트 부재, `??`↔`\|\|` 치환 뮤턴트 미구분 | `interaction.service.ts:435`, 테스트: `interaction.service.spec.ts:531-545` | `durationMs: 0` fixture 케이스 추가 |
| 4 | testing | `finalizeCancelledExecution` 신규 describe 는 음성(0행) 경로만 직접 커버 — 양성 경로는 기존 `runExecution` catch 테스트가 간접 커버(실질 갭 아님) | `execution-engine.service.spec.ts:1069-1098` | 조치 불요(선택적으로 대칭 positive 테스트 추가 가능) |
| 5 | maintainability | guarded-UPDATE-skip 관용구(`if(!persisted){warn; return;}`)가 이번 diff로 세 번째 자리(`finalizeCancelledExecution`)를 얻음 — 헬퍼 추출은 plan 이 이미 별도 PR 로 추적 중 | `execution-engine.service.ts:4895-4902`, 자매: `:4970-4978`, `retry-turn.service.ts:707-712` | 후속 PR 스코프 산정 시 반영 |
| 6 | maintainability | 함수 JSDoc/인라인 주석이 라운드별 CRITICAL 이력을 누적 서술해 매우 길다(저장소 관행과는 일치) | `execution-engine.service.ts:4856-4875`, `retry-turn.service.ts:600-639` | 조치 불요, 장기적으로 CHANGELOG/plan 참조로 이관 고려 |
| 7 | security | 모든 신규 SQL 이 TypeORM 파라미터 바인딩 사용, `durationMs` REST 노출도 기존 push 채널에 이미 노출되던 저민감도 값 — 신규 취약점 없음 | 다수 | 조치 불요 |
| 8 | api_contract | `execution.cancelled` push 이벤트가 특정 레이스에서 더 이상 발행되지 않는 동작 변경 — CHANGELOG 에 수신자 영향 고지됨, 데이터 유실 아님(재조회로 확인 가능) | `execution-engine.service.ts:4891-4902` | EIA spec webhook 신뢰성 절에도 캐비엇 한 줄 추가 고려 |
| 9 | api_contract | `durationMs` 필드는 종결 경로에 따라 의미가 다름(실행시간 vs 대기경과시간) — 이미 DTO JSDoc/Swagger/spec §6.5 세 곳에 일관 문서화됨(#1171 부터의 기존 계약 확장) | `execution-status-response.dto.ts:116-122` | 조치 불요, 추후 필드 분리 논의 시 참고 |
| 10 | database, concurrency | guarded UPDATE·COALESCE+RETURNING 모두 원자적 단일 SQL, SELECT-then-write 형 TOCTOU 창 없음. 스키마/마이그레이션/인덱스 변경 없음 | 다수 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 취약점 없음, 파라미터 바인딩 확인, 저민감도 필드 노출 |
| requirement | LOW | 핵심 결함 뮤테이션 실증 확인. JSDoc 모순(WARNING) + spec 필드 목록 누락(WARNING) |
| scope | NONE | 20개 파일 전량이 plan ①②③ 대응, drive-by 변경 없음 |
| side_effect | LOW | 이벤트 발행 조건 변경은 고지됨. JSDoc 모순 1건(WARNING) |
| maintainability | LOW | 중첩 심화·인라인 파싱 재구현·mock 중복 확대(WARNING 3건) |
| testing | MEDIUM | 뮤테이션 검증 3건 성공, 신규 코드 2곳 무커버 갭 실측(WARNING 2건) |
| documentation | LOW | 보존 원칙 위반(취소선 없는 삭제) + 미확인 "트래커 등재" 주장(WARNING 2건) |
| database | NONE | 스키마/인덱스 변경 없음, 인젝션 표면 없음 |
| concurrency | LOW | 두 결함 모두 원자적 SQL 로 정확히 닫힘, 신규 레이스 없음 |
| api_contract | LOW | additive/nullable 필드, 이벤트 변경 CHANGELOG 고지됨 |
| user_guide_sync | LOW | `durationMs` 관련 user-guide(triggers.mdx) 미갱신(WARNING 1건) |

## 발견 없는 에이전트

없음 (전 에이전트가 최소 INFO 이상 발견사항 보고).

## 권장 조치사항

1. `execution-engine.service.ts:4869-4871` `finalizeCancelledExecution` JSDoc 을 실제 조건부 emit 동작에 맞게 정정 (WARNING #3) — 문서-코드 모순은 향후 가드 오제거/오이식 위험이 있어 우선순위 최상위.
2. `retry-turn.service.spec.ts` 에 `finishedAt` 되쓰기 단언 + `.returning()` 호출 자체를 단언하는 테스트 추가 (WARNING #1, #2) — 이 PR 이 고치려는 결함 클래스로 정확히 회귀할 수 있는 커버리지 갭.
3. `spec/5-system/14-external-interaction-api.md` §3.2 `EIA-IN-04` 필드 목록에 `durationMs` 추가 (WARNING #4, planner 턴).
4. §6.5 삭제된 트래커 링크 문장 복원(취소선 처리) (WARNING #8, planner 턴).
5. `triggers.mdx`/`.en.mdx` 에 `durationMs` 필드 언급 추가 또는 의도적 생략 근거 기록 (WARNING #10).
6. 여유가 되면 maintainability WARNING 3건(중첩 평탄화, `toPersistedDate` 헬퍼, mock 팩토리) 및 documentation WARNING #9("트래커 등재" 주장 근거 명시)도 함께 정리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync` (11명)
  - **제외**: 표 (3명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (forced 전원 결과 확보됨 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff 범위 밖 (사유 상세는 `_routing_decision.json` 참조) |
  | architecture | router 판단 — 이번 diff 범위 밖 |
  | dependency | router 판단 — 신규 외부 의존성 도입 없음 |