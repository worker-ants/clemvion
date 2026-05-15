---
worktree: cleanup-script-prod-a3f81c
started: 2026-05-15
owner: developer
---

# cleanup-invalid-queue-jobs 스크립트 운영 사용 가능화

## 배경

`backend/scripts/cleanup-invalid-queue-jobs.ts` 는 BullMQ 큐(`DOCUMENT_EMBEDDING_QUEUE`, `GRAPH_EXTRACTION_QUEUE`)에서 `documentId` 가 비어있는 손상 job 을 골라 제거하는 1회성 정리 도구. 운영자가 "생각보다 빈번하게" 사용한다고 보고 → prod 컨테이너에서도 실행 가능해야 함.

현재 제약:
- 스크립트는 `ts-node` 실행 전제 (devDeps), 그러나 prod Dockerfile 의 `runner` 스테이지는 `dist/` 와 prod-only node_modules 만 가짐.
- `tsconfig.build.json` 이 `src/**` 만 빌드하므로 `scripts/` 가 컴파일 산출물에 없음.

## 회귀 조사 결과 (서브에이전트, 2026-05-15)

운영자가 "또 쌓였다"고 느끼는 정체는 **누가 손상 job 을 enqueue 하는 신규 버그가 아니라**, 다음 두 가지의 합작:

1. `knowledge-base.module.ts:42-49` 의 두 큐가 `removeOnFail` 미설정 — `InvalidJobPayloadError extends UnrecoverableError` 가드가 손상 페이로드를 `failed` 상태로 즉시 옮기지만 삭제는 안 됨. cleanup 스크립트가 `failed` 도 sweep 대상이라 잔재가 누적됨.
2. `docker-compose.yml` 의 `redis_data:/data` named volume — 가드 도입(2026-05-13) 이전에 enqueue 된 손상 job 이 영속.

Producer 측 6 개 호출지점 모두 정상 (`ParseUUIDPipe`/DB-derived uuid). 새 손상 job 을 만드는 경로 없음.

**본 plan 의 범위 밖** — `removeOnFail` 정책 추가는 별도 plan `queue-removeonfail-policy.md` 로 분리 예정.

## 작업 단위

- [x] 스펙/일관성 사전 점검 — `/consistency-check --impl-prep`. Critical 1건 발견됐으나 본 작업 scope 외 spec 정합성 문제로 `spec-update-embedding-pipeline-consistency.md` 에 분리.
- [x] `cleanup-invalid-jobs.util.ts` + `.spec.ts` 작성 (`src/modules/knowledge-base/queues/`). TDD, 14 테스트 통과.
- [x] `backend/scripts/*.ts` → `backend/src/scripts/` 이동 (tsconfig.build.json 의 `rootDir: ./src` 제약 때문에 include 변경만으로는 컴파일 실패). 빌드 산출물은 `dist/scripts/*.js` 로 매핑됨. Dockerfile 변동 불필요.
- [x] `backend/package.json` 에 `cleanup:queue-jobs` npm script 추가
- [x] 스크립트 강화 (cleanup-invalid-queue-jobs.ts 재작성)
  - sweep 로직을 util 모듈로 위임 (스크립트는 thin CLI 진입점만)
  - `--pause-during-sweep` 플래그 (TOCTOU 자동화)
  - 마지막 줄에 queue별/합계 JSON summary 출력
  - docstring — 운영 호출 예 + 수동 워커 stop 절차 옵션화
- [x] migrate-* 두 스크립트의 import 경로 + docstring 호출 경로 갱신 (동작 무변경)
- [x] TEST WORKFLOW — lint(0 errors, 17 warnings 기존 부채), unit test 3484/3484 통과, build OK, dist 진입점 스모크 통과. `[skip-e2e]` (인프라 의존, 본 변경 영역이 e2e 트리거 영역 아님).
- [x] REVIEW WORKFLOW — `/ai-review` 13 reviewer 완료 (Critical 0 / Warning 11 / Info 16). 도입 항목 9건 조치(WARNING #2/#3/#5/#8/#10, INFO #6/#7/#10/#11) + 재테스트(lint 0 errors, 3487/3487 통과, build OK) + RESOLUTION.md 작성. 기존 부채 항목은 추적만.
- [ ] PR 생성 — 사용자 확인 후 진행

## Side-effect 점검

- `backend/scripts/*.ts` 가 `backend/src/scripts/` 로 이동했고, 빌드 산출물에 `dist/scripts/*.js` 가 추가됨. `nest-cli.json` 의 swagger 플러그인은 `*.dto.ts`/`*.controller.ts` 패턴만 트리거하므로 스크립트 파일은 영향 없음.
- Dockerfile `COPY ... /app/backend/dist ./backend/dist` 가 그대로 동봉. Dockerfile 변경 불필요.
- `start:prod` 의 `node dist/main` 진입점은 변동 없음.
- `backend/scripts/migrations/` (SQL) 는 그대로 유지.

## 후속 (별도 plan 분리 필요)

- [ ] `queue-removeonfail-policy.md` — 두 큐에 `removeOnFail: { age: 7d, count: 1000 }` 추가 + producer-side `isValidDocumentId` 가드. 운영자 수동 sweep 빈도를 근본적으로 제거.
- [ ] migrate-node-output-refs.ts 의 17 warnings (`@typescript-eslint/no-unsafe-*`) — 기존 부채. 본 PR 외 plan 으로 정리.
- [ ] `spec-update-embedding-pipeline-consistency.md` — Critical 1건 + Warning 6건 + Info 6건 (project-planner 위임).
