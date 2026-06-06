# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] ROOT_ENTITIES 분리 — re-export 체인의 의도된 변경
- 위치: `codebase/backend/src/app.module.ts`, `codebase/backend/src/database/root-entities.ts`
- 상세: `app.module.ts` 에서 `ROOT_ENTITIES` 정의를 `./database/root-entities.ts` 로 옮기고 `export { ROOT_ENTITIES } from './database/root-entities'` 로 re-export 한다. 기존에 `import { ROOT_ENTITIES } from '..../app.module'` 하던 `app.module.spec.ts` 등의 호출자는 re-export 덕분에 경로 변경 없이 동일하게 동작한다. 실질적 부작용 없음. 단 직접 `./database/root-entities` 를 import 하는 신규 경로(EvalCliModule 등)가 생겼으므로, 향후 entity 를 `app.module` 쪽에만 추가하면 EvalCliModule 에서 누락될 수 있다 — 유지보수 주의 사항이나 현재 코드에서는 문제 없음.

### [INFO] EvalCliModule — TypeORM 연결 신규 생성
- 위치: `codebase/backend/src/modules/knowledge-base/eval/eval-cli.module.ts`, `TypeOrmModule.forRootAsync`
- 상세: CLI 스크립트 실행 시 `NestFactory.createApplicationContext(EvalCliModule)` 가 독립적인 TypeORM 커넥션 풀을 열고, `app.close()` 로 닫는다. 이 연결은 런타임 AppModule 과 완전히 분리된 별도 프로세스에서만 실행되므로 운영 서버 상태에 영향 없다. `synchronize: false` 가 명시돼 있어 schema auto-sync 부작용도 없다.

### [INFO] LlmService.chat — 제품 LLM 과금 유발
- 위치: `codebase/backend/src/scripts/generate-golden-set.ts` lines 189-256
- 상세: `generate-golden-set.ts` 는 제품 자체 `LlmService.chat()` 을 호출한다. 이는 의도된 설계(plan D-E3)이나, 이 스크립트를 실행하면 실제 LLM API 과금이 발생한다. CI 에서 자동 실행되도록 구성될 경우 예상치 못한 과금 부작용이 될 수 있다. `--dry-run` 플래그가 제공되어 있으므로 CI 사용 시 활용 가능하다.

### [INFO] generate-golden-set.ts — 파일시스템 쓰기 (`writeFileSync` + `mkdirSync`)
- 위치: `codebase/backend/src/scripts/generate-golden-set.ts` lines 325-326
- 상세: `--out` 경로(기본 `eval/golden.json`)에 파일을 생성·덮어쓰며, 부모 디렉터리가 없으면 `mkdirSync(..., { recursive: true })` 로 자동 생성한다. 의도된 동작이고 `--dry-run` 으로 우회 가능하다. `reviewed: true` 인 기존 entry 는 덮어쓰지 않는 검수 결과 보존 로직도 올바르게 동작한다.

### [INFO] eval-retrieval.ts — 조건부 파일시스템 쓰기 (`writeFileSync`)
- 위치: `codebase/backend/src/scripts/eval-retrieval.ts` lines 1922-1925 (diff 기준)
- 상세: `--out` 인자 지정 시에만 리포트 JSON 을 기록한다. 의도된 동작이다. 단 `--out` 경로의 부모 디렉터리가 없으면 `ENOENT` 로 실패하는데, `generate-golden-set.ts` 와 달리 `mkdirSync` 가 없다. 사소한 UX 문제이나 의도치 않은 부작용은 아니다.

### [INFO] lang-detect.ts — 모듈 수준 RegExp 전역 플래그(`/g`) 공유
- 위치: `codebase/backend/src/modules/knowledge-base/eval/lang-detect.ts` lines 1160-1161 (diff 기준)
- 상세: `HANGUL_RE = /[가-힣...]/g` 와 `LATIN_RE = /[A-Za-z]/g` 가 모듈 수준 상수다. `String.prototype.match(regexp)` 에 global regex 를 넘기면 `lastIndex` 가 변경되지 않아 현재 `.match()` 사용 패턴에서는 안전하다. 그러나 미래에 `.test()` 로 교체하거나 이 상수를 외부로 노출할 경우 `lastIndex` 오염 위험이 있다.

### [INFO] retrieval-metrics.ts — 순수 함수, 부작용 없음
- 위치: `codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.ts`
- 상세: 모든 export 함수는 입력만으로 결과를 결정하는 순수 함수다. `orderRetrieved` 는 `[...retrieved]` 로 spread 복사 후 정렬해 입력 배열을 변형하지 않는다. 전역 상태·파일·네트워크·이벤트 조작 없음.

### [INFO] .gitignore 추가 — eval 산출물 커밋 방지
- 위치: `codebase/backend/.gitignore`
- 상세: `eval/golden.json` 과 `eval/*.report.json` 을 git 추적에서 제외한다. 신규 파일이므로 기존 커밋된 상태 없음 — 부작용 없다.

### [INFO] package.json 신규 스크립트 — 기존 스크립트 무영향
- 위치: `codebase/backend/package.json`
- 상세: `eval:golden:generate` 와 `eval:retrieval` 는 신규 추가이며 기존 스크립트와 이름이 겹치지 않는다. 추가만으로 기존 동작에 영향 없음.

---

## 요약

이번 변경은 RAG 평가 하네스 신규 도입으로, 기존 운영 코드에 대한 부작용이 없다. `ROOT_ENTITIES` 분리는 re-export 로 기존 호출자 호환을 유지하며, `EvalCliModule` 은 독립 프로세스 CLI 전용이라 운영 서버 상태(큐·워커·DB 커넥션)를 건드리지 않는다. `retrieval-metrics.ts` 는 완전한 순수 함수다. 주목할 점은 `generate-golden-set.ts` 가 제품 LLM API 를 직접 호출해 실제 과금을 유발한다는 것인데, 이는 의도된 설계(D-E3)이고 `--dry-run` 으로 억제 가능하므로 CI 에서의 무심한 실행만 주의하면 된다. `lang-detect.ts` 의 모듈 수준 `/g` RegExp 는 현재 `.match()` 사용 컨텍스트에서는 안전하나 향후 `.test()` 혼용 시 주의가 필요하다. 전반적으로 의도치 않은 상태 변경, 전역 변수 오염, 시그니처 파손, API 변경, 환경 변수 오염, 이벤트/콜백 변경은 발견되지 않았다.

---

## 위험도

LOW
