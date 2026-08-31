# 요구사항(Requirement) Review

## 발견사항

- **[INFO]** 이번 diff(`0883c4e43`)는 정확히 직전 `/ai-review`(`18_30_55`) 라운드의 requirement WARNING 2건(§4.4→§4.5 스윕 잔여 4곳: `8-notifications.md:192`, `websocket-events.types.ts:211,232`, `websocket.service.ts:567`)을 전부 반영했다.
  - 위치: `spec/data-flow/8-notifications.md:192`, `codebase/backend/src/modules/websocket/websocket-events.types.ts:211,232`, `codebase/backend/src/modules/websocket/websocket.service.ts:567`, `codebase/backend/src/modules/websocket/websocket.service.spec.ts:1268`
  - 상세: 직접 `Read`/`grep` 재확인 — 5곳 전부 `§4.5` 로 정정돼 있고, `spec/5-system/6-websocket-protocol.md` 의 `### 4.1`~`### 4.7` 헤딩 시퀀스도 중복·결번 없이 순차적임을 확인(`4.1·4.2·4.3·4.4(+4.4.5/4.4.6)·4.5·4.6·4.7`). `auth.token_expired`/`system.maintenance`(§4.6)·외부 표면 매핑(§4.7) 인용도 `6-websocket-protocol.md`·`14-external-interaction-api.md`·`spec-sync-websocket-protocol-gaps.md` 전 지점에서 일관됨을 grep 으로 재대조했다. `spec/data-flow/8-notifications.md:349` 의 "본 문서 §4.6 follow-up" 은 처음엔 잔존 오인용으로 의심했으나, 직접 열어 대조한 결과 **그 문서 자신의 §4.6 헤딩**(`### 4.6 WebSocket 동기화 (follow-up)`, line 186)을 가리키는 것으로 `6-websocket-protocol.md` 의 절 이동과 무관 — 오탐이었음을 기록해 둔다(반례로 남겨 다음 사람이 같은 혼동을 반복하지 않도록).
  - 제안: 없음 — 조치 불요, 회귀 확인용 기록.

- **[INFO]** `_scope_delta_census`/`_count_diff_files`(consistency_orchestrator.py) 기능 완전성 검증 — 신설 테스트 14건(`test_consistency_scope_census.py`) 실행 결과 `14 passed`(`python3 -m pytest`), 20건 초과 시 "… 외 N건" 접힘 분기(직전 라운드 testing WARNING #5)도 이번 diff 에서 fixture 20/25건으로 커버됐고 `_SCOPE_HITS_DISPLAY_LIMIT` 모듈 상수 추출(직전 라운드 maintainability WARNING #4)도 반영됨을 소스에서 직접 확인. 함수 로직 자체도 검증했다 — prefix 매칭이 `scope_rel + "/"` 로 형제 디렉터리 누출을 막고(`spec/5-system` vs `spec/5-system-extra/`), rename/added-file 카운팅이 `diff --git` 헤더 기준으로 정확함(`test_added_file_counts_once_not_twice`).
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:479-568`, `.claude/tests/test_consistency_scope_census.py`
  - 제안: 없음.

- **[INFO]** `workflow-assistant.controller.ts` 의 `@ApiUnauthorizedResponse` 부착이 `swagger.md §2-4` 원문 문구(`'인증 실패 또는 토큰 만료'`)와 정확히 일치함을 재확인했고, 7개 라우트 전부(`list`/`latest`/`findOne`/`create`/`update`/`remove`/`sendMessage`) 부착 여부를 grep 으로 전수 대조했다. `@Public` 미부착(전 라우트 인증 필요)도 확인해 401 문서화 대상이 맞다는 전제가 유효함을 검증. 신규 회귀 테스트 실행 결과 `Tests: 2 passed, 2 total`(로컬 재현, `npx jest workflow-assistant.controller.swagger.spec.ts`). `plan/complete/spec-sync-stop-editor-and-forbidden-routes.md` 로의 이동도 `git diff --summary` 로 rename(87% similarity)임을 확인해 plan 라이프사이클 규약(체크와 `complete/` 이동이 한 동작) 위반이 아님.
  - 제안: 없음.

- **[INFO]** HMAC whitelist spec 정정(`spec/5-system/14-external-interaction-api.md §8.2`: `hmac-sha256` 단독 → `hmac-sha256`/`hmac-sha512`)이 실제 구현과 line-level 로 일치함을 직접 확인 — `notification-signature.util.ts:11` (`SupportedHmacAlgorithm = 'hmac-sha256' | 'hmac-sha512'`), `notification-webhook.processor.ts:298-300`(`resolveAlgorithm` 이 두 값을 분기), `notification-config.dto.ts` 존재 확인. 이 정정은 신규 코드 변경이 아니라 이미 구현된 동작에 spec 문구를 맞춘 사실 정정이라 API 계약 자체의 변화는 없다.
  - 제안: 없음.

- **[INFO]** `plan/**` 문서들에 실린 정량적 실측 주장(예: `cafe24-backlog-residual.md` 의 `ThrottlerModule.forRoot` 설정·Redis storage 미설치·`@nestjs/throttler ^6.5.0`, `webchat-usewidget-extraction.md` 의 `use-widget.ts` 1,432줄)을 코드에서 직접 대조 — `app.module.ts:150-152`, `package.json` 의 `@nestjs/throttler`/`ioredis`(throttler-storage 계열 부재) 확인, `wc -l use-widget.ts` = 1432 로 정확히 일치. 지어낸 수치 없음.
  - 제안: 없음.

## 요약

이번 diff(HEAD `0883c4e43`)는 직전 `/ai-review`(`18_30_55`) 라운드에서 requirement·documentation·maintainability 세 reviewer 가 공통 지적한 "§4.4→§4.5 절 번호 스윕 불완전"(spec 내부 1곳 + `spec/` 밖 backend 주석 3곳)과 maintainability/testing WARNING(매직넘버 20 상수화, 20건 초과 fold 분기 미커버)을 정확히 그 지점에서 해소했다. 재검증을 위해 각 지점을 직접 `Read`/`grep`/테스트 실행으로 재확인했고 잔존 오인용은 없다(초기에 `8-notifications.md:349` 를 오인용 후보로 의심했으나 재확인 결과 오탐으로 판명 — 그 문서 자신의 별도 §4.6 헤딩을 가리키는 정상 인용). `workflow-assistant.controller.ts` 의 `@ApiUnauthorizedResponse` 7건 부착은 `swagger.md §2-4` 문구와 정확히 일치하며 신규 회귀 테스트가 라우트 수·문구 두 축을 모두 고정한다. `_scope_delta_census`/`_count_diff_files` 신설 헬퍼는 테스트 14건 GREEN 이고 엣지 케이스(빈 diff, rename, added-file, 형제 디렉터리 prefix 누출, 20건 초과 fold)를 커버한다. HMAC whitelist spec 정정도 코드와 line-level 일치. plan 문서들의 정량 실측 주장도 표본 대조 결과 정확했다. TODO/FIXME 등 미완성 표시 없음, CRITICAL 급 기능 결함·엣지 케이스 누락·spec 불일치는 발견되지 않았다.

## 위험도

NONE
