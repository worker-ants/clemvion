# Code Review 통합 보고서

## 전체 위험도
**HIGH** — 인플라이트 멀티턴 세션 중단, 기존 워크플로우 표현식 일괄 파손, send-email 에러 코드 버그 등 배포 즉시 영향을 주는 Critical 이슈 다수 포함

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 버그 | `send-email.handler.ts` — 에러 코드 ternary 양쪽 분기가 동일값 `'EMAIL_SEND_FAILED'` 반환. `IntegrationError`의 원래 코드(`INTEGRATION_TYPE_MISMATCH` 등)가 소실되며 다운스트림 에러 분기 불가 | `send-email.handler.ts` catch 블록 `const code = ...` | `err instanceof IntegrationError ? err.code : 'EMAIL_SEND_FAILED'` 로 수정 |
| 2 | 하위호환 파손 | `_multiTurnState` → `_resumeState` 필드명 변경으로 배포 시점에 대기 중인 모든 멀티턴 세션 재개 불가. `ai-agent`, `information-extractor` 양쪽 해당 | `ai-agent.handler.ts`, `information-extractor.handler.ts` | 엔진 resume 경로에서 `_resumeState ?? _multiTurnState` fallback 읽기 추가, 또는 인플라이트 세션 없음을 배포 전 확인하는 절차 필수 |
| 3 | 하위호환 파손 | 컨테이너 출력 구조 변경 (flat array → `{ items/iterations/mapped, count }`). 기존 워크플로우 표현식 `$node["X"].output[0]` 등 일괄 파손. 마이그레이션 스크립트가 이 케이스를 커버하는지 미확인 | `execution-engine.service.ts`, `spec/4-nodes/1-logic-nodes.md` | 마이그레이션 스크립트에 컨테이너 출력 참조 자동 변환 로직 포함 여부 검증 필수 |
| 4 | 하위호환 파손 | Information Extractor `output.extracted` → `output.result.extracted` 경로 변경으로 기존 워크플로우 표현식 일괄 파손. expression-resolver 레벨의 legacy fallback 처리 여부 불명확 | `information-extractor.handler.ts`, `information-extractor.schema.ts` | 마이그레이션 스크립트 커버리지 확인; expression-resolver에도 동일한 fallback 적용 여부 검증 |
| 5 | 데이터 정합성 | 마이그레이션 스크립트 전체 apply가 단일 트랜잭션으로 보호되지 않음. 중간 실패 시 부분 마이그레이션 상태가 되어 노드 간 expression 경로 불일치 발생 | `migrate-node-output-refs.ts` `main()` 446–452행 | `ds.transaction()` 으로 전체 apply를 하나의 원자적 트랜잭션으로 묶거나 최소 워크플로우 단위로 트랜잭션 적용 |
| 6 | 테스트 누락 | `handler-output.adapter.ts`의 `_resumeState` 처리 3개 경로(bare-object, port-selector, canonical shape)에 대한 테스트 전무. `null`, Array, 중복 존재 시 덮어쓰기 등 엣지 케이스 미검증 | `handler-output.adapter.ts` | `handler-output.adapter.spec.ts`에 `_resumeState` 관련 케이스 추가 |
| 7 | 테스트 누락 | `code.handler.ts`의 에러 코드 정규화 로직(`CODE_RUNTIME_ERROR` → `CODE_EXECUTION_FAILED`, `EXECUTION_TIMEOUT` → `CODE_TIMEOUT`)에 대한 `output.error.code` 값 검증 단언 없음 | `code.handler.spec.ts` error 케이스 4개 | `expect(result.output.error.code).toBe('CODE_EXECUTION_FAILED')` 등 정규화 결과 단언 추가 |
| 8 | 문서화 | `CONVENTIONS §3.2`, `§4.3`, `§7`, `§8`, `§9.2` 등 20회 이상 참조되나 해당 문서가 코드베이스 어디에 위치하는지 전혀 명시되지 않음. 동일하게 `Principle 1.1` 계열 참조 출처 불명확 | 다수 핸들러 파일 주석 전반 | CONVENTIONS 문서 경로를 `CLAUDE.md` 또는 `spec/`에 명시; Principle 참조에 출처 파일 경로 추가 |
| 9 | 데이터 정합성 | audit_log 삽입 시 `workspace_id`, `user_id`를 `LIMIT 1`로 임의 선택. 멀티테넌트 환경에서 잘못된 workspace/user가 audit에 기록되어 compliance 위반 가능 | `migrate-node-output-refs.ts` 466–475행 | CLI 인수 또는 환경변수로 workspace_id/user_id 수령; per-workflow audit 행 삽입 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 하위호환 파손 | `template.handler.ts` `output.content` → `output.rendered` 명칭 변경에 대한 하위호환 마이그레이션 경로(레거시 필드 병존 또는 스크립트 처리) 미확인 | `template.handler.ts` | 마이그레이션 스크립트가 `output.content` → `output.rendered` 변환 패스를 포함하는지 검증 |
| 2 | 하위호환 파손 | `handler-output.adapter.ts`에서 `isLegacyPortSelector` (`{ port, data }`) 브랜치 제거. 아직 마이그레이션되지 않은 핸들러가 있으면 bare-object 브랜치로 폴스루하여 `data` 내용이 output에 노출되지 않는 silent regression 발생 | `handler-output.adapter.ts` | 코드베이스 전체에서 `{ port, data }` shape 반환 핸들러가 없음을 grep으로 확인 후 제거 |
| 3 | 하위호환 파손 | 에러 코드 rename (`QUERY_FAILED` → `DB_QUERY_FAILED`, `SMTP_SEND_FAILED` → `EMAIL_SEND_FAILED`). 모니터링, 알림, 다운스트림 조건 분기가 silent breakage 발생 | `database-query.handler.ts`, `send-email.handler.ts` | 에러 코드 변경을 CHANGELOG에 breaking change로 기재; 마이그레이션 가이드 추가 |
| 4 | 하위호환 파손 | `workflow.handler.ts` 예외를 throw 대신 `error` 포트 반환으로 변경. `error` 포트에 아무것도 연결되지 않은 워크플로우에서 오류가 silent하게 무시되어 "정상 완료"로 기록될 수 있음 | `workflow.handler.ts` | 엔진의 dead-end 감지 로직이 미연결 `error` 포트 도달 시 execution 실패 처리하는지 확인 |
| 5 | 하위호환 파손 | `form.handler.ts` `output: null` → `output: {}` 변경. falsy/truthy 차이로 엔진 내 null-guard 로직이 있으면 동작이 달라질 수 있음 | `form.handler.ts` | `toEngineFlatShape` 및 관련 엔진 코드에서 `null` vs `{}` 처리 경로 확인 |
| 6 | 설계 | `NodeHandlerOutput` 인터페이스에 `_resumeState` 포함 — ISP 위반. resume을 전혀 사용하지 않는 핸들러도 이 필드를 인지해야 하며, `_` prefix 내부전용 컨벤션과 공개 인터페이스 포함이 모순 | `node-handler.interface.ts` | `ResumableHandlerOutput extends NodeHandlerOutput` 서브타입 분리 검토 |
| 7 | 설계 | `code.handler.ts` `output.error.code`(정규화 코드)와 `meta.errorCode`(원본 코드) 두 체계 병존. 소비자가 어떤 코드를 사용해야 하는지 불명확 | `code.handler.ts` `buildErrorReturn` | 하나의 코드 체계 선택 또는 두 필드 역할을 명확히 문서화; `meta.errorCode`를 deprecated 마킹 |
| 8 | 설계 | 프론트엔드 `output.result.X ?? output.X` 이중 경로 조회 패턴이 `conversation-utils.ts`, `output-shape.ts`, `conversation-inspector.tsx` 3개 파일에 독립적으로 반복 (DRY 위반) | 프론트엔드 3개 파일 | `resolveResultField(output, key)` 단일 헬퍼로 캡슐화하여 마이그레이션 완료 시 한 곳만 제거하도록 구조화 |
| 9 | 설계 | 에러 코드 상수가 각 핸들러에 문자열 리터럴로 산재. rename 또는 오타 발생 시 전체 수동 추적 필요 | `http-request`, `code`, `send-email`, `workflow`, `database-query`, `text-classifier` 핸들러 | `backend/src/nodes/core/error-codes.ts`에 `export const NodeErrorCode = { ... } as const` 중앙화 |
| 10 | 보안 | `http-request.handler.ts` `output.error.details.url`에 원본 URL이 그대로 사용되어 `https://user:pass@host/path` 형태 자격증명 노출. `config.url`에만 `sanitizeUrlCredentials` 적용됨 | `http-request.handler.ts` non-2xx 응답 처리 및 catch 블록 | `details.url` 필드에도 동일하게 `sanitizeUrlCredentials(url)` 적용 |
| 11 | 보안 | `code.handler.ts` `output.error.details.stack` 및 `meta.stack`에 스택 트레이스 포함. 프로덕션에서 내부 파일 경로, 프레임워크 버전 노출 | `code.handler.ts` | `NODE_ENV`에 따라 프로덕션에서 스택 트레이스 제거; `meta.stack`은 내부 로깅으로만 사용 |
| 12 | 관찰성 | `presentation handlers` (carousel, chart, table, template, form) `meta.durationMs: 0` 하드코딩. 실제 핸들러 실행 시간이 monitoring 데이터에서 0으로 표시 | 각 presentation 핸들러 waiting-state 반환값 | `const startedAt = Date.now()` 후 `durationMs: Date.now() - startedAt` 사용; 또는 waiting 상태에서 측정 불가임을 명시 |
| 13 | 테스트 누락 | `http-request.handler.spec.ts` URL sanitize 테스트에서 자격증명 없는 URL(무변환), malformed URL(regex fallback), catch 경로에서의 sanitize 케이스 미검증 | `http-request.handler.spec.ts` | 3가지 케이스 추가 |
| 14 | 테스트 누락 | `information-extractor.schema.spec.ts`에 신규 waiting shape (`output.partial.{extracted, missingFields}`) 픽스처 테스트 없음. 스키마 테스트가 여전히 legacy `conversationConfig` 형태만 검증 | `information-extractor.schema.spec.ts` | 신규 waiting shape 픽스처 테스트 추가 |
| 15 | 테스트 누락 | `output-shape.ts` `isConversationOutput`의 신규 `looksLikeConversationEnd` 경로 테스트 없음 | `output-shape.test.ts` | `output.result.messages + endReason: 'completed'` 조합이 `true` 반환하는 케이스 추가 |
| 16 | 테스트 누락 | `conversation-utils.ts`, `conversation-inspector.tsx` 레거시 fallback 경로 (`output.messages` 등) 단위 테스트 없음 | 프론트엔드 conversation 관련 파일 | `output.result.messages`(신규) → `output.messages`(레거시) fallback 및 `meta.turnDebug` 경로 검증 테스트 추가 |
| 17 | 테스트 누락 | spec에 정의된 Parallel 컨테이너 `{ branches, count }` 출력 형태 검증이 `execution-engine.service.spec.ts`에 없음 | `execution-engine.service.spec.ts` | Parallel `done` 포트 출력 형태 검증 케이스 추가 |
| 18 | 데이터베이스 | 마이그레이션 스크립트 N+1 쿼리 패턴. 워크플로우 수만큼 개별 노드 쿼리 순차 실행 | `migrate-node-output-refs.ts` 420–453행 | 단일 쿼리로 JOIN 또는 `IN (...)` 배치 조회 후 메모리에서 그룹핑 |
| 19 | 데이터베이스 | 마이그레이션 스크립트 멱등성 보장 없음. `--apply` 이중 실행 시 일부 패스가 이미 변환된 경로를 다시 변환할 수 있음 | `migrate-node-output-refs.ts` | audit_log 조회로 기 적용 마이그레이션 감지, 또는 migration 버전 테이블 도입 |
| 20 | 문서화 | Workflow 노드 `error` 포트 추가 및 `SUB_WORKFLOW_FAILED` 에러 라우팅 동작이 spec 문서에 미기재 | `spec/4-nodes/1-logic-nodes.md`, `workflow.schema.ts` | spec 문서에 workflow 노드 에러 포트 동작 문서화 |
| 21 | 문서화 | `send-email.schema.ts`에 `error` 포트 추가됐으나 대응하는 spec 문서 변경 없음 | `send-email.schema.ts`, spec 관련 문서 | spec 및 사용자 문서에 send-email 노드 에러 포트와 가능한 에러 코드 추가 |
| 22 | 문서화 | 사용자 문서 업데이트가 Information Extractor에만 한정. AI Agent `output.result.response`, Text Classifier `output.result.category` 등 동일한 구조 변경을 받은 노드들 미반영 | `frontend/src/content/docs/02-nodes/ai.mdx` | AI Agent, Text Classifier expression 예제도 신규 경로로 업데이트 |
| 23 | 문서화 | `handler-output.adapter.ts` JSDoc이 "레거시 포트 셀렉터가 제거됨"으로 기술하나, 실제로는 bare-object coercion 분기가 잔존하여 문서와 동작 불일치 | `handler-output.adapter.ts` 상단 JSDoc | JSDoc을 "isLegacyPortSelector 제거됨, bare-object coercion은 테스트 더블을 위해 유지됨"으로 수정 |
| 24 | 범위 이탈 | `frontend/presentation-renderers.tsx` `output.interaction.data` 참조가 아직 구현되지 않은 Stage 3를 선행 참조. `legacyData` fallback으로 런타임 오류는 없으나 잘못된 기대치를 코드에 삽입 | `presentation-renderers.tsx` `FormSubmittedContent` | Stage 3 구현 시점에 이동하거나 명확한 TODO 주석 표시 |
| 25 | 범위 이탈 | `output-shape.ts`의 `output.partial.*` 경로 처리가 아직 구현되지 않은 Stage 2를 선행 참조 | `output-shape.ts` `extractIeSnapshot` | Stage 2 구현 시 함께 추가하거나 dead-code임을 명확히 표시 |
| 26 | 보안 | `text-classifier.handler.ts` `details.originalInput`, `send-email.handler.ts` `details.to, subject` 등 PII가 에러 응답에 포함 | 각 핸들러 catch 블록 | `originalInput` 길이 제한 후 truncate; 이메일 주소 마스킹 처리 고려 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성 | `_resumeState` 동시 재개 시 동일 stale 스냅샷이 두 재개 요청에 주입될 수 있음. 엔진 레벨 직렬화 보장 여부 확인 필요 | `ai-agent.handler.ts`, `execution-engine.service.ts` | 동일 `executionId` resume 요청 직렬화 검증; 필요 시 버전 카운터 또는 DB CAS로 이중 소비 방지 |
| 2 | 성능 | `send-email.handler.ts` catch 블록에서 `Date.now() - start`를 `logUsage`와 `return` 두 곳에서 각각 계산하여 `durationMs` 값 불일치 가능 | `send-email.handler.ts` catch 블록 | catch 진입 시 `const durationMs = Date.now() - start`를 한 번만 캡처 |
| 3 | 설계 | `adaptHandlerReturn`의 bare-object fallback이 프로덕션 코드에 잔존. 잘못된 핸들러 반환값이 조용히 통과되는 암묵적 계약 형성 | `handler-output.adapter.ts` | Stage 7 제거 시점을 코드 주석에 명시; TypeScript 타입 수준에서 핸들러 반환 타입 강제 검토 |
| 4 | 설계 | 컨테이너 결과 키 이름 불일치: ForEach → `items`, Loop → `iterations`, Map → `mapped`. 동일 패턴을 3가지 키로 표현하여 사용자 학습 비용 증가 | `execution-engine.service.ts`, spec 문서 | `results` 등 통일된 키 검토, 또는 현재 의미론적 선택을 명시적 설계 결정으로 스펙에 기재 |
| 5 | 의존성 | `output-shape.ts` `isConversationOutput`의 `endReason` 허용값 목록 하드코딩. 백엔드에서 새 값 추가 시 프론트엔드 판별 로직이 silent 누락 | `output-shape.ts` | 공유 타입 패키지 또는 `consts` 파일에 `END_REASONS` 배열 선언 후 양쪽 참조 |
| 6 | 문서화 | `conversation-utils.ts` `meta.turnDebug`(신규) vs `output._turnDebugHistory`(구형) fallback 체인 생명주기 및 제거 시점 미정의 | `conversation-utils.ts` | TODO 또는 GitHub Issue 링크로 레거시 경로 제거 시점 명시 |
| 7 | 문서화 | `information-extractor.schema.ts` 주석의 `_resumeState`를 "post-Stage-2 rename"으로 설명하나 실제 rename은 이 PR에서 발생. 시제 불일치 | `information-extractor.schema.ts` | 주석을 "이 PR에서 완료됨 / 다음 PR에서 예정됨" 형식으로 수정 |
| 8 | 문서화 | `ai-agent.handler.ts` 인라인 `// CONVENTIONS §N` 주석 과용. 스펙 없이는 의미 파악 불가 | `ai-agent.handler.ts` 다수 반환문 | 핸들러 클래스 상단 JSDoc에 한 번만 참조; 인라인은 비자명한 이유 있을 때만 사용 |
| 9 | 문서화 | `_resumeState` 설계 의도(expression resolver 노출 제외)가 인터페이스 JSDoc에만 있고 핸들러 코드에서 back-reference 없음 | `ai-agent.handler.ts` CONVENTIONS §4.3 주석 | `// See NodeHandlerOutput._resumeState JSDoc for rationale` 형식으로 짧게 참조 |
| 10 | 데이터베이스 | `carousel` 노드 static/dynamic 모드 구분 시 audit detail에 `config.mode` 값이 기록되지 않아 수동 검토 시 정보 부족 | `migrate-node-output-refs.ts` carousel hit 처리 | carousel 노드 hit 시 `config.mode` 값을 audit detail에 함께 기록 |
| 11 | 테스트 | `node-output-schema-enrichers.test.ts`에서 `output.result` 노드는 있지만 `output.result.extracted`가 없는 중간 케이스 미검증 | `node-output-schema-enrichers.test.ts` | 해당 중간 케이스 테스트 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| database | HIGH | 마이그레이션 스크립트 트랜잭션 부재, audit_log 임의 workspace/user 참조 |
| api_contract | HIGH | send-email dead ternary, 컨테이너 출력 shape 변경, legacy 어댑터 제거 |
| side_effect | HIGH | `_multiTurnState`→`_resumeState` 인플라이트 세션 중단, 컨테이너 출력 파손 |
| requirement | HIGH | send-email dead ternary, IE waiting shape 구현 불명확, DB 에러 코드 변경 파급 |
| documentation | HIGH | CONVENTIONS 문서 미제공, 에러 코드 레지스트리 없음 |
| testing | HIGH | send-email 에러코드 미검증, _resumeState 어댑터 테스트 없음, 코드 정규화 단언 누락 |
| security | MEDIUM | URL 자격증명 details에 노출, 스택 트레이스 output 포함 |
| maintainability | MEDIUM | send-email dead ternary (CRITICAL 포함), DRY 위반, durationMs 하드코딩 |
| architecture | MEDIUM | ISP 위반(_resumeState), DRY 위반, 이중 에러 코드 체계 |
| scope | MEDIUM | send-email dead ternary, Stage 2/3 선행 참조, 레거시 어댑터 검증 부재 |
| concurrency | LOW | _resumeState 동시 재개 스냅샷 충돌 가능성 |
| performance | LOW | send-email dead branch, URL 이중 파싱 |
| dependency | LOW | 외부 패키지 변경 없음, 내부 의존성 일부 주의사항 |

---

## 발견 없는 에이전트
없음 — 모든 13개 에이전트가 발견사항을 보고함

---

## 권장 조치사항

1. **[즉시 필수]** `send-email.handler.ts` dead ternary 수정: `err instanceof IntegrationError ? err.code : 'EMAIL_SEND_FAILED'`
2. **[배포 전 필수]** `_multiTurnState` → `_resumeState` 필드명 변경 하위호환 처리: 엔진 resume 경로에 `_resumeState ?? _multiTurnState` fallback 추가, 또는 인플라이트 멀티턴 세션 없음을 배포 전 확인
3. **[배포 전 필수]** 마이그레이션 스크립트가 컨테이너 출력 참조(`output[0]` → `output.items[0]` 등) 및 Information Extractor 경로(`output.extracted` → `output.result.extracted`)를 변환하는지 검증
4. **[배포 전 필수]** 마이그레이션 스크립트를 트랜잭션으로 래핑하여 부분 적용 방지
5. **[High Priority]** `http-request.handler.ts` `output.error.details.url`에 `sanitizeUrlCredentials` 적용하여 자격증명 노출 차단
6. **[High Priority]** `handler-output.adapter.ts` `_resumeState` 처리 경로 테스트 추가; `code.handler.ts` 에러 코드 정규화 단언 추가
7. **[Medium Priority]** 에러 코드 상수를 `error-codes.ts`로 중앙화; 변경된 에러 코드(`QUERY_FAILED` → `DB_QUERY_FAILED`)를 CHANGELOG에 breaking change로 기재
8. **[Medium Priority]** CONVENTIONS/Principle 문서 경로를 `CLAUDE.md` 또는 `spec/`에 명시하여 참조 추적성 확보
9. **[Medium Priority]** `NodeHandlerOutput`에서 `_resumeState`를 `ResumableHandlerOutput` 서브타입으로 분리하여 ISP 위반 해소
10. **[Medium Priority]** 프론트엔드 이중 경로 fallback 패턴을 `resolveResultField(output, key)` 헬퍼로 캡슐화
11. **[Medium Priority]** AI Agent, Text Classifier 사용자 문서를 신규 expression 경로로 업데이트; workflow/send-email 에러 포트를 spec 문서에 기재
12. **[Low Priority]** presentation 핸들러 `durationMs: 0` 하드코딩을 실측값으로 교체; `code.handler.ts` 이중 에러 코드 체계 정리; 레거시 fallback 레이어에 제거 시점 TODO 명시