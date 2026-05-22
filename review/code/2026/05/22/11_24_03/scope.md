# 변경 범위(Scope) 리뷰

## 발견사항

### [WARNING] 파일 21 — `table.handler.spec.ts` 포맷팅 전용 변경 (chat-channel-secret-store-pgcrypto 작업과 무관)
- 위치: `codebase/backend/src/nodes/presentation/table/table.handler.spec.ts` — 전체 파일에 걸쳐 총 15개 이상의 hunk
- 상세: 변경 내용이 `as unknown as { config: Record<string, unknown>; output: Record<string, unknown> }` 형태의 인라인 타입 캐스트를 여러 줄로 줄바꿈하는 포맷팅 변경 및 `result.output as Record<string, unknown>` → `result.output` 로 타입 캐스트를 제거하는 리팩토링으로만 구성되어 있다. 이 파일은 secret store, chat-channel, notification webhook 어느 것과도 무관한 Table 시각형 노드 핸들러 spec 파일이다.
- 제안: `table.handler.spec.ts` 의 변경을 별도 커밋 또는 별도 PR로 분리하거나, 현재 PR에서 제거한다. 기능 동작에 영향은 없으나 diff 노이즈를 유발하고 리뷰 범위를 흐린다.

### [INFO] 파일 1 (`backend/package-lock.json`) 및 파일 22 (`frontend/package-lock.json`) — 자동 lock 파일 갱신에 `uglify-js` / `fsevents` `"dev": true` 플래그 추가
- 위치: `codebase/backend/package-lock.json` 라인 110, `codebase/frontend/package-lock.json` 라인 6862
- 상세: `uglify-js` 에 `"dev": true` 플래그가 추가되고, `frontend` 의 `fsevents` 에도 동일 플래그가 추가됐다. 이 변경은 `npm install` 또는 의존성 트리 재계산 중 lock 파일이 자동 갱신된 결과로 보인다. secret store 작업의 직접 결과물이 아니라 환경 차이에서 비롯된 부수 변경이다. 기능 이상은 없으나 불필요한 diff가 포함된다.
- 제안: lock 파일 변경이 의도적인지(예: 의존성 추가가 트리거) 확인 후, 의도적이지 않으면 `npm ci` 또는 lock 파일 복원으로 제거한다. `backend/package-lock.json` 의 `@nestjs-modules/mailer` 하위 `chokidar`, `glob-parent`, `readdirp` 추가는 동일 install 과정에서 함께 갱신된 것으로 보이며 이 역시 동일한 맥락이다.

### [INFO] 파일 40~46 — `review/consistency/` 하위 산출물 파일 포함
- 위치: `review/consistency/2026/05/22/10_33_51/` 디렉터리 전체 (`_retry_state.json`, `meta.json`, 각 checker `.md` 파일 등 7개)
- 상세: consistency-check 실행 결과물이 커밋 diff에 포함되어 있다. `review/` 디렉터리는 프로젝트 규약상 산출물 보관 경로이므로 의도된 포함이지만, 이 파일들은 코드 변경(feat/fix)이 아닌 프로세스 산출물이다. 기능적 문제는 없으며, 규약(`CLAUDE.md` 정보 저장 위치 표)에 따라 `review/consistency/<YYYY>/...` 에 저장하는 것이 명시되어 있으므로 범위 이탈이라기보다 규약 준수이다.
- 제안: 해당 없음 (규약 준수).

### [INFO] 파일 25 (`plan/in-progress/chat-channel-secret-store-infra.md`) — 대규모 plan 문서 갱신
- 위치: `plan/in-progress/chat-channel-secret-store-infra.md` — 전체 frontmatter, 결정 항목, 범위 섹션 재작성
- 상세: backlog 상태 plan이 in-progress로 전환되고, 사용자 결정 사항이 반영되어 pgcrypto 옵션이 backend AES-256-GCM으로 확정 기술됐다. 이 변경은 작업 의도(chat-channel-secret-store-pgcrypto) 자체의 산출물이므로 범위 이탈이 아니다. 단, plan 규약(`plan-lifecycle.md`)에 따라 `worktree` frontmatter 필드가 추가된 점은 정상이다.
- 제안: 해당 없음 (범위 내).

## 요약

전체 47개 파일 변경 중 범위 이탈에 해당하는 항목은 1건(WARNING)과 2건(INFO)이다. 핵심 위반은 `table.handler.spec.ts`의 순수 포맷팅·타입캐스트 정리로, 이 파일은 secret store 및 chat-channel 기능과 완전히 무관한 Table 시각형 노드 핸들러 테스트이며 변경 내용도 기능 동작과 무관한 코드 스타일 정리이다. 나머지 변경(secret-store 모듈 신설, chat-channel/notification 마이그레이션, spec/plan/가이드 문서 갱신, 테스트 보강)은 모두 `chat-channel-secret-store-pgcrypto` plan의 Phase 1~5 범위 내에 있다. lock 파일의 부수 갱신은 기능 영향이 없으나 noise를 더한다.

## 위험도

LOW
