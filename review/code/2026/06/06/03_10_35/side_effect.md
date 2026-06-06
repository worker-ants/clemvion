# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] ROOT_ENTITIES 분리 — app.module.ts re-export 로 기존 import 사이트 호환 유지
- 위치: `codebase/backend/src/app.module.ts` (line 65), `codebase/backend/src/database/root-entities.ts`
- 상세: `ROOT_ENTITIES` 를 `src/database/root-entities.ts` 로 분리했지만 `app.module.ts` 에서 `export { ROOT_ENTITIES } from './database/root-entities'` re-export 를 유지한다. 기존에 `import { ROOT_ENTITIES } from '…/app.module'` 로 참조하던 모든 사이트(app.module.spec 등)에 시그니처 변경이 없으므로 의도치 않은 부작용이 없다.
- 제안: 없음. 변경 방향 올바름.

---

### [INFO] EvalCliModule — 독립 DI 컨텍스트로 BullMQ 워커 미기동
- 위치: `codebase/backend/src/modules/knowledge-base/eval/eval-cli.module.ts`
- 상세: `NestFactory.createApplicationContext(EvalCliModule)` 을 통해 부팅되는 DI 컨텍스트는 `KnowledgeBaseModule` 을 포함하지 않는다. BullMQ 큐·프로세서(`document-embedding`, `graph-extraction`, `stuck-recovery`)는 `KnowledgeBaseModule` 에서 등록되므로 CLI 부팅 시 운영 워커가 기동되지 않는다. 이는 의도된 설계이며 전역/공유 상태에 대한 의도치 않은 변경이 없다.
- 제안: 없음.

---

### [WARNING] generate-golden-set.ts — --out 경로에 CWD 경계 가드 누락
- 위치: `codebase/backend/src/scripts/generate-golden-set.ts` (line 172, 316–317)
- 상세: `outPath` 는 `resolve(process.cwd(), parseCliFlag('--out') ?? DEFAULT_OUT)` 으로 결정되며, `--dry-run` 이 없는 경우 `mkdirSync(dirname(outPath), { recursive: true })` 로 디렉터리를 생성하고 `writeFileSync(outPath, ...)` 로 파일을 기록한다. `eval-retrieval.ts` 에는 `outPath` 가 `resolve(process.cwd())` 로 시작하는지 확인하는 CWD 경계 가드(line 129–135)가 있으나 `generate-golden-set.ts` 에는 동일 가드가 누락되어 있다. `--out ../../etc/somefile` 등으로 CWD 밖 임의 경로에 파일 생성 및 디렉터리 생성이 가능하다.
- 제안: `eval-retrieval.ts` (line 129–135)와 동일한 패턴을 적용한다.
  ```typescript
  const outAbs = resolve(process.cwd(), parseCliFlag('--out') ?? DEFAULT_OUT);
  if (!outAbs.startsWith(resolve(process.cwd()))) {
    console.error(`--out 경로가 현재 디렉터리 밖을 가리킵니다: ${outAbs}`);
    process.exit(1);
  }
  ```

---

### [INFO] generate-golden-set.ts — 기존 golden.json 병합 시 reviewed:true entry 보존
- 위치: `codebase/backend/src/scripts/generate-golden-set.ts` (line 301–304)
- 상세: 재실행 시 기존 파일을 로드해 `reviewed:true` entry 는 덮어쓰지 않는다(검수 결과 보존). 이는 의도된 동작이며 기존 데이터에 대한 의도치 않은 상태 변경이 없다.
- 제안: 없음. 동작 보장이 README 와 일치한다.

---

### [INFO] eval-retrieval.ts — --out 파일 쓰기 CWD 경계 가드 적용됨
- 위치: `codebase/backend/src/scripts/eval-retrieval.ts` (line 129–135)
- 상세: `outPath` 가 `resolve(process.cwd())` 시작 여부를 사전 검증한다. 파일시스템 부작용(외부 디렉터리 쓰기)이 방지되어 있다.
- 제안: 없음.

---

### [INFO] lang-detect.ts — module-level 전역 정규식 객체(/g 플래그) lastIndex 리셋 명시
- 위치: `codebase/backend/src/modules/knowledge-base/eval/lang-detect.ts` (line 9–10, 57)
- 상세: `HANGUL_RE`/`LATIN_RE` 는 `/g` 플래그가 있는 모듈-레벨 상수다. `/g` 정규식은 `lastIndex` 상태를 가지므로 `re.exec()` 반복 사용 시 이전 호출의 `lastIndex` 가 다음 호출에 영향을 줄 수 있다. `countMatches` 함수가 `re.lastIndex = 0` 리셋을 명시적으로 수행하므로 재진입 안전성 문제는 없다. Node.js 단일 스레드이므로 실질적 위험도 없다.
- 제안: 없음. 현재 구현에서 `lastIndex` 리셋이 명시돼 있어 부작용이 없다.

---

### [INFO] retrieval-metrics.ts — 순수 함수 집합, 전역 상태 변경 없음
- 위치: `codebase/backend/src/modules/knowledge-base/eval/retrieval-metrics.ts`
- 상세: 모든 공개 함수(`recallAtK`, `precisionAtK`, `hitRateAtK`, `mrrAtK`, `ndcgAtK`, `evaluateRetrieval`)는 전역 변수를 수정하지 않으며, 입력 배열에 대해 `[...retrieved].sort()` 복사본 정렬을 사용해 호출자의 배열을 변경하지 않는다. 완전한 순수 함수 집합이다.
- 제안: 없음.

---

### [INFO] package.json — npm scripts 추가, 기존 scripts 충돌 없음
- 위치: `codebase/backend/package.json`
- 상세: `eval:golden:generate`, `eval:retrieval` 두 스크립트는 기존 `ts-node -r tsconfig-paths/register` 패턴을 재사용한다. 기존 스크립트와 이름 충돌이 없으며, 명시적 호출 없이는 실행되지 않는다. 신규 전역 의존성 없음.
- 제안: 없음.

---

### [INFO] EvalCliModule — ConfigModule.forRoot(isGlobal:true) 재선언, CLI 단독 프로세스에서 안전
- 위치: `codebase/backend/src/modules/knowledge-base/eval/eval-cli.module.ts` (line 411–416)
- 상세: `EvalCliModule` 은 CLI 전용 독립 DI 컨텍스트(`createApplicationContext`)로 부팅되므로 `AppModule` 의 `ConfigModule` 과 충돌하지 않는다. CLI 스크립트는 단독 프로세스로 실행되며 동일 프로세스에서 두 컨텍스트가 활성화되는 시나리오가 없다.
- 제안: 없음.

---

### [INFO] generate-golden-set.ts main() — process.exit() 가 finally 블록 건너뜀
- 위치: `codebase/backend/src/scripts/generate-golden-set.ts` (line 162, 199), `codebase/backend/src/scripts/eval-retrieval.ts` (line 91, 111 등)
- 상세: 오류 조건에서 `process.exit(1/2)` 를 호출한다. `process.exit()` 는 `finally { await app.close() }` 블록을 건너뛰므로 DB 연결이 즉시 끊긴다. CLI 스크립트로의 사용이 명확하고 운영 서버 코드가 아니므로 허용 가능한 범위다.
- 제안: 진단용 INFO. CLI 스크립트 특성상 즉각 수정 불필요.

---

## 요약

이번 변경의 핵심은 RAG 평가 하베스 CLI 모듈 신규 도입과 `ROOT_ENTITIES` 분리다. 부작용 관점에서 주목할 사항은 `generate-golden-set.ts` 의 `--out` 경로에 CWD 경계 가드가 누락된 점이다 — `eval-retrieval.ts` 에는 동일 가드가 적용되어 있으나 이 파일만 빠져 있어 임의 경로로의 파일 쓰기와 디렉터리 생성이 가능하다. 나머지 변경은 부작용 관점에서 안전하다: `ROOT_ENTITIES` re-export 로 기존 import 사이트 호환이 유지되고, `EvalCliModule` 은 BullMQ 큐·워커를 기동하지 않으며, `retrieval-metrics.ts` 는 완전한 순수 함수 집합이고, `lang-detect.ts` 는 `/g` 정규식 `lastIndex` 를 명시적으로 리셋해 재진입 안전성을 보장한다. 전반적으로 의도치 않은 전역 상태 변경·네트워크 부작용·인터페이스 파손은 없으며, `generate-golden-set.ts` 의 경로 가드 누락만 WARNING 수준으로 보완이 필요하다.

## 위험도

LOW
