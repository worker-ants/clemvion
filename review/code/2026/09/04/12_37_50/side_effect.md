# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 전역 `process` 객체에 `unhandledRejection` 리스너를 붙였다 뗀다 — 페어링은 안전하지만 공유 싱글턴을 건드리는 패턴
  - 위치: `codebase/backend/src/common/__test-utils__/temp-fixture.spec.ts` (`describe('temp-fixture')` 안 "async 콜백이 실제로 reject 해도 tmpdir 은 지워지고 unhandled rejection 이 새지 않는다" 테스트, `process.on('unhandledRejection', onUnhandled)` / `process.off(...)` 쌍)
  - 상세: `process.on` 이 `try` 진입 **전**에 호출되고 `process.off` 는 `finally` 에서 확실히 실행되므로, 이 테스트 자체는 리스너 누수를 만들지 않는다(직접 열어 확인). 다만 이 헬퍼가 겨냥하는 대상 자체가 프로세스 전역 이벤트 버스이므로, 만약 같은 Jest worker 안에서 이 spec 과 동시에(`test.concurrent` 등) 다른 async 리젝션을 유발하는 테스트가 돈다면 서로의 `unhandledRejection` 이벤트를 교차로 관측할 여지가 이론적으로 있다. 현재 이 저장소·이 파일 어디에도 `test.concurrent` 사용이 없어 실제 발현 경로는 없다.
  - 제안: 조치 불필요 — 관측 사실만 기록. 향후 이 파일이나 형제 spec 이 `test.concurrent` 를 도입하면 이 패턴을 재검토할 것.

- **[INFO]** `background-run-response.dto.ts` 8필드의 OpenAPI `required` 가 `false → true` 로 좁아진다 — 이번 라운드에 CHANGELOG 공지가 추가되어 직전 라운드의 문서화 WARNING 은 해소됨
  - 위치: `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts` (`finishedAt`·`durationMs`·`inputData`·`outputData`·`error`·`nextCursor`·`completedAt`·`durationMs` 각 `@ApiPropertyOptional` → `@ApiProperty({ nullable: true })`), `CHANGELOG.md` 신규 `## Unreleased` 항목
  - 상세: `class-validator`/`class-transformer` 런타임 경로는 데코레이터 인자가 아니라 실제 값 기준으로 동작하므로 서버 자체의 동작 변화는 없다. 다만 이 필드들로부터 클라이언트를 생성하는 엄격한 OpenAPI 코드제너레이터는 재생성 시 `field?: T | null` → `field: T | null` 로 타입이 바뀐다 — 공개 API 계약(문서 표면)의 실질 변경이며, 이전 라운드 documentation reviewer 가 "CHANGELOG 공지 누락"으로 WARNING 을 걸었던 항목이 이번 diff 의 `CHANGELOG.md` 신규 항목으로 정확히 해소됐다(변경 방향·영향까지 명시).
  - 제안: 조치 불필요(이미 처리됨) — 확인 목적의 기록.

- **[INFO]** 작업 트리에 이번 diff 목록에 없는 uncommitted 변경이 하나 있다 — `review/consistency/2026/09/04/11_33_21/SUMMARY.md`
  - 위치: `review/consistency/2026/09/04/11_33_21/SUMMARY.md` (프롬프트상 "new file"로 diff 되어 있으나, `git status --short` 는 이 파일을 `M`(modified, 미커밋)으로 보고)
  - 상세: 리뷰 프롬프트의 unified diff 는 이 파일을 `origin/main` 대비 신규 파일로 보여주는데, 현재 워킹트리에는 그 위에 **추가로 커밋되지 않은 수정**이 얹혀 있다. 이 리뷰 세션이 그 파일을 건드린 적은 없다 — 병렬 fan-out 경고문이 언급한 "다른 reviewer/오케스트레이터가 같은 워킹트리를 동시에 쓴다"는 상황과 일치하는 것으로 보인다. 이 diff 자체가 만든 결함은 아니라고 판단되지만, 관측한 이상 상태이므로 규약에 따라 보고한다.
  - 제안: 코드 조치 불필요. push/커밋 전 `git status --short` 로 이 파일이 의도한 상태(커밋 완료)인지 최종 확인 권장.

- **[NONE]** 형제 가드 8곳에 흩어져 있던 `path.relative(...).split(path.sep).join('/')` 가 `toPosixRelative()` 단일 함수로 전부 교체됐고, 실제 소스(`grep`)에서 주석을 제외한 잔여 `path.relative` 호출은 0건이다 — 부분 적용으로 인한 플랫폼별 불일치 위험 없음.
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` (`toPosixPath`/`toPosixRelative` 신설) + 8개 소비처(`swagger-dto-contract-guard.ts`, `nullable-type-lie-cast-guard.ts`(3곳), `masked-reject-callers-guard.ts`, `production-build-devdep-guard.ts`, `engine-error-code-anchor-guard.ts`(2곳), `websocket-events.types.spec.ts`, `audit-action-binding.spec.ts`, `production-build-devdep.spec.ts`)
  - 상세: 확인 목적의 기록.

- **[NONE]** `create-assistant-session.dto.ts` `llmConfigId?: string` → `llmConfigId?: string | null` 은 런타임 검증(`@IsOptional()`)·서비스 로직(`workflow-assistant-session.service.ts:91` `dto.llmConfigId ?? null`)이 이미 `null` 을 다루고 있었음을 직접 확인 — 타입 시그니처만 실제 동작을 따라간 변경으로 새로운 부작용 없음.

- **[NONE]** `temp-fixture.ts` 의 `withFiles`/`withFixture` 는 `os.tmpdir()` 하위 `mkdtempSync` 로만 파일을 생성하고 `finally` 에서 `rmSync(..., {recursive:true, force:true})` 로 확실히 정리한다 — 저장소 트리 파일을 변형하지 않는다(디자인 자체가 이전 방식의 "실제 서비스 파일 writeFileSync 후 복원" 문제를 해결한 결과).

## 요약

이번 diff 는 이전 두 리뷰 라운드(WARNING 5건)를 거쳐 대부분 수렴한 상태다 — async/thenable 콜백 레이스(W4), 경로 정규화 관례 이탈(W3), CHANGELOG 공지 누락(문서 WARNING) 등 이전에 지적된 부작용 항목은 이번 diff 에서 확인 결과 실제로 해소돼 있다(정규화 8곳 전수 통일, `unhandledRejection` 을 명시 catch 후 동기 에러로 치환, CHANGELOG 신규 항목 추가). 새로 발견된 항목은 전부 INFO 수준이며 블로킹 요소는 없다 — (1) 테스트 파일의 전역 `process` 리스너는 페어링이 안전해 실질 위험이 없고, (2) DTO `nullable`/`required` 데코레이터 정정은 런타임 로직에 영향을 주지 않는 순수 OpenAPI 메타데이터 변경으로 이번엔 CHANGELOG 로 공지까지 됐으며, (3) 작업 트리에 이 diff 목록 밖의 uncommitted 변경 1건이 관측됐으나 이 diff 자체가 만든 것은 아니다. 전역 변수 도입, 예상치 못한 파일시스템 부작용, 함수 시그니처의 하위 호환성 파괴, 의도치 않은 네트워크 호출은 없다.

## 위험도

LOW
