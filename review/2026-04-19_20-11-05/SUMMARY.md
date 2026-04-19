# Code Review 통합 보고서

## 전체 위험도
**HIGH** — Migration script DB 미적용 상태에서 핸들러가 이미 신규 출력 shape를 사용 중이며, Form의 `submittedBy` 필드 소실·에러 Envelope 파괴적 변경 등 런타임 파손 위험이 즉각적으로 존재함

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API 계약 | Presentation 노드 출력 구조 Breaking Change — `output.type`, `output.layout` 등 판별자·구 필드가 제거된 상태에서 Migration script `--apply` 미실행. 기존 저장된 워크플로우 표현식이 런타임에 `undefined` 반환 | `spec/4-nodes/6-presentation-nodes.md` §1.3/2.3/3.3/5.3 | Migration script `--apply`를 핸들러 배포와 동시 또는 사전 실행. `previousOutput` shim이 Carousel에만 있고 Table/Chart/Template에는 누락 — 전체 노드에 동일하게 적용 필요 |
| 2 | API 계약 | Form 노드의 `output.submittedBy` 완전 소실 — `output.interaction.data`로의 이관 규격 없음. 감사·권한 검증 다운스트림이 기능 중단됨 | `spec/4-nodes/6-presentation-nodes.md` §4.3 | `interaction.data.submittedBy` 또는 `meta.submittedBy`로 이관 규격 명시 필요 |
| 3 | 부작용 | 에러 Envelope에서 `nodeId`, `nodeType`, `timestamp`, `originalInput` 필드 제거 — Migration script에 해당 매핑 없어 이를 참조하는 기존 표현식이 무음 파손됨 | `spec/5-system/3-error-handling.md` §3.2 | `migrate-node-output-refs.ts`에 `output.error.originalInput` → `output.error.details.originalInput`, `output.error.nodeId` 감지·경고 패스 추가 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API 계약 / 요구사항 / 부작용 | Chart 출력 형식에 `rendered` (SVG) 필드 누락 — Carousel·Table은 `output.rendered` 유지하는데 Chart만 불일치. `$node["C"].output.rendered` 참조 시 undefined | `spec/4-nodes/6-presentation-nodes.md` §3.3 | Chart 출력 예시에 `"rendered": "<svg>…</svg>"` 명시 |
| 2 | API 계약 | `status` 값 통합으로 `button_click`→`resumed` 단순 치환 시 기존 분기 로직이 항상 참이 되어 오작동 — interaction type 구분 책임이 `output.interaction.type`으로 이동함이 Migration script에 미반영 | `spec/5-system/4-execution-engine.md` §1.2.x, `migrate-node-output-refs.spec.ts` | `status === 'button_click'` 치환 시 `&& output.interaction.type === 'button_click'` 조건 추가 안내를 audit 로그에 명시 |
| 3 | 보안 | `output.error.details.originalInput`에 사용자 PII·자격증명 포함 가능. DB 영구 저장 후 표현식으로 접근 가능 | `spec/5-system/3-error-handling.md` `output.error.details` | `buildErrorEnvelope`에 allowlist 기반 필터 추가. `originalInput` 포함 제거 또는 저장 전 민감 필드 마스킹 |
| 4 | 보안 | `config` echo에 credential 포함 위험 — 에러 경로가 일반 sanitize 파이프라인을 우회하는지 불명확 | `spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md` | `buildErrorEnvelope`에서 `sanitizeConfig(config, CREDENTIAL_KEYS)` 헬퍼 강제 통과 |
| 5 | 테스트 | `buildErrorEnvelope` 헬퍼에 대응 테스트 파일 없음 — `details` 분기, ErrorCode 문자열 리터럴 일치 미검증 | `backend/src/nodes/core/error-codes.ts` | `error-codes.spec.ts` 신규 작성: `details` 포함/미포함 분기, enum 값 일치 검증 |
| 6 | 테스트 | `button_continue`→`'resumed'` 치환 테스트 누락 — 스펙에서 세 값 모두 통일 명시하나 `'button_continue'` 케이스만 빠짐 | `migrate-node-output-refs.spec.ts` `status literal unification` | `button_continue` 케이스 테스트 추가 |
| 7 | 테스트 | discriminator dropout 경고 테스트가 `carousel`만 커버 — `form`, `table`, `chart`, `template`은 미검증 | `migrate-node-output-refs.spec.ts` | `table`, `form` 등 나머지 노드 타입 케이스 추가 |
| 8 | 테스트 | `previousOutput` 필드 생명주기 테스트 없음 — Phase 3 제거 시 다운스트림 consumer 파손 감지 불가 | `spec/4-nodes/6-presentation-nodes.md` §1.3 | carousel handler spec에 `previousOutput` shape assertion + Phase 3 제거 의도 TODO 주석 추가 |
| 9 | 데이터베이스 | 과거 `NodeExecution.output_data` 레코드 마이그레이션 미언급 — Migration script는 워크플로우 설정 표현식만 재작성하고 실행 기록은 구 포맷 유지. `handler-output.adapter.ts` dual-support 로직이 Stage 7에서 제거 예정이라 타이밍 리스크 | `memory/node-specs-improvement-progress.md` 후속 3, `spec/5-system/4-execution-engine.md` §6.2 | 구 포맷 fallback 영구 유지 vs `output_data` backfill 여부 명시적 결정·문서화 필요 |
| 10 | 요구사항 | `migrate-node-output-refs.spec.ts`에서 `form.submittedData` 루트 참조(`$node["F"].output.submittedData` 전체 객체) 케이스 미커버 | `migrate-node-output-refs.spec.ts` `intra-output renames` | `submittedData` 루트 참조 테스트 케이스 추가 |
| 11 | 요구사항 | Presentation 노드 취소·타임아웃 에러 코드(`USER_CANCELLED`, `INTERACTION_TIMEOUT`) 미정의 | `backend/src/nodes/core/error-codes.ts` | interaction 에러 코드 추가 또는 spec에 취소 처리 정책 명시 |
| 12 | 문서화 | `spec/5-system/3-error-handling.md` §1.4의 레거시 에러 코드표(`NODE_EXECUTION_FAILED`, `LLM_ERROR` 등)가 신규 `error-codes.ts` enum과 공존하여 불일치 | `spec/5-system/3-error-handling.md` §1.4 | §1.4 표를 `error-codes.ts` 기준으로 갱신하거나 "최신 목록은 §3.2 참조" 크로스 링크 추가 |
| 13 | 문서화 / 유지보수성 | `§1.2.x` 임시 플레이스홀더 섹션 번호가 기존 `### 1.2`와 혼재 — 앵커 링크·교차 참조 파손 위험 | `spec/5-system/4-execution-engine.md` | `1.3` 등 실제 번호로 확정 또는 기존 섹션 번호 일괄 재정렬 |
| 14 | 부작용 | `interaction.type === 'button_click'` 보존 여부 미검증 — Pass 5가 `status` 비교 외 `interaction.type` 비교까지 오염시킬 가능성 | `migrate-node-output-refs.spec.ts` | `$node["C"].output.interaction.type === "button_click"` 케이스가 치환되지 않음을 검증하는 테스트 추가 |
| 15 | 성능 | `previousOutput`이 `output.items`·`output.rendered`를 이중 저장 — HTML 렌더링 결과가 두 벌 DB 저장됨 | `spec/4-nodes/6-presentation-nodes.md` §1.3 | Phase 3 전환 일정 단축 또는 엔진에서 즉시 strip하는 방안 권장 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 의존성 | 테스트 파일 import 경로(`../../scripts/`)가 `src/` 외부를 가리킴 — tsconfig `rootDir`/`include` 설정과 충돌 가능성 | `migrate-node-output-refs.spec.ts` L8–13 | Jest/tsconfig에서 `scripts/` 디렉터리가 transform 대상에 포함되는지 확인 |
| 2 | 유지보수성 | `ErrorCode`가 `as const` 키=값 동일 문자열 패턴으로 선언 — 키/값 불일치 실수 가능 | `backend/src/nodes/core/error-codes.ts` | 배열→`Object.fromEntries` 변환 또는 일반 `enum` 패턴 검토 (코드베이스 컨벤션 우선) |
| 3 | 유지보수성 | `buildErrorEnvelope` 반환 타입 인라인 선언 — 재사용성 낮음 | `error-codes.ts` L30–38 | `export type NodeErrorEnvelope` 명명 타입 추출 |
| 4 | 유지보수성 | `migrate-node-output-refs.spec.ts`의 `RewriteHit` 타입 인라인 반복 선언 | `migrate-node-output-refs.spec.ts` L175, 198 | 스크립트 본체에서 `export type RewriteHit` 추출 후 import |
| 5 | 유지보수성 | Spec 문서 본문에 마이그레이션 히스토리·과도기 설명 혼재 | `6-presentation-nodes.md` | 과도기 설명은 HTML 주석 또는 "Migration Notes" 섹션으로 분리 |
| 6 | 문서화 | `previousOutput` 실제 shape 미정의 — "Phase 3 제거 예정" 주석만 존재 | `spec/4-nodes/6-presentation-nodes.md` §1.3 | 포함 필드 목록 명시 또는 "내부 호환용, 외부 소비 금지" 명시 |
| 7 | 문서화 | `buildErrorEnvelope` JSDoc에 `@example` 블록 없음 | `backend/src/nodes/core/error-codes.ts` | `@example buildErrorEnvelope(ErrorCode.HTTP_5XX, 'Bad Gateway', { statusCode: 502 })` 추가 |
| 8 | 문서화 | `memory/node-specs-improvement-progress.md`의 "후속 4" 체크리스트가 이번 diff에서 완료된 항목을 반영하지 못함 | `memory/node-specs-improvement-progress.md` | 완료 항목 ✅ 표시 및 진행 로그 갱신 |
| 9 | 아키텍처 | `NodeHandlerOutput.status`가 `string` 타입으로 느슨하게 선언 — 컴파일 타임 검증 불가 | `spec/5-system/4-execution-engine.md` §5.1 | `NodeHandlerStatus` 유니온 리터럴 타입 추출 |
| 10 | 아키텍처 | LLM 노드에서 `output.error` + `output.result` 공존 — 소비자가 두 필드 모두 점검해야 함 | `spec/5-system/3-error-handling.md` §3.2 | `output.partial` 별도 필드 도입 또는 `status: 'partial'` 추가 검토 |
| 11 | 아키텍처 | Migration script 매핑 테이블(`RELOCATED_FIELDS` 등)이 중앙 집중 — 신규 노드 추가 시 OCP 위반 | `migrate-node-output-refs.spec.ts` imports | 장기적으로 각 핸들러에 `migrationHints` 정적 메타데이터 선언·자동 수집 구조 검토 |
| 12 | 요구사항 | Form §4.3 Waiting 출력에 `port` 필드 부재 — Resumed에는 있어 비대칭 | `spec/4-nodes/6-presentation-nodes.md` §4.3 | Waiting→Resumed 포트 결정 규칙을 spec에 명시 |
| 13 | 요구사항 | `execution-engine.md`의 `requires_playwright` 상태 구현 여부 불명확 | `spec/5-system/4-execution-engine.md` §1.2.x | "(Stage N에서 구현 예정)" 또는 "🚧 미구현" 주석 추가 |
| 14 | 테스트 | `rewriteExpression`에 `$node` 참조 없는 표현식의 pass-through 테스트 미존재 | `migrate-node-output-refs.spec.ts` | `$node` 없는 표현식이 원문 그대로 반환됨을 검증하는 테스트 추가 |
| 15 | 테스트 | `walkAndRewrite`에서 배열 내 null/undefined 요소, 객체 포함 혼합 배열 케이스 미커버 | `migrate-node-output-refs.spec.ts` | 혼합 배열 및 null 요소 포함 케이스 테스트 추가 |
| 16 | 보안 | `details.url`에 Basic Auth credential 포함 URL 저장 가능성 — 에러 경로의 sanitize 여부 불명확 | `spec/5-system/3-error-handling.md` HTTP 에러 예시 | 에러 `details.url`도 `sanitizeUrlCredentials()` 통과 명시 |
| 17 | 보안 | `selectedItem` 원본 데이터가 다운스트림으로 그대로 전달 — SQL/LLM 프롬프트 injection 벡터 가능 | `spec/4-nodes/6-presentation-nodes.md` Resumed 출력 | Spec에 "신뢰할 수 없는 사용자 입력으로 취급" 보안 노트 추가 |
| 18 | 성능 | `config` 전체 echo로 Dynamic Carousel의 `items` 배열 등 대용량 필드가 `NodeExecution.output_data`에 이중 저장 | `spec/4-nodes/6-presentation-nodes.md` 전체 | 대용량 배열 필드는 count-only 요약 또는 expression resolver가 `Workflow.nodes[id].config` 직접 참조 검토 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| api_contract | HIGH | Migration script 미적용 상태의 Breaking Change, Form `submittedBy` 소실, status 통합 오작동 |
| side_effect | MEDIUM | 에러 Envelope 파괴적 필드 제거 매핑 누락, `button_click` 패턴 충돌 위험 |
| security | MEDIUM | `originalInput` PII DB 영구 저장, `config` echo credential 노출 위험 |
| testing | MEDIUM | `buildErrorEnvelope` 테스트 파일 부재, `button_continue` 케이스 누락 |
| requirement | MEDIUM | Chart `rendered` 누락, `previousOutput` shape 미정의, `submittedData` 루트 참조 미커버 |
| database | LOW | `NodeExecution.output_data` 구 포맷 레코드 미마이그레이션, `main()` DB 경로 자동 테스트 부재 |
| documentation | LOW | §1.4 에러 코드표-enum 불일치, §1.2.x 비표준 섹션 번호 |
| maintainability | LOW | §1.2.x 플레이스홀더, spec 본문에 과도기 정보 혼재 |
| performance | LOW | `previousOutput` 이중 저장, `config` echo 누적 크기 증가 |
| architecture | LOW | `status` 느슨한 타입, LLM 부분 성공 시 이중 필드 소비자 부담 |
| dependency | LOW | 테스트 import 경로 `src/` 외부 참조 확인 필요 |
| scope | LOW | §1.2.x 체크리스트 이중 표시, 테스트 경로 비대칭 |
| concurrency | NONE | 동시성 관련 실행 코드 없음 |

---

## 발견 없는 에이전트
- **concurrency** — 변경된 코드에 공유 가변 상태·동시성 이슈 없음

---

## 권장 조치사항

1. **[즉시] Migration script `--apply` 실행 계획 수립** — 핸들러가 이미 신규 shape를 출력 중이므로 기존 워크플로우 표현식이 현재 파손 상태. 배포와 동시 또는 사전 실행 게이트 설정 필요
2. **[즉시] Form `submittedBy` 이관 규격 명시** — `interaction.data.submittedBy` 또는 `meta.submittedBy` 중 결정 후 spec 갱신 및 Migration script 대응 패스 추가
3. **[즉시] 에러 Envelope 필드 제거 Migration 보완** — `output.error.nodeId`, `.originalInput` 등의 감지·경고 패스를 `migrate-node-output-refs.ts`에 추가
4. **[높음] Chart 출력 spec에 `rendered` 필드 추가** — Carousel·Table과 대칭성 확보
5. **[높음] `status` 통합 치환 로직 보정** — `button_click`→`resumed` 단순 치환이 interaction type 분기를 파괴하는 케이스 audit 로그 명시 및 `interaction.type` 조건 병기 안내
6. **[높음] 테스트 보완** — `buildErrorEnvelope` spec 파일 신규 작성, `button_continue` 케이스, discriminator dropout 나머지 노드 타입, `previousOutput` lifecycle assertion 추가
7. **[중간] `NodeExecution.output_data` 구 포맷 처리 정책 결정** — dual-support 로직의 Stage 7 제거 전에 backfill 여부 명시적 결정·문서화
8. **[중간] 보안 강화** — `buildErrorEnvelope`에 민감 필드 allowlist 필터 추가, 에러 경로의 `config` sanitize 보장
9. **[낮음] §1.2.x 섹션 번호 확정** — 임시 플레이스홀더 제거 및 번호 체계 정리
10. **[낮음] `previousOutput` 제거 일정 명시** — Stage 7 선행 조건 목록에 `previousOutput` 제거 항목 추가