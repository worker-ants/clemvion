# Code Review 통합 보고서

## 전체 위험도
**LOW** — workspaceId 검증 로직을 공용 데코레이터로 통일하는 소범위 리팩터링. 보안·아키텍처·요구사항 측면 모두 개선이며 Critical 발견 없음. WARNING 3건(성능 1건 + 유지보수성 1건 + API 계약 하위 호환 1건)은 모두 선재 이슈이거나 의도된 breaking fix 로 즉각 블로킹 사유 아님.

---

## Critical 발견사항

_없음_

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 | `isolated-vm` per-exec Isolate 생성 비용 — V8 Isolate 초기화를 매 실행마다 지불. 고빈도 code 노드 실행 시 누적 latency 문제 가능. 이미 followups 플랜으로 분리 추적 중. | `plan/complete/code-node-isolated-vm.md` §운영영향 | 후속 PR에서 Isolate pool 또는 snapshot 재사용 전략 적용. (`code-node-isolated-vm-followups.md` 참조) |
| 2 | 유지보수성 | `body?.newBotToken` 옵셔널 체이닝 불일치 — 첫 조건 `body?.newBotToken` vs 두 번째 조건 `body.newBotToken`. 런타임 오류는 없으나 읽는 사람에게 혼동 유발. 기존 코드 패턴 (본 PR 미도입). | `chat-channel.controller.ts` line 49 | 두 조건을 `body?.newBotToken`으로 통일하거나 body 가 항상 non-null임을 주석 명시. 별도 후속 PR로 처리 적절. |
| 3 | API 계약 | `WORKSPACE_REQUIRED`(401) → `WORKSPACE_ID_REQUIRED`(400) breaking change — 에러 코드 문자열과 HTTP 상태 코드가 모두 변경. 변경 방향이 의미적으로 더 정확하고 문서 동기화 완료이나, 기존 클라이언트에서 `401 WORKSPACE_REQUIRED` 하드코딩 분기가 있다면 런타임 동작 변경. | `chat-channel.controller.ts`, `triggers.mdx`, `triggers.en.mdx`, `spec/5-system/15-chat-channel.md §5.4` | 프론트엔드·channel-web-chat 등 클라이언트 코드에서 `WORKSPACE_REQUIRED` grep 후 `WORKSPACE_ID_REQUIRED`/400 으로 마이그레이션 확인. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `@WorkspaceId()` 데코레이터 전환으로 JWT workspaceId fallback 누락 버그 해소, HTTP 상태코드 오용(401→400) 수정, 에러코드 일관성 확보. | `chat-channel.controller.ts` line ~45 | 현재 구현 양호. 추가 조치 불필요. |
| 2 | 아키텍처 | SRP 준수 강화 — 컨트롤러에서 workspace ID 추출·검증 책임이 공용 데코레이터로 분리. 컨트롤러는 body 검증 + 서비스 위임만 담당. | `chat-channel.controller.ts` 전체 | 향후 신규 엔드포인트도 `@WorkspaceId()` 표준 패턴 유지 권장. |
| 3 | 아키텍처 | `TriggersModule ↔ ChatChannelModule` 양방향 순환 의존(`forwardRef`) 잔존. 이번 변경 범위 밖이며 기존 상태 유지. | `chat-channel.controller.ts` L10-12 | 중장기 — ChatChannelModule 관리 API 를 TriggersModule 로 이동하거나 공유 인터페이스 모듈 도입. 이번 PR 범위 외. |
| 4 | 테스트 | `workspace.decorator.spec.ts` 빈 문자열 헤더(`{ 'x-workspace-id': '' }`) 케이스 명시적 단언 없음. `\|\|` 연산자로 암묵 커버되나 명시적 케이스 없음. | `workspace.decorator.spec.ts` | 선택사항 — 빈 문자열 케이스 추가로 falsy 처리 명시 확인 가능. 현재 수준 허용 가능. |
| 5 | 테스트 | `workspace.decorator.spec.ts` 에서 `BadRequestException` 타입만 단언, `code: 'WORKSPACE_ID_REQUIRED'` 필드 미단언. | `workspace.decorator.spec.ts` | 선택사항 — `expect.objectContaining({ response: expect.objectContaining({ code: 'WORKSPACE_ID_REQUIRED' }) })` 추가로 코드 문자열 드리프트 방지. |
| 6 | 문서 | spec `INVALID_BOT_TOKEN` 행의 `:52` 라인 앵커 — 6줄 삭제 이후 유효성 확인 필요. `WORKSPACE_ID_REQUIRED` 행은 파일 경로만 사용해 안전하게 처리됨. | `spec/5-system/15-chat-channel.md §5.4` | 실제 파일에서 `INVALID_BOT_TOKEN` 검증 로직 현재 라인 확인 후 `:52` 앵커 갱신. |
| 7 | 문서 (사용자 가이드) | `ERROR_KO["WORKSPACE_ID_REQUIRED"]` 매핑 미등록 — 선재 drift. 이번 PR 이전부터 존재. 기존에는 다른 에러코드(`WORKSPACE_REQUIRED`)를 쓰던 엔드포인트가 공용 코드로 통합되면서 해당 엔드포인트 사용자도 영문 코드를 받게 됨. | `codebase/frontend/src/lib/i18n/backend-labels.ts` | 후속 plan 에서 `ERROR_KO["WORKSPACE_ID_REQUIRED"] = "요청에 워크스페이스 ID 가 없어요."` 추가 검토. 이번 PR 블로킹 사유 아님. |
| 8 | 성능 | `ExternalCopy` 직렬화 비용 — 대용량 `$input` 페이로드 시 직렬화 오버헤드. 현재 입력 크기 상한 미정의. | `plan/complete/code-node-isolated-vm.md` §구현 | `$input` 크기 상한 spec 정의 후 early-exit 적용 검토. |
| 9 | 요구사항 | spec `INVALID_BOT_TOKEN` 행의 라인 참조(`chat-channel.controller.ts:52`) — 향후 파일 변경 시 드리프트 가능성. 현재는 정합. | `spec/5-system/15-chat-channel.md` line 339 | spec 의 라인 번호 앵커는 향후 정기 업데이트 대상. |
| 10 | 범위 | 7개 파일 모두 plan 체크리스트 항목 또는 "동봉" 항목으로 명시된 변경과 정확히 대응. 범위 일탈 없음. | 전체 diff | 해당 없음. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | JWT fallback 버그 해소, 에러코드/HTTP 상태 정합, 보안 개선 |
| performance | LOW | isolated-vm per-exec Isolate 비용(선재·추적 중), ExternalCopy 직렬화 |
| architecture | NONE | SRP/DIP 개선, forwardRef 순환 의존 잔존(기존 상태) |
| requirement | NONE | spec·코드·user-docs 세 층 정합 완료, 기능 완전성 확인 |
| scope | NONE | 7개 파일 전부 plan 명시 항목 대응, 범위 일탈 없음 |
| side_effect | LOW | 에러코드/HTTP 상태 변경(의도된 breaking fix), JWT fallback 확장(의도된 개선) |
| maintainability | LOW | body?.newBotToken 옵셔널 체이닝 불일치(선재), plan 체크박스 미완료 상태(정상) |
| testing | NONE | 검증 책임 이관 적절, workspace.decorator.spec.ts 6케이스 커버, 빈 문자열 암묵 커버 |
| documentation | LOW | INVALID_BOT_TOKEN 라인 앵커 `:52` 유효성 확인 필요, 전반 문서화 완성도 높음 |
| dependency | NONE | 신규 외부 패키지 없음, 내부 의존 방향 개선 |
| database | NONE | DB 관련 변경 없음 |
| concurrency | NONE | 동시성 관련 변경 없음 |
| api_contract | LOW | WORKSPACE_REQUIRED→WORKSPACE_ID_REQUIRED / 401→400 breaking change(의도·문서화 완료), 클라이언트 grep 권장 |
| user_guide_sync | LOW | MDX ko+en 갱신 완료, ERROR_KO 미등록 선재 gap(후속 검토 권장) |

---

## 발견 없는 에이전트

- **database** — DB 쿼리·ORM·마이그레이션·스키마 관련 변경 없음
- **concurrency** — 동시성·병렬 처리 관련 변경 없음
- **dependency** — 신규 외부 패키지 없음, 라이선스/취약점/버전 충돌 없음

---

## 권장 조치사항

1. **[즉시·선택권장]** 클라이언트 에러 코드 마이그레이션 확인 — 프론트엔드·channel-web-chat 코드베이스에서 `WORKSPACE_REQUIRED` 를 grep 하여 `WORKSPACE_ID_REQUIRED`/400 으로 업데이트. 이번 PR 의 breaking change 에 대응. (`api_contract` WARNING #3)
2. **[즉시·소규모]** `spec/5-system/15-chat-channel.md §5.4` `INVALID_BOT_TOKEN` 행의 `:52` 라인 앵커 유효성 확인 및 필요 시 갱신. (`documentation` INFO #6)
3. **[후속 plan]** `ERROR_KO["WORKSPACE_ID_REQUIRED"]` 한국어 메시지 추가 — `codebase/frontend/src/lib/i18n/backend-labels.ts`. 사용자 노출 에러 코드 한국어화. (`user_guide_sync` INFO #7)
4. **[후속 plan]** `workspace.decorator.spec.ts` 에 빈 문자열 헤더 케이스 및 에러 code 필드 명시 단언 추가. (`testing` INFO #4, #5)
5. **[후속 plan]** isolated-vm Isolate pool / snapshot 재사용 전략 — 고빈도 code 노드 실행 latency 개선. `code-node-isolated-vm-followups.md` 추적 중. (`performance` WARNING #1)
6. **[후속 plan]** `body?.newBotToken` 옵셔널 체이닝 일관성 정리. (`maintainability` WARNING #2)
7. **[중장기]** `TriggersModule ↔ ChatChannelModule` forwardRef 순환 의존 해소 — 공유 인터페이스 모듈 도입 검토. (`architecture` INFO #3)

---

## 라우터 결정

라우터 미사용 — `routing=all`. 전체 reviewer 실행.

- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
- **제외**: 없음
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)