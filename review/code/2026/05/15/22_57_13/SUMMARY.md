# Code Review 통합 보고서

> 세션: `review/code/2026/05/15/22_57_13`
> 대상 범위: `HEAD~2..HEAD` (commits `5415a4bd` feat + `b756e62c` style)
> 리뷰어: 13명 전원 완료 (pending 0건, fatal 0건)

## 전체 위험도

**MEDIUM** — 기능 자체는 안전하게 구현되었으나, `migrate-button-ids.ts`의 모듈 최상위 `process.argv` 즉시 파싱이 테스트 격리를 깨뜨릴 수 있고, `cleanup-invalid-queue-jobs.ts`의 `queue.close()` 실패 시 summary 미출력 등 운영 가시성 문제가 여러 리뷰어에서 중복 지적되었다.

## Critical 발견사항

없음.

## 경고 (WARNING, 11건)

| # | 카테고리 | 발견사항 | 위치 |
|---|----------|----------|------|
| 1 | 아키텍처/부작용/유지보수성/테스트 | 모듈 최상위에서 `process.argv` 즉시 파싱 (`DRY_RUN`, `CLI_WORKSPACE_ID`, `CLI_USER_ID`) — 테스트 격리 깨짐 | `migrate-button-ids.ts` |
| 2 | 아키텍처/부작용 | `cleanup-invalid-queue-jobs.ts`의 `dotenv.config()` 최상위 블록 — import 시 `process.env` 오염, `migrate-button-ids.ts`의 `loadDotenv()` 지연 패턴과 불일치 |
| 3 | 요구사항/운영 | `queue.close()` 실패 시 JSON summary 미출력 — finally 블록 순서 결함 |
| 4 | 아키텍처 | `cleanup-invalid-jobs.util.ts`가 `knowledge-base` 모듈 내부 위치 — `scripts` 레이어가 도메인 모듈 내부에 결합 |
| 5 | 요구사항/문서화 | `CLEANUP_QUEUE_STATES`에서 `active`/`completed` 상태 제외 근거 미문서화 |
| 6 | 범위 | `migrate-button-ids.ts` 및 `background-runs.service.ts`가 PR 범위 밖 |
| 7 | 유지보수성 | `backfillButtonIds` 세 버튼 처리 블록 구조적 중복 |
| 8 | 문서화 | `cleanup-invalid-jobs.util.ts` 공개 함수/인터페이스 JSDoc 없음 |
| 9 | 문서화 | `cleanup:queue-jobs` npm script가 README/운영 가이드 미반영 |
| 10 | 동시성 | 다중 큐 순차 처리 시 큐별 pause gap — 비정상 종료 시 paused 상태 잔류 가능 |
| 11 | 의존성 | `bcrypt: ^6.0.0` 릴리즈 채널 확인 권고 (기존 이슈) |

## 참고 (INFO, 16건)

| # | 카테고리 | 핵심 |
|---|---|---|
| 1 | 보안 | Redis `REDIS_PASSWORD` 미참조 |
| 2 | 보안 | migrate-button-ids `--workspace-id`/`--user-id` UUID 검증 누락 |
| 3 | 보안 | `decodeCursor()` UUID 형식 미검증 |
| 4 | 성능 | migrate-button-ids 전체 버튼 노드 단일 쿼리 메모리 적재 |
| 5 | 성능 | `pendingUpdates` 노드별 단건 UPDATE 직렬 실행 |
| 6 | 성능 | `runSweep` 루프 내 매 페이지마다 `[...CLEANUP_QUEUE_STATES]` spread |
| 7 | 동시성/정확성 | apply=true 시 페이지 안 remove 후 offset 보정 없음 → 다음 페이지 일부 row skip |
| 8 | 동시성 | 페이지당 최대 1000건 `Promise.all` 병렬 remove → Redis 부하 |
| 9 | DB | V047 expression 인덱스 실제 존재 여부 미확인 |
| 10 | 테스트 | `apply + pauseDuringSweep` 동시 조합 케이스 누락 |
| 11 | 테스트 | logger 출력 포맷 회귀 방지 케이스 없음 |
| 12 | 유지보수성 | `changed` 플래그 관리 패턴 혼재 |
| 13 | 운영 | `cleanup:queue-jobs` 가 build 없이 stale dist 실행 가능 |
| 14 | 의존성 | `overrides` `^` 형태 하한 고정 |
| 15 | 문서화 | migrate-button-ids 모듈 최상위 즉시 파싱 의도 주석 없음 |
| 16 | 문서화 | scripts 경로 변경 이력이 파일 내부에만 존재 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 이슈 수 |
|----------|--------|--------|
| security | LOW | 6 |
| performance | LOW | 6 |
| architecture | LOW | 5 |
| requirement | MEDIUM | 7 |
| scope | LOW | 4 |
| side_effect | LOW | 7 |
| maintainability | LOW | 7 |
| testing | LOW | 6 |
| documentation | LOW | 6 |
| dependency | LOW | 8 |
| database | LOW | 4 |
| concurrency | LOW | 4 |
| api_contract | NONE | 0 |

## 처리 결과

`RESOLUTION.md` 참고. 본 PR 변경이 도입한 항목(WARNING #2, #3, #5, #8, #10, INFO #6, #7, #10, #11) 은 후속 커밋(`b465ec2e`) 으로 모두 조치. 기존 부채 항목은 후속 plan 으로 분리.
