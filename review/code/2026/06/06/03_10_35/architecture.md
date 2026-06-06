# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] ROOT_ENTITIES 전용 파일 분리 — SRP 적절히 적용, 이전 리뷰 확인
- 위치: `/codebase/backend/src/database/root-entities.ts`, `/codebase/backend/src/app.module.ts`
- 상세: `app.module.ts` 에서 entity 목록 책임을 `root-entities.ts` 로 분리하고 re-export 하는 패턴은 이번 라운드에서도 그대로 유지되고 있다. JSDoc 에 분리 이유가 명시되어 있으며 app.module.spec 하위 호환도 유지된다. 이전 리뷰의 INFO 발견사항과 동일하며 추가 조치 불필요.
- 제안: 없음.

---

### [WARNING] EvalCliModule 이 ROOT_ENTITIES 전체(~40개) 등록 — 이전 보류(#15) 유지 확인
- 위치: `/codebase/backend/src/modules/knowledge-base/eval/eval-cli.module.ts` line 48 `entities: [...ROOT_ENTITIES]`
- 상세: 이전 리뷰에서 보류(RESOLUTION #15)된 항목이 현재 코드에 그대로 남아있다. `EvalCliModule` 이 실제로 접근하는 entity 는 검색 경로(`knowledge_base`, `document_chunk`, `llm_config`, `rerank_config`, `workspace` 관계 타깃)로 한정되나, TypeORM 관계 메타데이터 누락 방지를 위해 전체 40여개 entity 를 등록하고 있다. CLI 부트스트랩 시 모든 entity 메타데이터 초기화 비용이 발생하며, 새 entity 가 ROOT_ENTITIES 에 추가될 때마다 eval CLI 도 암묵적 영향을 받는다. 현재로서는 큐/프로세서 미인스턴스화로 운영 부작용은 없다.
- 제안: 중장기적으로 `EVAL_CLI_ENTITIES = [KnowledgeBase, DocumentChunk, LlmConfig, RerankConfig, Workspace, WorkspaceMember]` 수준의 최소 entity 집합 배열을 `root-entities.ts` 에 별도 export 하고 `eval-cli.module.ts` 에서 이를 사용하면 결합도를 낮출 수 있다. 현재 기능에 영향 없으므로 Sprint backlog 항목으로 관리 권장.

---

### [INFO] EvalCliModule — 경량 DI 컨텍스트 경계 명확, 큐 격리 설계 확인
- 위치: `/codebase/backend/src/modules/knowledge-base/eval/eval-cli.module.ts`
- 상세: `LlmModule`, `RerankConfigModule`, `RagSearchService`, `RerankService`, `RerankClientFactory` 만 포함하고 BullMQ 큐/프로세서 모듈은 배제한다. 이는 "스크립트는 AppModule 미부팅" 관례와 일치하며 운영 워커와의 경계가 명확하다. DIP(의존성 역전) 관점에서도 `RagSearchService` 에 직접 의존하되 KnowledgeBaseModule 의 큐 등록 부분을 포함하지 않는 구조가 적절하다.
- 제안: 없음.

---

### [INFO] generate-golden-set.ts — raw SQL ORDER BY 동적 인터폴레이션 보류(#16) 현황
- 위치: `/codebase/backend/src/scripts/generate-golden-set.ts` line 185, 190–193
- 상세: `orderBy = order === 'id' ? 'id' : 'random()'` 로 2가지 상수값 중 하나만 사용하므로 외부 입력이 직접 SQL 에 전달되는 구조가 아니다. 현재는 안전하나 향후 `order` 파라미터 확장 시 화이트리스트 const 매핑이 없으면 injection 위험 패턴이 될 수 있다. RESOLUTION #16 보류 상태가 적절하다.
- 제안: 현재 구조 유지. 향후 `orderBy` 확장 시 `const ORDER_MAP: Record<'random'|'id', string> = { random: 'random()', id: 'id' }` 패턴으로 안전성을 코드로 보증하도록 권장.

---

### [INFO] parseCliFlag 공통 추출(#17 fix) — DRY 원칙 적용 완료
- 위치: `/codebase/backend/src/scripts/cli-utils.ts`, `eval-retrieval.ts` line 35, `generate-golden-set.ts` line 34
- 상세: 이전 리뷰에서 WARNING 으로 지적된 두 스크립트 간 `parseCliFlag` 중복이 `cli-utils.ts` 추출로 해소되었다. 두 스크립트 모두 `import { parseCliFlag } from './cli-utils'` 로 단일 구현을 참조한다. `cli-utils.ts` 는 외부 의존 없이 `process.argv` 만 사용하는 순수 유틸리티 파일로 모듈 경계가 명확하다.
- 제안: 없음.

---

### [INFO] lang-detect.ts — exec() 루프 패턴으로 교체(#14 fix) 완료, lastIndex 리셋 명시 확인
- 위치: `/codebase/backend/src/modules/knowledge-base/eval/lang-detect.ts` lines 17–22
- 상세: 이전 리뷰 성능 경고였던 `match()` 배열 생성이 `countMatches()` exec 루프로 교체되었다. `re.lastIndex = 0` 리셋이 명시적으로 포함되어 모듈 스코프 /g 플래그 정규식 재사용의 stateful 함정을 방어한다. 단일 함수 파일로 테스트 가용성이 높고 외부 의존이 없다.
- 제안: 없음.

---

### [INFO] eval 레이어 모듈 배치 — knowledge-base 하위 위치, 경계 논의 포인트 유지
- 위치: `/codebase/backend/src/modules/knowledge-base/eval/`
- 상세: eval 관련 타입(`golden-set.types.ts`), 지표(`retrieval-metrics.ts`), CLI 모듈(`eval-cli.module.ts`), 언어 감지(`lang-detect.ts`)가 모두 `knowledge-base` 모듈 서브디렉토리에 위치한다. 현재 `RagSearchService` 에 직접 의존하므로 자연스러운 위치이나, 향후 다른 리트리버나 외부 검색 서비스도 평가하게 되면 knowledge-base 모듈 경계를 벗어날 수 있다.
- 제안: 현재 범위에서는 적절한 위치. 평가 대상이 knowledge-base 외부로 확장될 시점에 `src/modules/eval/` 독립 모듈로 분리하는 것을 고려한다.

---

### [INFO] main() 함수 과도한 책임(#18 보류) — 현행 유지
- 위치: `/codebase/backend/src/scripts/eval-retrieval.ts` `main()` 전체
- 상세: RESOLUTION #18 에서 보류된 사항으로, `main()` 함수가 CLI 파싱·NestFactory 부트스트랩·KB-workspace 조회·검색 fan-out·리포트 출력·CI 게이트 판정을 모두 처리한다. `parseCliFlag` 추출로 일부 책임이 분리되었으나 `main()` 자체의 길이와 책임 수는 유지된다. CLI 스크립트 특성상 현재 규모에서 기능 영향은 없다.
- 제안: 보류 유지가 적절하다. 스크립트가 기능 확장으로 길어지는 시점에 `resolveArgs()`, `runSearchPhase()`, `printReport()`, `checkCiGate()` 단계별 함수 분리를 Sprint backlog 에 등록 권장.

---

### [INFO] GoldenSetMeta.version 리터럴 타입 1 고정 — 스키마 버전 진화 전략 부재
- 위치: `/codebase/backend/src/modules/knowledge-base/eval/golden-set.types.ts` line 56 `version: 1;`
- 상세: `GoldenSetMeta.version` 을 `1` 리터럴 타입으로 고정했다. zod 스키마(`GoldenSetSchema`)에서도 `z.literal(1)` 로 검증하므로 버전이 다른 골든셋 파일은 파싱 시 즉시 거부된다. 스키마 변경이 생기면 타입 정의(`golden-set.types.ts`)·zod 스키마(`eval-retrieval.ts`)·로더 함수(`generate-golden-set.ts: loadExisting`) 3곳을 모두 수정해야 하며, 마이그레이션 경로가 코드에 명시되어 있지 않다.
- 제안: 즉각 차단 수준은 아니다. 향후 스키마 변경 시 `version: 1 | 2` union 타입 + versioned discriminated union 패턴 또는 마이그레이션 함수로 하위 호환을 처리하는 방향을 미리 설계해두는 것을 권장.

---

### [WARNING] generate-golden-set.ts — 에러 sanitize 패턴이 eval-retrieval.ts 와 비일관
- 위치: `/codebase/backend/src/scripts/generate-golden-set.ts` line 272–274 (청크 catch), line 329–332 (main() catch)
- 상세: 이전 리뷰 #8 fix 로 `eval-retrieval.ts` 는 모든 catch 블록에서 `err.constructor.name` 만 출력하는 sanitize 패턴이 적용되었다. 반면 `generate-golden-set.ts` 의 청크 단위 catch 블록(line 272)은 `err.message` 를 그대로 출력하고, `main()` 전체 catch 블록(line 330)은 `err` 를 그대로 `console.error` 한다. LLM API 호출 실패 시 `err.message` 에 API 키 접두어·endpoint URL·내부 연결 오류 메시지 등이 포함될 수 있어 로그를 통한 정보 노출 위험이 있다.
- 제안: `generate-golden-set.ts` 청크 catch 블록을 `const kind = err instanceof Error ? err.constructor.name : 'UnknownError'; console.warn(...)` 패턴으로, `main()` catch 블록도 동일하게 통일한다. `eval-retrieval.ts` 에 적용된 #8 fix 패턴을 그대로 적용하면 된다.

---

## 요약

이번 라운드(03_10_35)는 이전 리뷰(02_39_25) fix 이후의 코드를 재검토한 결과다. `parseCliFlag` DRY 추출(#17), Promise 캐시(#11), exec 루프(#14), zod 스키마 검증(#6), 경로 가드(#5) 등 주요 항목이 모두 적절히 반영되었다. 아키텍처 핵심인 `ROOT_ENTITIES` SRP 분리, `EvalCliModule` 경량 DI 경계, 순수 지표 함수와 CLI I/O 레이어 분리는 유효하게 유지된다. 신규 발견사항은 `generate-golden-set.ts` 의 에러 sanitize 패턴이 `eval-retrieval.ts` 와 비일관적이라는 점(WARNING)이다. 이전 보류 항목들(#15 EVAL_CLI_ENTITIES, #16 SQL 화이트리스트, #18 main() 분리)은 기능 영향 없는 중장기 기술부채로 계속 관리하는 것이 적절하다.

## 위험도

LOW
