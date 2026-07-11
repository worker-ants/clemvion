### 발견사항

- **[INFO]** 실제 코드 수정(`presentation.ts` `asEnvelope`)이 CHANGELOG.md에 반영되지 않음
  - 위치: 루트 `CHANGELOG.md` (미변경 — `git diff origin/main...HEAD --stat -- CHANGELOG.md` 결과 없음)
  - 상세: 이 저장소는 코드 변경을 동반하는 fix/feat PR마다 `CHANGELOG.md`에 `## Unreleased — <제목>` 항목을 추가하는 확립된 관례를 가진다. 직전 몇 커밋만 봐도 `bcd40e693 fix(kb-ws): KB WebSocket 이벤트 count drift 정정`(코드+spec 정정, 이번 PR과 스코프·성격이 유사한 버그 수정)·`d6ae32da3 fix(execution-engine): resume 턴 통합 usage-log attribution 복원`처럼 유사 규모의 버그 수정 PR이 모두 CHANGELOG 항목을 남겼다. 반대로 `docs(spec)`류 spec-only 커밋(`7f395638f`, `1715f04ab`, `cc3dafa8c`)은 CHANGELOG를 건드리지 않아, "실행 코드 변경이 있으면 CHANGELOG에 기록한다"는 패턴이 일관되게 관찰된다. 이번 PR은 `presentation.ts`의 `asEnvelope`에 실제 런타임 동작을 바꾸는 버그 수정(`truncation` 흡수 로직 추가, 새로고침 복원 4종 렌더 회귀 가드 포함)을 포함하는데도 CHANGELOG 항목이 없다.
  - 제안: `## Unreleased — 위젯 복원 thread presentation truncation 흡수 정정 (7-channel-web-chat)` 같은 제목으로, `asEnvelope`가 `PresentationPayload.truncation`(top-level)을 `output`으로 흡수하지 못해 잘림 배너가 뜨지 않던 버그 수정 + 복원 thread presentation 4종 렌더 회귀 가드 + spec 정정(`1-widget-app.md` §2 "알려진 제약(Planned)" 서술 정정) 요지를 1문단 정도로 추가할 것을 권장. CRITICAL/WARNING으로 판단할 만큼 강제 규약 문서(`CLAUDE.md`/`developer/SKILL.md`/`plan-lifecycle.md`)에 명시된 필수 게이트는 아니므로 INFO에 그친다.

- **[INFO]** 직전 라운드(`23_04_23`)에서 지적된 WARNING(모듈 헤더 주석 staleness)이 이번 diff에서 정확히 해소됨 — 정합성 확인
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:1-6` (모듈 헤더) vs `presentation.ts:127-142` (`asEnvelope` JSDoc)
  - 상세: 직전 문서화 리뷰가 지적한 "헤더 주석에 `truncation?` 필드 누락 → `asEnvelope` JSDoc과 shape 정의 불일치" 문제가 `truncation?` 및 "cap 메타는 payload 바깥 top-level" 문구 추가로 정확히 고쳐졌다. 같은 라운드가 지적한 마크다운 링크 문법 불일치(INFO)도 plain 텍스트(`Presentation 공통 §10.4 — spec/4-nodes/6-presentation/0-common.md`)로 통일됐고, `maintainability`가 지적한 "병합 우선순위(충돌 시 어느 쪽이 이기는지) 미문서화" 항목도 JSDoc에 "병합 규칙: … 같은 키가 payload 에도 있으면 top-level truncation 이 우선한다"는 문장으로 명시적으로 보강됐다. RESOLUTION.md에 기록된 3건(문서화 WARNING·문서화 INFO·유지보수성 INFO) 모두 코드와 diff 상에서 실제로 반영됨을 직접 확인했다 — 별도 조치 불필요, 참고용 긍정 기록.

- **[INFO]** 신규 테스트(`conversation.test.ts`, `presentation.test.ts`, `presentations.test.tsx`)의 설명 주석 품질 양호
  - 위치: `codebase/channel-web-chat/src/lib/conversation.test.ts:43-46`, `presentation.test.ts:128-130,142-143,164,174,185-186,193`, `widget/components/presentations.test.tsx:305-306,355`
  - 상세: 각 신규 `describe`/`it` 앞에 "무엇을 회귀 가드하는가 + spec 근거(§7.10/§10.4) + 실패 시 증상(예: "1MB cap 배너가 영영 안 뜬다")"을 명시한 주석이 붙어 있고, 이 문구가 `presentation.ts`의 JSDoc·plan 문서(`plan/in-progress/widget-presentation-restore.md` §3)와 표현까지 정확히 일치한다. 특히 "병합 우선순위 lock-in" 테스트(`presentation.test.ts:174-183`)의 주석은 "spread 순서를 뒤집는 리팩터가 조용히 통과하지 못하게 한다"는 의도를 명확히 남겨, 코드만 봐서는 알 수 없는 "왜 이 테스트가 존재하는가"를 잘 전달한다. 별도 지적 없음.

- **[INFO]** spec 3개 파일(`1-widget-app.md`, `_product-overview.md`, `conversation-thread.md`) 정정은 SoT 원칙을 준수하며 상호 참조가 정합
  - 위치: `spec/7-channel-web-chat/1-widget-app.md` §2 presentation 행, `spec/7-channel-web-chat/_product-overview.md` §2 "비목표" 목록, `spec/conventions/conversation-thread.md` §2.1
  - 상세: `conversation-thread.md` §2.1에 "표시물({config,output} envelope)은 thread 에 영속되지 않는다"는 확정 제약이 SoT 컨벤션 문서에 신설되고, 소비 문서(`1-widget-app.md` §2)가 이를 상호 참조("SoT: [conversation-thread §2.1]")하며, `_product-overview.md` §2 비목표 목록도 동일 제약을 백로그로 등재해 3곳이 정확히 정합한다. 이는 직전 `/consistency-check --spec`(22_27_45)의 WARNING("신규 확정 제약이 SoT 컨벤션 문서에 미등록")을 같은 커밋에서 해소한 것으로, 문서 정정 워크플로가 잘 수렴한 사례다. `1-widget-app.md` §2의 정정 서술("알려진 제약(Planned) … graceful 하게 무시(빈 렌더)" 삭제 → 두 shape 모두 수용 명시)도 실측(무수정 프로브 테스트 통과)과 일치해, 낡은 spec 문구가 사실을 오도하던 상태(SPEC-DRIFT)를 코드 실측 기반으로 정정한 모범 사례다.

- **[INFO]** README/API 문서/신규 설정·환경변수 문서화 불필요 확인
  - 위치: `codebase/channel-web-chat/README.md`(미변경, 확인만) — REST/WS DTO·환경변수 변경 없음
  - 상세: 이번 변경은 위젯 내부 순수 함수(`asEnvelope`) 버그 수정으로 공개 API·설정 옵션·신규 환경변수를 도입하지 않는다. README·Swagger/DTO 문서·예제 코드 갱신 대상이 아니다.

### 요약

이번 diff는 (1) `presentation.ts` `asEnvelope`의 `PresentationPayload.truncation` top-level 흡수 버그 수정(4-키 화이트리스트 `truncationMeta()`) + 3계층 회귀 테스트, (2) 그 근거 spec 문서 3건 정정, (3) 직전 리뷰 라운드(`23_04_23`)의 산출물 커밋으로 구성된다. 직전 라운드에서 지적된 유일한 WARNING(모듈 헤더 주석이 `truncation?` 필드를 반영 못해 JSDoc과 불일치)은 이번 diff에서 정확히 해소됐고, 함께 지적된 INFO(마크다운 링크 문법 불일치·병합 우선순위 미문서화)도 모두 반영됐다는 것을 코드 직접 대조로 확인했다. spec 정정 3건은 SoT 컨벤션 문서(`conversation-thread.md`)·소비 문서(`1-widget-app.md`)·영역 백로그(`_product-overview.md`) 간 상호 참조가 정합하고, 신규 테스트의 설명 주석도 spec 근거를 정확히 인용한다. 유일하게 남은 실질적 관찰은 실행 코드를 바꾸는 버그 수정(`asEnvelope`)임에도 이 저장소의 확립된 관례(코드 변경 동반 fix/feat PR마다 `CHANGELOG.md`에 `Unreleased` 항목 기록)를 따르지 않았다는 점이며, 강제 게이트가 아니므로 INFO로 기록한다.

### 위험도
LOW
