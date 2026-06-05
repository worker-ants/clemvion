# 의존성(Dependency) 코드 리뷰

검토 대상: RAG 평가 하베스 (P0 Phase 0+1) — codebase/backend eval 모듈 신규 추가
검토 일시: 2026-06-06

---

## 발견사항

### [INFO] `p-limit` 사용 — 기존 의존성이며 적절한 선택
- 위치: `codebase/backend/src/scripts/eval-retrieval.ts` — `import pLimit from 'p-limit'`
- 상세: `p-limit@^7.3.0` 은 `package.json` `dependencies` 에 이미 등록되어 있다. eval 러너에서 검색 동시성 제한(`SEARCH_CONCURRENCY = 4`)에 사용하는 것은 기존 의존성을 재활용하는 올바른 패턴이다. 새 외부 패키지 추가 없음.
- 제안: 없음.

### [INFO] 새 npm scripts(`eval:golden:generate`, `eval:retrieval`) — 기존 `ts-node`/`tsconfig-paths` 활용
- 위치: `codebase/backend/package.json` scripts 섹션
- 상세: 두 스크립트 모두 기존 devDependencies(`ts-node@^10.9.2`, `tsconfig-paths@^4.2.0`)만 사용하며 신규 전역 툴 의존 없음. 현재 다른 스크립트들(`cleanup:queue-jobs`, `encrypt-auth-config` 등)도 동일 패턴 사용 중.
- 제안: 없음.

### [WARNING] `generate-golden-set.ts` binary 커밋 — 소스 가시성 차단
- 위치: `codebase/backend/src/scripts/generate-golden-set.ts`
- 상세: diff 가 `Binary files /dev/null and b/... differ` 로만 표시된다. TypeScript 소스 파일이 binary diff 로 기록되는 경우는 (1) `.gitattributes` 의 잘못된 필터, (2) 실수로 바이너리 파일이 커밋된 경우, (3) diff 생성 도구의 설정 문제일 수 있다. 실제 파일이 텍스트이더라도 이 상태에서는 코드 리뷰·의존성 분석·보안 감사가 모두 차단된다. 특히 이 파일은 LLM API 를 호출하는 골든셋 생성기이므로 내부에서 외부 SDK 를 직접 import 하거나 `subprocess.run(["claude", "-p", ...])` 패턴을 쓰는지 확인하지 못한다.
- 제안: `file src/scripts/generate-golden-set.ts` 로 파일 타입 확인. 텍스트임에도 binary 로 보인다면 `.gitattributes` 점검 후 재커밋.

### [INFO] 내부 의존성 분리 — `ROOT_ENTITIES` 전용 파일 추출
- 위치: `codebase/backend/src/database/root-entities.ts` (신규), `codebase/backend/src/app.module.ts` (변경)
- 상세: `ROOT_ENTITIES` 를 `app.module.ts` 에서 `src/database/root-entities.ts` 로 분리하고 `app.module.ts` 에서 re-export. `EvalCliModule` 이 전체 `AppModule` 을 부트스트랩하지 않고 entity 목록만 가져와 BullMQ 큐·워커 기동을 막기 위한 의존 관계 최소화 패턴이다. 기존 import 사이트(`app.module.spec.ts` 등) 호환이 유지된다.
- 제안: 없음. 패턴이 올바르고 의도가 주석으로 잘 문서화되어 있다.

### [INFO] `EvalCliModule` — 운영 모듈 의존 최소화 및 큐 미등록 확인
- 위치: `codebase/backend/src/modules/knowledge-base/eval/eval-cli.module.ts`
- 상세: `LlmModule`, `RerankConfigModule`, `RagSearchService`, `RerankService`, `RerankClientFactory` 만 포함하며 `BullMQ` 큐/프로세서 모듈은 명시적으로 배제됨. `ROOT_ENTITIES` 전체를 TypeORM 엔티티로 등록하는 것은 관계 타깃 누락 방지를 위한 불가피한 선택이며 코드 주석에 이유가 명시되어 있다.
- 제안: 없음.

### [INFO] `lang-detect.ts` — 외부 의존 0, 표준 라이브러리만 사용
- 위치: `codebase/backend/src/modules/knowledge-base/eval/lang-detect.ts`
- 상세: 정규표현식만으로 한글/라틴 비율 기반 언어 감지를 구현. `franc`, `langdetect` 등 외부 NLP 라이브러리 없이 구현하여 의존성 추가 없음.
- 제안: 없음.

### [INFO] `retrieval-metrics.ts` — 외부 의존 0, 순수 TS 구현
- 위치: `codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.ts`
- 상세: Recall@k, Precision@k, MRR, nDCG@k, Hit-rate@k 등 모든 검색 지표를 외부 수치 라이브러리(`mathjs`, `ml-confusion-matrix` 등) 없이 표준 TypeScript 로 구현. LLM 호출 없음.
- 제안: 없음.

### [INFO] `eval/*.report.json` gitignore 추가 — 리포트 파일 누출 방지
- 위치: `codebase/backend/.gitignore`
- 상세: `eval/golden.json` 과 `eval/*.report.json` 을 gitignore 에 추가. 리포트가 고객 문서 식별자를 포함할 수 있다는 주석이 명시되어 있고, 커밋 제외 정책이 명확하다.
- 제안: 없음.

---

## 요약

이번 변경의 의존성 관점 핵심: 신규 외부 패키지는 단 하나도 추가되지 않았다. `p-limit`, `ts-node`, `tsconfig-paths` 는 모두 기존 등록 의존성 재활용이다. 언어 감지(`lang-detect.ts`)와 검색 지표(`retrieval-metrics.ts`)는 순수 TypeScript 로 구현하여 번들 크기·취약점 위험이 0이다. 내부 의존성 관점에서는 `ROOT_ENTITIES` 전용 파일 분리가 적절하게 이루어졌고, `EvalCliModule` 이 운영 큐·워커를 기동하지 않도록 의존 그래프가 신중히 설계되었다. 유일한 주의 항목은 `generate-golden-set.ts` 가 binary diff 로 표시되어 TypeScript 소스의 의존성 및 LLM 호출 경로를 코드 리뷰에서 직접 확인할 수 없다는 점이다.

---

## 위험도

LOW
