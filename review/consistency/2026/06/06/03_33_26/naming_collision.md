# 신규 식별자 충돌 검토 결과

검토 범위: `spec/conventions/rag-evaluation.md + spec/5-system/9-rag-search.md` 연계 구현 (diff-base=origin/main)  
검토 시각: 2026-06-06

---

## 발견사항

### 1. INFO — `parseCliFlag` 함수명 로컬 중복 (모듈 경계 분리로 무해)

- **target 신규 식별자**: `parseCliFlag` (export) — `codebase/backend/src/scripts/cli-utils.ts`
- **기존 사용처**: `parseCliFlag` (module-local, unexported) — `codebase/backend/src/scripts/migrate-button-ids.ts` 및 `codebase/backend/src/scripts/migrate-node-output-refs.ts` (각 파일 내부 로컬 정의)
- **상세**: 기존 두 마이그레이션 스크립트는 각 파일 안에 `parseCliFlag`를 private local 함수로 동일 시그니처(`(name: string): string | undefined`)로 정의하고 있다. 새 `cli-utils.ts`는 동일 함수를 shared export 로 추출한 것이며 의미·동작이 동일하다. TypeScript 모듈 경계상 세 파일 모두 별도 모듈이므로 런타임/컴파일 충돌은 없다. 다만 기존 마이그레이션 스크립트가 `cli-utils`를 import 하지 않고 여전히 자체 로컬 복사본을 갖고 있어 두 벌 존재 상태가 유지된다. 현재로선 버그가 아니나 장기적으로 로직 불일치가 생길 수 있다.
- **제안**: 기존 마이그레이션 스크립트의 로컬 `parseCliFlag` 정의를 `cli-utils` import 로 교체하면 단일 구현 유지. 이번 PR 범위 밖이면 TODO 주석으로 표시.

---

### 2. INFO — `ROOT_ENTITIES` 이중 export 경로 (의도적 호환, 충돌 없음)

- **target 신규 식별자**: `ROOT_ENTITIES` export — `codebase/backend/src/database/root-entities.ts`
- **기존 사용처**: `ROOT_ENTITIES` export — `codebase/backend/src/app.module.ts` (origin/main 기준 정의 위치)
- **상세**: 이번 변경에서 `ROOT_ENTITIES`의 **정의**가 `app.module.ts` 에서 `src/database/root-entities.ts`로 이동했고, `app.module.ts`는 `export { ROOT_ENTITIES } from './database/root-entities'` re-export로 호환을 유지한다. `app.module.spec.ts`는 `app.module`에서 import 하므로 기존 import 사이트가 그대로 동작한다. 이중 경로이지만 의미는 동일하며 충돌이 아닌 의도적 리팩터링이다.
- **제안**: 현 상태 유지 적절. 신규 import 사이트는 `src/database/root-entities`를 직접 참조하도록 안내(이미 `eval-cli.module.ts`가 직접 참조 중).

---

## 요약

이번 변경이 도입한 신규 식별자(`EvalCliModule`, `GoldenEntry`, `GoldenSet`, `GoldenSetMeta`, `GoldenLanguage`, `GoldenSource`, `GoldenDifficulty`, `RetrievedChunk`, `EntryEval`, `AggregateMetrics`, `NegativeCaseStats`, `EvalReport`, `detectLanguage`, `stableEntryId`, `parseQuestions`, `loadExisting`, `GeneratedQuestion`, `eval:golden:generate`, `eval:retrieval` npm script, `eval/golden.json` gitignore 패턴)은 기존 코드베이스 어디에서도 다른 의미로 사용되지 않는 신규 네임스페이스 내 식별자다. CRITICAL 또는 WARNING 등급 충돌은 없다. `parseCliFlag` 동명 함수가 기존 마이그레이션 스크립트에 로컬 복사로 존재하나 모듈 경계로 분리되어 있어 컴파일·런타임 충돌이 없으며 INFO 수준 정리 과제에 불과하다. `ROOT_ENTITIES` 이중 경로는 의도적 호환 re-export로 충돌이 아니다.

---

## 위험도

NONE
