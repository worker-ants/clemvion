# User Guide Sync 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (rows 21개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문(§155~225)을 Read 하여 적재했다.

## 변경 파일 식별

이번 changeset 의 실제 코드/문서 변경 파일:

1. `CHANGELOG.md` — 형제 커밋과 대칭인 3단 구성(문제/고친 것/판별력 실측) 엔지니어링 changelog 항목 추가
2. `codebase/backend/src/modules/triggers/triggers.service.ts` — `remove()` 에 advisory lock 획득 후 명시적 재조회(`!fresh` → 404) + `.catch` 블록에서 `NotFoundException` 분리
3. `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — 위 변경에 대한 단위 테스트 2건 추가
4. `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts` (신규) — 동시 DELETE e2e
5. `plan/in-progress/spec-draft-nullable-notation-followups.md` — 트래커 항목 해소 표시 + `SchedulesService.remove()` 잔여 신규 등재
6. `plan/in-progress/trigger-dup-delete.md` (신규) — 이번 작업 plan 문서

나머지 리뷰 대상 파일(`review/code/2026/09/20/22_07_23/**`, `review/consistency/2026/09/20/21_43_47/**`)은 선행 리뷰/일관성 검토 세션의 산출물이며 `review/**` 는 doc-sync-matrix 의 어떤 trigger 대상도 아니다.

## 매칭 시도 및 결과

매트릭스 21개 row 를 전수 대조했다.

- **새 노드 추가 / 노드 schema 변경** — trigger glob `codebase/backend/src/nodes/**` 불일치. `triggers.service.ts` 는 `codebase/backend/src/modules/triggers/` 하위로 노드 디렉토리가 아니다. 매칭 없음.
- **신규 UI 문자열(TSX) / 위젯 chrome 문자열** — frontend/channel-web-chat `.tsx` 변경 없음. 매칭 없음.
- **통합 신규/제공자 변경** — diff 에 `releaseExternal`/provider teardown 언급이 나오지만(선행 리뷰 WARNING #1), 이는 **기존** provider teardown 호출 순서의 중복 문제(락 밖에서 두 번 불림)이지 신규/변경된 provider 자체가 아니다. 신규 provider 도입이나 provider 설정 UI 변경이 아니므로 "통합 신규/제공자 변경" trigger 의미상 매칭 안 됨.
- **유저 가이드 신규 섹션 디렉토리** — `content/docs/*/` 신규 디렉토리 없음. 매칭 없음.
- **백엔드 API 추가·변경** — `*.controller.ts` / `dto/**` 변경 없음. `triggers.service.ts` 만 수정됐고, 응답 스키마·엔드포인트·요청 계약 변화 없음(선행 리뷰 INFO #8: 기존 `RESOURCE_NOT_FOUND` 포맷 재사용, 신규 스키마 없음). 매칭 없음.
- **신규 BullMQ 큐** — `system-status.constants.ts` 미변경. 매칭 없음.
- **신규 warningCode / errorCode** — `warningRules`, `error-codes.ts` 변경 없음. 기존 `TRIGGER_DELETED` 감사 액션·기존 `RESOURCE_NOT_FOUND` 에러코드 재사용이며 신규 코드 발행이 아니다. 매칭 없음.
- **신규 cross-cutting enum / backend ui.label 값 / handler output field** — 해당 없음.
- **인증·권한·세션 흐름 변경** — glob `codebase/backend/src/modules/auth/**` 불일치. 의미상으로도 이번 변경은 인증·권한·세션이 아니라 트리거 삭제 동시성(advisory lock 재조회)이다. 매칭 없음.
- **AuthConfig type enum 변경** — 해당 없음.
- **표현식 언어 변경** — `codebase/packages/expression-engine/**` 미변경. 매칭 없음.
- **실행·디버깅 흐름 변경** — `05-run-and-debug/` 가 다루는 영역은 워크플로 실행·디버그 로깅이며, 트리거 삭제(설정 관리 액션)의 감사 중복 수정은 실행 엔진이나 디버그 로깅 흐름이 아니다. 의미상 매칭 안 됨.
- **환경 변수·런타임 변경** — 해당 없음.
- **spec 신규/대규모 변경** — `spec/2-*/**` 등 glob 대상 파일 없음(`spec/**` 변경 자체가 이번 changeset 에 없음). `spec_impact: none` 이 plan frontmatter 에도 명시돼 있고, 선행 리뷰 INFO #1 이 `spec/2-navigation/2-trigger-list.md:318` 의 기존 서술(§4.4, 이미 존재)이 이번 구현으로 "사실이 됨"을 확인했을 뿐 spec 파일 자체는 건드리지 않았다. 매칭 없음.
- **user-guide GUI 흐름 절 신규/변경** — `02-nodes/**.mdx`, `06-integrations-and-config/**.mdx` 변경 없음. 매칭 없음.
- **spec 자체 결함 발견** — 선행 리뷰가 짚었던 "§4.4 caveat" 이슈는 이미 별도 planner 항목(`spec-draft-nullable-notation-followups.md` 의 "`1-workflow-list.md` §2.6 · `data-flow/12-workspace.md` §1.10..." 항목, 이번 diff 밖의 기존 항목)으로 등재돼 있어 정상 처리 경로를 따르고 있다. 이번 diff 가 새로 만든 결함이 아니다.

## 결론

이번 changeset 은 `TriggersService.remove()` 의 동시 DELETE 시 advisory lock 이 "줄만 세우고 재확인은 안 함" 문제를 고치는 순수 백엔드 동시성/감사-정합성 버그 수정이다. 변경 파일은 서비스 로직·단위 테스트·신규 e2e·엔지니어링 CHANGELOG·내부 plan 트래커 문서뿐이며, frontend `content/docs/**`, i18n dict, `backend-labels.ts`, `locale.ts`, 노드/통합/표현식/실행-디버깅 문서 영역 어디에도 걸치지 않는다. `doc-sync-matrix.json` 21개 row 전수 대조 결과 glob 매칭도, 의미(semantic) 매칭도 없다.

## 발견사항

없음 — 매칭된 trigger 가 없어 동반 갱신 누락을 평가할 대상 자체가 없다.

## 요약

doc-sync-matrix 21개 trigger row 전수 대조 결과 이번 changeset(트리거 삭제 동시성 버그 수정 — service/spec/e2e/CHANGELOG/plan 6개 파일)은 어떤 trigger 에도 매칭되지 않았다(매칭 0 / 누락 0). 프론트엔드 유저 가이드(content/docs), i18n dict, backend-labels.ts, locale.ts 영역에 대한 영향이 전혀 없는 순수 백엔드 동시성 버그 수정으로, 유저 가이드 동반 갱신 관점에서는 해당 없음이다.

## 위험도

NONE
