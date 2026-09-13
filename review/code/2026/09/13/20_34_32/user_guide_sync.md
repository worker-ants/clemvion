# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — error-code-emission-axis

## 검토 방법

`.claude/config/doc-sync-matrix.json` (rows 21개) 를 Read 하고 `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문(§L282 부근 표 + §297~311 가드 목록)을 보조로 Read 했다. 변경 파일 16개(prompt 첨부) 중 이 리뷰어 도메인과 관련 있는 것은 다음 6개로 좁혔다 — 나머지 10개(`plan/**`, `review/**`)는 프로세스 산출물이라 매트릭스 trigger 대상이 아니다.

- `CHANGELOG.md`, `PROJECT.md` — 메타 문서(가드 설명 갱신)
- `codebase/frontend/src/content/docs/02-nodes/logic.mdx` + `.en.mdx` — 유저 가이드 MDX (Loop 컨테이너 `emit` 경고 문구 정정)
- `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` + `guide-identifier-scan.ts` — `user-guide-evidence.md` SoT 를 지키는 가드 테스트 자체(발행 축 신설)

이번 변경은 **`codebase/backend/src/**` 를 전혀 건드리지 않는다** — meta.json 의 16개 파일 목록에 backend 경로가 하나도 없다. 따라서 매트릭스의 backend-트리거 행들(`new-node`, `node-schema-change`, `new-warning-code`, `new-error-code`, `auth-session-flow-change`, `expression-language-change`, `run-debug-flow-change`, `new-bullmq-queue` 등)은 애초에 **trigger 자체가 발화하지 않는다**.

## 매트릭스 매칭 결과

21개 행을 전수 대조했다.

- **`userguide-gui-flow-section`** (trigger glob `codebase/frontend/src/content/docs/02-nodes/**.mdx`) 만 glob 상으로 매칭된다 — `logic.mdx`/`logic.en.mdx` 가 변경 set 안에 있기 때문이다. 다만 이 행의 target 은 `<ImplAnchor kind="ui-entry">` 동반 작성 의무이고, PROJECT.md §274 가 그 적용 범위를 "GUI 흐름 절(예: '1. 좌측 메뉴 → Triggers 클릭')" 로 명시한다. 이번 diff 는 **기존 `<Callout type="warn">` 문구를 정정**한 것뿐이고 — Loop 컨테이너의 `emit` 포트 검증 실패 시 동작을 설명하는 내부 실행 의미론 문장이지, GUI 내비게이션 절이 아니다. 새 UI 안내 단계나 새 `<ImplAnchor>` 대상이 추가/삭제되지 않았다. `RESOLUTION.md` 가 이 배치의 가드 스위트가 46→63 GREEN(`impl-anchor-existence.test.ts` 포함 계열)이라고 기록해, 이 정정이 그 가드를 깨지 않았음을 뒷받침한다. **회색지대이지만 실질 갭 없음 → INFO.**
- 나머지 20개 행은 glob/semantic 어느 쪽으로도 매칭되지 않는다 (`spec-major-change` 도 `spec/**` 파일이 이번 변경 set 에 없어 미매칭).

## 발견사항

- **[INFO]** `userguide-gui-flow-section` trigger 가 glob 상 매칭되지만 실질적으로는 GUI 흐름 절이 아니라 경고 문구 정정
  - 변경 파일: `codebase/frontend/src/content/docs/02-nodes/logic.mdx`, `codebase/frontend/src/content/docs/02-nodes/logic.en.mdx`
  - 매트릭스 항목: `userguide-gui-flow-section` — "`<ImplAnchor kind="ui-entry">` 동반 작성 — file/symbol 실존 의무. SoT: `spec/conventions/user-guide-evidence.md`" (PROJECT.md §182·§274)
  - 상세: PROJECT.md §274 는 이 의무를 "GUI 흐름 절(예: '1. 좌측 메뉴 → Triggers 클릭')" 에 한정한다. 이번 diff 는 `<Callout type="warn">` 안의 한 문장 — "여러 개/0개 연결 시 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 로 실행 실패" → "실행이 실패하고 실패 메시지 앞에 그 토큰이 붙는다 (전용 코드 아님)" — 을 KO/EN 양쪽에서 동시에 정정한 것뿐이다. 새 GUI 내비게이션 단계·새 `<ImplAnchor>` 앵커 추가/삭제가 없어 이 trigger 의 target(anchor 동반 의무)이 실제로는 발화 대상이 아니라고 판단했다.
  - 제안: 조치 불필요 — 참고용 기록. (다른 리뷰어 산출물 `RESOLUTION.md` 가 가드 스위트 GREEN 46→63 을 실측 기록해 이 판단을 뒷받침한다.)

## 확인한 긍정 사항 (동반 갱신 정상 이행)

- **KO/EN 양방향 동시 정정**: `logic.mdx`(KO)·`logic.en.mdx`(EN) 가 같은 diff 안에서 **동일한 의미로** 함께 수정됐다 — "전용 에러 코드는 없으니 코드가 아니라 메시지를 봐야 해요" ↔ "there is no dedicated error code, so read the message rather than the code." i18n parity 관점에서 한쪽만 고치는 흔한 실패 패턴을 피했다.
- 이번 배치의 실질 목적 자체가 **유저 가이드가 존재하지 않는 에러 코드를 마치 `error.code` 로 발행되는 것처럼 서술한 결함**을 바로잡는 것이었고(`execution-engine.service.ts` 가 `code` 필드 없이 `{ message }` 만 기록함을 실측), 재발 방지용 가드(`guide-identifier-scan.ts` 의 `GUIDE_NON_EMITTED_VOCABULARY` 발행 축)까지 같은 PR 에 포함됐다. 이는 매트릭스가 존재하는 근본 이유(가이드-코드 drift 차단)와 정확히 부합하는 변경이다.
- spec 파일(`spec/5-system/3-error-handling.md §1.4` 등)에 대한 후속 정정 필요성은 developer 가 직접 spec 을 고치지 않고 `plan/in-progress/error-code-emission-axis.md` 에 항목으로 등재해 project-planner 위임 경로를 지켰다(`RESOLUTION.md` WARNING#1·#2) — `spec-defect-found` 행의 취지와 일치한다.

## 요약

매트릭스 21개 행 중 backend 코드가 전혀 변경되지 않아(`codebase/backend/src/**` 무변경) 대부분의 trigger 가 애초에 미발화했고, glob 상 매칭된 유일한 행(`userguide-gui-flow-section`)도 실질은 GUI 흐름 절이 아닌 경고 문구 정정이라 실질 갭이 없다(INFO 1건). 오히려 이 변경은 KO/EN 문서를 동시에 정정하고 재발 방지 가드까지 같은 PR 에 넣은, 매트릭스가 지향하는 이상적인 동반 갱신 사례다. 누락된 동반 갱신은 발견되지 않았다.

## 위험도
NONE
