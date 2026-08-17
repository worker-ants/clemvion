# Code Review 통합 보고서

## 전체 위험도
**LOW** — 7개 reviewer(security/requirement/scope/side_effect/maintainability/testing/documentation) 전원 결과 확보. Critical 0건, WARNING 1건(문서화, 고아 JSDoc 재배치). 이 changeset 은 이미 3라운드 `/ai-review` 를 거쳐 CRITICAL 을 모두 해소한 상태이고, 이번 라운드의 유일한 신규 델타(마지막 커밋)는 spec/plan 문서·주석 정정뿐이라 신규 CRITICAL/WARNING 은 발견되지 않았다.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | `sanitize-error-message.ts` 신설 `MASKED_MARKERS`(및 `isMaskedMarker` 사용처)를 설명하는 대형 JSDoc 블록이 중간에 낀 별도 한 줄 주석(`VALUE_MASK_MARKER` 직전) 때문에 정작 `MASKED_MARKERS` 상수에 귀속되지 않는 고아(orphan) 주석이 됨 — IDE 호버/TypeDoc 등 표준 파서가 "왜 마커를 재마스킹하지 않는가"(마스킹 재적용 방지 핵심 불변식, 12-webhook §5.3 계약 근거)를 그 상수에서 찾지 못함 | `codebase/backend/src/shared/utils/sanitize-error-message.ts` — 대형 JSDoc 블록(마커-계층 대응표, 95~116줄 부근) → 개별 한 줄 주석 → `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 선언 → 주석 없는 `MASKED_MARKERS` 선언 순 | 대형 블록을 `MASKED_MARKERS` 선언 바로 위로 옮기거나(권장), 개별 한 줄 주석들을 제거하고 대형 블록이 세 상수 전체를 아우르는 하나의 JSDoc 으로 붙게 재배치 |

(참고: maintainability 리뷰어도 동일 위치의 "JSDoc 블록이 실제 심볼과 분리돼 있다"는 구조를 독립적으로 지적했으나, 이전 라운드(`00_23_57`)에서 이미 INFO 로 "typedoc 미도입이라 무해"로 처분된 바 있어 INFO 로 유지. documentation 리뷰어는 이번 라운드에서 그 귀속 경로를 재차 line-level 로 실증하며 WARNING 으로 격상 — 통합 시 더 높은 등급인 WARNING 을 채택.)

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | WS 내부 wire 채널 `preserveKeys`(`llmCalls`) 예외가 깊이·경로 무관 키 이름만으로 매칭 — 외부 발신자가 통제 가능한 JSON 어딘가에 `llmCalls` 키가 우연/의도적으로 나타나면 그 하위 트리가 내부 WS 값-마스킹을 건너뜀. 다만 fanout(외부)은 해당 필드 자체를 통째로 제거하므로 외부 미노출, 순노출 감소 방향의 잔여 갭 | `sanitize-error-message.ts` `deepRedactObject`, `websocket.service.ts` `WIRE_PRESERVED_FIELDS`/`maskWireEnvelope` | 조치 불요(이미 2라운드 평가·수용). 우선순위 상향 시 depth===0 매칭으로 한정 검토 가능 |
| 2 | security | `kb:<documentId>`/`background:run:<id>` WS 채널은 값-패턴 마스킹(`maskWireEnvelope`) 미적용, 키-이름 마스킹만 적용 — 인가 경계는 execution 채널과 동일하나 `executionEventSubject` 미경유로 외부 fanout 경로 없음(선행 라운드 RESOLUTION 이 범위 밖으로 등재) | `websocket.service.ts` `emitKbEvent`/`emitBackgroundRunEvent` | 조치 불요(이미 평가·트래커 등재됨) |
| 3 | security / requirement | `inputData`(Execution/NodeExecution/BackgroundRun)는 값-패턴 마스킹 의도적 제외 — Re-run 재제출 오염 CRITICAL 을 두 독립 게이트가 반증해 철회된 결정. 자유 텍스트 자격증명이 workspace 멤버 전원(viewer 포함)에게 원문 노출되는 잔존 egress 는 인정된 설계 트레이드오프 | `executions.service.ts` `MASKED_INPUT_DATA_REASON` 및 참조부, `background-runs.service.ts` `toNodeExecutionDto` | 조치 불요(설계 의도, 트래커 등재됨) |
| 4 | security | `SECRET_LEAK_PATTERNS` 가 `access_token`/`refresh_token`/`api_key` 등은 잡지만 단독 `token=` 키워드는 미포착 — 기존 갭, 캐너리로 관측 고정 | `sanitize-error-message.ts` `SECRET_LEAK_PATTERNS` | 조치 불요(이미 등재·캐너리 고정). 패턴 확장은 별도 PR |
| 5 | requirement | `inputData`/`outputData` 마스킹 예외·마커보존 로직이 코드·테스트·DTO·spec 네 층에서 동일 근거(`MASKED_INPUT_DATA_REASON`, §5.3)로 일치 — 양호 사례 | `executions.service.ts` 다수 호출부, `background-runs.service.ts`, DTO 2곳, `14-external-interaction-api.md` | 해당 없음 |
| 6 | requirement | WS emit 값-패턴 마스킹(`maskWireEnvelope`)의 wire·fanout 적용과 `llmCalls` 단일 예외가 spec(§4.1) 서술과 구현이 구조적으로 동일 배열 공유로 일치 | `websocket.service.ts` `WIRE_PRESERVED_FIELDS`(`EXTERNAL_STRIPPED_FIELDS` 파생) | 해당 없음 |
| 7 | requirement | `redactStoredDataForResponse`/`redactStoredErrorForResponse` 본문이 현재 동일(둘 다 `deepRedactSecrets` 위임)하지만 §R17 "컬럼별 관문 열거" 근거의 의도적 분리 — 중복이 아닌 방어 설계 | `redact-stored-error.ts` | 해당 없음 |
| 8 | scope | 완료된 plan 문서의 `plan/complete/` 이동(rename)이 선언된 작업과 별개 사유로 같은 브랜치에 반복 등장(2건) — 내용 변형 없거나 경고문만 추가된 최소 편집, 선행 라운드가 이미 수용 | `plan/complete/eia-internal-rest-error-masking.md`, `plan/complete/spec-draft-eia-fanout-masking.md` | 조치 불요 |
| 9 | scope | 마지막 커밋이 `3-error-handling.md` §2.2 의 `nodeName`→`nodeLabel` 을 정정 — 마스킹 작업과 무관한 기존 drift 정정이 두 번째로 델타에 추가(WS §4.1 정정의 확장 적용, 독립 재조사 아님) | `spec/5-system/3-error-handling.md` §2.2 | 조치 불요. 향후 PR 설명에 "동봉 사유" 명시 권장 |
| 10 | scope | 마지막 커밋의 `executions.service.spec.ts` 변경은 JSDoc 텍스트 정정뿐, assertion 변경 없음(같은 라운드가 강제한 fix) | `executions.service.spec.ts` | 조치 불요 |
| 11 | side_effect | 공유 유틸 `deepRedactSecrets` 의 "마커 재마스킹 안 함" 규칙이 diff 밖 다른 소비자(`terminal-error-payload.ts` 등)에도 전역 적용 — 마스킹 완화 방향 아님, 캐너리로 고정 | `sanitize-error-message.ts` 마커 상수·함수 | 조치 불요 |
| 12 | side_effect | WS 내부(에디터) wire 채널 emit payload 가 `maskWireEnvelope` 로 값-마스킹 — 프로토콜 동작 변경이나 CHANGELOG/spec/회귀 테스트로 통지·고정됨 | `websocket.service.ts` `maskWireEnvelope`/`toFanoutEnvelope` | 조치 불요 |
| 13 | side_effect | `ResponseExecution`/`ResponseNodeExecution` 의 `outputData` 타입이 `\| null` 로 확장 — diff 밖 실제 소비자 0건, `nest build` 가 회귀 실제 검증 | `executions.service.ts` | 조치 불요 |
| 14 | side_effect | `ExecutionsService.stop()` 이 마스킹 관문 통과 복사본 반환(이 브랜치 이전 커밋 도입, 이번 diff 변경분 아님) — 내부 호출부가 반환값 미캡처 확인 | `executions.service.ts` `stop`/`toResponseExecution` | 조치 불요 |
| 15 | maintainability | `sanitize-error-message.ts` JSDoc 블록이 심볼과 분리(문서화 리뷰어와 동일 위치, 이전 라운드 "typedoc 미도입이라 무해"로 처분됨) | `sanitize-error-message.ts:95~122` | 추가 조치 불요(기존 처분 유지); 통합상 WARNING #1 로 대체 반영 |
| 16 | maintainability | 런타임 미참조 상수(`MASKED_INPUT_DATA_REASON`)를 `void` 로 앵커링하는 비관용 패턴 — 주석으로 삭제 위험 완화됨, 의도적 처분 유지 | `executions.service.ts:83,87` | 추가 조치 불요 |
| 17 | testing | `maskIfPresent` 의 방어적 폴백 분기(`mask(value) ?? value`)가 현재 어떤 입력으로도 도달 불가 — 근거 문서화된 테스트 없음 | `executions.service.ts:115` `maskIfPresent` | 낮은 우선순위. 의도 고정 원하면 `mask: () => null` 케이스 한 줄 추가 가능 |
| 18 | testing | `BackgroundRunsService` 신규 테스트 2건이 `error`/`outputData` 를 각각 단독 leaky 로만 검증, 동일 행 동시-leaky 조합 케이스 부재(자매 `executions.service.spec.ts` 는 조합 케이스 보유, 비대칭) | `background-runs.service.spec.ts:226` | 필수는 아니나 대칭 원하면 동시 leaky 행 케이스 1건 추가 권장 |
| 19 | documentation | CHANGELOG 신규 항목의 수치·표면 목록·`llmCalls` 예외가 실제 diff 와 정합 | CHANGELOG, `websocket.service.ts`, `executions.service.ts`, spec 2곳 | 해당 없음 |
| 20 | documentation | DTO JSDoc/Swagger, KO/EN 사용자 가이드(run-results.mdx)가 "outputData만 마스킹, inputData 는 재제출 보호 위해 의도적 비대상" 정책을 일관되게 반영 | `execution-response.dto.ts`, `background-run-response.dto.ts`, `run-results.mdx`/`.en.mdx` | 해당 없음 |
| 21 | documentation | `toResponseExecution` JSDoc 의 "읽기 표면 여섯 곳" 표가 단일 정본이고 다른 파일들이 `{@link}`/링크로만 참조 — 과거 "자매 넷 중 하나만" 결함 클래스를 구조적으로 제거 | `executions.service.ts` | 해당 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 신규 결함 없음. INFO 4건(preserveKeys 깊이무관 매칭, kb/background 채널 미마스킹, inputData 의도적 제외, bare `token=` 미포착) 모두 기존 트레이드오프·트래커 등재됨 |
| requirement | LOW | CRITICAL/WARNING 없음. spec-코드-테스트-DTO 4층 정합 확인, INFO 3건은 양호 사례 기록 |
| scope | LOW | scope 이탈 없음. plan lifecycle 이동 반복(2건)·drift 정정 확장(1건)·JSDoc 정정(1건) 모두 정당한 강제 후속 조치 |
| side_effect | LOW | 신규 부작용 없음(이번 델타는 문서 정합화뿐). 기존 확인 4건(마커 보존 전역화, WS wire 바이트 변경, 타입 확장, stop() 계약)은 문서화·회귀 테스트로 고정됨 |
| maintainability | LOW | CRITICAL/WARNING 없음. 자매 표면 누락 방지 구조·중복 억제 헬퍼·마커 상수 공유 등 양호 사례 다수. INFO 2건은 기존 처분 유지 |
| testing | NONE | 매우 촘촘한 회귀 스위트(표면별 독립 단언, copy-on-change 참조 동일성, 마커 보존 캐너리, 뮤테이션 검증 기록). 사소한 INFO 2건만 |
| documentation | LOW | WARNING 1건(MASKED_MARKERS JSDoc 고아 귀속) — 유일한 실질 결함. 그 외 문서-코드 정합성 양호 |

## 발견 없는 에이전트

(없음 — 전 에이전트가 최소 INFO 이상 보고. CRITICAL 은 전원 0건)

## 권장 조치사항

1. (WARNING, documentation/maintainability 공통 지적) `codebase/backend/src/shared/utils/sanitize-error-message.ts` 의 `MASKED_MARKERS` 설명 JSDoc 대형 블록을 `MASKED_MARKERS` 선언 바로 위로 재배치하거나, 중간에 낀 개별 한 줄 주석들을 제거해 대형 블록이 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`/`MASKED_MARKERS` 전체에 정상 귀속되도록 한다.
2. (선택, testing INFO) `maskIfPresent` 의 `?? value` 폴백 분기 의도를 `mask: () => null` 케이스 테스트 한 줄로 고정할지 검토.
3. (선택, testing INFO) `background-runs.service.spec.ts` 에 `error`+`outputData` 동시 leaky 행 케이스를 추가해 `executions.service.spec.ts` 자매 스위트와 대칭을 맞출지 검토.
4. 그 외 INFO 항목들은 전부 선행 라운드가 이미 평가·수용·트래커 등재를 마친 알려진 트레이드오프이며 이번 라운드 재검증에서도 상태 변화가 없다 — 추가 조치 불요.

## 라우터 결정

- `routing_status`: `all` (본 세션은 forced whitelist 전원 실행 — router 별도 선별 없음)
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — forced 전원 결과 확보됨(모두 success, 전문 인라인 확보)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |