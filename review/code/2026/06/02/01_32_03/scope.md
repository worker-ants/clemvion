# 변경 범위(Scope) 리뷰

## 발견사항

### 핵심 의도 파악

본 PR 의 의도는 `channel-web-chat-followups` plan 의 두 완료 항목이다:

- **D#1**: 공개 webhook 남용 방어 — `PublicWebhookQuotaService` + `PublicWebhookThrottleGuard` (backend)
- **C-2**: 위젯 리사이즈·이벤트 API 보강 — `wc:resize`, `on()` Unsubscribe 반환, `off()`, `data-global`, eslint 설정, npm scope `@workflow/web-chat` 확정

---

### [INFO] review/consistency 산출물 포함 — 정상 워크플로 산출물

- 위치: `review/consistency/2026/06/02/01_04_42/**`, `review/consistency/2026/06/02/01_14_34/**` (파일 24~37)
- 상세: 총 14개 파일이 일관성 검토 산출물이다. `developer` 역할의 `consistency-check --impl-prep` 의무 및 spec 변경 완료 후 재실행 산출물로 보이며, 이는 프로젝트 규약에서 명시적으로 허용하는 경로다. `review/consistency/` 쓰기 권한은 `consistency-checker` 역할에 있으나, 워크플로 자동 실행 결과가 포함된 것은 허용 범위다.
- 제안: 없음(정상).

### [INFO] `plan/in-progress/eia-sdk-publish.md` 수정 — npm scope 결정 기록

- 위치: 파일 23, `plan/in-progress/eia-sdk-publish.md`
- 상세: npm scope 결정이 이 PR 에서 확정됨에 따라 plan 의 미결 결정 사항을 확정 상태로 업데이트했다. 이는 `channel-web-chat-followups` plan 의 "선행 조건 완료" 기록이자 plan 이력 갱신으로, developer 쓰기 권한(`plan/**`) 범위다.
- 제안: 없음(정상).

### [INFO] `plan/in-progress/channel-web-chat-impl.md` 수정 — worktree 갱신 + 진입조건 완료 표기

- 위치: 파일 22, `plan/in-progress/channel-web-chat-impl.md`
- 상세: frontmatter `worktree` 필드를 stale branch 에서 현재 worktree 로 갱신하고, 이전에 "보류" 상태였던 진입 조건(npm scope, CDN, 샘플 경로)을 확정 완료로 업데이트했다. plan 관리 의무 범위 수정이다.
- 제안: 없음(정상).

### [INFO] `codebase/packages/web-chat-sdk/README.md`, `examples/README.md`, `examples/npm-usage.ts` — npm scope 동기화

- 위치: 파일 7, 9, 10
- 상세: `@clemvion/web-chat` → `@workflow/web-chat` 으로 패키지명 일괄 동기화. 이 PR 에서 npm scope 를 확정하는 결정과 완전히 일치하며, 의도된 변경 범위 내 필수 동기화다.
- 제안: 없음(정상).

### [INFO] `eslint.config.mjs` 신규 추가 + `package.json` lint 스크립트 분리

- 위치: 파일 8 (`eslint.config.mjs`), 파일 12 (`package.json`)
- 상세: `package.json` 의 `"lint": "tsc --noEmit"` 을 `"lint": "eslint ..."` + `"typecheck": "tsc --noEmit"` 으로 분리하고 eslint devDep 를 추가했다. `channel-web-chat-followups` plan 의 §7 "CI 테스트 오케스트레이션" 항목에서 명시된 "web-chat-sdk lint 처리 결정(eslint devDep 채택 완료)"과 일치한다. plan 이 이 결정을 기록하고 있으므로 의도된 변경이다.
- 제안: 없음(정상).

### [WARNING] `extractClientIp` 헬퍼 함수 중복 존재 — 코드 정리 미완

- 위치: 파일 6, `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` 내 `extractClientIp` 함수
- 상세: `public-webhook-throttle.guard.ts` 의 주석 자체가 "hooks.service.ts 의 동명 헬퍼와 동일 정책. 추후 공용 util 추출 후보." 라고 명시했다. 이 PR 에서 공용 util 로 추출하지 않고 복사한 것은 이 PR 의 핵심 의도(throttle 구현)와 무관한 리팩토링을 유보한 결정으로 볼 수 있으나, 주석에 기술된 채 중복이 잔존하는 상태다. 현재 변경 범위를 벗어나지는 않으나 향후 불일치 위험이 있다.
- 제안: 현재 PR 에서는 유보 허용. 단, 다음 increment 에서 공용 util 로 추출하는 후속 계획을 plan 에 명시할 것을 권장한다.

### [INFO] `bridge.spec.ts` 에 추가된 `off()` / `wc:resize` 테스트 — C-2 구현의 테스트 보강

- 위치: 파일 13, `codebase/packages/web-chat-sdk/src/bridge.spec.ts`
- 상세: 신규 구현(`off()`, `wc:resize`)에 대한 단위 테스트 추가. 의도된 C-2 범위의 정상적 테스트 보강이다.
- 제안: 없음(정상).

### [INFO] `plan/in-progress/channel-web-chat-followups.md` — 완료 항목 표기 및 잔여 작업 문서화

- 위치: 파일 21
- 상세: D#1, C-2 완료 표기와 함께 `show`/`hide`/`updateProfile` 핸들러 갭, `wc:command` 표 누락 등의 잔여 사항이 §4 항목에 추가 문서화됐다. 이는 의도된 변경이며 plan 관리 범위다.
- 제안: 없음(정상).

---

## 요약

본 변경은 `channel-web-chat-followups` plan 의 D#1(공개 webhook throttle) 및 C-2(SDK API 보강) 두 완료 항목에 잘 집중되어 있다. 37개 파일 모두 작업 의도 범위 내에서 설명된다: 백엔드 throttle guard 신규 구현(파일 1-6), SDK `off()`/`wc:resize`/`data-global` 보강(파일 13-20), npm scope 동기화(파일 7-12), plan/review 산출물 갱신(파일 21-37). `extractClientIp` 중복 헬퍼는 주석으로 유보를 명시했으나 향후 정리 부채로 남아 있다. 의도하지 않은 리팩토링, 무관한 파일 수정, 과도한 기능 확장은 발견되지 않았다.

## 위험도

LOW
