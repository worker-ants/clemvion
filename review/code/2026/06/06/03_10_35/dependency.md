# 의존성(Dependency) 리뷰

검토 대상: RAG 평가 하베스 (P0 Phase 0+1) — codebase/backend eval 모듈 신규 추가 (2차 리뷰)
검토 일시: 2026-06-06

---

## 발견사항

### [INFO] 신규 외부 패키지 추가 없음 — 의존성 증가 0
- 위치: `codebase/backend/package.json`
- 상세: 이번 변경에서 `package.json` 의 `dependencies` 또는 `devDependencies` 섹션에 신규 외부 패키지가 추가되지 않았다. 두 npm scripts(`eval:golden:generate`, `eval:retrieval`)만 추가되었을 뿐이다.
- 제안: 없음. 의존성 최소화 원칙을 잘 지키고 있다.

---

### [INFO] `p-limit@^7.3.0` — 기존 `dependencies` 재활용, 적절한 선택
- 위치: `codebase/backend/src/scripts/eval-retrieval.ts` (line 25), `codebase/backend/src/scripts/generate-golden-set.ts` (line 25)
- 상세: `p-limit`은 `package.json` `dependencies` 섹션에 `^7.3.0`으로 이미 등록된 패키지다. eval 러너(`SEARCH_CONCURRENCY=4`)와 생성기(`CHUNK_LLM_CONCURRENCY=4`) 양쪽에서 동시성 제한에 재활용하는 것은 기존 의존성을 올바르게 활용한 패턴이다. 신규 패키지 없음.
- 제안: 없음.

---

### [INFO] `zod@^4.3.6` — 기존 `dependencies` 재활용, 런타임 스키마 검증에 적절히 활용
- 위치: `codebase/backend/src/scripts/eval-retrieval.ts` (line 26), `codebase/backend/package.json` (line 82)
- 상세: `zod`는 이미 `dependencies`에 등록된 패키지이며, `eval-retrieval.ts`에서 `GoldenSetSchema`를 통한 런타임 입력 검증에 활용된다. 이전 리뷰(02_39_25)에서 제기된 "zod 런타임 스키마 검증 추가" 권고가 이미 반영된 상태이다.
- 제안: 없음. 기존 의존성의 올바른 재활용이다.

---

### [INFO] `ts-node@^10.9.2`, `tsconfig-paths@^4.2.0` — `devDependencies` 재활용
- 위치: `codebase/backend/package.json` scripts 섹션 (lines 18-19), `devDependencies`
- 상세: 두 신규 npm scripts(`eval:golden:generate`, `eval:retrieval`) 모두 기존 `devDependencies`의 `ts-node -r tsconfig-paths/register` 패턴을 사용한다. `cleanup:queue-jobs`, `encrypt-auth-config` 등 기존 스크립트와 동일한 실행 패턴으로 일관성이 있다. 신규 전역 도구 의존 없음.
- 제안: 없음.

---

### [INFO] 버전 고정 — `^` 범위 지정 (기존 정책과 일치)
- 위치: `codebase/backend/package.json` 전반
- 상세: 이번 변경으로 신규 패키지가 추가되지 않았으므로 버전 고정 문제는 발생하지 않는다. 기존 `p-limit@^7.3.0`, `zod@^4.3.6` 등 재활용 패키지들은 `^` 범위 지정을 사용하고 있으며, 이는 프로젝트 전체의 일관된 정책이다.
- 제안: 없음. 신규 패키지가 추가될 경우에는 동일한 `^` 범위 정책을 따를 것.

---

### [INFO] 내부 의존 관계 — `ROOT_ENTITIES` 분리로 순환 의존 위험 해소
- 위치: `codebase/backend/src/database/root-entities.ts` (신규), `codebase/backend/src/app.module.ts`
- 상세: `EvalCliModule`이 `AppModule` 전체를 import하면 BullMQ 큐·프로세서 등 운영 모듈이 transitive로 기동된다. `ROOT_ENTITIES`를 `src/database/root-entities.ts`로 분리하고 `EvalCliModule`이 이 파일만 직접 참조함으로써 운영 모듈 의존 사슬을 차단했다. `app.module.ts`는 `export { ROOT_ENTITIES } from './database/root-entities'`로 re-export하여 기존 import 사이트 호환을 유지한다.
- 제안: 없음. 내부 의존 관계 설계가 올바르다.

---

### [INFO] `EvalCliModule` 내부 의존 — `LlmModule`, `RerankConfigModule`, `RagSearchService`, `RerankService`, `RerankClientFactory`
- 위치: `codebase/backend/src/modules/knowledge-base/eval/eval-cli.module.ts`
- 상세: 모두 프로젝트 내부 모듈이며 외부 패키지 의존이 없다. `BullMQ` 큐·프로세서 모듈이 명시적으로 배제되어 있다. `ROOT_ENTITIES` 전체를 TypeORM 엔티티로 등록하는 것은 관계 타깃(예: `LlmConfig->Workspace`) 메타데이터 누락 방지 목적이며 코드 주석에 사유가 명시되어 있다. 큐/프로세서 모듈이 DI 그래프에 없으므로 등록만으로 인스턴스화되지 않는다.
- 제안: 중장기적으로는 eval에 실제 필요한 entity(`KnowledgeBase`, `DocumentChunk`, `LlmConfig`, `RerankConfig`, `Workspace` 등)만 `EVAL_CLI_ENTITIES` 배열로 분리하면 결합도를 낮출 수 있다. 단기 차단 사항은 아님.

---

### [INFO] `lang-detect.ts` — 외부 의존 0, 표준 JS 정규식만 사용
- 위치: `codebase/backend/src/modules/knowledge-base/eval/lang-detect.ts`
- 상세: `franc`, `langdetect`, `cld3` 등 외부 NLP 라이브러리 없이 정규표현식 비율 기반 언어 감지를 구현했다. 번들 크기 영향 없음.
- 제안: 없음.

---

### [INFO] `retrieval-metrics.ts` — 외부 의존 0, 순수 TypeScript
- 위치: `codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.ts`
- 상세: Recall@k, Precision@k, MRR, nDCG@k, Hit-rate@k 지표 계산 전체를 `mathjs`, `ml-confusion-matrix` 등 수치 라이브러리 없이 표준 TypeScript로 구현했다. 유일한 import는 내부 타입 파일(`golden-set.types.ts`)이다.
- 제안: 없음.

---

### [INFO] `.gitignore` 추가 — eval 산출물 누출 방지
- 위치: `codebase/backend/.gitignore`
- 상세: `eval/golden.json`(실 고객 데이터 포함 가능)과 `eval/*.report.json`(검색 리포트)을 git 추적에서 제외했다. 의존성 관점에서 이 파일들이 실수로 커밋되어 민감 데이터가 repo에 포함되는 것을 예방하는 올바른 처리다.
- 제안: 없음.

---

### [INFO] 라이선스 — 신규 외부 패키지 없으므로 신규 라이선스 검토 불필요
- 위치: 변경 전체
- 상세: 이번 변경에서 신규 외부 패키지가 추가되지 않았으므로 새로운 라이선스 호환성 검토는 필요하지 않다. 기존 재활용 패키지(`p-limit`: MIT, `zod`: MIT)는 프로젝트와 라이선스 호환이 이미 확인된 상태다.
- 제안: 없음.

---

### [INFO] 취약점 — 신규 외부 패키지 없으므로 신규 취약점 노출 없음
- 위치: 변경 전체
- 상세: 신규 외부 패키지가 추가되지 않았으므로 새로운 CVE 노출 위험이 없다. `p-limit@7.x`, `zod@4.x`는 현재 알려진 고위험 CVE가 없다.
- 제안: 없음.

---

## 요약

이번 RAG 평가 하베스 변경은 의존성 관점에서 매우 양호하다. 신규 외부 패키지가 단 하나도 추가되지 않았으며, `p-limit`, `zod`, `ts-node`, `tsconfig-paths` 모두 기존 등록 의존성의 재활용이다. 언어 감지(`lang-detect.ts`)와 검색 지표(`retrieval-metrics.ts`)를 순수 TypeScript로 구현하여 번들 크기·취약점 노출 증가가 0이다. 내부 의존 관계 측면에서는 `ROOT_ENTITIES` 전용 파일 분리가 `EvalCliModule`과 `AppModule` 간의 transitive 의존 사슬을 차단하는 설계로 올바르게 이루어졌다. 모든 발견사항이 INFO 수준이며 차단·경고가 필요한 항목은 없다.

---

## 위험도

NONE
