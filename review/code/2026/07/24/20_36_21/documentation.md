# 문서화(Documentation) 리뷰 결과

## 발견사항

- **[WARNING]** 인라인 주석의 수치가 실제 상수값과 불일치 (오래된 주석)
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:262`
  - 상세: `// A 의 완주를 기다리므로 창(8s) + 여유를 준다.` 라고 되어 있으나, 실제 "창"에 해당하는
    `INFLIGHT_WINDOW_MS` 는 `5_000`(5초)로 정의되어 있고 바로 위 JSDoc(파일 47~56행)도
    "5초인 이유: 폴링이 `running` 을 100ms 주기로 관측하고..." 라며 명시적으로 5초를 근거와 함께
    설명한다. 즉 같은 파일 안에서 상수 정의·JSDoc 은 5초라고 하는데, 사용처 인라인 주석만 8초라고
    적혀 있어 값이 모순된다. 초안에서 `INFLIGHT_WINDOW_MS` 를 8000→5000 으로 바꾸면서 이 주석만
    갱신에서 누락된 것으로 보인다. 기능에는 영향이 없지만(하드코딩된 값이 아니라 서술뿐), 향후
    타임아웃 예산을 조정하는 사람이 잘못된 여유값을 근거로 판단할 위험이 있다.
  - 제안: `창(8s)` → `창(5s)` 로 정정하거나, 매직넘버 하드코딩 대신 `INFLIGHT_WINDOW_MS` 를 문자열
    보간해 주석에 직접 참조시켜 향후 값이 바뀌어도 주석이 자동으로 정확해지게 한다.

- **[INFO]** 헬퍼 함수 문서화 수준이 파일 내에서 일관되지 않음
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts` 의 `execute()`(190행)·
    `getStatus()`(200행) 함수
  - 상세: 같은 그룹의 `nodeStatus()`(210행)에는 "노드 단위 상태는 DB 로 직접 본다 — 같은 파일군의
    확립된 관행" 이라는 한 줄 JSDoc 이 있는 반면, `execute()`/`getStatus()`는 이름만으로 자명하긴
    하나 문서가 전혀 없다. 크리티컬하지 않음.
  - 제안: 굳이 필요하진 않으나, 일관성을 원하면 한 줄씩만 추가.

- **[INFO]** `spec/conventions/node-cancellation.md` §6 구현 현황 표의 3개 행(“chat-channel 노드
  signal 전파” · “MakeShop 노드 signal 전파” · “Cafe24 노드 signal 전파”)이 여전히 “미구현
  (Planned)”이며 추적 참조로 `node-cancellation-infrastructure.md` 를 지목하는데, 그 문서는 이미
  `plan/complete/`로 이동해 완료 처리됐고(`plan/in-progress/`에 동일 파일 부재 확인), 실제로
  chat-channel/MakeShop/Cafe24 propagation 을 다루는 진행 중 plan 은 저장소 전체에서 찾을 수 없다
  (`plan/in-progress/cafe24-backlog-residual.md`, `plan/in-progress/node-output-redesign/cafe24.md`
  에도 abort/cancel 관련 내용 없음). 이 diff 가 만든 문제는 아니고(§6 표 자체는 이번 diff 에서
  변경되지 않음, unified diff 는 frontmatter 의 `status`/`pending_plans` 만 건드림), 또한
  `status: partial → implemented` 승격은 `spec/conventions/spec-impl-evidence.md` §3.1 의
  "마지막 `pending_plans` 가 `complete/` 로 이동하는 commit 안에서 승격" 규칙을 정확히 따른
  것이라 규약 위반은 아니다. 다만 frontmatter 의 `pending_plans` 링크(추적 신호)가 사라진 지금,
  §6 의 이 3개 행에 대한 실제 추적 수단이 없어져 향후 이 갭을 찾기 더 어려워진다는 점은
  기록해 둘 가치가 있다.
  - 제안: 이번 diff 범위 밖이므로 차단 사유는 아니나, 별도 후속 정리 시 §6 의 해당 3행 “추적”
    문구를 갱신(신규 plan 또는 backlog 항목 지정, 혹은 out-of-scope 명시)하는 것을 권장.

## 요약

신규 e2e 테스트 파일(`node-cancellation-propagation.e2e-spec.ts`)은 모듈 상단 JSDoc 이 "왜 e2e 인가"·
"결정적 하네스 설계"·범위 제외 사유를 근거(관련 plan/spec 경로, 실측 근거)와 함께 상세히 설명하고,
busy-wait·엣지 포트 오류로 인한 vacuous 통과 위험 등 비직관적인 로직마다 인라인 주석으로 이유를
남겨 문서화 품질이 전반적으로 높다. `database-query.handler.spec.ts`의 `§2.1` describe 명, `code.schema.ts`
의 포트 이름, `code.handler.ts`의 global 삭제 목록, `execution-engine.service.ts`의 `throwIfAborted()`,
`execution-concurrency-cap.e2e-spec.ts:234/:298` 등 주석이 인용한 사실관계를 모두 대조 확인했고
전부 정확했다. plan 완료 문서(`plan/complete/node-cancellation-inflight-followups.md`)도 결정
배경·대조군이 잡아낸 vacuity·잔여 리스크를 충실히 기록했으며, spec frontmatter 의
`status: partial → implemented` 승격은 `spec-impl-evidence.md` 컨벤션의 전이 규칙을 정확히 따른다.
유일한 실질적 결함은 `INFLIGHT_WINDOW_MS`(5초) 값과 어긋나는 인라인 주석 "창(8s)" 하나이며, 이는
기능에 영향은 없으나 향후 유지보수 시 혼동을 줄 수 있는 사실 오류다. README/API 문서/CHANGELOG/
환경변수 문서 갱신이 필요한 표면 변경은 없다(신규 e2e 는 `testRegex` 자동 discovery 대상, PROJECT.md
에도 수동 등록 불요로 명시됨).

## 위험도

LOW
